import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  TrendingUp,
  TrendingDown,
  Layers,
  Award,
  Target,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/features/auth";
import { useActiveSemester, formatSemesterLabel } from "@/hooks/use-active-semester";
import { score10ToLetter } from "@/lib/grade-scale";
import { formatFeatureName } from "@/lib/shap-features";
import { cn } from "@/lib/utils";
import type {
  CourseCounterfactualResponse,
  CoursePredictionResponse,
  ShapFactorResponse,
  TargetGoal,
} from "@/types";
import {
  COURSE_COUNTERFACTUAL_QUERY_KEY,
  COURSE_PREDICTION_QUERY_KEY,
  useCourseCounterfactual,
  useCoursePrediction,
  useStudentCurrentCourses,
  useStudentEnrollments,
} from "../api/student-api";
import { CounterfactualRecourseCard } from "./CounterfactualRecourseCard";
import { PedagogicalAdviceCard } from "./PedagogicalAdviceCard";

type CourseFilterType = "ALL" | "ATTENTION" | "SAFE";

/**
 * Calculate required final exam scores to meet target grades
 */
function calculateFinalExamTargets(
  currentMarks?: CoursePredictionResponse["current_marks"],
  predictedScore10?: number
) {
  let processScore: number | null = null;

  if (currentMarks && Object.keys(currentMarks).length > 0) {
    const gk = currentMarks.giua_ky ?? null;
    const btl = currentMarks.btl ?? null;
    const lab = currentMarks.lab ?? null;
    const quiz = currentMarks.quiz ?? null;

    const otherScores = [btl, lab, quiz].filter((s): s is number => s !== null && s !== undefined);
    const otherAvg = otherScores.length > 0 ? otherScores.reduce((a, b) => a + b, 0) / otherScores.length : null;

    if (gk !== null && otherAvg !== null) {
      processScore = gk * 0.6 + otherAvg * 0.4;
    } else if (gk !== null) {
      processScore = gk;
    } else if (otherAvg !== null) {
      processScore = otherAvg;
    }
  }

  // Fallback to predicted score estimation if no in-term marks are finalized yet
  const baselineProcess = processScore ?? (predictedScore10 ? Math.min(10, Math.max(0, predictedScore10)) : 6.0);

  // HCMUT/Standard University grade formula: FinalScore = ProcessScore * 0.5 + FinalExam * 0.5
  // Required Final Exam = 2 * Target - ProcessScore
  // Note: HCMUT rule requires final exam score >= 3.0 to avoid fail threshold (điểm liệt).
  const calcTarget = (targetTotal: number): { score: number; label: string; status: "safe" | "achievable" | "challenging" } => {
    const rawReq = Number((2 * targetTotal - baselineProcess).toFixed(1));
    const effectiveReq = Math.max(3.0, rawReq);

    if (effectiveReq <= 3.0) {
      return { score: 3.0, label: "≥ 3.0 (Tránh điểm liệt)", status: "safe" };
    }
    if (effectiveReq <= 8.5) {
      return { score: effectiveReq, label: `≥ ${effectiveReq.toFixed(1)} điểm`, status: "achievable" };
    }
    if (effectiveReq <= 10.0) {
      return { score: effectiveReq, label: `≥ ${effectiveReq.toFixed(1)} điểm`, status: "challenging" };
    }
    return { score: 10.0, label: "Khó đạt (> 10.0)", status: "challenging" };
  };

  return {
    pass: calcTarget(5.0), // Qua môn (Điểm tổng kết >= 5.0)
    gradeB: calcTarget(7.0), // Điểm B - Khá (Điểm tổng kết >= 7.0)
    gradeA: calcTarget(8.5), // Điểm A - Giỏi (Điểm tổng kết >= 8.5)
    hasRecordedMarks: processScore !== null,
    estimatedProcessScore: Number(baselineProcess.toFixed(1)),
  };
}

