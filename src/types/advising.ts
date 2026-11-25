// ==========================================
// Academic Advising & Messaging Types (Backend Spec)
// ==========================================

export type AdvisingRiskLevel = "CRITICAL" | "WARNING" | "SAFE";
export type AdvisingSessionStatus = "ACTIVE" | "RESOLVED" | "CLOSED";
export type AdvisingMessageType =
  | "NOTICE"
  | "REPLY"
  | "TASK_NOTICE"
  | "APPOINTMENT_NOTICE";
export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED";
export type TaskPriority = "HIGH" | "MEDIUM" | "NORMAL";

export interface AdvisingMessage {
  id: string; // UUID
  session_id: string; // UUID
  sender_id: string;
  sender_role: "student" | "lecturer" | "admin" | string;
  sender_name: string;
  message_type: AdvisingMessageType;
  content: string;
  attachments?: unknown | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface AdvisingSession {
  id: string; // UUID
  student_id: string;
  student_name?: string | null;
  lecturer_id: string;
  lecturer_name?: string | null;
  course_code: string;
  course_name?: string | null;
  semester_code: string;
  topic: string;
  risk_level: AdvisingRiskLevel;
  status: AdvisingSessionStatus;
  unread_count: number;
  last_message?: AdvisingMessage | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface AdvisingSessionCreatePayload {
  student_id: string;
  course_code: string;
  semester_code?: string;
  topic: string;
  risk_level?: AdvisingRiskLevel;
  lecturer_id?: string;
}

export interface AdvisingMessageCreatePayload {
  content: string;
  message_type?: AdvisingMessageType;
  attachments?: unknown | null;
}

export interface AdvisingAppointment {
  id: string; // UUID
  session_id: string; // UUID
  student_id: string;
  lecturer_id: string;
  course_code: string;
  subject: string;
  time_slot: string;
  meeting_type: "OFFICE" | "ONLINE";
  location: string;
  notes?: string | null;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
}

export interface AdvisingAppointmentCreatePayload {
  subject: string;
  time_slot: string;
  meeting_type?: "OFFICE" | "ONLINE";
  location: string;
  notes?: string | null;
}

export interface AdvisingAppointmentStatusUpdatePayload {
  status: AppointmentStatus;
}

export interface AdvisingActionTask {
  id: string; // UUID
  session_id: string; // UUID
  student_id: string;
  lecturer_id: string;
  course_code: string;
  title: string;
  description?: string | null;
  deadline: string;
  priority: TaskPriority;
  completed: boolean;
  completed_at?: string | null;
  created_at: string;
}

export interface AdvisingActionTaskCreatePayload {
  title: string;
  description?: string | null;
  deadline: string;
  priority?: TaskPriority;
}

export interface AdvisingActionTaskTogglePayload {
  completed: boolean;
}

export interface UnreadCountResponse {
  unread_count: number;
}

export type NotificationDirection = "all" | "received" | "sent";

export interface AdvisingNotificationItem {
  id: string; // UUID
  session_id: string; // UUID
  course_code: string;
  course_name?: string | null;
  semester_code: string;
  student_id: string;
  student_name?: string | null;
  lecturer_id: string;
  lecturer_name?: string | null;
  sender_id: string;
  sender_role: "student" | "lecturer" | "admin" | string;
  sender_name: string;
  message_type: AdvisingMessageType;
  content: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  direction: "received" | "sent";
}

export interface AdvisingNotificationListResponse {
  items: AdvisingNotificationItem[];
  total: number;
  unread_count: number;
  received_count: number;
  sent_count: number;
  has_more: boolean;
}

export interface MarkReadResponse {
  marked_count: number;
  unread_count: number;
}
