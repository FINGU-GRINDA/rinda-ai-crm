import React from 'react';
import { Customer } from '../../types';
import { IconTrash } from '../Icons';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  customer: Customer | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  customer,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <IconTrash className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">고객 삭제</h2>
            <p className="text-sm text-slate-500">이 작업은 되돌릴 수 없습니다</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-slate-700">
            <strong className="text-slate-900">{customer.name}</strong> 고객을 삭제하시겠습니까?
          </p>
          <p className="text-xs text-slate-500 mt-2">
            고객의 모든 정보, 제안서, 메모가 영구적으로 삭제됩니다.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md hover:shadow-lg active:scale-95"
          >
            삭제하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
