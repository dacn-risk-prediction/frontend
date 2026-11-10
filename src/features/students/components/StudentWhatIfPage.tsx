import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { CoursePredictionResponse } from "@/types";
import {
  useStudentCurrentCourses,
  useStudentEnrollments,
  useStudentPredictions,
  useStudentSummary,
} from "../api/student-api";

function score10ToGpa4(score: number): number {
  if (score >= 8.5) return 4.0;
  if (score >= 8.0) return 3.5;
  if (score >= 7.0) return 3.0;
  if (score >= 6.5) return 2.5;
  if (score >= 5.5) return 2.0;
  if (score >= 5.0) return 1.5;
  if (score >= 4.0) return 1.0;
  return 0.0;
}

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

export const StudentWhatIfPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedCourse = searchParams.get("course");
  const navigate = useNavigate();

  const { data: user } = useAuthUser();
  const studentId = user?.user_code || user?.id;

  // Real academic data queries
  const { data: summary, isLoading: isLoadingSummary } =
    useStudentSummary(studentId);
  const { data: rawCurrentCourses, isLoading: isLoadingCourses } =
    useStudentCurrentCourses(studentId);
  const { data: enrollments } = useStudentEnrollments(studentId);
  const { data: predictions, isLoading: isLoadingPredictions } =
    useStudentPredictions(studentId);

  // Exclude exempted courses (final_score === 12) so only active studied courses are simulated
  const currentCourses = useMemo(() => {
    if (!rawCurrentCourses) return undefined;
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

  // Map AI predictions by course_code
  const predictionMap = useMemo(() => {
    const map = new Map<string, CoursePredictionResponse>();
    if (predictions?.courses) {
      for (const item of predictions.courses) {
        map.set(item.course_code, item);
      }
    }
    return map;
  }, [predictions]);

  // Selected course for XAI SHAP factor explanations (derived)
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(
    null,
  );

  const activeCourseCode = useMemo(() => {
    if (selectedCourseCode) return selectedCourseCode;
    if (preselectedCourse) return preselectedCourse;
    if (currentCourses && currentCourses.length > 0) {
      const highestRisk =
        currentCourses.find(
          (c) => predictionMap.get(c.course_code)?.risk_level === "HIGH",
        ) ||
        currentCourses.find(
          (c) => predictionMap.get(c.course_code)?.risk_level === "MEDIUM",
        ) ||
        currentCourses[0];
      return highestRisk?.course_code ?? "";
    }
    return "";
  }, [selectedCourseCode, preselectedCourse, currentCourses, predictionMap]);

  // Interactive simulated overrides: course_code -> score (0 - 10)
  const [userScores, setUserScores] = useState<Record<string, number>>({});

  const handleScoreChange = (courseCode: string, newScore: number) => {
    setUserScores((prev) => ({
      ...prev,
      [courseCode]: newScore,
    }));
  };

  const handleResetToPredictions = () => {
    setUserScores({});
  };

  const handleSetAllPreset = (targetScore: number) => {
    if (!currentCourses) return;
    const updated: Record<string, number> = {};
    for (const course of currentCourses) {
      updated[course.course_code] = targetScore;
    }
    setUserScores(updated);
  };

  const handleSelectCourse = (code: string) => {
    setSelectedCourseCode(code);
    setSearchParams({ course: code });
  };

  // Dynamic calculations based on simulated scores
  const {
    baselineTermGpa,
    simulatedTermGpa,
    termGpaDelta,
    currentCumulativeGpa,
    projectedCumulativeGpa,
    cumulativeGpaDelta,
    totalTermCredits,
    simulatedAtRiskCount,
    baselineAtRiskCount,
  } = useMemo(() => {
    if (!currentCourses || currentCourses.length === 0) {
      return {
        baselineTermGpa: 0,
        simulatedTermGpa: 0,
        termGpaDelta: 0,
        currentCumulativeGpa: summary?.cumulative_gpa ?? 0,
        projectedCumulativeGpa: summary?.cumulative_gpa ?? 0,
        cumulativeGpaDelta: 0,
        totalTermCredits: 0,
        simulatedAtRiskCount: 0,
        baselineAtRiskCount: 0,
      };
    }

    const totalCredits = currentCourses.reduce(
      (sum, c) => sum + (c.credits || 0),
      0,
    );
    const baselineGpa =
      predictions?.predicted_semester_gpa4 ??
      (summary?.cumulative_gpa ?? 3.0);

    let simGradePoints = 0;
    let simRiskCount = 0;

    for (const course of currentCourses) {
      const pred = predictionMap.get(course.course_code);
      const score =
        userScores[course.course_code] ??
        (pred?.predicted_score10 ?? 7.0);
      const gpa4 = score10ToGpa4(score);
      simGradePoints += gpa4 * (course.credits || 0);

      // Course is considered at risk if simulated score < 5.0
      if (score < 5.0) {
        simRiskCount += 1;
      }
    }

    const simTermGpa = totalCredits > 0 ? simGradePoints / totalCredits : 0;
    const termDelta = Number((simTermGpa - baselineGpa).toFixed(2));

    // Projected Cumulative GPA
    const passedCredits = summary?.total_passed_credits ?? 0;
    const curCumGpa = summary?.cumulative_gpa ?? 3.0;
    const pastGradePoints = curCumGpa * passedCredits;

    const projCumGpa =
      passedCredits + totalCredits > 0
        ? (pastGradePoints + simGradePoints) / (passedCredits + totalCredits)
        : simTermGpa;
    const cumDelta = Number((projCumGpa - curCumGpa).toFixed(2));

    const baseRiskCount = predictions?.at_risk_count ?? 0;

    return {
      baselineTermGpa: baselineGpa,
      simulatedTermGpa: Number(simTermGpa.toFixed(2)),
      termGpaDelta: termDelta,
      currentCumulativeGpa: curCumGpa,
      projectedCumulativeGpa: Number(projCumGpa.toFixed(2)),
      cumulativeGpaDelta: cumDelta,
      totalTermCredits: totalCredits,
      simulatedAtRiskCount: simRiskCount,
      baselineAtRiskCount: baseRiskCount,
    };
  }, [currentCourses, predictions, predictionMap, userScores, summary]);

  // Selected course details & SHAP factors
  const focusedCourse = useMemo(() => {
    return currentCourses?.find((c) => c.course_code === activeCourseCode);
  }, [currentCourses, activeCourseCode]);

  const focusedPrediction = useMemo(() => {
    return predictionMap.get(activeCourseCode);
  }, [predictionMap, activeCourseCode]);

  const isLoading =
    isLoadingCourses || isLoadingSummary || isLoadingPredictions;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              What-If Academic Simulator
            </h1>
            <Badge className="bg-blue-600 font-medium text-white shadow-2xs">
              <Sparkles className="mr-1 h-3 w-3" />
              XAI Engine
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Simulate hypothetical grades on your active enrolled courses and
            explore transparent TreeSHAP risk counterfactuals.
          </p>
        </div>
      </div>

      {/* 2. Active Target Course Focus Callout */}
      {focusedCourse && (
        <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white shadow-xs">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-900">
                Target Simulation Focus:{" "}
                <span className="font-mono text-sm font-bold">
                  {focusedCourse.course_code}
                </span>{" "}
                • {focusedCourse.course_name}
              </p>
              <p className="text-xs text-blue-700">
                Explainable TreeSHAP counterfactual model loaded for this
                course. Adjust target scores below.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer border-blue-200 bg-white text-xs font-medium text-blue-800 shadow-2xs hover:bg-blue-50"
              onClick={handleResetToPredictions}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
              Reset to AI Predictions
            </Button>
          </div>
        </div>
      )}

      {/* 3. Main Simulator Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-slate-200 bg-white p-6 shadow-xs lg:col-span-2">
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
              <div className="space-y-4 pt-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </Card>
          <Card className="border-slate-200 bg-white p-6 shadow-xs">
            <div className="space-y-4">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          </Card>
        </div>
      ) : summary?.is_graduated ? (
        <Card className="border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h3 className="mt-3 text-lg font-bold text-slate-800">
            Degree Completed
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            This student has already graduated and does not have active enrolled
            courses in the current semester for What-If grade simulation.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => navigate("/student/overview")}
          >
            Back to Overview
          </Button>
        </Card>
      ) : !currentCourses || currentCourses.length === 0 ? (
        <Card className="border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <BookOpen className="h-7 w-7" />
          </div>
          <h3 className="mt-3 text-lg font-bold text-slate-800">
            No Active Courses Found
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            No courses are currently registered for this student in the active
            semester. Register courses first to unlock What-If grade simulation.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => navigate("/student/overview")}
          >
            Back to Overview
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column (2 Cols): Real Course Grade Sliders & SHAP Insights */}
          <div className="space-y-6 lg:col-span-2">
            {/* Sliders Card */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                      <SlidersHorizontal className="h-5 w-5 text-blue-700" />
                      Hypothetical Grade Inputs
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Adjust your target 10-point grades for actual enrolled
                      courses to simulate instant GPA and risk shifts.
                    </CardDescription>
                  </div>
                  {/* Quick Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                    <span className="text-[11px] font-medium text-slate-500">
                      Presets:
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] font-medium"
                      onClick={() => handleSetAllPreset(6.5)}
                    >
                      Safe (6.5)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] font-medium"
                      onClick={() => handleSetAllPreset(8.0)}
                    >
                      Merit (8.0)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] font-medium"
                      onClick={() => handleSetAllPreset(9.0)}
                    >
                      High (9.0)
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {currentCourses.map((course) => {
                  const pred = predictionMap.get(course.course_code);
                  const currentScore =
                    userScores[course.course_code] ??
                    (pred?.predicted_score10 ?? 7.0);
                  const isTarget = course.course_code === activeCourseCode;
                  const gpa4 = score10ToGpa4(currentScore);
                  const letter = score10ToLetter(currentScore);
                  const predScore = pred?.predicted_score10;
                  const scoreDiff =
                    predScore !== undefined
                      ? Number((currentScore - predScore).toFixed(1))
                      : 0;

                  return (
                    <div
                      key={course.class_id || course.course_code}
                      className={cn(
                        "rounded-xl border p-4 transition-all",
                        isTarget
                          ? "border-blue-400 bg-blue-50/20 ring-1 ring-blue-300 shadow-2xs"
                          : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900">
                            {course.course_code}
                          </span>
                          <span className="text-sm font-medium text-slate-700">
                            {course.course_name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="h-5 border border-slate-200 bg-slate-100 text-[10px] font-medium text-slate-700"
                          >
                            {course.credits}{" "}
                            {course.credits === 1 ? "credit" : "credits"}
                          </Badge>
                        </div>

                        {/* Baseline AI Risk Status */}
                        {pred && (
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold",
                                pred.risk_level === "HIGH" &&
                                  "border-rose-200 bg-rose-50 text-rose-700",
                                pred.risk_level === "MEDIUM" &&
                                  "border-amber-200 bg-amber-50 text-amber-700",
                                pred.risk_level === "LOW" &&
                                  "border-emerald-200 bg-emerald-50 text-emerald-700",
                              )}
                            >
                              AI Baseline: {pred.risk_level} (
                              {Math.round(pred.fail_probability * 100)}% risk)
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-6 px-2 text-[10px] font-semibold",
                                isTarget
                                  ? "bg-blue-100 text-blue-800"
                                  : "text-blue-600 hover:bg-blue-50",
                              )}
                              onClick={() =>
                                handleSelectCourse(course.course_code)
                              }
                            >
                              {isTarget ? "Inspecting XAI" : "Inspect XAI"}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Interactive Slider */}
                      <div className="mt-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={currentScore}
                          onChange={(e) =>
                            handleScoreChange(
                              course.course_code,
                              parseFloat(e.target.value),
                            )
                          }
                          className="h-2 w-full cursor-pointer accent-blue-700"
                          aria-label={`Target score for ${course.course_name}`}
                        />
                        <div className="flex shrink-0 items-center justify-between sm:justify-end gap-2">
                          <span className="font-mono text-sm font-bold text-blue-700 min-w-17.5 text-right">
                            {currentScore.toFixed(1)} / 10
                          </span>
                          <Badge
                            variant="outline"
                            className="font-mono text-xs font-semibold border-slate-300 bg-slate-50 min-w-19.5 justify-center"
                          >
                            {letter} • GPA {gpa4.toFixed(1)}
                          </Badge>
                        </div>
                      </div>

                      {/* Comparison with AI predicted score */}
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          AI Predicted:{" "}
                          <span className="font-semibold text-slate-700">
                            {predScore !== undefined
                              ? `${predScore.toFixed(1)} / 10`
                              : "N/A"}
                          </span>
                        </span>
                        {predScore !== undefined && (
                          <span
                            className={cn(
                              "font-medium",
                              scoreDiff > 0 && "text-emerald-600",
                              scoreDiff < 0 && "text-rose-600",
                              scoreDiff === 0 && "text-slate-400",
                            )}
                          >
                            {scoreDiff > 0 &&
                              `+${scoreDiff.toFixed(1)} above AI prediction`}
                            {scoreDiff < 0 &&
                              `${scoreDiff.toFixed(1)} below AI prediction`}
                            {scoreDiff === 0 && "Equal to AI prediction"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* TreeSHAP Explainable AI Insights Card */}
            {focusedCourse && (
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <Sparkles className="h-4.5 w-4.5 text-blue-600" />
                        TreeSHAP Explainability: {focusedCourse.course_code}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Root cause factors impacting academic risk prediction
                        for {focusedCourse.course_name}
                      </CardDescription>
                    </div>
                    {focusedPrediction && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-2 py-0.5 text-xs font-semibold",
                          focusedPrediction.risk_level === "HIGH" &&
                            "border-rose-200 bg-rose-50 text-rose-700",
                          focusedPrediction.risk_level === "MEDIUM" &&
                            "border-amber-200 bg-amber-50 text-amber-700",
                          focusedPrediction.risk_level === "LOW" &&
                            "border-emerald-200 bg-emerald-50 text-emerald-700",
                        )}
                      >
                        {focusedPrediction.risk_level} Risk
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-1">
                  {focusedPrediction?.top_shap_factors &&
                  focusedPrediction.top_shap_factors.length > 0 ? (
                    <div className="space-y-2.5">
                      {focusedPrediction.top_shap_factors.map(
                        (factor, index) => {
                          const isRiskIncrease =
                            factor.impact === "INCREASE_RISK";
                          const isRiskDecrease =
                            factor.impact === "DECREASE_RISK";

                          return (
                            <div
                              key={index}
                              className={cn(
                                "flex items-start gap-3 rounded-lg border p-3 text-xs transition-colors",
                                isRiskIncrease &&
                                  "border-rose-200 bg-rose-50/50 text-rose-900",
                                isRiskDecrease &&
                                  "border-emerald-200 bg-emerald-50/50 text-emerald-900",
                                !isRiskIncrease &&
                                  !isRiskDecrease &&
                                  "border-slate-200 bg-slate-50/50 text-slate-800",
                              )}
                            >
                              <div
                                className={cn(
                                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                                  isRiskIncrease &&
                                    "bg-rose-100 text-rose-700",
                                  isRiskDecrease &&
                                    "bg-emerald-100 text-emerald-700",
                                  !isRiskIncrease &&
                                    !isRiskDecrease &&
                                    "bg-slate-200 text-slate-700",
                                )}
                              >
                                {isRiskIncrease && (
                                  <TrendingUp className="h-3 w-3" />
                                )}
                                {isRiskDecrease && (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {!isRiskIncrease && !isRiskDecrease && (
                                  <ShieldCheck className="h-3 w-3" />
                                )}
                              </div>

                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold uppercase text-[11px]">
                                    {factor.feature.replace(/_/g, " ")}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] font-semibold h-4.5 px-1.5",
                                      isRiskIncrease &&
                                        "border-rose-300 bg-white text-rose-700",
                                      isRiskDecrease &&
                                        "border-emerald-300 bg-white text-emerald-700",
                                      !isRiskIncrease &&
                                        !isRiskDecrease &&
                                        "border-slate-300 bg-white text-slate-700",
                                    )}
                                  >
                                    {isRiskIncrease && "Raises Risk"}
                                    {isRiskDecrease && "Lowers Risk"}
                                    {!isRiskIncrease &&
                                      !isRiskDecrease &&
                                      "Neutral"}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                                  {factor.description}
                                </p>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500">
                      AI factor breakdown is standard baseline. The model
                      evaluates overall prerequisite GPA, attendance records, and
                      course difficulty weighting to compute risk.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column (1 Col): Projected Dynamic Outcomes */}
          <div className="space-y-6">
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-900">
                  Projected Outcome
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Real-time estimated metrics under current simulated grades
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Projected Term GPA */}
                <div className="rounded-xl bg-slate-900 p-5 text-white shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                      Projected Term GPA
                    </p>
                    <Badge
                      variant="outline"
                      className="border-slate-700 bg-slate-800 text-[10px] text-slate-300"
                    >
                      Semester 261
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-white">
                      {simulatedTermGpa.toFixed(2)}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        termGpaDelta > 0 && "text-emerald-400",
                        termGpaDelta < 0 && "text-rose-400",
                        termGpaDelta === 0 && "text-slate-400",
                      )}
                    >
                      {termGpaDelta > 0 && `+${termGpaDelta.toFixed(2)} boost`}
                      {termGpaDelta < 0 && `${termGpaDelta.toFixed(2)} drop`}
                      {termGpaDelta === 0 && "Baseline"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{totalTermCredits} enrolled credits</span>
                    <span>
                      Baseline AI:{" "}
                      <span className="font-semibold text-slate-300">
                        {baselineTermGpa.toFixed(2)}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Projected Cumulative GPA */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Projected Cumulative GPA
                  </p>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-slate-900">
                        {projectedCumulativeGpa.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500">
                        (Current: {currentCumulativeGpa.toFixed(2)})
                      </span>
                    </div>
                    {cumulativeGpaDelta !== 0 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold",
                          cumulativeGpaDelta > 0 &&
                            "border-emerald-200 bg-emerald-50 text-emerald-700",
                          cumulativeGpaDelta < 0 &&
                            "border-rose-200 bg-rose-50 text-rose-700",
                        )}
                      >
                        {cumulativeGpaDelta > 0
                          ? `+${cumulativeGpaDelta.toFixed(2)}`
                          : cumulativeGpaDelta.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Risk Level Shift */}
                <div
                  className={cn(
                    "rounded-xl border p-4 transition-colors",
                    simulatedAtRiskCount === 0
                      ? "border-emerald-200 bg-emerald-50/70"
                      : simulatedAtRiskCount === 1
                        ? "border-amber-200 bg-amber-50/70"
                        : "border-rose-200 bg-rose-50/70",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className={cn(
                        "h-4 w-4",
                        simulatedAtRiskCount === 0
                          ? "text-emerald-700"
                          : simulatedAtRiskCount === 1
                            ? "text-amber-700"
                            : "text-rose-700",
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-bold uppercase tracking-wide",
                        simulatedAtRiskCount === 0
                          ? "text-emerald-900"
                          : simulatedAtRiskCount === 1
                            ? "text-amber-900"
                            : "text-rose-900",
                      )}
                    >
                      Risk Level Shift
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2 text-sm">
                    <span className="text-xs text-slate-500 line-through">
                      {baselineAtRiskCount > 0
                        ? `${baselineAtRiskCount} Course(s) At Risk`
                        : "Baseline Safe"}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    <span
                      className={cn(
                        "font-bold text-sm",
                        simulatedAtRiskCount === 0
                          ? "text-emerald-700"
                          : simulatedAtRiskCount === 1
                            ? "text-amber-700"
                            : "text-rose-700",
                      )}
                    >
                      {simulatedAtRiskCount === 0
                        ? "Low Academic Risk"
                        : `${simulatedAtRiskCount} Course(s) At Risk`}
                    </span>
                  </div>

                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                    {simulatedAtRiskCount === 0
                      ? "All courses simulated above passing threshold (≥ 5.0). Term failure probability is minimized."
                      : `${simulatedAtRiskCount} course(s) are simulated below 5.0. Focus your study efforts on these subjects to reduce academic risk.`}
                  </p>
                </div>

                {/* Reset button */}
                <Button
                  variant="outline"
                  className="w-full cursor-pointer border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={handleResetToPredictions}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5 text-slate-500" />
                  Reset to AI Predicted Baseline
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
