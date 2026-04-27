import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface PaymentPlan {
  id: string;
  allocationId: string;
  consumerId: string;
  unitId: string;
  projectId: string;
  totalAmountInr: number;
  createdAt: Date;
}

export interface Demand {
  id: string;
  paymentPlanId: string;
  installmentIndex: number;
  amountDueInr: number;
  dueDate: Date;
  deliveryStatus: string;
}

export interface Receipt {
  id: string;
  paymentPlanId: string;
  amountReceivedInr: number;
  paymentMethod: string;
  receiptNumber: string;
}

// Hook for creating payment plan
export const useCreatePaymentPlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/payments/payment-plans', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentPlans'] });
      queryClient.invalidateQueries({ queryKey: ['paymentDashboard'] });
    },
  });
};

// Hook for fetching overdue payments
export const useOverduePayments = () => {
  return useQuery({
    queryKey: ['overduePayments'],
    queryFn: async () => {
      const response = await apiClient.get('/payments/overdue');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for recording receipt
export const useRecordReceipt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/payments/receipts', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['paymentDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['overduePayments'] });
    },
  });
};

// Hook for payment dashboard KPIs
export const usePaymentDashboard = (projectId?: string) => {
  return useQuery({
    queryKey: ['paymentDashboard', projectId],
    queryFn: async () => {
      const response = await apiClient.get('/payments/dashboard', {
        params: { projectId },
      });
      return response.data.data.kpis;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for getting demands
export const useDemands = (paymentPlanId: string) => {
  return useQuery({
    queryKey: ['demands', paymentPlanId],
    queryFn: async () => {
      const response = await apiClient.get(`/payments/${paymentPlanId}/demands`);
      return response.data.data;
    },
    enabled: !!paymentPlanId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for calculating HRERA interest
export const useCalculateInterest = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/payments/calculate-interest', data);
      return response.data.data;
    },
  });
};
