import { EmailMessage, EmailIntegration, Customer } from '../types';
import { apiClient } from '../src/services/apiClient';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Gmail 연동 상태 가져오기
 */
export const getEmailIntegration = async (): Promise<EmailIntegration | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gmail/status`);
    const data = await response.json();

    if (data.success && data.data) {
      return {
        provider: 'gmail',
        isConnected: data.data.connected,
        lastSyncAt: data.data.lastSyncAt,
        autoSync: data.data.autoSync,
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to get email integration status:', error);
    return null;
  }
};

/**
 * Gmail OAuth 인증 시작
 */
export const connectEmailProvider = async (provider: 'gmail' | 'outlook'): Promise<{ authUrl: string } | null> => {
  if (provider !== 'gmail') {
    throw new Error('현재 Gmail만 지원합니다.');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/gmail/oauth/authorize`);
    const data = await response.json();

    if (data.success && data.data?.authUrl) {
      // 새 창에서 OAuth 인증 페이지 열기
      window.open(data.data.authUrl, '_blank', 'width=600,height=700');
      return { authUrl: data.data.authUrl };
    } else {
      throw new Error(data.error || 'OAuth URL을 가져올 수 없습니다.');
    }
  } catch (error: any) {
    console.error('Gmail connection failed:', error);
    throw new Error(error.message || 'Gmail 연결에 실패했습니다. 서버 설정을 확인해주세요.');
  }
};

/**
 * Gmail 연결 해제
 */
export const disconnectEmailProvider = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gmail/disconnect`, {
      method: 'POST',
    });
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Gmail 연결 해제에 실패했습니다.');
    }
  } catch (error: any) {
    console.error('Gmail disconnection failed:', error);
    throw error;
  }
};

/**
 * 이메일 동기화
 */
export const fetchEmails = async (maxResults: number = 50): Promise<EmailMessage[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gmail/messages?limit=${maxResults}`);
    const data = await response.json();

    if (data.success && data.data) {
      return data.data.map((email: any) => ({
        id: email.id,
        gmailMessageId: email.gmail_message_id,
        threadId: email.thread_id,
        subject: email.subject,
        from: email.sender,
        to: email.recipient,
        date: email.date || email.received_at,
        body: email.body || email.snippet,
        snippet: email.snippet,
        customerId: email.customer_id,
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch emails:', error);
    return [];
  }
};

/**
 * 이메일 동기화 트리거
 */
export const syncEmails = async (maxResults: number = 50): Promise<{ synced: number; matched: number }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gmail/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ maxResults }),
    });

    const data = await response.json();

    if (data.success && data.data) {
      return {
        synced: data.data.synced || 0,
        matched: data.data.matched || 0,
      };
    }

    throw new Error(data.error || '이메일 동기화에 실패했습니다.');
  } catch (error: any) {
    console.error('Email sync failed:', error);
    throw error;
  }
};

/**
 * 고객별 이메일 가져오기
 */
