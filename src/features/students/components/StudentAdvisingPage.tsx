import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  UserCheck,
  Calendar,
  Clock,
  MessageSquare,
  Send,
  CheckSquare,
  Square,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  CheckCheck,
  GraduationCap,
  Search,
  Building2,
  ListTodo,
  TrendingDown,
  Info,
  CalendarCheck,
  Video,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthUser } from "@/features/auth";
import {
  useActiveSemester,
  formatSemesterLabel,
} from "@/hooks/use-active-semester";
import type { AppointmentStatus } from "@/types";
import {
  useStudentDetail,
  useStudentCurrentCourses,
  useStudentPredictions,
  useStudentSummary,
} from "../api/student-api";
import {
  useAdvisingSessions,
  useCreateOrGetAdvisingSession,
  useSessionMessages,
  useSendMessage,
  useMarkSessionRead,
  useSessionAppointments,
  useCreateAppointment,
  useUpdateAppointmentStatus,
  useSessionTasks,
  useToggleTask,
} from "@/features/advising/api/advising-api";

// ==========================================
// Types & Data Contracts
// ==========================================

export type AdvisingTab = "feed" | "booking" | "action-plan";

export interface AdvisorDirectoryItem {
  id: string;
  isFacultyAdvisor: boolean;
  lecturerId?: string;
  name: string;
  title: string;
  department: string;
  courseCode?: string;
  courseName?: string;
  classGroup?: string;
  credits?: number;
  office: string;
  email: string;
  phone: string;
  officeHours: string;
  availableSlots: string[];
  riskLevel?: "HIGH" | "MEDIUM" | "LOW";
  failProbability?: number;
}

export interface DirectMessage {
  id: string;
  advisorId: string;
  sender: "student" | "advisor";
  senderName: string;
  content: string;
  timestamp: string;
  messageType?: string;
  isRead?: boolean;
}

export interface BookingAppointment {
  id: string;
  advisorId: string;
  advisorName: string;
  subject: string;
  timeSlot: string;
  meetingType: "OFFICE" | "ONLINE";
  notes?: string;
  status: AppointmentStatus;
  createdAt: string;
  location: string;
}

export interface ActionPlanTask {
  id: string;
  advisorId: string;
  title: string;
  description?: string;
  deadline: string;
  priority: "HIGH" | "MEDIUM" | "NORMAL";
  completed: boolean;
}

// ==========================================
// Helper Utilities
// ==========================================

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getDepartmentByCode(courseCode: string): string {
  const code = courseCode.toUpperCase();
  if (code.startsWith("CO")) {
    if (code.includes("2007") || code.includes("2009")) {
      return "Bộ môn Kỹ thuật Máy tính";
    }
    if (code.includes("2017") || code.includes("3011")) {
      return "Bộ môn Hệ thống & Mạng Máy tính";
    }
    if (code.includes("2013") || code.includes("3021")) {
      return "Bộ môn Hệ thống Thông tin";
    }
    return "Khoa Khoa học & Kỹ thuật Máy tính";
  }
  if (code.startsWith("MT")) {
    return "Bộ môn Toán Ứng dụng - Khoa Khoa học Ứng dụng";
  }
  if (code.startsWith("PH")) {
    return "Bộ môn Vật lý Ứng dụng - Khoa Khoa học Ứng dụng";
  }
  if (code.startsWith("EN") || code.startsWith("LA")) return "Khoa Ngoại ngữ";
  return "Khoa Khoa học & Kỹ thuật Máy tính";
}

function getOfficeLocation(courseCode: string): string {
  const code = courseCode.toUpperCase();
  if (code.startsWith("CO")) {
    if (code.includes("2007")) return "P.503 Nhà H6, Cơ sở Dĩ An";
    if (code.includes("2017")) return "P.502 Nhà H6, Cơ sở Dĩ An";
    return "P.304 Nhà H6, Cơ sở Dĩ An";
  }
  if (code.startsWith("MT")) return "P.201 Nhà B4, Cơ sở 1 Lý Thường Kiệt";
  if (code.startsWith("PH")) return "P.104 Nhà B3, Cơ sở 1 Lý Thường Kiệt";
  return "P.304 Nhà H6, Cơ sở Dĩ An";
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { detail?: unknown } } }).response
      ?.data?.detail === "string"
  ) {
    return (err as { response: { data: { detail: string } } }).response.data
      .detail;
  }
  return fallback;
}

// ==========================================
// Main Component
// ==========================================

