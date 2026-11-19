import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/features/auth";
import { cn } from "@/lib/utils";
import type { Enrollment } from "@/types";
import {
  Building2,
  Calendar,
  CalendarCheck,
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
  Sparkles,
  Square,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useActiveSemester,
  useAllClassesEnrollments,
  useLecturerCurrentClasses,
} from "../api/lecturer-api";
import {
  useAdvisingSessions,
  useCreateOrGetAdvisingSession,
  useSessionMessages,
  useSendMessage,
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
  rawEnrollment?: Enrollment;
}

export interface DirectMessage {
  id: string;
  advisorId: string;
  sender: "student" | "advisor";
  senderName: string;
  content: string;
  timestamp: string;
  isQuickRequest?: boolean;
}

export interface BookingAppointment {
  id: string;
  advisorId: string;
  advisorName: string;
  subject: string;
  timeSlot: string;
  meetingType: "OFFICE" | "ONLINE";
  notes?: string;
  status: "CONFIRMED" | "PENDING" | "COMPLETED";
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
// Sample / Fallback Name Resolvers
// ==========================================

const SAMPLE_STUDENT_NAMES: Record<string, string> = {
  "2011928": "Nguyễn Văn An",
  "2028899": "Trần Thị Mai Anh",
  "2010112": "Lê Hoàng Bảo",
  "2010245": "Phạm Quốc Dũng",
  "2010356": "Đỗ Minh Đức",
  "2010489": "Vũ Hải Đăng",
  "2010512": "Bùi Hoàng Nam",
  "2010678": "Ngô Phương Thảo",
  "2010789": "Đinh Tiến Đạt",
  "2010890": "Trịnh Mỹ Linh",
};

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getInitialMessages(
  student: StudentAdvisingProfile | null,
  lecturerName: string,
): DirectMessage[] {
  if (!student) return [];
  try {
    const saved = localStorage.getItem(
      `aurora_advising_messages_${student.studentId}`,
    );
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return [
    {
      id: `msg-seed-1-${student.studentId}`,
      advisorId: `course-${student.courseCode}`,
      sender: "advisor",
      senderName: lecturerName,
      content: `Chào em ${student.studentName}, Thầy đã xem kết quả bài thi giữa kỳ môn ${student.courseCode} của em. Em cần chú ý tập trung ôn tập các nội dung trọng tâm để cải thiện điểm số ở kỳ thi cuối kỳ nhé.`,
      timestamp: "Hôm qua 15:30",
    },
    {
      id: `msg-seed-2-${student.studentId}`,
      advisorId: `course-${student.courseCode}`,
      sender: "student",
      senderName: student.studentName,
      content: `Dạ em cảm ơn Thầy ạ. Thầy cho em xin lời khuyên về phương án gỡ điểm và tài liệu bài tập bổ trợ cho phần thi cuối kỳ với ạ.`,
      timestamp: "Hôm qua 16:10",
    },
  ];
}

function getInitialBookings(
  student: StudentAdvisingProfile | null,
  lecturerName: string,
): BookingAppointment[] {
  if (!student) return [];
  try {
    const saved = localStorage.getItem(
      `aurora_advising_bookings_${student.studentId}`,
    );
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return [
    {
      id: `book-seed-${student.studentId}`,
      advisorId: `course-${student.courseCode}`,
      advisorName: lecturerName,
      subject: `Tư vấn phương án gỡ điểm môn ${student.courseCode}`,
      timeSlot: "Thứ Ba: 14:00 - 15:30 (Văn phòng bộ môn)",
      meetingType: "OFFICE",
      notes: `Sinh viên cần trao đổi về các câu hỏi bị trừ điểm trong bài thi giữa kỳ môn ${student.courseCode}.`,
      status: student.riskLevel === "CRITICAL" ? "PENDING" : "CONFIRMED",
      createdAt: "Hôm nay",
      location: "P.503 Nhà H6, Cơ sở Dĩ An",
    },
  ];
}

function getInitialTasks(
  student: StudentAdvisingProfile | null,
): ActionPlanTask[] {
  if (!student) return [];
  try {
    const saved = localStorage.getItem(
      `aurora_advising_actionplan_${student.studentId}`,
    );
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return [
    {
      id: `task-1-${student.studentId}`,
      advisorId: `course-${student.courseCode}`,
      title: `Rà soát lại bài kiểm tra giữa kỳ ${student.courseCode}`,
      description:
        "Xem lại phần câu hỏi lý thuyết và viết lại bài giải đúng vào vở bài tập.",
      deadline: "Hạn chót: 25/11/2026",
      priority: "HIGH",
      completed: student.riskLevel === "SAFE",
    },
    {
      id: `task-2-${student.studentId}`,
      advisorId: `course-${student.courseCode}`,
      title: "Hoàn thành bài tập bổ trợ trên LMS tuần 10 & 11",
      description:
        "Đạt điểm tối thiểu 8.0/10 ở các bài quiz trắc nghiệm để chuẩn bị thi cuối kỳ.",
      deadline: "Hạn chót: 28/11/2026",
      priority: "HIGH",
      completed: false,
    },
    {
      id: `task-3-${student.studentId}`,
      advisorId: `course-${student.courseCode}`,
      title: "Gặp trợ giảng phụ đạo hướng dẫn Bài tập lớn",
      description:
        "Tham gia buổi phụ đạo hàng tuần tại phòng Lab để hoàn thiện phần mô phỏng.",
      deadline: "Hạn chót: 30/11/2026",
      priority: "MEDIUM",
      completed: false,
    },
  ];
}

export const LecturerInterventionsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: user } = useAuthUser();
  const lecturerId = user?.user_code || user?.id || "LEC1001";
  const lecturerName = user?.name || "TS. Giảng viên Phụ trách";

  const {
    data: classes = [],
    isLoading: isLoadingClasses,
    refetch: refetchClasses,
  } = useLecturerCurrentClasses(lecturerId);
  const { data: activeSemester } = useActiveSemester();
  const activeSemesterCode = activeSemester?.semester_code || "HK261";

  const classIds = useMemo(() => classes.map((c) => c.class_id), [classes]);
  const enrollmentsQueries = useAllClassesEnrollments(classIds);
  const isLoadingEnrollments = enrollmentsQueries.some((q) => q.isLoading);

  const allEnrollments = useMemo(() => {
    return enrollmentsQueries.flatMap((q) => q.data ?? []);
  }, [enrollmentsQueries]);

  // Active Tab state
  const [activeTab, setActiveTab] = useState<LecturerAdvisingTab>(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "bookings" || tabParam === "action-plan") return tabParam;
    return "messages";
  });

