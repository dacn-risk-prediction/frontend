import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthUser } from "@/features/auth";
import { formatSemesterLabel, useActiveSemester } from "@/hooks/use-active-semester";
import { score10ToLetter } from "@/lib/grade-scale";
import { formatFeatureName, sanitizeShapDescription } from "@/lib/shap-features";
import { cn } from "@/lib/utils";
import type {
  CourseCounterfactualResponse,
  CoursePredictionResponse,
  ShapFactorResponse,
  TargetGoal,
} from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ClipboardList,
  Info,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  User,
  UserCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

type ActiveTool = "LMS" | "IMPROVE" | "EXPLAIN" | null;

/**
 * Fallback calculation for required final exam scores when counterfactual data is not loaded
 */
function calculateFinalExamTargets(
  currentMarks?: CoursePredictionResponse["current_marks"],
  predictedScore10?: number,
) {
  let processScore: number | null = null;

  if (currentMarks && Object.keys(currentMarks).length > 0) {
    const gk = currentMarks.giua_ky ?? null;
    const btl = currentMarks.btl ?? null;
    const lab = currentMarks.lab ?? null;
    const quiz = currentMarks.quiz ?? null;

    const otherScores = [btl, lab, quiz].filter(
      (s): s is number => s !== null && s !== undefined,
    );
    const otherAvg =
      otherScores.length > 0
        ? otherScores.reduce((a, b) => a + b, 0) / otherScores.length
        : null;

    if (gk !== null && otherAvg !== null) {
      processScore = gk * 0.6 + otherAvg * 0.4;
    } else if (gk !== null) {
      processScore = gk;
    } else if (otherAvg !== null) {
      processScore = otherAvg;
    }
  }

  const baselineProcess =
    processScore ??
    (predictedScore10 ? Math.min(10, Math.max(0, predictedScore10)) : 6.0);

  const calcTarget = (
    targetTotal: number,
  ): {
    score: number;
    label: string;
    status: "safe" | "achievable" | "challenging";
  } => {
    const rawReq = Number((2 * targetTotal - baselineProcess).toFixed(1));
    const effectiveReq = Math.max(3.0, rawReq);

    if (effectiveReq <= 3.0) {
      return {
        score: 3.0,
        label: "≥ 3.0 (Tránh điểm liệt)",
        status: "safe",
      };
    }
    if (effectiveReq <= 8.5) {
      return {
        score: effectiveReq,
        label: `≥ ${effectiveReq.toFixed(1)} điểm`,
        status: "achievable",
      };
    }
    if (effectiveReq <= 10.0) {
      return {
        score: effectiveReq,
        label: `≥ ${effectiveReq.toFixed(1)} điểm`,
        status: "challenging",
      };
    }
    return {
      score: 10.0,
      label: "Khó đạt (> 10.0)",
      status: "challenging",
    };
  };

  return {
    pass: calcTarget(4.0),
    gradeB: calcTarget(7.0),
    gradeA: calcTarget(8.5),
    hasRecordedMarks: processScore !== null,
    estimatedProcessScore: Number(baselineProcess.toFixed(1)),
  };
}

/**
 * Extract an actual score pill (e.g. "9.8/10") for a SHAP factor when available
 */
