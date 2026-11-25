import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  AdvisingSession,
  AdvisingSessionCreatePayload,
  AdvisingMessage,
  AdvisingMessageCreatePayload,
  AdvisingAppointment,
  AdvisingAppointmentCreatePayload,
  AdvisingAppointmentStatusUpdatePayload,
  AdvisingActionTask,
  AdvisingActionTaskCreatePayload,
  AdvisingActionTaskTogglePayload,
  AdvisingNotificationListResponse,
  MarkReadResponse,
  NotificationDirection,
  UnreadCountResponse,
} from "@/types";

// ==========================================
// Query Keys
// ==========================================

export const advisingKeys = {
  all: ["advising"] as const,
  unreadCount: () => [...advisingKeys.all, "unread-count"] as const,
  notificationsAll: () => [...advisingKeys.all, "notifications"] as const,
  notifications: (direction: NotificationDirection, limit: number) =>
    [...advisingKeys.all, "notifications", direction, limit] as const,
  sessions: () => [...advisingKeys.all, "sessions"] as const,
  session: (id?: string) => [...advisingKeys.all, "session", id] as const,
  messages: (sessionId?: string) =>
    [...advisingKeys.all, "messages", sessionId] as const,
  appointments: (sessionId?: string) =>
    [...advisingKeys.all, "appointments", sessionId] as const,
  tasks: (sessionId?: string) =>
    [...advisingKeys.all, "tasks", sessionId] as const,
};

// ==========================================
// Raw API Functions
// ==========================================

export const getUnreadAdvisingCount = async (): Promise<UnreadCountResponse> => {
  const response = await apiClient.get<UnreadCountResponse>(
    "/advising/unread-count"
  );
  return response.data;
};

export const getAdvisingNotifications = async (
  direction: NotificationDirection = "all",
  limit: number = 20,
  offset: number = 0
): Promise<AdvisingNotificationListResponse> => {
  const response = await apiClient.get<AdvisingNotificationListResponse>(
    "/advising/notifications",
    {
      params: { direction, limit, offset },
    }
  );
  return response.data;
};

export const markSessionAsRead = async (
  sessionId: string
): Promise<MarkReadResponse> => {
  const response = await apiClient.post<MarkReadResponse>(
    `/advising/sessions/${sessionId}/read`
  );
  return response.data;
};

export const markAllNotificationsAsRead = async (): Promise<MarkReadResponse> => {
  const response = await apiClient.post<MarkReadResponse>("/advising/read-all");
  return response.data;
};

export const listAdvisingSessions = async (): Promise<AdvisingSession[]> => {
  const response = await apiClient.get<AdvisingSession[]>("/advising/sessions");
  return response.data;
};

export const createOrGetAdvisingSession = async (
  payload: AdvisingSessionCreatePayload
): Promise<AdvisingSession> => {
  const response = await apiClient.post<AdvisingSession>(
    "/advising/sessions",
    payload
  );
  return response.data;
};

export const getSessionDetails = async (
  sessionId: string
): Promise<AdvisingSession> => {
  const response = await apiClient.get<AdvisingSession>(
    `/advising/sessions/${sessionId}`
  );
  return response.data;
};

export const getSessionMessages = async (
  sessionId: string,
  limit: number = 50,
  offset: number = 0
): Promise<AdvisingMessage[]> => {
  const response = await apiClient.get<AdvisingMessage[]>(
    `/advising/sessions/${sessionId}/messages`,
    {
      params: { limit, offset, mark_read: false },
    }
  );
  return response.data;
};

export const sendAdvisingMessage = async (
  sessionId: string,
  payload: AdvisingMessageCreatePayload
): Promise<AdvisingMessage> => {
  const response = await apiClient.post<AdvisingMessage>(
    `/advising/sessions/${sessionId}/messages`,
    payload
  );
  return response.data;
};

export const getSessionAppointments = async (
  sessionId: string
): Promise<AdvisingAppointment[]> => {
  const response = await apiClient.get<AdvisingAppointment[]>(
    `/advising/sessions/${sessionId}/appointments`
  );
  return response.data;
};

export const createAdvisingAppointment = async (
  sessionId: string,
  payload: AdvisingAppointmentCreatePayload
): Promise<AdvisingAppointment> => {
  const response = await apiClient.post<AdvisingAppointment>(
    `/advising/sessions/${sessionId}/appointments`,
    payload
  );
  return response.data;
};

