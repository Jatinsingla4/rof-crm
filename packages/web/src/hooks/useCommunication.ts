import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface Communication {
  id: string;
  consumerId: string;
  channel: 'email' | 'whatsapp' | 'sms' | 'call' | 'chat' | 'in_person' | 'system';
  direction: 'inbound' | 'outbound';
  subject?: string;
  message: string;
  status: string;
  createdAt: Date;
}

export interface SupportTicket {
  id: string;
  consumerId: string;
  subject: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: Date;
}

// Hook for adding communication remark
export const useAddCommunicationRemark = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ consumerId, data }: { consumerId: string; data: any }) => {
      const response = await apiClient.post('/communications/remarks', data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['remarks', variables.consumerId] });
    },
  });
};

// Hook for fetching communication remarks
export const useCommunicationRemarks = (consumerId: string, filters?: { channel?: string; page?: number }) => {
  return useQuery({
    queryKey: ['remarks', consumerId, filters],
    queryFn: async () => {
      const response = await apiClient.get(`/communications/remarks/${consumerId}`, {
        params: filters,
      });
      return response.data.data;
    },
    enabled: !!consumerId,
    staleTime: 3 * 60 * 1000,
  });
};

// Hook for sending email
export const useSendEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/communications/emails', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
    },
  });
};

// Hook for sending WhatsApp
export const useSendWhatsApp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/communications/whatsapp', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
    },
  });
};

// Hook for sending SMS
export const useSendSMS = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/communications/sms', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
    },
  });
};

// Hook for fetching communications
export const useCommunications = (
  consumerId: string,
  filters?: { channel?: string; page?: number }
) => {
  return useQuery({
    queryKey: ['communications', consumerId, filters],
    queryFn: async () => {
      const response = await apiClient.get(`/communications/${consumerId}`, {
        params: filters,
      });
      return response.data.data;
    },
    enabled: !!consumerId,
    staleTime: 3 * 60 * 1000,
  });
};

// Hook for creating support ticket
export const useCreateTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/communications/tickets', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

// Hook for fetching support tickets
export const useTickets = (filters?: {
  status?: string;
  priority?: string;
  assignedToUserId?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: async () => {
      const response = await apiClient.get('/communications/tickets', {
        params: filters,
      });
      return response.data.data;
    },
    staleTime: 3 * 60 * 1000,
  });
};

// Hook for updating ticket
export const useUpdateTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: string; data: any }) => {
      const response = await apiClient.patch(`/communications/tickets/${ticketId}`, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

// Hook for AI suggestions
export const useAISuggestions = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/communications/ai-suggestions', data);
      return response.data.data.suggestions;
    },
  });
};

// Hook for broadcast campaign
export const useBroadcastCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/communications/broadcast', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
};

// Hook for fetching campaigns
export const useCampaigns = (filters?: { projectId?: string; channel?: string }) => {
  return useQuery({
    queryKey: ['campaigns', filters],
    queryFn: async () => {
      const response = await apiClient.get('/communications/campaigns', {
        params: filters,
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};