  // Filter States
  const [filterRisk, setFilterRisk] = useState<
    "ALL" | "CRITICAL" | "WARNING" | "BOOKING"
  >("CRITICAL");
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

  // Derived Students List
  const students: StudentAdvisingProfile[] = useMemo(() => {
    if (allEnrollments.length > 0) {
      return allEnrollments.map((enr) => {
        const cls = classMap.get(enr.class_id);
        const name =
          SAMPLE_STUDENT_NAMES[enr.student_id] || `Sinh viên ${enr.student_id}`;

        let riskLevel: "CRITICAL" | "WARNING" | "SAFE" = "SAFE";
        let riskReason = "Phong độ học tập ổn định, rủi ro rớt môn thấp.";
        let failProbability = 0.12;

        if (enr.giua_ky !== null && enr.giua_ky < 4.0) {
          riskLevel = "CRITICAL";
          riskReason = `Điểm thi giữa kỳ ${enr.giua_ky}/10 (dưới ngưỡng qua môn 4.0).`;
          failProbability = Math.max(
            0.65,
            Number(((10 - enr.giua_ky) / 10).toFixed(2)),
          );
        } else if (enr.retaken) {
          riskLevel =
            enr.giua_ky !== null && enr.giua_ky < 5.0 ? "CRITICAL" : "WARNING";
          riskReason = "Học phần đăng ký học lại sau khi trượt ở các kỳ trước.";
          failProbability = 0.58;
        } else if (enr.lab !== null && enr.lab < 4.0) {
          riskLevel = "WARNING";
          riskReason = `Điểm thực hành Lab đạt ${enr.lab}/10, cần hoàn thành bù.`;
          failProbability = 0.45;
        } else if (enr.giua_ky !== null && enr.giua_ky < 5.5) {
          riskLevel = "WARNING";
          riskReason = `Điểm giữa kỳ ${enr.giua_ky}/10 ở mức tiệm cận, cần củng cố điểm cuối kỳ.`;
          failProbability = 0.38;
        }

        return {
          studentId: enr.student_id,
          studentName: name,
          email: `${enr.student_id}@hcmut.edu.vn`,
          courseCode: enr.course_code || cls?.course_code || "CO2007",
          courseName: cls?.course_name || "Kiến trúc Máy tính",
          classId: enr.class_id,
          classGroup: cls?.class_group || "CC01",
          giuaKy: enr.giua_ky,
          lab: enr.lab,
          btl: enr.btl,
          retaken: enr.retaken,
          riskLevel,
          riskReason,
          failProbability,
          rawEnrollment: enr,
        };
      });
    }

    // Realistic Fallback Dataset when server returns empty
    return [
      {
        studentId: "2011928",
        studentName: "Nguyễn Văn An",
        email: "2011928@hcmut.edu.vn",
        courseCode: "CO2007",
        courseName: "Kiến trúc Máy tính",
        classId: "HK261_CO2007_CC01",
        classGroup: "CC01",
        giuaKy: 3.2,
        lab: 3.5,
        btl: 5.5,
        retaken: true,
        riskLevel: "CRITICAL",
        riskReason:
          "Điểm thi giữa kỳ 3.2/10 và là học phần học lại. Nguy cơ trượt môn cao.",
        failProbability: 0.72,
      },
      {
        studentId: "2028899",
        studentName: "Trần Thị Mai Anh",
        email: "2028899@hcmut.edu.vn",
        courseCode: "CO2007",
        courseName: "Kiến trúc Máy tính",
        classId: "HK261_CO2007_CC01",
        classGroup: "CC01",
        giuaKy: 4.5,
        lab: 7.0,
        btl: 6.0,
        retaken: false,
        riskLevel: "WARNING",
        riskReason:
          "Điểm giữa kỳ 4.5/10 tiệm cận ngưỡng rủi ro, cần hỗ trợ ôn tập cuối kỳ.",
        failProbability: 0.42,
      },
      {
        studentId: "2010112",
        studentName: "Lê Hoàng Bảo",
        email: "2010112@hcmut.edu.vn",
        courseCode: "CO2017",
        courseName: "Hệ điều hành",
        classId: "HK261_CO2017_CC02",
        classGroup: "CC02",
        giuaKy: 2.5,
        lab: 4.0,
        btl: 4.5,
        retaken: true,
        riskLevel: "CRITICAL",
        riskReason:
          "Điểm giữa kỳ 2.5/10 (dưới ngưỡng liệt) và nợ tiến độ thực hành xv6 kernel.",
        failProbability: 0.85,
      },
      {
        studentId: "2010245",
        studentName: "Phạm Quốc Dũng",
        email: "2010245@hcmut.edu.vn",
        courseCode: "CO2007",
        courseName: "Kiến trúc Máy tính",
        classId: "HK261_CO2007_CC01",
        classGroup: "CC01",
        giuaKy: 7.8,
        lab: 8.5,
        btl: 8.0,
        retaken: false,
        riskLevel: "SAFE",
        riskReason:
          "Phong độ học tập tốt, tiến độ thực hành và bài tập lớn đạt chuẩn.",
        failProbability: 0.08,
      },
      {
        studentId: "2010356",
        studentName: "Đỗ Minh Đức",
        email: "2010356@hcmut.edu.vn",
        courseCode: "CO2017",
        courseName: "Hệ điều hành",
        classId: "HK261_CO2017_CC02",
        classGroup: "CC02",
        giuaKy: 5.0,
        lab: 5.5,
        btl: 6.5,
        retaken: false,
        riskLevel: "WARNING",
        riskReason:
          "Điểm thi giữa kỳ ở mức trung bình, cần duy trì chuyên cần.",
        failProbability: 0.32,
      },
      {
        studentId: "2010489",
        studentName: "Vũ Hải Đăng",
        email: "2010489@hcmut.edu.vn",
        courseCode: "CO2007",
        courseName: "Kiến trúc Máy tính",
        classId: "HK261_CO2007_CC01",
        classGroup: "CC01",
        giuaKy: 8.5,
        lab: 9.0,
        btl: 9.0,
        retaken: false,
        riskLevel: "SAFE",
        riskReason: "Học lực xuất sắc, rủi ro rớt môn dưới 5%.",
        failProbability: 0.04,
      },
    ];
  }, [allEnrollments, classMap]);

