import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  User,
  ArrowRight,
  SlidersHorizontal,
  RefreshCw,
  Info,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Layers,
  Award,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/features/auth";
import { cn } from "@/lib/utils";
import type { CoursePredictionResponse, ShapFactorResponse } from "@/types";
import {
  useStudentPredictions,
  useCoursePrediction,
  useStudentCurrentCourses,
  useStudentEnrollments,
} from "../api/student-api";

function score10ToLetter(score: number): string {
  if (score >= 8.5) return "A";
  if (score >= 8.0) return "B+";
  if (score >= 7.0) return "B";
  if (score >= 6.5) return "C+";
  if (score >= 5.5) return "C";
  if (score >= 5.0) return "D+";
  if (score >= 4.0) return "D";
  return "F";
}

export const StudentSimulationPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCourse = searchParams.get("course");

  const { data: user } = useAuthUser();
  const studentId = user?.user_code || user?.id;

  // 1. Fetch holistic semester predictions (GET /api/v1/predictions/students/{id})
  const {
    data: predictions,
    isLoading: isLoadingPredictions,
    refetch: refetchPredictions,
    isRefetching,
  } = useStudentPredictions(studentId);

  // 2. Fetch current courses & enrollments to identify active registrations and filter exempted courses
  const { data: rawCurrentCourses, isLoading: isLoadingCourses } =
    useStudentCurrentCourses(studentId);
  const { data: enrollments } = useStudentEnrollments(studentId);

  // Filter out exempted courses (final_score === 12)
  const activeCourses = useMemo(() => {
    if (!rawCurrentCourses) return [];
    const exemptedCodes = new Set<string>();
    const exemptedClassIds = new Set<string>();
    if (enrollments) {
      for (const e of enrollments) {
        if (
          e.final_score !== null &&
          e.final_score !== undefined &&
          Number(e.final_score) === 12
        ) {
          exemptedCodes.add(e.course_code);
          if (e.class_id) exemptedClassIds.add(e.class_id);
        }
      }
    }
    return rawCurrentCourses.filter(
      (c) =>
        !(c.class_id && exemptedClassIds.has(c.class_id)) &&
        !exemptedCodes.has(c.course_code)
    );
  }, [rawCurrentCourses, enrollments]);

  // Map predictions by course_code for instant O(1) in-memory retrieval
  const predictionMap = useMemo(() => {
    const map = new Map<string, CoursePredictionResponse>();
    if (predictions?.courses) {
      for (const item of predictions.courses) {
        map.set(item.course_code, item);
      }
    }
    return map;
  }, [predictions]);

  // Determine current active course directly from URL search params (or default to highest-risk / first course)
  const currentActiveCourseCode = useMemo(() => {
    if (queryCourse && (predictionMap.has(queryCourse) || activeCourses.some((c) => c.course_code === queryCourse))) {
      return queryCourse;
    }
    if (activeCourses.length > 0) {
      // Prioritize highest risk course if available
      const highRisk = activeCourses.find(
        (c) => predictionMap.get(c.course_code)?.risk_level === "HIGH"
      );
      if (highRisk) return highRisk.course_code;
      const mediumRisk = activeCourses.find(
        (c) => predictionMap.get(c.course_code)?.risk_level === "MEDIUM"
      );
      if (mediumRisk) return mediumRisk.course_code;
      return activeCourses[0].course_code;
    }
    if (predictions?.courses && predictions.courses.length > 0) {
      return predictions.courses[0].course_code;
    }
    return "";
  }, [queryCourse, predictionMap, activeCourses, predictions]);

  // Fallback single course prediction query (POST /api/v1/predictions/course)
  const {
    data: singlePrediction,
    isLoading: isLoadingSingle,
    refetch: refetchSingle,
  } = useCoursePrediction(
    studentId,
    currentActiveCourseCode && !predictionMap.has(currentActiveCourseCode)
      ? currentActiveCourseCode
      : undefined
  );

  // Handler for instant course switching without network latency
  const handleSelectCourse = (code: string) => {
    setSearchParams({ course: code });
  };

  // Selected course prediction details
  const activePrediction = useMemo(() => {
    if (!currentActiveCourseCode) return null;
    return (
      predictionMap.get(currentActiveCourseCode) ||
      singlePrediction ||
      null
    );
  }, [currentActiveCourseCode, predictionMap, singlePrediction]);

  // Selected course metadata
  const activeCourseMeta = useMemo(() => {
    if (!currentActiveCourseCode) return null;
    return activeCourses.find((c) => c.course_code === currentActiveCourseCode) || null;
  }, [currentActiveCourseCode, activeCourses]);

  const isLoading = isLoadingPredictions || isLoadingCourses;
  const isLoadingCourseDetail =
    (isLoadingPredictions && !activePrediction) ||
    (isLoadingSingle && !activePrediction);

  // Holistic stats
  const totalCourses = activeCourses.length || predictions?.total_courses || 0;
  const atRiskCount = useMemo(() => {
    if (activeCourses.length > 0) {
      return activeCourses.filter((c) => predictionMap.get(c.course_code)?.is_at_risk).length;
    }
    return predictions?.at_risk_count ?? 0;
  }, [activeCourses, predictionMap, predictions]);

  const predictedSemesterGpa = predictions?.predicted_semester_gpa4 ?? 0;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-700/10">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              AI Simulation & Prediction
            </span>
            <span className="text-xs font-medium text-slate-500">
              Semester 261 • TreeSHAP XAI
            </span>
          </div>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Course Outcome Simulation
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Real-time machine learning predictions, grade forecasts, and transparent factor analysis for active enrollments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchPredictions();
              refetchSingle();
            }}
            disabled={isRefetching}
            className="cursor-pointer gap-1.5 border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", isRefetching && "animate-spin")} />
            <span>Refresh AI</span>
          </Button>
          <Button
            size="sm"
            onClick={() =>
              navigate(
                currentActiveCourseCode
                  ? `/student/what-if?course=${currentActiveCourseCode}`
                  : "/student/what-if"
              )
            }
            className="cursor-pointer gap-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>What-If Sandbox</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* 2. Holistic Semester KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Card 1: Expected Semester GPA */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Expected Term GPA
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                {isLoading ? (
                  <Skeleton className="h-9 w-24 bg-slate-800" />
                ) : (
                  <>
                    <span className="text-3xl font-extrabold tracking-tight text-white">
                      {predictedSemesterGpa > 0
                        ? predictedSemesterGpa.toFixed(2)
                        : "N/A"}
                    </span>
                    <span className="text-sm font-semibold text-slate-400">/ 4.0</span>
                    {predictedSemesterGpa > 0 && (
                      <Badge
                        variant="outline"
                        className="ml-1 border-slate-700 bg-slate-800/80 px-2 text-xs font-bold text-blue-300"
                      >
                        {score10ToLetter(predictedSemesterGpa * 2.5)}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-blue-400 ring-1 ring-slate-700/50">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Weighted credit average projected across all active courses
          </p>
        </div>

        {/* Card 2: Term Academic Risk Status */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Academic Risk Status
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                {isLoading ? (
                  <Skeleton className="h-9 w-28 bg-slate-800" />
                ) : atRiskCount === 0 ? (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <ShieldCheck className="h-6 w-6 shrink-0" />
                    <span className="text-2xl font-bold tracking-tight">On Track</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <AlertTriangle className="h-6 w-6 shrink-0" />
                    <span className="text-2xl font-bold tracking-tight">
                      {atRiskCount} {atRiskCount === 1 ? "Course" : "Courses"} At-Risk
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-slate-700/50",
                atRiskCount === 0 ? "bg-emerald-950/50 text-emerald-400" : "bg-rose-950/50 text-rose-400"
              )}
            >
              {atRiskCount === 0 ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {atRiskCount === 0
              ? "All registered courses currently meet pass thresholds"
              : `${atRiskCount} of ${totalCourses} active courses need focused intervention`}
          </p>
        </div>

        {/* Card 3: Active Registered Courses */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Evaluated Courses
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                {isLoading ? (
                  <Skeleton className="h-9 w-20 bg-slate-800" />
                ) : (
                  <>
                    <span className="text-3xl font-extrabold tracking-tight text-white">
                      {totalCourses}
                    </span>
                    <span className="text-sm font-semibold text-slate-400">
                      {totalCourses === 1 ? "Class" : "Classes"}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-emerald-400 ring-1 ring-slate-700/50">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Fast memory-cached switching across all registered classes
          </p>
        </div>
      </div>

      {/* 3. In-Memory Course Switcher Tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
            Select Course to Inspect
          </h2>
          <span className="text-xs text-slate-400">
            Click to switch instantly without reloading
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : activeCourses.length === 0 ? (
          <Card className="border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-700">No active course enrollments</p>
            <p className="text-xs text-slate-500">There are no courses enrolled for this term.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {activeCourses.map((course) => {
              const pred = predictionMap.get(course.course_code);
              const isSelected = course.course_code === currentActiveCourseCode;

              return (
                <button
                  key={course.course_code}
                  type="button"
                  onClick={() => handleSelectCourse(course.course_code)}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer shadow-2xs",
                    isSelected
                      ? "border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {course.course_code}
                      </span>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-700">
                        {course.course_name}
                      </p>
                    </div>

                    {pred && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 px-1.5 py-0 text-[10px] font-semibold",
                          pred.risk_level === "HIGH" &&
                            "border-rose-300 bg-rose-50 text-rose-700",
                          pred.risk_level === "MEDIUM" &&
                            "border-amber-300 bg-amber-50 text-amber-700",
                          pred.risk_level === "LOW" &&
                            "border-emerald-300 bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {pred.risk_level === "HIGH" && "High Risk"}
                        {pred.risk_level === "MEDIUM" && "Medium"}
                        {pred.risk_level === "LOW" && "Safe"}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 pt-2 text-[11px] text-slate-500">
                    <span>
                      {course.credits} {course.credits === 1 ? "credit" : "credits"}
                    </span>
                    {pred ? (
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span className="text-slate-700">
                          {pred.predicted_score10.toFixed(1)}/10
                        </span>
                        <span className="text-slate-300">•</span>
                        <span
                          className={cn(
                            "font-bold",
                            pred.risk_level === "HIGH"
                              ? "text-rose-600"
                              : pred.risk_level === "MEDIUM"
                                ? "text-amber-600"
                                : "text-emerald-600"
                          )}
                        >
                          {Math.round(pred.fail_probability * 100)}% rớt
                        </span>
                      </div>
                    ) : (
                      <span className="italic text-slate-400">Evaluating...</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Detailed Course Prediction & TreeSHAP XAI Breakdown */}
      {currentActiveCourseCode && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column (7 cols): Course Deep-Dive & Predicted Grade Card */}
          <div className="space-y-6 lg:col-span-7">
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-extrabold text-blue-700">
                        {currentActiveCourseCode}
                      </span>
                      {activeCourseMeta?.class_group && (
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
                        >
                          Group {activeCourseMeta.class_group}
                        </Badge>
                      )}
                      {activeCourseMeta?.credits && (
                        <Badge
                          variant="secondary"
                          className="border border-blue-100 bg-blue-50 text-xs font-semibold text-blue-700"
                        >
                          {activeCourseMeta.credits} Credits
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mt-1 text-lg font-bold text-slate-900">
                      {activeCourseMeta?.course_name || activePrediction?.course_name || "Course Details"}
                    </CardTitle>
                  </div>

                  {activePrediction ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-2.5 py-1 text-xs font-bold",
                        activePrediction.risk_level === "HIGH" &&
                          "border-rose-300 bg-rose-50 text-rose-700",
                        activePrediction.risk_level === "MEDIUM" &&
                          "border-amber-300 bg-amber-50 text-amber-700",
                        activePrediction.risk_level === "LOW" &&
                          "border-emerald-300 bg-emerald-50 text-emerald-700"
                      )}
                    >
                      {activePrediction.risk_level === "HIGH" && "Nguy cơ Rớt cao"}
                      {activePrediction.risk_level === "MEDIUM" && "Rủi ro Trung bình"}
                      {activePrediction.risk_level === "LOW" && "An toàn"}
                      <span className="ml-1.5 font-extrabold">
                        ({Math.round(activePrediction.fail_probability * 100)}% rớt môn)
                      </span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 text-xs">
                      {isLoadingCourseDetail ? "Đang tải AI..." : "Chưa có dự báo"}
                    </Badge>
                  )}
                </div>

                {activeCourseMeta?.lecturer_name && (
                  <CardDescription className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>Lecturer: {activeCourseMeta.lecturer_name}</span>
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-6 pt-5">
                {/* Predicted Score Hero Grid - 4 Columns */}
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                  {/* Card 1: Fail Probability (% RỚT MÔN) */}
                  <div
                    className={cn(
                      "rounded-xl border p-4 text-center transition-all",
                      !activePrediction
                        ? "border-slate-100 bg-slate-50/70"
                        : activePrediction.risk_level === "HIGH"
                          ? "border-rose-200 bg-rose-50/60 ring-1 ring-rose-200/50"
                          : activePrediction.risk_level === "MEDIUM"
                            ? "border-amber-200 bg-amber-50/60 ring-1 ring-amber-200/50"
                            : "border-emerald-200 bg-emerald-50/60 ring-1 ring-emerald-200/50"
                    )}
                  >
                    <p className="text-[11px] font-bold tracking-wider uppercase text-slate-600">
                      Tỷ lệ Rớt môn
                    </p>
                    <div className="mt-1 flex items-baseline justify-center gap-1">
                      {isLoadingCourseDetail ? (
                        <Skeleton className="h-9 w-16 mx-auto bg-slate-200" />
                      ) : (
                        <span
                          className={cn(
                            "text-3xl font-extrabold tracking-tight",
                            !activePrediction
                              ? "text-slate-400"
                              : activePrediction.risk_level === "HIGH"
                                ? "text-rose-700"
                                : activePrediction.risk_level === "MEDIUM"
                                  ? "text-amber-700"
                                  : "text-emerald-700"
                          )}
                        >
                          {activePrediction
                            ? `${Math.round(activePrediction.fail_probability * 100)}%`
                            : "--"}
                        </span>
                      )}
                    </div>
                    {activePrediction && (
                      <div className="mt-2 space-y-1">
                        <Progress
                          value={Math.round(activePrediction.fail_probability * 100)}
                          className={cn(
                            "h-1.5 **:data-[slot=progress-track]:bg-white/80",
                            activePrediction.risk_level === "HIGH"
                              ? "**:data-[slot=progress-indicator]:bg-rose-500"
                              : activePrediction.risk_level === "MEDIUM"
                                ? "**:data-[slot=progress-indicator]:bg-amber-500"
                                : "**:data-[slot=progress-indicator]:bg-emerald-500"
                          )}
                        />
                        <p className="text-[10px] font-semibold text-slate-500">
                          {activePrediction.risk_level === "HIGH"
                            ? "Nguy cơ rớt cao"
                            : activePrediction.risk_level === "MEDIUM"
                              ? "Rủi ro trung bình"
                              : "Mức độ an toàn"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Score 10 */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                    <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                      Điểm Dự kiến
                    </p>
                    <div className="mt-1 flex items-baseline justify-center gap-1">
                      {isLoadingCourseDetail ? (
                        <Skeleton className="h-9 w-16 mx-auto bg-slate-200" />
                      ) : (
                        <>
                          <span className="text-3xl font-extrabold text-slate-900">
                            {activePrediction ? activePrediction.predicted_score10.toFixed(1) : "--"}
                          </span>
                          <span className="text-sm font-semibold text-slate-400">/ 10</span>
                        </>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">Thang điểm 10</p>
                  </div>

                  {/* Card 3: GPA 4.0 */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                    <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                      GPA Dự kiến
                    </p>
                    <div className="mt-1 flex items-baseline justify-center gap-1">
                      {isLoadingCourseDetail ? (
                        <Skeleton className="h-9 w-16 mx-auto bg-slate-200" />
                      ) : (
                        <>
                          <span className="text-3xl font-extrabold text-blue-700">
                            {activePrediction ? activePrediction.predicted_gpa4.toFixed(2) : "--"}
                          </span>
                          <span className="text-sm font-semibold text-slate-400">/ 4.0</span>
                        </>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">Thang chuẩn 4.0</p>
                  </div>

                  {/* Card 4: Letter Grade */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                    <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                      Điểm Chữ
                    </p>
                    <div className="mt-1 flex items-baseline justify-center">
                      {isLoadingCourseDetail ? (
                        <Skeleton className="h-9 w-12 mx-auto bg-slate-200" />
                      ) : (
                        <span className="text-3xl font-extrabold text-slate-900">
                          {activePrediction
                            ? score10ToLetter(activePrediction.predicted_score10)
                            : "--"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">Hạng học phần</p>
                  </div>
                </div>

                {/* Current Marks Component Breakdown (if available) */}
                {activePrediction?.current_marks &&
                  Object.keys(activePrediction.current_marks).length > 0 && (
                    <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          Recorded In-Term Assessments
                        </span>
                        <span className="text-[11px] text-slate-400">
                          From LMS Gradebook
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {Object.entries(activePrediction.current_marks).map(([key, val]) => {
                          const label =
                            key === "giua_ky"
                              ? "Midterm"
                              : key === "btl"
                                ? "Assignment"
                                : key.toUpperCase();
                          return (
                            <div
                              key={key}
                              className="rounded-lg border border-slate-200/80 bg-white p-2.5 text-center shadow-2xs"
                            >
                              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                                {label}
                              </span>
                              <p className="mt-0.5 text-sm font-bold text-slate-800">
                                {val !== null && val !== undefined ? `${val}/10` : "TBD"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* AI Model Evaluation Note */}
                <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900">
                  <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-blue-950">
                      Predictive Model Information
                    </p>
                    <p className="leading-relaxed text-blue-800/90">
                      Predictions are generated using gradient boosted trees trained on historic academic progression, prerequisite mastery, and current semester attendance. Probabilities update dynamically as midterm marks are finalized.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actionable Recommendations Card */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  Targeted Academic Recommendations
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Personalized action steps based on this course's risk profile
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {activePrediction?.risk_level === "HIGH" ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3.5 text-xs text-rose-900 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-rose-950">
                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                      Priority Intervention Suggested
                    </div>
                    <p className="leading-relaxed text-rose-800">
                      This course carries a high likelihood of academic difficulty. We recommend contacting Lecturer{" "}
                      <strong>{activeCourseMeta?.lecturer_name || "the course instructor"}</strong> during office hours, forming study groups with class peers, and reviewing foundational prerequisite materials.
                    </p>
                  </div>
                ) : activePrediction?.risk_level === "MEDIUM" ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                      <Info className="h-4 w-4 text-amber-600 shrink-0" />
                      Moderate Focus Recommended
                    </div>
                    <p className="leading-relaxed text-amber-800">
                      Performance is near passing boundaries. Concentrating on upcoming laboratory exercises and assignment deadlines can secure a solid B or higher grade.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-900 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      Strong Standing
                    </div>
                    <p className="leading-relaxed text-emerald-800">
                      Your historical background and current performance indicate a low risk of failure. Keep up consistent lecture attendance and study momentum.
                    </p>
                  </div>
                )}

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/student/overview")}
                    className="cursor-pointer text-xs font-medium text-slate-700"
                  >
                    &larr; Back to Overview
                  </Button>

                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(`/student/what-if?course=${currentActiveCourseCode}`)
                    }
                    className="cursor-pointer gap-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
                  >
                    <span>Simulate Custom Grades in What-If</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (5 cols): Explainable AI (TreeSHAP) Factor Breakdown */}
          <div className="space-y-6 lg:col-span-5">
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    Explainable AI (TreeSHAP)
                  </CardTitle>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Top Contributing Factors
                  </span>
                </div>
                <CardDescription className="text-xs text-slate-500">
                  Feature attributions detailing why the model predicted this outcome
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {activePrediction?.top_shap_factors && activePrediction.top_shap_factors.length > 0 ? (
                  <div className="space-y-3">
                    {activePrediction.top_shap_factors.map((factor: ShapFactorResponse, idx: number) => {
                      const isPositive = factor.impact === "DECREASE_RISK";
                      const absValue = Math.abs(factor.shap_value);
                      const barPercent = Math.min(100, Math.round(absValue * 100));

                      return (
                        <div
                          key={factor.feature || idx}
                          className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition-colors hover:bg-slate-50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-slate-800 truncate">
                              {factor.feature}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 gap-1 px-1.5 py-0 text-[10px] font-bold",
                                isPositive
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "border-rose-300 bg-rose-50 text-rose-700"
                              )}
                            >
                              {isPositive ? (
                                <>
                                  <TrendingDown className="h-3 w-3" />
                                  Decreases Risk
                                </>
                              ) : (
                                <>
                                  <TrendingUp className="h-3 w-3" />
                                  Increases Risk
                                </>
                              )}
                            </Badge>
                          </div>

                          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                            {factor.description ||
                              (isPositive
                                ? "This academic metric positively shields against course failure."
                                : "This factor puts downward pressure on your course outcome.")}
                          </p>

                          <div className="mt-2.5 flex items-center gap-2">
                            <Progress
                              value={barPercent}
                              className={cn(
                                "h-1.5 flex-1 **:data-[slot=progress-track]:bg-slate-200",
                                isPositive
                                  ? "**:data-[slot=progress-indicator]:bg-emerald-500"
                                  : "**:data-[slot=progress-indicator]:bg-rose-500"
                              )}
                            />
                            <span className="font-mono text-[10px] font-semibold text-slate-400">
                              |SHAP|: {absValue.toFixed(3)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Info className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-xs font-semibold text-slate-600">
                      No SHAP factors calculated yet
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Factor attributions will appear once initial marks are registered.
                    </p>
                  </div>
                )}

                {/* Methodology info */}
                <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                  <p>
                    <strong>TreeSHAP value</strong> measures the additive marginal contribution of each feature to the log-odds of passing the course.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
