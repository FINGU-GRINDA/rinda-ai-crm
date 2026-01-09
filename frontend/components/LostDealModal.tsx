import React, { useState } from 'react';
import { IconX } from './Icons';

interface LostDealModalProps {
  customerName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export const LostDealModal: React.FC<LostDealModalProps> = ({
  customerName,
  onConfirm,
  onCancel
}) => {
  const [reason, setReason] = useState('');
  const [selectedReason, setSelectedReason] = useState<string>('');

  const commonReasons = [
    '가격 경쟁력 부족',
    '경쟁사 선택',
    '예산 부족',
    '타이밍 부적절',
    '기능/솔루션 미흡',
    '의사결정 지연',
    '기타'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim() || selectedReason) {
      onConfirm(reason || selectedReason);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-2xl md:rounded-xl p-4 md:p-6 w-full md:max-w-md shadow-2xl animate-slide-in-from-bottom md:animate-in md:zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto safe-bottom">
        {/* Drag Handle (Mobile Only) */}
        <div className="flex justify-center pb-2 md:hidden">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800">Deal 실패 처리</h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 touch-target"
            aria-label="닫기"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-slate-600 mb-4">
            <span className="font-semibold text-slate-800">{customerName}</span>의 거래를 Lost Deal로 표시합니다.
            <br />
            실패 사유를 입력해주세요. (AI 재접촉 전략 수립에 활용됩니다)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 빠른 선택 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              일반적인 사유 (선택)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {commonReasons.map((commonReason) => (
                <button
                  key={commonReason}
                  type="button"
                  onClick={() => {
                    setSelectedReason(commonReason);
                    if (commonReason !== '기타') {
                      setReason(commonReason);
                    } else {
                      setReason('');
                    }
                  }}
                  className={`
                    px-3 py-2 text-sm rounded-lg border transition-all
                    ${
                      selectedReason === commonReason
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }
                  `}
                >
                  {commonReason}
                </button>
              ))}
            </div>
          </div>

          {/* 상세 사유 입력 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              상세 사유 *
            </label>
            <textarea
              required
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value) {
                  setSelectedReason('기타');
                }
              }}
              placeholder="거래 실패의 구체적인 사유를 입력해주세요..."
              rows={4}
              className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200">
            <button 
              type="button" 
              onClick={onCancel} 
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button 
              type="submit" 
              disabled={!reason.trim()}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Lost Deal로 표시
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};



