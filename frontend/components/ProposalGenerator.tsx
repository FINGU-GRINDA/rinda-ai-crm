import type React from "react"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import { useBackgroundTasks } from "../contexts/BackgroundTaskContext"
import { generateProposalCoverImage, generateProposalStrategy } from "../services/geminiService"
import { type Customer, ImageSize, type ProcessingStatus } from "../types"
import { IconBrain, IconCheck, IconClock, IconLoader, IconWand, IconX } from "./Icons"

interface Props {
  customer: Customer
  onClose: () => void
  onSave: (proposal: { title: string; content: string; imageUrl?: string }) => void
}

export const ProposalGenerator: React.FC<Props> = ({ customer, onClose, onSave }) => {
  const [status, setStatus] = useState<ProcessingStatus>("idle")
  const [stepLog, setStepLog] = useState<string[]>([])
  const [generatedContent, setGeneratedContent] = useState<string>("")
  const [generatedImage, setGeneratedImage] = useState<string>("")
  const [selectedImageSize, setSelectedImageSize] = useState<ImageSize>(ImageSize.Size_1K)
  const [generationMode, setGenerationMode] = useState<"foreground" | "background">("foreground")

  const { startProposalGeneration } = useBackgroundTasks()

  const addLog = (msg: string) => setStepLog((prev) => [...prev, msg])

  const handleGenerate = async () => {
    if (!customer.enrichedData) {
      alert("먼저 AI 데이터 분석을 실행해주세요.")
      return
    }

    // Background mode - start and close modal
    if (generationMode === "background") {
      startProposalGeneration(customer, selectedImageSize)
      onClose()
      return
    }

    // Foreground mode - existing behavior
    setStatus("thinking")
    setStepLog([])
    addLog("제안서 작성 준비 중")

    try {
      // Step 1: Text Generation (Thinking Model)
      addLog("1단계: 제안서 내용 작성 중 (Gemini 3 Pro)")
      const strategyText = await generateProposalStrategy(
        customer.name,
        customer.enrichedData,
        customer.notes,
      )
      setGeneratedContent(strategyText)
      addLog("제안서 내용 작성 완료")

      // Step 2: Image Generation (Nano Banana Pro)
      setStatus("generating_image")
      addLog(`2단계: 커버 이미지 생성 (${selectedImageSize} 화질)`)
      // Pass summary for context-aware image generation
      const imageUrl = await generateProposalCoverImage(
        customer.name,
        customer.industry,
        customer.enrichedData.summary,
        selectedImageSize,
      )
      setGeneratedImage(imageUrl)
      addLog("커버 이미지 생성 완료")

      setStatus("complete")
    } catch (e) {
      console.error(e)
      addLog("제안서 생성 실패")
      setStatus("error")
    }
  }

  const handleSave = () => {
    onSave({
      title: `${customer.name} 맞춤 제안서`,
      content: generatedContent,
      imageUrl: generatedImage,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-4xl h-[95vh] md:h-auto md:max-h-[90vh] flex flex-col animate-slide-in-from-bottom md:animate-in md:zoom-in-95 duration-300 safe-bottom">
        {/* Drag Handle (Mobile Only) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="text-base md:text-lg font-bold text-slate-800 flex items-center">
            <IconWand className="w-5 h-5 mr-2 text-blue-600" />
            <span className="truncate">{customer.name} 제안서</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg p-2 transition-colors touch-target"
            aria-label="닫기"
          >
            <IconX className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {status === "idle" && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-5 rounded-lg border border-blue-200 shadow-sm">
                <h3 className="font-semibold text-neutral-900 mb-2 flex items-center">
                  <IconBrain className="w-4 h-4 mr-2" />
                  AI 설정 안내
                </h3>
                <p className="text-sm text-neutral-700 mb-4 leading-relaxed">
                  RINDA는 <strong className="text-neutral-900">Gemini 3 Pro</strong>로 제안서 내용을
                  작성하고, <strong className="text-neutral-900">Nano Banana Pro</strong>로 커버
                  이미지를 만듭니다.
                </p>

                <div className="space-y-4">
                  {/* Image Size Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      커버 이미지 화질 선택
                    </label>
                    <div className="flex gap-4">
                      {Object.values(ImageSize).map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedImageSize(size)}
                          className={`px-4 py-2 text-sm rounded-full border transition-all ${
                            selectedImageSize === size
                              ? "bg-blue-600 text-white border-blue-600 shadow-md"
                              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generation Mode Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      생성 방식 선택
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Foreground Mode */}
                      <button
                        onClick={() => setGenerationMode("foreground")}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          generationMode === "foreground"
                            ? "border-blue-500 bg-blue-50 shadow-md"
                            : "border-slate-200 bg-white hover:border-blue-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              generationMode === "foreground"
                                ? "bg-blue-500 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <IconBrain className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h4
                              className={`font-semibold text-sm ${
                                generationMode === "foreground" ? "text-blue-900" : "text-slate-700"
                              }`}
                            >
                              여기서 바로 생성
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">
                              이 화면에서 제안서가 완성될 때까지 기다립니다. 결과를 바로 확인할 수
                              있습니다.
                            </p>
                          </div>
                        </div>
                      </button>

                      {/* Background Mode */}
                      <button
                        onClick={() => setGenerationMode("background")}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          generationMode === "background"
                            ? "border-violet-500 bg-violet-50 shadow-md"
                            : "border-slate-200 bg-white hover:border-violet-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              generationMode === "background"
                                ? "bg-violet-500 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <IconClock className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h4
                              className={`font-semibold text-sm ${
                                generationMode === "background"
                                  ? "text-violet-900"
                                  : "text-slate-700"
                              }`}
                            >
                              백그라운드에서 생성
                              <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                                추천
                              </span>
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">
                              다른 작업을 하면서 제안서를 생성합니다. 완료되면 알림을 표시합니다.
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Background Mode Info */}
              {generationMode === "background" && (
                <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                      <IconClock className="w-4 h-4 text-neutral-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-900 text-sm mb-1">
                        백그라운드 생성 안내
                      </h4>
                      <ul className="text-xs text-neutral-700 space-y-1">
                        <li className="flex items-center gap-2">
                          <IconCheck className="w-3 h-3 text-emerald-500" />
                          버튼을 누르면 이 창이 닫히고 다른 작업을 계속할 수 있습니다
                        </li>
                        <li className="flex items-center gap-2">
                          <IconCheck className="w-3 h-3 text-emerald-500" />
                          화면 오른쪽 아래에서 진행 상황을 확인할 수 있습니다
                        </li>
                        <li className="flex items-center gap-2">
                          <IconCheck className="w-3 h-3 text-emerald-500" />
                          완료되면 알림이 표시되고, 바로 결과를 확인할 수 있습니다
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleGenerate}
                  className={`px-6 py-3 rounded-lg font-medium flex items-center shadow-sm hover:shadow transition-all active:scale-95 ${
                    generationMode === "background"
                      ? "bg-neutral-900 hover:bg-neutral-800 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {generationMode === "background" ? (
                    <>
                      <IconClock className="w-5 h-5 mr-2" />
                      백그라운드에서 제안서 만들기
                    </>
                  ) : (
                    <>
                      <IconBrain className="w-5 h-5 mr-2" />
                      제안서 만들기 시작
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {(status === "thinking" || status === "generating_image") && (
            <div className="flex flex-col items-center justify-center h-64 space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-400 blur-xl opacity-30 animate-pulse rounded-full"></div>
                <IconLoader className="w-12 h-12 text-blue-600 animate-spin relative z-10" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 animate-pulse">
                {status === "thinking"
                  ? "AI가 제안서 내용을 작성 중입니다"
                  : "커버 이미지를 생성 중입니다"}
              </h3>
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 w-full max-w-md shadow-sm">
                <ul className="text-sm space-y-2.5">
                  {stepLog.map((log, i) => (
                    <li
                      key={i}
                      className="flex items-center text-slate-700 bg-white px-3 py-2 rounded border border-slate-100"
                    >
                      <IconCheck className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                      <span className="flex-1">{log}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {status === "complete" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
              {/* Preview Content */}
              <div className="prose prose-sm prose-blue max-h-[500px] overflow-auto p-5 bg-neutral-50 rounded-xl border border-neutral-200 shadow-sm">
                <ReactMarkdown>{generatedContent}</ReactMarkdown>
              </div>

              {/* Preview Image */}
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden shadow-lg border-2 border-slate-200 bg-slate-100 min-h-[200px] flex items-center justify-center group hover:border-blue-300 transition-colors">
                  {generatedImage ? (
                    <img
                      src={generatedImage}
                      alt="Generated Cover"
                      className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <span className="text-slate-400">이미지 로드 실패</span>
                  )}
                </div>
                <div className="text-xs text-center text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                  gemini-3-pro-image-preview @ {selectedImageSize}
                </div>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-10">
              <div className="text-red-500 mb-2 font-semibold">제안서 생성 실패</div>
              <button
                onClick={() => setStatus("idle")}
                className="text-blue-600 underline hover:text-blue-700"
              >
                다시 시도
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {status === "complete" && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between gap-3">
            <button
              onClick={handleGenerate}
              className="px-4 py-2 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg text-sm flex items-center justify-center transition-colors active:scale-95"
            >
              <IconBrain className="w-4 h-4 mr-2" />
              다시 만들기
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors active:scale-95"
              >
                닫기
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm hover:shadow transition-all active:scale-95"
              >
                제안서 저장
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