export const updateAppointmentStatus = async (
  appointmentId: string,
  payload: AdvisingAppointmentStatusUpdatePayload
): Promise<AdvisingAppointment> => {
  const response = await apiClient.patch<AdvisingAppointment>(
    `/advising/appointments/${appointmentId}/status`,
    payload
  );
  return response.data;
};

export const getSessionTasks = async (
  sessionId: string
): Promise<AdvisingActionTask[]> => {
  const response = await apiClient.get<AdvisingActionTask[]>(
    `/advising/sessions/${sessionId}/tasks`
  );
  return response.data;
};

export const createAdvisingTask = async (
  sessionId: string,
  payload: AdvisingActionTaskCreatePayload
): Promise<AdvisingActionTask> => {
  const response = await apiClient.post<AdvisingActionTask>(
    `/advising/sessions/${sessionId}/tasks`,
    payload
  );
  return response.data;
};

export const toggleAdvisingTask = async (
  taskId: string,
  payload: AdvisingActionTaskTogglePayload
): Promise<AdvisingActionTask> => {
  const response = await apiClient.patch<AdvisingActionTask>(
    `/advising/tasks/${taskId}/toggle`,
    payload
  );
  return response.data;
};

// ==========================================
// TanStack Query Hooks
// ==========================================

export const useUnreadAdvisingCount = (enabled: boolean = true) => {
  return useQuery({
    queryKey: advisingKeys.unreadCount(),
    queryFn: getUnreadAdvisingCount,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    staleTime: 0,
    enabled,
    retry: false,
  });
};

export const useAdvisingNotifications = (
  direction: NotificationDirection = "all",
  limit: number = 20,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: advisingKeys.notifications(direction, limit),
    queryFn: () => getAdvisingNotifications(direction, limit, 0),
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    staleTime: 0,
    enabled,
    retry: false,
  });
};

export const useMarkSessionRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markSessionAsRead,
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: advisingKeys.unreadCount() });
      queryClient.invalidateQueries({ queryKey: advisingKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: advisingKeys.session(sessionId) });
      queryClient.invalidateQueries({ queryKey: advisingKeys.messages(sessionId) });
      queryClient.invalidateQueries({ queryKey: advisingKeys.notificationsAll() });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: advisingKeys.unreadCount() });
      queryClient.invalidateQueries({ queryKey: advisingKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: advisingKeys.notificationsAll() });
    },
  });
};

export const useAdvisingSessions = (enabled: boolean = true) => {
  return useQuery({
    queryKey: advisingKeys.sessions(),
    queryFn: listAdvisingSessions,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    staleTime: 0,
    enabled,
    retry: false,
  });
};

export const useAdvisingSession = (sessionId?: string) => {
  return useQuery({
    queryKey: advisingKeys.session(sessionId),
    queryFn: () => getSessionDetails(sessionId!),
    enabled: Boolean(sessionId),
    retry: false,
  });
};

export const useCreateOrGetAdvisingSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrGetAdvisingSession,
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: advisingKeys.sessions() });
      queryClient.invalidateQueries({
        queryKey: advisingKeys.session(session.id),
      });
    },
  });
};

export const useSessionMessages = (
  sessionId?: string,
  limit: number = 50,
  offset: number = 0,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: advisingKeys.messages(sessionId),
    queryFn: () => getSessionMessages(sessionId!, limit, offset),
    enabled: Boolean(sessionId) && enabled,
    refetchInterval: enabled ? 5000 : false,
    refetchIntervalInBackground: false,
    staleTime: 2000,
    retry: false,
  });
};

export interface SendMessageVariables {
  sessionId?: string;
  payload: AdvisingMessageCreatePayload;
}

export const useSendMessage = (defaultSessionId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, payload }: SendMessageVariables) => {
      const targetId = sessionId ?? defaultSessionId;
      if (!targetId) {
        return Promise.reject(new Error("Missing advising session ID"));
      }
      return sendAdvisingMessage(targetId, payload);
    },
    onSuccess: (_data, variables) => {
      const targetId = variables.sessionId ?? defaultSessionId;
      if (targetId) {
        queryClient.invalidateQueries({
          queryKey: advisingKeys.messages(targetId),
        });
        queryClient.invalidateQueries({
          queryKey: advisingKeys.session(targetId),
        });
      }
      queryClient.invalidateQueries({ queryKey: advisingKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: advisingKeys.unreadCount() });
      queryClient.invalidateQueries({
        queryKey: advisingKeys.notificationsAll(),
      });
    },
  });
};

