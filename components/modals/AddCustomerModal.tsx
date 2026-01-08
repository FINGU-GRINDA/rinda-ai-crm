import React, { useState } from 'react';
import { IconX } from '../Icons';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; website: string; industry: string }) => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('미분류');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, website, industry });
    // Reset form
    setName('');
    setWebsite('');
    setIndustry('미분류');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800">새로운 고객 추가하기</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">회사명 *</label>
            <input
              autoFocus
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="회사 이름을 입력해주세요 (예: 삼성전자)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">웹사이트 *</label>
            <input
              type="text"
              required
              placeholder="웹사이트 주소를 입력해주세요 (예: samsung.com)"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">산업 분야</label>
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
            >
              <option value="미분류">미분류</option>
              <option value="SaaS">SaaS</option>
              <option value="재생 에너지">재생 에너지</option>
              <option value="유통/커머스">유통/커머스</option>
              <option value="제조업">제조업</option>
              <option value="금융">금융</option>
              <option value="헬스케어">헬스케어</option>
            </select>
          </div>
          <div className="flex justify-end space-x-2 mt-6 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg active:scale-95"
            >
              추가하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCustomerModal;
