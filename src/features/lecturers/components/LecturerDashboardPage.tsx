import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/features/auth";
import { formatFeatureName } from "@/lib/shap-features";
import { cn } from "@/lib/utils";
import type { ClassPrediction } from "@/types";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useActiveSemester,
  useAllClassesEnrollments,
  useAllClassesPredictions,
  useLecturerCurrentClasses,
} from "../api/lecturer-api";

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

interface RiskRadarItem {
  key: string;
  studentId: string;
  studentName: string;
  courseCode: string;
  classId: string;
  failProbability: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
  isAi: boolean;
}

export const LecturerDashboardPage = () => {
  const navigate = useNavigate();
  const { data: user } = useAuthUser();
  const lecturerId = user?.user_code || user?.id;

  const {
    data: classes = [],
    isLoading: isLoadingClasses,
    isError: isClassesError,
    refetch: refetchClasses,
  } = useLecturerCurrentClasses(lecturerId);
  const { data: activeSemester } = useActiveSemester();

  // Fetch enrollments & AI batch predictions across all assigned classes
  const classIds = useMemo(() => classes.map((c) => c.class_id), [classes]);
  const enrollmentsQueries = useAllClassesEnrollments(classIds);
  const predictionsQueries = useAllClassesPredictions(classIds, true);

  const isLoadingEnrollments = enrollmentsQueries.some((q) => q.isLoading);
  const isLoadingPredictions = predictionsQueries.some((q) => q.isLoading);

  const allEnrollments = useMemo(() => {
    return enrollmentsQueries.flatMap((q) => q.data ?? []);
  }, [enrollmentsQueries]);

  const classPredictions = useMemo<ClassPrediction[]>(() => {
    return predictionsQueries
      .map((q) => q.data)
      .filter((d): d is ClassPrediction => Boolean(d));
  }, [predictionsQueries]);

  const hasAiData = classPredictions.length > 0;
  const showAiOfflineBanner =
    !isLoadingClasses &&
    !isLoadingPredictions &&
    classIds.length > 0 &&
    !hasAiData;

  const greetingName = user?.name
    ? user.name.split(" ").slice(-1)[0]
    : "Giảng viên";

  const semesterDisplay = activeSemester?.semester_code
    ? activeSemester.semester_code.startsWith("HK")
      ? `Học kỳ ${activeSemester.semester_code.slice(2)}`
      : activeSemester.semester_code
    : "Học kỳ 261";

  // Aggregated AI vs Heuristic KPI Metrics
  const kpis = useMemo(() => {
    const totalStudents = hasAiData
      ? classPredictions.reduce(
          (sum, cp) =>
            sum + (cp.analytics?.total_students ?? cp.students.length),
          0,
        )
      : allEnrollments.length > 0
        ? allEnrollments.length
        : classes.reduce((acc, c) => acc + (c.total_students || 0), 0);

    if (hasAiData) {
      let high = 0;
      let medium = 0;
      let low = 0;
      let weightedScoreSum = 0;
      let weightedGpaSum = 0;
      let countForAvg = 0;

      for (const cp of classPredictions) {
        const n = cp.analytics?.total_students ?? cp.students.length;
        high += cp.analytics?.high_risk_count ?? 0;
        medium += cp.analytics?.medium_risk_count ?? 0;
        low += cp.analytics?.low_risk_count ?? 0;
        if (n > 0 && cp.analytics) {
          weightedScoreSum += (cp.analytics.average_predicted_score10 ?? 0) * n;
          weightedGpaSum += (cp.analytics.average_predicted_gpa4 ?? 0) * n;
          countForAvg += n;
        }
      }

      const avgScore10 = countForAvg > 0 ? weightedScoreSum / countForAvg : 0;
      const avgGpa4 = countForAvg > 0 ? weightedGpaSum / countForAvg : 0;
      const highRate = totalStudents > 0 ? (high / totalStudents) * 100 : 0;

      return {
        totalStudents,
        highRiskCount: high,
        mediumRiskCount: medium,
        lowRiskCount: low,
        highRiskRate: highRate,
        avgDisplay: countForAvg > 0 ? `${avgScore10.toFixed(1)}/10` : "—",
        avgSublabel:
          countForAvg > 0
            ? `Dự báo AI ~${avgGpa4.toFixed(2)}/4.0 GPA`
            : "Đang chờ dữ liệu điểm",
      };
    }

    // Fallback heuristic if AI model service is offline
    const heuristicHigh = allEnrollments.filter(
      (s) =>
        (s.giua_ky !== null && s.giua_ky < 4.0) ||
        (s.retaken && (s.giua_ky === null || s.giua_ky < 5.0)),
    ).length;

    const scoredMidterm = allEnrollments.filter(
      (s) => s.giua_ky !== null && s.giua_ky >= 0,
    );
    const avgMidterm =
      scoredMidterm.length > 0
        ? scoredMidterm.reduce((acc, s) => acc + (s.giua_ky ?? 0), 0) /
          scoredMidterm.length
        : null;

    return {
      totalStudents,
      highRiskCount: heuristicHigh,
      mediumRiskCount: 0,
      lowRiskCount: Math.max(0, totalStudents - heuristicHigh),
      highRiskRate:
        totalStudents > 0 ? (heuristicHigh / totalStudents) * 100 : 0,
      avgDisplay: avgMidterm !== null ? `${avgMidterm.toFixed(1)}/10` : "—",
      avgSublabel:
        avgMidterm !== null
          ? "Điểm TB Giữa kỳ (Tạm tính)"
          : "Chưa có dữ liệu điểm",
    };
  }, [hasAiData, classPredictions, allEnrollments, classes]);

  // Chart 1: Stacked Risk Distribution per Class
  const classRiskChartData = useMemo(() => {
    const predByClassId = new Map(classPredictions.map((p) => [p.class_id, p]));
    return classes.map((cls) => {
      const cp = predByClassId.get(cls.class_id);
      return {
        name: `${cls.course_code}-${cls.class_group}`,
        courseName: cls.course_name,
        HIGH: cp?.analytics?.high_risk_count ?? 0,
        MEDIUM: cp?.analytics?.medium_risk_count ?? 0,
        LOW: cp?.analytics?.low_risk_count ?? 0,
      };
    });
  }, [classes, classPredictions]);

  // Chart 2: Aggregated Predicted Grade Distribution
  const gradeDistributionData = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const cp of classPredictions) {
      const dist = cp.analytics?.grade_distribution ?? {};
      for (const [grade, count] of Object.entries(dist)) {
        totals[grade] = (totals[grade] ?? 0) + count;
      }
    }
    const orderedKeys = [
      ...GRADE_ORDER.filter((g) => totals[g] !== undefined),
      ...Object.keys(totals).filter((g) => !GRADE_ORDER.includes(g)),
    ];
    return orderedKeys.map((grade) => ({
      grade,
      count: totals[grade] ?? 0,
      fill: GRADE_COLORS[grade] ?? "#1488db",
    }));
  }, [classPredictions]);

  // Early Risk Radar: Top highest-risk students ranked by AI fail_probability
  const riskRadarStudents = useMemo<RiskRadarItem[]>(() => {
    if (hasAiData) {
      const items: RiskRadarItem[] = [];
      for (const cp of classPredictions) {
        for (const s of cp.students) {
          if (
            s.risk_level === "HIGH" ||
            s.is_at_risk ||
            s.risk_level === "MEDIUM"
          ) {
            const topShap = s.top_shap_factors?.[0];
            items.push({
              key: `${cp.class_id}-${s.student_id}`,
              studentId: s.student_id,
              studentName: s.student_name || `Sinh viên ${s.student_id}`,
              courseCode: cp.course_code,
              classId: cp.class_id,
              failProbability: s.fail_probability,
              riskLevel: s.risk_level,
              reason: topShap
                ? formatFeatureName(topShap.feature).label
                : `Dự báo điểm TK: ${s.predicted_score10.toFixed(1)}/10`,
              isAi: true,
            });
          }
        }
      }
      return items.sort((a, b) => b.failProbability - a.failProbability);
    }

    return allEnrollments
      .filter(
        (s) =>
          (s.giua_ky !== null && s.giua_ky < 4.0) ||
          (s.retaken && (s.giua_ky === null || s.giua_ky < 5.0)),
      )
      .map((item) => ({
        key: item.id,
        studentId: item.student_id,
        studentName: `Sinh viên ${item.student_id}`,
        courseCode: item.course_code,
        classId: item.class_id,
        failProbability:
          item.giua_ky !== null
            ? Math.max(0.65, (10 - item.giua_ky) / 10)
            : 0.6,
        riskLevel: "HIGH" as const,
        reason:
          item.giua_ky !== null
            ? `Điểm giữa kỳ: ${item.giua_ky}/10`
            : "Học lại môn (chưa có điểm GK)",
        isAi: false,
      }));
  }, [hasAiData, classPredictions, allEnrollments]);

  const classPredMap = useMemo(
    () => new Map(classPredictions.map((p) => [p.class_id, p])),
    [classPredictions],
  );

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Xin chào, {greetingName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Theo dõi lớp phụ trách, phân tích rủi ro XAI và can thiệp sớm ·{" "}
            <span className="font-medium text-slate-800">{semesterDisplay}</span>
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/lecturer/classes")}
          className="h-9 w-fit cursor-pointer gap-2 border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
        >
          <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>Xem lớp phụ trách</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        </Button>
      </header>

      {/* Error Recovery Banner */}
      {isClassesError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span>Không thể tải danh sách lớp giảng dạy. Vui lòng thử lại.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetchClasses()}
            className="h-8 w-fit cursor-pointer gap-1.5 border-rose-200 bg-white text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      {/* AI Offline Warning */}
      {showAiOfflineBanner && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="max-w-[75ch] leading-relaxed">
            Dịch vụ dự báo AI tạm thời chưa phản hồi — các chỉ số rủi ro đang
            tạm tính theo ngưỡng điểm giữa kỳ. Biểu đồ XAI sẽ tự động hiển thị
            khi dịch vụ hoạt động trở lại.
          </p>
        </div>
      )}

      {/* 2. Top Row — 4 Authoritative Obsidian KPI Cards (Anchor Contrast Rule) */}
      <section
        aria-label="Chỉ số giảng dạy tổng quan"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* KPI 1: Active Classes */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Lớp phụ trách
            </span>
            <BookOpen className="h-4 w-4 text-sky-400" aria-hidden="true" />
          </div>
          <div className="mt-2.5 tabular-nums">
            {isLoadingClasses ? (
              <Skeleton className="h-9 w-16 bg-slate-800" />
            ) : (
              <span className="text-3xl font-extrabold tracking-tight text-white">
                {classes.length}
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-300">
            Phân công trong {semesterDisplay}
          </p>
        </div>

        {/* KPI 2: Total Students */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Tổng sinh viên
            </span>
            <Users className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="mt-2.5 tabular-nums">
            {isLoadingClasses ? (
              <Skeleton className="h-9 w-20 bg-slate-800" />
            ) : (
              <span className="text-3xl font-extrabold tracking-tight text-white">
                {kpis.totalStudents}
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-300 tabular-nums">
            {hasAiData
              ? `${kpis.lowRiskCount} an toàn · ${kpis.mediumRiskCount} cần chú ý`
              : "Trên tất cả nhóm lớp"}
          </p>
        </div>

        {/* KPI 3: AI High-Risk Students */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Nguy cơ cao (AI)
            </span>
            <ShieldAlert className="h-4 w-4 text-rose-400" aria-hidden="true" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2 tabular-nums">
            {isLoadingEnrollments || isLoadingPredictions ? (
              <Skeleton className="h-9 w-16 bg-slate-800" />
            ) : (
              <>
                <span className="text-3xl font-extrabold tracking-tight text-rose-400">
                  {kpis.highRiskCount}
                </span>
                {kpis.highRiskCount > 0 ? (
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-xs font-semibold text-rose-200">
                    {kpis.highRiskRate.toFixed(1)}% lớp
                  </span>
                ) : (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-200">
                    An toàn
                  </span>
                )}
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-300">
            {hasAiData
              ? "Phân loại từ mô hình dự báo AI"
              : "Tạm tính theo điểm giữa kỳ < 4.0 / Học lại"}
          </p>
        </div>

        {/* KPI 4: Avg Predicted Performance */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Điểm TB dự kiến
            </span>
            <TrendingUp className="h-4 w-4 text-sky-400" aria-hidden="true" />
          </div>
          <div className="mt-2.5 tabular-nums">
            {isLoadingEnrollments || isLoadingPredictions ? (
              <Skeleton className="h-9 w-16 bg-slate-800" />
            ) : (
              <span className="text-3xl font-extrabold tracking-tight text-white">
                {kpis.avgDisplay}
              </span>
            )}
          </div>
          <p className="mt-3 text-xs font-medium text-emerald-300">
            {kpis.avgSublabel}
          </p>
        </div>
      </section>

      {/* 3. AI Analytics Charts Row */}
      {hasAiData && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Chart A: Risk Breakdown by Class */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                    Phân Bổ Rủi Ro Theo Nhóm Lớp
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    So sánh số sinh viên Nguy cơ cao / Cần chú ý / An toàn trên
                    từng lớp phụ trách
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={classRiskChartData}
                    margin={{ top: 8, right: 12, left: -12, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#475569" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#475569" }}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: "12px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar
                      dataKey="HIGH"
                      name="Nguy cơ cao"
                      stackId="risk"
                      fill="#e11d48"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="MEDIUM"
                      name="Cần chú ý"
                      stackId="risk"
                      fill="#f59e0b"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="LOW"
                      name="An toàn"
                      stackId="risk"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Chart B: Predicted Letter Grade Distribution */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Phổ Điểm Chữ Dự Báo Toàn Khóa
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Tổng hợp phân bố xếp loại dự kiến (A → F) trên tất cả sinh
                  viên phụ trách
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {gradeDistributionData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-xs text-slate-400">
                  Chưa có dữ liệu phổ điểm dự báo.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={gradeDistributionData}
                      margin={{ top: 8, right: 12, left: -12, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
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
                      <Bar
                        dataKey="count"
                        name="Số sinh viên"
                        radius={[6, 6, 0, 0]}
                      >
                        {gradeDistributionData.map((entry) => (
                          <Cell key={entry.grade} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. Main Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (col-span-2): My Classes Quick Roster */}
        <Card className="border-slate-200 bg-white shadow-xs lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                Các Lớp Đang Giảng Dạy
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Tóm tắt sĩ số và tỷ lệ cảnh báo AI cho từng nhóm lớp trong{" "}
                {semesterDisplay}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50 cursor-pointer"
              onClick={() => navigate("/lecturer/classes")}
            >
              <span>Quản lý lớp &amp; XAI</span>
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-3 pt-1">
            {isLoadingClasses ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : classes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Không có nhóm lớp nào được phân công trong học kỳ này.
              </div>
            ) : (
              classes.map((cls) => {
                const cp = classPredMap.get(cls.class_id);
                const highCount = cp?.analytics?.high_risk_count;
                const avgScore = cp?.analytics?.average_predicted_score10;

                return (
                  <div
                    key={cls.class_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-4 transition-colors hover:bg-slate-50 gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-mono font-bold text-xs">
                        {cls.class_group}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {cls.course_code}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs font-semibold text-slate-600 bg-white"
                          >
                            {cls.total_students} SV
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-xs text-blue-700 border-blue-200 bg-blue-50"
                          >
                            {cls.credits} TC
                          </Badge>
                          {highCount !== undefined && (
                            <Badge
                              variant={
                                highCount > 0 ? "destructive" : "outline"
                              }
                              className={cn(
                                "text-xs",
                                highCount === 0 &&
                                  "border-emerald-200 bg-emerald-50 text-emerald-700",
                              )}
                            >
                              {highCount} Nguy cơ cao
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600 font-medium">
                          {cls.course_name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      {avgScore !== undefined && (
                        <span className="text-xs font-semibold text-blue-700">
                          TB dự báo: {avgScore.toFixed(1)}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-blue-700 hover:bg-blue-50 cursor-pointer"
                        onClick={() =>
                          navigate(
                            `/lecturer/classes?classId=${encodeURIComponent(cls.class_id)}`,
                          )
                        }
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right Column: Cảnh báo rủi ro sớm */}
        <Card className="flex flex-col justify-between border-slate-200 bg-white shadow-xs">
          <CardHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base font-bold text-slate-900">
                Cảnh báo rủi ro sớm
              </CardTitle>
              <Badge
                variant={
                  riskRadarStudents.length > 0 ? "destructive" : "outline"
                }
                className="text-xs font-semibold tabular-nums"
              >
                {riskRadarStudents.length} cảnh báo
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Sinh viên có xác suất rủi ro cao nhất cần ưu tiên can thiệp
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 divide-y divide-slate-100 p-0">
            {isLoadingEnrollments || isLoadingPredictions ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : riskRadarStudents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs text-slate-500">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" aria-hidden="true" />
                <p className="font-semibold text-slate-800">
                  Các lớp đang duy trì phong độ tốt
                </p>
                <p className="max-w-xs text-xs text-slate-500">
                  Chưa phát hiện sinh viên nào có nguy cơ rớt môn cao trong các
                  lớp phụ trách.
                </p>
              </div>
            ) : (
              riskRadarStudents.slice(0, 4).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/lecturer/alerts?student=${item.studentId}&course=${item.courseCode}`,
                    )
                  }
                  className="w-full cursor-pointer px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {item.studentName}
                      </p>
                      <p className="font-mono text-xs text-slate-500 tabular-nums">
                        MSSV: {item.studentId} · {item.courseCode}
                      </p>
                    </div>
                    <Badge
                      variant={
                        item.riskLevel === "HIGH" ? "destructive" : "outline"
                      }
                      className={cn(
                        "shrink-0 px-2 py-0 text-xs font-semibold tabular-nums",
                        item.riskLevel === "MEDIUM" &&
                          "border-amber-300 bg-amber-50 text-amber-800",
                      )}
                    >
                      {Math.round(item.failProbability * 100)}% rớt
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs font-medium text-rose-700">
                    {item.isAi ? "Yếu tố chính: " : ""}
                    {item.reason}
                  </p>
                </button>
              ))
            )}
          </CardContent>

          <div className="border-t border-slate-100 p-4">
            <Button
              className="h-9 w-full cursor-pointer bg-primary text-xs font-semibold text-primary-foreground hover:bg-brand-blue-hover"
              onClick={() => navigate("/lecturer/alerts")}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Mở Cố vấn &amp; Can thiệp
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
