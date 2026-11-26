import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { flexRender, type SortingState } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { formatFeatureName } from "@/lib/shap-features";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/features/auth";
import {
  useLecturerCurrentClasses,
  useActiveSemester,
  useClassEnrollments,
  useClassPredictions,
  useCourseAssessment,
} from "../api/lecturer-api";
import type {
  LecturerCurrentClassItem,
  ClassStudentPrediction,
  ShapFactorResponse,
  RiskLevel,
} from "@/types";
import {
  ArrowRight,
  ArrowUpDown,
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
  BarChart3,
} from "lucide-react";

type ClassRiskFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";
type ClassModalTab = "xai" | "grades";

interface EnrichedStudentRow {
  student_id: string;
  student_name: string;
  retaken: boolean;
  quiz: number | null;
  lab: number | null;
  btl: number | null;
  giua_ky: number | null;
  cuoi_ky: number | null;
  final_score: number | null;
  letter_grade: string | null;
  gpa_4: number | null;
  passed: boolean | null;
  fail_probability: number;
  predicted_course_fail: number;
  is_at_risk: boolean;
  risk_level: RiskLevel;
  predicted_score10: number;
  predicted_gpa4: number;
  predicted_letter_grade: string;
  top_shap_factors: ShapFactorResponse[];
  rawPrediction: ClassStudentPrediction | null;
}

const GRADE_ORDER = ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "F"];
const GRADE_COLORS: Record<string, string> = {
  "A+": "#059669",
  A: "#10b981",
  "B+": "#2563eb",
  B: "#3b82f6",
  "C+": "#0284c7",
  C: "#0ea5e9",
  "D+": "#f59e0b",
  D: "#d97706",
  F: "#e11d48",
};

