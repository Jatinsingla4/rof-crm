import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface DrawRefund {
  id: string;
  consumer_id: string;
  consumer_name: string;
  project_id: string;
  project_name: string;
  booking_amount: number;
  refund_amount: number;
  due_by: string;
  status: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationImport {
  id: string;
  import_date: string;
  file_name: string;
  total_transactions: number;
  matched_count: number;
  unmatched_count: number;
  created_at: string;
}

export interface ReconciliationTransaction {
  id: string;
  import_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  reference: string;
  status: string;
  match_confidence?: number;
  created_at: string;
}

// Hook for fetching draw refunds
export const useDrawRefunds = (filters?: { status?: string }) => {
  return useQuery({
    queryKey: ['drawRefunds', filters],
    queryFn: async () => {
      const response = await apiClient.get('/payments/draw-refunds', {
        params: filters,
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for fetching overdue refunds count
export const useOverdueRefunds = () => {
  return useQuery({
    queryKey: ['overdueRefunds'],
    queryFn: async () => {
      const response = await apiClient.get('/payments/draw-refunds/overdue');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for initiating a refund
export const useInitiateRefund = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      refundId,
      referenceNumber,
      notes,
    }: {
      refundId: string;
      referenceNumber: string;
      notes?: string;
    }) => {
      const response = await apiClient.patch(
        `/payments/draw-refunds/${refundId}/initiate`,
        {
          referenceNumber,
          notes,
        }
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawRefunds'] });
      queryClient.invalidateQueries({ queryKey: ['overdueRefunds'] });
    },
  });
};

// Hook for completing a refund
export const useCompleteRefund = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      refundId,
      finalReference,
    }: {
      refundId: string;
      finalReference: string;
    }) => {
      const response = await apiClient.patch(
        `/payments/draw-refunds/${refundId}/complete`,
        {
          finalReference,
        }
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawRefunds'] });
      queryClient.invalidateQueries({ queryKey: ['overdueRefunds'] });
    },
  });
};

// Hook for reconciliation imports
export const useReconciliationImports = () => {
  return useQuery({
    queryKey: ['reconciliationImports'],
    queryFn: async () => {
      const response = await apiClient.get('/reconciliation/imports');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for reconciliation transactions
export const useReconciliationTransactions = (importId?: string) => {
  return useQuery({
    queryKey: ['reconciliationTransactions', importId],
    queryFn: async () => {
      const response = await apiClient.get(
        `/reconciliation/imports/${importId}/transactions`
      );
      return response.data.data;
    },
    enabled: !!importId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for uploading reconciliation file
export const useUploadReconciliation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post('/reconciliation/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliationImports'] });
    },
  });
};

// Hook for matching transaction
export const useMatchTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transactionId,
      demandId,
    }: {
      transactionId: string;
      demandId: string;
    }) => {
      const response = await apiClient.patch(
        `/reconciliation/transactions/${transactionId}/match`,
        {
          demandId,
        }
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliationTransactions'] });
    },
  });
};

// Hook for ignoring transaction
export const useIgnoreTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await apiClient.patch(
        `/reconciliation/transactions/${transactionId}/ignore`
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliationTransactions'] });
    },
  });
};