export const StudentSimulationPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCourse = searchParams.get("course");

  const { data: user } = useAuthUser();
  const studentId = user?.user_code || user?.id;
  const { data: activeSemester } = useActiveSemester();
  const activeSemesterCode = activeSemester?.semester_code || "HK261";
  const activeSemesterLabel = formatSemesterLabel(activeSemesterCode);

  // Course list filter state: All, Attention (high/medium risk), Safe
  const [courseFilter, setCourseFilter] = useState<CourseFilterType>("ALL");
  const [goalByCourse, setGoalByCourse] = useState<Record<string, TargetGoal>>({});

  // 1. Fetch current registered courses & enrollments (fast DB call ~0.05s)
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

  // Determine current active course directly from URL search params (or default to first course)
  const currentActiveCourseCode = useMemo(() => {
    if (queryCourse && activeCourses.some((c) => c.course_code === queryCourse)) {
      return queryCourse;
    }
    if (activeCourses.length > 0) {
      return activeCourses[0].course_code;
    }
    return "";
  }, [queryCourse, activeCourses]);

  const currentTargetGoal: TargetGoal =
    goalByCourse[currentActiveCourseCode] ?? "PASS";

  // 2. Unified On-Demand Counterfactual + Prediction + TreeSHAP + 13 Scenarios (~80-120ms)
  const {
    data: counterfactualData,
    isLoading: isLoadingCounterfactual,
    refetch: refetchCounterfactual,
    isRefetching: isRefetchingCounterfactual,
  } = useCourseCounterfactual(
    studentId,
    currentActiveCourseCode || undefined,
    activeSemesterCode,
    currentTargetGoal
  );

  // Smart default target goal when viewing a LOW-risk course for the first time
  useEffect(() => {
    if (
      !currentActiveCourseCode ||
      goalByCourse[currentActiveCourseCode] !== undefined ||
      !counterfactualData ||
      counterfactualData.course_code !== currentActiveCourseCode
    ) {
      return;
    }
    if (counterfactualData.baseline.risk_level === "LOW") {
      const smartGoal: TargetGoal =
        counterfactualData.baseline.predicted_score10 >= 7.0
          ? "GRADE_A"
          : "GRADE_B";
      setGoalByCourse((prev) => ({
        ...prev,
        [currentActiveCourseCode]: smartGoal,
      }));
    }
  }, [currentActiveCourseCode, counterfactualData, goalByCourse]);

  // Graceful fallback to /predictions/course only if /course/counterfactual fails or returns null
  const shouldFetchFallbackPred =
    Boolean(studentId && currentActiveCourseCode) &&
    !isLoadingCounterfactual &&
    !counterfactualData;

  const {
    data: fallbackSinglePrediction,
    isLoading: isLoadingFallbackPred,
    refetch: refetchFallbackPred,
    isRefetching: isRefetchingFallbackPred,
  } = useCoursePrediction(
    studentId,
    currentActiveCourseCode || undefined,
    activeSemesterCode,
    { enabled: shouldFetchFallbackPred }
  );

  const mapCounterfactualToPrediction = (
    cf: CourseCounterfactualResponse
  ): CoursePredictionResponse => ({
    course_code: cf.course_code,
    course_name: cf.course_name,
    credits: cf.credits,
    class_id: cf.class_id,
    class_group: cf.class_group,
    lecturer_name: cf.lecturer_name,
    semester_code: cf.semester_code,
    record_status: null,
    fail_probability: cf.baseline.fail_probability,
    predicted_course_fail: cf.baseline.predicted_course_fail,
    is_at_risk: cf.baseline.is_at_risk,
    risk_level: cf.baseline.risk_level,
    predicted_score10: cf.baseline.predicted_score10,
    predicted_gpa4: cf.baseline.predicted_gpa4,
    current_marks: cf.baseline.current_marks,
    top_shap_factors: cf.top_shap_factors,
  });

  // Helper to retrieve prediction from React Query cache for any course
  const getCachedPrediction = (code: string): CoursePredictionResponse | undefined => {
    if (code === currentActiveCourseCode) {
      if (counterfactualData) {
        return mapCounterfactualToPrediction(counterfactualData);
      }
      if (fallbackSinglePrediction) {
        return fallbackSinglePrediction;
      }
    }

    const goalPreference: TargetGoal[] = goalByCourse[code]
      ? [goalByCourse[code], "PASS", "GRADE_C", "GRADE_B", "GRADE_A"]
      : ["PASS", "GRADE_B", "GRADE_A", "GRADE_C"];

    for (const g of goalPreference) {
      const cfCached = queryClient.getQueryData<CourseCounterfactualResponse | null>(
        COURSE_COUNTERFACTUAL_QUERY_KEY(studentId, code, activeSemesterCode, g)
      );
      if (cfCached) {
        return mapCounterfactualToPrediction(cfCached);
      }
    }

    return (
      queryClient.getQueryData<CoursePredictionResponse | null>(
        COURSE_PREDICTION_QUERY_KEY(studentId, code, activeSemesterCode)
      ) ?? undefined
    );
  };

  // Handler for course switching
  const handleSelectCourse = (code: string) => {
    setSearchParams({ course: code });
  };

  const handleTargetGoalChange = (goal: TargetGoal) => {
    if (!currentActiveCourseCode) return;
    setGoalByCourse((prev) => ({
      ...prev,
      [currentActiveCourseCode]: goal,
    }));
  };

  // Categorize courses into Attention vs Safe groups based on cached predictions
  const attentionCourses = useMemo(() => {
    return activeCourses.filter((c) => {
      const pred = getCachedPrediction(c.course_code);
      return pred && (pred.risk_level === "HIGH" || pred.risk_level === "MEDIUM" || pred.is_at_risk);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourses, currentActiveCourseCode, counterfactualData, fallbackSinglePrediction, goalByCourse]);

  const safeCourses = useMemo(() => {
    return activeCourses.filter((c) => {
      const pred = getCachedPrediction(c.course_code);
      return pred && !pred.is_at_risk && pred.risk_level === "LOW";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourses, currentActiveCourseCode, counterfactualData, fallbackSinglePrediction, goalByCourse]);

  // Courses filtered by current tab
  const filteredCourses = useMemo(() => {
    if (courseFilter === "ATTENTION") return attentionCourses;
    if (courseFilter === "SAFE") return safeCourses;
    return activeCourses;
  }, [courseFilter, attentionCourses, safeCourses, activeCourses]);

  // Handler for filter tab switching: auto-select first matching course if current course is excluded
  const handleFilterChange = (filter: CourseFilterType) => {
    setCourseFilter(filter);
    let nextList = activeCourses;
    if (filter === "ATTENTION") nextList = attentionCourses;
    if (filter === "SAFE") nextList = safeCourses;

    if (nextList.length > 0 && !nextList.some((c) => c.course_code === currentActiveCourseCode)) {
      handleSelectCourse(nextList[0].course_code);
    }
  };

  // Selected course prediction details
  const activePrediction =
    (currentActiveCourseCode ? getCachedPrediction(currentActiveCourseCode) : undefined) || null;

  // Selected course metadata
  const activeCourseMeta = useMemo(() => {
    if (!currentActiveCourseCode) return null;
    return activeCourses.find((c) => c.course_code === currentActiveCourseCode) || null;
  }, [currentActiveCourseCode, activeCourses]);

  const isLoadingSingle =
    isLoadingCounterfactual || (shouldFetchFallbackPred && isLoadingFallbackPred);
  const isRefetchingSingle = isRefetchingCounterfactual || isRefetchingFallbackPred;
  const isLoadingCourseDetail = isLoadingSingle && !activePrediction;
  const isPredictionUnavailable =
    !isLoadingCourses &&
    !isLoadingSingle &&
    Boolean(currentActiveCourseCode) &&
    !activePrediction;

  const refetchSingle = () => {
    void refetchCounterfactual();
    if (shouldFetchFallbackPred) {
      void refetchFallbackPred();
    }
  };

  // Fallback final exam score targets if counterfactual service is offline
  const finalExamTargets = useMemo(() => {
    return calculateFinalExamTargets(activePrediction?.current_marks, activePrediction?.predicted_score10);
  }, [activePrediction]);

  const navigateToWhatIf = (params?: {
    finalTarget?: number
    targetGoal?: TargetGoal
    changes?: Record<string, number | null>
  }) => {
    if (!currentActiveCourseCode) {
      navigate("/student/what-if");
      return;
    }

    const goal = params?.targetGoal ?? currentTargetGoal;
    const targetsSummary = counterfactualData?.final_exam_targets;
    const goalRawScore = targetsSummary
      ? goal === "PASS"
        ? targetsSummary.pass_score
        : goal === "GRADE_C"
          ? targetsSummary.grade_c_score
          : goal === "GRADE_B"
            ? targetsSummary.grade_b_score
            : targetsSummary.grade_a_score
      : goal === "GRADE_A"
        ? finalExamTargets.gradeA.score
        : goal === "GRADE_B"
          ? finalExamTargets.gradeB.score
          : finalExamTargets.pass.score;

    const resolvedFinalTarget =
      params?.finalTarget ??
      (goalRawScore !== null && goalRawScore !== undefined && goalRawScore <= 10
        ? Number(Math.max(3.0, goalRawScore).toFixed(1))
        : undefined);

    const nextParams = new URLSearchParams({
      course: currentActiveCourseCode,
      targetGoal: goal,
    });
    if (resolvedFinalTarget !== undefined) {
      nextParams.set("targetFinal", resolvedFinalTarget.toFixed(1));
    }
    if (params?.changes) {
      for (const compKey of ["quiz", "lab", "btl", "giua_ky"]) {
        const val = params.changes[compKey];
        if (val !== null && val !== undefined) {
          nextParams.set(compKey, Number(val).toFixed(1));
        }
      }
    }
    navigate(`/student/what-if?${nextParams.toString()}`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Quick Actions (Badge xanh AI Sparkles + Nút What-If) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-700/10">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              AI Dự báo & Mô phỏng
            </span>
            <span className="text-xs font-medium text-slate-500">
              {activeSemesterLabel} • TreeSHAP XAI
            </span>
          </div>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Dự báo Kết quả Học phần
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Dự báo máy học theo nhu cầu, ước lượng điểm thi cuối kỳ và phân tích minh bạch các yếu tố tác động.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchSingle();
            }}
            disabled={isRefetchingSingle}
            className="cursor-pointer gap-1.5 border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", isRefetchingSingle && "animate-spin")} />
            <span>Cập nhật AI môn này</span>
          </Button>
          <Button
            size="sm"
            onClick={() => navigateToWhatIf()}
            className="cursor-pointer gap-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Mô phỏng What-If</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Fallback banner when AI Model Service is unreachable or has no forecast */}
      {isPredictionUnavailable && activeCourses.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold text-amber-950">
                Dịch vụ AI Dự báo tạm thời gián đoạn
              </p>
              <p className="mt-0.5 text-amber-800">
                Chưa thể kết nối tới mô hình học máy để suy luận xác suất rớt môn và bóc tách TreeSHAP cho học phần này (dịch vụ suy luận có thể đang khởi động lại hoặc chưa có dữ liệu kỳ hiện tại).
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchSingle();
            }}
            disabled={isRefetchingSingle}
            className="w-fit shrink-0 cursor-pointer border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isRefetchingSingle && "animate-spin")} />
            Thử lại AI
          </Button>
        </div>
      )}

      {/* 2. 3 Thẻ KPI Nền Tối Tập Trung Vào Môn Đang Chọn (Chuẩn phong cách bg-slate-900) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Card 1: Tỷ lệ Rớt môn này (fail_probability) */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  Tỷ lệ Rớt môn này
                </p>
                {currentActiveCourseCode && (
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-400 ring-1 ring-slate-700">
                    {currentActiveCourseCode}
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                {isLoadingCourseDetail ? (
                  <Skeleton className="h-9 w-24 bg-slate-800" />
                ) : activePrediction ? (
                  <>
                    <span
                      className={cn(
                        "text-3xl font-extrabold tracking-tight",
                        activePrediction.risk_level === "HIGH"
                          ? "text-rose-400"
                          : activePrediction.risk_level === "MEDIUM"
                            ? "text-amber-400"
                            : "text-emerald-400"
                      )}
                    >
                      {Math.round(activePrediction.fail_probability * 100)}%
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "ml-1 border-0 px-2 py-0.5 text-xs font-bold",
                        activePrediction.risk_level === "HIGH"
                          ? "bg-rose-950/80 text-rose-300 ring-1 ring-rose-500/40"
                          : activePrediction.risk_level === "MEDIUM"
                            ? "bg-amber-950/80 text-amber-300 ring-1 ring-amber-500/40"
                            : "bg-emerald-950/80 text-emerald-300 ring-1 ring-emerald-500/40"
                      )}
                    >
                      {activePrediction.risk_level === "HIGH"
                        ? "Rủi ro cao"
                        : activePrediction.risk_level === "MEDIUM"
                          ? "Cần chú ý"
                          : "An toàn"}
                    </Badge>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-slate-500">--</span>
                )}
              </div>
            </div>

            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-slate-700/50",
                !activePrediction
                  ? "bg-slate-800/80 text-slate-400"
                  : activePrediction.risk_level === "HIGH"
                    ? "bg-rose-950/60 text-rose-400 ring-rose-500/40"
                    : activePrediction.risk_level === "MEDIUM"
                      ? "bg-amber-950/60 text-amber-400 ring-amber-500/40"
                      : "bg-emerald-950/60 text-emerald-400 ring-emerald-500/40"
              )}
            >
              {!activePrediction || activePrediction.risk_level === "LOW" ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {activePrediction ? (
              <>
                <Progress
                  value={Math.round(activePrediction.fail_probability * 100)}
                  className={cn(
                    "h-1.5 bg-slate-800",
                    activePrediction.risk_level === "HIGH"
                      ? "**:data-[slot=progress-indicator]:bg-rose-500"
                      : activePrediction.risk_level === "MEDIUM"
                        ? "**:data-[slot=progress-indicator]:bg-amber-500"
                        : "**:data-[slot=progress-indicator]:bg-emerald-500"
                  )}
                />
                <p className="text-xs text-slate-400">
                  {activePrediction.risk_level === "HIGH"
                    ? "Học phần có xác suất rớt cao, cần chủ động can thiệp sớm"
                    : activePrediction.risk_level === "MEDIUM"
                      ? "Mức độ rủi ro trung bình, cần củng cố điểm số"
                      : "Xác suất rớt thấp, đang duy trì kết quả ổn định"}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400">Đánh giá rủi ro dựa trên mô hình TreeSHAP...</p>
            )}
          </div>
        </div>

        {/* Card 2: Điểm Dự kiến & Điểm Chữ môn này (Thang 10, GPA 4.0, Điểm A/B/C) */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Điểm Dự kiến Học phần
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                {isLoadingCourseDetail ? (
                  <Skeleton className="h-9 w-28 bg-slate-800" />
                ) : activePrediction ? (
                  <>
                    <span className="text-3xl font-extrabold tracking-tight text-white">
                      {activePrediction.predicted_score10.toFixed(1)}
                    </span>
                    <span className="text-sm font-semibold text-slate-400">/ 10</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-base font-bold text-blue-400">
                      GPA {activePrediction.predicted_gpa4.toFixed(2)}
                    </span>
                    <Badge
                      variant="outline"
                      className="ml-auto border-blue-500/40 bg-blue-950/80 px-2 py-0.5 text-xs font-bold text-blue-300 ring-1 ring-blue-500/30"
                    >
                      Hạng {score10ToLetter(activePrediction.predicted_score10)}
                    </Badge>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-slate-500">--</span>
                )}
              </div>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-blue-400 ring-1 ring-slate-700/50">
              <Award className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-xs text-slate-400">
            <span>
              {activeCourseMeta?.credits ? `${activeCourseMeta.credits} tín chỉ` : "Học phần HK261"}
            </span>
            <span>
              {activePrediction
                ? `Tương đương xếp loại ${score10ToLetter(activePrediction.predicted_score10)} (${activePrediction.predicted_gpa4.toFixed(1)}/4.0)`
                : "Đang tải dữ liệu học phần..."}
            </span>
          </div>
        </div>

        {/* Card 3: Mục tiêu thi Cuối kỳ cần đạt (để qua môn hoặc đạt loại Khá) */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Mục tiêu Cuối kỳ Cần đạt
              </p>
              <div className="mt-2 space-y-1">
                {isLoadingCourseDetail ? (
                  <Skeleton className="h-9 w-32 bg-slate-800" />
                ) : activePrediction ? (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400">
                        {counterfactualData ? "Để Qua môn (≥ 4.0):" : "Để Qua môn (≥ 5.0):"}
                      </span>
                      <span className="text-base font-extrabold text-emerald-400">
                        {counterfactualData?.final_exam_targets
                          ? counterfactualData.final_exam_targets.pass_score !== null &&
                            counterfactualData.final_exam_targets.pass_score <= 10
                            ? counterfactualData.final_exam_targets.pass_score <= 3.0
                              ? "≥ 3.0 (Tránh điểm liệt)"
                              : `≥ ${counterfactualData.final_exam_targets.pass_score.toFixed(1)} điểm`
                            : "Vượt 10.0"
                          : finalExamTargets.pass.label}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400">Để Đạt loại B (≥ 7.0):</span>
                      <span className="text-sm font-bold text-blue-400">
                        {counterfactualData?.final_exam_targets
                          ? counterfactualData.final_exam_targets.grade_b_score !== null &&
                            counterfactualData.final_exam_targets.grade_b_score <= 10
                            ? counterfactualData.final_exam_targets.grade_b_score <= 3.0
                              ? "≥ 3.0 (Tránh điểm liệt)"
                              : `≥ ${counterfactualData.final_exam_targets.grade_b_score.toFixed(1)} điểm`
                            : "Vượt 10.0"
                          : finalExamTargets.gradeB.label}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-slate-500">--</span>
                )}
              </div>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-amber-400 ring-1 ring-slate-700/50">
              <Target className="h-5 w-5" />
            </div>
          </div>

          <p className="mt-2.5 border-t border-slate-800/80 pt-2 text-xs text-slate-400">
            {counterfactualData?.final_exam_targets
              ? `${
                  counterfactualData.final_exam_targets.used_exact_marks
                    ? "Tính theo điểm quá trình đã chốt"
                    : "Ước lượng cột chưa chấm"
                } (Cuối kỳ ${Math.round(
                  (counterfactualData.final_exam_targets.final_exam_weight <= 1
                    ? counterfactualData.final_exam_targets.final_exam_weight * 100
                    : counterfactualData.final_exam_targets.final_exam_weight) || 50
                )}%)`
              : finalExamTargets.hasRecordedMarks
                ? `Điểm quá trình ghi nhận: ${finalExamTargets.estimatedProcessScore}/10 (50% tổng kết)`
                : "Ước lượng theo dữ liệu thành phần & điểm liệt ≥ 3.0"}
          </p>
        </div>
      </div>

      {/* 3. Lưới chọn môn (Card trắng, 3 tab lọc nhanh, Lazy loading preview) */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xs font-bold tracking-wider text-slate-600 uppercase">
              Danh sách Môn học trong kỳ
            </h2>
            <p className="text-xs text-slate-400">
              Nhấp vào môn để AI dự báo tức thì (chỉ mất ~0.2s) và tự động lưu vào bộ nhớ cache
            </p>
          </div>

          {/* 3 Tab Lọc nhỏ: [ Tất cả (N) ] [ 🚨 Cần chú ý (M) ] [ 🛡️ An toàn (K) ] */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => handleFilterChange("ALL")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                courseFilter === "ALL"
                  ? "bg-white text-blue-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Tất cả ({activeCourses.length})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("ATTENTION")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1",
                courseFilter === "ATTENTION"
                  ? "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                  : "text-slate-600 hover:text-rose-700"
              )}
            >
              <span>🚨 Cần chú ý</span>
              <span className="font-bold">({attentionCourses.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("SAFE")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1",
                courseFilter === "SAFE"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                  : "text-slate-600 hover:text-emerald-700"
              )}
            >
              <span>🛡️ An toàn</span>
              <span className="font-bold">({safeCourses.length})</span>
            </button>
          </div>
        </div>

        {isLoadingCourses ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <Card className="border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Chưa có môn học nào trong nhóm "{courseFilter === "ATTENTION" ? "Cần chú ý" : "An toàn"}"
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Vui lòng chọn tab "Tất cả" hoặc nhấp vào các môn học để AI tính toán mức độ rủi ro.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredCourses.map((course) => {
              const cached = getCachedPrediction(course.course_code);
              const isSelected = course.course_code === currentActiveCourseCode;

              return (
                <button
                  key={course.course_code}
                  type="button"
                  onClick={() => handleSelectCourse(course.course_code)}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer shadow-2xs",
                    isSelected
                      ? "border-blue-500 bg-blue-50/40 ring-2 ring-blue-500"
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

                    {cached ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 px-1.5 py-0 text-[10px] font-semibold",
                          cached.risk_level === "HIGH" &&
                            "border-rose-300 bg-rose-50 text-rose-700",
                          cached.risk_level === "MEDIUM" &&
                            "border-amber-300 bg-amber-50 text-amber-700",
                          cached.risk_level === "LOW" &&
                            "border-emerald-300 bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {cached.risk_level === "HIGH" && "Nguy cơ cao"}
                        {cached.risk_level === "MEDIUM" && "Cần chú ý"}
                        {cached.risk_level === "LOW" && "An toàn"}
                      </Badge>
                    ) : isSelected ? (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] font-semibold text-blue-700"
                      >
                        Đang chọn
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-slate-200 bg-slate-50 px-1.5 py-0 text-[10px] text-slate-400"
                      >
                        Chưa xem
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 pt-2 text-[11px] text-slate-500">
                    <span>
                      {course.credits} {course.credits === 1 ? "tín chỉ" : "tín chỉ"}
                    </span>
                    {cached ? (
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span className="text-slate-700">
                          {cached.predicted_score10.toFixed(1)}/10
                        </span>
                        <span className="text-slate-300">•</span>
                        <span
                          className={cn(
                            "font-bold",
                            cached.risk_level === "HIGH"
                              ? "text-rose-600"
                              : cached.risk_level === "MEDIUM"
                                ? "text-amber-600"
                                : "text-emerald-600"
                          )}
                        >
                          {Math.round(cached.fail_probability * 100)}% rớt
                        </span>
                      </div>
                    ) : isSelected && isLoadingSingle ? (
                      <div className="flex items-center gap-1 text-blue-600 font-medium">
                        <Sparkles className="h-3 w-3 animate-spin" />
                        <span>AI đang phân tích...</span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-400">
                        <Sparkles className="h-3 w-3 text-slate-300" />
                        <span>Nhấp để AI dự báo</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Chi tiết môn đang chọn (Cột trái: Card trắng & Cột phải: TreeSHAP XAI) */}
      {currentActiveCourseCode && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* CỘT TRÁI (7 cols): Card trắng border-slate-200, 4 ô điểm, Cột điểm LMS & Mục tiêu cuối kỳ */}
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
                          Nhóm {activeCourseMeta.class_group}
                        </Badge>
                      )}
                      {activeCourseMeta?.credits && (
                        <Badge
                          variant="secondary"
                          className="border border-blue-100 bg-blue-50 text-xs font-semibold text-blue-700"
                        >
                          {activeCourseMeta.credits} Tín chỉ
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mt-1 text-lg font-bold text-slate-900">
                      {activeCourseMeta?.course_name || activePrediction?.course_name || "Chi tiết học phần"}
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
                    <span>Giảng viên: {activeCourseMeta.lecturer_name}</span>
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-6 pt-5">
                {/* 4 Ô Điểm Lớn: Tỷ lệ rớt, Điểm 10, Điểm GPA 4, Điểm Chữ */}
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                  {/* Ô 1: Tỷ lệ Rớt môn (% rớt) */}
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

                  {/* Ô 2: Điểm Thang 10 */}
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

                  {/* Ô 3: Điểm GPA 4.0 */}
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

                  {/* Ô 4: Điểm Chữ */}
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

                {/* Các Cột Điểm Đã Có Trong Sổ Điểm LMS (Giữa kỳ, BTL, Lab, Quiz) */}
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Điểm Thành Phần Đã Ghi Nhận
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Từ sổ điểm LMS / Edusoft
                    </span>
                  </div>

                  {activePrediction?.current_marks && Object.keys(activePrediction.current_marks).length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {Object.entries(activePrediction.current_marks).map(([key, val]) => {
                        const label =
                          key === "giua_ky"
                            ? "Thi Giữa kỳ"
                            : key === "btl"
                              ? "Bài tập lớn / Đồ án"
                              : key === "lab"
                                ? "Thực hành Lab"
                                : key === "quiz"
                                  ? "Chuyên cần / Quiz"
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
                              {val !== null && val !== undefined ? `${Number(val).toFixed(1)}/10` : "Chưa có"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white py-3 text-center text-xs text-slate-500">
                      Chưa có cột điểm thành phần nào được cập nhật trên hệ thống
                    </div>
                  )}
                </div>

                {/* TÍNH NĂNG: Lộ trình Counterfactual & Mục tiêu Điểm thi Cuối kỳ Cần đạt */}
                <CounterfactualRecourseCard
                  courseCode={currentActiveCourseCode}
                  counterfactualData={counterfactualData ?? null}
                  isLoading={isLoadingCounterfactual}
                  targetGoal={currentTargetGoal}
                  onTargetGoalChange={handleTargetGoalChange}
                  fallbackTargets={finalExamTargets}
                  onApplyPlanToWhatIf={(params) => navigateToWhatIf(params)}
                />

                {/* Thông tin giải thích mô hình */}
                <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-xs text-slate-600">
                  <Info className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                  <p className="leading-relaxed text-[11px]">
                    Kết quả dự báo và phương án cải thiện Counterfactual được tính toán trực tiếp trên mô hình máy học XGBoost theo trọng số thật của học phần. Các ước lượng sẽ tự động điều chỉnh chính xác hơn khi có thêm điểm thành phần.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Khuyến nghị học vụ từ 13 Kịch bản Sư phạm & Trợ lý AI */}
            <PedagogicalAdviceCard
              studentId={studentId}
              courseCode={currentActiveCourseCode}
              semesterCode={activeSemesterCode}
              targetGoal={currentTargetGoal}
              riskLevel={activePrediction?.risk_level}
              lecturerName={activeCourseMeta?.lecturer_name}
              recommendations={counterfactualData?.recommendations ?? []}
              isLoadingCounterfactual={isLoadingCounterfactual}
              onNavigateOverview={() => navigate("/student/overview")}
              onNavigateWhatIf={() => navigateToWhatIf()}
            />
          </div>

          {/* CỘT PHẢI (5 cols): Card trắng TreeSHAP XAI (Dịch tên biến kỹ thuật sang tiếng Việt thân thiện) */}
          <div className="space-y-6 lg:col-span-5">
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    Phân tích Giải thích AI (TreeSHAP)
                  </CardTitle>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Yếu tố ảnh hưởng
                  </span>
                </div>
                <CardDescription className="text-xs text-slate-500">
                  Mô hình lượng hóa mức độ tác động của từng đặc trưng đến kết quả dự báo
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {activePrediction?.top_shap_factors && activePrediction.top_shap_factors.length > 0 ? (
                  <div className="space-y-3">
                    {activePrediction.top_shap_factors.map((factor: ShapFactorResponse, idx: number) => {
                      const isPositive = factor.impact === "DECREASE_RISK";
                      const absValue = Math.abs(factor.shap_value);
                      const barPercent = Math.min(100, Math.round(absValue * 100));
                      const featureInfo = formatFeatureName(factor.feature);

                      return (
                        <div
                          key={factor.feature || idx}
                          className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition-colors hover:bg-slate-50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-xs text-slate-900 truncate">
                              {featureInfo.label}
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
                                  Giảm rủi ro
                                </>
                              ) : (
                                <>
                                  <TrendingUp className="h-3 w-3" />
                                  Tăng rủi ro
                                </>
                              )}
                            </Badge>
                          </div>

                          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                            {factor.description ||
                              (isPositive
                                ? `${featureInfo.label} có chỉ số tốt, tạo điểm tựa bảo vệ và kéo giảm nguy cơ rớt môn.`
                                : `${featureInfo.label} đang ở mức bất lợi, làm gia tăng nguy cơ rớt học phần.`)}
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
                      {isLoadingCourseDetail ? "Đang tính toán các yếu tố TreeSHAP..." : "Chưa có yếu tố SHAP nào"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Các yếu tố tác động sẽ xuất hiện sau khi mô hình lượng hóa đặc trưng.
                    </p>
                  </div>
                )}

                {/* Chú giải phương pháp SHAP */}
                <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-400 leading-relaxed">
                  <p>
                    <strong>Chỉ số TreeSHAP:</strong> Đo lường đóng góp biên của từng yếu tố học tập vào việc làm tăng (màu đỏ) hoặc giảm (màu xanh) xác suất rớt học phần.
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
