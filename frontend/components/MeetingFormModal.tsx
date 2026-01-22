import React, { useState, useEffect } from 'react';
import { MeetingSummary, Customer } from '../types';
import { IconX, IconPlus, IconTrash } from './Icons';

interface MeetingFormModalProps {
  meeting: MeetingSummary | null;
  customers: Customer[];
  onClose: () => void;
  onSubmit: (data: Partial<MeetingSummary>) => void;
}

export const MeetingFormModal: React.FC<MeetingFormModalProps> = ({
  meeting,
  customers,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState({
    customerId: meeting?.customerId || '',
    title: meeting?.title || '',
    meetingDate: meeting?.meetingDate
      ? new Date(meeting.meetingDate).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    summary: meeting?.summary || '',
    keyDiscussions: meeting?.keyDiscussions || [],
    actionItems: meeting?.actionItems || [],
    nextSteps: meeting?.nextSteps || []
  });

  const [newKeyDiscussion, setNewKeyDiscussion] = useState('');
  const [newActionItem, setNewActionItem] = useState('');
  const [newNextStep, setNewNextStep] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Handle form field changes
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle array field add
  const handleAddItem = (field: 'keyDiscussions' | 'actionItems' | 'nextSteps', value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], value.trim()]
    }));
    setter('');
  };

  // Handle array field remove
  const handleRemoveItem = (field: 'keyDiscussions' | 'actionItems' | 'nextSteps', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId || !formData.title) {
      alert('고객과 제목은 필수입니다.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        meetingDate: new Date(formData.meetingDate).toISOString()
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Array input component
  const ArrayInput: React.FC<{
    label: string;
    items: string[];
    value: string;
    onChange: (v: string) => void;
    onAdd: () => void;
    onRemove: (index: number) => void;
    placeholder: string;
  }> = ({ label, items, value, onChange, onAdd, onRemove, placeholder }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="flex-1 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              {item}
            </span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <IconTrash className="w-4 h-4" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAdd();
              }
            }}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <button
            type="button"
            onClick={onAdd}
            className="px-3 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <IconPlus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">
            {meeting ? '미팅 수정' : '새 미팅 추가'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              고객 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.customerId}
              onChange={(e) => handleChange('customerId', e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="">고객 선택...</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              미팅 제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              required
              placeholder="예: 제품 데모 미팅"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Meeting Date/Time */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              미팅 일시 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.meetingDate}
              onChange={(e) => handleChange('meetingDate', e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              요약
            </label>
            <textarea
              value={formData.summary}
              onChange={(e) => handleChange('summary', e.target.value)}
              rows={3}
              placeholder="미팅 내용을 요약해주세요..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* Key Discussions */}
          <ArrayInput
            label="주요 논의 사항"
            items={formData.keyDiscussions}
            value={newKeyDiscussion}
            onChange={setNewKeyDiscussion}
            onAdd={() => handleAddItem('keyDiscussions', newKeyDiscussion, setNewKeyDiscussion)}
            onRemove={(index) => handleRemoveItem('keyDiscussions', index)}
            placeholder="논의 내용 추가..."
          />

          {/* Action Items */}
          <ArrayInput
            label="액션 아이템"
            items={formData.actionItems}
            value={newActionItem}
            onChange={setNewActionItem}
            onAdd={() => handleAddItem('actionItems', newActionItem, setNewActionItem)}
            onRemove={(index) => handleRemoveItem('actionItems', index)}
            placeholder="할 일 추가..."
          />

          {/* Next Steps */}
          <ArrayInput
            label="다음 단계"
            items={formData.nextSteps}
            value={newNextStep}
            onChange={setNewNextStep}
            onAdd={() => handleAddItem('nextSteps', newNextStep, setNewNextStep)}
            onRemove={(index) => handleRemoveItem('nextSteps', index)}
            placeholder="다음 계획 추가..."
          />
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? '저장 중...' : meeting ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
};
