import { CalendarEvent, CalendarIntegration, MeetingPreparation, Customer } from '../types';
import { apiClient } from '../src/services/apiClient';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Calendar Integration Storage (localStorage as fallback)
const CALENDAR_INTEGRATION_KEY = 'rinda_calendar_integration';
const CALENDAR_EVENTS_KEY = 'rinda_calendar_events';

/**
 * 캘린더 연동 상태 가져오기 (백엔드 API 우선 사용)
 */
export const getCalendarIntegration = async (): Promise<CalendarIntegration | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/calendar/status`);
    const data = await response.json();

    if (data.success && data.data) {
      return {
        provider: 'google',
        isConnected: data.data.connected,
        lastSyncAt: data.data.lastSyncAt,
        autoSync: true
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to get calendar integration status:', error);
    // Fallback to localStorage
    const stored = localStorage.getItem(CALENDAR_INTEGRATION_KEY);
    return stored ? JSON.parse(stored) : null;
  }
};

export const saveCalendarIntegration = (integration: CalendarIntegration): void => {
  localStorage.setItem(CALENDAR_INTEGRATION_KEY, JSON.stringify(integration));
};

/**
 * Google Calendar OAuth 인증 시작
 */
export const connectCalendarProvider = async (provider: 'google' | 'outlook'): Promise<CalendarIntegration> => {
  if (provider !== 'google') {
    throw new Error('현재 Google Calendar만 지원합니다.');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/calendar/oauth/authorize`);
    const data = await response.json();

    if (data.success && data.data?.authUrl) {
      // 새 창에서 OAuth 인증 페이지 열기
      window.open(data.data.authUrl, '_blank', 'width=600,height=700');

      // 임시로 연결 진행중 상태 반환
      const integration: CalendarIntegration = {
        provider: 'google',
        isConnected: false, // OAuth 완료 후 true로 변경됨
        lastSyncAt: Date.now(),
        autoSync: true
      };
      return integration;
    } else {
      throw new Error(data.error || 'OAuth URL을 가져올 수 없습니다.');
    }
  } catch (error: any) {
    console.error('Calendar connection failed:', error);
    throw new Error(error.message || 'Calendar 연결에 실패했습니다. 서버 설정을 확인해주세요.');
  }
};

/**
 * 캘린더 연결 해제
 */
export const disconnectCalendarProvider = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/calendar/disconnect`, {
      method: 'POST',
    });
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Calendar 연결 해제에 실패했습니다.');
    }
  } catch (error: any) {
    console.error('Calendar disconnection failed:', error);
  }

  // localStorage도 정리
  localStorage.removeItem(CALENDAR_INTEGRATION_KEY);
  localStorage.removeItem(CALENDAR_EVENTS_KEY);
};

/**
 * 캘린더 이벤트 가져오기 (백엔드 API 우선 사용)
 */
export const fetchCalendarEvents = async (
  startDate?: Date,
  endDate?: Date
): Promise<CalendarEvent[]> => {
  try {
    let url = `${API_BASE_URL}/api/calendar/events?maxResults=50`;
    if (startDate) {
      url += `&timeMin=${startDate.toISOString()}`;
    }
    if (endDate) {
      url += `&timeMax=${endDate.toISOString()}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.success && data.data) {
      return data.data.map((event: any) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: new Date(event.start).getTime(),
        endTime: new Date(event.end).getTime(),
        location: event.location,
        attendees: event.attendees?.map((a: any) => a.email) || [],
        meetingLink: event.hangoutLink,
        customerId: undefined
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);

    // Fallback to localStorage
    const stored = localStorage.getItem(CALENDAR_EVENTS_KEY);
    const existingEvents: CalendarEvent[] = stored ? JSON.parse(stored) : [];

    const now = Date.now();
    const start = startDate ? startDate.getTime() : now;
    const end = endDate ? endDate.getTime() : now + 30 * 24 * 60 * 60 * 1000;

    return existingEvents.filter(e => e.startTime >= start && e.startTime <= end);
  }
};

/**
 * 오늘의 미팅 가져오기
 */
