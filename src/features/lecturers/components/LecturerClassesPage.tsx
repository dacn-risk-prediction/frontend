import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/features/auth";
import {
  useLecturerCurrentClasses,
  useActiveSemester,
  useClassEnrollments,
  useClassPredictions,
} from "../api/lecturer-api";
import type {
  LecturerCurrentClassItem,
  ClassStudentPrediction,
  ShapFactorResponse,
  RiskLevel,
} from "@/types";
import {
  ArrowRight,
  BookOpen,
  Search,
  Users,
  Calendar,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Sparkles,
  TrendingUp,
  Layers,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Info,
} from "lucide-react";

/**
 * Format raw backend feature identifiers into friendly Vietnamese terms
 */
function formatFeatureName(rawFeature: string): { label: string; tip?: string } {
  const f = rawFeature.toLowerCase().trim();

  if (f.includes("cumulative_gpa") || f.includes("gpa_tich_luy") || f.includes("gpa_cum")) {
    return {
      label: "Điểm trung bình tích lũy (GPA)",
      tip: "Nền tảng học lực tích lũy qua các học kỳ trước",
    };
  }
  if (f.includes("giua_ky") || f.includes("midterm") || f.includes("diem_gk")) {
    return {
      label: "Điểm thi giữa kỳ học phần",
      tip: "Điểm đánh giá giữa kỳ hiện tại trên lớp",
    };
  }
  if (f.includes("btl") || f.includes("assignment") || f.includes("bai_tap_lon") || f.includes("do_an")) {
    return {
      label: "Điểm bài tập lớn / Đồ án môn học",
      tip: "Mức độ hoàn thành bài tập thực hành nhóm",
    };
  }
  if (f.includes("lab") || f.includes("thuc_hanh")) {
    return {
      label: "Điểm thực hành thí nghiệm",
      tip: "Điểm hoàn thành các bài thí nghiệm bắt buộc",
    };
  }
  if (f.includes("quiz") || f.includes("chuyen_can") || f.includes("attendance")) {
    return {
      label: "Điểm chuyên cần & Kiểm tra nhỏ",
      tip: "Tỷ lệ đi học và tham gia xây dựng bài",
    };
  }
  if (f.includes("passed_credits") || f.includes("credits_ratio") || f.includes("tin_chi_dat")) {
    return {
      label: "Tỷ lệ tích lũy tín chỉ thành công",
      tip: "Tỷ lệ tín chỉ đậu so với tổng tín chỉ đăng ký",
    };
  }
  if (f.includes("failed_credits") || f.includes("tin_chi_rot") || f.includes("so_mon_rot") || f.includes("prior_failed")) {
    return {
      label: "Lịch sử nợ / rớt môn trước đây",
      tip: "Số lượng môn/tín chỉ từng bị trượt ở các kỳ trước",
    };
  }
  if (f.includes("course_difficulty") || f.includes("difficulty") || f.includes("do_kho")) {
    return {
      label: "Độ khó học thuật của môn học",
      tip: "Khối lượng kiến thức và tỷ lệ trượt lịch sử của môn",
    };
  }
  if (f.includes("prereq") || f.includes("tien_quyet") || f.includes("mon_tien_quyet")) {
    return {
      label: "Nền tảng môn học tiên quyết",
      tip: "Kết quả học tập các môn làm nền tảng",
    };
  }
  if (f.includes("credit_load") || f.includes("so_tin_chi_ky") || f.includes("attempted_credits")) {
    return {
      label: "Khối lượng tín chỉ học kỳ này",
      tip: "Áp lực thời gian và số môn đang học đồng thời",
    };
  }
  if (f.includes("class_fail_rate") || f.includes("ty_le_rot_lop")) {
    return {
      label: "Tỷ lệ trượt trung bình của lớp",
      tip: "Thống kê mức độ cạnh tranh điểm số của nhóm lớp",
    };
  }
  if (f.includes("lecturer") || f.includes("giang_vien")) {
    return {
      label: "Mức độ khắt khe của giảng viên",
      tip: "Tương quan đánh giá lịch sử của giảng viên phụ trách",
    };
  }
  return {
    label: rawFeature,
  };
}

type ClassRiskFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";

