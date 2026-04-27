import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface DocumentTemplate {
  id: string;
  projectId: string;
  documentType: string;
  title: string;
  htmlContent: string;
  mergeFields: string[];
  createdAt: Date;
}

export interface Document {
  id: string;
  consumerId: string;
  documentType: string;
  deliveryMethod: string;
  deliveryStatus: string;
  createdAt: Date;
}

// Hook for creating template
export const useCreateDocumentTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/documents/templates', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentTemplates'] });
    },
  });
};

// Hook for fetching templates
export const useDocumentTemplates = (filters?: {
  projectId?: string;
  documentType?: string;
}) => {
  return useQuery({
    queryKey: ['documentTemplates', filters],
    queryFn: async () => {
      const response = await apiClient.get('/documents/templates', {
        params: filters,
      });
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
};

// Hook for fetching single template
export const useDocumentTemplate = (templateId: string) => {
  return useQuery({
    queryKey: ['documentTemplate', templateId],
    queryFn: async () => {
      const response = await apiClient.get(`/documents/templates/${templateId}`);
      return response.data.data;
    },
    enabled: !!templateId,
    staleTime: 10 * 60 * 1000,
  });
};

// Hook for updating template
export const useUpdateDocumentTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.patch(`/documents/templates/${id}`, data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documentTemplate', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['documentTemplates'] });
    },
  });
};

// Hook for generating document
export const useGenerateDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/documents/generate', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};

// Hook for sending document
export const useSendDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentId,
      recipientEmail,
      recipientPhone,
    }: {
      documentId: string;
      recipientEmail?: string;
      recipientPhone?: string;
    }) => {
      const response = await apiClient.post(`/documents/${documentId}/send`, {
        recipientEmail,
        recipientPhone,
      });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};

// Hook for fetching documents
export const useDocuments = (consumerId: string, documentType?: string) => {
  return useQuery({
    queryKey: ['documents', consumerId, documentType],
    queryFn: async () => {
      const response = await apiClient.get(`/documents/${consumerId}`, {
        params: { documentType },
      });
      return response.data.data;
    },
    enabled: !!consumerId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for uploading to vault
export const useUploadDocumentVault = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/documents/vault', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentVault'] });
    },
  });
};

// Hook for fetching vault documents
export const useDocumentVault = (consumerId: string, documentCategory?: string) => {
  return useQuery({
    queryKey: ['documentVault', consumerId, documentCategory],
    queryFn: async () => {
      const response = await apiClient.get(`/documents/vault/${consumerId}`, {
        params: { documentCategory },
      });
      return response.data.data;
    },
    enabled: !!consumerId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for searching documents
export const useSearchDocuments = (query: string, projectId?: string) => {
  return useQuery({
    queryKey: ['documentSearch', query, projectId],
    queryFn: async () => {
      const response = await apiClient.get('/documents/search', {
        params: { query, projectId },
      });
      return response.data.data;
    },
    enabled: !!query,
  });
};