export const getCustomerEmails = async (customerId: string, limit: number = 50): Promise<EmailMessage[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gmail/messages/customer/${customerId}?limit=${limit}`);
    const data = await response.json();

    if (data.success && data.data) {
      return data.data.map((email: any) => ({
        id: email.id,
        gmailMessageId: email.gmail_message_id,
        threadId: email.thread_id,
        subject: email.subject,
        from: email.sender,
        to: email.recipient,
        date: email.date || email.received_at,
        body: email.body || email.snippet,
        snippet: email.snippet,
        customerId: email.customer_id,
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch customer emails:', error);
    return [];
  }
};

/**
 * 매칭되지 않은 이메일 가져오기
 */
export const getUnmatchedEmails = async (limit: number = 50): Promise<EmailMessage[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gmail/messages/unmatched?limit=${limit}`);
    const data = await response.json();

    if (data.success && data.data) {
      return data.data.map((email: any) => ({
        id: email.id,
        gmailMessageId: email.gmail_message_id,
        threadId: email.thread_id,
        subject: email.subject,
        from: email.sender,
        to: email.recipient,
        date: email.date || email.received_at,
        body: email.body || email.snippet,
        snippet: email.snippet,
        customerId: null,
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch unmatched emails:', error);
    return [];
  }
};

/**
 * 이메일-고객 매칭 업데이트
 */
export const updateEmailCustomer = async (emailId: string, customerId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gmail/messages/${emailId}/customer`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerId }),
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Failed to update email customer:', error);
    return false;
  }
};

// Match email to customer by analyzing content
export const matchEmailToCustomer = async (
  email: EmailMessage,
  customers: Customer[]
): Promise<string | null> => {
  // Try to match by email domain first (faster fallback)
  try {
    const customer = customers.find(c =>
      email.from.toLowerCase().includes(c.website.toLowerCase()) ||
      email.to.toLowerCase().includes(c.website.toLowerCase())
    );
    if (customer) return customer.id;
  } catch (error) {
    console.error('Email domain matching failed:', error);
  }

  // Use backend AI if domain matching fails
  try {
    const customerList = customers.map(c => `${c.name} (${c.website})`).join(', ');

    const prompt = `
    다음 이메일이 어떤 고객사와 관련된 것인지 판단해주세요.

    이메일 제목: ${email.subject}
    이메일 본문 (일부): ${email.body.substring(0, 500)}
    발신자: ${email.from}

    가능한 고객사 목록:
    ${customerList}

    이메일이 특정 고객사와 관련이 있다면, 고객사 이름만 반환해주세요.
    관련이 없다면 "없음"을 반환해주세요.
    `;

    const response = await apiClient.request('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });

    const result = (response as any).data || {};
    const matchedName = (result.content || '').trim();
    const customer = customers.find(c => c.name === matchedName);

    return customer ? customer.id : null;
  } catch (error) {
    console.error('Email matching with AI failed:', error);
    // Fallback: try to match by email domain
    const customer = customers.find(c =>
      email.from.toLowerCase().includes(c.website.toLowerCase()) ||
      email.to.toLowerCase().includes(c.website.toLowerCase())
    );
    return customer ? customer.id : null;
  }
};

// Extract conversation content from email
export const extractEmailContent = (email: EmailMessage): string => {
  return `
제목: ${email.subject}
발신자: ${email.from}
날짜: ${new Date(email.date).toLocaleString('ko-KR')}

${email.body}
  `.trim();
};

// Analyze email and suggest customer status update
export const analyzeEmailForStatusUpdate = async (
  email: EmailMessage,
  customer: Customer
): Promise<{ suggestedStatus?: string; insights: string }> => {
  try {
    const prompt = `
    다음 이메일을 분석하여 고객의 영업 단계를 판단해주세요.

    고객사: ${customer.name}
    현재 상태: ${customer.status}

    이메일 제목: ${email.subject}
    이메일 본문: ${email.body.substring(0, 1000)}

    이메일 내용을 바탕으로:
    1. 고객 상태를 업데이트해야 하는지 판단 (new, contact, negotiation, won, lost 중 하나 또는 유지)
    2. 주요 인사이트를 한 문장으로 요약

    JSON 형식으로 반환:
    {
      "suggestedStatus": "상태 또는 null",
      "insights": "인사이트 요약"
    }
    `;

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
        suggestedStatus: parsed.suggestedStatus || undefined,
        insights: parsed.insights || '이메일을 분석했습니다.'
      };
    } catch {
      return {
        insights: '이메일을 확인했습니다.'
      };
    }
  } catch (error) {
    console.error('Email analysis failed:', error);
    return {
      insights: '이메일을 확인했습니다.'
    };
  }
};

// Sync emails and update customer notes
export const syncEmailsToCustomers = async (
  customers: Customer[],
  onUpdate: (customerId: string, notes: string, suggestedStatus?: string) => void
): Promise<{ matched: number; updated: number }> => {
  // First, trigger backend sync
  try {
    await syncEmails(100);
  } catch (error) {
    console.error('Backend sync failed:', error);
  }

  // Then fetch synced emails
  const emails = await fetchEmails(100);
  let matched = 0;
  let updated = 0;

  for (const email of emails) {
    if (email.customerId) {
      matched++;
      const customer = customers.find(c => c.id === email.customerId);
      if (customer) {
        const content = extractEmailContent(email);
        const analysis = await analyzeEmailForStatusUpdate(email, customer);

        // Update customer notes
        const newNotes = customer.notes
          ? `${customer.notes}\n\n--- 이메일 (${new Date(email.date).toLocaleDateString('ko-KR')}) ---\n${content}`
          : `--- 이메일 (${new Date(email.date).toLocaleDateString('ko-KR')}) ---\n${content}`;

        onUpdate(email.customerId, newNotes, analysis.suggestedStatus);
        updated++;
      }
    }
  }

  return { matched, updated };
};

// 하위 호환성을 위한 localStorage 기반 함수 (deprecated)
export const saveEmailIntegration = (integration: EmailIntegration): void => {
  console.warn('saveEmailIntegration is deprecated. Use connectEmailProvider instead.');
  localStorage.setItem('rinda_email_integration', JSON.stringify(integration));
};

// Save email messages (for testing/demo purposes)
export const saveEmailMessage = (email: EmailMessage): void => {
  console.warn('saveEmailMessage is deprecated. Emails are now synced via backend.');
  const stored = localStorage.getItem('rinda_email_messages');
  const existing: EmailMessage[] = stored ? JSON.parse(stored) : [];

  // Avoid duplicates
  if (!existing.find(e => e.id === email.id)) {
    existing.unshift(email);
    localStorage.setItem('rinda_email_messages', JSON.stringify(existing.slice(0, 1000)));
  }
};
