import React, { useState, useEffect, useRef } from 'react';
import { AIMessage, Customer } from '../types';
import {
  processUserMessage,
  getConversationHistory,
  clearConversationHistory
} from '../services/aiAssistantService';
import { IconMessageSquare, IconSend, IconX, IconLoader, IconBrain } from './Icons';

interface AIAssistantProps {
  customers: Customer[];
  onAction?: (action: string, data: any) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ customers, onAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadConversation();
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversation = () => {
    const history = getConversationHistory();
    if (history.length === 0) {
      // Add welcome message
      const welcomeMessage: AIMessage = {
        id: 'welcome',
        role: 'assistant',
        content: '안녕하세요! RINDA CRM AI 어시스턴트입니다. 무엇을 도와드릴까요?\n\n예시:\n- "삼성전자 분석해줘"\n- "제안서 만들어줘"\n- "고객 통계 보여줘"',
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
    } else {
      setMessages(history);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      const { userMessage, assistantMessage } = await processUserMessage(
        userInput,
        customers
      );

      setMessages(prev => [...prev, userMessage, assistantMessage]);

      // Handle action if needed
      if (assistantMessage.metadata?.result?.success && onAction) {
        const action = assistantMessage.metadata.action;
        const data = assistantMessage.metadata.result.data;

        if (action === 'enrich' && data) {
          onAction('enrich_customer', data);
        } else if (action === 'proposal' && data) {
          onAction('save_proposal', data);
        }
      }
    } catch (error: any) {
      const errorMessage: AIMessage = {
        id: `error_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: `죄송합니다. 오류가 발생했습니다: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (confirm('대화 기록을 모두 삭제하시겠습니까?')) {
      clearConversationHistory();
      setMessages([]);
      const welcomeMessage: AIMessage = {
        id: 'welcome',
        role: 'assistant',
        content: '대화 기록이 삭제되었습니다. 무엇을 도와드릴까요?',
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
    }
  };

  return (
    <>
      {/* Floating Button - Left side on mobile to avoid overlap with FAB */}
      <div className={`fixed bottom-20 md:bottom-6 left-4 md:left-auto md:right-6 z-40 transition-all duration-200 ${
        isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
      }`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-12 h-12 md:w-14 md:h-14 bg-violet-600 text-white rounded-full shadow-lg hover:bg-violet-700 hover:shadow-xl transition-all flex items-center justify-center touch-target"
          aria-label="AI 어시스턴트 열기"
        >
          <IconBrain className="w-5 h-5 md:w-6 md:h-6" />
        </button>
        {/* Label - Mobile only */}
        <span className="absolute -top-1 -right-1 md:hidden px-1.5 py-0.5 bg-violet-700 text-white text-[10px] font-bold rounded-full shadow-sm">
          AI
        </span>
      </div>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed inset-0 md:inset-auto md:bottom-24 md:right-6 md:w-96 md:h-[600px] bg-white md:border md:border-slate-200 md:rounded-xl shadow-2xl z-50 flex flex-col safe-bottom">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-violet-50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center">
                <IconBrain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">AI 어시스턴트</h3>
                <p className="text-xs text-slate-500">대화로 CRM을 다뤄 보세요</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
              >
                초기화
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="md:hidden p-2 text-slate-500 hover:text-slate-700"
                aria-label="닫기"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.metadata?.result && (
                    <div className="mt-2 pt-2 border-t border-opacity-20">
                      {message.metadata.result.success ? (
                        <span className="text-xs opacity-75">완료됐어요</span>
                      ) : (
                        <span className="text-xs opacity-75">처리하지 못했어요</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-2">
                    <IconLoader className="w-4 h-4 animate-spin text-violet-600" />
                    <span className="text-sm text-slate-600">생각하는 중입니다</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200 pb-safe">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="무엇을 도와드릴까요?"
                className="flex-1 px-4 py-3 md:py-2 text-base md:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-3 md:p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
                aria-label="전송"
              >
                <IconSend className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 hidden md:block">
              예: ‘삼성전자 분석해 줘’, ‘제안서 만들어 줘’, ‘고객 통계 보여 줘’
            </p>
          </div>
        </div>
      )}
    </>
  );
};



