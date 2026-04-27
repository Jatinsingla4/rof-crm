import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface User {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  role: string;
  assignedProjectIds: string[];
  isActive: boolean;
  createdAt: Date;
}

// Hook for creating user
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/users', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// Hook for fetching users
export const useUsers = (filters?: {
  role?: string;
  projectId?: string;
  page?: number;
  pageSize?: number;
}) => {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: async () => {
      const response = await apiClient.get('/users', { params: filters });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for fetching single user
export const useUser = (userId: string) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const response = await apiClient.get(`/users/${userId}`);
      return response.data.data as User;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for updating user
export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.patch(`/users/${id}`, data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// Hook for changing password
export const useChangePassword = () => {
  return useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const response = await apiClient.post(`/users/${userId}/change-password`, {
        newPassword,
      });
      return response.data.data;
    },
  });
};

// Hook for fetching role definitions
export const useRoles = () => {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await apiClient.get('/users/roles');
      return response.data.data;
    },
    staleTime: 30 * 60 * 1000,
  });
};

// Hook for checking user permission
export const useCheckPermission = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/users/permissions', data);
      return response.data.data.hasPermission;
    },
  });
};

// Hook for fetching audit logs
export const useAuditLogs = (filters?: {
  userId?: string;
  action?: string;
  entityType?: string;
  page?: number;
  pageSize?: number;
}) => {
  return useQuery({
    queryKey: ['auditLogs', filters],
    queryFn: async () => {
      const response = await apiClient.get('/users/audit-logs', { params: filters });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for logging action
export const useLogAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/users/audit-logs', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
};

// Hook for fetching user activity
export const useUserActivity = (filters?: { projectId?: string; period?: string }) => {
  return useQuery({
    queryKey: ['userActivity', filters],
    queryFn: async () => {
      const response = await apiClient.get('/users/activity', { params: filters });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};