function extractFactorScorePill(
  rawFeature: string,
  currentMarks?: CoursePredictionResponse["current_marks"],
  description?: string,
): string | null {
  const f = rawFeature.toLowerCase();
  if (currentMarks) {
    const key = f.includes("giua_ky") || f.includes("midterm")
      ? "giua_ky"
      : f.includes("btl") || f.includes("assignment")
        ? "btl"
        : f.includes("lab") || f.includes("thuc_hanh")
          ? "lab"
          : f.includes("quiz") || f.includes("chuyen_can")
            ? "quiz"
            : null;
    if (key && currentMarks[key] !== null && currentMarks[key] !== undefined) {
      return `${Number(currentMarks[key]).toFixed(1)}/10`;
    }
  }
  if (description) {
    const match = description.match(/(\d+(?:[.,]\d+)?)\s*\/\s*10/);
    if (match) {
      const parsed = Number(match[1].replace(",", "."));
      if (!Number.isNaN(parsed)) {
        return `${parsed.toFixed(1)}/10`;
      }
    }
  }
  return null;
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

  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [coursePopoverOpen, setCoursePopoverOpen] = useState(false);
  const [goalByCourse, setGoalByCourse] = useState<Record<string, TargetGoal>>(
    {},
  );

  // 1. Fetch registered courses & enrollments (no batch prediction scan)
  const {
    data: rawCurrentCourses,
    isLoading: isLoadingCourses,
    isError: isCoursesError,
    refetch: refetchCourses,
  } = useStudentCurrentCourses(studentId);
  const { data: enrollments } = useStudentEnrollments(studentId);

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
        !exemptedCodes.has(c.course_code),
    );
  }, [rawCurrentCourses, enrollments]);

  // Only select a course when explicitly present in URL (?course=...)
  const currentActiveCourseCode = useMemo(() => {
    if (
      queryCourse &&
      activeCourses.some((c) => c.course_code === queryCourse)
    ) {
      return queryCourse;
    }
    return "";
  }, [queryCourse, activeCourses]);

  const selectedTargetGoal: TargetGoal | null =
    goalByCourse[currentActiveCourseCode] ?? null;

  // 2. Lazy-fetch core prediction ONLY when a course is selected
  const {
    data: singlePrediction,
    isLoading: isLoadingPrediction,
    refetch: refetchPrediction,
    isRefetching: isRefetchingPrediction,
  } = useCoursePrediction(
    studentId,
    currentActiveCourseCode || undefined,
    activeSemesterCode,
    { enabled: Boolean(studentId && currentActiveCourseCode) },
  );

  // 3. Lazy-fetch Counterfactual & 13 Pedagogical Scenarios ONLY when "Cải thiện & Mô phỏng" is opened
  const shouldFetchCounterfactual = Boolean(
    studentId && currentActiveCourseCode && activeTool === "IMPROVE",
  );

  const {
    data: counterfactualData,
    isLoading: isLoadingCounterfactual,
    refetch: refetchCounterfactual,
    isRefetching: isRefetchingCounterfactual,
  } = useCourseCounterfactual(
    studentId,
    currentActiveCourseCode || undefined,
    activeSemesterCode,
    selectedTargetGoal ?? "PASS",
    { enabled: shouldFetchCounterfactual },
  );

  // Reset Tier 3 tool whenever course changes
  const handleSelectCourse = (code: string) => {
    setActiveTool(null);
    setCoursePopoverOpen(false);
    if (code) {
      setSearchParams({ course: code });
    } else {
      setSearchParams({});
    }
  };

  const handleToggleTool = (tool: Exclude<ActiveTool, null>) => {
    setActiveTool((prev) => (prev === tool ? null : tool));
  };

  const handleTargetGoalChange = (goal: TargetGoal) => {
    if (!currentActiveCourseCode) return;
    setGoalByCourse((prev) => ({
      ...prev,
      [currentActiveCourseCode]: goal,
    }));
  };

  const getCachedPrediction = (
    code: string,
  ): CoursePredictionResponse | undefined => {
    if (code === currentActiveCourseCode && singlePrediction) {
      return singlePrediction;
    }
    const cachedPred = queryClient.getQueryData<CoursePredictionResponse | null>(
      COURSE_PREDICTION_QUERY_KEY(studentId, code, activeSemesterCode),
    );
    if (cachedPred) return cachedPred;

    const cachedCf =
      queryClient.getQueryData<CourseCounterfactualResponse | null>(
        COURSE_COUNTERFACTUAL_QUERY_KEY(
          studentId,
          code,
          activeSemesterCode,
          goalByCourse[code] ?? "PASS",
        ),
      );
    if (cachedCf) {
      return {
        course_code: cachedCf.course_code,
        course_name: cachedCf.course_name,
        credits: cachedCf.credits,
        class_id: cachedCf.class_id,
        class_group: cachedCf.class_group,
        lecturer_name: cachedCf.lecturer_name,
        semester_code: cachedCf.semester_code,
        record_status: null,
        fail_probability: cachedCf.baseline.fail_probability,
        predicted_course_fail: cachedCf.baseline.predicted_course_fail,
        is_at_risk: cachedCf.baseline.is_at_risk,
        risk_level: cachedCf.baseline.risk_level,
        predicted_score10: cachedCf.baseline.predicted_score10,
        predicted_gpa4: cachedCf.baseline.predicted_gpa4,
        current_marks: cachedCf.baseline.current_marks,
        top_shap_factors: cachedCf.top_shap_factors,
      };
    }
    return undefined;
  };

  const activePrediction =
    (currentActiveCourseCode
      ? getCachedPrediction(currentActiveCourseCode)
      : undefined) || null;

  const activeCourseMeta = useMemo(() => {
    if (!currentActiveCourseCode) return null;
    return (
      activeCourses.find((c) => c.course_code === currentActiveCourseCode) ||
      null
    );
  }, [currentActiveCourseCode, activeCourses]);

  const isLoadingCourseDetail = isLoadingPrediction && !activePrediction;
  const isRefetchingSingle =
    isRefetchingPrediction ||
    (activeTool === "IMPROVE" && isRefetchingCounterfactual);
  const isPredictionUnavailable =
    !isLoadingCourses &&
    !isLoadingPrediction &&
    Boolean(currentActiveCourseCode) &&
    !activePrediction;

  const refetchSingle = () => {
    void refetchPrediction();
    if (activeTool === "IMPROVE") {
      void refetchCounterfactual();
    }
  };

  const finalExamTargets = useMemo(() => {
    return calculateFinalExamTargets(
      activePrediction?.current_marks,
      activePrediction?.predicted_score10,
    );
  }, [activePrediction]);

  const navigateToWhatIf = (params?: {
    finalTarget?: number;
    targetGoal?: TargetGoal;
    changes?: Record<string, number | null>;
  }) => {
    if (!currentActiveCourseCode) {
      navigate("/student/what-if");
      return;
    }

    const goal = params?.targetGoal ?? selectedTargetGoal ?? "PASS";
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
      (goalRawScore !== null &&
      goalRawScore !== undefined &&
      goalRawScore <= 10
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
    <TooltipProvider>
      <div className="space-y-6 pb-12">
        {/* Header (clean, no top-right button clutter or dark KPI cards) */}
        <header>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Dự báo Kết quả Học phần
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Chọn môn học để xem dự báo điểm số, mức độ rủi ro và mở công cụ
            phân tích chi tiết ·{" "}
            <span className="font-medium text-slate-800">
              {activeSemesterLabel}
            </span>
          </p>
        </header>

        {/* Error Recovery Banner */}
        {isCoursesError && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-rose-600"
                aria-hidden="true"
              />
              <span>
                Không thể tải danh sách môn học kỳ hiện tại. Vui lòng thử lại.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetchCourses()}
              className="h-8 w-fit cursor-pointer gap-1.5 border-rose-200 bg-white text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Thử lại</span>
            </Button>
          </div>
        )}

        {/* TIER 1: Compact Course Grid (when no course selected) OR 1-Bar Popover Switcher (when selected) */}
        {!currentActiveCourseCode ? (
          <section aria-label="Chọn môn học để dự báo" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Chọn học phần trong kỳ ({activeCourses.length} môn)
              </h2>
              <span className="text-xs text-slate-500">
                Chỉ phân tích AI khi bạn chọn môn
              </span>
            </div>

            {isLoadingCourses ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton
                    key={i}
                    className="h-24 w-full rounded-xl bg-slate-100"
                  />
                ))}
              </div>
            ) : activeCourses.length === 0 ? (
              <Card className="border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <BookOpen
                  className="mx-auto h-8 w-8 text-slate-400"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  Chưa có học phần đang học
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Không tìm thấy môn học đăng ký trong {activeSemesterLabel}.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeCourses.map((course) => {
                  const cached = getCachedPrediction(course.course_code);

                  return (
                    <button
                      key={course.course_code}
                      type="button"
                      onClick={() => handleSelectCourse(course.course_code)}
                      className={cn(
                        "group flex cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition-colors hover:border-blue-300 hover:bg-blue-50/30",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono text-xs font-bold text-blue-700">
                            {course.course_code}
                          </span>
                          <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                            {course.course_name}
                          </p>
                        </div>

                        {cached && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 px-2 py-0.5 text-xs font-semibold",
                              cached.risk_level === "HIGH" &&
                                "border-rose-200 bg-rose-50 text-rose-700",
                              cached.risk_level === "MEDIUM" &&
                                "border-amber-200 bg-amber-50 text-amber-700",
                              cached.risk_level === "LOW" &&
                                "border-emerald-200 bg-emerald-50 text-emerald-700",
                            )}
                          >
                            {cached.risk_level === "HIGH"
                              ? "Nguy cơ cao"
                              : cached.risk_level === "MEDIUM"
                                ? "Cần chú ý"
                                : "An toàn"}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500 tabular-nums">
                        <span>
                          {course.credits} TC
                          {course.class_group
                            ? ` · Nhóm ${course.class_group}`
                            : ""}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-blue-600 group-hover:text-blue-700">
                          <span>Xem dự báo</span>
                          <ArrowRight
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          /* Collapsed Tier 1: Compact 1-Bar Popover Switcher */
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-2xs">
            <div className="flex min-w-0 items-center gap-2.5 text-xs">
              <span className="font-medium text-slate-500">Đang xem:</span>
              <span className="font-mono font-bold text-blue-700">
                {currentActiveCourseCode}
              </span>
              <span className="truncate font-semibold text-slate-900">
                {activeCourseMeta?.course_name}
              </span>
              {activeCourseMeta?.credits && (
                <span className="hidden text-slate-500 tabular-nums sm:inline">
                  · {activeCourseMeta.credits} TC
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Popover
                open={coursePopoverOpen}
                onOpenChange={setCoursePopoverOpen}
              >
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 cursor-pointer gap-1.5 text-xs font-semibold"
                    />
                  }
                >
                  <span>Đổi môn học</span>
                  <ChevronsUpDown
                    className="h-3.5 w-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-1.5">
                  <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                    Chọn học phần ({activeCourses.length})
                  </div>
                  <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                    {activeCourses.map((course) => {
                      const isCurrent =
                        course.course_code === currentActiveCourseCode;
                      return (
                        <button
                          key={course.course_code}
                          type="button"
                          onClick={() => handleSelectCourse(course.course_code)}
                          className={cn(
                            "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                            isCurrent
                              ? "bg-blue-50/80 text-blue-900"
                              : "hover:bg-slate-50",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900">
                                {course.course_code}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500 tabular-nums">
                                {course.credits} TC
                              </span>
                            </div>
                            <p className="truncate font-medium text-slate-700">
                              {course.course_name}
                            </p>
                          </div>
                          {isCurrent && (
                            <Check
                              className="h-4 w-4 shrink-0 text-blue-600"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSelectCourse("")}
                className="h-8 cursor-pointer px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Danh sách môn
              </Button>
            </div>
          </div>
        )}

        {/* TIER 2 & TIER 3: Core Prediction Card + 3 Action Buttons + On-Demand Tools */}
        {currentActiveCourseCode && (
          <div className="space-y-4">
            {/* Prediction Unavailable Fallback Banner */}
            {isPredictionUnavailable && (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                    aria-hidden="true"
                  />
                  <div className="max-w-[70ch]">
                    <p className="font-bold text-amber-950">
                      Dịch vụ dự báo AI tạm thời gián đoạn
                    </p>
                    <p className="mt-0.5 leading-relaxed text-amber-800">
                      Chưa thể kết nối tới mô hình dự báo cho học phần này. Bạn
                      vẫn có thể thử tải lại hoặc mở giả lập What-If.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refetchSingle}
                  disabled={isRefetchingSingle}
                  className="h-8 w-fit shrink-0 cursor-pointer border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  <RefreshCw
                    className={cn(
                      "mr-1.5 h-3.5 w-3.5",
                      isRefetchingSingle && "animate-spin",
                    )}
                    aria-hidden="true"
                  />
                  Thử lại
                </Button>
              </div>
            )}

            {/* TIER 2: Single Core Result Card (Predicted Score + Risk % + 3 Actions) */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-blue-700">
                        {currentActiveCourseCode}
                      </span>
                      {activeCourseMeta?.class_group && (
                        <span className="text-xs font-medium text-slate-500">
                          · Nhóm {activeCourseMeta.class_group}
                        </span>
                      )}
                      {activeCourseMeta?.credits && (
                        <span className="text-xs font-medium text-slate-500 tabular-nums">
                          · {activeCourseMeta.credits} TC
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-900">
                      {activeCourseMeta?.course_name ||
                        activePrediction?.course_name ||
                        "Chi tiết học phần"}
                    </CardTitle>
                    {activeCourseMeta?.lecturer_name && (
                      <CardDescription className="flex items-center gap-1.5 text-xs text-slate-500">
                        <User className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Giảng viên: {activeCourseMeta.lecturer_name}</span>
                      </CardDescription>
                    )}
                  </div>

                  {/* Small icon refresh button inside Tier 2 card */}
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={refetchSingle}
                          disabled={isRefetchingSingle}
                          aria-label="Cập nhật lại dự báo"
                          className="shrink-0 cursor-pointer text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        />
                      }
                    >
                      <RefreshCw
                        className={cn(
                          "h-4 w-4",
                          isRefetchingSingle && "animate-spin",
                        )}
                        aria-hidden="true"
                      />
                    </TooltipTrigger>
                    <TooltipContent>Cập nhật lại dự báo</TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 pt-5">
                {/* Core Metrics Row: ONLY Predicted Score + Risk % */}
                <div className="grid grid-cols-1 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  {/* Metric 1: Predicted Score */}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        Điểm dự kiến
                      </span>
                      {activePrediction && (
                        <Badge
                          variant="outline"
                          className="border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 tabular-nums"
                        >
                          Hạng {score10ToLetter(activePrediction.predicted_score10)}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2 flex items-baseline gap-2 tabular-nums">
                      {isLoadingCourseDetail ? (
                        <Skeleton className="h-9 w-28 bg-slate-200" />
                      ) : activePrediction ? (
                        <>
                          <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                            {activePrediction.predicted_score10.toFixed(1)}
                          </span>
                          <span className="text-sm font-medium text-slate-500">
                            / 10
                          </span>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-sm font-semibold text-blue-700">
                            GPA {activePrediction.predicted_gpa4.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-2xl font-bold text-slate-400">
                          —
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metric 2: Fail Risk % */}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        Rủi ro rớt môn
                      </span>
                      {activePrediction && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1 text-xs font-semibold",
                            activePrediction.risk_level === "HIGH" &&
                              "border-rose-200 bg-rose-50 text-rose-700",
                            activePrediction.risk_level === "MEDIUM" &&
                              "border-amber-200 bg-amber-50 text-amber-800",
                            activePrediction.risk_level === "LOW" &&
                              "border-emerald-200 bg-emerald-50 text-emerald-700",
                          )}
                        >
                          {activePrediction.risk_level === "LOW" ? (
                            <ShieldCheck
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          ) : (
                            <AlertTriangle
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          )}
                          <span>
                            {activePrediction.risk_level === "HIGH"
                              ? "Nguy cơ cao"
                              : activePrediction.risk_level === "MEDIUM"
                                ? "Cần chú ý"
                                : "An toàn"}
                          </span>
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2 tabular-nums">
                      {isLoadingCourseDetail ? (
                        <Skeleton className="h-9 w-24 bg-slate-200" />
                      ) : activePrediction ? (
                        <div className="space-y-2">
                          <span
                            className={cn(
                              "text-3xl font-extrabold tracking-tight",
                              activePrediction.risk_level === "HIGH"
                                ? "text-rose-700"
                                : activePrediction.risk_level === "MEDIUM"
                                  ? "text-amber-700"
                                  : "text-emerald-700",
                            )}
                          >
                            {Math.round(activePrediction.fail_probability * 100)}%
                          </span>
                          <Progress
                            value={Math.round(
                              activePrediction.fail_probability * 100,
                            )}
                            className={cn(
                              "h-1.5 bg-slate-200",
                              activePrediction.risk_level === "HIGH"
                                ? "**:data-[slot=progress-indicator]:bg-rose-500"
                                : activePrediction.risk_level === "MEDIUM"
                                  ? "**:data-[slot=progress-indicator]:bg-amber-500"
                                  : "**:data-[slot=progress-indicator]:bg-emerald-500",
                            )}
                          />
                        </div>
                      ) : (
                        <span className="text-2xl font-bold text-slate-400">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3 Action Buttons Row (Single-Active Disclosure, unified active state + Chevron) */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {/* Action 1: LMS Component Marks */}
                  <Button
                    type="button"
                    variant={activeTool === "LMS" ? "default" : "outline"}
                    onClick={() => handleToggleTool("LMS")}
                    className={cn(
                      "h-10 cursor-pointer justify-between px-3.5 text-xs font-semibold",
                      activeTool === "LMS"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" aria-hidden="true" />
                      <span>Điểm thành phần</span>
                    </span>
                    {activeTool === "LMS" ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>

                  {/* Action 2: Improve & Simulate */}
                  <Button
                    type="button"
                    variant={activeTool === "IMPROVE" ? "default" : "outline"}
                    onClick={() => handleToggleTool("IMPROVE")}
                    className={cn(
                      "h-10 cursor-pointer justify-between px-3.5 text-xs font-semibold",
                      activeTool === "IMPROVE"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                      <span>Cải thiện &amp; Mô phỏng</span>
                    </span>
                    {activeTool === "IMPROVE" ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>

                  {/* Action 3: AI Explanation (Inline 2x2) */}
                  <Button
                    type="button"
                    variant={activeTool === "EXPLAIN" ? "default" : "outline"}
                    onClick={() => handleToggleTool("EXPLAIN")}
                    className={cn(
                      "h-10 cursor-pointer justify-between px-3.5 text-xs font-semibold",
                      activeTool === "EXPLAIN"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      <span>Lý do AI dự đoán</span>
                    </span>
                    {activeTool === "EXPLAIN" ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* TIER 3A: Collapsible LMS Component Marks */}
            <Collapsible
              open={activeTool === "LMS"}
              onOpenChange={(open) => setActiveTool(open ? "LMS" : null)}
            >
              <CollapsibleContent>
                <Card className="border-slate-200 bg-white shadow-xs">
                  <CardHeader className="border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold text-slate-900">
                        Điểm thành phần đã ghi nhận
                      </CardTitle>
                      <span className="text-xs text-slate-500">
                        Từ sổ điểm LMS / Edusoft
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {isLoadingCourseDetail ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                          <Skeleton
                            key={i}
                            className="h-16 w-full rounded-lg bg-slate-100"
                          />
                        ))}
                      </div>
                    ) : activePrediction?.current_marks &&
                      Object.keys(activePrediction.current_marks).length > 0 ? (
                      <div className="grid grid-cols-2 divide-y divide-slate-100 rounded-xl border border-slate-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                        {Object.entries(activePrediction.current_marks).map(
                          ([key, val]) => {
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
                              <div key={key} className="p-3.5 text-center">
                                <span className="text-xs font-semibold text-slate-500">
                                  {label}
                                </span>
                                <p className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                                  {val !== null && val !== undefined
                                    ? `${Number(val).toFixed(1)}/10`
                                    : "Chưa có"}
                                </p>
                              </div>
                            );
                          },
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-6 text-center text-xs text-slate-500">
                        Chưa có cột điểm thành phần nào được cập nhật trên hệ
                        thống.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>

            {/* TIER 3B: Improve & Simulate Panel (Counterfactual + Advice + What-If + Advising CTA) */}
            {activeTool === "IMPROVE" && (
              <section
                aria-label="Công cụ cải thiện và mô phỏng"
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-xs">
                  <div className="flex items-center gap-2">
                    <Lightbulb
                      className="h-4 w-4 text-blue-600"
                      aria-hidden="true"
                    />
                    <h2 className="text-sm font-bold text-slate-900">
                      Kế hoạch cải thiện &amp; Giả lập điểm số
                    </h2>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Thông tin kỹ thuật về tính toán lộ trình"
                            className="inline-flex cursor-pointer items-center text-slate-400 hover:text-slate-700"
                          />
                        }
                      >
                        <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Tính toán gợi ý thay đổi tối thiểu (Counterfactual
                        Recourse) kết hợp 13 kịch bản sư phạm từ mô hình XGBoost.
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {(activePrediction?.risk_level === "HIGH" ||
                    activePrediction?.risk_level === "MEDIUM") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/student/advising")}
                      className="h-8 cursor-pointer gap-1.5 text-xs font-semibold"
                    >
                      <UserCheck
                        className="h-3.5 w-3.5 text-blue-600"
                        aria-hidden="true"
                      />
                      <span>Liên hệ Cố vấn Học vụ</span>
                    </Button>
                  )}
                </div>

                <CounterfactualRecourseCard
                  courseCode={currentActiveCourseCode}
                  counterfactualData={counterfactualData ?? null}
                  isLoading={isLoadingCounterfactual}
                  targetGoal={selectedTargetGoal}
                  onTargetGoalChange={handleTargetGoalChange}
                  fallbackTargets={finalExamTargets}
                  onApplyPlanToWhatIf={(params) => navigateToWhatIf(params)}
                />

                {selectedTargetGoal !== null && (
                  <PedagogicalAdviceCard
                    studentId={studentId}
                    courseCode={currentActiveCourseCode}
                    semesterCode={activeSemesterCode}
                    targetGoal={selectedTargetGoal}
                    riskLevel={activePrediction?.risk_level}
                    lecturerName={activeCourseMeta?.lecturer_name}
                    recommendations={counterfactualData?.recommendations ?? []}
                    isLoadingCounterfactual={isLoadingCounterfactual}
                    onNavigateOverview={() => navigate("/student/overview")}
                    onNavigateWhatIf={() => navigateToWhatIf()}
                  />
                )}
              </section>
            )}

            {/* TIER 3C: Flat 2-Column Hairline AI Explanation */}
            <Collapsible
              open={activeTool === "EXPLAIN"}
              onOpenChange={(open) => setActiveTool(open ? "EXPLAIN" : null)}
            >
              <CollapsibleContent>
                <Card className="border-slate-200 bg-white shadow-xs">
                  <CardHeader className="border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold text-slate-900">
                        Lý do AI dự đoán
                      </CardTitle>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              aria-label="Chi tiết phương pháp giải thích"
                              className="inline-flex cursor-pointer items-center text-slate-400 hover:text-slate-700"
                            />
                          }
                        >
                          <Info className="h-4 w-4" aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Tỷ trọng tương đối được tính từ giá trị đóng góp biên
                          trên mô hình dự báo cho học phần{" "}
                          {currentActiveCourseCode}. Di chuột vào từng dòng để
                          xem chi tiết.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <CardDescription className="text-xs text-slate-500">
                      Phân bổ tỷ trọng các yếu tố ảnh hưởng đến kết quả dự báo
                      học phần {currentActiveCourseCode}.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-0">
                    {isLoadingCourseDetail ? (
                      <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
                        <div className="space-y-3 p-5">
                          <Skeleton className="h-4 w-36 bg-slate-100" />
                          <Skeleton className="h-10 w-full bg-slate-100" />
                          <Skeleton className="h-10 w-full bg-slate-100" />
                        </div>
                        <div className="space-y-3 p-5">
                          <Skeleton className="h-4 w-36 bg-slate-100" />
                          <Skeleton className="h-10 w-full bg-slate-100" />
                          <Skeleton className="h-10 w-full bg-slate-100" />
                        </div>
                      </div>
                    ) : activePrediction?.top_shap_factors &&
                      activePrediction.top_shap_factors.length > 0 ? (
                      (() => {
                        const factors = activePrediction.top_shap_factors;
                        const totalAbsShap =
                          factors.reduce(
                            (sum, f) => sum + Math.abs(f.shap_value),
                            0,
                          ) || 1;
                        const safeFactors = factors
                          .filter((f) => f.impact === "DECREASE_RISK")
                          .sort(
                            (a, b) =>
                              Math.abs(b.shap_value) - Math.abs(a.shap_value),
                          );
                        const riskFactors = factors
                          .filter((f) => f.impact !== "DECREASE_RISK")
                          .sort(
                            (a, b) =>
                              Math.abs(b.shap_value) - Math.abs(a.shap_value),
                          );

                        const renderFactorRow = (
                          factor: ShapFactorResponse,
                          idx: number,
                          isPositive: boolean,
                        ) => {
                          const absValue = Math.abs(factor.shap_value);
                          const relPct = Math.max(
                            1,
                            Math.round((absValue / totalAbsShap) * 100),
                          );
                          const featureInfo = formatFeatureName(factor.feature);
                          const scorePill = extractFactorScorePill(
                            factor.feature,
                            activePrediction.current_marks,
                            factor.description,
                          );
                          const cleanDesc = sanitizeShapDescription(
                            factor.description,
                            factor.feature,
                          );

                          return (
                            <Tooltip key={`${factor.feature}-${idx}`}>
                              <TooltipTrigger
                                render={
                                  <div className="group cursor-default space-y-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50" />
                                }
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate text-xs font-semibold text-slate-800">
                                      {featureInfo.label}
                                    </span>
                                    {scorePill && (
                                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 tabular-nums">
                                        {scorePill}
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={cn(
                                      "shrink-0 font-mono text-xs font-bold tabular-nums",
                                      isPositive
                                        ? "text-emerald-700"
                                        : "text-rose-700",
                                    )}
                                  >
                                    {relPct}%
                                  </span>
                                </div>

                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={cn(
                                      "h-full min-w-1.5 rounded-full transition-all",
                                      isPositive
                                        ? "bg-emerald-500"
                                        : "bg-rose-500",
                                    )}
                                    style={{ width: `${relPct}%` }}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs space-y-1">
                                <p className="font-mono text-xs font-semibold tabular-nums">
                                  Độ ảnh hưởng: {absValue.toFixed(3)} ({relPct}
                                  %)
                                </p>
                                <p className="text-xs leading-relaxed">
                                  {cleanDesc}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        };

                        return (
                          <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
                            {/* Left Column: Safe Factors */}
                            <div className="space-y-2.5 p-5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full bg-emerald-500"
                                  aria-hidden="true"
                                />
                                <h3 className="text-xs font-bold text-slate-700">
                                  Yếu tố giúp an toàn
                                </h3>
                              </div>
                              {safeFactors.length === 0 ? (
                                <p className="py-2 text-xs text-slate-400">
                                  Chưa ghi nhận yếu tố giảm rủi ro nổi bật.
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  {safeFactors.map((factor, idx) =>
                                    renderFactorRow(factor, idx, true),
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Right Column: Risk Factors */}
                            <div className="space-y-2.5 p-5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full bg-rose-500"
                                  aria-hidden="true"
                                />
                                <h3 className="text-xs font-bold text-slate-700">
                                  Yếu tố làm tăng rủi ro
                                </h3>
                              </div>
                              {riskFactors.length === 0 ? (
                                <p className="py-2 text-xs text-slate-400">
                                  Không có yếu tố làm tăng rủi ro đáng kể.
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  {riskFactors.map((factor, idx) =>
                                    renderFactorRow(factor, idx, false),
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="py-8 text-center">
                        <Info
                          className="mx-auto h-8 w-8 text-slate-300"
                          aria-hidden="true"
                        />
                        <p className="mt-2 text-xs font-semibold text-slate-700">
                          Chưa có dữ liệu giải thích
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Các yếu tố tác động sẽ hiển thị sau khi mô hình hoàn
                          tất phân tích học phần.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
