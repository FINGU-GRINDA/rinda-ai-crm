import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Customer, Proposal, CustomerStatus, Prospect, FollowUpAction, ContextualSuggestion, CalendarEvent, BackgroundTask } from './types';
import { enrichCustomerData } from './services/geminiService';
import { runProspectCollection, getProspects, saveProspects, getCollectionSettings } from './services/prospectService';
import { generateAllSuggestions } from './services/contextualSuggestionService';
import { runNotificationChecks } from './services/notificationService';
import { apiClient } from './src/services/apiClient';
import { TabNavigation, TabType } from './components/TabNavigation';
import { PageSpinner } from './components/LoadingStates';
import { BackgroundTaskProvider } from './contexts/BackgroundTaskContext';
import { BackgroundTaskToast } from './components/BackgroundTaskToast';
import { useIsMobile } from './hooks/useMediaQuery';
import { Home, Search, Bell, Settings } from 'lucide-react';
import { transformApiCustomer, transformApiProspect, transformApiProposal } from './src/utils/apiTransformers';
import { isSuccessListResponse, isSuccessResponse, isErrorResponse } from './src/utils/typeGuards';
import { BusinessCardScanner } from './components/BusinessCardScanner';
import { MeetingRecorder } from './components/MeetingRecorder';
import { FloatingActionButton } from './components/FloatingActionButton';
import { BusinessCardData, MeetingSummary } from './types';
import { LostDealModal } from './components/LostDealModal';
import { DismissProspectModal } from './components/modals';

// New separated components
import { KanbanBoard, KANBAN_COLUMNS } from './components/KanbanBoard';
import { ProspectsBoard } from './components/ProspectsBoard';
import { CustomerDetailPanel } from './components/CustomerDetailPanel';
import { AppHeader, StatsBar } from './components/AppHeader';
import { AddCustomerModal, DeleteConfirmModal } from './components/modals';
import { ViewSwitcher, ViewMode } from './components/ViewSwitcher';
import { TableView } from './components/TableView';

// Lazy load heavy modals for better performance
const ProposalGenerator = lazy(() => import('./components/ProposalGenerator').then(m => ({ default: m.ProposalGenerator })));
const ICPSettings = lazy(() => import('./components/ICPSettings').then(m => ({ default: m.ICPSettings })));
const AutoFollowUpScheduler = lazy(() => import('./components/AutoFollowUpScheduler').then(m => ({ default: m.AutoFollowUpScheduler })));
const MeetingPrep = lazy(() => import('./components/MeetingPrep').then(m => ({ default: m.MeetingPrep })));
import { UnifiedSettings } from './components/settings';
import { IconSearch, IconX, IconArrowRight } from './components/Icons';
import { AIAssistant } from './components/AIAssistant';

// Mobile Bottom Tab Type
type MobileBottomTab = 'home' | 'search' | 'notifications' | 'settings';

