import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface Unit {
  id: string;
  projectId: string;
  tower: string;
  floor: number;
  unitNumber: string;
  bhkType: string;
  carpetAreaSqm: number;
  superAreaSqm: number;
  totalPriceInr: number;
  facing: string;
  status: string;
  allocatedToConsumerId?: string;
  createdAt: Date;
}

// Hook for creating unit
export const useCreateUnit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/units', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['inventorySummary'] });
    },
  });
};

// Hook for fetching units list
export const useUnits = (filters?: {
  projectId?: string;
  tower?: string;
  status?: string;
  bhkType?: string;
  page?: number;
  pageSize?: number;
}) => {
  return useQuery({
    queryKey: ['units', filters],
    queryFn: async () => {
      const response = await apiClient.get('/units', { params: filters });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for fetching single unit detail
export const useUnit = (unitId: string) => {
  return useQuery({
    queryKey: ['unit', unitId],
    queryFn: async () => {
      const response = await apiClient.get(`/units/${unitId}`);
      return response.data.data;
    },
    enabled: !!unitId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for updating unit
export const useUpdateUnit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.patch(`/units/${id}`, data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['unit', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
  });
};

// Hook for tower-wise breakdown
export const useTowerBreakdown = (projectId: string) => {
  return useQuery({
    queryKey: ['towerBreakdown', projectId],
    queryFn: async () => {
      const response = await apiClient.get(`/units/tower/${projectId}`);
      return response.data.data;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for bulk import
export const useBulkImportUnits = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/units/bulk-import', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['inventorySummary'] });
    },
  });
};

// Hook for inventory summary
export const useInventorySummary = (projectId: string) => {
  return useQuery({
    queryKey: ['inventorySummary', projectId],
    queryFn: async () => {
      const response = await apiClient.get(`/units/inventory-summary/${projectId}`);
      return response.data.data;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
};
