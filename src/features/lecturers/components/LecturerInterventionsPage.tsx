import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/features/auth";
import { formatFeatureName } from "@/lib/shap-features";
import { extractApiError, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AppointmentStatus,
  ClassStudentPrediction,
  Enrollment,
} from "@/types";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  Clock,
  ListTodo,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Square,
  UserCheck,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useActiveSemester,
  useAllClassesEnrollments,
  useAllClassesPredictions,
  useLecturerCurrentClasses,
} from "../api/lecturer-api";
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
  useCreateTask,
  useToggleTask,
} from "@/features/advising/api/advising-api";

// ==========================================
// Types & Contracts
// ==========================================

export type LecturerAdvisingTab = "messages" | "bookings" | "action-plan";

export interface StudentAdvisingProfile {
  studentId: string;
  studentName: string;
  email: string;
  courseCode: string;
  courseName: string;
  classId: string;
  classGroup: string;
  giuaKy: number | null;
  lab: number | null;
  btl: number | null;
  retaken: boolean;
  riskLevel: "CRITICAL" | "WARNING" | "SAFE";
  riskReason: string;
  failProbability: number;
  predictedScore10: number | null;
  predictedLetterGrade: string | null;
  isAiPrediction: boolean;
  rawEnrollment?: Enrollment;
}

export interface DirectMessage {
  id: string;
  sender: "student" | "advisor";
  senderName: string;
  content: string;
  timestamp: string;
  messageType: string;
  isRead?: boolean;
}

export interface BookingAppointment {
  id: string;
  subject: string;
  timeSlot: string;
  meetingType: "OFFICE" | "ONLINE";
  notes?: string;
  createdById?: string | null;
  createdByRole?: string | null;
  status: AppointmentStatus;
  createdAt: string;
  location: string;
}

export interface ActionPlanTask {
  id: string;
  title: string;
  description?: string;
  deadline: string;
  priority: "HIGH" | "MEDIUM" | "NORMAL";
  completed: boolean;
}

