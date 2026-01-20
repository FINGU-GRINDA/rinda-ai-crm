import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { BackgroundTask, Customer, ImageSize } from '../types';
import { generateProposalStrategy, generateProposalCoverImage } from '../services/geminiService';

interface BackgroundTaskContextValue {
  tasks: BackgroundTask[];
  activeTaskCount: number;
  startProposalGeneration: (customer: Customer, imageSize: ImageSize) => string;
  getTask: (taskId: string) => BackgroundTask | undefined;
  dismissTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
}

const BackgroundTaskContext = createContext<BackgroundTaskContextValue | null>(null);

export const useBackgroundTasks = () => {
  const context = useContext(BackgroundTaskContext);
  if (!context) {
    throw new Error('useBackgroundTasks must be used within BackgroundTaskProvider');
  }
  return context;
};

interface BackgroundTaskProviderProps {
  children: React.ReactNode;
  onProposalComplete?: (task: BackgroundTask) => void;
}

export const BackgroundTaskProvider: React.FC<BackgroundTaskProviderProps> = ({
  children,
  onProposalComplete
}) => {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const onProposalCompleteRef = useRef(onProposalComplete);
  onProposalCompleteRef.current = onProposalComplete;

  const updateTask = useCallback((taskId: string, updates: Partial<BackgroundTask>) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    ));
  }, []);

  const startProposalGeneration = useCallback((customer: Customer, imageSize: ImageSize): string => {
    const taskId = `proposal_${Date.now()}_${customer.id}`;

    const newTask: BackgroundTask = {
      id: taskId,
      type: 'proposal_generation',
      status: 'pending',
      customerId: customer.id,
      customerName: customer.name,
      progress: 0,
      message: '제안서 생성 준비 중...',
      createdAt: new Date().toISOString()
    };

    setTasks(prev => [newTask, ...prev]);

    // Start async generation
    (async () => {
      try {
        // Update to running
        updateTask(taskId, {
          status: 'running',
          progress: 10,
          message: '제안서 작성을 준비하고 있어요...'
        });

        if (!customer.enrichedData) {
          throw new Error('고객 분석 데이터가 필요합니다');
        }

        // Step 1: Generate proposal content
        updateTask(taskId, {
          progress: 20,
          message: '1단계: 제안서 내용 작성 중 (Gemini 3 Pro)...'
        });

        const strategyText = await generateProposalStrategy(
          customer.name,
          customer.enrichedData,
          customer.notes
        );

        updateTask(taskId, {
          progress: 60,
          message: '제안서 내용 작성 완료! 커버 이미지 생성 중...'
        });

        // Step 2: Generate cover image
        updateTask(taskId, {
          progress: 70,
          message: `2단계: 커버 이미지 만들기 (${imageSize} 화질)...`
        });

        const imageUrl = await generateProposalCoverImage(
          customer.name,
          customer.industry,
          customer.enrichedData.summary,
          imageSize
        );

        updateTask(taskId, {
          progress: 90,
          message: '커버 이미지 생성 완료! 마무리 중...'
        });

        // Complete
        const completedTask: Partial<BackgroundTask> = {
          status: 'completed',
          progress: 100,
          message: '제안서 생성이 완료되었습니다!',
          result: {
            title: `${customer.name} 맞춤 제안서`,
            content: strategyText,
            imageUrl: imageUrl
          },
          completedAt: new Date().toISOString()
        };

        updateTask(taskId, completedTask);

        // Notify completion
        if (onProposalCompleteRef.current) {
          setTasks(prev => {
            const task = prev.find(t => t.id === taskId);
            if (task) {
              onProposalCompleteRef.current?.({ ...task, ...completedTask } as BackgroundTask);
            }
            return prev;
          });
        }

      } catch (error: any) {
        console.error('Background proposal generation failed:', error);
        updateTask(taskId, {
          status: 'error',
          progress: 0,
          message: '제안서 생성 실패',
          error: error.message || '알 수 없는 오류가 발생했습니다',
          completedAt: new Date().toISOString()
        });
      }
    })();

    return taskId;
  }, [updateTask]);

  const getTask = useCallback((taskId: string) => {
    return tasks.find(t => t.id === taskId);
  }, [tasks]);

  const dismissTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const clearCompletedTasks = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status === 'running' || t.status === 'pending'));
  }, []);

  const activeTaskCount = tasks.filter(t => t.status === 'running' || t.status === 'pending').length;

  return (
    <BackgroundTaskContext.Provider
      value={{
        tasks,
        activeTaskCount,
        startProposalGeneration,
        getTask,
        dismissTask,
        clearCompletedTasks
      }}
    >
      {children}
    </BackgroundTaskContext.Provider>
  );
};