export const useSessionAppointments = (sessionId?: string) => {
  return useQuery({
    queryKey: advisingKeys.appointments(sessionId),
    queryFn: () => getSessionAppointments(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: 10000,
    staleTime: 5000,
    retry: false,
  });
};

export interface CreateAppointmentVariables {
  sessionId?: string;
  payload: AdvisingAppointmentCreatePayload;
}

export const useCreateAppointment = (defaultSessionId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, payload }: CreateAppointmentVariables) => {
      const targetId = sessionId ?? defaultSessionId;
      if (!targetId) {
        return Promise.reject(new Error("Missing advising session ID"));
      }
      return createAdvisingAppointment(targetId, payload);
    },
    onSuccess: (_data, variables) => {
      const targetId = variables.sessionId ?? defaultSessionId;
      if (targetId) {
        queryClient.invalidateQueries({
          queryKey: advisingKeys.appointments(targetId),
        });
        queryClient.invalidateQueries({
          queryKey: advisingKeys.messages(targetId),
        });
      }
      queryClient.invalidateQueries({ queryKey: advisingKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: advisingKeys.unreadCount() });
      queryClient.invalidateQueries({
        queryKey: advisingKeys.notificationsAll(),
      });
    },
  });
};

export const useUpdateAppointmentStatus = (defaultSessionId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      appointmentId,
      payload,
    }: {
      sessionId?: string;
      appointmentId: string;
      payload: AdvisingAppointmentStatusUpdatePayload;
    }) => updateAppointmentStatus(appointmentId, payload),
    onSuccess: (_data, variables) => {
      const targetId = variables.sessionId ?? defaultSessionId;
      if (targetId) {
        queryClient.invalidateQueries({
          queryKey: advisingKeys.appointments(targetId),
        });
        queryClient.invalidateQueries({
          queryKey: advisingKeys.messages(targetId),
        });
      }
      queryClient.invalidateQueries({ queryKey: advisingKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: advisingKeys.unreadCount() });
      queryClient.invalidateQueries({
        queryKey: advisingKeys.notificationsAll(),
      });
    },
  });
};

export const useSessionTasks = (sessionId?: string) => {
  return useQuery({
    queryKey: advisingKeys.tasks(sessionId),
    queryFn: () => getSessionTasks(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: 10000,
    staleTime: 5000,
    retry: false,
  });
};

export interface CreateTaskVariables {
  sessionId?: string;
  payload: AdvisingActionTaskCreatePayload;
}

export const useCreateTask = (defaultSessionId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, payload }: CreateTaskVariables) => {
      const targetId = sessionId ?? defaultSessionId;
      if (!targetId) {
        return Promise.reject(new Error("Missing advising session ID"));
      }
      return createAdvisingTask(targetId, payload);
    },
    onSuccess: (_data, variables) => {
      const targetId = variables.sessionId ?? defaultSessionId;
      if (targetId) {
        queryClient.invalidateQueries({
          queryKey: advisingKeys.tasks(targetId),
        });
        queryClient.invalidateQueries({
          queryKey: advisingKeys.messages(targetId),
        });
      }
      queryClient.invalidateQueries({ queryKey: advisingKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: advisingKeys.unreadCount() });
      queryClient.invalidateQueries({
        queryKey: advisingKeys.notificationsAll(),
      });
    },
  });
};

export const useToggleTask = (defaultSessionId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      sessionId?: string;
      taskId: string;
      payload: AdvisingActionTaskTogglePayload;
    }) => toggleAdvisingTask(taskId, payload),
    onSuccess: (_data, variables) => {
      const targetId = variables.sessionId ?? defaultSessionId;
      if (targetId) {
        queryClient.invalidateQueries({
          queryKey: advisingKeys.tasks(targetId),
        });
        queryClient.invalidateQueries({
          queryKey: advisingKeys.messages(targetId),
        });
      }
      queryClient.invalidateQueries({ queryKey: advisingKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: advisingKeys.unreadCount() });
      queryClient.invalidateQueries({
        queryKey: advisingKeys.notificationsAll(),
      });
    },
  });
};
