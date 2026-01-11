export interface EnrichedData {
  summary: string;
  ceo: string;
  foundedYear: string;
  recentNews: string[];
  competitors: string[];
  salesOpportunity: string; // New field for AI analysis
  sources: { title: string; uri: string }[];
}

export interface Proposal {
  id: string;
  title: string;
  content: string; // Markdown content
  imageUrl?: string;
  createdAt: number;
}

export type CustomerStatus = 'prospect' | 'new' | 'contact' | 'negotiation' | 'won' | 'lost';

export interface FollowUpAction {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'message';
  content: string;
  createdAt: number;
  status: 'planned' | 'completed' | 'cancelled';
}

export interface Customer {
  id: string;
  name: string;
  website: string;
  industry: string;
  notes: string;
  status: CustomerStatus; // Kanban status
  enrichedData?: EnrichedData;
  proposals: Proposal[];
  lastEnrichedAt?: number;
  lostReason?: string;
  lostAt?: number;
  lastFollowUpAt?: number;
  followUpHistory?: FollowUpAction[];
  contacts?: CustomerContact[];
  meetingSummaries?: MeetingSummary[];
}

// Customer Contact (명함/연락처)
export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
  source?: 'manual' | 'business_card' | 'import';
  businessCardImageUrl?: string;
  createdAt: number;
  updatedAt: number;
}

// Meeting Summary (미팅 녹음 요약)
export interface MeetingSummary {
  id: string;
  customerId: string;
  title: string;
  meetingDate: number;
  audioFileUrl?: string;
  duration?: number;
  summary: string;
  keyDiscussions: string[];
  actionItems: string[];
  customerNeeds: string[];
  budgetMentions?: string;
  timelineMentions?: string;
  nextSteps: string[];
  transcription?: string;
  createdAt: number;
  updatedAt: number;
}

// Business Card OCR Result (명함 인식 결과)
export interface BusinessCardData {
  companyName?: string;
  website?: string;
  contactName: string;
  title?: string;
  email?: string;
  phone?: string;
  confidence?: number;
}

// Recording Status (녹음 상태)
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing' | 'complete' | 'error';

export enum ImageSize {
  Size_1K = '1K',
  Size_2K = '2K',
  Size_4K = '4K'
}

export type ProcessingStatus = 'idle' | 'searching' | 'thinking' | 'generating_image' | 'complete' | 'error';

export interface ICPProfile {
  id: string;
  name: string;
  industries: string[];
  keywords: string[];
  companySize?: string;
  targetRegions?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Prospect {
  id: string;
  companyName: string;
  website: string;
  industry: string;
  sourceArticle: {
    title: string;
    uri: string;
    publishedAt?: string;
  };
  signalStrength: 'high' | 'medium' | 'low';
  detectedAt: number;
  icpMatch?: string; // ICP Profile ID
  notes?: string;
}

// Email Integration Types
export interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  date: number;
  threadId?: string;
  customerId?: string; // Matched customer ID
}

export interface EmailIntegration {
  provider: 'gmail' | 'outlook';
  isConnected: boolean;
  lastSyncAt?: number;
  autoSync: boolean;
}

// Calendar Integration Types
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  description?: string;
  location?: string;
  attendees?: string[];
  customerId?: string; // Matched customer ID
  meetingPrep?: MeetingPreparation;
}

export interface MeetingPreparation {
  customerId: string;
  summary: string;
  keyPoints: string[];
  suggestedTopics: string[];
  generatedAt: number;
}

export interface CalendarIntegration {
  provider: 'google' | 'outlook';
  isConnected: boolean;
  lastSyncAt?: number;
  autoSync: boolean;
}

// Auto Follow-up Types
export type FollowUpType = 'email' | 'call' | 'meeting' | 'message';
export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';
export type FollowUpPriority = 'high' | 'medium' | 'low';

export interface ScheduledFollowUp {
  id: string;
  customerId: string;
  scheduledFor: number;
  type: FollowUpType;
  content?: string;
  status: FollowUpStatus;
  createdAt: number;
  priority: FollowUpPriority;
  reason: string;
  // 완료 처리 관련 필드
  completedAt?: number;
  completedNote?: string;
  // 수동 생성 여부
  isManuallyCreated?: boolean;
  // 알림 관련
  reminderSent?: boolean;
  lastReminderAt?: number;
}

// Follow-up 통계
export interface FollowUpStats {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
  completionRate: number;
  avgCompletionTime: number;
  byType: Record<FollowUpType, number>;
  byPriority: Record<FollowUpPriority, number>;
}

// Follow-up 필터 옵션
export interface FollowUpFilterOptions {
  status?: FollowUpStatus[];
  priority?: FollowUpPriority[];
  type?: FollowUpType[];
  customerId?: string;
  dateRange?: {
    start: number;
    end: number;
  };
  searchQuery?: string;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'news' | 'followup' | 'lost_deal' | 'prospect' | 'meeting' | 'email' | 'risk';
  title: string;
  message: string;
  customerId?: string;
  priority: 'high' | 'medium' | 'low';
  read: boolean;
  createdAt: number;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

// Context-Aware AI Suggestion Types
export interface ContextualSuggestion {
  id: string;
  type: 'followup' | 'enrichment' | 'proposal' | 'meeting_prep' | 'risk';
  title: string;
  description: string;
  customerId?: string;
  action: string; // Action to take
  priority: 'high' | 'medium' | 'low';
  createdAt: number;
}

// AI Assistant Types
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    action?: string;
    customerId?: string;
    result?: any;
  };
}

// Settings Types
export type SettingsTabType = 'ai' | 'prospect' | 'slack' | 'mixpanel' | 'email' | 'calendar' | 'notifications';

export interface SlackSettings {
  webhookUrl: string;
  isEnabled: boolean;
  channel?: string;
  notifications: {
    newProspect: boolean;
    followUpReminder: boolean;
    followUpCompleted: boolean;
    dailyDigest: boolean;
    dealWon: boolean;
    dealLost: boolean;
  };
  lastTestAt?: number;
  isValidated: boolean;
  dailyDigestTime?: string; // "09:00" format
  lastDigestSentAt?: number;
}

export interface NotificationSettings {
  browser: {
    enabled: boolean;
    types: {
      followUp: boolean;
      meeting: boolean;
      news: boolean;
      risk: boolean;
      prospect: boolean;
    };
  };
  email: {
    enabled: boolean;
    dailyDigest: boolean;
    digestTime: string; // "09:00"
  };
}

export interface EmailSettings {
  provider: 'gmail' | 'outlook' | null;
  isConnected: boolean;
  autoSync: boolean;
  syncInterval: number; // milliseconds
  lastSyncAt?: number;
}

export interface CalendarSettings {
  provider: 'google' | 'outlook' | null;
  isConnected: boolean;
  autoSync: boolean;
  syncInterval: number; // milliseconds
  lastSyncAt?: number;
  meetingPrepEnabled: boolean;
}

// Background Task Types
export type BackgroundTaskStatus = 'pending' | 'running' | 'completed' | 'error';

export interface BackgroundTask {
  id: string;
  type: 'proposal_generation';
  status: BackgroundTaskStatus;
  customerId: string;
  customerName: string;
  progress: number;
  message: string;
  result?: {
    title: string;
    content: string;
    imageUrl?: string;
  };
  error?: string;
  createdAt: number;
  completedAt?: number;
}