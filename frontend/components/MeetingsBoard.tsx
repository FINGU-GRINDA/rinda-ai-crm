import React, { useState, useMemo } from 'react';
import { MeetingSummary, Customer } from '../types';
import {
  IconCalendar,
  IconClock,
  IconBuilding,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconFileText,
  IconCheck
} from './Icons';
import { MeetingFormModal } from './MeetingFormModal';
import { apiClient } from '../src/services/apiClient';

interface MeetingsBoardProps {
  meetings: MeetingSummary[];
  customers: Customer[];
  loading: boolean;
  onRefresh: () => void;
}

export const MeetingsBoard: React.FC<MeetingsBoardProps> = ({
  meetings,
  customers,
  loading,
  onRefresh
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter(meeting => {
      const customer = customers.find(c => c.id === meeting.customerId);
      const customerName = customer?.name || '';

      const matchesSearch = searchQuery === '' ||
        meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (meeting.summary && meeting.summary.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCustomer = selectedCustomerId === 'all' || meeting.customerId === selectedCustomerId;

      return matchesSearch && matchesCustomer;
    }).sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
  }, [meetings, customers, searchQuery, selectedCustomerId]);

  // Get customer name by ID
  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || '알 수 없는 고객';
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
  };

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format duration
  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  // Handle delete
  const handleDelete = async (meetingId: string) => {
    if (!confirm('이 미팅을 삭제하시겠습니까?')) return;

    setDeletingId(meetingId);
    try {
      await apiClient.deleteMeeting(meetingId);
      onRefresh();
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      alert('미팅 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  // Handle form submit
  const handleFormSubmit = async (data: Partial<MeetingSummary>) => {
    try {
      if (editingMeeting) {
        // Update existing meeting
        await apiClient.updateMeeting(editingMeeting.id, {
          title: data.title,
          meetingDate: data.meetingDate,
          summary: data.summary,
          keyDiscussions: data.keyDiscussions ? JSON.stringify(data.keyDiscussions) : undefined,
          actionItems: data.actionItems ? JSON.stringify(data.actionItems) : undefined,
          nextSteps: data.nextSteps ? JSON.stringify(data.nextSteps) : undefined,
        });
      } else {
        // Create new meeting
        if (!data.customerId || !data.title) {
          alert('고객과 제목은 필수입니다.');
          return;
        }
        await apiClient.createMeeting({
          customerId: data.customerId,
          title: data.title,
          meetingDate: data.meetingDate,
          summary: data.summary,
          keyDiscussions: data.keyDiscussions,
          actionItems: data.actionItems,
          nextSteps: data.nextSteps,
        });
      }
      setShowFormModal(false);
      setEditingMeeting(null);
      onRefresh();
    } catch (error) {
      console.error('Failed to save meeting:', error);
      alert('미팅 저장에 실패했습니다.');
    }
  };

  // Meeting Card Component
  const MeetingCard: React.FC<{ meeting: MeetingSummary }> = ({ meeting }) => {
    const customerName = getCustomerName(meeting.customerId);
    const duration = formatDuration(meeting.duration);

    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-400 transition-all">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-800 text-sm truncate">
              {meeting.title}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <IconBuilding className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-600 truncate">{customerName}</span>
            </div>
          </div>
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => {
                setEditingMeeting(meeting);
                setShowFormModal(true);
              }}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="수정"
            >
              <IconEdit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(meeting.id)}
              disabled={deletingId === meeting.id}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              title="삭제"
            >
              <IconTrash className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Date & Time */}
        <div className="flex items-center gap-4 mb-3 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <IconCalendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDate(meeting.meetingDate)}</span>
          </div>
          <div className="flex items-center gap-1">
            <IconClock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatTime(meeting.meetingDate)}</span>
          </div>
          {duration && (
            <span className="text-slate-500">({duration})</span>
          )}
        </div>

        {/* Summary */}
        {meeting.summary && (
          <div className="mb-3 p-2 bg-slate-50 rounded border border-slate-100">
            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
              {meeting.summary}
            </p>
          </div>
        )}

        {/* Action Items / Key Discussions count */}
        <div className="flex gap-3 text-xs text-slate-500">
          {meeting.actionItems && meeting.actionItems.length > 0 && (
            <div className="flex items-center gap-1">
              <IconCheck className="w-3.5 h-3.5" />
              <span>액션 아이템 {meeting.actionItems.length}개</span>
            </div>
          )}
          {meeting.keyDiscussions && meeting.keyDiscussions.length > 0 && (
            <div className="flex items-center gap-1">
              <IconFileText className="w-3.5 h-3.5" />
              <span>주요 논의 {meeting.keyDiscussions.length}개</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Empty state
  if (!loading && meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <IconCalendar className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          아직 기록된 미팅이 없습니다
        </h3>
        <p className="text-sm text-slate-500 mb-4 max-w-md">
          미팅을 직접 추가하거나, Slack 미팅 노트 채널에서 자동으로 생성됩니다.
        </p>
        <button
          onClick={() => setShowFormModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <IconPlus className="w-4 h-4" />
          미팅 추가
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 pb-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <IconCalendar className="w-6 h-6 text-blue-600" />
              미팅 관리 ({meetings.length})
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              고객과의 미팅 기록을 관리합니다
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setEditingMeeting(null);
                setShowFormModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <IconPlus className="w-4 h-4" />
              미팅 추가
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="미팅 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="all">모든 고객</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Meeting Cards Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="text-center py-12">
            <IconSearch className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">검색 결과가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {filteredMeetings.map(meeting => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <MeetingFormModal
          meeting={editingMeeting}
          customers={customers}
          onClose={() => {
            setShowFormModal(false);
            setEditingMeeting(null);
          }}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
};
