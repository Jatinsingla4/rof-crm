import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface Milestone {
  id: string;
  project_id: string;
  milestone_name: string;
  milestone_type: string;
  description: string;
  planned_date: string;
  actual_date: string | null;
  completion_percentage: number;
  status: string;
  notify_allottees: boolean;
  notification_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectProgress {
  totalMilestones: number;
  completedMilestones: number;
  progressPercentage: number;
}

// Hook for fetching milestones for a project
export const useMilestones = (projectId?: string) => {
  return useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const response = await apiClient.get('/milestones', {
        params: { projectId },
      });
      return response.data.data;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for fetching project progress
export const useProjectProgress = (projectId?: string) => {
  return useQuery({
    queryKey: ['projectProgress', projectId],
    queryFn: async () => {
      const response = await apiClient.get(`/milestones/project/${projectId}/progress`);
      return response.data.data;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for marking milestone complete
export const useCompleteMilestone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      milestoneId,
      actualDate,
      completionPercentage,
      description,
      notifyAllottees,
    }: {
      milestoneId: string;
      actualDate: string;
      completionPercentage: number;
      description: string;
      notifyAllottees: boolean;
    }) => {
      const response = await apiClient.patch(`/milestones/${milestoneId}/complete`, {
        actualDate,
        completionPercentage,
        description,
        notifyAllottees,
      });
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      queryClient.invalidateQueries({ queryKey: ['projectProgress'] });
    },
  });
};
