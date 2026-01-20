import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Mic, MicOff, Upload, Loader2, Check, Play, Pause, Square, FileAudio, Clock, AlertCircle } from 'lucide-react';
import { apiClient } from '../src/services/apiClient';
import { MeetingSummary, Customer, RecordingStatus } from '../types';

interface MeetingRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  customerName?: string;
  customers: Customer[];
  onComplete: (summary: MeetingSummary) => void;
}

export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  customers,
  onComplete
}) => {
  const [mode, setMode] = useState<'select' | 'record' | 'upload'>('select');
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState(customerName ? `${customerName} 미팅` : '');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || '');
  const [error, setError] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<MeetingSummary | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Update title when customerName changes
  useEffect(() => {
    if (customerName && !title) {
      setTitle(`${customerName} 미팅`);
    }
  }, [customerName, title]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setDuration(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecordingStatus('complete');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setRecordingStatus('recording');

      // Start timer
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('마이크에 접근할 수 없습니다. 권한을 확인해주세요.');
      setRecordingStatus('error');
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingStatus === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingStatus('paused');
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [recordingStatus]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingStatus === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingStatus('recording');
      // Clear any existing interval before creating a new one
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
  }, [recordingStatus]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && (recordingStatus === 'recording' || recordingStatus === 'paused')) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [recordingStatus]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        setError('파일 크기가 25MB를 초과합니다.');
        return;
      }

      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
      setRecordingStatus('complete');
      setMode('upload');
    }
  }, []);

  const togglePlayback = useCallback(() => {
    if (audioPlayerRef.current) {
      if (isPlaying) {
        audioPlayerRef.current.pause();
      } else {
        audioPlayerRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const generateSummary = useCallback(async () => {
    // Validate required fields
    if (!audioBlob || !selectedCustomerId || !title || !meetingDate) {
      setError('필수 정보를 입력해주세요.');
      return;
    }

    // Validate date
    const dateObj = new Date(meetingDate);
    if (isNaN(dateObj.getTime())) {
      setError('유효한 날짜를 입력해주세요.');
      return;
    }

    setRecordingStatus('processing');
    setError(null);

    try {
      const base64Audio = await blobToBase64(audioBlob);

      const result = await apiClient.summarizeMeeting({
        audioData: base64Audio,
        customerId: selectedCustomerId,
        title,
        meetingDate: dateObj.toISOString()
      });

      if (result.success && 'data' in result) {
        const summary = result.data as unknown as MeetingSummary;
        setSummaryResult(summary);
        onComplete(summary);
      }
    } catch (err: any) {
      console.error('Summarization failed:', err);
      setError(err.message || '미팅 요약 생성에 실패했습니다.');
      setRecordingStatus('error');
    }
  }, [audioBlob, selectedCustomerId, title, meetingDate, onComplete]);

  const handleClose = useCallback(() => {
    if (mediaRecorderRef.current && (recordingStatus === 'recording' || recordingStatus === 'paused')) {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setMode('select');
    setRecordingStatus('idle');
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    setSummaryResult(null);
    onClose();
  }, [recordingStatus, audioUrl, onClose]);

  const handleReset = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setMode('select');
    setRecordingStatus('idle');
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    setSummaryResult(null);
  }, [audioUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800">미팅 녹음</h2>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Mode: Select */}
          {mode === 'select' && recordingStatus === 'idle' && (
            <div className="space-y-4">
              <p className="text-slate-600 text-sm mb-6">
                미팅을 녹음하거나 오디오 파일을 업로드하여 AI가 핵심 내용을 요약합니다.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setMode('record'); startRecording(); }}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-red-400 hover:bg-red-50 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <Mic className="w-6 h-6 text-red-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">실시간 녹음</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">파일 업로드</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Customer & Title Selection */}
              <div className="mt-6 pt-6 border-t space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    고객사 선택 *
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      const customer = customers.find(c => c.id === e.target.value);
                      if (customer && !title) {
                        setTitle(`${customer.name} 미팅`);
                      }
                    }}
                    className="w-full p-3 border rounded-lg text-sm"
                    required
                  >
                    <option value="">고객 선택...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    미팅 제목 *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 border rounded-lg text-sm"
                    placeholder="예: 1차 미팅, 제안 발표 등"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    미팅 날짜
                  </label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full p-3 border rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mode: Recording */}
          {(mode === 'record' && (recordingStatus === 'recording' || recordingStatus === 'paused')) && (
            <div className="space-y-6">
              {/* Recording Indicator */}
              <div className="flex flex-col items-center py-8">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${
                  recordingStatus === 'recording' ? 'bg-red-100 animate-pulse' : 'bg-slate-100'
                }`}>
                  {recordingStatus === 'recording' ? (
                    <Mic className="w-10 h-10 text-red-600" />
                  ) : (
                    <MicOff className="w-10 h-10 text-slate-400" />
                  )}
                </div>
                <div className="text-3xl font-mono font-bold text-slate-800">
                  {formatDuration(duration)}
                </div>
                <div className="text-sm text-slate-500 mt-2">
                  {recordingStatus === 'recording' ? '녹음 중...' : '일시정지'}
                </div>
              </div>

              {/* Recording Controls */}
              <div className="flex justify-center gap-4">
                {recordingStatus === 'recording' ? (
                  <button
                    onClick={pauseRecording}
                    className="p-4 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
                  >
                    <Pause className="w-6 h-6 text-slate-600" />
                  </button>
                ) : (
                  <button
                    onClick={resumeRecording}
                    className="p-4 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors"
                  >
                    <Play className="w-6 h-6 text-blue-600" />
                  </button>
                )}
                <button
                  onClick={stopRecording}
                  className="p-4 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                >
                  <Square className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Mode: Complete (Ready to summarize) */}
          {recordingStatus === 'complete' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-green-600 mb-4">
                <Check className="w-5 h-5" />
                <span className="font-medium">녹음 완료</span>
              </div>

              {/* Audio Player */}
              {audioUrl && (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={togglePlayback}
                      className="p-3 bg-white rounded-full shadow hover:bg-slate-100 transition-colors"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 text-slate-600" />
                      ) : (
                        <Play className="w-5 h-5 text-slate-600" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <FileAudio className="w-4 h-4" />
                        <span>녹음된 오디오</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDuration(duration)}</span>
                      </div>
                    </div>
                  </div>
                  <audio
                    ref={audioPlayerRef}
                    src={audioUrl}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />
                </div>
              )}

              {/* Meeting Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    고객사 *
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full p-3 border rounded-lg text-sm"
                    required
                  >
                    <option value="">고객 선택...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    미팅 제목 *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 border rounded-lg text-sm"
                    placeholder="미팅 제목"
                    required
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  다시 녹음
                </button>
                <button
                  onClick={generateSummary}
                  disabled={!selectedCustomerId || !title}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-5 h-5" />
                  요약 생성
                </button>
              </div>
            </div>
          )}

          {/* Mode: Processing */}
          {recordingStatus === 'processing' && (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <div className="text-lg font-medium text-slate-800">AI가 미팅을 분석하고 있습니다</div>
              <div className="text-sm text-slate-500 mt-2">잠시만 기다려주세요...</div>
            </div>
          )}

          {/* Summary Result */}
          {summaryResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 mb-4">
                <Check className="w-5 h-5" />
                <span className="font-medium">요약 완료</span>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl">
                <h4 className="font-medium text-slate-800 mb-2">미팅 요약</h4>
                <p className="text-sm text-slate-600">{summaryResult.summary}</p>
              </div>

              {summaryResult.keyDiscussions.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <h4 className="font-medium text-slate-800 mb-2">핵심 논의사항</h4>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                    {summaryResult.keyDiscussions.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summaryResult.actionItems.length > 0 && (
                <div className="p-4 bg-amber-50 rounded-xl">
                  <h4 className="font-medium text-slate-800 mb-2">액션 아이템</h4>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                    {summaryResult.actionItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summaryResult.nextSteps.length > 0 && (
                <div className="p-4 bg-green-50 rounded-xl">
                  <h4 className="font-medium text-slate-800 mb-2">다음 단계</h4>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                    {summaryResult.nextSteps.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleClose}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  완료
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingRecorder;
