import { useState, useMemo, useEffect } from "react";
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
  GraduationCap,
  Search,
  Building2,
  Plus,
  ListTodo,
  TrendingDown,
  Info,
  CalendarCheck,
  Video,
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
import { useActiveSemester, formatSemesterLabel } from "@/hooks/use-active-semester";
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
  useSessionAppointments,
  useCreateAppointment,
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

export interface GuidanceFeedItem {
  id: string;
  advisorId: string;
  type: "warning" | "office_hours" | "project_guidance" | "message";
  title: string;
  content: string;
  timestamp: string;
  tag: string;
  tagColor: "blue" | "sky" | "emerald" | "amber" | "purple";
  senderName: string;
  senderRole: string;
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
    if (code.includes("2007") || code.includes("2009")) return "Bộ môn Kỹ thuật Máy tính";
    if (code.includes("2017") || code.includes("3011")) return "Bộ môn Hệ thống & Mạng Máy tính";
    if (code.includes("2013") || code.includes("3021")) return "Bộ môn Hệ thống Thông tin";
    return "Khoa Khoa học & Kỹ thuật Máy tính";
  }
  if (code.startsWith("MT")) return "Bộ môn Toán Ứng dụng - Khoa Khoa học Ứng dụng";
  if (code.startsWith("PH")) return "Bộ môn Vật lý Ứng dụng - Khoa Khoa học Ứng dụng";
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

// ==========================================
// Main Component
// ==========================================