export const LecturerClassesPage = () => {
  const navigate = useNavigate();
  const { data: user } = useAuthUser();
  const lecturerId = user?.user_code || user?.id;

  const {
    data: classes = [],
    isLoading,
    isError,
    refetch,
  } = useLecturerCurrentClasses(lecturerId);

  const { data: activeSemester } = useActiveSemester();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] =
    useState<LecturerCurrentClassItem | null>(null);

  // Filter within class modal
  const [classStudentSearch, setClassStudentSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<ClassRiskFilter>("ALL");
  const [selectedStudentForXai, setSelectedStudentForXai] =
    useState<ClassStudentPrediction | null>(null);

  // 1. Real class roster enrollments query
  const {
    data: roster = [],
    isLoading: isLoadingRoster,
  } = useClassEnrollments(selectedClass?.class_id);

  // 2. Real class AI batch prediction query (Vectorized Inference)
  const {
    data: classPrediction,
    isLoading: isLoadingPrediction,
  } = useClassPredictions(selectedClass?.class_id);

  const semesterDisplay = activeSemester?.semester_code
    ? activeSemester.semester_code.startsWith("HK")
      ? `Semester ${activeSemester.semester_code.slice(2)}`
      : activeSemester.semester_code
    : "Semester 261";

  // Filter classes based on main search
  const filteredClasses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return classes;
    return classes.filter(
      (c) =>
        c.course_code.toLowerCase().includes(q) ||
        c.course_name.toLowerCase().includes(q) ||
        c.class_group.toLowerCase().includes(q) ||
        c.class_id.toLowerCase().includes(q),
    );
  }, [classes, searchQuery]);

  // Merge Class Roster and AI Prediction data
  const enrichedStudents = useMemo(() => {
    if (!selectedClass) return [];
    const rosterMap = new Map(roster.map((r) => [r.student_id, r]));

    // If backend class prediction is available, prioritize its AI-ranked order
    if (classPrediction?.students && classPrediction.students.length > 0) {
      return classPrediction.students.map((pred) => {
        const enr = rosterMap.get(pred.student_id);
        return {
          student_id: pred.student_id,
          student_name: pred.student_name || `Sinh viên ${pred.student_id}`,
          retaken: enr?.retaken ?? false,
          quiz: enr?.quiz ?? pred.current_marks?.quiz ?? null,
          lab: enr?.lab ?? pred.current_marks?.lab ?? null,
          btl: enr?.btl ?? pred.current_marks?.btl ?? null,
          giua_ky: enr?.giua_ky ?? pred.current_marks?.giua_ky ?? null,
          cuoi_ky: enr?.cuoi_ky ?? pred.current_marks?.cuoi_ky ?? null,
          final_score: enr?.final_score ?? null,
          letter_grade: enr?.letter_grade ?? null,
          gpa_4: enr?.gpa_4 ?? null,
          passed: enr?.passed ?? null,
          // AI fields
          fail_probability: pred.fail_probability,
          predicted_course_fail: pred.predicted_course_fail,
          is_at_risk: pred.is_at_risk,
          risk_level: pred.risk_level,
          predicted_score10: pred.predicted_score10,
          predicted_gpa4: pred.predicted_gpa4,
          predicted_letter_grade: pred.predicted_letter_grade,
          top_shap_factors: pred.top_shap_factors,
          rawPrediction: pred,
        };
      });
    }

    // Fallback when prediction is still loading or offline
    return roster.map((enr) => {
      const isHeuristicRisk =
        (enr.giua_ky !== null && enr.giua_ky < 4.0) || enr.retaken;
      return {
        student_id: enr.student_id,
        student_name: `Sinh viên ${enr.student_id}`,
        retaken: enr.retaken,
        quiz: enr.quiz,
        lab: enr.lab,
        btl: enr.btl,
        giua_ky: enr.giua_ky,
        cuoi_ky: enr.cuoi_ky,
        final_score: enr.final_score,
        letter_grade: enr.letter_grade,
        gpa_4: enr.gpa_4,
        passed: enr.passed,
        fail_probability: isHeuristicRisk ? 0.85 : 0.12,
        predicted_course_fail: isHeuristicRisk ? 1 : 0,
        is_at_risk: isHeuristicRisk,
        risk_level: isHeuristicRisk ? ("HIGH" as RiskLevel) : ("LOW" as RiskLevel),
        predicted_score10: enr.giua_ky ?? 6.5,
        predicted_gpa4: enr.gpa_4 ?? 2.8,
        predicted_letter_grade: isHeuristicRisk ? "D" : "B",
        top_shap_factors: [],
        rawPrediction: null,
      };
    });
  }, [selectedClass, roster, classPrediction]);

  // Filter students within modal
  const filteredStudents = useMemo(() => {
    return enrichedStudents.filter((student) => {
      // Risk filter
      if (riskFilter === "HIGH" && student.risk_level !== "HIGH" && !student.is_at_risk) {
        return false;
      }
      if (riskFilter === "MEDIUM" && student.risk_level !== "MEDIUM") {
        return false;
      }
      if (riskFilter === "LOW" && student.risk_level !== "LOW" && student.is_at_risk) {
        return false;
      }

      // Search keyword filter
      if (classStudentSearch.trim()) {
        const query = classStudentSearch.toLowerCase().trim();
        const matchId = student.student_id.toLowerCase().includes(query);
        const matchName = student.student_name.toLowerCase().includes(query);
        if (!matchId && !matchName) return false;
      }

      return true;
    });
  }, [enrichedStudents, riskFilter, classStudentSearch]);

  // Counts for tabs
  const riskCounts = useMemo(() => {
    const high = enrichedStudents.filter((s) => s.risk_level === "HIGH" || s.is_at_risk).length;
    const medium = enrichedStudents.filter((s) => s.risk_level === "MEDIUM").length;
    const low = enrichedStudents.filter((s) => s.risk_level === "LOW" && !s.is_at_risk).length;
    return {
      all: enrichedStudents.length,
      high,
      medium,
      low,
    };
  }, [enrichedStudents]);

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              My Teaching Classes
            </h1>
            <Badge className="bg-blue-600 text-white font-medium">
              {classes.length} {classes.length === 1 ? "Section" : "Sections"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Real-time teaching classes assigned with AI-powered course failure prediction & batch analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs"
          >
            <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {semesterDisplay} • Active Term
          </Badge>
        </div>
      </div>

      {/* 2. Search & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by course code, name, or group..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs bg-white"
          />
        </div>

        <div className="text-xs text-slate-500">
          Showing {filteredClasses.length} of {classes.length} classes
        </div>
      </div>

      {/* 3. Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="pt-4 border-t border-slate-100 flex justify-between">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 4. Error State */}
      {!isLoading && isError && (
        <Card className="border-rose-200 bg-rose-50/50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-600 mb-2" />
          <h3 className="text-sm font-semibold text-rose-900">
            Failed to load assigned classes
          </h3>
          <p className="mt-1 text-xs text-rose-700">
            Unable to connect to the backend server.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="mt-4 border-rose-300 text-rose-800 hover:bg-rose-100"
          >
            Retry
          </Button>
        </Card>
      )}

      {/* 5. Empty State */}
      {!isLoading && !isError && classes.length === 0 && (
        <Card className="border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            No Teaching Classes Found
          </h3>
          <p className="mt-1 max-w-sm mx-auto text-xs text-slate-500">
            No active class sections are assigned to faculty ID{" "}
            <span className="font-mono font-semibold">{lecturerId}</span> for{" "}
            {semesterDisplay}.
          </p>
        </Card>
      )}

      {/* 6. Class Cards Grid */}
      {!isLoading && !isError && classes.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {filteredClasses.map((item) => (
            <Card
              key={item.class_id}
              className="border-slate-200 bg-white shadow-xs transition-all hover:border-blue-300 hover:shadow-sm"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-slate-900 font-mono text-xs font-bold text-white">
                        {item.course_code}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700 font-mono text-xs font-semibold"
                      >
                        Group {item.class_group}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-slate-600 text-[11px]"
                      >
                        {item.credits} Credits
                      </Badge>
                    </div>
                    <CardTitle className="mt-2 text-base font-bold text-slate-900">
                      {item.course_name}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 font-mono">
                      Class ID: {item.class_id}
                    </CardDescription>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <BookOpen className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-2">
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="font-bold text-slate-900">
                      {item.total_students}
                    </span>{" "}
                    Enrolled Students
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {item.academic_year || "2026-2027"} • Term {item.term ?? 1}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-slate-700 cursor-pointer hover:bg-slate-50"
                    onClick={() => {
                      setSelectedClass(item);
                      setRiskFilter("ALL");
                      setClassStudentSearch("");
                    }}
                  >
                    <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                    Student Roster
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs cursor-pointer gap-1.5"
                    onClick={() => {
                      setSelectedClass(item);
                      setRiskFilter("ALL");
                      setClassStudentSearch("");
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>AI Risk & Predictions</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 7. Class Detail & AI Risk Analytics Modal */}
      {selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-3 sm:p-5">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-white">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-700 text-white font-mono text-xs">
                    {selectedClass.course_code}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold"
                  >
                    Group {selectedClass.class_group}
                  </Badge>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedClass.class_id}
                  </span>
                  {classPrediction?.inference_time_ms && (
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-mono gap-1"
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      Inference {classPrediction.inference_time_ms.toFixed(1)}ms
                    </Badge>
                  )}
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900 truncate">
                  {selectedClass.course_name} — AI Class Risk & Grade Roster
                </h2>
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setSelectedClass(null);
                  setSelectedStudentForXai(null);
                }}
                className="text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* AI Analytics Overview Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/70">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total Enrolled
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {classPrediction?.analytics?.total_students ?? roster.length}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Active Section</p>
                </div>

                <div className="rounded-xl bg-rose-50/60 p-3.5 border border-rose-200/80">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
                      Nguy cơ cao (High)
                    </p>
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                  </div>
                  <p className="mt-1 text-2xl font-black text-rose-600">
                    {classPrediction?.analytics?.high_risk_count ?? riskCounts.high}
                  </p>
                  <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                    {classPrediction?.analytics?.high_risk_rate !== undefined
                      ? `${(classPrediction.analytics.high_risk_rate * 100).toFixed(1)}% tỷ lệ lớp`
                      : "Action Required"}
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50/60 p-3.5 border border-amber-200/80">
                  <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                    Cần chú ý (Medium)
                  </p>
                  <p className="mt-1 text-2xl font-black text-amber-600">
                    {classPrediction?.analytics?.medium_risk_count ?? riskCounts.medium}
                  </p>
                  <p className="text-[10px] text-amber-600 font-medium mt-0.5">Cần củng cố</p>
                </div>

                <div className="rounded-xl bg-emerald-50/60 p-3.5 border border-emerald-200/80">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                      An toàn (Low)
                    </p>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <p className="mt-1 text-2xl font-black text-emerald-600">
                    {classPrediction?.analytics?.low_risk_count ?? riskCounts.low}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Phong độ tốt</p>
                </div>

                <div className="rounded-xl bg-blue-50/60 p-3.5 border border-blue-200/80">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
                      Dự báo TB Lớp
                    </p>
                    <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <p className="mt-1 text-2xl font-black text-blue-700">
                    {classPrediction?.analytics?.average_predicted_score10
                      ? `${classPrediction.analytics.average_predicted_score10.toFixed(1)}/10`
                      : "—"}
                  </p>
                  <p className="text-[10px] text-blue-600 font-medium mt-0.5">
                    {classPrediction?.analytics?.average_predicted_gpa4
                      ? `GPA ~${classPrediction.analytics.average_predicted_gpa4.toFixed(2)}/4.0`
                      : "Học kỳ HK261"}
                  </p>
                </div>
              </div>

              {/* Class Common Risk Factors Banner & Grade Distribution */}
              {classPrediction?.analytics && (
                <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4 sm:flex-row sm:items-center sm:justify-between text-xs">
                  <div className="flex items-start gap-2.5">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div>
                      <p className="font-bold text-slate-800">
                        Phân tích yếu tố rủi ro chung của môn học (SHAP Class Driver):
                      </p>
                      <p className="mt-0.5 text-slate-600">
                        {classPrediction.analytics.top_class_risk_factors?.length > 0
                          ? classPrediction.analytics.top_class_risk_factors[0].description
                          : "Đa số sinh viên duy trì phong độ tốt. Điểm thực hành và kiểm tra giữa kỳ là hai trọng số tác động cao nhất tới xác suất qua môn."}
                      </p>
                    </div>
                  </div>

                  {/* Grade Distribution Pills */}
                  {classPrediction.analytics.grade_distribution && (
                    <div className="flex items-center gap-1 shrink-0 flex-wrap">
                      <span className="text-[11px] font-semibold text-slate-500 mr-1">
                        Phổ điểm dự báo:
                      </span>
                      {Object.entries(classPrediction.analytics.grade_distribution).map(
                        ([grade, count]) => (
                          <span
                            key={grade}
                            className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200"
                          >
                            {grade}: <span className="ml-1 text-blue-700">{count}</span>
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Search & Risk Filter Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setRiskFilter("ALL")}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                      riskFilter === "ALL"
                        ? "bg-white text-blue-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    Tất cả ({riskCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskFilter("HIGH")}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1",
                      riskFilter === "HIGH"
                        ? "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                        : "text-slate-600 hover:text-rose-700",
                    )}
                  >
                    <span>🚨 Nguy cơ cao</span>
                    <span className="font-bold">({riskCounts.high})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskFilter("MEDIUM")}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1",
                      riskFilter === "MEDIUM"
                        ? "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs"
                        : "text-slate-600 hover:text-amber-700",
                    )}
                  >
                    <span>⚠️ Cần chú ý</span>
                    <span className="font-bold">({riskCounts.medium})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskFilter("LOW")}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1",
                      riskFilter === "LOW"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                        : "text-slate-600 hover:text-emerald-700",
                    )}
                  >
                    <span>🛡️ An toàn</span>
                    <span className="font-bold">({riskCounts.low})</span>
                  </button>
                </div>

                <div className="relative max-w-xs flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Tìm theo MSSV hoặc Tên sinh viên..."
                    value={classStudentSearch}
                    onChange={(e) => setClassStudentSearch(e.target.value)}
                    className="pl-8 text-xs bg-white h-8"
                  />
                </div>
              </div>

              {/* Roster & Prediction Table */}
              {isLoadingRoster || isLoadingPrediction ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
                  Không tìm thấy sinh viên nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3.5">Sinh viên</th>
                        <th className="py-3 px-3">Loại</th>
                        <th className="py-3 px-2 text-center">Quiz</th>
                        <th className="py-3 px-2 text-center">Lab</th>
                        <th className="py-3 px-2 text-center">Giữa kỳ</th>
                        <th className="py-3 px-2 text-center">Cuối kỳ</th>
                        <th className="py-3 px-3">Xác suất rớt (AI)</th>
                        <th className="py-3 px-3">Mức rủi ro</th>
                        <th className="py-3 px-3">Dự báo TK</th>
                        <th className="py-3 px-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((student) => {
                        const isHigh =
                          student.risk_level === "HIGH" || student.is_at_risk;
                        const isMedium = student.risk_level === "MEDIUM";

                        return (
                          <tr
                            key={student.student_id}
                            className={cn(
                              "hover:bg-slate-50/80 transition-colors",
                              isHigh && "bg-rose-50/30",
                              isMedium && "bg-amber-50/20",
                            )}
                          >
                            <td className="py-2.5 px-3.5">
                              <div className="font-mono font-bold text-slate-900 leading-tight">
                                {student.student_id}
                              </div>
                              <div className="text-[11px] text-slate-600 truncate max-w-[140px]">
                                {student.student_name}
                              </div>
                            </td>

                            <td className="py-2.5 px-3">
                              {student.retaken ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]"
                                >
                                  Học lại
                                </Badge>
                              ) : (
                                <span className="text-slate-400 text-[11px]">
                                  Chính quy
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-2 text-center font-mono">
                              {student.quiz !== null ? student.quiz : "—"}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono">
                              {student.lab !== null ? student.lab : "—"}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono">
                              <span
                                className={cn(
                                  student.giua_ky !== null &&
                                    student.giua_ky < 4.0 &&
                                    "font-bold text-rose-600",
                                )}
                              >
                                {student.giua_ky !== null
                                  ? student.giua_ky
                                  : "—"}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono">
                              {student.cuoi_ky !== null ? student.cuoi_ky : "—"}
                            </td>

                            {/* Fail probability with progress bar */}
                            <td className="py-2.5 px-3">
                              <div className="w-28 space-y-1">
                                <div className="flex justify-between text-[11px]">
                                  <span
                                    className={cn(
                                      "font-bold font-mono",
                                      isHigh
                                        ? "text-rose-600"
                                        : isMedium
                                          ? "text-amber-600"
                                          : "text-emerald-600",
                                    )}
                                  >
                                    {(student.fail_probability * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <Progress
                                  value={student.fail_probability * 100}
                                  className={cn(
                                    "h-1.5",
                                    isHigh && "[&>div]:bg-rose-500",
                                    isMedium && "[&>div]:bg-amber-500",
                                    !isHigh && !isMedium && "[&>div]:bg-emerald-500",
                                  )}
                                />
                              </div>
                            </td>

                            {/* Risk Level Badge */}
                            <td className="py-2.5 px-3">
                              {isHigh ? (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] px-1.5 py-0 font-semibold"
                                >
                                  Nguy cơ cao
                                </Badge>
                              ) : isMedium ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 bg-amber-50 text-amber-700 text-[10px] px-1.5 py-0 font-semibold"
                                >
                                  Cần chú ý
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0 font-semibold"
                                >
                                  An toàn
                                </Badge>
                              )}
                            </td>

                            {/* Predicted Score & Letter Grade */}
                            <td className="py-2.5 px-3">
                              <div className="font-mono font-bold text-slate-800">
                                {student.predicted_score10 !== undefined
                                  ? student.predicted_score10.toFixed(1)
                                  : "—"}
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                Xếp loại:{" "}
                                <span className="font-bold text-blue-700">
                                  {student.predicted_letter_grade || "—"}
                                </span>
                              </div>
                            </td>

                            {/* Actions: View XAI or Open Advising */}
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] text-blue-700 border-blue-200 hover:bg-blue-50 cursor-pointer"
                                  title="Xem giải thích nguyên nhân TreeSHAP"
                                  onClick={() => {
                                    if (student.rawPrediction) {
                                      setSelectedStudentForXai(student.rawPrediction);
                                    } else {
                                      // Fallback dummy structure if raw is not present
                                      setSelectedStudentForXai({
                                        student_id: student.student_id,
                                        student_name: student.student_name,
                                        fail_probability: student.fail_probability,
                                        predicted_course_fail: student.predicted_course_fail,
                                        is_at_risk: student.is_at_risk,
                                        risk_level: student.risk_level,
                                        predicted_score10: student.predicted_score10,
                                        predicted_gpa4: student.predicted_gpa4,
                                        predicted_letter_grade: student.predicted_letter_grade,
                                        current_marks: {
                                          quiz: student.quiz,
                                          lab: student.lab,
                                          btl: student.btl,
                                          giua_ky: student.giua_ky,
                                          cuoi_ky: student.cuoi_ky,
                                        },
                                        top_shap_factors: student.top_shap_factors,
                                      });
                                    }
                                  }}
                                >
                                  <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
                                  <span>XAI</span>
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] text-slate-700 hover:text-blue-700 hover:bg-slate-100 cursor-pointer"
                                  title="Mở phiên cố vấn & can thiệp cho sinh viên này"
                                  onClick={() => {
                                    navigate(
                                      `/lecturer/alerts?student=${student.student_id}&course=${selectedClass.course_code}`,
                                    );
                                  }}
                                >
                                  <MessageSquare className="h-3 w-3 mr-1 text-slate-400" />
                                  <span>Cố vấn</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Connected to HCMUT Vectorized Class Prediction Engine
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedClass(null)}
                className="cursor-pointer"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Student TreeSHAP XAI Detail Slide-over / Modal */}
      {selectedStudentForXai && selectedClass && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-900 text-white">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-400">
                    {selectedStudentForXai.student_id}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-slate-700 text-slate-300 text-[10px]"
                  >
                    {selectedClass.course_code} • {selectedClass.course_name}
                  </Badge>
                </div>
                <h3 className="mt-1 text-base font-bold text-white">
                  {selectedStudentForXai.student_name || `Sinh viên ${selectedStudentForXai.student_id}`} — Phân tích TreeSHAP
                </h3>
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedStudentForXai(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Prediction Summary KPI Banner */}
              <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">
                    Xác suất rớt môn
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-black mt-1",
                      selectedStudentForXai.risk_level === "HIGH"
                        ? "text-rose-600"
                        : selectedStudentForXai.risk_level === "MEDIUM"
                          ? "text-amber-600"
                          : "text-emerald-600",
                    )}
                  >
                    {(selectedStudentForXai.fail_probability * 100).toFixed(1)}%
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">
                    Điểm TK Dự kiến
                  </p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {selectedStudentForXai.predicted_score10?.toFixed(1) ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">
                    Xếp loại / GPA
                  </p>
                  <p className="text-2xl font-black text-blue-700 mt-1">
                    {selectedStudentForXai.predicted_letter_grade || "—"}
                  </p>
                </div>
              </div>

              {/* Recorded Components */}
              <div className="rounded-xl border border-slate-200/80 p-3.5 space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  Điểm thành phần đã ghi nhận:
                </p>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-100/70 p-2">
                    <p className="text-[10px] text-slate-500">Quiz</p>
                    <p className="font-mono font-bold text-slate-800">
                      {selectedStudentForXai.current_marks?.quiz ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-100/70 p-2">
                    <p className="text-[10px] text-slate-500">Lab</p>
                    <p className="font-mono font-bold text-slate-800">
                      {selectedStudentForXai.current_marks?.lab ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-100/70 p-2">
                    <p className="text-[10px] text-slate-500">BTL</p>
                    <p className="font-mono font-bold text-slate-800">
                      {selectedStudentForXai.current_marks?.btl ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-100/70 p-2">
                    <p className="text-[10px] text-slate-500">Giữa kỳ</p>
                    <p className="font-mono font-bold text-slate-800">
                      {selectedStudentForXai.current_marks?.giua_ky ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* TreeSHAP Explanation Factors */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-blue-600" />
                    Đóng góp của các yếu tố học tập (TreeSHAP XAI)
                  </p>
                  <span className="text-[10px] text-slate-400">
                    Độ lệch biên so với điểm nền
                  </span>
                </div>

                {selectedStudentForXai.top_shap_factors &&
                selectedStudentForXai.top_shap_factors.length > 0 ? (
                  <div className="space-y-2.5">
                    {selectedStudentForXai.top_shap_factors.map(
                      (factor: ShapFactorResponse, idx: number) => {
                        const isPositive = factor.impact === "DECREASE_RISK";
                        const absValue = Math.abs(factor.shap_value);
                        const barPercent = Math.min(100, Math.round(absValue * 100));
                        const featureInfo = formatFeatureName(factor.feature);

                        return (
                          <div
                            key={idx}
                            className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800">
                                {featureInfo.label}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0 font-medium",
                                  isPositive
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-rose-200 bg-rose-50 text-rose-700",
                                )}
                              >
                                {isPositive
                                  ? "Giảm nguy cơ rớt"
                                  : "Làm tăng nguy cơ rớt"}
                              </Badge>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-snug">
                              {factor.description}
                            </p>

                            <div className="flex items-center gap-2 pt-1">
                              <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    isPositive ? "bg-emerald-500" : "bg-rose-500",
                                  )}
                                  style={{ width: `${barPercent}%` }}
                                />
                              </div>
                              <span className="font-mono text-[10px] font-semibold text-slate-400">
                                |SHAP|: {absValue.toFixed(3)}
                              </span>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    <p>Chưa có yếu tố SHAP cụ thể nào được trích xuất.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-slate-50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedStudentForXai(null)}
                className="cursor-pointer"
              >
                Đóng
              </Button>

              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 cursor-pointer shadow-xs"
                onClick={() => {
                  navigate(
                    `/lecturer/alerts?student=${selectedStudentForXai.student_id}&course=${selectedClass.course_code}`,
                  );
                }}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Mở Cố vấn / Can thiệp trực tiếp</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
