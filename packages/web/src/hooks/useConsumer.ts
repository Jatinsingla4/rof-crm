import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface Consumer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  leadStage: string;
  projectId: string;
  allocatedUnitId?: string;
  createdAt: Date;
}

export interface ConsumerDetail extends Consumer {
  kycDocuments: any[];
  paymentSummary: any;
}

// Hook for fetching consumers list
export const useConsumers = (filters?: {
  search?: string;
  leadStage?: string;
  projectId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) => {
  return useQuery({
    queryKey: ['consumers', filters],
    queryFn: async () => {
      const response = await apiClient.get('/consumers', { params: filters });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for fetching single consumer detail
export const useConsumer = (consumerId: string) => {
  return useQuery({
    queryKey: ['consumer', consumerId],
    queryFn: async () => {
      const response = await apiClient.get(`/consumers/${consumerId}`);
      return response.data.data as ConsumerDetail;
    },
    enabled: !!consumerId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for creating consumer
export const useCreateConsumer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/consumers', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumers'] });
    },
  });
};

// Hook for updating consumer
export const useUpdateConsumer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.patch(`/consumers/${id}`, data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consumer', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['consumers'] });
    },
  });
};

// Hook for adding KYC document
export const useUploadKycDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      consumerId,
      data,
    }: {
      consumerId: string;
      data: any;
    }) => {
      const response = await apiClient.post(`/consumers/${consumerId}/kyc-documents`, data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consumer', variables.consumerId] });
    },
  });
};

// Hook for adding remark
export const useAddRemark = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ consumerId, data }: { consumerId: string; data: any }) => {
      const response = await apiClient.post(`/consumers/${consumerId}/remarks`, data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['remarks', variables.consumerId] });
    },
  });
};

// Hook for fetching remarks
export const useRemarks = (consumerId: string) => {
  return useQuery({
    queryKey: ['remarks', consumerId],
    queryFn: async () => {
      const response = await apiClient.get(`/consumers/${consumerId}/remarks`);
      return response.data.data;
    },
    enabled: !!consumerId,
    staleTime: 3 * 60 * 1000,
  });
};
