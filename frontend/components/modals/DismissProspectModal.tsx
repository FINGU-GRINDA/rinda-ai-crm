import React, { useState } from 'react';
import { Prospect } from '../../types';
import { IconX } from '../Icons';

interface DismissProspectModalProps {
  isOpen: boolean;
  prospect: Prospect | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const DISMISS_REASONS = [
  '잘못된 산업',
  '회사 규모가 너무 작음',
  '회사 규모가 너무 큼',
  '목표 시장 외',
  '경쟁사',
  '중복된 리드',
  '신호 품질 낮음',
  '기타',
];

export const DismissProspectModal: React.FC<DismissProspectModalProps> = ({
  isOpen,
  prospect,
  onConfirm,
  onCancel,
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  if (!isOpen || !prospect) return null;

  const handleConfirm = () => {
    const reason = selectedReason === '기타' ? customReason : selectedReason;
    if (!reason.trim()) return;
    onConfirm(reason.trim());
    // Reset state
    setSelectedReason('');
    setCustomReason('');
  };

  const handleCancel = () => {
    setSelectedReason('');
    setCustomReason('');
    onCancel();
  };

  const isOtherSelected = selectedReason === '기타';
  const canSubmit = selectedReason && (!isOtherSelected || customReason.trim());

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">관심 없는 리드로 표시</h2>
          <button
            onClick={handleCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{prospect.companyName}</span>을(를) 관심 없는 리드로 표시하시겠습니까?
          </p>

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              사유 선택 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {DISMISS_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="flex items-center p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="dismiss-reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-slate-700">{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Reason Input (shown when "Other" selected) */}
          {isOtherSelected && (
            <div className="animate-in fade-in duration-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                상세 사유 입력
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="구체적인 사유를 입력하세요..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg active:scale-95"
          >
            관심 없음으로 표시
          </button>
        </div>
      </div>
    </div>
  );
};

export default DismissProspectModal;
