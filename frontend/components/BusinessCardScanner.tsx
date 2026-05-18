import {
  Briefcase,
  Building2,
  Camera,
  Check,
  Edit2,
  Globe,
  Loader2,
  Mail,
  Phone,
  Upload,
  User,
  X,
} from "lucide-react"
import type React from "react"
import { useCallback, useRef, useState } from "react"
import { apiClient } from "../src/services/apiClient"
import type { BusinessCardData, Customer } from "../types"

interface BusinessCardScannerProps {
  isOpen: boolean
  onClose: () => void
  customerId?: string
  customers: Customer[]
  onScanComplete: (data: BusinessCardData, customerId?: string, contactId?: string) => void
}

export const BusinessCardScanner: React.FC<BusinessCardScannerProps> = ({
  isOpen,
  onClose,
  customerId,
  customers,
  onScanComplete,
}) => {
  const [mode, setMode] = useState<"select" | "camera" | "preview" | "result">("select")
  const [image, setImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [_scanResult, setScanResult] = useState<BusinessCardData | null>(null)
  const [editableResult, setEditableResult] = useState<BusinessCardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customerId || "")
  const [createNewCustomer, setCreateNewCustomer] = useState(!customerId)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setMode("camera")
    } catch (err) {
      console.error("Camera access denied:", err)
      setError("카메라에 접근할 수 없습니다. 권한을 확인해주세요.")
    }
  }, [])

  const capturePhoto = useCallback(() => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas")
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9)
        setImage(dataUrl)
        stopCamera()
        setMode("preview")
      }
    }
  }, [stopCamera])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("파일 크기가 10MB를 초과합니다.")
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        setImage(dataUrl)
        setMode("preview")
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const scanCard = useCallback(async () => {
    if (!image) return

    // Validate customer selection
    if (!createNewCustomer && !selectedCustomerId) {
      setError("고객을 선택하거나 신규 고객 생성을 선택해주세요.")
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const targetCustomerId = createNewCustomer ? undefined : selectedCustomerId
      const result = await apiClient.scanBusinessCard(image, targetCustomerId, createNewCustomer)

      if (result.success && "data" in result) {
        const data = result.data as unknown as BusinessCardData
        setScanResult(data)
        setEditableResult({ ...data })
        setMode("result")
      }
    } catch (err: any) {
      setError(err.message || "명함 인식에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setIsProcessing(false)
    }
  }, [image, selectedCustomerId, createNewCustomer])

  const handleClose = useCallback(() => {
    stopCamera()
    setMode("select")
    setImage(null)
    setScanResult(null)
    setEditableResult(null)
    setError(null)
    onClose()
  }, [stopCamera, onClose])

  const handleSave = useCallback(async () => {
    if (!editableResult) return

    // Use the already-scanned result, no need for another API call
    onScanComplete(editableResult, createNewCustomer ? undefined : selectedCustomerId)
    handleClose()
  }, [editableResult, selectedCustomerId, createNewCustomer, onScanComplete, handleClose])

  const handleRetake = useCallback(() => {
    setImage(null)
    setScanResult(null)
    setEditableResult(null)
    setError(null)
    setMode("select")
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800">명함 스캔</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Mode: Select */}
          {mode === "select" && (
            <div className="space-y-4">
              <p className="text-slate-600 text-sm mb-6">
                명함을 촬영하거나 이미지 파일을 업로드하여 연락처 정보를 자동으로 추출합니다.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={startCamera}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">카메라 촬영</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">파일 업로드</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Customer Selection */}
              <div className="mt-6 pt-6 border-t">
                <label className="block text-sm font-medium text-slate-700 mb-3">저장 위치</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="saveOption"
                      checked={createNewCustomer}
                      onChange={() => setCreateNewCustomer(true)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-700">새 고객으로 생성</span>
                      <p className="text-xs text-slate-500">
                        명함에서 추출한 회사명으로 새 고객을 생성합니다
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="saveOption"
                      checked={!createNewCustomer}
                      onChange={() => setCreateNewCustomer(false)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-700">기존 고객에 추가</span>
                      {!createNewCustomer && (
                        <select
                          value={selectedCustomerId}
                          onChange={(e) => setSelectedCustomerId(e.target.value)}
                          className="mt-2 w-full p-2 border rounded-lg text-sm"
                        >
                          <option value="">고객 선택...</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Mode: Camera */}
          {mode === "camera" && (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 border-2 border-white/30 m-4 rounded-lg pointer-events-none" />
              </div>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => {
                    stopCamera()
                    setMode("select")
                  }}
                  className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={capturePhoto}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  촬영
                </button>
              </div>
            </div>
          )}

          {/* Mode: Preview */}
          {mode === "preview" && image && (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden">
                <img src={image} alt="Captured" className="w-full h-full object-contain" />
              </div>
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleRetake}
                  className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  다시 촬영
                </button>
                <button
                  onClick={scanCard}
                  disabled={isProcessing}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      명함 인식
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Mode: Result */}
          {mode === "result" && editableResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-4">
                <Check className="w-5 h-5" />
                <span className="font-medium">명함 인식 완료</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  <div className="flex-1">
                    <label className="text-xs text-slate-500">회사명</label>
                    <input
                      type="text"
                      value={editableResult.companyName || ""}
                      onChange={(e) =>
                        setEditableResult({ ...editableResult, companyName: e.target.value })
                      }
                      className="w-full bg-transparent text-slate-800 font-medium outline-none"
                      placeholder="회사명"
                    />
                  </div>
                  <Edit2 className="w-4 h-4 text-slate-400" />
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Globe className="w-5 h-5 text-slate-400" />
                  <div className="flex-1">
                    <label className="text-xs text-slate-500">웹사이트</label>
                    <input
                      type="text"
                      value={editableResult.website || ""}
                      onChange={(e) =>
                        setEditableResult({ ...editableResult, website: e.target.value })
                      }
                      className="w-full bg-transparent text-slate-800 outline-none"
                      placeholder="www.example.com"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <User className="w-5 h-5 text-slate-400" />
                  <div className="flex-1">
                    <label className="text-xs text-slate-500">담당자</label>
                    <input
                      type="text"
                      value={editableResult.contactName || ""}
                      onChange={(e) =>
                        setEditableResult({ ...editableResult, contactName: e.target.value })
                      }
                      className="w-full bg-transparent text-slate-800 font-medium outline-none"
                      placeholder="담당자 이름"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Briefcase className="w-5 h-5 text-slate-400" />
                  <div className="flex-1">
                    <label className="text-xs text-slate-500">직함</label>
                    <input
                      type="text"
                      value={editableResult.title || ""}
                      onChange={(e) =>
                        setEditableResult({ ...editableResult, title: e.target.value })
                      }
                      className="w-full bg-transparent text-slate-800 outline-none"
                      placeholder="직함"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <div className="flex-1">
                    <label className="text-xs text-slate-500">이메일</label>
                    <input
                      type="email"
                      value={editableResult.email || ""}
                      onChange={(e) =>
                        setEditableResult({ ...editableResult, email: e.target.value })
                      }
                      className="w-full bg-transparent text-slate-800 outline-none"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Phone className="w-5 h-5 text-slate-400" />
                  <div className="flex-1">
                    <label className="text-xs text-slate-500">전화번호</label>
                    <input
                      type="tel"
                      value={editableResult.phone || ""}
                      onChange={(e) =>
                        setEditableResult({ ...editableResult, phone: e.target.value })
                      }
                      className="w-full bg-transparent text-slate-800 outline-none"
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={handleRetake}
                  className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  다시 촬영
                </button>
                <button
                  onClick={handleSave}
                  disabled={isProcessing || !editableResult.contactName}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      저장
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BusinessCardScanner