export const getTodayMeetings = async (): Promise<CalendarEvent[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/calendar/events/today`);
    const data = await response.json();

    if (data.success && data.data) {
      return data.data.map((event: any) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: new Date(event.start).getTime(),
        endTime: new Date(event.end).getTime(),
        location: event.location,
        attendees: event.attendees?.map((a: any) => a.email) || [],
        meetingLink: event.hangoutLink,
        customerId: undefined
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch today meetings:', error);
    return [];
  }
};

// Match calendar event to customer
export const matchEventToCustomer = async (
  event: CalendarEvent,
  customers: Customer[]
): Promise<string | null> => {
  const customerList = customers.map(c => `${c.name} (${c.website})`).join(', ');

  const prompt = `
    다음 캘린더 이벤트가 어떤 고객사와 관련된 것인지 판단해주세요.

    이벤트 제목: ${event.title}
    이벤트 설명: ${event.description || '없음'}
    참석자: ${event.attendees?.join(', ') || '없음'}
    장소: ${event.location || '없음'}

    가능한 고객사 목록:
    ${customerList}

    이벤트가 특정 고객사와 관련이 있다면, 고객사 이름만 반환해주세요.
    관련이 없다면 "없음"을 반환해주세요.
  `;

  try {
    const response = await apiClient.request('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });

    const result = (response as any).data || {};
    const matchedName = (result.content || '').trim();
    const customer = customers.find(c =>
      c.name === matchedName ||
      event.title.includes(c.name) ||
      event.description?.includes(c.name) ||
      event.attendees?.some(a => a.includes(c.website))
    );

    return customer ? customer.id : null;
  } catch (error) {
    console.error('Event matching failed:', error);
    // Fallback matching
    const customer = customers.find(c =>
      event.title.toLowerCase().includes(c.name.toLowerCase()) ||
      event.description?.toLowerCase().includes(c.name.toLowerCase())
    );
    return customer ? customer.id : null;
  }
};

// Generate meeting preparation summary
export const generateMeetingPreparation = async (
  customer: Customer,
  event: CalendarEvent
): Promise<MeetingPreparation> => {
  const context = `
    고객사: ${customer.name}
    산업: ${customer.industry}
    웹사이트: ${customer.website}
    현재 상태: ${customer.status}
    메모: ${customer.notes || '없음'}
    ${customer.enrichedData ? `
    회사 요약: ${customer.enrichedData.summary}
    최근 뉴스: ${customer.enrichedData.recentNews.join(', ')}
    세일즈 기회: ${customer.enrichedData.salesOpportunity}
    ` : ''}

    미팅 정보:
    제목: ${event.title}
    시간: ${new Date(event.startTime).toLocaleString('ko-KR')}
    설명: ${event.description || '없음'}
  `;

  const prompt = `
    당신은 RINDA CRM의 미팅 준비 전문가입니다.
    다음 고객과의 미팅을 위한 준비 자료를 생성해주세요.

    ${context}

    다음을 포함한 JSON 객체를 한국어로 반환해주세요:
    1. summary: 고객사와 미팅에 대한 간단한 요약 (2-3문장)
    2. keyPoints: 미팅에서 다룰 핵심 포인트 배열 (최대 5개)
    3. suggestedTopics: 제안할 수 있는 주제 배열 (최대 3개)

    전문적이고 실행 가능한 내용으로 작성해주세요.
  `;

  try {
    const response = await apiClient.request('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });

    const result = (response as any).data || {};
    const text = result.content || '{}';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return {
        customerId: customer.id,
        summary: parsed.summary || `${customer.name}와의 미팅 준비`,
        keyPoints: parsed.keyPoints || [],
        suggestedTopics: parsed.suggestedTopics || [],
        generatedAt: Date.now()
      };
    } catch {
      return {
        customerId: customer.id,
        summary: `${customer.name}와의 미팅 준비`,
        keyPoints: [],
        suggestedTopics: [],
        generatedAt: Date.now()
      };
    }
  } catch (error) {
    console.error('Meeting preparation generation failed:', error);
    return {
      customerId: customer.id,
      summary: `${customer.name}와의 미팅이 예정되어 있습니다.`,
      keyPoints: ['고객 니즈 확인', '제품/서비스 소개', '다음 단계 논의'],
      suggestedTopics: [],
      generatedAt: Date.now()
    };
  }
};

// Sync calendar events and match to customers
export const syncCalendarEvents = async (
  customers: Customer[],
  onEventMatched: (event: CalendarEvent, customerId: string) => void
): Promise<{ matched: number; total: number }> => {
  const events = await fetchCalendarEvents();
  let matched = 0;

  for (const event of events) {
    // Skip if already matched
    if (event.customerId) {
      matched++;
      continue;
    }

    const customerId = await matchEventToCustomer(event, customers);

    if (customerId) {
      event.customerId = customerId;
      onEventMatched(event, customerId);
      matched++;

      // Save updated event
      saveCalendarEvent(event);
    }
  }

  return { matched, total: events.length };
};

// Get upcoming meetings for a customer
export const getUpcomingMeetings = async (
  customerId?: string,
  daysAhead: number = 7
): Promise<CalendarEvent[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/calendar/events/upcoming`);
    const data = await response.json();

    if (data.success && data.data) {
      const events = data.data.map((event: any) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: new Date(event.start).getTime(),
        endTime: new Date(event.end).getTime(),
        location: event.location,
        attendees: event.attendees?.map((a: any) => a.email) || [],
        meetingLink: event.hangoutLink,
        customerId: undefined
      }));

      // Filter by customerId if provided
      if (customerId) {
        return events.filter((e: CalendarEvent) => e.customerId === customerId);
      }
      return events;
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch upcoming meetings:', error);

    // Fallback to localStorage
    const now = Date.now();
    const endDate = new Date(now + daysAhead * 24 * 60 * 60 * 1000);

    const events = await fetchCalendarEvents(new Date(now), endDate);
    if (customerId) {
      return events.filter(e => e.customerId === customerId && e.startTime >= now);
    }
    return events.filter(e => e.startTime >= now);
  }
};

// Save calendar event (localStorage fallback)
export const saveCalendarEvent = (event: CalendarEvent): void => {
  const stored = localStorage.getItem(CALENDAR_EVENTS_KEY);
  const existing: CalendarEvent[] = stored ? JSON.parse(stored) : [];

  const index = existing.findIndex(e => e.id === event.id);
  if (index >= 0) {
    existing[index] = event;
  } else {
    existing.push(event);
  }

  // Sort by start time
  existing.sort((a, b) => a.startTime - b.startTime);
  localStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(existing));
};
