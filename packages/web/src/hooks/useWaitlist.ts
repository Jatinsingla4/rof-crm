import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface WaitlistEntry {
  id: string;
  consumer_id: string;
  consumer_name: string;
  consumer_mobile: string;
  project_id: string;
  project_name: string;
  unit_type: string;
  position: number;
  applied_date: string;
  status: string;
  promoted_date?: string;
  cancelled_date?: string;
  created_at: string;
}

export interface WaitlistFilters {
  projectId?: string;
  unitType?: string;
  status?: string;
}

// Hook for fetching waitlist entries
export const useWaitlist = (filters?: WaitlistFilters) => {
  return useQuery({
    queryKey: ['waitlist', filters],
    queryFn: async () => {
      const response = await apiClient.get('/allocations/waitlist', {
        params: filters,
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for creating waitlist entry
export const useCreateWaitlistEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      consumerId: string;
      projectId: string;
      unitType: string;
    }) => {
      const response = await apiClient.post('/allocations/waitlist', {
        consumerId: data.consumerId,
        projectId: data.projectId,
        unitType: data.unitType,
      });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
};

// Hook for promoting waitlist entry
export const usePromoteWaitlistEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entryId,
      unitId,
    }: {
      entryId: string;
      unitId: string;
    }) => {
      const response = await apiClient.post(
        `/allocations/waitlist/${entryId}/promote`,
        {
          unitId,
        }
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
};
