import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/features/auth";
import { formatSemesterLabel, useActiveSemester } from "@/hooks/use-active-semester";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Globe,
  GraduationCap,
  HeartHandshake,
  Minus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAllCourses,
  useStudentCurrentCourses,
  useStudentDetail,
  useStudentEnrollments,
  useStudentSummary,
} from "../api/student-api";

const DEGREE_TOTAL_CREDITS = 128;
const CTXH_TARGET_DAYS = 15;
const CTXH_KLTN_MILESTONE = 12;

export const StudentOverviewPage = () => {
  const navigate = useNavigate();
  const { data: user } = useAuthUser();

  const studentId = user?.user_code || user?.id;
  const { data: activeSemester } = useActiveSemester();
  const resolvedActiveSemester = activeSemester?.semester_code || "HK261";
  const activeSemesterLabel = formatSemesterLabel(resolvedActiveSemester);

  const {
    data: summary,
    isLoading: isLoadingSummary,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useStudentSummary(studentId);

  const { data: studentDetail, isLoading: isLoadingDetail } =
    useStudentDetail(studentId);

  const {
    data: currentCourses,
    isLoading: isLoadingCourses,
    isError: isCoursesError,
    refetch: refetchCourses,
  } = useStudentCurrentCourses(studentId);

  const { data: enrollments } = useStudentEnrollments(studentId);
  const { data: allCourses } = useAllCourses();

  const hasDataError = isSummaryError || isCoursesError;

  const exemptedCourseSet = useMemo(() => {
    const codes = new Set<string>();
    const classIds = new Set<string>();
    if (enrollments) {
      for (const e of enrollments) {
        if (
          e.final_score !== null &&
          e.final_score !== undefined &&
          Number(e.final_score) === 12
        ) {
          codes.add(e.course_code);
          if (e.class_id) classIds.add(e.class_id);
        }
      }
    }
    return { codes, classIds };
  }, [enrollments]);

  const activeCurrentCourses = useMemo(() => {
    if (!currentCourses) return [];
    return currentCourses.filter((c) => {
      if (c.class_id && exemptedCourseSet.classIds.has(c.class_id)) {
        return false;
      }
      if (exemptedCourseSet.codes.has(c.course_code)) {
        return false;
      }
      return true;
    });
  }, [currentCourses, exemptedCourseSet]);

  const greetingName = user?.name
    ? user.name.trim().split(/\s+/).slice(-1)[0]
    : "bạn";

  const hasCompletedGradedSemester = Boolean(
    summary?.semester_gpas?.some(
      (s) => Number(s.semester_gpa ?? s.gpa ?? 0) > 0,
    ),
  );
  const isFirstTermOnly =
    Boolean(summary) &&
    !hasCompletedGradedSemester &&
    Number(summary?.cumulative_gpa ?? 0) === 0 &&
    Number(summary?.failed_courses_count ?? 0) === 0;

  const cumulativeGpa = summary?.cumulative_gpa ?? 0;

  const gpaDelta = useMemo(() => {
    if (summary?.semester_gpas && summary.semester_gpas.length >= 1) {
      const completedList = summary.semester_gpas.filter(
        (s, idx, arr) =>
          !(
            idx === arr.length - 1 &&
            Number(s.semester_gpa ?? s.gpa ?? 0) === 0 &&
            Number(s.attempted_credits ?? 0) > 0
          ) && Number(s.semester_gpa ?? s.gpa ?? 0) > 0,
      );

      if (completedList.length >= 2) {
        const last = Number(
          completedList[completedList.length - 1].semester_gpa ??
            completedList[completedList.length - 1].gpa ??
            0,
        );
        const prev = Number(
          completedList[completedList.length - 2].semester_gpa ??
            completedList[completedList.length - 2].gpa ??
            0,
        );
        return Number((last - prev).toFixed(2));
      }
    }
    return 0;
  }, [summary]);

  const uncountedExemptedCredits = useMemo(() => {
    if (!enrollments) return 0;
    const courseCreditsMap = new Map<string, number>();
    if (allCourses) {
      for (const c of allCourses) {
        courseCreditsMap.set(c.course_code, Number(c.credits) || 0);
      }
    }
    if (currentCourses) {
      for (const c of currentCourses) {
        if (!courseCreditsMap.has(c.course_code)) {
          courseCreditsMap.set(c.course_code, Number(c.credits) || 0);
        }
      }
    }
    return enrollments.reduce((acc, e) => {
      if (
        e.final_score !== null &&
        e.final_score !== undefined &&
        Number(e.final_score) === 12 &&
        e.passed !== true
      ) {
        return acc + (courseCreditsMap.get(e.course_code) ?? 0);
      }
      return acc;
    }, 0);
  }, [enrollments, allCourses, currentCourses]);

  const passedCredits =
    (summary?.total_passed_credits ?? 0) + uncountedExemptedCredits;
  const creditsPercentage = Math.min(
    100,
    Math.round((passedCredits / DEGREE_TOTAL_CREDITS) * 100),
  );
  const remainingCredits = Math.max(0, DEGREE_TOTAL_CREDITS - passedCredits);

  const isGraduated = useMemo(() => {
    if (typeof summary?.is_graduated === "boolean") {
      return summary.is_graduated;
    }

    const title = user?.title?.toLowerCase();
    if (
      title === "graduated" ||
      title === "graduate" ||
      title === "alumni" ||
      title === "alumnus"
    ) {
      return true;
    }

    if (summary && passedCredits >= DEGREE_TOTAL_CREDITS) {
      return true;
    }

    return false;
  }, [user?.title, summary, passedCredits]);

  const graduateSemester = useMemo(() => {
    if (summary?.semester_gpas && summary.semester_gpas.length > 0) {
      const completed = summary.semester_gpas.filter(
        (s) =>
          Number(s.passed_credits ?? 0) > 0 ||
          Number(s.semester_gpa ?? s.gpa ?? 0) > 0,
      );
      if (completed.length > 0) {
        return completed[completed.length - 1].semester_code;
      }
      return summary.semester_gpas[summary.semester_gpas.length - 1]
        .semester_code;
    }
    return "HK172";
  }, [summary]);

  const currentTermEnrollment = useMemo(() => {
    if (currentCourses !== undefined) {
      const credits = activeCurrentCourses.reduce(
        (acc, c) => acc + (Number(c.credits) || 0),
        0,
      );
      const termCode =
        activeCurrentCourses[0]?.class_id?.split("_")[0] ||
        currentCourses[0]?.class_id?.split("_")[0] ||
        resolvedActiveSemester;
      return {
        termCode,
        credits,
        classesCount: activeCurrentCourses.length,
      };
    }

    if (summary?.semester_gpas && summary.semester_gpas.length > 0) {
      const lastTerm = summary.semester_gpas[summary.semester_gpas.length - 1];
      return {
        termCode: lastTerm.semester_code,
        credits: Number(lastTerm.attempted_credits ?? 0),
        classesCount: Number(lastTerm.courses_count ?? 0),
      };
    }

    return {
      termCode: resolvedActiveSemester,
      credits: 0,
      classesCount: 0,
    };
  }, [currentCourses, activeCurrentCourses, summary, resolvedActiveSemester]);

  const displaySemesters = useMemo(() => {
    if (summary?.semester_gpas && summary.semester_gpas.length > 0) {
      return summary.semester_gpas.map((s, idx, arr) => {
        const rawGpa = Number(s.semester_gpa ?? s.gpa ?? 0);
        const isInProgress =
          idx === arr.length - 1 &&
          rawGpa === 0 &&
          Number(s.attempted_credits ?? 0) > 0;

        return {
          code: s.semester_code,
          gpa: rawGpa,
          isInProgress,
        };
      });
    }
    return [];
  }, [summary]);

  // SVG chart coordinates (ViewBox 650x220, Y scale 1.0->170 down to 4.0->30)
  const chartPoints = useMemo(() => {
    const total = displaySemesters.length;
    const lastCompleted = [...displaySemesters]
      .reverse()
      .find((d) => !d.isInProgress);
    const baselineGpa = lastCompleted?.gpa ?? 2.0;

    return displaySemesters.map((item, index) => {
      const x = total === 1 ? 330 : 65 + (index * 530) / (total - 1);
      const effectiveGpa = item.isInProgress ? baselineGpa : item.gpa;
      const clampedGpa = Math.max(1.0, Math.min(4.0, effectiveGpa));
      const y = 170 - ((clampedGpa - 1.0) / 3.0) * 140;

      return {
        ...item,
        x,
        y,
        displayGpa: effectiveGpa,
      };
    });
  }, [displaySemesters]);

  const completedPoints = useMemo(
    () => chartPoints.filter((p) => !p.isInProgress),
    [chartPoints],
  );
  const inProgressPoint = useMemo(
    () => chartPoints.find((p) => p.isInProgress),
    [chartPoints],
  );

  const { curvePath, areaPath } = useMemo(() => {
    if (completedPoints.length === 0) return { curvePath: "", areaPath: "" };
    if (completedPoints.length === 1) {
      const p = completedPoints[0];
      return {
        curvePath: `M ${p.x - 30},${p.y} L ${p.x + 30},${p.y}`,
        areaPath: `M ${p.x - 30},${p.y} L ${p.x + 30},${p.y} L ${p.x + 30},170 L ${p.x - 30},170 Z`,
      };
    }

    let curve = `M ${completedPoints[0].x},${completedPoints[0].y}`;
    for (let i = 0; i < completedPoints.length - 1; i++) {
      const curr = completedPoints[i];
      const next = completedPoints[i + 1];
      const midX = curr.x + (next.x - curr.x) / 2;
      curve += ` C ${midX},${curr.y} ${midX},${next.y} ${next.x},${next.y}`;
    }

    const first = completedPoints[0];
    const last = completedPoints[completedPoints.length - 1];
    const area = `${curve} L ${last.x},170 L ${first.x},170 Z`;

    return { curvePath: curve, areaPath: area };
  }, [completedPoints]);

  const latestCompletedPoint = completedPoints[completedPoints.length - 1];

  // Pillar computations extracted from JSX
  const academicMet =
    passedCredits >= DEGREE_TOTAL_CREDITS && cumulativeGpa >= 2.0;
  const gpaOk = isFirstTermOnly || cumulativeGpa >= 2.0;

  const englishPassed = studentDetail?.english_pass === true;
  const englishUnknown =
    studentDetail?.english_pass === null ||
    studentDetail?.english_pass === undefined;

  const ctxhDays = Number(studentDetail?.ctxh_days ?? 0);
  const ctxhPercent = Math.min(
    100,
    Math.round((ctxhDays / CTXH_TARGET_DAYS) * 100),
  );
  const isKltnReady = ctxhDays >= CTXH_KLTN_MILESTONE;
  const isGradReadyCtxh = ctxhDays >= CTXH_TARGET_DAYS;

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Xin chào, {greetingName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Tổng quan kết quả học tập và điều kiện tốt nghiệp ·{" "}
            <span className="font-medium text-slate-800">
              {activeSemesterLabel}
            </span>
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/student/advising")}
          className="h-9 w-fit cursor-pointer gap-2 border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-700"
        >
          <UserCheck className="h-4 w-4 text-blue-600" />
          <span>Cố vấn Học vụ</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
        </Button>
      </header>

      {/* Error Recovery Banner */}
      {hasDataError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>
              Không thể tải đầy đủ dữ liệu học vụ từ máy chủ. Vui lòng thử tải
              lại.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isSummaryError) void refetchSummary();
              if (isCoursesError) void refetchCourses();
            }}
            className="h-8 w-fit cursor-pointer gap-1.5 border-rose-200 bg-white text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      {/* 2. Quick Stats (Top Row - 3 Authoritative Dark KPI Cards) */}
      <section
        aria-label="Chỉ số học tập tổng quan"
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        {/* KPI 1: Cumulative GPA */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              GPA tích lũy
            </span>
            <Award className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          </div>

          <div className="mt-2.5 flex items-baseline gap-1.5 tabular-nums">
            {isLoadingSummary ? (
              <Skeleton className="h-9 w-28 bg-slate-800" />
            ) : isFirstTermOnly ? (
              <span className="text-2xl font-bold tracking-tight text-white">
                Đang xét kỳ 1
              </span>
            ) : (
              <>
                <span className="text-3xl font-extrabold tracking-tight text-white">
                  {cumulativeGpa.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-slate-300">
                  / 4.00
                </span>
              </>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium tabular-nums">
            {isLoadingSummary ? (
              <Skeleton className="h-4 w-44 bg-slate-800" />
            ) : isFirstTermOnly ? (
              <span className="text-sky-300">
                Chưa có điểm học kỳ hoàn tất
              </span>
            ) : gpaDelta > 0 ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                +{gpaDelta.toFixed(2)} so với kỳ trước
              </span>
            ) : gpaDelta < 0 ? (
              <span className="flex items-center gap-1 text-rose-400">
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                {gpaDelta.toFixed(2)} so với kỳ trước
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-300">
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                Giữ nguyên so với kỳ trước
              </span>
            )}
          </div>
        </div>

        {/* KPI 2: Credits Completed */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Tín chỉ tích lũy
            </span>
            <BookOpen className="h-4 w-4 text-sky-400" aria-hidden="true" />
          </div>

          <div className="mt-2.5 flex items-baseline gap-1.5 tabular-nums">
            {isLoadingSummary ? (
              <Skeleton className="h-9 w-28 bg-slate-800" />
            ) : (
              <>
                <span className="text-3xl font-extrabold tracking-tight text-white">
                  {passedCredits}
                </span>
                <span className="text-sm font-medium text-slate-300">
                  / {DEGREE_TOTAL_CREDITS} TC
                </span>
              </>
            )}
          </div>

          <div className="mt-3 space-y-1.5">
            <Progress
              value={isLoadingSummary ? 0 : creditsPercentage}
              className="h-1.5 w-full **:data-[slot=progress-track]:bg-slate-800 **:data-[slot=progress-indicator]:bg-sky-400"
            />
            <p className="text-xs font-medium text-slate-300 tabular-nums">
              {isLoadingSummary ? (
                <Skeleton className="h-3.5 w-36 bg-slate-800" />
              ) : (
                `${creditsPercentage}% hoàn thành · Còn ${remainingCredits} TC`
              )}
            </p>
          </div>
        </div>

        {/* KPI 3: Current Term / Academic Standing */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              {isGraduated ? "Tình trạng tốt nghiệp" : "Đăng ký kỳ hiện tại"}
            </span>
            <GraduationCap
              className={cn(
                "h-4 w-4",
                isGraduated ? "text-emerald-400" : "text-sky-400",
              )}
              aria-hidden="true"
            />
          </div>

          <div className="mt-2.5 tabular-nums">
            {isLoadingCourses && isLoadingSummary ? (
              <Skeleton className="h-9 w-36 bg-slate-800" />
            ) : isGraduated ? (
              <span className="text-2xl font-extrabold tracking-tight text-emerald-400 sm:text-3xl">
                Đã tốt nghiệp
              </span>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-3xl font-extrabold tracking-tight text-white">
                  {currentTermEnrollment.credits}
                </span>
                <span className="text-sm font-medium text-slate-300">TC</span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-2xl font-bold tracking-tight text-sky-400">
                  {currentTermEnrollment.classesCount}
                </span>
                <span className="text-sm font-medium text-slate-300">
                  môn học
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-300">
            {isGraduated ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Hoàn thành chương trình tại {graduateSemester}
              </span>
            ) : (
              <>
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-xs font-semibold text-sky-300">
                  {currentTermEnrollment.termCode}
                </span>
                <span>Đang theo học</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 3. Graduation Readiness — Flattened 3-Pillar Overview */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <GraduationCap
                  className="h-4.5 w-4.5 text-blue-600"
                  aria-hidden="true"
                />
                Điều kiện xét tốt nghiệp
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs text-slate-500">
                Tổng hợp 3 tiêu chuẩn bắt buộc: Học vụ, Chuẩn ngoại ngữ và Ngày
                công tác xã hội.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/student/record?tab=curriculum")}
              className="h-8 w-fit cursor-pointer gap-1.5 text-xs font-medium"
            >
              <span>Xem khung CTĐT</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-1 divide-y divide-slate-100 p-0 md:grid-cols-3 md:divide-x md:divide-y-0">
          {/* Pillar 1: Academic */}
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <BookOpen className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span>Học vụ</span>
              </div>
              {!isLoadingSummary && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    academicMet
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-blue-200 bg-blue-50 text-blue-700",
                  )}
                >
                  {academicMet ? "Đạt chuẩn" : `${creditsPercentage}%`}
                </Badge>
              )}
            </div>

            {isLoadingSummary ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full bg-slate-100" />
                <Skeleton className="h-2 w-full bg-slate-100" />
                <Skeleton className="h-3.5 w-3/4 bg-slate-100" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-600">Tín chỉ tích lũy</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {passedCredits} / {DEGREE_TOTAL_CREDITS} TC
                  </span>
                </div>
                <Progress
                  value={creditsPercentage}
                  className="h-2 bg-slate-100 **:data-[slot=progress-indicator]:bg-blue-600"
                />
                <p className="text-xs text-slate-500">
                  GPA:{" "}
                  <strong
                    className={cn(
                      "tabular-nums",
                      gpaOk ? "text-emerald-700" : "text-rose-600",
                    )}
                  >
                    {isFirstTermOnly
                      ? "Đang xét kỳ 1"
                      : `${cumulativeGpa.toFixed(2)}/4.00`}
                  </strong>{" "}
                  (yêu cầu ≥ 2.00)
                </p>
              </div>
            )}
          </div>

          {/* Pillar 2: English Proficiency */}
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Globe
                  className={cn(
                    "h-4 w-4",
                    englishPassed ? "text-emerald-600" : "text-amber-600",
                  )}
                  aria-hidden="true"
                />
                <span>Chuẩn Ngoại ngữ</span>
              </div>
              {!isLoadingDetail && (
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 text-xs font-semibold",
                    englishPassed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                >
                  {englishPassed ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Clock className="h-3 w-3" aria-hidden="true" />
                  )}
                  {englishPassed
                    ? "Đạt chuẩn"
                    : englishUnknown
                      ? "Chưa cập nhật"
                      : "Chưa đạt"}
                </Badge>
              )}
            </div>

            {isLoadingDetail ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full bg-slate-100" />
                <Skeleton className="h-4 w-5/6 bg-slate-100" />
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-slate-600">
                {englishPassed
                  ? "Đã hoàn thành chuẩn Tiếng Anh đầu ra theo quy định đào tạo."
                  : "Cần nộp chứng chỉ Tiếng Anh đầu ra hoặc hoàn thành học phần Anh văn chuẩn."}
              </p>
            )}
          </div>

          {/* Pillar 3: Social Work Days (CTXH) */}
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <HeartHandshake
                  className={cn(
                    "h-4 w-4",
                    isGradReadyCtxh ? "text-emerald-600" : "text-indigo-600",
                  )}
                  aria-hidden="true"
                />
                <span>Công tác xã hội (CTXH)</span>
              </div>
              {!isLoadingDetail && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    isGradReadyCtxh
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : isKltnReady
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                >
                  {isGradReadyCtxh
                    ? "Đủ tốt nghiệp"
                    : isKltnReady
                      ? "Đủ ĐK KLTN"
                      : `Thiếu ${CTXH_KLTN_MILESTONE - ctxhDays} ngày KLTN`}
                </Badge>
              )}
            </div>

            {isLoadingDetail ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full bg-slate-100" />
                <Skeleton className="h-2 w-full bg-slate-100" />
                <Skeleton className="h-3.5 w-3/4 bg-slate-100" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-600">Ngày CTXH tích lũy</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {ctxhDays} / {CTXH_TARGET_DAYS} ngày
                  </span>
                </div>
                <div className="relative">
                  <Progress
                    value={ctxhPercent}
                    className="h-2 bg-slate-100 **:data-[slot=progress-indicator]:bg-indigo-600"
                  />
                  <div
                    title="Mốc 12 ngày: đủ điều kiện làm KLTN"
                    className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-amber-500"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Mốc <strong>12 ngày</strong>: làm KLTN ·{" "}
                  <strong>15 ngày</strong>: tốt nghiệp
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. Academic Insights (2 Columns: GPA Trend + Current Courses) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (col-span-2): GPA Trend Line Chart */}
        <Card className="border-slate-200 bg-white shadow-xs lg:col-span-2">
          <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Xu hướng GPA qua các học kỳ
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Điểm trung bình học kỳ tích lũy theo tiến trình đào tạo
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                <span>GPA học kỳ</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <span className="h-0.5 w-3 border-t border-dashed border-slate-400" />
                <span>Mức khá (2.50)</span>
              </div>
              {inProgressPoint && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
                  <span className="h-2 w-2 rounded-full border-2 border-blue-600 bg-white" />
                  <span>Đang học</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {isLoadingSummary ? (
              <Skeleton className="h-56 w-full rounded-lg bg-slate-100" />
            ) : chartPoints.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center">
                <BookOpen
                  className="mb-2 h-7 w-7 text-slate-300"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-slate-700">
                  Chưa có lịch sử điểm học kỳ
                </p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  Biểu đồ xu hướng GPA sẽ hiển thị tự động khi các học kỳ được
                  cập nhật điểm chính thức.
                </p>
              </div>
            ) : (
              <div className="relative w-full">
                <svg
                  viewBox="0 0 650 220"
                  className="w-full"
                  preserveAspectRatio="xMidYMid meet"
                  role="img"
                  aria-label="Biểu đồ đường thể hiện xu hướng GPA các học kỳ"
                >
                  <defs>
                    <linearGradient
                      id="gpaAreaGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#1488DB"
                        stopOpacity="0.22"
                      />
                      <stop
                        offset="85%"
                        stopColor="#1488DB"
                        stopOpacity="0.02"
                      />
                      <stop
                        offset="100%"
                        stopColor="#1488DB"
                        stopOpacity="0.0"
                      />
                    </linearGradient>

                    <linearGradient
                      id="gpaLineGradient"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop offset="0%" stopColor="#2563EB" />
                      <stop offset="50%" stopColor="#1488DB" />
                      <stop offset="100%" stopColor="#0284C7" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guide Lines (Scale 1.0 to 4.0) */}
                  <g className="stroke-slate-100" strokeWidth="1">
                    <line
                      x1="52"
                      y1="30"
                      x2="615"
                      y2="30"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1="52"
                      y1="76.7"
                      x2="615"
                      y2="76.7"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1="52"
                      y1="123.3"
                      x2="615"
                      y2="123.3"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1="52"
                      y1="170"
                      x2="615"
                      y2="170"
                      stroke="#e2e8f0"
                      strokeWidth="1.2"
                    />
                  </g>

                  {/* Y-Axis Labels */}
                  <g
                    className="fill-slate-400 text-xs font-medium tabular-nums"
                    textAnchor="end"
                  >
                    <text x="44" y="34">
                      4.0
                    </text>
                    <text x="44" y="80">
                      3.0
                    </text>
                    <text x="44" y="104">
                      2.5
                    </text>
                    <text x="44" y="127">
                      2.0
                    </text>
                    <text x="44" y="174">
                      1.0
                    </text>
                  </g>

                  {/* Benchmark Line (2.50 -> y = 100) */}
                  <line
                    x1="52"
                    y1="100"
                    x2="615"
                    y2="100"
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />

                  {areaPath && <path d={areaPath} fill="url(#gpaAreaGradient)" />}

                  {curvePath && (
                    <path
                      d={curvePath}
                      fill="none"
                      stroke="url(#gpaLineGradient)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  )}

                  {inProgressPoint && latestCompletedPoint && (
                    <line
                      x1={latestCompletedPoint.x}
                      y1={latestCompletedPoint.y}
                      x2={inProgressPoint.x}
                      y2={inProgressPoint.y}
                      stroke="#1488DB"
                      strokeWidth="2.5"
                      strokeDasharray="5 5"
                    />
                  )}

                  {chartPoints.map((pt) => {
                    if (pt.isInProgress) {
                      const pillX = Math.max(46, Math.min(604, pt.x));
                      return (
                        <g key={pt.code}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={5.5}
                            fill="#FFFFFF"
                            stroke="#1488DB"
                            strokeWidth="2.5"
                          />
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={10}
                            fill="none"
                            stroke="#1488DB"
                            strokeWidth="1.5"
                            opacity="0.35"
                          />
                          <g
                            transform={`translate(${pillX}, ${Math.max(22, pt.y - 22)})`}
                            textAnchor="middle"
                          >
                            <rect
                              x="-34"
                              y="-15"
                              width="68"
                              height="19"
                              rx="9.5"
                              fill="#1488DB"
                            />
                            <text
                              x="0"
                              y="-2"
                              fill="#ffffff"
                              fontSize="10"
                              fontWeight="600"
                            >
                              Đang học
                            </text>
                          </g>

                          <text
                            x={pt.x}
                            y={196}
                            textAnchor="middle"
                            className="fill-blue-700 text-xs font-bold"
                          >
                            {pt.code}
                          </text>
                        </g>
                      );
                    }

                    const isLatestCompleted =
                      latestCompletedPoint &&
                      pt.code === latestCompletedPoint.code;

                    return (
                      <g key={pt.code}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isLatestCompleted && !inProgressPoint ? 5.5 : 4.5}
                          fill={
                            isLatestCompleted && !inProgressPoint
                              ? "#1488DB"
                              : "#FFFFFF"
                          }
                          stroke={
                            isLatestCompleted && !inProgressPoint
                              ? "#FFFFFF"
                              : "#2563EB"
                          }
                          strokeWidth={
                            isLatestCompleted && !inProgressPoint ? 2 : 2.5
                          }
                        />

                        {isLatestCompleted && !inProgressPoint && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={9.5}
                            fill="none"
                            stroke="#1488DB"
                            strokeWidth="1.5"
                            opacity="0.35"
                          />
                        )}

                        <text
                          x={pt.x}
                          y={pt.y - 11}
                          className="fill-slate-700 text-xs font-semibold tabular-nums"
                          textAnchor="middle"
                        >
                          {pt.gpa.toFixed(2)}
                        </text>

                        <text
                          x={pt.x}
                          y={196}
                          textAnchor="middle"
                          className="fill-slate-600 text-xs font-medium"
                        >
                          {pt.code}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column (col-span-1): Registered Courses */}
        <Card className="flex flex-col border-slate-200 bg-white shadow-xs">
          <CardHeader className="border-b border-slate-100 pb-3.5">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base font-bold text-slate-900">
                Học phần đang học
              </CardTitle>
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 tabular-nums"
              >
                {isLoadingCourses
                  ? "Đang tải..."
                  : isGraduated
                    ? "Hoàn thành"
                    : `${activeCurrentCourses.length} môn`}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              {activeSemesterLabel}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 p-0">
            {isLoadingCourses ? (
              <div className="divide-y divide-slate-100">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2 px-5 py-3.5">
                    <Skeleton className="h-4 w-28 bg-slate-100" />
                    <Skeleton className="h-3.5 w-48 bg-slate-100" />
                    <Skeleton className="h-3 w-36 bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : isGraduated ? (
              <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
                <GraduationCap
                  className="mb-2.5 h-8 w-8 text-emerald-600"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-slate-800">
                  Đã hoàn thành chương trình
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Sinh viên đã tốt nghiệp ({graduateSemester}) nên không có môn
                  đăng ký trong học kỳ hiện tại.
                </p>
              </div>
            ) : activeCurrentCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
                <BookOpen
                  className="mb-2.5 h-8 w-8 text-slate-300"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-slate-800">
                  Chưa có học phần đăng ký
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Chưa ghi nhận môn học nào trong học kỳ hiện tại.
                </p>
              </div>
            ) : (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {activeCurrentCourses.map((course) => {
                  const metadataParts = [`${course.credits} TC`];
                  if (course.class_group) {
                    metadataParts.push(`Nhóm ${course.class_group}`);
                  }
                  if (course.lecturer_name) {
                    metadataParts.push(course.lecturer_name);
                  }

                  return (
                    <li
                      key={course.class_id || course.course_code}
                      className="flex items-start justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {course.course_code}
                          </span>
                          {course.retaken && (
                            <Badge
                              variant="outline"
                              className="h-5 border-amber-200 bg-amber-50 px-2 text-xs font-semibold text-amber-800"
                            >
                              Học lại
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs font-medium text-slate-800">
                          {course.course_name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {metadataParts.join(" · ")}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 cursor-pointer gap-1 px-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        onClick={() =>
                          navigate(
                            `/student/simulation?course=${course.course_code}`,
                          )
                        }
                      >
                        <span>Dự báo</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. Primary Action Callout (XAI Simulation) */}
      <section className="flex flex-col gap-4 rounded-xl border border-blue-200/80 bg-blue-50/60 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 sm:text-base">
            <Sparkles className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span>Mô phỏng kết quả học tập với XAI</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
            Thử nghiệm kịch bản điểm số cho các môn đang học để xem tác động lên
            GPA tích lũy và nhận giải thích minh bạch từ hệ thống.
          </p>
        </div>

        <Button
          onClick={() => navigate("/student/simulation")}
          className="h-10 w-fit shrink-0 cursor-pointer gap-2 bg-blue-600 px-5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700"
        >
          <span>Mở Trình Dự báo</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </section>
    </div>
  );
};