export const LecturerInterventionsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: user } = useAuthUser();
  const lecturerId = user?.user_code || user?.id || "";
  const lecturerName = user?.name || "Giảng viên Phụ trách";

  const {
    data: classes = [],
    isLoading: isLoadingClasses,
    refetch: refetchClasses,
  } = useLecturerCurrentClasses(lecturerId);
  const { data: activeSemester } = useActiveSemester();
  const activeSemesterCode = activeSemester?.semester_code || "HK261";

  const classIds = useMemo(() => classes.map((c) => c.class_id), [classes]);
  const enrollmentsQueries = useAllClassesEnrollments(classIds);
  const predictionsQueries = useAllClassesPredictions(classIds, true);

  const isLoadingEnrollments = enrollmentsQueries.some((q) => q.isLoading);
  const isLoadingPredictions = predictionsQueries.some((q) => q.isLoading);

  const allEnrollments = useMemo(() => {
    return enrollmentsQueries.flatMap((q) => q.data ?? []);
  }, [enrollmentsQueries]);

  // Build AI prediction map keyed by `${class_id}::${student_id}`
  const { predictionMap, hasAnyAiPrediction } = useMemo(() => {
    const map = new Map<string, ClassStudentPrediction>();
    let anyLoaded = false;
    for (const q of predictionsQueries) {
      const clsPred = q.data;
      if (!clsPred) continue;
      anyLoaded = true;
      for (const s of clsPred.students ?? []) {
        map.set(`${clsPred.class_id}::${s.student_id}`, s);
      }
    }
    return { predictionMap: map, hasAnyAiPrediction: anyLoaded };
  }, [predictionsQueries]);

  // Active Tab derived from URL search params (keeps NotificationBell clicks in sync)
  const tabParam = searchParams.get("tab");
  const activeTab: LecturerAdvisingTab =
    tabParam === "bookings" || tabParam === "action-plan"
      ? tabParam
      : "messages";

  // Filter States
  const [filterRisk, setFilterRisk] = useState<
    "ALL" | "CRITICAL" | "WARNING" | "SESSIONS"
  >("ALL");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Map Classes for quick lookup
  const classMap = useMemo(() => {
    const map = new Map<string, (typeof classes)[0]>();
    for (const c of classes) {
      map.set(c.class_id, c);
    }
    return map;
  }, [classes]);

  // Derived Students List (prioritizing real AI predictions, falling back to enrollment heuristic only if AI offline)
  const students: StudentAdvisingProfile[] = useMemo(() => {
    const list: StudentAdvisingProfile[] = allEnrollments.map((enr) => {
      const cls = classMap.get(enr.class_id);
      const pred = predictionMap.get(`${enr.class_id}::${enr.student_id}`);

      if (pred) {
        const riskLevel: "CRITICAL" | "WARNING" | "SAFE" =
          pred.risk_level === "HIGH" || pred.is_at_risk
            ? "CRITICAL"
            : pred.risk_level === "MEDIUM"
              ? "WARNING"
              : "SAFE";

        const topFactor = pred.top_shap_factors?.[0];
        const riskReason = topFactor
          ? `${formatFeatureName(topFactor.feature).label}: ${topFactor.description}`
          : riskLevel === "CRITICAL"
            ? "Mô hình AI cảnh báo xác suất rớt môn cao, cần can thiệp sớm."
            : riskLevel === "WARNING"
              ? "Mô hình AI đánh giá ở ngưỡng cần theo dõi và củng cố điểm cuối kỳ."
              : "Phong độ học tập ổn định theo đánh giá của mô hình AI.";

        return {
          studentId: enr.student_id,
          studentName: pred.student_name || `Sinh viên ${enr.student_id}`,
          email: `${enr.student_id}@hcmut.edu.vn`,
          courseCode: enr.course_code || cls?.course_code || "",
          courseName: cls?.course_name || enr.course_code || "",
          classId: enr.class_id,
          classGroup: cls?.class_group || "",
          giuaKy: enr.giua_ky,
          lab: enr.lab,
          btl: enr.btl,
          retaken: enr.retaken,
          riskLevel,
          riskReason,
          failProbability: pred.fail_probability,
          predictedScore10: pred.predicted_score10,
          predictedLetterGrade: pred.predicted_letter_grade,
          isAiPrediction: true,
          rawEnrollment: enr,
        };
      }

      // Heuristic fallback when AI model service is temporarily offline
      let riskLevel: "CRITICAL" | "WARNING" | "SAFE" = "SAFE";
      let riskReason = "Chưa có cảnh báo từ điểm thành phần hiện tại.";
      let failProbability = 0.1;

      if (enr.giua_ky !== null && enr.giua_ky < 4.0) {
        riskLevel = "CRITICAL";
        riskReason = `Điểm thi giữa kỳ ${enr.giua_ky}/10 (dưới ngưỡng 4.0).`;
        failProbability = Math.max(
          0.65,
          Number(((10 - enr.giua_ky) / 10).toFixed(2)),
        );
      } else if (enr.retaken) {
        riskLevel =
          enr.giua_ky !== null && enr.giua_ky < 5.0 ? "CRITICAL" : "WARNING";
        riskReason = "Học phần đăng ký học lại.";
        failProbability = 0.55;
      } else if (enr.lab !== null && enr.lab < 4.0) {
        riskLevel = "WARNING";
        riskReason = `Điểm thực hành Lab đạt ${enr.lab}/10, cần hoàn thành bù.`;
        failProbability = 0.42;
      } else if (enr.giua_ky !== null && enr.giua_ky < 5.5) {
        riskLevel = "WARNING";
        riskReason = `Điểm giữa kỳ ${enr.giua_ky}/10 ở mức tiệm cận, cần củng cố.`;
        failProbability = 0.35;
      }

      return {
        studentId: enr.student_id,
        studentName: `Sinh viên ${enr.student_id}`,
        email: `${enr.student_id}@hcmut.edu.vn`,
        courseCode: enr.course_code || cls?.course_code || "",
        courseName: cls?.course_name || enr.course_code || "",
        classId: enr.class_id,
        classGroup: cls?.class_group || "",
        giuaKy: enr.giua_ky,
        lab: enr.lab,
        btl: enr.btl,
        retaken: enr.retaken,
        riskLevel,
        riskReason,
        failProbability,
        predictedScore10: null,
        predictedLetterGrade: null,
        isAiPrediction: false,
        rawEnrollment: enr,
      };
    });

    return list.sort((a, b) => b.failProbability - a.failProbability);
  }, [allEnrollments, classMap, predictionMap]);

  // Selected Student derived directly from URL search params (?student=&course=)
  const studentParam = searchParams.get("student") || "";
  const courseParam = searchParams.get("course") || "";

  const selectedStudent = useMemo(() => {
    if (studentParam) {
      if (courseParam) {
        const exact = students.find(
          (s) =>
            s.studentId === studentParam &&
            s.courseCode.toUpperCase() === courseParam.toUpperCase(),
        );
        if (exact) return exact;
      }
      const byId = students.find((s) => s.studentId === studentParam);
      if (byId) return byId;
    }
    return students[0] || null;
  }, [students, studentParam, courseParam]);

  const handleTabChange = (tab: LecturerAdvisingTab) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("tab", tab);
      return p;
    });
  };

  // ==========================================
  // Backend Advising Sessions & Queries
  // ==========================================
  const { data: serverSessions } = useAdvisingSessions(Boolean(lecturerId));
  const createOrGetSessionMutation = useCreateOrGetAdvisingSession();
  const markSessionReadMutation = useMarkSessionRead();

  const handleSelectStudent = (student: StudentAdvisingProfile) => {
    const matched =
      serverSessions?.find(
        (s) =>
          s.student_id === student.studentId &&
          s.course_code === student.courseCode &&
          s.semester_code === activeSemesterCode,
      ) ??
      serverSessions?.find(
        (s) =>
          s.student_id === student.studentId &&
          s.course_code === student.courseCode,
      );
    if (matched && matched.unread_count > 0) {
      markSessionReadMutation.mutate(matched.id);
    }
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("student", student.studentId);
      p.set("course", student.courseCode);
      return p;
    });
  };

  const sessionMapByStudentCourse = useMemo(() => {
    const map = new Map<string, (typeof serverSessions extends Array<infer T> | undefined ? T : never)>();
    for (const s of serverSessions ?? []) {
      const key = `${s.student_id}::${s.course_code}`;
      const existing = map.get(key);
      // Prefer active semester session so older terms do not overwrite current term unread state
      if (!existing || s.semester_code === activeSemesterCode) {
        map.set(key, s);
      }
    }
    return map;
  }, [serverSessions, activeSemesterCode]);

  const activeSession = useMemo(() => {
    if (!serverSessions || !selectedStudent) return null;
    return (
      serverSessions.find(
        (s) =>
          s.student_id === selectedStudent.studentId &&
          s.course_code === selectedStudent.courseCode &&
          s.semester_code === activeSemesterCode,
      ) ??
      serverSessions.find(
        (s) =>
          s.student_id === selectedStudent.studentId &&
          s.course_code === selectedStudent.courseCode,
      ) ??
      null
    );
  }, [serverSessions, selectedStudent, activeSemesterCode]);

  const activeSessionId = activeSession?.id;

  // Real-time Messages from Backend (GET uses mark_read=false so polling never wipes unread state)
  const { data: serverMessages, isLoading: isLoadingMessages } =
    useSessionMessages(activeSessionId, 50, 0, activeTab === "messages");
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
  const createTaskMutation = useCreateTask(activeSessionId);
  const toggleTaskMutation = useToggleTask(activeSessionId);

  const ensureSessionId = async (
    student: StudentAdvisingProfile,
  ): Promise<string> => {
    if (activeSessionId) return activeSessionId;
    const created = await createOrGetSessionMutation.mutateAsync({
      student_id: student.studentId,
      course_code: student.courseCode,
      semester_code: activeSemesterCode,
      topic: `Cố vấn học vụ môn ${student.courseCode}`,
      risk_level: student.riskLevel,
      lecturer_id: lecturerId,
    });
    return created.id;
  };

  // 1. Messages from Backend
  const messages: DirectMessage[] = useMemo(() => {
    if (!activeSessionId || !serverMessages) return [];
    return serverMessages.map((m) => ({
      id: m.id,
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
  }, [activeSessionId, serverMessages]);

  const [chatInput, setChatInput] = useState("");

  const handleSendMessage = async (contentToSend?: string) => {
    const text = (contentToSend ?? chatInput).trim();
    if (!text || !selectedStudent) return;

    try {
      const targetSessionId = await ensureSessionId(selectedStudent);
      await sendMessageMutation.mutateAsync({
        sessionId: targetSessionId,
        payload: {
          content: text,
          message_type: "NOTICE",
        },
      });
      if ((activeSession?.unread_count ?? 0) > 0) {
        markSessionReadMutation.mutate(targetSessionId);
      }
      if (!contentToSend) setChatInput("");
      toast.success(
        `Đã gửi lời dặn dò tới sinh viên ${selectedStudent.studentName}!`,
      );
    } catch (err) {
      toast.error(
        extractApiError(
          err,
          "Không thể gửi tin nhắn. Vui lòng kiểm tra kết nối máy chủ.",
        ),
      );
    }
  };

  // 2. Appointments from Backend
  const appointments: BookingAppointment[] = useMemo(() => {
    if (!activeSessionId || !serverAppointments) return [];
    return serverAppointments.map((a) => ({
      id: a.id,
      subject: a.subject,
      timeSlot: a.time_slot,
      meetingType: a.meeting_type,
      notes: a.notes || undefined,
      createdById: a.created_by_id ?? null,
      createdByRole: a.created_by_role ?? null,
      status: a.status,
      createdAt: new Date(a.created_at).toLocaleDateString("vi-VN"),
      location: a.location,
    }));
  }, [activeSessionId, serverAppointments]);

  const handleUpdateBookingStatus = async (
    appointmentId: string,
    status: AppointmentStatus,
  ) => {
    if (!activeSessionId) return;
    try {
      await updateAppointmentStatusMutation.mutateAsync({
        sessionId: activeSessionId,
        appointmentId,
        payload: { status },
      });
      if (status === "CONFIRMED") {
        toast.success("Đã xác nhận lịch tiếp sinh viên!");
      } else if (status === "COMPLETED") {
        toast.success("Đã đánh dấu hoàn thành buổi tư vấn.");
      } else if (status === "CANCELLED") {
        toast.info("Đã hủy lịch hẹn.");
      }
    } catch (err) {
      toast.error(
        extractApiError(err, "Không thể cập nhật trạng thái lịch hẹn."),
      );
    }
  };

  // Form for Lecturer Proactively scheduling office hours
  const [newSlotInput, setNewSlotInput] = useState("Thứ Ba: 14:30 - 15:30");
  const [newMeetingType, setNewMeetingType] = useState<"OFFICE" | "ONLINE">(
    "OFFICE",
  );
  const [newAppointmentNotes, setNewAppointmentNotes] = useState("");

  const handleCreateProactiveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !newSlotInput.trim()) return;

    const location =
      newMeetingType === "OFFICE"
        ? "P.503 Nhà H6, Cơ sở Dĩ An"
        : "Google Meet: meet.google.com/adv-hcmut-support";

    try {
      const targetSessionId = await ensureSessionId(selectedStudent);
      await createAppointmentMutation.mutateAsync({
        sessionId: targetSessionId,
        payload: {
          subject: `Lịch hẹn can thiệp học vụ môn ${selectedStudent.courseCode}`,
          time_slot: `${newSlotInput.trim()} (${newMeetingType === "OFFICE" ? "Trực tiếp" : "Online"})`,
          meeting_type: newMeetingType,
          location,
          notes:
            newAppointmentNotes.trim() ||
            "Giảng viên mời sinh viên trao đổi kết quả học tập.",
        },
      });
      setNewAppointmentNotes("");
      toast.success(
        `Đã xếp lịch hẹn tiếp sinh viên ${selectedStudent.studentName}!`,
      );
    } catch (err) {
      toast.error(
        extractApiError(err, "Không thể tạo phiếu hẹn. Vui lòng thử lại."),
      );
    }
  };

  // 3. Action Plan Tasks from Backend
  const actionTasks: ActionPlanTask[] = useMemo(() => {
    if (!activeSessionId || !serverTasks) return [];
    return serverTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description || undefined,
      deadline: t.deadline,
      priority: t.priority,
      completed: t.completed,
    }));
  }, [activeSessionId, serverTasks]);

  const handleToggleTask = async (taskId: string) => {
    if (!activeSessionId) return;
    const task = actionTasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      await toggleTaskMutation.mutateAsync({
        sessionId: activeSessionId,
        taskId,
        payload: { completed: !task.completed },
      });
    } catch (err) {
      toast.error(
        extractApiError(err, "Không thể cập nhật trạng thái nhiệm vụ."),
      );
    }
  };

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState(
    "Hạn chót: 30/11/2026",
  );
  const [newTaskPriority, setNewTaskPriority] = useState<
    "HIGH" | "MEDIUM" | "NORMAL"
  >("HIGH");

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const addedTitle = newTaskTitle.trim();
    if (!addedTitle || !selectedStudent) return;

    try {
      const targetSessionId = await ensureSessionId(selectedStudent);
      await createTaskMutation.mutateAsync({
        sessionId: targetSessionId,
        payload: {
          title: addedTitle,
          description: "Nhiệm vụ cải thiện điểm số do giảng viên trực tiếp giao.",
          deadline: newTaskDeadline.trim() || "Cuối kỳ",
          priority: newTaskPriority,
        },
      });
      setNewTaskTitle("");
      toast.success(
        `Đã giao nhiệm vụ cải thiện cho sinh viên ${selectedStudent.studentName}!`,
      );
    } catch (err) {
      toast.error(
        extractApiError(err, "Không thể giao nhiệm vụ. Vui lòng thử lại."),
      );
    }
  };

  // Filtered Students in Left Column
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedClassId !== "ALL" && s.classId !== selectedClassId) {
        return false;
      }
      if (filterRisk === "CRITICAL" && s.riskLevel !== "CRITICAL") return false;
      if (filterRisk === "WARNING" && s.riskLevel !== "WARNING") return false;
      if (filterRisk === "SESSIONS") {
        if (!sessionMapByStudentCourse.has(`${s.studentId}::${s.courseCode}`)) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = s.studentName.toLowerCase().includes(q);
        const matchId = s.studentId.toLowerCase().includes(q);
        const matchCourse = s.courseCode.toLowerCase().includes(q);
        return matchName || matchId || matchCourse;
      }
      return true;
    });
  }, [
    students,
    selectedClassId,
    filterRisk,
    searchQuery,
    sessionMapByStudentCourse,
  ]);

  // Metric counts
  const criticalCount = useMemo(
    () => students.filter((s) => s.riskLevel === "CRITICAL").length,
    [students],
  );
  const warningCount = useMemo(
    () => students.filter((s) => s.riskLevel === "WARNING").length,
    [students],
  );
  const activeSessionsCount = useMemo(
    () =>
      students.filter((s) =>
        sessionMapByStudentCourse.has(`${s.studentId}::${s.courseCode}`),
      ).length,
    [students, sessionMapByStudentCourse],
  );

  const handleSendEmail = (
    email: string,
    studentName: string,
    courseCode: string,
  ) => {
    const subject = encodeURIComponent(
      `[${courseCode}] Thư mời Cố vấn & Trao đổi Học vụ`,
    );
    const body = encodeURIComponent(
      `Chào em ${studentName},\n\nThầy/Cô gửi thông báo này liên quan đến kết quả học tập môn ${courseCode}. Em vui lòng sắp xếp thời gian trao đổi trực tiếp hoặc đăng ký lịch hẹn tư vấn trên hệ thống nhé.\n\nTrân trọng,\n${lecturerName}`,
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_self");
  };

  const completedTaskCount = actionTasks.filter((t) => t.completed).length;
  const progressPercent =
    actionTasks.length > 0
      ? Math.round((completedTaskCount / actionTasks.length) * 100)
      : 0;

  const showAiFallbackBanner =
    !isLoadingClasses &&
    !isLoadingPredictions &&
    classIds.length > 0 &&
    !hasAnyAiPrediction;

  const isBusySending =
    createOrGetSessionMutation.isPending || sendMessageMutation.isPending;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Quick Actions */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Cố vấn &amp; Can thiệp sinh viên
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Trao đổi hai chiều, duyệt lịch hẹn tư vấn và giao nhiệm vụ cải thiện theo phân loại rủi ro AI ·{" "}
            <span className="font-medium text-slate-800">Học kỳ {activeSemesterCode}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchClasses();
              toast.info("Đã làm mới dữ liệu lớp học và sinh viên.");
            }}
            className="h-9 cursor-pointer gap-1.5 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Làm mới dữ liệu</span>
          </Button>
          {selectedStudent && (
            <Button
              size="sm"
              disabled={isBusySending}
              onClick={() => {
                void handleSendMessage(
                  `[THÔNG BÁO MÔN ${selectedStudent.courseCode}] Thầy/Cô đã cập nhật tài liệu ôn tập mới trên LMS. Em nhớ xem lại và chủ động đặt lịch tư vấn nếu cần hỗ trợ thêm nhé!`,
                );
              }}
              className="h-9 cursor-pointer gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-brand-blue-hover"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Nhắc ôn tập nhanh</span>
            </Button>
          )}
        </div>
      </header>

      {/* AI Service Offline Banner */}
      {showAiFallbackBanner && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="max-w-[75ch] leading-relaxed">
            Dịch vụ dự báo AI tạm thời chưa phản hồi — danh sách rủi ro đang tạm
            hiển thị theo quy tắc điểm giữa kỳ và học lại. Mọi chức năng nhắn
            tin, lịch hẹn và giao nhiệm vụ vẫn hoạt động bình thường.
          </p>
        </div>
      )}

      {/* 2. Top Summary KPI Cards (Obsidian KPI + Anchor Contrast Rule) */}
      <section
        aria-label="Tổng quan can thiệp sinh viên"
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        {/* Card 1: Total Students Monitored */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Tổng sinh viên phụ trách
            </span>
            <Users className="h-4 w-4 text-sky-400" aria-hidden="true" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2 tabular-nums">
            {isLoadingClasses || isLoadingEnrollments ? (
              <Skeleton className="h-9 w-20 bg-slate-800" />
            ) : (
              <>
                <span className="text-3xl font-extrabold tracking-tight text-white">
                  {students.length}
                </span>
                <span className="text-sm font-medium text-slate-300">
                  sinh viên
                </span>
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-300 tabular-nums">
            Phân bổ trong {classes.length} nhóm lớp giảng dạy kỳ này
          </p>
        </div>

        {/* Card 2: Critical Interventions Required */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Cần can thiệp khẩn cấp
            </span>
            <ShieldAlert className="h-4 w-4 text-rose-400" aria-hidden="true" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2 tabular-nums">
            {isLoadingEnrollments || isLoadingPredictions ? (
              <Skeleton className="h-9 w-20 bg-slate-800" />
            ) : (
              <>
                <span className="text-3xl font-extrabold tracking-tight text-rose-400">
                  {criticalCount}
                </span>
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-xs font-semibold text-rose-200">
                  {hasAnyAiPrediction ? "Nguy cơ cao" : "GK < 4.0 / Học lại"}
                </span>
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-300 tabular-nums">
            Có {warningCount} sinh viên khác ở mức cần chú ý
          </p>
        </div>

        {/* Card 3: Active Advising Sessions */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Phiên cố vấn đang mở
            </span>
            <CalendarCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2 tabular-nums">
            <span className="text-3xl font-extrabold tracking-tight text-emerald-400">
              {serverSessions?.length ?? 0}
            </span>
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-200">
              {appointments.filter((a) => a.status === "PENDING").length} hẹn chờ duyệt
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-300">
            Đồng bộ trực tiếp với Cổng Sinh viên
          </p>
        </div>
      </section>

      {/* 3. Main Workspace: 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* CỘT TRÁI (4 cols): Danh sách sinh viên & Bộ lọc nhanh */}
        <div className="space-y-4 lg:col-span-4">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-blue-600" />
                  Danh Sách Sinh Viên
                </CardTitle>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                  {filteredStudents.length} / {students.length}
                </span>
              </div>

              {/* Ô tìm kiếm */}
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Tìm theo Tên, MSSV hoặc Môn..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-500"
                />
              </div>

              {/* Bộ lọc nhóm lớp */}
              {classes.length > 1 && (
                <div className="mt-2">
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full h-8 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 px-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ALL">
                      Tất cả các lớp học phần ({classes.length} lớp)
                    </option>
                    {classes.map((c) => (
                      <option key={c.class_id} value={c.class_id}>
                        {c.course_code} - Nhóm {c.class_group} (
                        {c.total_students} SV)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 4 Tabs Lọc nhanh */}
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-1 text-xs tabular-nums">
                <button
                  type="button"
                  onClick={() => setFilterRisk("CRITICAL")}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1 rounded-md py-1.5 font-semibold transition-colors",
                    filterRisk === "CRITICAL"
                      ? "bg-white text-rose-700 shadow-2xs"
                      : "text-slate-600 hover:text-rose-700",
                  )}
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                  <span>Can thiệp ({criticalCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterRisk("WARNING")}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1 rounded-md py-1.5 font-semibold transition-colors",
                    filterRisk === "WARNING"
                      ? "bg-white text-amber-800 shadow-2xs"
                      : "text-slate-600 hover:text-amber-700",
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                  <span>Cần chú ý ({warningCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterRisk("SESSIONS")}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1 rounded-md py-1.5 font-semibold transition-colors",
                    filterRisk === "SESSIONS"
                      ? "bg-white text-emerald-700 shadow-2xs"
                      : "text-slate-600 hover:text-emerald-700",
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Đang cố vấn ({activeSessionsCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterRisk("ALL")}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1 rounded-md py-1.5 font-semibold transition-colors",
                    filterRisk === "ALL"
                      ? "bg-white text-sidebar-accent-foreground shadow-2xs"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  <span>Tất cả ({students.length})</span>
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-2 divide-y divide-slate-100 max-h-155 overflow-y-auto">
              {isLoadingClasses || isLoadingEnrollments ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <Users className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 font-semibold text-slate-700">
                    Không tìm thấy sinh viên
                  </p>
                  <p className="mt-0.5 text-slate-400">
                    Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.
                  </p>
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected =
                    selectedStudent?.studentId === student.studentId &&
                    selectedStudent?.courseCode === student.courseCode;
                  const studentSession = sessionMapByStudentCourse.get(
                    `${student.studentId}::${student.courseCode}`,
                  );

                  return (
                    <button
                      key={`${student.classId}-${student.studentId}`}
                      type="button"
                      onClick={() => handleSelectStudent(student)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl transition-all cursor-pointer flex flex-col gap-1.5",
                        isSelected
                          ? "border border-blue-500 bg-blue-50/40 ring-2 ring-blue-500"
                          : "hover:bg-slate-50/80 border border-transparent",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-8 w-8 border border-slate-200 shrink-0">
                            <AvatarFallback
                              className={cn(
                                "text-xs font-bold",
                                student.riskLevel === "CRITICAL"
                                  ? "bg-rose-100 text-rose-800"
                                  : student.riskLevel === "WARNING"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800",
                              )}
                            >
                              {getInitials(student.studentName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-900 truncate">
                              {student.studentName}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500">
                              MSSV: {student.studentId}
                            </p>
                          </div>
                        </div>

                        {studentSession && studentSession.unread_count > 0 && (
                          <div className="flex flex-col items-end shrink-0">
                            <Badge className="bg-blue-600 text-[9px] text-white px-1.5 py-0">
                              {studentSession.unread_count} tin mới
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100/80 pt-1.5 mt-0.5">
                        <span className="font-medium text-slate-700">
                          {student.courseCode} ({student.classGroup})
                        </span>
                        {student.retaken && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            Học lại
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* CỘT PHẢI (8 cols): Không gian Làm việc & Tương tác với Sinh viên */}
        <div className="space-y-6 lg:col-span-8">
          {selectedStudent ? (
            <Card className="border-slate-200 bg-white shadow-xs">
              {/* Header chi tiết sinh viên đang chọn */}
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 border border-slate-200 shrink-0">
                      <AvatarFallback
                        className={cn(
                          "text-sm font-bold",
                          selectedStudent.riskLevel === "CRITICAL"
                            ? "bg-rose-100 text-rose-800"
                            : selectedStudent.riskLevel === "WARNING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800",
                        )}
                      >
                        {getInitials(selectedStudent.studentName)}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">
                          {selectedStudent.studentName}
                        </h2>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
                          {selectedStudent.studentId}
                        </span>
                        {selectedStudent.retaken && (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-[10px] font-bold text-amber-700"
                          >
                            Học lại
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Học phần:{" "}
                        <strong>
                          {selectedStudent.courseCode} -{" "}
                          {selectedStudent.courseName}
                        </strong>{" "}
                        (Nhóm {selectedStudent.classGroup}) •{" "}
                        {selectedStudent.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleSendEmail(
                          selectedStudent.email,
                          selectedStudent.studentName,
                          selectedStudent.courseCode,
                        )
                      }
                      className="cursor-pointer gap-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <Mail className="h-3.5 w-3.5 text-slate-500" />
                      <span>Gửi Email ngoài</span>
                    </Button>
                  </div>
                </div>

                {/* Score Pills & Risk Alert Banner */}
                <div className="mt-3.5 space-y-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          Điểm Giữa kỳ
                        </span>
                        <p className="font-bold text-slate-900">
                          {selectedStudent.giuaKy !== null
                            ? `${selectedStudent.giuaKy.toFixed(1)}/10`
                            : "Chưa có"}
                        </p>
                      </div>
                      <div className="h-6 w-px bg-slate-200" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          Thực hành Lab
                        </span>
                        <p className="font-bold text-slate-900">
                          {selectedStudent.lab !== null
                            ? `${selectedStudent.lab.toFixed(1)}/10`
                            : "Chưa có"}
                        </p>
                      </div>
                      <div className="h-6 w-px bg-slate-200" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          Bài tập lớn
                        </span>
                        <p className="font-bold text-slate-900">
                          {selectedStudent.btl !== null
                            ? `${selectedStudent.btl.toFixed(1)}/10`
                            : "Chưa có"}
                        </p>
                      </div>
                      {selectedStudent.predictedScore10 !== null && (
                        <>
                          <div className="h-6 w-px bg-slate-200" />
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              Dự báo AI
                            </span>
                            <p className="font-bold text-blue-700">
                              {selectedStudent.predictedScore10.toFixed(1)}/10 (
                              {selectedStudent.predictedLetterGrade ?? "—"})
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    <Badge
                      className={cn(
                        "text-xs font-bold px-2 py-0.5",
                        selectedStudent.riskLevel === "CRITICAL"
                          ? "bg-rose-100 text-rose-800 border-rose-200"
                          : selectedStudent.riskLevel === "WARNING"
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-emerald-100 text-emerald-800 border-emerald-200",
                      )}
                    >
                      {selectedStudent.isAiPrediction ? "AI: " : ""}
                      Xác suất rớt{" "}
                      {(selectedStudent.failProbability * 100).toFixed(0)}%
                    </Badge>
                  </div>

                  <p className="text-[11px] text-slate-600 border-t border-slate-200/70 pt-2">
                    <span className="font-semibold text-slate-800">
                      {selectedStudent.isAiPrediction
                        ? "Yếu tố SHAP nổi bật: "
                        : "Nhận định: "}
                    </span>
                    {selectedStudent.riskReason}
                  </p>
                </div>

                {/* 3 Tab Navigation Header */}
                <div className="mt-4 flex border-b border-slate-200 gap-6 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => handleTabChange("messages")}
                    className={cn(
                      "pb-2.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border-b-2 shrink-0",
                      activeTab === "messages"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-800",
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Lời dặn &amp; Trao đổi ({messages.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange("bookings")}
                    className={cn(
                      "pb-2.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border-b-2 shrink-0",
                      activeTab === "bookings"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-800",
                    )}
                  >
                    <CalendarCheck className="h-3.5 w-3.5" />
                    <span>Lịch hẹn tư vấn ({appointments.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange("action-plan")}
                    className={cn(
                      "pb-2.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border-b-2 shrink-0",
                      activeTab === "action-plan"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-800",
                    )}
                  >
                    <ListTodo className="h-3.5 w-3.5" />
                    <span>
                      Nhiệm vụ Cải thiện ({completedTaskCount}/
                      {actionTasks.length})
                    </span>
                  </button>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                {/* TAB 1: LỜI DẶN DÒ & TRAO ĐỔI HAI CHIỀU */}
                {activeTab === "messages" && (
                  <div className="space-y-4">
                    {activeSessionId && (activeSession?.unread_count ?? 0) > 0 && (
                      <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs">
                        <span className="font-semibold text-blue-900">
                          Có {activeSession?.unread_count} tin nhắn mới chưa đọc
                          từ {selectedStudent.studentName}.
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={markSessionReadMutation.isPending}
                          onClick={() =>
                            markSessionReadMutation.mutate(activeSessionId)
                          }
                          className="h-7 border-blue-300 bg-white text-[11px] font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer gap-1"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          <span>Đánh dấu đã đọc</span>
                        </Button>
                      </div>
                    )}

                    <div className="space-y-3 min-h-55 max-h-85 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      {isLoadingMessages ? (
                        <div className="space-y-2">
                          <Skeleton className="h-12 w-3/4 rounded-xl" />
                          <Skeleton className="ml-auto h-12 w-2/3 rounded-xl" />
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          Chưa có tin nhắn trao đổi nào với sinh viên này cho
                          môn {selectedStudent.courseCode}. Hãy gửi lời dặn dò
                          đầu tiên!
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isLecturer = msg.sender === "advisor";

                          return (
                            <div
                              key={msg.id}
                              className={cn(
                                "flex flex-col max-w-[85%]",
                                isLecturer
                                  ? "ml-auto items-end"
                                  : "mr-auto items-start",
                              )}
                            >
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                                <span className="font-semibold text-slate-600">
                                  {msg.senderName}
                                </span>
                                <span>•</span>
                                <span>{msg.timestamp}</span>
                                {isLecturer && (
                                  <span
                                    className={cn(
                                      "font-medium",
                                      msg.isRead
                                        ? "text-emerald-600"
                                        : "text-slate-400",
                                    )}
                                  >
                                    • {msg.isRead ? "SV đã xem" : "Đã gửi"}
                                  </span>
                                )}
                              </div>
                              <div
                                className={cn(
                                  "rounded-2xl px-3.5 py-2 text-xs leading-relaxed",
                                  isLecturer
                                    ? "bg-blue-600 text-white rounded-br-xs"
                                    : "bg-white text-slate-800 border border-slate-200 rounded-bl-xs shadow-2xs",
                                )}
                              >
                                {msg.content}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Quick Response Templates */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                        Mẫu Tin nhắn Hướng dẫn Nhanh (Click để gửi ngay):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isBusySending}
                          onClick={() =>
                            void handleSendMessage(
                              `Chào em ${selectedStudent.studentName}, kết quả hiện tại môn ${selectedStudent.courseCode} của em đang có nguy cơ rủi ro. Em chú ý hoàn thành tốt BTL và đăng ký gặp Thầy/Cô trong giờ tiếp sinh viên để xây dựng kế hoạch ôn tập cuối kỳ nhé.`,
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-all cursor-pointer text-left"
                        >
                          📝 Nhắc nhở kết quả giữa kỳ &amp; gỡ điểm
                        </button>
                        <button
                          type="button"
                          disabled={isBusySending}
                          onClick={() =>
                            void handleSendMessage(
                              `Chào em, Thầy/Cô đã gửi tài liệu tóm tắt lý thuyết và các dạng bài tập mẫu ôn thi môn ${selectedStudent.courseCode} lên LMS. Em nhớ tải về tự luyện tập nhé.`,
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-all cursor-pointer text-left"
                        >
                          📚 Gợi ý tài liệu &amp; bài tập bổ trợ
                        </button>
                        <button
                          type="button"
                          disabled={isBusySending}
                          onClick={() =>
                            void handleSendMessage(
                              `Chào em, Thầy/Cô có lịch tiếp sinh viên tại P.503 Nhà H6 vào chiều Thứ Ba. Em có thể đến trực tiếp hoặc đặt lịch hẹn trên hệ thống để trao đổi bài thi nhé.`,
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-all cursor-pointer text-left"
                        >
                          ⏰ Mời đến văn phòng bộ môn gặp Thầy/Cô
                        </button>
                      </div>
                    </div>

                    {/* Chat Input & Send Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSendMessage();
                      }}
                      className="flex gap-2 pt-1"
                    >
                      <Input
                        type="text"
                        placeholder={`Soạn lời dặn dò gửi cho ${selectedStudent.studentName}...`}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        disabled={isBusySending}
                        className="text-xs bg-slate-50 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-500"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!chatInput.trim() || isBusySending}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs cursor-pointer gap-1.5 shrink-0"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>
                          {isBusySending ? "Đang gửi..." : "Gửi lời dặn"}
                        </span>
                      </Button>
                    </form>
                  </div>
                )}

                {/* TAB 2: QUẢN LÝ LỊCH HẸN TIẾP SINH VIÊN */}
                {activeTab === "bookings" && (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase">
                          Danh sách lịch hẹn trao đổi
                        </span>
                      </div>

                      {isLoadingAppointments ? (
                        <Skeleton className="h-20 w-full rounded-xl" />
                      ) : appointments.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
                          <Calendar className="mx-auto h-8 w-8 text-slate-300" />
                          <p className="mt-2 font-semibold text-slate-700">
                            Chưa có lịch hẹn nào
                          </p>
                          <p className="text-slate-400 mt-0.5">
                            Chưa có phiếu hẹn nào được tạo cho môn{" "}
                            {selectedStudent.courseCode}.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {appointments.map((book) => {
                            const isCreatedByLecturer = book.createdById
                              ? book.createdById === lecturerId
                              : book.createdByRole === "lecturer";
                            const canLecturerConfirm =
                              book.status === "PENDING" && !isCreatedByLecturer;

                            return (
                              <div
                                key={book.id}
                                className={cn(
                                  "rounded-xl border p-3.5 transition-all bg-white shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                                  canLecturerConfirm
                                    ? "border-amber-300 bg-amber-50/30"
                                    : "border-slate-200",
                                )}
                              >
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] font-bold px-1.5 py-0",
                                        book.status === "CONFIRMED" &&
                                          "border-emerald-300 bg-emerald-50 text-emerald-700",
                                        book.status === "PENDING" &&
                                          canLecturerConfirm &&
                                          "border-amber-300 bg-amber-50 text-amber-800",
                                        book.status === "PENDING" &&
                                          !canLecturerConfirm &&
                                          "border-slate-300 bg-slate-50 text-slate-700",
                                        book.status === "COMPLETED" &&
                                          "border-blue-300 bg-blue-50 text-blue-700",
                                        book.status === "CANCELLED" &&
                                          "border-slate-300 bg-slate-100 text-slate-600",
                                      )}
                                    >
                                      {book.status === "CONFIRMED" &&
                                        "Đã xác nhận"}
                                      {book.status === "PENDING" &&
                                        (canLecturerConfirm
                                          ? "Chờ bạn xác nhận"
                                          : "Chờ sinh viên xác nhận")}
                                      {book.status === "COMPLETED" &&
                                        "Đã hoàn thành"}
                                      {book.status === "CANCELLED" && "Đã hủy"}
                                    </Badge>
                                    <span className="text-xs font-bold text-slate-900">
                                      {book.subject}
                                    </span>
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                      {isCreatedByLecturer
                                        ? "Do Thầy/Cô đặt"
                                        : "Do Sinh viên đặt"}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                    <span className="flex items-center gap-1 text-slate-700 font-medium">
                                      <Clock className="h-3.5 w-3.5 text-blue-600" />
                                      {book.timeSlot}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1 text-slate-500">
                                      {book.meetingType === "ONLINE" ? (
                                        <>
                                          <Video className="h-3.5 w-3.5 text-purple-600" />
                                          <span>Gặp Online</span>
                                        </>
                                      ) : (
                                        <>
                                          <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                                          <span>Tại Văn phòng</span>
                                        </>
                                      )}
                                    </span>
                                  </div>

                                  {book.notes && (
                                    <p className="text-xs text-slate-500 italic">
                                      Ghi chú: &ldquo;{book.notes}&rdquo;
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                  {canLecturerConfirm && (
                                    <Button
                                      size="sm"
                                      disabled={
                                        updateAppointmentStatusMutation.isPending
                                      }
                                      onClick={() =>
                                        void handleUpdateBookingStatus(
                                          book.id,
                                          "CONFIRMED",
                                        )
                                      }
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs cursor-pointer gap-1"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span>Xác nhận lịch hẹn</span>
                                    </Button>
                                  )}
                                  {book.status === "CONFIRMED" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={
                                        updateAppointmentStatusMutation.isPending
                                      }
                                      onClick={() =>
                                        void handleUpdateBookingStatus(
                                          book.id,
                                          "COMPLETED",
                                        )
                                      }
                                      className="border-blue-200 text-blue-700 hover:bg-blue-50 text-xs cursor-pointer gap-1"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span>Hoàn thành</span>
                                    </Button>
                                  )}
                                  {(book.status === "PENDING" ||
                                    book.status === "CONFIRMED") && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={
                                        updateAppointmentStatusMutation.isPending
                                      }
                                      onClick={() =>
                                        void handleUpdateBookingStatus(
                                          book.id,
                                          "CANCELLED",
                                        )
                                      }
                                      className="text-xs text-slate-500 hover:text-rose-600 cursor-pointer gap-1"
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                      <span>Hủy</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Giảng viên chủ động xếp lịch hẹn */}
                    <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase">
                        <Plus className="h-4 w-4 text-blue-600" />
                        Chủ động Xếp Lịch Hẹn Với Sinh Viên Này
                      </div>
                      <p className="text-xs text-slate-600">
                        Nếu sinh viên có nguy cơ rớt môn cao, Thầy/Cô có thể chủ
                        động xếp lịch hẹn và chỉ định giờ tiếp sinh viên:
                      </p>

                      <form
                        onSubmit={handleCreateProactiveAppointment}
                        className="space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600">
                              Khung giờ hẹn
                            </label>
                            <Input
                              type="text"
                              value={newSlotInput}
                              onChange={(e) => setNewSlotInput(e.target.value)}
                              placeholder="Ví dụ: Thứ Ba: 14:00 - 15:30"
                              className="h-8 text-xs bg-white mt-1"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600">
                              Hình thức gặp
                            </label>
                            <select
                              value={newMeetingType}
                              onChange={(e) =>
                                setNewMeetingType(
                                  e.target.value as "OFFICE" | "ONLINE",
                                )
                              }
                              className="w-full h-8 text-xs font-medium rounded-lg border border-slate-200 bg-white px-2 mt-1 text-slate-700"
                            >
                              <option value="OFFICE">
                                Văn phòng Bộ môn (P.503 Nhà H6)
                              </option>
                              <option value="ONLINE">
                                Google Meet Trực tuyến
                              </option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600">
                            Lý do &amp; Ghi chú dặn dò
                          </label>
                          <Input
                            type="text"
                            value={newAppointmentNotes}
                            onChange={(e) =>
                              setNewAppointmentNotes(e.target.value)
                            }
                            placeholder="Ví dụ: Trao đổi bài thi giữa kỳ và hướng dẫn nộp bù bài thực hành Lab"
                            className="h-8 text-xs bg-white mt-1"
                          />
                        </div>

                        <Button
                          type="submit"
                          size="sm"
                          disabled={
                            createAppointmentMutation.isPending ||
                            createOrGetSessionMutation.isPending
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs cursor-pointer gap-1.5"
                        >
                          <CalendarCheck className="h-3.5 w-3.5" />
                          <span>Gửi phiếu hẹn cho sinh viên</span>
                        </Button>
                      </form>
                    </div>
                  </div>
                )}

                {/* TAB 3: GIAO NHIỆM VỤ CẢI THIỆN */}
                {activeTab === "action-plan" && (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">
                          Tiến Độ Thực Hiện Cải Thiện Của Sinh Viên
                        </span>
                        <span className="font-bold text-blue-700">
                          {completedTaskCount} / {actionTasks.length} việc đã
                          hoàn thành ({progressPercent}%)
                        </span>
                      </div>
                      <Progress
                        value={progressPercent}
                        className="h-2 bg-slate-200 **:data-[slot=progress-indicator]:bg-blue-600"
                      />
                      <p className="text-[11px] text-slate-500">
                        Khi sinh viên tích hoàn thành các đầu việc trên ứng dụng
                        của họ, tiến độ ở đây sẽ được cập nhật đồng bộ.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-700 uppercase">
                        Các đầu việc đã giao cho sinh viên này:
                      </span>

                      {isLoadingTasks ? (
                        <Skeleton className="h-16 w-full rounded-xl" />
                      ) : actionTasks.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
                          <ListTodo className="mx-auto h-8 w-8 text-slate-300" />
                          <p className="mt-2 font-semibold text-slate-700">
                            Chưa có nhiệm vụ nào được giao
                          </p>
                          <p className="text-slate-400 mt-0.5">
                            Thầy/Cô hãy giao nhiệm vụ đầu tiên ở form bên dưới.
                          </p>
                        </div>
                      ) : (
                        actionTasks.map((task) => (
                          <div
                            key={task.id}
                            className={cn(
                              "rounded-xl border p-3 transition-all flex items-start gap-3 bg-white",
                              task.completed
                                ? "border-slate-200 bg-slate-50/50 opacity-80"
                                : "border-slate-200 hover:border-blue-300 shadow-2xs",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => void handleToggleTask(task.id)}
                              className="mt-0.5 text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                            >
                              {task.completed ? (
                                <CheckSquare className="h-4.5 w-4.5 text-blue-600" />
                              ) : (
                                <Square className="h-4.5 w-4.5 text-slate-400" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "text-xs font-bold",
                                    task.completed
                                      ? "text-slate-400 line-through"
                                      : "text-slate-900",
                                  )}
                                >
                                  {task.title}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[9px] px-1.5 py-0 font-semibold",
                                    task.priority === "HIGH" &&
                                      "border-rose-300 bg-rose-50 text-rose-700",
                                    task.priority === "MEDIUM" &&
                                      "border-amber-300 bg-amber-50 text-amber-700",
                                    task.priority === "NORMAL" &&
                                      "border-blue-300 bg-blue-50 text-blue-700",
                                  )}
                                >
                                  {task.priority === "HIGH"
                                    ? "Ưu tiên cao"
                                    : task.priority === "MEDIUM"
                                      ? "Trung bình"
                                      : "Bình thường"}
                                </Badge>
                              </div>

                              {task.description && (
                                <p className="text-xs text-slate-500 mt-1">
                                  {task.description}
                                </p>
                              )}

                              <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 tabular-nums">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                                <span>{task.deadline}</span>
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Form Giao việc mới cho sinh viên */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase">
                        <Plus className="h-4 w-4 text-blue-600" />
                        Giao Thêm Nhiệm Vụ Mới Cho Sinh Viên
                      </div>

                      <form onSubmit={handleAddTask} className="space-y-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600">
                            Tiêu đề nhiệm vụ cần làm
                          </label>
                          <Input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Ví dụ: Nộp dự thảo Báo cáo BTL tuần 11, Làm lại bài tập Pipeline..."
                            className="h-8 text-xs bg-white mt-1"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600">
                              Hạn chót hoàn thành
                            </label>
                            <Input
                              type="text"
                              value={newTaskDeadline}
                              onChange={(e) =>
                                setNewTaskDeadline(e.target.value)
                              }
                              placeholder="Hạn chót: 30/11/2026"
                              className="h-8 text-xs bg-white mt-1"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600">
                              Mức độ ưu tiên
                            </label>
                            <select
                              value={newTaskPriority}
                              onChange={(e) =>
                                setNewTaskPriority(
                                  e.target.value as
                                    | "HIGH"
                                    | "MEDIUM"
                                    | "NORMAL",
                                )
                              }
                              className="w-full h-8 text-xs font-medium rounded-lg border border-slate-200 bg-white px-2 mt-1 text-slate-700"
                            >
                              <option value="HIGH">
                                Ưu tiên cao (Bắt buộc hoàn thành)
                              </option>
                              <option value="MEDIUM">
                                Trung bình (Khuyến khích)
                              </option>
                              <option value="NORMAL">Bình thường</option>
                            </select>
                          </div>
                        </div>

                        <Button
                          type="submit"
                          size="sm"
                          disabled={
                            !newTaskTitle.trim() ||
                            createTaskMutation.isPending ||
                            createOrGetSessionMutation.isPending
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs cursor-pointer gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Giao việc cho sinh viên này</span>
                        </Button>
                      </form>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 bg-white p-8 text-center text-slate-500">
              <Users className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Chưa chọn sinh viên
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Vui lòng nhấp vào một sinh viên ở danh sách bên trái để mở không
                gian tương tác.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
