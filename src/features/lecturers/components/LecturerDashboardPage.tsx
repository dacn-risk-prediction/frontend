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
  useLecturerCurrentClasses,
  useActiveSemester,
  useAllClassesEnrollments,
  useAllClassesPredictions,
} from "../api/lecturer-api";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

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

  const { data: classes = [], isLoading: isLoadingClasses } =
    useLecturerCurrentClasses(lecturerId);
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
    const totalStudents =
      hasAiData
        ? classPredictions.reduce(
            (sum, cp) => sum + (cp.analytics?.total_students ?? cp.students.length),
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
      fill: GRADE_COLORS[grade] ?? "#2563eb",
    }));
  }, [classPredictions]);

  // Early Risk Radar: Top highest-risk students ranked by AI fail_probability
  const riskRadarStudents = useMemo<RiskRadarItem[]>(() => {
    if (hasAiData) {
      const items: RiskRadarItem[] = [];
      for (const cp of classPredictions) {
        for (const s of cp.students) {
          if (s.risk_level === "HIGH" || s.is_at_risk || s.risk_level === "MEDIUM") {
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
          item.giua_ky !== null ? Math.max(0.65, (10 - item.giua_ky) / 10) : 0.6,
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
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Xin chào, {greetingName}!
            </h1>
            <Badge className="bg-blue-600 text-white font-medium">
              Faculty Portal
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Theo dõi lớp giảng dạy theo thời gian thực, phân tích rủi ro AI
            (TreeSHAP) và quản lý can thiệp sớm cho sinh viên.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-2xs"
          >
            <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {semesterDisplay} • Đang diễn ra
          </Badge>
        </div>
      </div>

      {/* AI Offline Warning */}
      {showAiOfflineBanner && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            Dịch vụ dự báo AI tạm thời chưa phản hồi — các chỉ số rủi ro đang
            tạm tính theo ngưỡng điểm giữa kỳ. Biểu đồ AI sẽ tự động hiển thị
            khi mô hình hoạt động trở lại.
          </p>
        </div>
      )}

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Active Classes */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Lớp Phụ Trách
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingClasses ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-black text-slate-900">
                {classes.length}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Phân công trong {semesterDisplay}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Students */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Tổng Sinh Viên
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingClasses ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-black text-slate-900">
                {kpis.totalStudents}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {hasAiData
                ? `${kpis.lowRiskCount} an toàn • ${kpis.mediumRiskCount} cần chú ý`
                : "Trên tất cả nhóm lớp"}
            </p>
          </CardContent>
        </Card>

        {/* Card 3: AI High-Risk Students */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Nguy Cơ Cao (AI)
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEnrollments || isLoadingPredictions ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-600">
                  {kpis.highRiskCount}
                </span>
                {kpis.highRiskCount > 0 ? (
                  <Badge
                    variant="destructive"
                    className="text-[10px] px-1.5 py-0.2"
                  >
                    {kpis.highRiskRate.toFixed(1)}% lớp
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5">
                    An toàn
                  </Badge>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {hasAiData
                ? "Phân loại từ XGBoost Class Engine"
                : "Tạm tính theo điểm GK < 4.0 / Học lại"}
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Avg Predicted Performance */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Điểm TB Dự Kiến
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEnrollments || isLoadingPredictions ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-black text-slate-900">
                {kpis.avgDisplay}
              </div>
            )}
            <p className="mt-1 text-xs text-emerald-600 font-medium">
              {kpis.avgSublabel}
            </p>
          </CardContent>
        </Card>
      </div>

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
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
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
                        formatter={(value) => [`${String(value)} sinh viên`, "Số lượng"]}
                        contentStyle={{
                          fontSize: "12px",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                        }}
                      />
                      <Bar dataKey="count" name="Số sinh viên" radius={[6, 6, 0, 0]}>
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
                            className="text-[10px] font-semibold text-slate-600 bg-white"
                          >
                            {cls.total_students} SV
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] text-blue-700 border-blue-200 bg-blue-50"
                          >
                            {cls.credits} TC
                          </Badge>
                          {highCount !== undefined && (
                            <Badge
                              variant={highCount > 0 ? "destructive" : "outline"}
                              className={cn(
                                "text-[10px]",
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
                        <span className="text-[11px] font-semibold text-blue-700">
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

        {/* Right Column: Early Risk Radar */}
        <Card className="flex flex-col justify-between border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900">
                Early Risk Radar
              </CardTitle>
              <Badge
                variant={riskRadarStudents.length > 0 ? "destructive" : "outline"}
                className="text-[11px] font-medium"
              >
                {riskRadarStudents.length} Cảnh báo
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Top sinh viên có xác suất rủi ro cao nhất cần ưu tiên can thiệp
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-1 flex-1">
            {isLoadingEnrollments || isLoadingPredictions ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : riskRadarStudents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <p className="font-medium text-slate-700">
                  Các lớp đang duy trì phong độ tốt
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs">
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
                  className="w-full text-left rounded-lg border border-slate-100 bg-slate-50/70 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {item.studentName}
                      </p>
                      <p className="font-mono text-[10px] text-slate-500">
                        MSSV: {item.studentId} • {item.courseCode}
                      </p>
                    </div>
                    <Badge
                      variant={
                        item.riskLevel === "HIGH" ? "destructive" : "outline"
                      }
                      className={cn(
                        "text-[10px] px-1.5 py-0 shrink-0 font-bold",
                        item.riskLevel === "MEDIUM" &&
                          "border-amber-300 bg-amber-50 text-amber-700",
                      )}
                    >
                      {Math.round(item.failProbability * 100)}% rớt
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-[11px] text-rose-600 font-medium truncate">
                    {item.isAi ? "SHAP chính: " : ""}
                    {item.reason}
                  </p>
                </button>
              ))
            )}
          </CardContent>

          <div className="border-t border-slate-100 p-4 pt-3">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs cursor-pointer"
              onClick={() => navigate("/lecturer/alerts")}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Mở Trung tâm Cố vấn &amp; Can thiệp
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