export const LecturerClassesPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const classIdParam = searchParams.get("classId");
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
  const [manualSelectedClass, setManualSelectedClass] =
    useState<LecturerCurrentClassItem | null>(null);
  const selectedClass = useMemo(() => {
    if (manualSelectedClass) return manualSelectedClass;
    if (classIdParam) {
      return classes.find((c) => c.class_id === classIdParam) ?? null;
    }
    return null;
  }, [manualSelectedClass, classIdParam, classes]);

  const setSelectedClass = (cls: LecturerCurrentClassItem | null) => {
    setManualSelectedClass(cls);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (cls) next.set("classId", cls.class_id);
      else next.delete("classId");
      return next;
    });
  };
  const [modalTab, setModalTab] = useState<ClassModalTab>("xai");

  // Filter & sort within class modal
  const [classStudentSearch, setClassStudentSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<ClassRiskFilter>("ALL");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "fail_probability", desc: true },
  ]);
  const [selectedStudentForXai, setSelectedStudentForXai] =
    useState<ClassStudentPrediction | null>(null);

  // 1. Real class roster enrollments query
  const { data: roster = [], isLoading: isLoadingRoster } = useClassEnrollments(
    selectedClass?.class_id,
  );

  // 2. Real class AI batch prediction query
  const { data: classPrediction, isLoading: isLoadingPrediction } =
    useClassPredictions(selectedClass?.class_id);

  // 3. Real course assessment weights query
  const { data: courseAssessment } = useCourseAssessment(
    selectedClass?.course_code,
  );

  const semesterDisplay = activeSemester?.semester_code
    ? activeSemester.semester_code.startsWith("HK")
      ? `Học kỳ ${activeSemester.semester_code.slice(2)}`
      : activeSemester.semester_code
    : "Học kỳ 261";

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
  const enrichedStudents = useMemo<EnrichedStudentRow[]>(() => {
    if (!selectedClass) return [];
    const rosterMap = new Map(roster.map((r) => [r.student_id, r]));

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
        risk_level: isHeuristicRisk
          ? ("HIGH" as RiskLevel)
          : ("LOW" as RiskLevel),
        predicted_score10: enr.giua_ky ?? 6.5,
        predicted_gpa4: enr.gpa_4 ?? 2.8,
        predicted_letter_grade: isHeuristicRisk ? "D" : "B",
        top_shap_factors: [],
        rawPrediction: null,
      };
    });
  }, [selectedClass, roster, classPrediction]);

  // Filter students within Tab 1 (AI Risk) — mutually exclusive HIGH / MEDIUM / LOW groups
  const filteredStudents = useMemo(() => {
    return enrichedStudents.filter((student) => {
      const isHigh = student.risk_level === "HIGH" || student.is_at_risk;
      const isMedium = !isHigh && student.risk_level === "MEDIUM";
      const isLow = !isHigh && student.risk_level === "LOW";

      if (riskFilter === "HIGH" && !isHigh) {
        return false;
      }
      if (riskFilter === "MEDIUM" && !isMedium) {
        return false;
      }
      if (riskFilter === "LOW" && !isLow) {
        return false;
      }
      if (classStudentSearch.trim()) {
        const query = classStudentSearch.toLowerCase().trim();
        const matchId = student.student_id.toLowerCase().includes(query);
        const matchName = student.student_name.toLowerCase().includes(query);
        if (!matchId && !matchName) return false;
      }
      return true;
    });
  }, [enrichedStudents, riskFilter, classStudentSearch]);

  // Tab 2 (Grade Roster) filters only by search query, independent of Tab 1's risk filter
  const gradeRosterStudents = useMemo(() => {
    if (!classStudentSearch.trim()) return enrichedStudents;
    const query = classStudentSearch.toLowerCase().trim();
    return enrichedStudents.filter(
      (student) =>
        student.student_id.toLowerCase().includes(query) ||
        student.student_name.toLowerCase().includes(query),
    );
  }, [enrichedStudents, classStudentSearch]);

  // Mutually exclusive counts for tabs
  const riskCounts = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const s of enrichedStudents) {
      if (s.risk_level === "HIGH" || s.is_at_risk) {
        high += 1;
      } else if (s.risk_level === "MEDIUM") {
        medium += 1;
      } else {
        low += 1;
      }
    }
    return {
      all: enrichedStudents.length,
      high,
      medium,
      low,
    };
  }, [enrichedStudents]);

  // Grade distribution chart data for selected class
  const gradeChartData = useMemo(() => {
    const dist = classPrediction?.analytics?.grade_distribution;
    if (!dist) return [];
    const orderedKeys = [
      ...GRADE_ORDER.filter((g) => dist[g] !== undefined),
      ...Object.keys(dist).filter((g) => !GRADE_ORDER.includes(g)),
    ];
    return orderedKeys.map((grade) => ({
      grade,
      count: dist[grade] ?? 0,
      fill: GRADE_COLORS[grade] ?? "#2563eb",
    }));
  }, [classPrediction]);

  // Assessment weight chips (backend stores 0-100 integer percentages)
  const assessmentWeights = useMemo(() => {
    if (!courseAssessment) return [];
    const rawItems = [
      { key: "quiz", label: "Quiz", weight: courseAssessment.quiz },
      { key: "lab", label: "Lab", weight: courseAssessment.lab },
      { key: "btl", label: "BTL", weight: courseAssessment.btl },
      { key: "giua_ky", label: "Giữa kỳ", weight: courseAssessment.giua_ky },
      { key: "cuoi_ky", label: "Cuối kỳ", weight: courseAssessment.cuoi_ky },
    ];
    return rawItems
      .filter((w): w is { key: string; label: string; weight: number } =>
        typeof w.weight === "number" && w.weight > 0,
      )
      .map((w) => ({
        ...w,
        percent: w.weight <= 1 ? Math.round(w.weight * 100) : Math.round(w.weight),
      }));
  }, [courseAssessment]);

  // TanStack Table column definitions for Tab 1 (XAI Roster)
  const xaiColumns = useMemo<LegacyColumnDef<EnrichedStudentRow>[]>(
    () => [
      {
        accessorKey: "student_id",
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
          >
            <span>Sinh viên</span>
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-mono font-bold text-slate-900 leading-tight">
              {row.original.student_id}
            </div>
            <div className="text-[11px] text-slate-600 truncate max-w-36">
              {row.original.student_name}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "retaken",
        header: "Loại",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.retaken ? (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]"
            >
              Học lại
            </Badge>
          ) : (
            <span className="text-slate-400 text-[11px]">Chính quy</span>
          ),
      },
      {
        accessorKey: "giua_ky",
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
          >
            <span>Giữa kỳ</span>
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => {
          const gk = row.original.giua_ky;
          return (
            <span
              className={cn(
                "font-mono",
                gk !== null && gk < 4.0 && "font-bold text-rose-600",
              )}
            >
              {gk !== null ? gk : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "fail_probability",
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
          >
            <span>Xác suất rớt (AI)</span>
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => {
          const s = row.original;
          const isHigh = s.risk_level === "HIGH" || s.is_at_risk;
          const isMedium = s.risk_level === "MEDIUM";
          return (
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
                  {(s.fail_probability * 100).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={s.fail_probability * 100}
                className={cn(
                  "h-1.5",
                  isHigh && "[&>div]:bg-rose-500",
                  isMedium && "[&>div]:bg-amber-500",
                  !isHigh && !isMedium && "[&>div]:bg-emerald-500",
                )}
              />
            </div>
          );
        },
      },
      {
        accessorKey: "risk_level",
        header: "Mức rủi ro",
        enableSorting: false,
        cell: ({ row }) => {
          const s = row.original;
          const isHigh = s.risk_level === "HIGH" || s.is_at_risk;
          const isMedium = s.risk_level === "MEDIUM";
          if (isHigh) {
            return (
              <Badge
                variant="destructive"
                className="text-[10px] px-1.5 py-0 font-semibold"
              >
                Nguy cơ cao
              </Badge>
            );
          }
          if (isMedium) {
            return (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-700 text-[10px] px-1.5 py-0 font-semibold"
              >
                Cần chú ý
              </Badge>
            );
          }
          return (
            <Badge
              variant="outline"
              className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0 font-semibold"
            >
              An toàn
            </Badge>
          );
        },
      },
      {
        accessorKey: "predicted_score10",
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
          >
            <span>Dự báo TK</span>
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-mono font-bold text-slate-800">
              {row.original.predicted_score10 !== undefined
                ? row.original.predicted_score10.toFixed(1)
                : "—"}
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Xếp loại:{" "}
              <span className="font-bold text-blue-700">
                {row.original.predicted_letter_grade || "—"}
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Thao tác</div>,
        enableSorting: false,
        cell: ({ row }) => {
          const student = row.original;
          return (
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
                  if (!selectedClass) return;
                  navigate(
                    `/lecturer/alerts?student=${student.student_id}&course=${selectedClass.course_code}`,
                  );
                }}
              >
                <MessageSquare className="h-3 w-3 mr-1 text-slate-400" />
                <span>Cố vấn</span>
              </Button>
            </div>
          );
        },
      },
    ],
    [navigate, selectedClass],
  );

  const xaiTable = useLegacyTable({
    data: filteredStudents,
    columns: xaiColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const openClassModal = (
    cls: LecturerCurrentClassItem,
    tab: ClassModalTab,
  ) => {
    setSelectedClass(cls);
    setModalTab(tab);
    setRiskFilter("ALL");
    setClassStudentSearch("");
    setSelectedStudentForXai(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Quản Lý Lớp Giảng Dạy
            </h1>
            <Badge className="bg-blue-600 text-white font-medium">
              {classes.length} Nhóm lớp
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Theo dõi lớp học phần được phân công, phân tích rủi ro AI
            (TreeSHAP) và xem bảng điểm thành phần theo trọng số môn học.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs"
          >
            <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {semesterDisplay} • Đang diễn ra
          </Badge>
        </div>
      </div>

      {/* 2. Search & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Tìm theo mã môn, tên môn hoặc nhóm lớp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs bg-white"
          />
        </div>

        <div className="text-xs text-slate-500">
          Hiển thị {filteredClasses.length} / {classes.length} lớp
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
            Không thể tải danh sách lớp giảng dạy
          </h3>
          <p className="mt-1 text-xs text-rose-700">
            Vui lòng kiểm tra kết nối máy chủ và thử lại.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            className="mt-4 border-rose-300 text-rose-800 hover:bg-rose-100 cursor-pointer"
          >
            Thử lại
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
            Chưa có lớp giảng dạy nào
          </h3>
          <p className="mt-1 max-w-sm mx-auto text-xs text-slate-500">
            Không tìm thấy nhóm lớp phân công cho giảng viên{" "}
            <span className="font-mono font-semibold">{lecturerId}</span> trong{" "}
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
                        Nhóm {item.class_group}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-slate-600 text-[11px]"
                      >
                        {item.credits} Tín chỉ
                      </Badge>
                    </div>
                    <CardTitle className="mt-2 text-base font-bold text-slate-900">
                      {item.course_name}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 font-mono">
                      Mã lớp: {item.class_id}
                    </CardDescription>
                  </div>

                  <BookOpen className="mt-1 h-4.5 w-4.5 shrink-0 text-primary" aria-hidden="true" />
                </div>
              </CardHeader>

              <CardContent className="pt-2">
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs tabular-nums">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span className="font-bold text-slate-900">
                      {item.total_students}
                    </span>{" "}
                    sinh viên đăng ký
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>
                      {item.academic_year || "2026-2027"} · HK {item.term ?? 1}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 cursor-pointer text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => openClassModal(item, "grades")}
                  >
                    <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Bảng điểm lớp
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 cursor-pointer gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-brand-blue-hover"
                    onClick={() => openClassModal(item, "xai")}
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Phân tích AI &amp; XAI</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 7. Class Detail Modal */}
      {selectedClass && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Chi tiết lớp ${selectedClass.course_code}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-5"
        >
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            {/* Modal Header */}
            <div className="border-b border-slate-200 px-6 pt-4 bg-white">
              <div className="flex items-start justify-between">
                <div className="min-w-0 pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-blue-700 text-white font-mono text-xs">
                      {selectedClass.course_code}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold"
                    >
                      Nhóm {selectedClass.class_group}
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
                        Inference {classPrediction.inference_time_ms.toFixed(1)}
                        ms
                      </Badge>
                    )}
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-slate-900 truncate">
                    {selectedClass.course_name}
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

              {/* Modal Tabs */}
              <div className="mt-3 flex gap-6 border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => setModalTab("xai")}
                  className={cn(
                    "pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer",
                    modalTab === "xai"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-800",
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Phân tích Rủi ro AI &amp; TreeSHAP</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("grades")}
                  className={cn(
                    "pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer",
                    modalTab === "grades"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-800",
                  )}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Bảng điểm &amp; Trọng số Thành phần</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* ================================================= */}
              {/* TAB 1: AI RISK & XAI ANALYTICS                    */}
              {/* ================================================= */}
              {modalTab === "xai" && (
                <>
                  {/* AI Analytics Overview Cards */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/70">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Tổng sĩ số
                      </p>
                      <p className="mt-1 text-2xl font-black text-slate-900">
                        {classPrediction?.analytics?.total_students ??
                          roster.length}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Sinh viên đăng ký
                      </p>
                    </div>

                    <div className="rounded-xl bg-rose-50/60 p-3.5 border border-rose-200/80">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
                          Nguy cơ cao
                        </p>
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                      </div>
                      <p className="mt-1 text-2xl font-black text-rose-600">
                        {classPrediction?.analytics?.high_risk_count ??
                          riskCounts.high}
                      </p>
                      <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                        {classPrediction?.analytics?.high_risk_rate !==
                        undefined
                          ? `${(classPrediction.analytics.high_risk_rate * 100).toFixed(1)}% tỷ lệ lớp`
                          : "Cần can thiệp"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-amber-50/60 p-3.5 border border-amber-200/80">
                      <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                        Cần chú ý
                      </p>
                      <p className="mt-1 text-2xl font-black text-amber-600">
                        {classPrediction?.analytics?.medium_risk_count ??
                          riskCounts.medium}
                      </p>
                      <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                        Cần củng cố
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-50/60 p-3.5 border border-emerald-200/80">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                          An toàn
                        </p>
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <p className="mt-1 text-2xl font-black text-emerald-600">
                        {classPrediction?.analytics?.low_risk_count ??
                          riskCounts.low}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                        Phong độ tốt
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-50/60 p-3.5 border border-blue-200/80">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
                          Dự báo TB
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
                          : semesterDisplay}
                      </p>
                    </div>
                  </div>

                  {/* Class SHAP Drivers + Grade Distribution BarChart */}
                  {classPrediction?.analytics && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {/* SHAP Class Drivers */}
                      <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-2.5">
                        <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Info className="h-4 w-4 text-blue-600" />
                          Yếu tố SHAP tác động lớn nhất tới lớp học
                        </p>
                        {classPrediction.analytics.top_class_risk_factors
                          ?.length > 0 ? (
                          <div className="space-y-2">
                            {classPrediction.analytics.top_class_risk_factors
                              .slice(0, 4)
                              .map((factor, idx) => {
                                const info = formatFeatureName(factor.feature);
                                const isDecrease =
                                  factor.impact === "DECREASE_RISK";
                                return (
                                  <div
                                    key={idx}
                                    className="rounded-lg border border-white/80 bg-white p-2.5 text-xs"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-slate-800">
                                        {info.label}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] px-1.5 py-0",
                                          isDecrease
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : "border-rose-200 bg-rose-50 text-rose-700",
                                        )}
                                      >
                                        {isDecrease
                                          ? "Giảm rủi ro"
                                          : "Tăng rủi ro"}
                                      </Badge>
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-slate-600">
                                      {factor.description}
                                    </p>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-600">
                            Chưa có yếu tố SHAP tổng hợp cho nhóm lớp này.
                          </p>
                        )}
                      </div>

                      {/* Grade Distribution Recharts BarChart */}
                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                        <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <BarChart3 className="h-4 w-4 text-blue-600" />
                          Biểu đồ Phổ điểm Dự báo (Grade Distribution)
                        </p>
                        {gradeChartData.length > 0 ? (
                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={gradeChartData}
                                margin={{ top: 6, right: 8, left: -16, bottom: 0 }}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#e2e8f0"
                                />
                                <XAxis
                                  dataKey="grade"
                                  tick={{ fontSize: 11, fill: "#475569" }}
                                />
                                <YAxis
                                  allowDecimals={false}
                                  tick={{ fontSize: 11, fill: "#475569" }}
                                />
                                <Tooltip
                                  formatter={(value) => [
                                    `${String(value)} sinh viên`,
                                    "Số lượng",
                                  ]}
                                  contentStyle={{
                                    fontSize: "12px",
                                    borderRadius: "8px",
                                    border: "1px solid #e2e8f0",
                                  }}
                                />
                                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                                  {gradeChartData.map((entry) => (
                                    <Cell key={entry.grade} fill={entry.fill} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="flex h-44 items-center justify-center text-xs text-slate-400">
                            Chưa có dữ liệu phổ điểm.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Search & Risk Filter Bar */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
                    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
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
                          "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors tabular-nums",
                          riskFilter === "HIGH"
                            ? "border border-rose-200 bg-rose-50 text-rose-700"
                            : "text-slate-600 hover:text-rose-700",
                        )}
                      >
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                        <span>Nguy cơ cao ({riskCounts.high})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRiskFilter("MEDIUM")}
                        className={cn(
                          "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors tabular-nums",
                          riskFilter === "MEDIUM"
                            ? "border border-amber-200 bg-amber-50 text-amber-800"
                            : "text-slate-600 hover:text-amber-700",
                        )}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                        <span>Cần chú ý ({riskCounts.medium})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRiskFilter("LOW")}
                        className={cn(
                          "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors tabular-nums",
                          riskFilter === "LOW"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "text-slate-600 hover:text-emerald-700",
                        )}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                        <span>An toàn ({riskCounts.low})</span>
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

                  {/* Sortable Roster & Prediction Table (TanStack Table) */}
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
                    <div className="rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                          {xaiTable.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                              {headerGroup.headers.map((header) => (
                                <th key={header.id} className="py-3 px-3">
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext(),
                                      )}
                                </th>
                              ))}
                            </tr>
                          ))}
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {xaiTable.getRowModel().rows.map((row) => {
                            const s = row.original;
                            const isHigh =
                              s.risk_level === "HIGH" || s.is_at_risk;
                            const isMedium = s.risk_level === "MEDIUM";

                            return (
                              <tr
                                key={row.id}
                                className={cn(
                                  "hover:bg-slate-50/80 transition-colors",
                                  isHigh && "bg-rose-50/30",
                                  isMedium && "bg-amber-50/20",
                                )}
                              >
                                {row.getVisibleCells().map((cell) => (
                                  <td key={cell.id} className="py-2.5 px-3">
                                    {flexRender(
                                      cell.column.columnDef.cell,
                                      cell.getContext(),
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ================================================= */}
              {/* TAB 2: GRADE EVALUATION & COMPONENT SCORE EDITOR  */}
              {/* ================================================= */}
              {modalTab === "grades" && (
                <div className="space-y-4">
                  {/* Course Assessment Weights Strip */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800">
                        Trọng số đánh giá môn {selectedClass.course_code}
                      </p>
                      {courseAssessment?.course_category && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-white text-slate-600"
                        >
                          {courseAssessment.course_category}
                        </Badge>
                      )}
                    </div>
                    {assessmentWeights.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {assessmentWeights.map((w) => (
                          <div
                            key={w.key}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                          >
                            <span className="text-slate-500">{w.label}: </span>
                            <span className="font-mono font-bold text-blue-700">
                              {w.percent}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Chưa cấu hình bảng trọng số chi tiết cho môn học này.
                      </p>
                    )}
                  </div>

                  {/* Search Input */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative max-w-xs flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Tìm theo MSSV hoặc Tên sinh viên..."
                        value={classStudentSearch}
                        onChange={(e) => setClassStudentSearch(e.target.value)}
                        className="pl-8 text-xs bg-white h-8"
                      />
                    </div>
                    <span className="text-xs text-slate-500">
                      Hiển thị {filteredStudents.length} sinh viên
                    </span>
                  </div>

                  {/* Read-only Grade Roster Table */}
                  {isLoadingRoster ? (
                    <div className="space-y-2 py-4">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-11 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
                      Không có sinh viên nào trong danh sách lớp.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-3.5">Sinh viên</th>
                            <th className="py-3 px-2 text-center">Quiz</th>
                            <th className="py-3 px-2 text-center">Lab</th>
                            <th className="py-3 px-2 text-center">BTL</th>
                            <th className="py-3 px-2 text-center">Giữa kỳ</th>
                            <th className="py-3 px-2 text-center">Cuối kỳ</th>
                            <th className="py-3 px-3 text-center">
                              Tổng kết / Chữ
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {gradeRosterStudents.map((student) => (
                            <tr
                              key={student.student_id}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-2.5 px-3.5">
                                <div className="font-mono font-bold text-slate-900">
                                  {student.student_id}
                                </div>
                                <div className="text-[11px] text-slate-600">
                                  {student.student_name}
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono">
                                {student.quiz !== null ? student.quiz : "—"}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono">
                                {student.lab !== null ? student.lab : "—"}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono">
                                {student.btl !== null ? student.btl : "—"}
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
                                {student.cuoi_ky !== null
                                  ? student.cuoi_ky
                                  : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">
                                {student.final_score !== null ? (
                                  <span className="font-bold text-slate-900">
                                    {student.final_score.toFixed(1)}{" "}
                                    {student.letter_grade
                                      ? `(${student.letter_grade})`
                                      : ""}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">
                                    Chưa chốt
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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

      {/* 8. Student TreeSHAP XAI Detail Modal */}
      {selectedStudentForXai && selectedClass && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Phân tích XAI sinh viên ${selectedStudentForXai.student_id}`}
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
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
                  {selectedStudentForXai.student_name ||
                    `Sinh viên ${selectedStudentForXai.student_id}`}{" "}
                  — Phân tích TreeSHAP
                </h3>
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedStudentForXai(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
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
                        const barPercent = Math.min(
                          100,
                          Math.round(absValue * 100),
                        );
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
                                    isPositive
                                      ? "bg-emerald-500"
                                      : "bg-rose-500",
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