export const StudentAdvisingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: user } = useAuthUser();
  const studentId = user?.user_code || user?.id || "2028899";
  const { data: activeSemester } = useActiveSemester();
  const activeSemesterCode = activeSemester?.semester_code || "HK261";
  const activeSemesterLabel = formatSemesterLabel(activeSemesterCode);

  // Data fetching
  const { data: currentCourses, isLoading: isLoadingCourses } = useStudentCurrentCourses(studentId);
  const { data: predictions, isLoading: isLoadingPreds } = useStudentPredictions(studentId, activeSemesterCode);
  const { data: studentDetail } = useStudentDetail(studentId);
  const { data: studentSummary } = useStudentSummary(studentId);

  // Active Tab state (feed | booking | action-plan)
  const [activeTab, setActiveTab] = useState<AdvisingTab>(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "booking" || tabParam === "action-plan") return tabParam;
    return "feed";
  });

  // Search keyword in directory
  const [searchQuery, setSearchQuery] = useState("");

  // Build predictions lookup map
  const predMap = useMemo(() => {
    const map = new Map<string, { risk_level: "HIGH" | "MEDIUM" | "LOW"; fail_prob: number }>();
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

  // Build directory list: Faculty Academic Advisor (pinned) + Course Lecturers
  const advisors = useMemo<AdvisorDirectoryItem[]>(() => {
    const list: AdvisorDirectoryItem[] = [];

    // 1. Primary Faculty Academic Advisor (Pinned)
    const advisorMajor = studentDetail?.major || "Khoa học Máy tính";
    const facultyAdvisor: AdvisorDirectoryItem = {
      id: "advisor-faculty",
      isFacultyAdvisor: true,
      name: "TS. Lê Văn Tuấn",
      title: `Cố vấn Học tập Chuyên ngành ${advisorMajor}`,
      department: "Văn phòng Cố vấn Học vụ - Khoa KH&KT Máy tính",
      office: "P.304 Nhà H6, Cơ sở Dĩ An",
      email: "tuan.le@hcmut.edu.vn",
      phone: "(028) 3864 7256 - Ext: 5842",
      officeHours: "Thứ Hai & Thứ Năm: 08:30 - 11:30",
      availableSlots: [
        "Thứ Hai: 08:30 - 09:30 (Trực tiếp P.304 H6)",
        "Thứ Hai: 10:00 - 11:00 (Trực tiếp P.304 H6)",
        "Thứ Năm: 08:30 - 09:30 (Online Google Meet)",
        "Thứ Năm: 14:00 - 15:30 (Trực tiếp P.304 H6)",
      ],
    };
    list.push(facultyAdvisor);

    // 2. Active Course Lecturers from API
    const validCourses = (currentCourses ?? []).filter((c) => {
      const code = c.course_code.toUpperCase();
      return !code.startsWith("CC") && !code.startsWith("TN") && !code.startsWith("QP");
    });

    if (validCourses.length > 0) {
      for (const course of validCourses) {
        const pred = predMap.get(course.course_code.toUpperCase());
        const lecturerName = course.lecturer_name?.trim() || "Thầy/Cô Phụ trách Môn";
        const emailSlug = lecturerName
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        list.push({
          id: `course-${course.course_code}`,
          isFacultyAdvisor: false,
          name: lecturerName.startsWith("TS.") || lecturerName.startsWith("ThS.") ? lecturerName : `ThS. ${lecturerName}`,
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
          riskLevel: pred?.risk_level || "LOW",
          failProbability: pred?.fail_prob || 0.05,
        });
      }
    } else {
      // Fallback default courses for HK261 if API returns empty
      list.push(
        {
          id: "course-CO2007",
          isFacultyAdvisor: false,
          name: "TS. Bùi Quang Hà",
          title: "Giảng viên phụ trách môn CO2007",
          department: "Bộ môn Kỹ thuật Máy tính",
          courseCode: "CO2007",
          courseName: "Kiến trúc Máy tính",
          classGroup: "CC06",
          credits: 4,
          office: "P.503 Nhà H6, Cơ sở Dĩ An",
          email: "ha.bui@hcmut.edu.vn",
          phone: "(028) 3864 7256 - Ext: 5840",
          officeHours: "Thứ Ba: 14:00 - 16:30 (P.503 H6)",
          availableSlots: [
            "Thứ Ba: 14:00 - 15:00 (Trực tiếp P.503 H6)",
            "Thứ Ba: 15:30 - 16:30 (Trực tiếp P.503 H6)",
            "Thứ Sáu: 09:00 - 10:00 (Online Meet)",
          ],
          riskLevel: "HIGH",
          failProbability: 0.42,
        },
        {
          id: "course-CO2017",
          isFacultyAdvisor: false,
          name: "TS. Nguyễn Đức Dũng",
          title: "Giảng viên phụ trách môn CO2017",
          department: "Bộ môn Hệ thống & Mạng Máy tính",
          courseCode: "CO2017",
          courseName: "Hệ điều hành",
          classGroup: "L01",
          credits: 3,
          office: "P.502 Nhà H6, Cơ sở Dĩ An",
          email: "dung.nguyen@hcmut.edu.vn",
          phone: "(028) 3864 7256 - Ext: 5838",
          officeHours: "Thứ Năm: 13:30 - 15:30 (P.502 H6)",
          availableSlots: [
            "Thứ Năm: 13:30 - 14:30 (Trực tiếp P.502 H6)",
            "Thứ Năm: 14:30 - 15:30 (Trực tiếp P.502 H6)",
          ],
          riskLevel: "MEDIUM",
          failProbability: 0.28,
        },
      );
    }

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

  // Active selected advisor ID
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string>(() => {
    const courseParam = searchParams.get("course");
    if (courseParam) return `course-${courseParam}`;
    return "advisor-faculty";
  });

  const selectedAdvisor = useMemo(() => {
    const found = advisors.find((a) => a.id === selectedAdvisorId);
    return found || advisors[0];
  }, [advisors, selectedAdvisorId]);

  const handleSelectAdvisor = (advisorId: string) => {
    setSelectedAdvisorId(advisorId);
    setCustomSlot(null);
  };

  // Sync tab change with URL search params
  const handleTabChange = (tab: AdvisingTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("tab", tab);
      return p;
    });
  };

  // ==========================================
  // Tab 1: Guidance Feed & Messages State
  // ==========================================

  // Initial Guidance Announcements per advisor
  const defaultFeedMap = useMemo<Record<string, GuidanceFeedItem[]>>(() => {
    return {
      "advisor-faculty": [
        {
          id: "feed-fac-1",
          advisorId: "advisor-faculty",
          type: "warning",
          title: "Định hướng học vụ & kế hoạch học tập giữa kỳ HK261",
          content:
            "Khoa đã cập nhật phân tích học lực sau các bài thi giữa kỳ. Đối với các sinh viên có môn học cần cải thiện điểm số, đề nghị các em chủ động liên hệ giảng viên bộ môn hoặc đăng ký lịch tư vấn với Thầy trong tuần này để xây dựng lộ trình nâng cao kết quả.",
          timestamp: "Hôm nay, 08:30",
          tag: "Định hướng học vụ",
          tagColor: "blue",
          senderName: "TS. Lê Văn Tuấn",
          senderRole: "Cố vấn Học tập Khoa",
        },
        {
          id: "feed-fac-2",
          advisorId: "advisor-faculty",
          type: "office_hours",
          title: "Lịch tiếp sinh viên định kỳ tại Văn phòng Khoa",
          content:
            "Văn phòng cố vấn học vụ mở cửa tiếp sinh viên định kỳ vào sáng Thứ Hai và Thứ Năm hàng tuần (08:30 - 11:30) tại P.304 Nhà H6. Sinh viên cần tư vấn phương án đăng ký môn, cải thiện GPA hoặc gỡ cảnh cáo học vụ có thể đăng ký lịch trước ở Tab Đặt lịch hẹn.",
          timestamp: "10/11/2026, 14:00",
          tag: "Giờ tiếp sinh viên",
          tagColor: "blue",
          senderName: "TS. Lê Văn Tuấn",
          senderRole: "Cố vấn Học tập Khoa",
        },
        {
          id: "feed-fac-3",
          advisorId: "advisor-faculty",
          type: "project_guidance",
          title: "Khảo sát nguyện vọng phân chuyên ngành & Đồ án tốt nghiệp",
          content:
            "Đối với sinh viên chuẩn bị bước vào giai đoạn năm cuối, đề nghị kiểm tra kỹ số tín chỉ tích lũy hiện tại và các môn tiên quyết bắt buộc trước khi đăng ký Hội đồng Khóa luận tốt nghiệp kỳ sau.",
          timestamp: "05/11/2026, 09:15",
          tag: "Lộ trình đào tạo",
          tagColor: "purple",
          senderName: "TS. Lê Văn Tuấn",
          senderRole: "Cố vấn Học tập Khoa",
        },
      ],
      "course-CO2007": [
        {
          id: "feed-co2007-1",
          advisorId: "course-CO2007",
          type: "warning",
          title: "Lưu ý phần kiến thức bài thi Giữa kỳ CO2007",
          content:
            "Thầy nhận thấy qua bài thi giữa kỳ, nhiều bạn còn bị nhầm lẫn giữa Data Hazard và Control Hazard trong kỹ thuật Pipelining, cũng như cách tính Miss Penalty trong bộ nhớ Cache. Các em cần xem lại slide chương 4 và giải lại đề bài tập ôn tập tại LMS tuần 9.",
          timestamp: "Hôm qua, 15:45",
          tag: "Lưu ý bài thi Giữa kỳ",
          tagColor: "sky",
          senderName: "TS. Bùi Quang Hà",
          senderRole: "Giảng viên Phụ trách",
        },
        {
          id: "feed-co2007-2",
          advisorId: "course-CO2007",
          type: "project_guidance",
          title: "Tiến độ Bài tập lớn MIPS & Đánh giá mô phỏng",
          content:
            "Hạn chót nộp Báo cáo giai đoạn 1 (Thiết kế tập lệnh MIPS) vào Chủ nhật tuần 11. Các nhóm cần kiểm tra kỹ kịch bản kiểm thử (Testbench) trên Logisim hoặc Verilog trước khi demo.",
          timestamp: "12/11/2026, 10:20",
          tag: "Tiến độ Bài tập lớn",
          tagColor: "purple",
          senderName: "TS. Bùi Quang Hà",
          senderRole: "Giảng viên Phụ trách",
        },
        {
          id: "feed-co2007-3",
          advisorId: "course-CO2007",
          type: "office_hours",
          title: "Giờ tiếp sinh viên & Phụ đạo thực hành tại Lab",
          content:
            "Thầy sẽ có mặt tại P.503 Nhà H6 vào chiều Thứ Ba từ 14:00 đến 16:30 để giải đáp thắc mắc bài thi và hỗ trợ gỡ lỗi bài tập lớn. Sinh viên có thể ghé trực tiếp hoặc đặt lịch trước.",
          timestamp: "08/11/2026, 09:00",
          tag: "Office Hours",
          tagColor: "blue",
          senderName: "TS. Bùi Quang Hà",
          senderRole: "Giảng viên Phụ trách",
        },
      ],
      "course-CO2017": [
        {
          id: "feed-co2017-1",
          advisorId: "course-CO2017",
          type: "warning",
          title: "Nhắc nhở thực hành Lab Hệ điều hành (xv6 Kernel)",
          content:
            "Yêu cầu sinh viên hoàn thành bài thực hành Lab 2 (Process Scheduling & Mutex Lock) đúng hạn. Đây là nền tảng quan trọng cho 30% nội dung câu hỏi trong đề thi Cuối kỳ.",
          timestamp: "14/11/2026, 11:00",
          tag: "Thực hành Lab",
          tagColor: "amber",
          senderName: "TS. Nguyễn Đức Dũng",
          senderRole: "Giảng viên Phụ trách",
        },
        {
          id: "feed-co2017-2",
          advisorId: "course-CO2017",
          type: "office_hours",
          title: "Thông báo giờ tiếp sinh viên Bộ môn Mạng & Hệ thống",
          content:
            "Văn phòng P.502 Nhà H6 tiếp sinh viên vào chiều Thứ Năm (13:30 - 15:30). Các bạn gặp khó khăn trong việc cài đặt và debug mã nguồn xv6 có thể mang laptop đến để được hỗ trợ.",
          timestamp: "11/11/2026, 16:30",
          tag: "Office Hours",
          tagColor: "blue",
          senderName: "TS. Nguyễn Đức Dũng",
          senderRole: "Giảng viên Phụ trách",
        },
      ],
    };
  }, []);

  // ==========================================
  // Backend Advising Sessions & Queries
  // ==========================================
  const { data: serverSessions } = useAdvisingSessions();
  const createOrGetSessionMutation = useCreateOrGetAdvisingSession();

  const activeSession = useMemo(() => {
    if (!serverSessions || serverSessions.length === 0) return null;
    const targetCourse = selectedAdvisor.courseCode || "CO2007";
    return (
      serverSessions.find((s) => s.course_code === targetCourse) ||
      serverSessions[0] ||
      null
    );
  }, [serverSessions, selectedAdvisor.courseCode]);

  const activeSessionId = activeSession?.id;

  // Real-time Messages from Backend
  const { data: serverMessages } = useSessionMessages(activeSessionId);
  const sendMessageMutation = useSendMessage(activeSessionId);

  // Real-time Appointments from Backend
  const { data: serverAppointments } = useSessionAppointments(activeSessionId);
  const createAppointmentMutation = useCreateAppointment(activeSessionId);

  // Real-time Tasks from Backend
  const { data: serverTasks } = useSessionTasks(activeSessionId);
  const toggleTaskMutation = useToggleTask(activeSessionId);

  // Persisted chat messages state (fallback)
  const messageStorageKey = `aurora_advising_messages_${studentId}`;
  const [messages, setMessages] = useState<DirectMessage[]>(() => {
    try {
      const saved = localStorage.getItem(messageStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: "msg-1",
        advisorId: "course-CO2007",
        sender: "advisor",
        senderName: "TS. Bùi Quang Hà",
        content:
          "Chào em, thầy đã xem điểm thi giữa kỳ của em. Em cần chú ý phần tính toán Cache Hit/Miss ratio để không bị mất điểm đáng tiếc trong bài thi cuối kỳ nhé.",
        timestamp: "Hôm qua 16:00",
      },
      {
        id: "msg-2",
        advisorId: "advisor-faculty",
        sender: "advisor",
        senderName: "TS. Lê Văn Tuấn",
        content:
          "Chào em, kết quả học kỳ này rất quan trọng để đảm bảo tiến độ tốt nghiệp. Em nhớ theo dõi kỹ các bài tập lớn nhé.",
        timestamp: "10/11/2026 14:15",
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(messageStorageKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, messageStorageKey]);

  // Current chat input
  const [chatInput, setChatInput] = useState("");

  // Send a custom message
  const handleSendMessage = async (textToSend?: string, isQuick: boolean = false) => {
    const content = (textToSend || chatInput).trim();
    if (!content) return;

    const newMsg: DirectMessage = {
      id: `msg-${Date.now()}`,
      advisorId: selectedAdvisor.id,
      sender: "student",
      senderName: user?.name || "Sinh viên",
      content,
      timestamp: "Vừa xong",
      isQuickRequest: isQuick,
    };

    setMessages((prev) => [...prev, newMsg]);
    if (!textToSend) setChatInput("");

    // Send to Backend
    try {
      let targetSessionId = activeSessionId;
      if (!targetSessionId) {
        const created = await createOrGetSessionMutation.mutateAsync({
          student_id: studentId,
          course_code: selectedAdvisor.courseCode || "CO2007",
          topic: `Cố vấn học vụ môn ${selectedAdvisor.courseCode || "Chuyên ngành"}`,
          risk_level:
            selectedAdvisor.riskLevel === "HIGH"
              ? "CRITICAL"
              : selectedAdvisor.riskLevel === "MEDIUM"
                ? "WARNING"
                : "SAFE",
          lecturer_id: selectedAdvisor.id.startsWith("course-")
            ? undefined
            : "GV00001",
        });
        targetSessionId = created.id;
      }
      if (targetSessionId) {
        await sendMessageMutation.mutateAsync({
          content,
          message_type: "REPLY",
        });
      }
    } catch {
      // Fallback: message is already kept locally
    }

    toast.success("Đã gửi tin nhắn tới Thầy/Cô thành công!");
  };

  // Quick Request Triggers
  const handleQuickRequest = (type: "materials" | "midterm_review" | "study_group") => {
    let text = "";
    if (type === "materials") {
      text = selectedAdvisor.isFacultyAdvisor
        ? "Dạ kính chào Thầy, em xin Thầy hướng dẫn thêm về quy chế học vụ và tài liệu định hướng lộ trình tốt nghiệp ngành ạ."
        : `Dạ kính chào Thầy, em xin phép nhờ Thầy chia sẻ thêm tài liệu và bộ câu hỏi bài tập ôn tập bổ trợ cho môn ${selectedAdvisor.courseCode} với ạ. Em xin cảm ơn Thầy!`;
    } else if (type === "midterm_review") {
      text = selectedAdvisor.isFacultyAdvisor
        ? "Dạ Thầy cho em xin lời khuyên về phương án gỡ điểm các môn sau kỳ thi giữa kỳ với ạ."
        : `Dạ kính chào Thầy, em muốn xin Thầy giải đáp thắc mắc và xem lại bài thi giữa kỳ môn ${selectedAdvisor.courseCode} để nắm rõ phần kiến thức em còn làm sai ạ.`;
    } else {
      text = selectedAdvisor.isFacultyAdvisor
        ? "Dạ Thầy có thể hỗ trợ kết nối em với các anh chị khóa trên hoặc câu lạc bộ học thuật để sinh hoạt nhóm không ạ?"
        : `Dạ kính chào Thầy, em muốn nhờ Thầy và Ban cán sự hỗ trợ kết nối em vào nhóm học tập (Study Group) của môn ${selectedAdvisor.courseCode} để cùng ôn bài ạ.`;
    }

    handleSendMessage(text, true);
  };

  // Messages for currently selected advisor
  const currentAdvisorMessages = useMemo(() => {
    if (serverMessages && serverMessages.length > 0) {
      return serverMessages.map((m) => ({
        id: m.id,
        advisorId: selectedAdvisor.id,
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
    return messages.filter((m) => m.advisorId === selectedAdvisor.id);
  }, [serverMessages, messages, selectedAdvisor.id]);

  // Guidance feeds for currently selected advisor
  const currentAdvisorFeeds = useMemo(() => {
    return defaultFeedMap[selectedAdvisor.id] || [
      {
        id: `feed-${selectedAdvisor.id}-default`,
        advisorId: selectedAdvisor.id,
        type: "office_hours",
        title: `Lịch tiếp sinh viên môn ${selectedAdvisor.courseCode || "học kỳ"}`,
        content: `Thầy tiếp sinh viên hàng tuần tại ${selectedAdvisor.office} vào khung giờ: ${selectedAdvisor.officeHours}. Các em có câu hỏi chuyên môn vui lòng chuẩn bị trước nội dung.`,
        timestamp: "Hôm nay, 08:00",
        tag: "Office Hours",
        tagColor: "blue",
        senderName: selectedAdvisor.name,
        senderRole: selectedAdvisor.title,
      },
    ];
  }, [defaultFeedMap, selectedAdvisor]);

  // ==========================================
  // Tab 2: Booking State & Logic
  // ==========================================

  const bookingStorageKey = `aurora_advising_bookings_${studentId}`;
  const [appointments, setAppointments] = useState<BookingAppointment[]>(() => {
    try {
      const saved = localStorage.getItem(bookingStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: "book-1",
        advisorId: "advisor-faculty",
        advisorName: "TS. Lê Văn Tuấn",
        subject: "Tư vấn lộ trình đăng ký môn học & phân chuyên ngành",
        timeSlot: "Thứ Năm: 08:30 - 09:30 (Online Google Meet)",
        meetingType: "ONLINE",
        notes: "Em muốn tư vấn về điều kiện làm khóa luận tốt nghiệp kỳ tới.",
        status: "CONFIRMED",
        createdAt: "10/11/2026",
        location: "Google Meet: meet.google.com/xai-aurora-adv",
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(bookingStorageKey, JSON.stringify(appointments));
    } catch {
      // ignore
    }
  }, [appointments, bookingStorageKey]);

  // Booking Form State
  const [selectedReason, setSelectedReason] = useState<string>("Hỏi bài chưa hiểu");
  const [customSlot, setCustomSlot] = useState<string | null>(null);
  const selectedSlot = customSlot || selectedAdvisor.availableSlots[0] || "Thứ Hai: 08:30 - 09:30";
  const [meetingType, setMeetingType] = useState<"OFFICE" | "ONLINE">("OFFICE");
  const [bookingNotes, setBookingNotes] = useState("");

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    const newBooking: BookingAppointment = {
      id: `book-${crypto.randomUUID()}`,
      advisorId: selectedAdvisor.id,
      advisorName: selectedAdvisor.name,
      subject: selectedReason,
      timeSlot: selectedSlot,
      meetingType,
      notes: bookingNotes.trim() || undefined,
      status: "PENDING",
      createdAt: "Hôm nay",
      location:
        meetingType === "OFFICE"
          ? selectedAdvisor.office
          : "Google Meet (Sẽ gửi link qua email sinh viên)",
    };

    setAppointments((prev) => [newBooking, ...prev]);
    setBookingNotes("");
    setCustomSlot(null);

    // Call Backend
    try {
      let targetSessionId = activeSessionId;
      if (!targetSessionId) {
        const created = await createOrGetSessionMutation.mutateAsync({
          student_id: studentId,
          course_code: selectedAdvisor.courseCode || "CO2007",
          topic: `Cố vấn học vụ môn ${selectedAdvisor.courseCode || "Chuyên ngành"}`,
        });
        targetSessionId = created.id;
      }
      if (targetSessionId) {
        await createAppointmentMutation.mutateAsync({
          subject: selectedReason,
          time_slot: selectedSlot,
          meeting_type: meetingType,
          location:
            meetingType === "OFFICE"
              ? selectedAdvisor.office
              : "Google Meet (Sẽ gửi link qua email sinh viên)",
          notes: bookingNotes.trim() || null,
        });
      }
    } catch {
      // Fallback: stored in local appointments
    }

    toast.success("Phiếu hẹn tư vấn đã được gửi thành công!", {
      description: `Lịch hẹn với ${selectedAdvisor.name} đang ở trạng thái Chờ duyệt.`,
    });
  };

  const currentAppointments = useMemo(() => {
    if (serverAppointments && serverAppointments.length > 0) {
      return serverAppointments.map((a) => ({
        id: a.id,
        advisorId: selectedAdvisor.id,
        advisorName: selectedAdvisor.name,
        subject: a.subject,
        timeSlot: a.time_slot,
        meetingType: a.meeting_type,
        notes: a.notes || undefined,
        status: a.status as "CONFIRMED" | "PENDING" | "COMPLETED",
        createdAt: new Date(a.created_at).toLocaleDateString("vi-VN"),
        location: a.location,
      }));
    }
    return appointments;
  }, [serverAppointments, appointments, selectedAdvisor.id, selectedAdvisor.name]);

  const handleCancelAppointment = (id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    toast.info("Đã hủy lịch hẹn tư vấn.");
  };

  // ==========================================
  // Tab 3: Action Plan Tasks State
  // ==========================================

  const actionStorageKey = `aurora_advising_actionplan_${studentId}`;
  const [actionTasks, setActionTasks] = useState<ActionPlanTask[]>(() => {
    try {
      const saved = localStorage.getItem(actionStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: "task-1",
        advisorId: "course-CO2007",
        title: "Rà soát lại bài kiểm tra giữa kỳ CO2007",
        description: "Xem lại câu 3 & câu 4 phần Pipeline Hazard và viết lại bài giải đúng vào vở.",
        deadline: "Hạn chót: 20/11/2026",
        priority: "HIGH",
        completed: true,
      },
      {
        id: "task-2",
        advisorId: "course-CO2007",
        title: "Gặp trợ giảng phụ đạo Lab 3 - Mô phỏng Logisim",
        description: "Nhờ trợ giảng kiểm tra khối ALU và thanh ghi trước khi tiến hành chấm điểm giai đoạn 1.",
        deadline: "Hạn chót: 22/11/2026",
        priority: "HIGH",
        completed: false,
      },
      {
        id: "task-3",
        advisorId: "course-CO2007",
        title: "Hoàn thành bộ câu hỏi ôn tập chương Bộ nhớ Cache trên LMS",
        description: "Đạt tối thiểu 80% điểm quiz trắc nghiệm để củng cố lý thuyết trước kỳ thi cuối kỳ.",
        deadline: "Hạn chót: 28/11/2026",
        priority: "MEDIUM",
        completed: false,
      },
      {
        id: "task-4",
        advisorId: "course-CO2007",
        title: "Nộp dự thảo Báo cáo Bài tập lớn (BTL) Tuần 11",
        description: "Đóng gói mã nguồn MIPS và bản giải trình thiết kế nộp lên hệ thống trước 23:59 Chủ nhật.",
        deadline: "Hạn chót: 30/11/2026",
        priority: "HIGH",
        completed: false,
      },
      {
        id: "task-5",
        advisorId: "advisor-faculty",
        title: "Kiểm tra tiến độ tích lũy tín chỉ học phần tốt nghiệp",
        description: "Rà soát các môn đại cương và chuyên ngành bắt buộc còn thiếu trên sổ tay đào tạo.",
        deadline: "Hạn chót: 30/11/2026",
        priority: "NORMAL",
        completed: true,
      },
      {
        id: "task-6",
        advisorId: "course-CO2017",
        title: "Hoàn thiện bài thực hành Lab xv6 Synchronization",
        description: "Debug bài toán Producer-Consumer bằng Semaphore trong kernel xv6.",
        deadline: "Hạn chót: 25/11/2026",
        priority: "HIGH",
        completed: false,
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(actionStorageKey, JSON.stringify(actionTasks));
    } catch {
      // ignore
    }
  }, [actionTasks, actionStorageKey]);

  // Filter tasks for selected advisor
  const currentAdvisorTasks = useMemo(() => {
    if (serverTasks && serverTasks.length > 0) {
      return serverTasks.map((t) => ({
        id: t.id,
        advisorId: selectedAdvisor.id,
        title: t.title,
        description: t.description || undefined,
        deadline: t.deadline,
        priority: t.priority,
        completed: t.completed,
      }));
    }
    return actionTasks.filter((t) => t.advisorId === selectedAdvisor.id);
  }, [serverTasks, actionTasks, selectedAdvisor.id]);

  // New task input state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"HIGH" | "MEDIUM" | "NORMAL">("HIGH");

  const handleToggleTask = (taskId: string) => {
    const task = currentAdvisorTasks.find((t) => t.id === taskId);
    const nextCompleted = task ? !task.completed : true;

    setActionTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: nextCompleted } : t)),
    );

    if (activeSessionId) {
      toggleTaskMutation.mutate({
        taskId,
        payload: { completed: nextCompleted },
      });
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: ActionPlanTask = {
      id: `task-${Date.now()}`,
      advisorId: selectedAdvisor.id,
      title: newTaskTitle.trim(),
      deadline: "Hạn chót: Cuối kỳ HK261",
      priority: newTaskPriority,
      completed: false,
    };

    setActionTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle("");
    toast.success("Đã thêm nhiệm vụ cải thiện mới!");
  };

  const handleDeleteTask = (taskId: string) => {
    setActionTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const taskCompletionRate = useMemo(() => {
    if (currentAdvisorTasks.length === 0) return 0;
    const done = currentAdvisorTasks.filter((t) => t.completed).length;
    return Math.round((done / currentAdvisorTasks.length) * 100);
  }, [currentAdvisorTasks]);

  const isLoading = isLoadingCourses || isLoadingPreds;

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
            Kênh trao đổi trực tiếp với Cố vấn học tập khoa và Giảng viên phụ trách các môn học đang theo học kỳ này.
          </p>
        </div>

        {/* Quick Academic Standing Overview Badge */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs"
          >
            <UserCheck className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
            <span>MSSV: {studentId}</span>
          </Badge>
          <Badge
            variant="outline"
            className="border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs"
          >
            <GraduationCap className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            <span>GPA: {studentSummary?.cumulative_gpa?.toFixed(2) ?? "3.15"}/4.0</span>
          </Badge>
        </div>
      </div>

      {/* 2. Main Two-Column Layout (1/3 Left, 2/3 Right) */}
      <div className="grid grid-cols-12 gap-6">
        {/* ======================================================== */}
        {/* LEFT COLUMN: Advisors & Lecturers Directory (4/12 cols)  */}
        {/* ======================================================== */}
        <div className="col-span-12 space-y-4 lg:col-span-4">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Danh bạ Thầy / Cô
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Giảng viên môn học & Cố vấn phụ trách
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-[11px] font-semibold text-slate-600">
                  {advisors.length} Thầy Cô
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
                // Skeletons
                <div className="space-y-2.5 py-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
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
                  <p className="text-xs text-slate-500">Không tìm thấy giảng viên phù hợp.</p>
                </div>
              ) : (
                filteredAdvisors.map((advisor) => {
                  const isSelected = selectedAdvisor.id === advisor.id;
                  const isRisk = advisor.riskLevel === "HIGH" || advisor.riskLevel === "MEDIUM";

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
                        <Avatar className={cn(
                          "h-10 w-10 ring-1",
                          advisor.isFacultyAdvisor
                            ? "border-blue-200 ring-blue-400/30"
                            : "border-slate-200 ring-slate-300"
                        )}>
                          <AvatarFallback
                            className={cn(
                              "text-xs font-bold",
                              advisor.isFacultyAdvisor
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-white"
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
                            {advisor.isFacultyAdvisor ? (
                              <Badge className="bg-blue-100 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 shrink-0">
                                Cố vấn Ngành
                              </Badge>
                            ) : (
                              advisor.courseCode && (
                                <Badge variant="outline" className="font-mono text-[10px] font-bold text-slate-700 border-slate-200 shrink-0">
                                  {advisor.courseCode}
                                </Badge>
                              )
                            )}
                          </div>

                          <p className="mt-0.5 truncate text-[11px] text-slate-600 font-medium">
                            {advisor.courseName ? `${advisor.courseName}` : advisor.department}
                          </p>
                        </div>
                      </div>

                      {/* Course specific metadata or Advisor hours */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{advisor.office.split(",")[0]}</span>
                        </span>

                        {isRisk && (
                          <Badge
                            className={cn(
                              "text-[10px] font-semibold shrink-0 gap-1",
                              advisor.riskLevel === "HIGH"
                                ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200"
                            )}
                          >
                            <Info className="h-2.5 w-2.5" />
                            {advisor.riskLevel === "HIGH" ? "Cần hỗ trợ" : "Cần theo dõi"}
                          </Badge>
                        )}
                        {!isRisk && !advisor.isFacultyAdvisor && (
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
                <h4 className="text-xs font-bold text-blue-900">Hướng dẫn Tư vấn Học vụ</h4>
                <p className="text-[11px] leading-relaxed text-blue-800/80">
                  Chọn Thầy/Cô ở danh bạ để xem thông báo riêng, đặt lịch tiếp sinh viên (Office Hours) hoặc theo dõi danh sách việc cần làm để cải thiện kết quả môn học.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: Interactive Workspace (8/12 cols)          */}
        {/* ======================================================== */}
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
                          Cố vấn Trưởng ngành
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700">
                          {selectedAdvisor.courseCode} • {selectedAdvisor.credits} Tín chỉ
                        </Badge>
                      )}
                      {selectedAdvisor.riskLevel === "HIGH" && (
                        <Badge className="bg-blue-50 text-blue-700 text-xs font-semibold border-blue-200">
                          <Info className="mr-1 h-3 w-3 text-blue-600" />
                          Đề xuất tư vấn môn học (Dự báo rủi ro {Math.round((selectedAdvisor.failProbability ?? 0.42) * 100)}%)
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
                        <span className="font-medium text-slate-800">{selectedAdvisor.office}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <a href={`mailto:${selectedAdvisor.email}`} className="text-blue-600 hover:underline">
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

                <Button
                  size="sm"
                  onClick={() => handleTabChange("booking")}
                  className="bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer shadow-2xs shrink-0"
                >
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  Đặt lịch gặp Thầy/Cô
                </Button>
              </div>

              {/* 3 Navigation Tabs */}
              <div className="mt-5 flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => handleTabChange("feed")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
                    activeTab === "feed"
                      ? "border-blue-600 text-blue-600 bg-blue-50/30"
                      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Lời dặn & Hộp thư Trao đổi</span>
                  <Badge variant="secondary" className="text-[10px] font-semibold ml-1">
                    {currentAdvisorFeeds.length}
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("booking")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
                    activeTab === "booking"
                      ? "border-blue-600 text-blue-600 bg-blue-50/30"
                      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
                  )}
                >
                  <CalendarCheck className="h-4 w-4" />
                  <span>Đặt lịch hẹn tiếp sinh viên (Office Hours)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("action-plan")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
                    activeTab === "action-plan"
                      ? "border-blue-600 text-blue-600 bg-blue-50/30"
                      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
                  )}
                >
                  <ListTodo className="h-4 w-4" />
                  <span>Kế hoạch Hành động Cải thiện</span>
                  <Badge variant="secondary" className="text-[10px] font-semibold ml-1">
                    {currentAdvisorTasks.filter((t) => !t.completed).length} việc
                  </Badge>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* ======================================================== */}
          {/* TAB 1: Lời dặn & Lịch sử trao đổi (Feed + Direct Chat)  */}
          {/* ======================================================== */}
          {activeTab === "feed" && (
            <div className="space-y-5">
              {/* Guidance Feed from Advisor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    Lời dặn & Thông báo Định hướng từ {selectedAdvisor.name}
                  </h3>
                  <span className="text-xs text-slate-500">Cập nhật theo tiến độ học kỳ</span>
                </div>

                <div className="space-y-3">
                  {currentAdvisorFeeds.map((feed) => (
                    <Card
                      key={feed.id}
                      className={cn(
                        "border bg-white shadow-xs transition-colors",
                        feed.tagColor === "blue" && "border-blue-200 bg-blue-50/20",
                        feed.tagColor === "sky" && "border-sky-200 bg-sky-50/20",
                        feed.tagColor === "amber" && "border-amber-200 bg-amber-50/20",
                        feed.tagColor === "purple" && "border-purple-200 bg-purple-50/20",
                        feed.tagColor === "emerald" && "border-emerald-200 bg-emerald-50/20",
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                className={cn(
                                  "text-[10px] font-semibold",
                                  feed.tagColor === "blue" && "bg-blue-100 text-blue-700 hover:bg-blue-100",
                                  feed.tagColor === "sky" && "bg-sky-100 text-sky-800 hover:bg-sky-100",
                                  feed.tagColor === "amber" && "bg-amber-100 text-amber-800 hover:bg-amber-100",
                                  feed.tagColor === "purple" && "bg-purple-100 text-purple-700 hover:bg-purple-100",
                                  feed.tagColor === "emerald" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
                                )}
                              >
                                {feed.tag}
                              </Badge>
                              <h4 className="text-xs font-bold text-slate-900">{feed.title}</h4>
                            </div>
                            <p className="text-xs leading-relaxed text-slate-700 pt-1">
                              {feed.content}
                            </p>
                          </div>

                          <span className="text-[11px] font-medium text-slate-400 shrink-0">
                            {feed.timestamp}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

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
                    Bấm để gửi yêu cầu mẫu hoặc câu hỏi nhanh tới Thầy/Cô mà không cần soạn thảo:
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-1">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickRequest("materials")}
                      className="cursor-pointer bg-white text-xs font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700 shadow-2xs gap-1.5 h-8"
                    >
                      <span>📚</span>
                      <span>Xin tài liệu / Bài tập ôn tập bổ trợ</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickRequest("midterm_review")}
                      className="cursor-pointer bg-white text-xs font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700 shadow-2xs gap-1.5 h-8"
                    >
                      <span>📝</span>
                      <span>Xin giải đáp thắc mắc bài thi giữa kỳ</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
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
                    <span className="text-[11px] text-slate-400">
                      Đối thoại với {selectedAdvisor.name}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Messages Feed */}
                  <div className="space-y-3 min-h-48 max-h-96 overflow-y-auto pr-1">
                    {currentAdvisorMessages.length === 0 ? (
                      <div className="py-8 text-center">
                        <MessageSquare className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                        <p className="text-xs text-slate-500 font-medium">
                          Chưa có tin nhắn nào với Thầy/Cô.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Em có thể chọn một Yêu cầu Nhanh ở trên hoặc nhập câu hỏi bên dưới.
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
                              isStudent ? "ml-auto flex-row-reverse" : "mr-auto",
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
                                {msg.isQuickRequest && (
                                  <div className="mb-1 text-[10px] font-semibold text-blue-100 flex items-center gap-1">
                                    <Sparkles className="h-2.5 w-2.5" />
                                    <span>Yêu cầu nhanh</span>
                                  </div>
                                )}
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              </div>
                              <div
                                className={cn(
                                  "text-[10px] text-slate-400 px-1",
                                  isStudent ? "text-right" : "text-left",
                                )}
                              >
                                {msg.senderName} • {msg.timestamp}
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
                      handleSendMessage();
                    }}
                    className="flex items-center gap-2 pt-2 border-t border-slate-100"
                  >
                    <Input
                      type="text"
                      placeholder={`Nhập tin nhắn / câu hỏi gửi tới ${selectedAdvisor.name}...`}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="h-10 text-xs border-slate-200 focus-visible:ring-blue-500"
                    />
                    <Button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="h-10 bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer shadow-2xs shrink-0"
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Gửi tin
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: Đặt lịch hẹn tiếp sinh viên (Office Hours Booking) */}
          {/* ======================================================== */}
          {activeTab === "booking" && (
            <div className="space-y-5">
              {/* Booking Form Card */}
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      Phiếu Đăng ký Hẹn gặp Tư vấn
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Đặt lịch tư vấn học vụ hoặc giải đáp chuyên môn trực tiếp với {selectedAdvisor.name}.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-0">
                  <form onSubmit={handleCreateBooking} className="space-y-4">
                    {/* Reason Selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">
                        1. Mục đích hẹn gặp <span className="text-blue-600">*</span>
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {[
                          { id: "r1", label: "Hỏi bài chưa hiểu / giải đáp chuyên môn", icon: BookOpen },
                          { id: "r2", label: "Xin hướng dẫn bài tập lớn / đồ án", icon: Sparkles },
                          { id: "r3", label: "Tư vấn phương án gỡ điểm rớt môn", icon: TrendingDown },
                          { id: "r4", label: "Tư vấn lộ trình & đăng ký môn kỳ sau", icon: GraduationCap },
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
                        2. Chọn Khung giờ tiếp sinh viên (Office Hours khả dụng) <span className="text-blue-600">*</span>
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
                          <span>Gặp trực tiếp tại Văn phòng ({selectedAdvisor.office.split(",")[0]})</span>
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
                        4. Nội dung cần chuẩn bị trước / Ghi chú cho Thầy Cô (Tùy chọn)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Ví dụ: Em muốn hỏi về phần bài tập 4 chương Pipeline và xin định hướng cách làm bài tập lớn..."
                        value={bookingNotes}
                        onChange={(e) => setBookingNotes(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        className="bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer shadow-2xs px-5 h-9"
                      >
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        Gửi Phiếu Hẹn Tư Vấn
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

                {currentAppointments.length === 0 ? (
                  <Card className="border-slate-200 bg-white p-6 text-center shadow-xs">
                    <p className="text-xs text-slate-500">Chưa có phiếu hẹn nào được đăng ký.</p>
                  </Card>
                ) : (
                  <div className="space-y-2.5">
                    {currentAppointments.map((apt) => (
                      <Card key={apt.id} className="border-slate-200 bg-white shadow-xs">
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{apt.subject}</span>
                                {apt.status === "CONFIRMED" ? (
                                  <Badge className="bg-emerald-100 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                                    <CheckCircle2 className="mr-1 h-3 w-3" /> Đã xác nhận
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 border-amber-200">
                                    <Clock className="mr-1 h-3 w-3" /> Đang chờ duyệt
                                  </Badge>
                                )}
                              </div>

                              <p className="text-xs font-medium text-slate-600">
                                Với Thầy/Cô: <span className="font-semibold text-slate-900">{apt.advisorName}</span>
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

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelAppointment(apt.id)}
                              className="text-xs text-slate-400 hover:text-rose-600 cursor-pointer self-start sm:self-center"
                            >
                              Hủy lịch
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: Kế hoạch Hành động Cải thiện (Action Plan)         */}
          {/* ======================================================== */}
          {activeTab === "action-plan" && (
            <div className="space-y-5">
              {/* Progress Summary Card */}
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <ListTodo className="h-5 w-5 text-blue-600" />
                        <h3 className="text-sm font-bold text-slate-900">
                          Tiến độ Kế hoạch Cải thiện — {selectedAdvisor.courseCode ? selectedAdvisor.courseCode : "Định hướng Học vụ"}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Checklist các đầu việc do Cố vấn & Giảng viên gợi ý để bù đắp kiến thức và tối ưu hóa kết quả thi.
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xl font-extrabold text-slate-900">
                        {taskCompletionRate}%
                      </span>
                      <span className="text-xs text-slate-500 ml-1">Hoàn thành</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Progress value={taskCompletionRate} className="h-2 bg-slate-100" />
                  </div>
                </CardContent>
              </Card>

              {/* Tasks Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">
                    Danh sách Nhiệm vụ Cần làm ({currentAdvisorTasks.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Tích chọn để đánh dấu hoàn thành
                  </span>
                </div>

                {currentAdvisorTasks.length === 0 ? (
                  <Card className="border-slate-200 bg-white p-6 text-center shadow-xs">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                    <p className="text-xs text-slate-600 font-semibold">
                      Chưa có nhiệm vụ cụ thể nào được giao cho môn này.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Em có thể tự thêm nhiệm vụ cá nhân ở biểu mẫu bên dưới.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {currentAdvisorTasks.map((task) => (
                      <div
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleToggleTask(task.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleToggleTask(task.id);
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
                          <button
                            type="button"
                            aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}
                            className="mt-0.5 text-slate-400 group-hover:text-blue-600 shrink-0 cursor-pointer"
                          >
                            {task.completed ? (
                              <CheckSquare className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>

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

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            className={cn(
                              "text-[10px] font-semibold",
                              task.priority === "HIGH" && "bg-blue-100 text-blue-800 hover:bg-blue-100",
                              task.priority === "MEDIUM" && "bg-amber-100 text-amber-800 hover:bg-amber-100",
                              task.priority === "NORMAL" && "bg-slate-100 text-slate-700 hover:bg-slate-100",
                            )}
                          >
                            {task.priority === "HIGH"
                              ? "Ưu tiên cao"
                              : task.priority === "MEDIUM"
                                ? "Trung bình"
                                : "Khuyến nghị"}
                          </Badge>

                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }}
                            className="h-6 w-6 text-slate-300 hover:text-rose-600 cursor-pointer"
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Task Form */}
              <Card className="border-slate-200 bg-slate-50/70 shadow-2xs">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-blue-600" />
                    <CardTitle className="text-xs font-bold text-slate-900">
                      Thêm Nhiệm vụ Cải thiện Cá nhân
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-1">
                  <form onSubmit={handleAddTask} className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <Input
                      type="text"
                      placeholder="Nhập tên việc cần làm (ví dụ: Nộp bài tập lớn trước tuần 12)..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="h-9 flex-1 text-xs bg-white border-slate-200 focus-visible:ring-blue-500"
                    />

                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as "HIGH" | "MEDIUM" | "NORMAL")}
                      className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="HIGH">Ưu tiên cao</option>
                      <option value="MEDIUM">Trung bình</option>
                      <option value="NORMAL">Khuyến nghị</option>
                    </select>

                    <Button
                      type="submit"
                      disabled={!newTaskTitle.trim()}
                      className="h-9 bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer shadow-2xs shrink-0"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Thêm việc
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Backward-compatibility alias
export const StudentAlertsPage = StudentAdvisingPage;
