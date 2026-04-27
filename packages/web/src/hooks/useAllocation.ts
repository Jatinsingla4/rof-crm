import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface Allocation {
  id: string;
  consumerId: string;
  unitId: string;
  projectId: string;
  allocatedDate: Date;
  status: string;
  consumerName: string;
  unitNumber: string;
}

// Hook for creating allocation
export const useCreateAllocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/allocations', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['consumers'] });
      queryClient.invalidateQueries({ queryKey: ['inventorySummary'] });
    },
  });
};

// Hook for fetching allocations
export const useAllocations = (filters?: {
  projectId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) => {
  return useQuery({
    queryKey: ['allocations', filters],
    queryFn: async () => {
      const response = await apiClient.get('/allocations', { params: filters });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for cancelling allocation
export const useCancelAllocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      allocationId,
      reason,
    }: {
      allocationId: string;
      reason: string;
    }) => {
      const response = await apiClient.post(`/allocations/${allocationId}/cancel`, {
        reason,
      });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['consumers'] });
    },
  });
};

// Hook for importing e-draw results
export const useImportEdraw = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/allocations/import-edraw', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['consumers'] });
    },
  });
};