// Dashboard Component - exported for router
export const AppDashboard: React.FC = () => {
  const isMobile = useIsMobile();

  // Server Health State
  const [isServerHealthy, setIsServerHealthy] = useState<boolean | null>(null);

  // Customer State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // View Mode State
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedTableRows, setSelectedTableRows] = useState<Set<string>>(new Set());

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('active');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIndustry, setFilterIndustry] = useState<string>('all');
  const [showStats, setShowStats] = useState(false);

  // Mobile Navigation States
  const [mobileBottomTab, setMobileBottomTab] = useState<MobileBottomTab>('home');
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  // Modal States
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ percent: 0, message: '' });
  const [showProposalGenerator, setShowProposalGenerator] = useState(false);
  const [showLostDealModal, setShowLostDealModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete Customer States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Dismiss Prospect States
  const [showDismissProspectModal, setShowDismissProspectModal] = useState(false);
  const [prospectToDismiss, setProspectToDismiss] = useState<Prospect | null>(null);

  // Prospect & ICP States
  const [showICPSettings, setShowICPSettings] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const [lastCollectionTime, setLastCollectionTime] = useState<number | null>(null);
  const [collectionSettings, setCollectionSettings] = useState(() => getCollectionSettings());

  // Phase 1: New Features States
  const [contextualSuggestions, setContextualSuggestions] = useState<ContextualSuggestion[]>([]);
  const [showFollowUpScheduler, setShowFollowUpScheduler] = useState(false);
  const [showMeetingPrep, setShowMeetingPrep] = useState(false);
  const [selectedMeetingEvent, setSelectedMeetingEvent] = useState<CalendarEvent | null>(null);

  // Business Card & Meeting Recording States
  const [showBusinessCardScanner, setShowBusinessCardScanner] = useState(false);
  const [showMeetingRecorder, setShowMeetingRecorder] = useState(false);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Get unique industries for filter
  const industries = useMemo(() => {
    const unique = Array.from(new Set(customers.map(c => c.industry)));
    return ['all', ...unique];
  }, [customers]);

  // Tab-based filtering
  const tabFilteredCustomers = useMemo(() => {
    let baseCustomers = [...customers];

    if (activeTab === 'active') {
      baseCustomers = baseCustomers.filter(c =>
        c.status !== 'lost' && c.status !== 'prospect'
      );
    } else if (activeTab === 'leads') {
      baseCustomers = baseCustomers.filter(c => c.status === 'new');
    } else if (activeTab === 'lost') {
      baseCustomers = baseCustomers.filter(c => c.status === 'lost');
    }

    return baseCustomers;
  }, [customers, activeTab]);

  // Filtered customers (with search and industry filter)
  const filteredCustomers = useMemo(() => {
    return tabFilteredCustomers.filter(customer => {
      const matchesSearch = searchQuery === '' ||
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.website.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.industry.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesIndustry = filterIndustry === 'all' || customer.industry === filterIndustry;

      return matchesSearch && matchesIndustry;
    });
  }, [tabFilteredCustomers, searchQuery, filterIndustry]);

  // Tab counts
  const tabCounts = useMemo(() => ({
    active: customers.filter(c => c.status !== 'lost' && c.status !== 'prospect').length,
    leads: customers.filter(c => c.status === 'new').length,
    prospects: prospects.length,
    lost: customers.filter(c => c.status === 'lost').length
  }), [customers, prospects]);

  // Statistics
  const stats = useMemo(() => {
    const total = customers.length;
    const enriched = customers.filter(c => c.enrichedData).length;
    const proposals = customers.reduce((sum, c) => sum + c.proposals.length, 0);
    const byStatus = KANBAN_COLUMNS.reduce((acc, col) => {
      acc[col.id] = customers.filter(c => c.status === col.id).length;
      return acc;
    }, {} as Record<CustomerStatus, number>);

    return { total, enriched, proposals, byStatus };
  }, [customers]);

  // Check server health
  const checkServerHealth = useCallback(async () => {
    const health = await apiClient.checkHealth();
    setIsServerHealthy(health !== null);
    return health !== null;
  }, []);

  // Fetch customers from backend API
  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    setCustomersError(null);
    try {
      const response = await apiClient.getCustomers({ limit: 500 });
      if (isSuccessListResponse(response)) {
        const transformedCustomers = response.data.map(transformApiCustomer);
        setCustomers(transformedCustomers);
      } else if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to fetch customers:', error);
      setCustomersError(error.message || '고객 목록을 불러오는데 실패했습니다.');
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  // Fetch prospects from backend API
  const fetchProspectsFromBackend = useCallback(async () => {
    try {
      const response = await apiClient.getLeads({ converted: false, limit: 500 });
      if (isSuccessListResponse(response)) {
        const transformedProspects = response.data.map(transformApiProspect);
        setProspects(transformedProspects);
      } else if (isErrorResponse(response)) {
        // Fallback to localStorage if backend fails
        setProspects(getProspects());
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to fetch prospects:', error);
      // Fallback to localStorage if backend fails
      setProspects(getProspects());
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      await checkServerHealth();
      fetchCustomers();
      fetchProspectsFromBackend();
    };
    init();
  }, [checkServerHealth, fetchCustomers, fetchProspectsFromBackend]);

  // Load contextual suggestions
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const suggestions = await generateAllSuggestions(customers);
        setContextualSuggestions(suggestions);
      } catch (error) {
        console.error('Failed to load suggestions:', error);
      }
    };

    if (customers.length > 0) {
      loadSuggestions();
      const interval = setInterval(loadSuggestions, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [customers]);

  // Run notification checks when customers change
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        await runNotificationChecks(customers);
      } catch (error) {
        console.error('Notification check failed:', error);
      }
    };

    if (customers.length > 0) {
      checkNotifications();
    }
  }, [customers]);

  // Set up periodic notification checks (independent of customer changes)
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        await runNotificationChecks(customers);
      } catch (error) {
        console.error('Notification check failed:', error);
      }
    };

    const interval = setInterval(checkNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [customers]);

  // Prospect collection scheduler
  useEffect(() => {
    const settings = getCollectionSettings();
    setCollectionSettings(settings);

    if (!settings.autoRun) return;

    let isCurrentlyCollecting = false;

    const collectProspects = async () => {
      // Prevent race conditions - only run if not already collecting
      if (isCurrentlyCollecting) {
        console.log('Collection already in progress, skipping...');
        return;
      }

      isCurrentlyCollecting = true;
      setIsCollecting(true);
      try {
        const existingNames = customers.map(c => c.name);
        const result = await runProspectCollection(existingNames);

        if (result.newProspects.length > 0) {
          setProspects(getProspects());
        }
        setLastCollectionTime(Date.now());
      } catch (error: any) {
        console.error('Prospect collection failed:', error);
      } finally {
        isCurrentlyCollecting = false;
        setIsCollecting(false);
      }
    };

    const initialTimeout = setTimeout(() => collectProspects(), 5000);
    const interval = setInterval(() => collectProspects(), settings.interval);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [collectionSettings.autoRun, collectionSettings.interval, customers]);

  // Load prospects on mount
  useEffect(() => {
    const savedProspects = getProspects();
    setProspects(savedProspects);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        searchInput?.focus();
      }

      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
          setCustomerToDelete(null);
        } else if (showDismissProspectModal) {
          setShowDismissProspectModal(false);
          setProspectToDismiss(null);
        } else if (selectedCustomerId) {
          setSelectedCustomerId(null);
        }
        if (isAddingCustomer) setIsAddingCustomer(false);
        if (showProposalGenerator) setShowProposalGenerator(false);
        if (showICPSettings) setShowICPSettings(false);
        if (showLostDealModal) setShowLostDealModal(false);
        if (showFollowUpScheduler) setShowFollowUpScheduler(false);
        if (showMeetingPrep) setShowMeetingPrep(false);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setIsAddingCustomer(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCustomerId, isAddingCustomer, showProposalGenerator, showFollowUpScheduler, showMeetingPrep, showLostDealModal, showDeleteConfirm, showDismissProspectModal]);

  // --- Handlers ---

  const handleEnrichment = useCallback(async () => {
    if (!selectedCustomer) return;

    setIsEnriching(true);
    setError(null);

    try {
      setEnrichmentProgress({ percent: 10, message: '웹 검색 중...' });
      await new Promise(r => setTimeout(r, 300));

      setEnrichmentProgress({ percent: 30, message: '정보 수집 중...' });
      const data = await enrichCustomerData(selectedCustomer.name, selectedCustomer.website);

      setEnrichmentProgress({ percent: 70, message: 'AI 분석 중...' });
      await new Promise(r => setTimeout(r, 300));

      setEnrichmentProgress({ percent: 90, message: '결과 정리 중...' });

      try {
        await apiClient.saveCustomerEnrichment(selectedCustomerId!, data as unknown as Record<string, unknown>);
      } catch (saveErr) {
        console.warn('Failed to save enrichment to backend:', saveErr);
      }

      setCustomers(prev => prev.map(c => {
        if (c.id === selectedCustomerId) {
          return { ...c, enrichedData: data, lastEnrichedAt: new Date().toISOString() };
        }
        return c;
      }));

      setEnrichmentProgress({ percent: 100, message: '완료!' });
    } catch (error: any) {
      const errorMessage = error?.message || "분석 중 문제가 발생했어요. API 키를 확인해주세요.";
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsEnriching(false);
      setTimeout(() => setEnrichmentProgress({ percent: 0, message: '' }), 1000);
    }
  }, [selectedCustomer, selectedCustomerId]);

  const handleAddCustomer = async (data: { name: string; website: string; industry: string }) => {
    try {
      const response = await apiClient.createCustomer({
        name: data.name,
        website: data.website,
        industry: data.industry,
        notes: '',
        status: 'new',
      });

      if (isSuccessResponse(response)) {
        const newCustomer = transformApiCustomer(response.data);
        setCustomers(prev => [...prev, newCustomer]);
      } else if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to add customer:', error);
      setError(error.message || '고객 추가에 실패했습니다.');
      setTimeout(() => setError(null), 5000);
    }
    setIsAddingCustomer(false);
  };

  const handleSaveProposal = useCallback(async (proposalData: { title: string; content: string; imageUrl?: string }) => {
    if (!selectedCustomer) return;

    try {
      const response = await apiClient.createCustomerProposal(selectedCustomer.id, {
        title: proposalData.title,
        content: proposalData.content,
        imageUrl: proposalData.imageUrl
      });

      if (isSuccessResponse(response)) {
        const newProposal = transformApiProposal(response.data);

        setCustomers(prev => prev.map(c => {
          if (c.id === selectedCustomer.id) {
            return { ...c, proposals: [newProposal, ...c.proposals] };
          }
          return c;
        }));
      } else if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to save proposal:', error);
      const newProposal: Proposal = {
        id: Math.random().toString(36).substr(2, 9),
        title: proposalData.title,
        content: proposalData.content,
        imageUrl: proposalData.imageUrl,
        createdAt: new Date().toISOString()
      };

      setCustomers(prev => prev.map(c => {
        if (c.id === selectedCustomer.id) {
          return { ...c, proposals: [newProposal, ...c.proposals] };
        }
        return c;
      }));
    }
  }, [selectedCustomer]);

  const handleBusinessCardScanComplete = useCallback(async (data: BusinessCardData, customerId?: string) => {
    if (customerId) {
      await fetchCustomers();
      setSelectedCustomerId(customerId);
    }
    setShowBusinessCardScanner(false);
  }, [fetchCustomers]);

  const handleMeetingRecordComplete = useCallback(async (summary: MeetingSummary) => {
    await fetchCustomers();
    setShowMeetingRecorder(false);
    setSelectedCustomerId(summary.customerId);
  }, [fetchCustomers]);

  const handleBackgroundProposalComplete = useCallback((task: BackgroundTask) => {
    if (task.status !== 'completed' || !task.result) return;

    const newProposal: Proposal = {
      id: Math.random().toString(36).substr(2, 9),
      title: task.result.title,
      content: task.result.content,
      imageUrl: task.result.imageUrl,
      createdAt: new Date().toISOString()
    };

    setCustomers(prev => prev.map(c => {
      if (c.id === task.customerId) {
        return { ...c, proposals: [newProposal, ...c.proposals] };
      }
      return c;
    }));
  }, []);

  const handleViewBackgroundResult = useCallback((task: BackgroundTask) => {
    if (task.status === 'completed' && task.result) {
      setSelectedCustomerId(task.customerId);
    }
  }, []);

  const handleStatusChange = async (newStatus: CustomerStatus) => {
    if (!selectedCustomer) return;

    if (newStatus === 'lost') {
      setShowLostDealModal(true);
      return;
    }

    try {
      const response = await apiClient.updateCustomerStatus(selectedCustomerId!, newStatus);

      if (isSuccessResponse(response)) {
        const updatedCustomer = transformApiCustomer(response.data);
        setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? updatedCustomer : c));
      } else if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to update status:', error);
      setError(error.message || '상태 변경에 실패했습니다.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleKanbanStatusChange = useCallback(async (customerId: string, newStatus: CustomerStatus) => {
    try {
      const response = await apiClient.updateCustomerStatus(customerId, newStatus);

      if (isSuccessResponse(response)) {
        const updatedCustomer = transformApiCustomer(response.data);
        setCustomers(prev => prev.map(c => c.id === customerId ? updatedCustomer : c));
      } else if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to update status via drag:', error);
      setError(error.message || '상태 변경에 실패했습니다.');
      setTimeout(() => setError(null), 5000);
    }
  }, []);

  const handleConvertProspectToCustomer = async (prospectId: string) => {
    const prospect = prospects.find(p => p.id === prospectId);
    if (!prospect) return;

    try {
      // Use the backend API to convert lead to customer
      const response = await apiClient.convertLeadToCustomer(prospectId, { status: 'new' });

      if (isSuccessResponse(response)) {
        const responseData = response.data as unknown as { customer: any };
        const newCustomer = transformApiCustomer(responseData.customer);
        setCustomers(prev => [...prev, newCustomer]);

        // Refresh prospects list
        await fetchProspectsFromBackend();
      } else if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to convert prospect:', error);
      setError(error.message || '고객 전환에 실패했습니다.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDismissProspect = (prospectId: string) => {
    const prospect = prospects.find(p => p.id === prospectId);
    if (prospect) {
      setProspectToDismiss(prospect);
      setShowDismissProspectModal(true);
    }
  };

  const handleDismissProspectConfirm = async (reason: string) => {
    if (!prospectToDismiss) return;

    try {
      const response = await apiClient.dismissProspect(prospectToDismiss.id, reason);

      if (isSuccessResponse(response)) {
        // Refresh prospects list to remove dismissed prospect
        await fetchProspectsFromBackend();

        // Close modal and reset state
        setShowDismissProspectModal(false);
        setProspectToDismiss(null);
      } else if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to dismiss prospect:', error);
      setError(error.message || '관심 없음 처리에 실패했습니다.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleLostDealConfirm = async (reason: string) => {
    if (!selectedCustomer) return;

    try {
      const response = await apiClient.updateCustomerStatus(selectedCustomerId!, 'lost', reason);

      if (isSuccessResponse(response)) {
        const updatedCustomer = transformApiCustomer(response.data);
        setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? updatedCustomer : c));
      } else if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to mark as lost:', error);
      setError(error.message || 'Lost 처리에 실패했습니다.');
      setTimeout(() => setError(null), 5000);
    }

    setShowLostDealModal(false);
    setActiveTab('lost');
  };

  const handleDeleteCustomer = useCallback((customer: Customer) => {
    setCustomerToDelete(customer);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDeleteCustomer = useCallback(async () => {
    if (!customerToDelete) return;

    try {
      const response = await apiClient.deleteCustomer(customerToDelete.id);

      if (isSuccessResponse(response)) {
        setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));

        if (selectedCustomerId === customerToDelete.id) {
          setSelectedCustomerId(null);
        }
      } else if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to delete customer:', error);
      setError(error.message || '고객 삭제에 실패했습니다.');
      setTimeout(() => setError(null), 5000);
    }

    setShowDeleteConfirm(false);
    setCustomerToDelete(null);
  }, [customerToDelete, selectedCustomerId]);

  const cancelDeleteCustomer = useCallback(() => {
    setShowDeleteConfirm(false);
    setCustomerToDelete(null);
  }, []);

  const handleSaveFollowUp = useCallback(async (action: FollowUpAction) => {
    if (!selectedCustomer) return;

    try {
      await apiClient.createCustomerFollowUp(selectedCustomer.id, {
        type: action.type,
        content: action.content,
      });

      setCustomers(prev => prev.map(c => {
        if (c.id === selectedCustomer.id) {
          const updatedHistory = [...(c.followUpHistory || []), action];
          return { ...c, followUpHistory: updatedHistory, lastFollowUpAt: new Date().toISOString() };
        }
        return c;
      }));
    } catch (err) {
      const error = err as Error;
      console.error('Failed to save follow-up:', error);
      setCustomers(prev => prev.map(c => {
        if (c.id === selectedCustomer.id) {
          const updatedHistory = [...(c.followUpHistory || []), action];
          return { ...c, followUpHistory: updatedHistory, lastFollowUpAt: new Date().toISOString() };
        }
        return c;
      }));
    }
  }, [selectedCustomer]);

  // Loading screen
  if (customersLoading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 text-sm">데이터를 불러오는 중...</p>
        <p className="text-slate-400 text-xs mt-2">백엔드 서버에 연결하고 있습니다</p>
      </div>
    );
  }

  const showServerWarning = isServerHealthy === false || isServerHealthy === null;

  return (
    <BackgroundTaskProvider onProposalComplete={handleBackgroundProposalComplete}>
      <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">

        {/* Server Connection Warning */}
        {showServerWarning && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">백엔드 서버에 연결할 수 없습니다. 데이터가 저장되지 않을 수 있습니다.</span>
            </div>
            <button
              onClick={async () => {
                const healthy = await checkServerHealth();
                if (healthy) {
                  fetchCustomers();
                  fetchProspectsFromBackend();
                }
              }}
              className="text-amber-700 hover:text-amber-900 text-sm font-medium underline"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Background Task Toast */}
        <BackgroundTaskToast onViewResult={handleViewBackgroundResult} />

        {/* Header */}
        <AppHeader
          customers={customers}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterIndustry={filterIndustry}
          onFilterChange={setFilterIndustry}
          industries={industries}
          showStats={showStats}
          onToggleStats={() => setShowStats(!showStats)}
          showFollowUpScheduler={showFollowUpScheduler}
          onToggleFollowUpScheduler={() => setShowFollowUpScheduler(!showFollowUpScheduler)}
          onOpenSettings={() => setShowSettings(true)}
          onAddCustomer={() => setIsAddingCustomer(true)}
          onOpenBusinessCardScanner={() => setShowBusinessCardScanner(true)}
          onOpenMeetingRecorder={() => setShowMeetingRecorder(true)}
        />

        {/* Stats Bar */}
        {showStats && <StatsBar stats={stats} lastCollectionTime={lastCollectionTime} />}

        {/* Error Toast */}
        {error && (
          <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-right duration-300">
            <IconX className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-600 hover:text-red-800">
              <IconX className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Navigation & View Switcher */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 bg-white border-b border-neutral-200">
          <TabNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={tabCounts}
          />
          <ViewSwitcher currentView={viewMode} onViewChange={setViewMode} />
        </div>

        {/* Main Content - Kanban Board or Prospects Board */}
        <main className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6">
          {activeTab === 'prospects' ? (
            <ProspectsBoard
              prospects={prospects}
              onSelectProspect={(prospectId) => {
                // For now, just log - could open a detail panel later
                console.log('Selected prospect:', prospectId);
              }}
              onConvertToCustomer={handleConvertProspectToCustomer}
              onDismissProspect={handleDismissProspect}
            />
          ) : filteredCustomers.length === 0 && searchQuery ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <IconSearch className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">검색 결과가 없어요</h3>
              <p className="text-sm text-slate-500 mb-4">다른 키워드로 검색해보시거나, 새로운 고객을 추가해보세요.</p>
              <button onClick={() => setSearchQuery('')} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                검색어 지우기
              </button>
            </div>
          ) : viewMode === 'kanban' ? (
            <KanbanBoard
              customers={filteredCustomers}
              selectedCustomerId={selectedCustomerId}
              onSelectCustomer={setSelectedCustomerId}
              onDeleteCustomer={handleDeleteCustomer}
              onConvertProspect={handleConvertProspectToCustomer}
              onStatusChange={handleKanbanStatusChange}
              onAddCustomer={() => setIsAddingCustomer(true)}
            />
          ) : (
            <TableView
              customers={filteredCustomers}
              selectedCustomerId={selectedCustomerId}
              onSelectCustomer={(customerId) => setSelectedCustomerId(customerId)}
              selectedRows={selectedTableRows}
              onSelectionChange={setSelectedTableRows}
            />
          )}
        </main>

        {/* Customer Detail Panel */}
        {selectedCustomer && (
          <CustomerDetailPanel
            customer={selectedCustomer}
            onClose={() => setSelectedCustomerId(null)}
            onStatusChange={handleStatusChange}
            onEnrichment={handleEnrichment}
            onSaveProposal={() => setShowProposalGenerator(true)}
            onSaveFollowUp={handleSaveFollowUp}
            isEnriching={isEnriching}
            enrichmentProgress={enrichmentProgress}
          />
        )}

        {/* Lost Deal Modal */}
        {showLostDealModal && selectedCustomer && (
          <LostDealModal
            customerName={selectedCustomer.name}
            onConfirm={handleLostDealConfirm}
            onCancel={() => setShowLostDealModal(false)}
          />
        )}

        {/* Delete Customer Confirmation Modal */}
        <DeleteConfirmModal
          isOpen={showDeleteConfirm}
          customer={customerToDelete}
          onConfirm={confirmDeleteCustomer}
          onCancel={cancelDeleteCustomer}
        />

        {/* Dismiss Prospect Modal */}
        <DismissProspectModal
          isOpen={showDismissProspectModal}
          prospect={prospectToDismiss}
          onConfirm={handleDismissProspectConfirm}
          onCancel={() => {
            setShowDismissProspectModal(false);
            setProspectToDismiss(null);
          }}
        />

        {/* Add Customer Modal */}
        <AddCustomerModal
          isOpen={isAddingCustomer}
          onClose={() => setIsAddingCustomer(false)}
          onSubmit={handleAddCustomer}
        />

        {/* Proposal Generator Modal */}
        {showProposalGenerator && selectedCustomer && (
          <Suspense fallback={<PageSpinner message="제안서 생성기 로딩 중..." />}>
            <ProposalGenerator
              customer={selectedCustomer}
              onClose={() => setShowProposalGenerator(false)}
              onSave={handleSaveProposal}
            />
          </Suspense>
        )}

        {/* Unified Settings Modal */}
        <UnifiedSettings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSettingsChange={() => {
            setProspects(getProspects());
            setLastCollectionTime(Date.now());
          }}
          existingCompanyNames={customers.map(c => c.name)}
        />

        {/* ICP Settings Modal */}
        <Suspense fallback={<div />}>
          <ICPSettings
            isOpen={showICPSettings}
            onClose={() => setShowICPSettings(false)}
            onManualRun={() => {
              setProspects(getProspects());
              setLastCollectionTime(Date.now());
            }}
            existingCompanyNames={customers.map(c => c.name)}
          />
        </Suspense>

        {/* Follow-up Scheduler Modal */}
        {showFollowUpScheduler && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">자동 Follow-up 스케줄</h2>
                <button onClick={() => setShowFollowUpScheduler(false)} className="text-slate-400 hover:text-slate-600">
                  <IconX className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <Suspense fallback={<PageSpinner message="스케줄러 로딩 중..." />}>
                  <AutoFollowUpScheduler
                    customers={customers}
                    onFollowUpScheduled={(followUp) => console.log('Follow-up scheduled:', followUp)}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        )}

        {/* Meeting Prep Modal */}
        {showMeetingPrep && selectedCustomer && selectedMeetingEvent && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">미팅 준비</h2>
                <button
                  onClick={() => {
                    setShowMeetingPrep(false);
                    setSelectedMeetingEvent(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <IconX className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <Suspense fallback={<PageSpinner message="미팅 준비 로딩 중..." />}>
                  <MeetingPrep
                    customer={selectedCustomer}
                    event={selectedMeetingEvent}
                    onClose={() => {
                      setShowMeetingPrep(false);
                      setSelectedMeetingEvent(null);
                    }}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Search Overlay */}
        {showMobileSearch && (
          <div className="fixed inset-0 z-50 bg-white md:hidden animate-slide-in-from-bottom">
            <div className="flex flex-col h-full safe-bottom">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
                <div className="relative flex-1">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="고객 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <IconX className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <button onClick={() => setShowMobileSearch(false)} className="p-2 text-slate-500 hover:text-slate-700">
                  취소
                </button>
              </div>

              <div className="px-4 py-3 border-b border-slate-100">
                <select
                  value={filterIndustry}
                  onChange={(e) => setFilterIndustry(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  {industries.map(industry => (
                    <option key={industry} value={industry}>
                      {industry === 'all' ? '모든 산업 분야' : industry}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {searchQuery && filteredCustomers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <IconSearch className="w-12 h-12 text-slate-300 mb-4" />
                    <p className="text-slate-500">검색 결과가 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredCustomers.slice(0, 10).map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomerId(customer.id);
                          setShowMobileSearch(false);
                        }}
                        className="w-full text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-400 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-slate-800">{customer.name}</h4>
                            <p className="text-sm text-slate-500">{customer.industry}</p>
                          </div>
                          <IconArrowRight className="w-5 h-5 text-slate-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Tab Bar */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 md:hidden safe-bottom z-40">
          <div className="flex justify-around items-center h-16 px-2">
            <button
              onClick={() => {
                setMobileBottomTab('home');
                setShowMobileSearch(false);
              }}
              className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors ${
                mobileBottomTab === 'home' ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <Home className="w-6 h-6" />
              <span className="text-xs mt-1 font-medium">홈</span>
            </button>

            <button
              onClick={() => {
                setMobileBottomTab('search');
                setShowMobileSearch(true);
              }}
              className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors ${
                mobileBottomTab === 'search' ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <Search className="w-6 h-6" />
              <span className="text-xs mt-1 font-medium">검색</span>
            </button>

            <button
              onClick={() => setMobileBottomTab('notifications')}
              className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors relative ${
                mobileBottomTab === 'notifications' ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <Bell className="w-6 h-6" />
              <span className="text-xs mt-1 font-medium">알림</span>
            </button>

            <button
              onClick={() => {
                setMobileBottomTab('settings');
                setShowSettings(true);
              }}
              className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors ${
                mobileBottomTab === 'settings' ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <Settings className="w-6 h-6" />
              <span className="text-xs mt-1 font-medium">설정</span>
            </button>
          </div>
        </nav>

        {/* Business Card Scanner Modal */}
        <BusinessCardScanner
          isOpen={showBusinessCardScanner}
          onClose={() => setShowBusinessCardScanner(false)}
          customerId={selectedCustomerId || undefined}
          customers={customers}
          onScanComplete={handleBusinessCardScanComplete}
        />

        {/* Meeting Recorder Modal */}
        <MeetingRecorder
          isOpen={showMeetingRecorder}
          onClose={() => setShowMeetingRecorder(false)}
          customerId={selectedCustomerId || undefined}
          customerName={selectedCustomer?.name}
          customers={customers}
          onComplete={handleMeetingRecordComplete}
        />

        {/* Mobile Floating Action Button */}
        {isMobile && (
          <FloatingActionButton
            onBusinessCardClick={() => setShowBusinessCardScanner(true)}
            onMeetingRecordClick={() => setShowMeetingRecorder(true)}
          />
        )}

        {/* AI Assistant */}
        <AIAssistant
          customers={customers}
          onAction={(action, data) => {
            if (action === 'enrich_customer' && data.customerId) {
              const customer = customers.find(c => c.id === data.customerId);
              if (customer) {
                setSelectedCustomerId(data.customerId);
                handleEnrichment();
              }
            } else if (action === 'save_proposal' && data.proposal && data.customerId) {
              const customer = customers.find(c => c.id === data.customerId);
              if (customer) {
                setSelectedCustomerId(data.customerId);
                if (data.proposal.title && data.proposal.content) {
                  handleSaveProposal({
                    title: data.proposal.title,
                    content: data.proposal.content,
                    imageUrl: data.proposal.imageUrl
                  });
                }
              }
            }
          }}
        />

      </div>
    </BackgroundTaskProvider>
  );
};

// Default export for backward compatibility
export default AppDashboard;