  // Selected Student state
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return searchParams.get("student") || students[0]?.studentId || "2011928";
  });

  const selectedStudent = useMemo(() => {
    const found = students.find((s) => s.studentId === selectedStudentId);
    return found || students[0] || null;
  }, [students, selectedStudentId]);

  const handleSelectStudent = (id: string) => {
    setSelectedStudentId(id);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("student", id);
      return p;
    });
  };

  const handleTabChange = (tab: LecturerAdvisingTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("tab", tab);
      return p;
    });
  };

  // ==========================================
  // Backend Advising Sessions & Queries
  // ==========================================
  const { data: serverSessions } = useAdvisingSessions();
  const createOrGetSessionMutation = useCreateOrGetAdvisingSession();

  const activeSession = useMemo(() => {
    if (!serverSessions || !selectedStudent) return null;
    return (
      serverSessions.find(
        (s) =>
          s.student_id === selectedStudent.studentId &&
          s.course_code === selectedStudent.courseCode,
      ) || null
    );
  }, [serverSessions, selectedStudent]);

  const activeSessionId = activeSession?.id;

  // Real-time Messages from Backend
  const { data: serverMessages } = useSessionMessages(activeSessionId);
  const sendMessageMutation = useSendMessage(activeSessionId);

  // Real-time Appointments from Backend
  const { data: serverAppointments } = useSessionAppointments(activeSessionId);
  const createAppointmentMutation = useCreateAppointment(activeSessionId);
  const updateAppointmentStatusMutation =
    useUpdateAppointmentStatus(activeSessionId);

  // Real-time Tasks from Backend
  const { data: serverTasks } = useSessionTasks(activeSessionId);
  const createTaskMutation = useCreateTask(activeSessionId);
  const toggleTaskMutation = useToggleTask(activeSessionId);

  // 1. Messages State for current selected student (fallback / optimistic)
  const [messagesMap, setMessagesMap] = useState<
    Record<string, DirectMessage[]>
  >({});

  const messages: DirectMessage[] = useMemo(() => {
    if (serverMessages && serverMessages.length > 0 && selectedStudent) {
      return serverMessages.map((m) => ({
        id: m.id,
        advisorId: `course-${selectedStudent.courseCode}`,
        sender: (m.sender_role.toLowerCase() === "student"
          ? "student"
          : "advisor") as "student" | "advisor",
        senderName: m.sender_name,
        content: m.content,
        timestamp: new Date(m.created_at).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isQuickRequest: false,
      }));
    }
    if (!selectedStudent) return [];
    return (
      messagesMap[selectedStudent.studentId] ??
      getInitialMessages(selectedStudent, lecturerName)
    );
  }, [serverMessages, selectedStudent, messagesMap, lecturerName]);

  const saveMessages = (nextMessages: DirectMessage[]) => {
    if (!selectedStudent) return;
    setMessagesMap((prev) => ({
      ...prev,
      [selectedStudent.studentId]: nextMessages,
    }));
    try {
      localStorage.setItem(
        `aurora_advising_messages_${selectedStudent.studentId}`,
        JSON.stringify(nextMessages),
      );
    } catch {
      // ignore
    }
  };

  const [chatInput, setChatInput] = useState("");

  const handleSendMessage = async (contentToSend?: string) => {
    const text = (contentToSend || chatInput).trim();
    if (!text || !selectedStudent) return;

    const newMsg: DirectMessage = {
      id: `msg-${Date.now()}`,
      advisorId: `course-${selectedStudent.courseCode}`,
      sender: "advisor",
      senderName: lecturerName,
      content: text,
      timestamp: "Vừa xong",
    };

    const next = [...messages, newMsg];
    saveMessages(next);
    if (!contentToSend) setChatInput("");

    // Send to Backend
    try {
      let targetSessionId = activeSessionId;
      if (!targetSessionId) {
        const created = await createOrGetSessionMutation.mutateAsync({
          student_id: selectedStudent.studentId,
          course_code: selectedStudent.courseCode,
          topic: `Cố vấn học vụ môn ${selectedStudent.courseCode}`,
          risk_level: selectedStudent.riskLevel,
          lecturer_id: lecturerId,
        });
        targetSessionId = created.id;
      }
      if (targetSessionId) {
        await sendMessageMutation.mutateAsync({
          content: text,
          message_type: "NOTICE",
        });
      }
    } catch {
      // Fallback keeps local message
    }

    toast.success(
      `Đã gửi lời dặn dò tới sinh viên ${selectedStudent.studentName}!`,
    );
  };

  // 2. Bookings State for current selected student
  const [appointmentsMap, setAppointmentsMap] = useState<
    Record<string, BookingAppointment[]>
  >({});

  const appointments = useMemo(() => {
    if (serverAppointments && serverAppointments.length > 0 && selectedStudent) {
      return serverAppointments.map((a) => ({
        id: a.id,
        advisorId: `course-${selectedStudent.courseCode}`,
        advisorName: lecturerName,
        subject: a.subject,
        timeSlot: a.time_slot,
        meetingType: a.meeting_type,
        notes: a.notes || undefined,
        status: a.status as "CONFIRMED" | "PENDING" | "COMPLETED",
        createdAt: new Date(a.created_at).toLocaleDateString("vi-VN"),
        location: a.location,
      }));
    }
    if (!selectedStudent) return [];
    return (
      appointmentsMap[selectedStudent.studentId] ??
      getInitialBookings(selectedStudent, lecturerName)
    );
  }, [serverAppointments, selectedStudent, appointmentsMap, lecturerName]);

  const saveAppointments = (next: BookingAppointment[]) => {
    if (!selectedStudent) return;
    setAppointmentsMap((prev) => ({
      ...prev,
      [selectedStudent.studentId]: next,
    }));
    try {
      localStorage.setItem(
        `aurora_advising_bookings_${selectedStudent.studentId}`,
        JSON.stringify(next),
      );
    } catch {
      // ignore
    }
  };

  const handleConfirmBooking = (bookingId: string) => {
    const next = appointments.map((b) =>
      b.id === bookingId ? { ...b, status: "CONFIRMED" as const } : b,
    );
    saveAppointments(next);

    if (activeSessionId) {
      updateAppointmentStatusMutation.mutate({
        appointmentId: bookingId,
        payload: { status: "CONFIRMED" },
      });
    }

    toast.success("Đã xác nhận lịch tiếp sinh viên thành công!");
  };

  // Form for Lecturer Proactively scheduling office hours
  const [newSlotInput, setNewSlotInput] = useState("Thứ Ba: 14:30 - 15:30");
  const [newMeetingType, setNewMeetingType] = useState<"OFFICE" | "ONLINE">(
    "OFFICE",
  );
  const [newAppointmentNotes, setNewAppointmentNotes] = useState("");

  const handleCreateProactiveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    const location =
      newMeetingType === "OFFICE"
        ? "P.503 Nhà H6, Cơ sở Dĩ An"
        : "Google Meet: meet.google.com/adv-hcmut-support";

    const newBooking: BookingAppointment = {
      id: `book-${Date.now()}`,
      advisorId: `course-${selectedStudent.courseCode}`,
      advisorName: lecturerName,
      subject: `Lịch hẹn can thiệp học vụ môn ${selectedStudent.courseCode}`,
      timeSlot: `${newSlotInput} (${newMeetingType === "OFFICE" ? "Trực tiếp" : "Online"})`,
      meetingType: newMeetingType,
      notes:
        newAppointmentNotes ||
        "Giảng viên mời sinh viên lên trao đổi kết quả bài thi giữa kỳ.",
      status: "CONFIRMED",
      createdAt: "Vừa xong",
      location,
    };

    saveAppointments([newBooking, ...appointments]);
    setNewAppointmentNotes("");

    // Call Backend
    try {
      let targetSessionId = activeSessionId;
      if (!targetSessionId) {
        const created = await createOrGetSessionMutation.mutateAsync({
          student_id: selectedStudent.studentId,
          course_code: selectedStudent.courseCode,
          topic: `Cố vấn học vụ môn ${selectedStudent.courseCode}`,
          risk_level: selectedStudent.riskLevel,
          lecturer_id: lecturerId,
        });
        targetSessionId = created.id;
      }
      if (targetSessionId) {
        await createAppointmentMutation.mutateAsync({
          subject: `Lịch hẹn can thiệp học vụ môn ${selectedStudent.courseCode}`,
          time_slot: `${newSlotInput} (${newMeetingType === "OFFICE" ? "Trực tiếp" : "Online"})`,
          meeting_type: newMeetingType,
          location,
          notes: newAppointmentNotes || null,
        });
      }
    } catch {
      // Fallback
    }

    toast.success(
      `Đã xếp lịch hẹn tiếp sinh viên ${selectedStudent.studentName}!`,
    );
  };

  // 3. Action Plan Tasks for current selected student
  const [tasksMap, setTasksMap] = useState<Record<string, ActionPlanTask[]>>(
    {},
  );

  const actionTasks = useMemo(() => {
    if (serverTasks && serverTasks.length > 0 && selectedStudent) {
      return serverTasks.map((t) => ({
        id: t.id,
        advisorId: `course-${selectedStudent.courseCode}`,
        title: t.title,
        description: t.description || undefined,
        deadline: t.deadline,
        priority: t.priority,
        completed: t.completed,
      }));
    }
    if (!selectedStudent) return [];
    return (
      tasksMap[selectedStudent.studentId] ?? getInitialTasks(selectedStudent)
    );
  }, [serverTasks, selectedStudent, tasksMap]);

  const saveTasks = (next: ActionPlanTask[]) => {
    if (!selectedStudent) return;
    setTasksMap((prev) => ({ ...prev, [selectedStudent.studentId]: next }));
    try {
      localStorage.setItem(
        `aurora_advising_actionplan_${selectedStudent.studentId}`,
        JSON.stringify(next),
      );
    } catch {
      // ignore
    }
  };

  const handleToggleTask = (taskId: string) => {
    const task = actionTasks.find((t) => t.id === taskId);
    const nextCompleted = task ? !task.completed : true;

    const next = actionTasks.map((t) =>
      t.id === taskId ? { ...t, completed: nextCompleted } : t,
    );
    saveTasks(next);

    if (activeSessionId) {
      toggleTaskMutation.mutate({
        taskId,
        payload: { completed: nextCompleted },
      });
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
    if (!newTaskTitle.trim() || !selectedStudent) return;

    const newTask: ActionPlanTask = {
      id: `task-${Date.now()}`,
      advisorId: `course-${selectedStudent.courseCode}`,
      title: newTaskTitle.trim(),
      description: "Nhiệm vụ cải thiện điểm số do giảng viên trực tiếp giao.",
      deadline: newTaskDeadline,
      priority: newTaskPriority,
      completed: false,
    };

    saveTasks([newTask, ...actionTasks]);
    const addedTitle = newTaskTitle.trim();
    setNewTaskTitle("");

    // Call Backend
    try {
      let targetSessionId = activeSessionId;
      if (!targetSessionId) {
        const created = await createOrGetSessionMutation.mutateAsync({
          student_id: selectedStudent.studentId,
          course_code: selectedStudent.courseCode,
          topic: `Cố vấn học vụ môn ${selectedStudent.courseCode}`,
          risk_level: selectedStudent.riskLevel,
          lecturer_id: lecturerId,
        });
        targetSessionId = created.id;
      }
      if (targetSessionId) {
        await createTaskMutation.mutateAsync({
          title: addedTitle,
          description: "Nhiệm vụ cải thiện điểm số do giảng viên trực tiếp giao.",
          deadline: newTaskDeadline,
          priority: newTaskPriority,
        });
      }
    } catch {
      // Fallback
    }

    toast.success(
      `Đã giao nhiệm vụ cải thiện cho sinh viên ${selectedStudent.studentName}!`,
    );
  };

  // Filtered Students in Left Column
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Class filter
      if (selectedClassId !== "ALL" && s.classId !== selectedClassId) {
        return false;
      }
      // Risk / Booking filter
      if (filterRisk === "CRITICAL" && s.riskLevel !== "CRITICAL") return false;
      if (filterRisk === "WARNING" && s.riskLevel !== "WARNING") return false;
      if (filterRisk === "BOOKING") {
        const bookingsKey = `aurora_advising_bookings_${s.studentId}`;
        const hasBooking = localStorage.getItem(bookingsKey);
        if (!hasBooking && s.riskLevel !== "CRITICAL") return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = s.studentName.toLowerCase().includes(q);
        const matchId = s.studentId.toLowerCase().includes(q);
        const matchCourse = s.courseCode.toLowerCase().includes(q);
        return matchName || matchId || matchCourse;
      }
      return true;
    });
  }, [students, selectedClassId, filterRisk, searchQuery]);

  // Metric counts
  const criticalCount = useMemo(
    () => students.filter((s) => s.riskLevel === "CRITICAL").length,
    [students],
  );
  const warningCount = useMemo(
    () => students.filter((s) => s.riskLevel === "WARNING").length,
    [students],
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
      `Chào em ${studentName},\n\nThầy gửi thông báo này liên quan đến kết quả học tập và bài thi giữa kỳ môn ${courseCode}. Em vui lòng sắp xếp thời gian đến phòng làm việc của Thầy vào giờ tiếp sinh viên (Office Hours) hoặc đăng ký lịch hẹn trên hệ thống để trao đổi phương án ôn tập cuối kỳ nhé.\n\nTrân trọng,\n${lecturerName}`,
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_self");
  };

  const completedTaskCount = actionTasks.filter((t) => t.completed).length;
  const progressPercent =
    actionTasks.length > 0
      ? Math.round((completedTaskCount / actionTasks.length) * 100)
      : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-700/10">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              Cố vấn Học vụ & Can thiệp Sớm
            </span>
            <span className="text-xs font-medium text-slate-500">
              Học kỳ {activeSemesterCode} • HCMUT
            </span>
          </div>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Trung tâm Cố vấn & Can thiệp Sinh viên
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Kênh tương tác hai chiều với sinh viên: gửi tin nhắn dặn dò cá nhân,
            phê duyệt lịch hẹn tiếp sinh viên và theo dõi nhiệm vụ cải thiện.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchClasses();
              toast.info("Đã làm mới dữ liệu lớp học & sinh viên.");
            }}
            className="cursor-pointer gap-1.5 border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            <span>Làm mới dữ liệu</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              handleSendMessage(
                `[THÔNG BÁO CHUNG] Thầy đã cập nhật slide ôn tập chương 4 và bộ câu hỏi mẫu trên LMS. Các em nhớ tải về làm trước tuần thi cuối kỳ nhé!`,
              );
            }}
            className="cursor-pointer gap-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Gửi lời dặn chung</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (Theme tối bg-slate-900) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Card 1: Total Students Monitored */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Tổng Sinh viên Phụ trách
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                {isLoadingClasses || isLoadingEnrollments ? (
                  <Skeleton className="h-9 w-20 bg-slate-800" />
                ) : (
                  <>
                    <span className="text-3xl font-extrabold tracking-tight text-white">
                      {students.length}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      sinh viên
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-blue-400 ring-1 ring-slate-700/50">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Phân bổ trong {classes.length} nhóm lớp giảng dạy trong kỳ
          </p>
        </div>

        {/* Card 2: Critical Interventions Required */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Cần Can thiệp Khẩn cấp
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-rose-400">
                  {criticalCount}
                </span>
                <Badge className="bg-rose-950/80 text-rose-300 ring-1 ring-rose-500/40 border-0 text-xs font-bold">
                  Điểm GK &lt; 4.0 / Học lại
                </Badge>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-950/50 text-rose-400 ring-1 ring-rose-500/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Có {warningCount} sinh viên khác đang ở mức điểm cần chú ý
          </p>
        </div>

        {/* Card 3: Office Hours Appointments */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Phiếu Hẹn Tiếp Sinh Viên
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-emerald-400">
                  {appointments.length}
                </span>
                <Badge className="bg-emerald-950/80 text-emerald-300 ring-1 ring-emerald-500/40 border-0 text-xs font-bold">
                  {appointments.filter((a) => a.status === "PENDING").length}{" "}
                  Chờ duyệt
                </Badge>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-emerald-400 ring-1 ring-slate-700/50">
              <CalendarCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Giờ tiếp sinh viên tại P.503 Nhà H6 hoặc qua Google Meet
          </p>
        </div>
      </div>

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
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFilterRisk("CRITICAL")}
                  className={cn(
                    "rounded-md py-1 font-semibold transition-all cursor-pointer flex items-center justify-center gap-1",
                    filterRisk === "CRITICAL"
                      ? "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                      : "text-slate-600 hover:text-rose-700",
                  )}
                >
                  <span>🚨 Can thiệp</span>
                  <span className="font-bold">({criticalCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterRisk("WARNING")}
                  className={cn(
                    "rounded-md py-1 font-semibold transition-all cursor-pointer flex items-center justify-center gap-1",
                    filterRisk === "WARNING"
                      ? "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs"
                      : "text-slate-600 hover:text-amber-700",
                  )}
                >
                  <span>⚠️ Cần chú ý</span>
                  <span className="font-bold">({warningCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterRisk("BOOKING")}
                  className={cn(
                    "rounded-md py-1 font-semibold transition-all cursor-pointer flex items-center justify-center gap-1",
                    filterRisk === "BOOKING"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                      : "text-slate-600 hover:text-emerald-700",
                  )}
                >
                  <span>📅 Lịch hẹn</span>
                  <span className="font-bold">({appointments.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterRisk("ALL")}
                  className={cn(
                    "rounded-md py-1 font-semibold transition-all cursor-pointer flex items-center justify-center gap-1",
                    filterRisk === "ALL"
                      ? "bg-white text-blue-700 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  <span>Tất cả</span>
                  <span>({students.length})</span>
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-2 divide-y divide-slate-100 max-h-155 overflow-y-auto">
              {filteredStudents.length === 0 ? (
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
                  const isSelected = student.studentId === selectedStudentId;

                  return (
                    <button
                      key={`${student.classId}-${student.studentId}`}
                      type="button"
                      onClick={() => handleSelectStudent(student.studentId)}
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

                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 px-1.5 py-0 text-[10px] font-semibold",
                            student.riskLevel === "CRITICAL" &&
                              "border-rose-300 bg-rose-50 text-rose-700",
                            student.riskLevel === "WARNING" &&
                              "border-amber-300 bg-amber-50 text-amber-700",
                            student.riskLevel === "SAFE" &&
                              "border-emerald-300 bg-emerald-50 text-emerald-700",
                          )}
                        >
                          {student.riskLevel === "CRITICAL" && "Nguy cơ cao"}
                          {student.riskLevel === "WARNING" && "Cần chú ý"}
                          {student.riskLevel === "SAFE" && "An toàn"}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100/80 pt-1.5 mt-0.5">
                        <span className="font-medium text-slate-700">
                          {student.courseCode} ({student.classGroup})
                        </span>
                        <div className="flex items-center gap-1.5">
                          {student.retaken && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded">
                              Học lại
                            </span>
                          )}
                          <span
                            className={cn(
                              "font-bold",
                              student.giuaKy !== null && student.giuaKy < 4.0
                                ? "text-rose-600"
                                : student.giuaKy !== null &&
                                    student.giuaKy < 6.0
                                  ? "text-amber-600"
                                  : "text-slate-700",
                            )}
                          >
                            GK:{" "}
                            {student.giuaKy !== null
                              ? `${student.giuaKy.toFixed(1)}/10`
                              : "Chưa có"}
                          </span>
                        </div>
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
                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
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
                        Bài tập lớn (BTL)
                      </span>
                      <p className="font-bold text-slate-900">
                        {selectedStudent.btl !== null
                          ? `${selectedStudent.btl.toFixed(1)}/10`
                          : "Chưa có"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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
                      {selectedStudent.riskLevel === "CRITICAL" &&
                        "Rủi ro rớt môn cao (≥ 65%)"}
                      {selectedStudent.riskLevel === "WARNING" &&
                        "Cần chú ý củng cố điểm"}
                      {selectedStudent.riskLevel === "SAFE" &&
                        "Học lực ổn định"}
                    </Badge>
                  </div>
                </div>

                {/* 3 Tab Navigation Header */}
                <div className="mt-4 flex border-b border-slate-200 gap-6">
                  <button
                    type="button"
                    onClick={() => handleTabChange("messages")}
                    className={cn(
                      "pb-2.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border-b-2",
                      activeTab === "messages"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-800",
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Lời dặn & Trao đổi ({messages.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange("bookings")}
                    className={cn(
                      "pb-2.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border-b-2",
                      activeTab === "bookings"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-800",
                    )}
                  >
                    <CalendarCheck className="h-3.5 w-3.5" />
                    <span>Phiếu hẹn Office Hours ({appointments.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange("action-plan")}
                    className={cn(
                      "pb-2.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border-b-2",
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
                {/* ============================================================== */}
                {/* TAB 1: LỜI DẶN DÒ & TRAO ĐỔI HAI CHIỀU                        */}
                {/* ============================================================== */}
                {activeTab === "messages" && (
                  <div className="space-y-4">
                    {/* Chat Bubble History */}
                    <div className="space-y-3 min-h-55 max-h-85 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      {messages.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          Chưa có tin nhắn trao đổi nào với sinh viên này. Hãy
                          gửi lời dặn dò đầu tiên!
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
                                {msg.isQuickRequest && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 border-blue-200 bg-blue-50 text-blue-700"
                                  >
                                    Yêu cầu nhanh
                                  </Badge>
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
                          onClick={() =>
                            handleSendMessage(
                              `Chào em, điểm giữa kỳ môn ${selectedStudent.courseCode} của em đang dưới 4.0. Em cần chú ý hoàn thành tốt BTL và đăng ký gặp Thầy trong giờ tiếp sinh viên để hướng dẫn phương án ôn tập cuối kỳ nhé.`,
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-all cursor-pointer text-left"
                        >
                          📝 Nhắc nhở kết quả giữa kỳ &amp; gỡ điểm
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSendMessage(
                              `Chào em, Thầy đã gửi tài liệu tóm tắt lý thuyết và các dạng bài tập mẫu ôn thi môn ${selectedStudent.courseCode} lên LMS. Em nhớ tải về tự luyện tập trước tuần 12 nhé.`,
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-all cursor-pointer text-left"
                        >
                          📚 Gợi ý tài liệu &amp; bài tập bổ trợ
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSendMessage(
                              `Chào em, Thầy có lịch tiếp sinh viên tại P.503 Nhà H6 vào chiều Thứ Ba. Em có thể đến trực tiếp hoặc đặt lịch hẹn trên hệ thống để trao đổi bài thi nhé.`,
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-all cursor-pointer text-left"
                        >
                          ⏰ Mời đến văn phòng bộ môn gặp Thầy
                        </button>
                      </div>
                    </div>

                    {/* Chat Input & Send Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                      }}
                      className="flex gap-2 pt-1"
                    >
                      <Input
                        type="text"
                        placeholder={`Soạn lời dặn dò gửi cho ${selectedStudent.studentName}...`}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="text-xs bg-slate-50 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-500"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!chatInput.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs cursor-pointer gap-1.5 shrink-0"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Gửi lời dặn</span>
                      </Button>
                    </form>
                  </div>
                )}

                {/* ============================================================== */}
                {/* TAB 2: QUẢN LÝ LỊCH HẸN TIẾP SINH VIÊN (OFFICE HOURS)         */}
                {/* ============================================================== */}
                {activeTab === "bookings" && (
                  <div className="space-y-5">
                    {/* Danh sách các phiếu hẹn của sinh viên này */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase">
                          Lịch hẹn đã đăng ký của sinh viên
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Dữ liệu đồng bộ trực tiếp với ứng dụng sinh viên
                        </span>
                      </div>

                      {appointments.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
                          <Calendar className="mx-auto h-8 w-8 text-slate-300" />
                          <p className="mt-2 font-semibold text-slate-700">
                            Chưa có lịch hẹn nào
                          </p>
                          <p className="text-slate-400 mt-0.5">
                            Sinh viên chưa gửi phiếu hẹn tiếp sinh viên.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {appointments.map((book) => (
                            <div
                              key={book.id}
                              className={cn(
                                "rounded-xl border p-3.5 transition-all bg-white shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                                book.status === "PENDING"
                                  ? "border-amber-300 bg-amber-50/30"
                                  : "border-slate-200",
                              )}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] font-bold px-1.5 py-0",
                                      book.status === "CONFIRMED"
                                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                        : "border-amber-300 bg-amber-50 text-amber-700",
                                    )}
                                  >
                                    {book.status === "CONFIRMED"
                                      ? "✅ Đã xác nhận"
                                      : "⏳ Chờ Thầy duyệt"}
                                  </Badge>
                                  <span className="text-xs font-bold text-slate-900">
                                    {book.subject}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-600">
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
                                    Ghi chú sinh viên: &ldquo;{book.notes}
                                    &rdquo;
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {book.status === "PENDING" && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleConfirmBooking(book.id)
                                    }
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs cursor-pointer gap-1"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Chấp nhận hẹn</span>
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    handleSendMessage(
                                      `Thầy đã nhận được yêu cầu hẹn của em. Thầy hẹn gặp em vào ${book.timeSlot} tại ${book.location}. Em nhớ chuẩn bị sẵn bài vở nhé.`,
                                    );
                                  }}
                                  className="text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  Gửi tin nhắn xác nhận
                                </Button>
                              </div>
                            </div>
                          ))}
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
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs cursor-pointer gap-1.5"
                        >
                          <CalendarCheck className="h-3.5 w-3.5" />
                          <span>Gửi phiếu hẹn cho sinh viên</span>
                        </Button>
                      </form>
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* TAB 3: GIAO NHIỆM VỤ CẢI THIỆN (ACTION PLAN CHECKLIST)         */}
                {/* ============================================================== */}
                {activeTab === "action-plan" && (
                  <div className="space-y-5">
                    {/* Header Tiến độ hoàn thành */}
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

                    {/* Danh sách nhiệm vụ checklist */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-700 uppercase">
                        Các đầu việc đã giao cho sinh viên này:
                      </span>

                      {actionTasks.length === 0 ? (
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
                              onClick={() => handleToggleTask(task.id)}
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

                              <p className="text-[10px] text-slate-400 font-medium mt-1">
                                📅 {task.deadline}
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
                            placeholder="Ví dụ: Nộp bài dự thảo Báo cáo BTL tuần 11, Làm lại bài tập Pipeline..."
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
                          disabled={!newTaskTitle.trim()}
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