export const StudentAdvisingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: user } = useAuthUser();
  const studentId = user?.user_code || user?.id || "";
  const { data: activeSemester } = useActiveSemester();
  const activeSemesterCode = activeSemester?.semester_code || "HK261";
  const activeSemesterLabel = formatSemesterLabel(activeSemesterCode);

  // Data fetching
  const { data: currentCourses, isLoading: isLoadingCourses } =
    useStudentCurrentCourses(studentId);
  const { data: predictions, isLoading: isLoadingPreds } =
    useStudentPredictions(studentId, activeSemesterCode);
  const { data: studentDetail } = useStudentDetail(studentId);
  const { data: studentSummary } = useStudentSummary(studentId);

  // Active Tab derived from URL search params (so clicking notifications updates tab immediately)
  const tabParam = searchParams.get("tab");
  const activeTab: AdvisingTab =
    tabParam === "booking" || tabParam === "action-plan" ? tabParam : "feed";

  // Search keyword in directory
  const [searchQuery, setSearchQuery] = useState("");

  // Build predictions lookup map
  const predMap = useMemo(() => {
    const map = new Map<
      string,
      { risk_level: "HIGH" | "MEDIUM" | "LOW"; fail_prob: number }
    >();
    if (predictions?.courses) {
      for (const item of predictions.courses) {
        map.set(item.course_code.toUpperCase(), {
          risk_level: (item.risk_level as "HIGH" | "MEDIUM" | "LOW") || "LOW",
          fail_prob: Number(item.fail_probability ?? 0),
        });
      }
    }
    return map;
  }, [predictions]);

  // Build directory list: Course Lecturers from API + Faculty Office Contact
  const advisors = useMemo<AdvisorDirectoryItem[]>(() => {
    const list: AdvisorDirectoryItem[] = [];

    // 1. Active Course Lecturers from API
    const validCourses = (currentCourses ?? []).filter((c) => {
      const code = c.course_code.toUpperCase();
      return (
        !code.startsWith("CC") &&
        !code.startsWith("TN") &&
        !code.startsWith("QP")
      );
    });

    for (const course of validCourses) {
      const pred = predMap.get(course.course_code.toUpperCase());
      const lecturerName =
        course.lecturer_name?.trim() || "Thầy/Cô Phụ trách Môn";
      const emailSlug = lecturerName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      list.push({
        id: `course-${course.course_code}`,
        isFacultyAdvisor: false,
        lecturerId: course.lecturer_id || undefined,
        name:
          lecturerName.startsWith("TS.") ||
          lecturerName.startsWith("ThS.") ||
          lecturerName.startsWith("PGS.")
            ? lecturerName
            : `GV. ${lecturerName}`,
        title: `Giảng viên phụ trách môn ${course.course_code}`,
        department: getDepartmentByCode(course.course_code),
        courseCode: course.course_code,
        courseName: course.course_name,
        classGroup: course.class_group || undefined,
        credits: Number(course.credits) || 3,
        office: getOfficeLocation(course.course_code),
        email: `${emailSlug || "giangvien"}@hcmut.edu.vn`,
        phone: "(028) 3864 7256 - Văn phòng Bộ môn",
        officeHours: "Thứ Ba & Thứ Sáu: 14:00 - 16:30",
        availableSlots: [
          "Thứ Ba: 14:00 - 15:00 (Trực tiếp tại Bộ môn)",
          "Thứ Ba: 15:30 - 16:30 (Trực tiếp tại Bộ môn)",
          "Thứ Sáu: 14:00 - 15:00 (Online Google Meet)",
        ],
        riskLevel: pred?.risk_level,
        failProbability: pred?.fail_prob,
      });
    }

    // 2. Institutional Faculty Academic Advising Office (Contact Reference)
    const advisorMajor = studentDetail?.major || "Khoa học Máy tính";
    list.push({
      id: "advisor-faculty",
      isFacultyAdvisor: true,
      name: "Văn phòng Cố vấn Học vụ Khoa",
      title: `Cố vấn Học tập Chuyên ngành ${advisorMajor}`,
      department: "Văn phòng Cố vấn Học vụ - Khoa KH&KT Máy tính",
      office: "P.304 Nhà H6, Cơ sở Dĩ An",
      email: "covanhoctap.cse@hcmut.edu.vn",
      phone: "(028) 3864 7256 - Ext: 5842",
      officeHours: "Thứ Hai & Thứ Năm: 08:30 - 11:30",
      availableSlots: [
        "Thứ Hai: 08:30 - 09:30 (Trực tiếp P.304 H6)",
        "Thứ Năm: 08:30 - 09:30 (Trực tiếp P.304 H6)",
      ],
    });

    return list;
  }, [studentDetail, currentCourses, predMap]);

  // Filtered advisors list based on search query
  const filteredAdvisors = useMemo(() => {
    if (!searchQuery.trim()) return advisors;
    const q = searchQuery.toLowerCase().trim();
    return advisors.filter(
      (adv) =>
        adv.name.toLowerCase().includes(q) ||
        adv.title.toLowerCase().includes(q) ||
        (adv.courseCode && adv.courseCode.toLowerCase().includes(q)) ||
        (adv.courseName && adv.courseName.toLowerCase().includes(q)),
    );
  }, [advisors, searchQuery]);

  // Active selected advisor derived from ?course= / ?advisor= URL params
  const courseParam = searchParams.get("course");
  const advisorParam = searchParams.get("advisor");

  const selectedAdvisor = useMemo(() => {
    if (advisorParam) {
      const found = advisors.find((a) => a.id === advisorParam);
      if (found) return found;
    }
    if (courseParam) {
      const found = advisors.find(
        (a) => a.courseCode?.toUpperCase() === courseParam.toUpperCase(),
      );
      if (found) return found;
    }
    return advisors[0];
  }, [advisors, advisorParam, courseParam]);

  // Sync tab change with URL search params
  const handleTabChange = (tab: AdvisingTab) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("tab", tab);
      return p;
    });
  };

  // ==========================================
  // Backend Advising Sessions & Queries
  // ==========================================
  const { data: serverSessions } = useAdvisingSessions(Boolean(studentId));
  const createOrGetSessionMutation = useCreateOrGetAdvisingSession();
  const markSessionReadMutation = useMarkSessionRead();

  const handleSelectAdvisor = (advisorId: string) => {
    setCustomSlot(null);
    const chosen = advisors.find((a) => a.id === advisorId);
    if (chosen?.courseCode && serverSessions) {
      const matched = serverSessions.find(
        (s) => s.course_code === chosen.courseCode,
      );
      if (matched && matched.unread_count > 0) {
        markSessionReadMutation.mutate(matched.id);
      }
    }
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (chosen?.courseCode) {
        p.set("course", chosen.courseCode);
        p.delete("advisor");
      } else {
        p.set("advisor", advisorId);
        p.delete("course");
      }
      return p;
    });
  };

  // Map unread counts by course_code for left directory badges
  const unreadByCourse = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of serverSessions ?? []) {
      if (s.unread_count > 0) {
        map.set(s.course_code, (map.get(s.course_code) ?? 0) + s.unread_count);
      }
    }
    return map;
  }, [serverSessions]);

  // Strictly match selected course's session (NEVER fallback to serverSessions[0])
  const selectedCourseCode = selectedAdvisor.courseCode;
  const activeSession = useMemo(() => {
    if (!serverSessions || serverSessions.length === 0 || !selectedCourseCode) {
      return null;
    }
    return (
      serverSessions.find(
        (s) =>
          s.course_code === selectedCourseCode &&
          s.semester_code === activeSemesterCode,
      ) ??
      serverSessions.find((s) => s.course_code === selectedCourseCode) ??
      null
    );
  }, [serverSessions, selectedCourseCode, activeSemesterCode]);

  const activeSessionId = activeSession?.id;

  // Real-time Messages from Backend (GET uses mark_read=false so polling never wipes unread state)
  const { data: serverMessages, isLoading: isLoadingMessages } =
    useSessionMessages(activeSessionId, 50, 0, activeTab === "feed");
  const sendMessageMutation = useSendMessage(activeSessionId);

  // Real-time Appointments from Backend
  const { data: serverAppointments, isLoading: isLoadingAppointments } =
    useSessionAppointments(activeSessionId);
  const createAppointmentMutation = useCreateAppointment(activeSessionId);
  const updateAppointmentStatusMutation =
    useUpdateAppointmentStatus(activeSessionId);

  // Real-time Tasks from Backend
  const { data: serverTasks, isLoading: isLoadingTasks } =
    useSessionTasks(activeSessionId);
  const toggleTaskMutation = useToggleTask(activeSessionId);

  const canCreateSession = Boolean(
    selectedAdvisor && !selectedAdvisor.isFacultyAdvisor && selectedAdvisor.courseCode,
  );

  // Helper to ensure an advising session exists in DB for the selected course
  const ensureSessionId = async (): Promise<string | null> => {
    if (!studentId || !selectedAdvisor?.courseCode || selectedAdvisor.isFacultyAdvisor) {
      toast.info(
        "Vui lòng chọn một giảng viên môn học cụ thể để gửi trao đổi hoặc đặt lịch trực tuyến.",
      );
      return null;
    }
    if (activeSessionId) return activeSessionId;

    const created = await createOrGetSessionMutation.mutateAsync({
      student_id: studentId,
      course_code: selectedAdvisor.courseCode,
      semester_code: activeSemesterCode,
      topic: `Cố vấn học vụ môn ${selectedAdvisor.courseCode}`,
      risk_level:
        selectedAdvisor.riskLevel === "HIGH"
          ? "CRITICAL"
          : selectedAdvisor.riskLevel === "MEDIUM"
            ? "WARNING"
            : "SAFE",
      lecturer_id: selectedAdvisor.lecturerId,
    });
    return created.id;
  };

  // ==========================================
  // Tab 1: Direct Messages
  // ==========================================
  const [chatInput, setChatInput] = useState("");

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? chatInput).trim();
    if (!content) return;

    try {
      const targetSessionId = await ensureSessionId();
      if (!targetSessionId) return;

      await sendMessageMutation.mutateAsync({
        sessionId: targetSessionId,
        payload: {
          content,
          message_type: "REPLY",
        },
      });
      if ((activeSession?.unread_count ?? 0) > 0) {
        markSessionReadMutation.mutate(targetSessionId);
      }
      if (!textToSend) setChatInput("");
      toast.success("Đã gửi tin nhắn tới Thầy/Cô thành công!");
    } catch (err) {
      toast.error(
        extractErrorMessage(
          err,
          "Không thể gửi tin nhắn. Vui lòng kiểm tra kết nối máy chủ và thử lại.",
        ),
      );
    }
  };

  const handleQuickRequest = (
    type: "materials" | "midterm_review" | "study_group",
  ) => {
    if (!selectedAdvisor?.courseCode) {
      toast.info("Vui lòng chọn một môn học cụ thể để gửi yêu cầu nhanh.");
      return;
    }
    let text = "";
    if (type === "materials") {
      text = `Dạ kính chào Thầy/Cô, em xin phép nhờ Thầy/Cô chia sẻ thêm tài liệu và bộ câu hỏi bài tập ôn tập bổ trợ cho môn ${selectedAdvisor.courseCode} với ạ. Em xin cảm ơn!`;
    } else if (type === "midterm_review") {
      text = `Dạ kính chào Thầy/Cô, em muốn xin giải đáp thắc mắc và xem lại bài thi giữa kỳ môn ${selectedAdvisor.courseCode} để nắm rõ phần kiến thức em còn làm sai ạ.`;
    } else {
      text = `Dạ kính chào Thầy/Cô, em muốn nhờ hỗ trợ kết nối em vào nhóm học tập (Study Group) của môn ${selectedAdvisor.courseCode} để cùng ôn bài ạ.`;
    }
    void handleSendMessage(text);
  };

  const currentAdvisorMessages = useMemo<DirectMessage[]>(() => {
    if (!activeSessionId || !serverMessages) return [];
    return serverMessages.map((m) => ({
      id: m.id,
      advisorId: selectedAdvisor.id,
      sender:
        m.sender_role.toLowerCase() === "student" ? "student" : "advisor",
      senderName: m.sender_name,
      content: m.content,
      timestamp: new Date(m.created_at).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      messageType: m.message_type,
      isRead: m.is_read,
    }));
  }, [activeSessionId, serverMessages, selectedAdvisor.id]);

  // ==========================================
  // Tab 2: Office Hours Booking
  // ==========================================
  const [selectedReason, setSelectedReason] = useState<string>(
    "Hỏi bài chưa hiểu / giải đáp chuyên môn",
  );
  const [customSlot, setCustomSlot] = useState<string | null>(null);
  const selectedSlot =
    customSlot ||
    selectedAdvisor.availableSlots[0] ||
    "Thứ Ba: 14:00 - 15:00";
  const [meetingType, setMeetingType] = useState<"OFFICE" | "ONLINE">("OFFICE");
  const [bookingNotes, setBookingNotes] = useState("");

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const targetSessionId = await ensureSessionId();
      if (!targetSessionId) return;

      const location =
        meetingType === "OFFICE"
          ? selectedAdvisor.office
          : "Google Meet (Sẽ gửi link qua email sinh viên)";

      await createAppointmentMutation.mutateAsync({
        sessionId: targetSessionId,
        payload: {
          subject: selectedReason,
          time_slot: selectedSlot,
          meeting_type: meetingType,
          location,
          notes: bookingNotes.trim() || null,
        },
      });

      setBookingNotes("");
      setCustomSlot(null);
      toast.success("Phiếu hẹn tư vấn đã được gửi thành công!", {
        description: `Lịch hẹn với ${selectedAdvisor.name} đang ở trạng thái Chờ duyệt.`,
      });
    } catch (err) {
      toast.error(
        extractErrorMessage(
          err,
          "Không thể gửi phiếu hẹn tư vấn. Vui lòng thử lại sau.",
        ),
      );
    }
  };

  const currentAppointments = useMemo<BookingAppointment[]>(() => {
    if (!activeSessionId || !serverAppointments) return [];
    return serverAppointments.map((a) => ({
      id: a.id,
      advisorId: selectedAdvisor.id,
      advisorName: selectedAdvisor.name,
      subject: a.subject,
      timeSlot: a.time_slot,
      meetingType: a.meeting_type,
      notes: a.notes || undefined,
      status: a.status,
      createdAt: new Date(a.created_at).toLocaleDateString("vi-VN"),
      location: a.location,
    }));
  }, [activeSessionId, serverAppointments, selectedAdvisor.id, selectedAdvisor.name]);

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!activeSessionId) return;
    try {
      await updateAppointmentStatusMutation.mutateAsync({
        sessionId: activeSessionId,
        appointmentId,
        payload: { status: "CANCELLED" },
      });
      toast.info("Đã hủy lịch hẹn tư vấn.");
    } catch (err) {
      toast.error(
        extractErrorMessage(
          err,
          "Không thể hủy lịch hẹn lúc này. Vui lòng thử lại.",
        ),
      );
    }
  };

  // ==========================================
  // Tab 3: Action Plan Tasks
  // ==========================================
  const currentAdvisorTasks = useMemo<ActionPlanTask[]>(() => {
    if (!activeSessionId || !serverTasks) return [];
    return serverTasks.map((t) => ({
      id: t.id,
      advisorId: selectedAdvisor.id,
      title: t.title,
      description: t.description || undefined,
      deadline: t.deadline,
      priority: t.priority,
      completed: t.completed,
    }));
  }, [activeSessionId, serverTasks, selectedAdvisor.id]);

  const handleToggleTask = async (taskId: string) => {
    if (!activeSessionId) return;
    const task = currentAdvisorTasks.find((t) => t.id === taskId);
    if (!task) return;
    const nextCompleted = !task.completed;

    try {
      await toggleTaskMutation.mutateAsync({
        sessionId: activeSessionId,
        taskId,
        payload: { completed: nextCompleted },
      });
    } catch (err) {
      toast.error(
        extractErrorMessage(
          err,
          "Không thể cập nhật trạng thái nhiệm vụ. Vui lòng thử lại.",
        ),
      );
    }
  };

  const taskCompletionRate = useMemo(() => {
    if (currentAdvisorTasks.length === 0) return 0;
    const done = currentAdvisorTasks.filter((t) => t.completed).length;
    return Math.round((done / currentAdvisorTasks.length) * 100);
  }, [currentAdvisorTasks]);

  const isLoading = isLoadingCourses || isLoadingPreds;
  const isSending =
    createOrGetSessionMutation.isPending || sendMessageMutation.isPending;
  const isSubmittingBooking =
    createOrGetSessionMutation.isPending || createAppointmentMutation.isPending;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Cố vấn Học vụ & Hướng dẫn Môn học
            </h1>
            <Badge className="bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-2xs">
              <Sparkles className="mr-1 h-3 w-3" />
              {activeSemesterLabel} Hub
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Kênh trao đổi trực tiếp với Giảng viên phụ trách các môn học đang
            theo học kỳ này và Văn phòng Cố vấn học vụ khoa.
          </p>
        </div>

        {/* Quick Academic Standing Overview Badge */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs"
          >
            <UserCheck className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
            <span>MSSV: {studentId || "—"}</span>
          </Badge>
          <Badge
            variant="outline"
            className="border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs"
          >
            <GraduationCap className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            <span>
              GPA:{" "}
              {studentSummary?.cumulative_gpa !== undefined
                ? `${studentSummary.cumulative_gpa.toFixed(2)}/4.0`
                : "—"}
            </span>
          </Badge>
        </div>
      </div>

      {/* 2. Main Two-Column Layout (1/3 Left, 2/3 Right) */}
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT COLUMN: Advisors & Lecturers Directory (4/12 cols) */}
        <div className="col-span-12 space-y-4 lg:col-span-4">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Danh bạ Thầy / Cô
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Giảng viên môn học & Văn phòng Cố vấn
                  </CardDescription>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[11px] font-semibold text-slate-600"
                >
                  {advisors.length} Mục
                </Badge>
              </div>

              {/* Search Bar */}
              <div className="relative mt-3">
                <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Tìm theo tên Thầy/Cô hoặc môn..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-slate-50/60 border-slate-200 focus-visible:ring-blue-500"
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-2 p-3 pt-0 max-h-160 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-2.5 py-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"
                    >
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredAdvisors.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-500">
                    Không tìm thấy giảng viên phù hợp.
                  </p>
                </div>
              ) : (
                filteredAdvisors.map((advisor) => {
                  const isSelected = selectedAdvisor.id === advisor.id;
                  const isRisk =
                    advisor.riskLevel === "HIGH" ||
                    advisor.riskLevel === "MEDIUM";
                  const unreadCount = advisor.courseCode
                    ? (unreadByCourse.get(advisor.courseCode) ?? 0)
                    : 0;

                  return (
                    <div
                      key={advisor.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectAdvisor(advisor.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectAdvisor(advisor.id);
                        }
                      }}
                      className={cn(
                        "group relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 transition-all text-left",
                        isSelected
                          ? "border-blue-500 bg-blue-50/40 ring-2 ring-blue-500 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs",
                      )}
                    >
                      {/* Top Row: Avatar & Basic Info */}
                      <div className="flex items-start gap-3">
                        <Avatar
                          className={cn(
                            "h-10 w-10 ring-1",
                            advisor.isFacultyAdvisor
                              ? "border-blue-200 ring-blue-400/30"
                              : "border-slate-200 ring-slate-300",
                          )}
                        >
                          <AvatarFallback
                            className={cn(
                              "text-xs font-bold",
                              advisor.isFacultyAdvisor
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-white",
                            )}
                          >
                            {getInitials(advisor.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate text-xs font-bold text-slate-900 group-hover:text-blue-600">
                              {advisor.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {unreadCount > 0 && (
                                <Badge className="bg-rose-600 px-1.5 py-0 text-[10px] font-bold text-white">
                                  {unreadCount} mới
                                </Badge>
                              )}
                              {advisor.isFacultyAdvisor ? (
                                <Badge className="bg-blue-100 text-[10px] font-semibold text-blue-700 hover:bg-blue-100">
                                  Văn phòng Khoa
                                </Badge>
                              ) : (
                                advisor.courseCode && (
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[10px] font-bold text-slate-700 border-slate-200"
                                  >
                                    {advisor.courseCode}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>

                          <p className="mt-0.5 truncate text-[11px] text-slate-600 font-medium">
                            {advisor.courseName || advisor.department}
                          </p>
                        </div>
                      </div>

                      {/* Course specific metadata or Advisor hours */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {advisor.office.split(",")[0]}
                          </span>
                        </span>

                        {isRisk && (
                          <Badge
                            className={cn(
                              "text-[10px] font-semibold shrink-0 gap-1",
                              advisor.riskLevel === "HIGH"
                                ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200"
                                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200",
                            )}
                          >
                            <Info className="h-2.5 w-2.5" />
                            {advisor.riskLevel === "HIGH"
                              ? "Cần hỗ trợ"
                              : "Cần theo dõi"}
                          </Badge>
                        )}
                        {!isRisk &&
                          !advisor.isFacultyAdvisor &&
                          advisor.riskLevel === "LOW" && (
                            <Badge className="bg-emerald-100 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 shrink-0 gap-1">
                              <ShieldCheck className="h-2.5 w-2.5" />
                              An toàn
                            </Badge>
                          )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Quick Help Box */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 h-4 w-4 text-blue-600 shrink-0" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-blue-900">
                  Hướng dẫn Tư vấn Học vụ
                </h4>
                <p className="text-[11px] leading-relaxed text-blue-800/80">
                  Chọn Giảng viên phụ trách môn học ở danh bạ để trao đổi trực
                  tiếp, đặt lịch tiếp sinh viên (Office Hours) hoặc theo dõi
                  nhiệm vụ cải thiện được giao.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Workspace (8/12 cols) */}
        <div className="col-span-12 space-y-5 lg:col-span-8">
          {/* Active Advisor Profile Header Card */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3.5">
                  <Avatar className="h-12 w-12 border border-blue-200 ring-2 ring-blue-500/20 shadow-2xs">
                    <AvatarFallback className="bg-slate-900 text-sm font-bold text-white">
                      {getInitials(selectedAdvisor.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        {selectedAdvisor.name}
                      </h2>
                      {selectedAdvisor.isFacultyAdvisor ? (
                        <Badge className="bg-blue-600 text-xs font-semibold text-white">
                          Văn phòng Khoa
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700"
                        >
                          {selectedAdvisor.courseCode} •{" "}
                          {selectedAdvisor.credits} Tín chỉ
                        </Badge>
                      )}
                      {selectedAdvisor.riskLevel === "HIGH" && (
                        <Badge className="bg-rose-50 text-rose-700 text-xs font-semibold border-rose-200">
                          <Info className="mr-1 h-3 w-3 text-rose-600" />
                          Đề xuất tư vấn môn học (Dự báo rủi ro{" "}
                          {Math.round(
                            (selectedAdvisor.failProbability ?? 0) * 100,
                          )}
                          %)
                        </Badge>
                      )}
                    </div>

                    <p className="mt-0.5 text-xs font-medium text-slate-600">
                      {selectedAdvisor.title} — {selectedAdvisor.department}
                    </p>

                    {/* Quick Contacts */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium text-slate-800">
                          {selectedAdvisor.office}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <a
                          href={`mailto:${selectedAdvisor.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {selectedAdvisor.email}
                        </a>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{selectedAdvisor.phone}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{selectedAdvisor.officeHours}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {canCreateSession ? (
                  <Button
                    size="sm"
                    onClick={() => handleTabChange("booking")}
                    className="bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer shadow-2xs shrink-0"
                  >
                    <Calendar className="mr-1.5 h-3.5 w-3.5" />
                    Đặt lịch gặp Thầy/Cô
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.open(`mailto:${selectedAdvisor.email}`, "_self");
                    }}
                    className="text-xs font-semibold cursor-pointer shrink-0"
                  >
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    Gửi Email Văn phòng
                  </Button>
                )}
              </div>

              {/* 3 Navigation Tabs */}
              <div className="mt-5 flex border-b border-slate-200 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => handleTabChange("feed")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer shrink-0",
                    activeTab === "feed"
                      ? "border-blue-600 text-blue-600 bg-blue-50/30"
                      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Hộp thư Trao đổi</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-semibold ml-1"
                  >
                    {currentAdvisorMessages.length}
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("booking")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer shrink-0",
                    activeTab === "booking"
                      ? "border-blue-600 text-blue-600 bg-blue-50/30"
                      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
                  )}
                >
                  <CalendarCheck className="h-4 w-4" />
                  <span>Đặt lịch Office Hours</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-semibold ml-1"
                  >
                    {currentAppointments.length}
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("action-plan")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer shrink-0",
                    activeTab === "action-plan"
                      ? "border-blue-600 text-blue-600 bg-blue-50/30"
                      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
                  )}
                >
                  <ListTodo className="h-4 w-4" />
                  <span>Kế hoạch Hành động</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-semibold ml-1"
                  >
                    {currentAdvisorTasks.filter((t) => !t.completed).length} việc
                  </Badge>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Informational Banner for Faculty Office (no course session) */}
          {!canCreateSession && (
            <Card className="border-blue-200 bg-blue-50/40 shadow-xs">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 text-blue-600 shrink-0" />
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-slate-900">
                      Thông tin Liên hệ Văn phòng Cố vấn Học vụ Khoa
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-700">
                      Các phiên trao đổi trực tuyến, đặt lịch hẹn và giao nhiệm
                      vụ trong hệ thống được gắn trực tiếp với từng học phần bạn
                      đang đăng ký học trong kỳ{" "}
                      <strong>{activeSemesterLabel}</strong>. Để được hỗ trợ các
                      vấn đề học vụ chung (bảo lưu, cảnh cáo học vụ, xét tốt
                      nghiệp), vui lòng liên hệ trực tiếp tại{" "}
                      <strong>{selectedAdvisor.office}</strong> trong khung giờ{" "}
                      <strong>{selectedAdvisor.officeHours}</strong> hoặc qua
                      email{" "}
                      <a
                        href={`mailto:${selectedAdvisor.email}`}
                        className="font-semibold text-blue-700 underline"
                      >
                        {selectedAdvisor.email}
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 1: Hộp thư Trao đổi Trực tiếp */}
          {canCreateSession && activeTab === "feed" && (
            <div className="space-y-5">
              {/* Course Office Hours Notice */}
              <Card className="border-blue-200 bg-blue-50/20 shadow-xs">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-[10px] font-semibold text-blue-700 hover:bg-blue-100">
                          Office Hours
                        </Badge>
                        <h4 className="text-xs font-bold text-slate-900">
                          Lịch tiếp sinh viên môn {selectedAdvisor.courseCode}
                        </h4>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-700 pt-1">
                        {selectedAdvisor.name} tiếp sinh viên tại{" "}
                        <strong>{selectedAdvisor.office}</strong> vào khung giờ{" "}
                        <strong>{selectedAdvisor.officeHours}</strong>. Sinh
                        viên có câu hỏi chuyên môn hoặc cần trao đổi điểm số vui
                        lòng nhắn tin trực tiếp bên dưới hoặc đặt lịch hẹn.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Requests Bar */}
              <Card className="border-slate-200 bg-slate-50/70 shadow-2xs">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-blue-600" />
                    <CardTitle className="text-xs font-bold text-slate-900">
                      Gửi Yêu cầu Hỗ trợ Nhanh (Quick Requests)
                    </CardTitle>
                  </div>
                  <CardDescription className="text-[11px] text-slate-500">
                    Bấm để gửi yêu cầu mẫu trực tiếp tới {selectedAdvisor.name}:
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-1">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSending}
                      onClick={() => handleQuickRequest("materials")}
                      className="cursor-pointer bg-white text-xs font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700 shadow-2xs gap-1.5 h-8"
                    >
                      <span>📚</span>
                      <span>Xin tài liệu / Bài tập ôn tập bổ trợ</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSending}
                      onClick={() => handleQuickRequest("midterm_review")}
                      className="cursor-pointer bg-white text-xs font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700 shadow-2xs gap-1.5 h-8"
                    >
                      <span>📝</span>
                      <span>Xin giải đáp thắc mắc bài thi giữa kỳ</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSending}
                      onClick={() => handleQuickRequest("study_group")}
                      className="cursor-pointer bg-white text-xs font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700 shadow-2xs gap-1.5 h-8"
                    >
                      <span>👥</span>
                      <span>Nhờ kết nối nhóm học tập (Study Group)</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Direct Conversation Thread */}
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="p-4 pb-2 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                      <CardTitle className="text-sm font-bold text-slate-900">
                        Hộp thư Trao đổi Trực tiếp
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeSessionId && (activeSession?.unread_count ?? 0) > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={markSessionReadMutation.isPending}
                          onClick={() => markSessionReadMutation.mutate(activeSessionId)}
                          className="h-7 border-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer gap-1"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          <span>
                            Đánh dấu đã đọc ({activeSession?.unread_count} mới)
                          </span>
                        </Button>
                      )}
                      <span className="text-[11px] text-slate-400">
                        Đối thoại với {selectedAdvisor.name}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Messages Feed */}
                  <div className="space-y-3 min-h-48 max-h-96 overflow-y-auto pr-1">
                    {isLoadingMessages ? (
                      <div className="space-y-3 py-2">
                        <Skeleton className="h-12 w-3/4 rounded-xl" />
                        <Skeleton className="ml-auto h-12 w-2/3 rounded-xl" />
                      </div>
                    ) : currentAdvisorMessages.length === 0 ? (
                      <div className="py-8 text-center">
                        <MessageSquare className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                        <p className="text-xs text-slate-500 font-medium">
                          Chưa có tin nhắn nào cho môn{" "}
                          {selectedAdvisor.courseCode}.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Em có thể chọn một Yêu cầu Nhanh ở trên hoặc nhập câu
                          hỏi bên dưới để bắt đầu phiên cố vấn.
                        </p>
                      </div>
                    ) : (
                      currentAdvisorMessages.map((msg) => {
                        const isStudent = msg.sender === "student";

                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex gap-2.5 max-w-[85%]",
                              isStudent
                                ? "ml-auto flex-row-reverse"
                                : "mr-auto",
                            )}
                          >
                            <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                              <AvatarFallback
                                className={cn(
                                  "text-[10px] font-bold text-white",
                                  isStudent ? "bg-blue-600" : "bg-slate-800",
                                )}
                              >
                                {getInitials(msg.senderName)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="space-y-1">
                              <div
                                className={cn(
                                  "rounded-2xl px-3.5 py-2 text-xs leading-relaxed",
                                  isStudent
                                    ? "bg-blue-600 text-white rounded-tr-xs"
                                    : "bg-slate-100 text-slate-900 rounded-tl-xs",
                                )}
                              >
                                <p className="whitespace-pre-wrap">
                                  {msg.content}
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "text-[10px] text-slate-400 px-1",
                                  isStudent ? "text-right" : "text-left",
                                )}
                              >
                                {msg.senderName} • {msg.timestamp}
                                {isStudent && (
                                  <span
                                    className={cn(
                                      "ml-1.5 font-medium",
                                      msg.isRead
                                        ? "text-emerald-600"
                                        : "text-slate-400",
                                    )}
                                  >
                                    • {msg.isRead ? "GV đã xem" : "Đã gửi"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Message Input Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSendMessage();
                    }}
                    className="flex items-center gap-2 pt-2 border-t border-slate-100"
                  >
                    <Input
                      type="text"
                      placeholder={`Nhập tin nhắn / câu hỏi gửi tới ${selectedAdvisor.name}...`}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isSending}
                      className="h-10 text-xs border-slate-200 focus-visible:ring-blue-500"
                    />
                    <Button
                      type="submit"
                      disabled={!chatInput.trim() || isSending}
                      className="h-10 bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer shadow-2xs shrink-0"
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      {isSending ? "Đang gửi..." : "Gửi tin"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: Office Hours Booking */}
          {canCreateSession && activeTab === "booking" && (
            <div className="space-y-5">
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      Phiếu Đăng ký Hẹn gặp Tư vấn
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Đặt lịch tư vấn học vụ hoặc giải đáp chuyên môn trực tiếp
                    với {selectedAdvisor.name} ({selectedAdvisor.courseCode}).
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-0">
                  <form onSubmit={handleCreateBooking} className="space-y-4">
                    {/* Reason Selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">
                        1. Mục đích hẹn gặp{" "}
                        <span className="text-blue-600">*</span>
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {[
                          {
                            id: "r1",
                            label: "Hỏi bài chưa hiểu / giải đáp chuyên môn",
                            icon: BookOpen,
                          },
                          {
                            id: "r2",
                            label: "Xin hướng dẫn bài tập lớn / đồ án",
                            icon: Sparkles,
                          },
                          {
                            id: "r3",
                            label: "Tư vấn phương án gỡ điểm rớt môn",
                            icon: TrendingDown,
                          },
                          {
                            id: "r4",
                            label: "Tư vấn lộ trình & đăng ký môn kỳ sau",
                            icon: GraduationCap,
                          },
                        ].map((item) => (
                          <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedReason(item.label)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedReason(item.label);
                              }
                            }}
                            className={cn(
                              "flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-xs font-medium transition-all text-left",
                              selectedReason === item.label
                                ? "border-blue-500 bg-blue-50/50 text-blue-800 ring-1 ring-blue-500"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                            )}
                          >
                            <item.icon className="h-4 w-4 text-blue-600 shrink-0" />
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Time Slot Selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">
                        2. Chọn Khung giờ tiếp sinh viên{" "}
                        <span className="text-blue-600">*</span>
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {selectedAdvisor.availableSlots.map((slot) => (
                          <div
                            key={slot}
                            role="button"
                            tabIndex={0}
                            onClick={() => setCustomSlot(slot)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setCustomSlot(slot);
                              }
                            }}
                            className={cn(
                              "flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-xs transition-all text-left",
                              selectedSlot === slot
                                ? "border-blue-500 bg-blue-50/50 text-blue-900 font-semibold ring-1 ring-blue-500"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 font-medium",
                            )}
                          >
                            <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                            <span>{slot}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Meeting Mode Selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">
                        3. Hình thức gặp mặt
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => setMeetingType("OFFICE")}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium cursor-pointer transition-all",
                            meetingType === "OFFICE"
                              ? "border-blue-500 bg-blue-50/50 text-blue-800 ring-1 ring-blue-500 font-semibold"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                          )}
                        >
                          <Building2 className="h-4 w-4 text-slate-500" />
                          <span>
                            Gặp trực tiếp ({selectedAdvisor.office.split(",")[0]})
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMeetingType("ONLINE")}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium cursor-pointer transition-all",
                            meetingType === "ONLINE"
                              ? "border-blue-500 bg-blue-50/50 text-blue-800 ring-1 ring-blue-500 font-semibold"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                          )}
                        >
                          <Video className="h-4 w-4 text-slate-500" />
                          <span>Gặp Trực tuyến (Google Meet)</span>
                        </button>
                      </div>
                    </div>

                    {/* Notes & Pre-work Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        4. Nội dung cần chuẩn bị trước / Ghi chú (Tùy chọn)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Ví dụ: Em muốn hỏi về phần bài tập chương 4 và xin định hướng làm bài tập lớn..."
                        value={bookingNotes}
                        onChange={(e) => setBookingNotes(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={isSubmittingBooking}
                        className="bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer shadow-2xs px-5 h-9"
                      >
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        {isSubmittingBooking
                          ? "Đang gửi phiếu hẹn..."
                          : "Gửi Phiếu Hẹn Tư Vấn"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Scheduled Appointments History */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Lịch Hẹn Đã Đăng Ký ({currentAppointments.length})
                </h3>

                {isLoadingAppointments ? (
                  <div className="space-y-2.5">
                    <Skeleton className="h-20 w-full rounded-xl" />
                  </div>
                ) : currentAppointments.length === 0 ? (
                  <Card className="border-slate-200 bg-white p-6 text-center shadow-xs">
                    <p className="text-xs text-slate-500">
                      Chưa có phiếu hẹn nào cho môn {selectedAdvisor.courseCode}.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-2.5">
                    {currentAppointments.map((apt) => (
                      <Card
                        key={apt.id}
                        className="border-slate-200 bg-white shadow-xs"
                      >
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">
                                  {apt.subject}
                                </span>
                                {apt.status === "CONFIRMED" && (
                                  <Badge className="bg-emerald-100 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                                    <CheckCircle2 className="mr-1 h-3 w-3" /> Đã
                                    xác nhận
                                  </Badge>
                                )}
                                {apt.status === "PENDING" && (
                                  <Badge className="bg-amber-100 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 border-amber-200">
                                    <Clock className="mr-1 h-3 w-3" /> Đang chờ
                                    duyệt
                                  </Badge>
                                )}
                                {apt.status === "COMPLETED" && (
                                  <Badge className="bg-blue-100 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 border-blue-200">
                                    <CheckCircle2 className="mr-1 h-3 w-3" /> Đã
                                    hoàn thành
                                  </Badge>
                                )}
                                {apt.status === "CANCELLED" && (
                                  <Badge className="bg-slate-100 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 border-slate-200">
                                    <XCircle className="mr-1 h-3 w-3" /> Đã hủy
                                  </Badge>
                                )}
                              </div>

                              <p className="text-xs font-medium text-slate-600">
                                Với Thầy/Cô:{" "}
                                <span className="font-semibold text-slate-900">
                                  {apt.advisorName}
                                </span>
                              </p>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-500">
                                <span className="flex items-center gap-1 font-medium text-blue-700">
                                  <Clock className="h-3 w-3" /> {apt.timeSlot}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {apt.location}
                                </span>
                              </div>

                              {apt.notes && (
                                <p className="text-[11px] text-slate-500 italic pt-1">
                                  Ghi chú: {apt.notes}
                                </p>
                              )}
                            </div>

                            {(apt.status === "PENDING" ||
                              apt.status === "CONFIRMED") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={
                                  updateAppointmentStatusMutation.isPending
                                }
                                onClick={() =>
                                  void handleCancelAppointment(apt.id)
                                }
                                className="text-xs text-slate-400 hover:text-rose-600 cursor-pointer self-start sm:self-center"
                              >
                                Hủy lịch
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Action Plan Tasks */}
          {canCreateSession && activeTab === "action-plan" && (
            <div className="space-y-5">
              {/* Progress Summary Card */}
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <ListTodo className="h-5 w-5 text-blue-600" />
                        <h3 className="text-sm font-bold text-slate-900">
                          Tiến độ Kế hoạch Cải thiện —{" "}
                          {selectedAdvisor.courseCode}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Checklist các đầu việc do Giảng viên phụ trách giao để
                        bù đắp kiến thức và cải thiện kết quả môn học.
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xl font-extrabold text-slate-900">
                        {taskCompletionRate}%
                      </span>
                      <span className="text-xs text-slate-500 ml-1">
                        Hoàn thành
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Progress
                      value={taskCompletionRate}
                      className="h-2 bg-slate-100"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Tasks Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">
                    Danh sách Nhiệm vụ Được giao ({currentAdvisorTasks.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Tích chọn để đồng bộ tiến độ với Giảng viên
                  </span>
                </div>

                {isLoadingTasks ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                  </div>
                ) : currentAdvisorTasks.length === 0 ? (
                  <Card className="border-slate-200 bg-white p-6 text-center shadow-xs">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                    <p className="text-xs text-slate-600 font-semibold">
                      Chưa có nhiệm vụ cải thiện nào được giảng viên giao cho
                      môn {selectedAdvisor.courseCode}.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Khi giảng viên tạo đầu việc can thiệp trên hệ thống, danh
                      sách sẽ tự động hiển thị tại đây.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {currentAdvisorTasks.map((task) => (
                      <div
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => void handleToggleTask(task.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void handleToggleTask(task.id);
                          }
                        }}
                        className={cn(
                          "group flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition-all text-left",
                          task.completed
                            ? "border-emerald-200 bg-emerald-50/20 shadow-2xs"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-xs",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            aria-label={
                              task.completed
                                ? "Đánh dấu chưa hoàn thành"
                                : "Đánh dấu hoàn thành"
                            }
                            className="mt-0.5 text-slate-400 group-hover:text-blue-600 shrink-0"
                          >
                            {task.completed ? (
                              <CheckSquare className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </span>

                          <div className="space-y-0.5">
                            <span
                              className={cn(
                                "text-xs font-bold transition-all",
                                task.completed
                                  ? "line-through text-slate-400"
                                  : "text-slate-900 group-hover:text-blue-700",
                              )}
                            >
                              {task.title}
                            </span>
                            {task.description && (
                              <p className="text-[11px] text-slate-500 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-400">
                              <Clock className="h-3 w-3" />
                              <span>{task.deadline}</span>
                            </div>
                          </div>
                        </div>

                        <Badge
                          className={cn(
                            "text-[10px] font-semibold shrink-0",
                            task.priority === "HIGH" &&
                              "bg-blue-100 text-blue-800 hover:bg-blue-100",
                            task.priority === "MEDIUM" &&
                              "bg-amber-100 text-amber-800 hover:bg-amber-100",
                            task.priority === "NORMAL" &&
                              "bg-slate-100 text-slate-700 hover:bg-slate-100",
                          )}
                        >
                          {task.priority === "HIGH"
                            ? "Ưu tiên cao"
                            : task.priority === "MEDIUM"
                              ? "Trung bình"
                              : "Khuyến nghị"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  Nhiệm vụ cải thiện được giảng viên giao trực tiếp theo tiến độ
                  môn học. Mỗi khi bạn đánh dấu hoàn thành, trạng thái sẽ được
                  lưu ngay trên máy chủ để giảng viên theo dõi.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Backward-compatibility alias
export const StudentAlertsPage = StudentAdvisingPage;
