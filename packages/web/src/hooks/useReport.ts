import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

// Hook for sales dashboard
export const useSalesDashboard = (filters?: {
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  return useQuery({
    queryKey: ['salesDashboard', filters],
    queryFn: async () => {
      const response = await apiClient.get('/reports/sales-dashboard', {
        params: filters,
      });
      return response.data.data.metrics;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for financial dashboard
export const useFinancialDashboard = (projectId?: string) => {
  return useQuery({
    queryKey: ['financialDashboard', projectId],
    queryFn: async () => {
      const response = await apiClient.get('/reports/financial-dashboard', {
        params: { projectId },
      });
      return response.data.data.metrics;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for project dashboard
export const useProjectDashboard = (projectId: string) => {
  return useQuery({
    queryKey: ['projectDashboard', projectId],
    queryFn: async () => {
      const response = await apiClient.get('/reports/project-dashboard', {
        params: { projectId },
      });
      return response.data.data;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for campaign ROI
export const useCampaignRoi = (filters?: { projectId?: string; campaignType?: string }) => {
  return useQuery({
    queryKey: ['campaignRoi', filters],
    queryFn: async () => {
      const response = await apiClient.get('/reports/campaign-roi', {
        params: filters,
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for lead source analysis
export const useLeadSourceAnalysis = (projectId?: string) => {
  return useQuery({
    queryKey: ['leadSourceAnalysis', projectId],
    queryFn: async () => {
      const response = await apiClient.get('/reports/lead-source-analysis', {
        params: { projectId },
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for payment ageing
export const usePaymentAgeing = (projectId?: string) => {
  return useQuery({
    queryKey: ['paymentAgeing', projectId],
    queryFn: async () => {
      const response = await apiClient.get('/reports/payment-ageing', {
        params: { projectId },
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for monthly collection trend
export const useMonthlyCollection = (projectId?: string) => {
  return useQuery({
    queryKey: ['monthlyCollection', projectId],
    queryFn: async () => {
      const response = await apiClient.get('/reports/monthly-collection', {
        params: { projectId },
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for creating custom report
export const useCreateCustomReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/reports/custom-report', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customReports'] });
    },
  });
};

// Hook for fetching custom reports
export const useCustomReports = (projectId: string) => {
  return useQuery({
    queryKey: ['customReports', projectId],
    queryFn: async () => {
      const response = await apiClient.get('/reports/custom-reports', {
        params: { projectId },
      });
      return response.data.data;
    },
    enabled: !!projectId,
    staleTime: 10 * 60 * 1000,
  });
};

// Hook for allotment dashboard (Phase 4)
export const useAllotmentDashboard = () => {
  return useQuery({
    queryKey: ['allotmentDashboard'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/allotment-dashboard');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};
