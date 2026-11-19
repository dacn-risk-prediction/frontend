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
  UnreadCountResponse,
} from "@/types";

// ==========================================
// Query Keys
// ==========================================

export const advisingKeys = {
  all: ["advising"] as const,
  unreadCount: () => [...advisingKeys.all, "unread-count"] as const,
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
  const response = await apiClient.get<UnreadCountResponse>("/advising/unread-count");
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
      params: { limit, offset },
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
    refetchInterval: 15000,
    staleTime: 10000,
    enabled,
    retry: false,
  });
};

export const useAdvisingSessions = (enabled: boolean = true) => {
  return useQuery({
    queryKey: advisingKeys.sessions(),
    queryFn: listAdvisingSessions,
    refetchInterval: 10000,
    staleTime: 5000,
    enabled,
    retry: false,
  });
};

export const useAdvisingSession = (sessionId?: string) => {
  return useQuery({
    queryKey: advisingKeys.session(sessionId),
    queryFn: () => getSessionDetails(sessionId!),
    enabled: !!sessionId,
    retry: false,
  });
};

export const useCreateOrGetAdvisingSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrGetAdvisingSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: advisingKeys.sessions() });
    },
  });
};

export const useSessionMessages = (
  sessionId?: string,
  limit: number = 50,
  offset: number = 0
) => {
  return useQuery({
    queryKey: advisingKeys.messages(sessionId),
    queryFn: () => getSessionMessages(sessionId!, limit, offset),
    enabled: !!sessionId,
    refetchInterval: 5000, // Poll every 5 seconds for incoming messages
    staleTime: 2000,
    retry: false,
  });
};

export const useSendMessage = (sessionId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdvisingMessageCreatePayload) =>
      sendAdvisingMessage(sessionId!, payload),
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({
          queryKey: advisingKeys.messages(sessionId),
        });
      }
      queryClient.invalidateQueries({ queryKey: advisingKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: advisingKeys.unreadCount() });
    },
  });
};

export const useSessionAppointments = (sessionId?: string) => {
  return useQuery({
    queryKey: advisingKeys.appointments(sessionId),
    queryFn: () => getSessionAppointments(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 10000,
    staleTime: 5000,
    retry: false,
  });
};

export const useCreateAppointment = (sessionId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdvisingAppointmentCreatePayload) =>
      createAdvisingAppointment(sessionId!, payload),
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({
          queryKey: advisingKeys.appointments(sessionId),
        });
        queryClient.invalidateQueries({
          queryKey: advisingKeys.messages(sessionId),
        });
      }
      queryClient.invalidateQueries({ queryKey: advisingKeys.sessions() });
    },
  });
};

export const useUpdateAppointmentStatus = (sessionId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      appointmentId,
      payload,
    }: {
      appointmentId: string;
      payload: AdvisingAppointmentStatusUpdatePayload;
    }) => updateAppointmentStatus(appointmentId, payload),
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({
          queryKey: advisingKeys.appointments(sessionId),
        });
      }
    },
  });
};

export const useSessionTasks = (sessionId?: string) => {
  return useQuery({
    queryKey: advisingKeys.tasks(sessionId),
    queryFn: () => getSessionTasks(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 10000,
    staleTime: 5000,
    retry: false,
  });
};

export const useCreateTask = (sessionId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdvisingActionTaskCreatePayload) =>
      createAdvisingTask(sessionId!, payload),
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({
          queryKey: advisingKeys.tasks(sessionId),
        });
        queryClient.invalidateQueries({
          queryKey: advisingKeys.messages(sessionId),
        });
      }
      queryClient.invalidateQueries({ queryKey: advisingKeys.sessions() });
    },
  });
};

export const useToggleTask = (sessionId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: AdvisingActionTaskTogglePayload;
    }) => toggleAdvisingTask(taskId, payload),
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({
          queryKey: advisingKeys.tasks(sessionId),
        });
      }
    },
  });
};
