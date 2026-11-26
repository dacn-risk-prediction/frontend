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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/features/auth";
import { useActiveSemester } from "@/hooks/use-active-semester";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  GraduationCap,
  Info,
  Layers,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useAllCourses,
  useStudentCurrentCourses,
  useStudentDetail,
  useStudentEnrollments,
  useStudentSummary,
} from "../api/student-api";
import { CurriculumProgressTab } from "./CurriculumProgressTab";

const DEGREE_TOTAL_CREDITS = 128;

const parseSemesterRank = (code: string): number => {
  const match = code.match(/HK(\d{2})(\d)/i);
  if (match) {
    const year = parseInt(match[1], 10);
    const term = parseInt(match[2], 10);
    return year * 10 + term;
  }
  const numMatch = code.match(/\d+/);
  return numMatch ? parseInt(numMatch[0], 10) : 0;
};

const formatSemesterName = (code: string): string => {
  const match = code.match(/HK(\d{2})(\d)/i);
  if (match) {
    const yearPrefix = parseInt(match[1], 10);
    const termNum = match[2];
    const fullYearStart =
      yearPrefix >= 50 ? 1900 + yearPrefix : 2000 + yearPrefix;
    const fullYearEnd = fullYearStart + 1;
    const termLabel =
      termNum === "1"
        ? "Học kỳ 1"
        : termNum === "2"
          ? "Học kỳ 2"
          : "Học kỳ hè";
    return `${termLabel} (${fullYearStart}–${fullYearEnd})`;
  }
  return `Học kỳ ${code}`;
};

interface SemesterCourseItem {
  id: string;
  courseCode: string;
  courseName: string;
  credits: number;
  classId?: string | null;
  classGroup?: string | null;
  lecturerName?: string | null;
  semesterCode: string;
  letterGrade: string | null;
  gpa4: number | null;
  finalScore: number | null;
  quiz: number | null;
  giuaKy: number | null;
  cuoiKy: number | null;
  passed: boolean | null;
  retaken: boolean;
  status: "completed" | "enrolled" | "failed";
}

interface SemesterGroup {
  semesterCode: string;
  semesterName: string;
  semesterGpa: number | null;
  cumulativeGpa: number | null;
  passedCredits: number;
  attemptedCredits: number;
  coursesCount: number;
  isInProgress: boolean;
  courses: SemesterCourseItem[];
}

export const StudentAcademicRecordPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeViewTab: "transcript" | "curriculum" =
    searchParams.get("tab") === "curriculum" ? "curriculum" : "transcript";

  const handleViewTabChange = (tab: "transcript" | "curriculum") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "curriculum") next.set("tab", "curriculum");
      else next.delete("tab");
      return next;
    });
  };

  const { data: user } = useAuthUser();
  const studentId = user?.user_code || user?.id;
  const { data: activeSemester } = useActiveSemester();
  const resolvedActiveSemester = activeSemester?.semester_code || "HK261";

  const {
    data: summary,
    isLoading: isLoadingSummary,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useStudentSummary(studentId);
  const { data: studentDetail, isLoading: isLoadingDetail } =
    useStudentDetail(studentId);
  const {
    data: enrollments,
    isLoading: isLoadingEnrollments,
    isError: isEnrollmentsError,
    refetch: refetchEnrollments,
  } = useStudentEnrollments(studentId);
  const {
    data: currentCourses,
    isLoading: isLoadingCurrentCourses,
    isError: isCurrentError,
    refetch: refetchCurrent,
  } = useStudentCurrentCourses(studentId);
  const { data: allCourses } = useAllCourses();

  const isLoadingTranscript =
    isLoadingSummary || isLoadingEnrollments || isLoadingCurrentCourses;
  const hasDataError = isSummaryError || isEnrollmentsError || isCurrentError;

  const [selectedSemester, setSelectedSemester] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PASSED" | "ENROLLED" | "FAILED"
  >("ALL");

  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const toggleSemester = (code: string) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

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

    if (summary && summary.total_passed_credits >= DEGREE_TOTAL_CREDITS) {
      return true;
    }

    return false;
  }, [user?.title, summary]);

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

  const uncountedExemptedCredits = useMemo(() => {
    if (!enrollments) return 0;
    const courseMap = new Map(
      (allCourses ?? []).map((c) => [c.course_code, c]),
    );
    return enrollments.reduce((acc, e) => {
      if (
        e.final_score !== null &&
        e.final_score !== undefined &&
        Number(e.final_score) === 12 &&
        e.passed !== true
      ) {
        const creds = courseMap.get(e.course_code)?.credits ?? 0;
        return acc + creds;
      }
      return acc;
    }, 0);
  }, [enrollments, allCourses]);

  const passedCredits =
    (summary?.total_passed_credits ?? 0) + uncountedExemptedCredits;
  const cumulativeGpa = summary?.cumulative_gpa ?? 0.0;
  const creditsPercentage = Math.min(
    100,
    Math.round((passedCredits / DEGREE_TOTAL_CREDITS) * 100),
  );
  const remainingCredits = Math.max(0, DEGREE_TOTAL_CREDITS - passedCredits);

  const academicStanding = useMemo(() => {
    if (isGraduated) return "Đã tốt nghiệp";
    if (passedCredits >= 105) return "Sinh viên năm 4";
    if (passedCredits >= 70) return "Sinh viên năm 3";
    if (passedCredits >= 35) return "Sinh viên năm 2";
    return "Sinh viên năm 1";
  }, [isGraduated, passedCredits]);

  const majorName = useMemo(() => {
    if (studentDetail?.major) {
      return studentDetail.major
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
    return "Khoa học Máy tính";
  }, [studentDetail]);

  const cohortLabel = studentDetail?.cohort ?? "K26";

  const groupedSemesters = useMemo<SemesterGroup[]>(() => {
    const courseMap = new Map(
      (allCourses ?? []).map((c) => [c.course_code, c]),
    );

    const exemptedCourseSet = new Set<string>();
    const exemptedClassIds = new Set<string>();
    const semestersWithRawEnrollments = new Set<string>();

    if (enrollments && enrollments.length > 0) {
      for (const e of enrollments) {
        semestersWithRawEnrollments.add(e.semester_code);
        if (
          e.final_score !== null &&
          e.final_score !== undefined &&
          Number(e.final_score) === 12
        ) {
          exemptedCourseSet.add(`${e.semester_code}_${e.course_code}`);
          exemptedCourseSet.add(e.course_code);
          if (e.class_id) {
            exemptedClassIds.add(e.class_id);
          }
        }
      }
    }

    const summaryMap = new Map<
      string,
      {
        semesterGpa: number | null;
        cumulativeGpa: number | null;
        passedCredits: number;
        attemptedCredits: number;
        coursesCount: number;
        isInProgress: boolean;
      }
    >();

    if (summary?.semester_gpas && summary.semester_gpas.length > 0) {
      summary.semester_gpas.forEach((s, idx, arr) => {
        const rawGpa = Number(s.semester_gpa ?? s.gpa ?? 0);
        const isInProgress =
          idx === arr.length - 1 &&
          rawGpa === 0 &&
          Number(s.attempted_credits ?? 0) > 0;

        summaryMap.set(s.semester_code, {
          semesterGpa: isInProgress ? null : rawGpa,
          cumulativeGpa: null,
          passedCredits: Number(s.passed_credits ?? 0),
          attemptedCredits: Number(s.attempted_credits ?? 0),
          coursesCount: Number(s.courses_count ?? 0),
          isInProgress,
        });
      });
    }

    const semesterSet = new Set<string>();
    summaryMap.forEach((_, code) => semesterSet.add(code));

    const coursesBySemester = new Map<string, SemesterCourseItem[]>();
    const recordedCumGpaBySemester = new Map<string, number>();

    if (enrollments && enrollments.length > 0) {
      for (const e of enrollments) {
        if (
          e.final_gpa_4 !== null &&
          e.final_gpa_4 !== undefined &&
          !recordedCumGpaBySemester.has(e.semester_code)
        ) {
          recordedCumGpaBySemester.set(e.semester_code, Number(e.final_gpa_4));
        }
        if (
          e.final_score !== null &&
          e.final_score !== undefined &&
          Number(e.final_score) === 12
        ) {
          continue;
        }
        semesterSet.add(e.semester_code);
        const catalogCourse = courseMap.get(e.course_code);
        const isPass =
          e.passed === true ||
          (e.passed !== false && e.gpa_4 !== null && e.gpa_4 >= 1.0);
        const isFailed =
          e.passed === false ||
          (!isPass && e.gpa_4 !== null && e.gpa_4 < 1.0);

        const list = coursesBySemester.get(e.semester_code) || [];
        list.push({
          id: e.id,
          courseCode: e.course_code,
          courseName: catalogCourse?.course_name ?? e.course_code,
          credits: catalogCourse?.credits ?? 3,
          classId: e.class_id,
          semesterCode: e.semester_code,
          letterGrade: e.letter_grade,
          gpa4: e.gpa_4,
          finalScore: e.final_score,
          quiz: e.quiz,
          giuaKy: e.giua_ky,
          cuoiKy: e.cuoi_ky,
          passed: e.passed,
          retaken: Boolean(e.retaken),
          status: isPass ? "completed" : isFailed ? "failed" : "enrolled",
        });
        coursesBySemester.set(e.semester_code, list);
      }
    }

    if (currentCourses && currentCourses.length > 0) {
      const currentTermCode =
        currentCourses[0]?.class_id?.split("_")[0] || resolvedActiveSemester;
      const activeItems = currentCourses.filter(
        (item) =>
          !(item.class_id && exemptedClassIds.has(item.class_id)) &&
          !exemptedCourseSet.has(`${currentTermCode}_${item.course_code}`) &&
          !exemptedCourseSet.has(item.course_code),
      );
      if (activeItems.length > 0) {
        semesterSet.add(currentTermCode);
        const list = coursesBySemester.get(currentTermCode) || [];
        for (const item of activeItems) {
          const alreadyExists = list.some(
            (c) => c.courseCode === item.course_code,
          );
          if (!alreadyExists) {
            list.push({
              id:
                item.class_id ||
                `${currentTermCode.toLowerCase()}_${item.course_code}`,
              courseCode: item.course_code,
              courseName: item.course_name,
              credits: item.credits,
              classId: item.class_id,
              classGroup: item.class_group,
              lecturerName: item.lecturer_name,
              semesterCode: currentTermCode,
              letterGrade: null,
              gpa4: null,
              finalScore: null,
              quiz: null,
              giuaKy: null,
              cuoiKy: null,
              passed: null,
              retaken: Boolean(item.retaken),
              status: "enrolled",
            });
          }
        }
        coursesBySemester.set(currentTermCode, list);
      }
    }

    const sortedCodes = Array.from(semesterSet)
      .filter((code) => {
        if (
          semestersWithRawEnrollments.has(code) &&
          (coursesBySemester.get(code)?.length ?? 0) === 0
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => parseSemesterRank(b) - parseSemesterRank(a));

    const activeTermCode =
      currentCourses?.[0]?.class_id?.split("_")[0] || resolvedActiveSemester;

    const runningCumGpaBySemester = new Map<string, number>();
    const passedCourseBest = new Map<
      string,
      { gpa4: number; credits: number }
    >();
    const sortedAsc = [...sortedCodes].reverse();
    for (const code of sortedAsc) {
      const termCourses = coursesBySemester.get(code) || [];
      let hasGradedInTerm = false;
      for (const c of termCourses) {
        if (c.status === "completed" && c.gpa4 !== null && c.credits > 0) {
          hasGradedInTerm = true;
          const prev = passedCourseBest.get(c.courseCode);
          if (!prev || c.gpa4 > prev.gpa4) {
            passedCourseBest.set(c.courseCode, {
              gpa4: c.gpa4,
              credits: c.credits,
            });
          }
        }
      }
      const recordedCum = recordedCumGpaBySemester.get(code);
      if (recordedCum !== undefined) {
        runningCumGpaBySemester.set(code, recordedCum);
      } else if (hasGradedInTerm && passedCourseBest.size > 0) {
        let totalPts = 0;
        let totalCreds = 0;
        passedCourseBest.forEach(({ gpa4, credits }) => {
          totalPts += gpa4 * credits;
          totalCreds += credits;
        });
        if (totalCreds > 0) {
          runningCumGpaBySemester.set(
            code,
            Number((totalPts / totalCreds).toFixed(2)),
          );
        }
      }
    }

    return sortedCodes.map((code) => {
      const summaryInfo = summaryMap.get(code);
      const courses = coursesBySemester.get(code) || [];

      const coursePassedCredits = courses
        .filter((c) => c.status === "completed")
        .reduce((sum, c) => sum + (c.credits || 0), 0);
      const courseAttemptedCredits = courses.reduce(
        (sum, c) => sum + (c.credits || 0),
        0,
      );

      const passed = summaryInfo?.passedCredits ?? coursePassedCredits;
      const attempted = summaryInfo?.attemptedCredits ?? courseAttemptedCredits;
      const count = summaryInfo?.coursesCount ?? courses.length;
      const isInProgress =
        summaryInfo?.isInProgress ??
        (code === activeTermCode ||
          courses.some((c) => c.status === "enrolled"));

      const computedCumGpa = isInProgress
        ? null
        : (runningCumGpaBySemester.get(code) ??
          summaryInfo?.cumulativeGpa ??
          null);

      return {
        semesterCode: code,
        semesterName: formatSemesterName(code),
        semesterGpa: summaryInfo?.semesterGpa ?? null,
        cumulativeGpa: computedCumGpa,
        passedCredits: passed,
        attemptedCredits: attempted,
        coursesCount: count,
        isInProgress,
        courses,
      };
    });
  }, [summary, enrollments, currentCourses, allCourses, resolvedActiveSemester]);

  const availableSemesters = useMemo(
    () => groupedSemesters.map((g) => g.semesterCode),
    [groupedSemesters],
  );

  const filteredSemesterGroups = useMemo(() => {
    return groupedSemesters
      .map((group) => {
        if (
          selectedSemester !== "ALL" &&
          group.semesterCode !== selectedSemester
        ) {
          return null;
        }

        const matchingCourses = group.courses.filter((course) => {
          if (statusFilter === "PASSED" && course.status !== "completed") {
            return false;
          }
          if (statusFilter === "ENROLLED" && course.status !== "enrolled") {
            return false;
          }
          if (statusFilter === "FAILED" && course.status !== "failed") {
            return false;
          }

          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchCode = course.courseCode.toLowerCase().includes(q);
            const matchName = course.courseName.toLowerCase().includes(q);
            if (!matchCode && !matchName) return false;
          }
          return true;
        });

        if (searchQuery.trim() && matchingCourses.length === 0) {
          return null;
        }

        if (
          statusFilter !== "ALL" &&
          matchingCourses.length === 0 &&
          group.courses.length > 0
        ) {
          return null;
        }

        return {
          ...group,
          courses: matchingCourses,
        };
      })
      .filter((g): g is SemesterGroup => g !== null);
  }, [groupedSemesters, selectedSemester, statusFilter, searchQuery]);

  const hasActiveFilters =
    selectedSemester !== "ALL" ||
    statusFilter !== "ALL" ||
    searchQuery.trim().length > 0;

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Page Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Hồ sơ học tập
            </h1>
            {studentId && (
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs font-medium text-slate-600 tabular-nums">
                MSSV: {studentId}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Theo dõi bảng điểm chi tiết theo học kỳ và khung chương trình đào
            tạo.
          </p>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "w-fit gap-1.5 px-3 py-1 text-xs font-semibold",
            isGraduated
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-blue-200 bg-blue-50 text-blue-700",
          )}
        >
          {isGraduated ? (
            <>
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Đã hoàn thành tốt nghiệp</span>
            </>
          ) : (
            <>
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Đang theo học</span>
            </>
          )}
        </Badge>
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
              Không thể tải đầy đủ dữ liệu bảng điểm. Vui lòng thử tải lại.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isSummaryError) void refetchSummary();
              if (isEnrollmentsError) void refetchEnrollments();
              if (isCurrentError) void refetchCurrent();
            }}
            className="h-8 w-fit cursor-pointer gap-1.5 border-rose-200 bg-white text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      {/* 2. Top Academic Summary Strip (Obsidian KPI + Hairline-First) */}
      <section
        aria-label="Thông tin học vụ tổng quan"
        className="grid grid-cols-1 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900 text-white shadow-sm md:grid-cols-3 md:divide-x md:divide-y-0"
      >
        {/* Block 1: Major & Cohort */}
        <div className="space-y-2 p-5">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Ngành &amp; Khóa đào tạo
            </span>
            <BookOpen className="h-4 w-4 text-sky-400" aria-hidden="true" />
          </div>
          {isLoadingDetail ? (
            <div className="space-y-2 pt-1">
              <Skeleton className="h-6 w-48 bg-slate-800" />
              <Skeleton className="h-4 w-32 bg-slate-800" />
            </div>
          ) : (
            <>
              <p className="truncate text-lg font-bold tracking-tight text-white">
                {majorName}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-xs font-semibold text-sky-300">
                  Khóa {cohortLabel}
                </span>
                <span>Hệ đại học chính quy</span>
              </div>
            </>
          )}
        </div>

        {/* Block 2: Academic Standing & GPA */}
        <div className="space-y-2 p-5">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Xếp loại học vụ
            </span>
            <Award className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          </div>
          {isLoadingSummary ? (
            <div className="space-y-2 pt-1">
              <Skeleton className="h-6 w-40 bg-slate-800" />
              <Skeleton className="h-4 w-36 bg-slate-800" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">
                  {academicStanding}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-semibold",
                    isGraduated || cumulativeGpa >= 3.0
                      ? "bg-emerald-500/20 text-emerald-300"
                      : cumulativeGpa > 0 && cumulativeGpa < 2.0
                        ? "bg-rose-500/20 text-rose-300"
                        : "bg-sky-500/20 text-sky-300",
                  )}
                >
                  {isGraduated
                    ? "Hoàn thành"
                    : cumulativeGpa > 0 && cumulativeGpa < 2.0
                      ? "Cảnh báo học vụ"
                      : "Bình thường"}
                </span>
              </div>
              <p className="text-xs text-slate-300 tabular-nums">
                GPA:{" "}
                <strong className="font-bold text-white">
                  {cumulativeGpa.toFixed(2)}
                </strong>{" "}
                / 4.00 · {summary?.passed_courses_count ?? 0} môn đã đạt
              </p>
            </>
          )}
        </div>

        {/* Block 3: Degree Credits Progress */}
        <div className="space-y-2 p-5">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Tiến độ tín chỉ
            </span>
            {isGraduated ? (
              <GraduationCap
                className="h-4 w-4 text-emerald-400"
                aria-hidden="true"
              />
            ) : (
              <Clock className="h-4 w-4 text-amber-400" aria-hidden="true" />
            )}
          </div>
          {isLoadingSummary ? (
            <div className="space-y-2 pt-1">
              <Skeleton className="h-6 w-32 bg-slate-800" />
              <Skeleton className="h-2 w-full bg-slate-800" />
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5 tabular-nums">
                <span className="text-lg font-bold tracking-tight text-white">
                  {passedCredits}
                </span>
                <span className="text-xs font-medium text-slate-300">
                  / {DEGREE_TOTAL_CREDITS} TC
                </span>
              </div>
              <Progress
                value={creditsPercentage}
                className="h-1.5 w-full **:data-[slot=progress-track]:bg-slate-800 **:data-[slot=progress-indicator]:bg-sky-400"
              />
              <p className="text-xs text-slate-300 tabular-nums">
                {isGraduated
                  ? `Tốt nghiệp tại ${graduateSemester} (${passedCredits} TC)`
                  : `${creditsPercentage}% hoàn thành · Còn ${remainingCredits} TC`}
              </p>
            </>
          )}
        </div>
      </section>

      {/* 3. View Switcher */}
      <div
        role="tablist"
        aria-label="Chế độ xem hồ sơ học tập"
        className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeViewTab === "transcript"}
          onClick={() => handleViewTabChange("transcript")}
          className={cn(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-colors",
            activeViewTab === "transcript"
              ? "bg-blue-600 text-white shadow-2xs"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          )}
        >
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Bảng điểm theo Học kỳ</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeViewTab === "curriculum"}
          onClick={() => handleViewTabChange("curriculum")}
          className={cn(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-colors",
            activeViewTab === "curriculum"
              ? "bg-blue-600 text-white shadow-2xs"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          )}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Khung CTĐT &amp; Môn tiên quyết</span>
        </button>
      </div>

      {/* 4. Active Tab Content */}
      {activeViewTab === "curriculum" ? (
        <CurriculumProgressTab
          studentCohort={studentDetail?.cohort}
          enrollments={enrollments ?? []}
          currentCourses={currentCourses ?? []}
          allCourses={allCourses ?? []}
        />
      ) : (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <GraduationCap
                    className="h-4.5 w-4.5 text-blue-600"
                    aria-hidden="true"
                  />
                  Bảng điểm chi tiết theo học kỳ
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs text-slate-500">
                  Sắp xếp từ học kỳ mới nhất đến cũ nhất; bấm vào từng học kỳ để
                  thu gọn hoặc mở rộng.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-52 sm:w-64">
                  <Search
                    className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                  <Input
                    placeholder="Tìm mã hoặc tên học phần..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 bg-slate-50/50 pr-2.5 pl-8 text-xs"
                  />
                </div>

                {availableSemesters.length > 0 && (
                  <select
                    aria-label="Lọc theo học kỳ"
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="ALL">Tất cả học kỳ</option>
                    {availableSemesters.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Status Filter Pills */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                Trạng thái:
              </span>
              <Button
                variant={statusFilter === "ALL" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium",
                  statusFilter === "ALL"
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-white text-slate-600 hover:bg-slate-50",
                )}
                onClick={() => setStatusFilter("ALL")}
              >
                Tất cả ({groupedSemesters.length})
              </Button>
              <Button
                variant={statusFilter === "PASSED" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium",
                  statusFilter === "PASSED"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-white text-slate-600 hover:bg-slate-50",
                )}
                onClick={() => setStatusFilter("PASSED")}
              >
                Đã đạt
              </Button>
              <Button
                variant={statusFilter === "ENROLLED" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium",
                  statusFilter === "ENROLLED"
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-white text-slate-600 hover:bg-slate-50",
                )}
                onClick={() => setStatusFilter("ENROLLED")}
              >
                Đang học
              </Button>
              <Button
                variant={statusFilter === "FAILED" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium",
                  statusFilter === "FAILED"
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "bg-white text-slate-600 hover:bg-slate-50",
                )}
                onClick={() => setStatusFilter("FAILED")}
              >
                Chưa đạt
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-5">
            {isLoadingTranscript ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="space-y-3 rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-52 bg-slate-100" />
                      <Skeleton className="h-4 w-44 bg-slate-100" />
                    </div>
                    <Skeleton className="h-24 w-full bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : filteredSemesterGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen
                  className="mb-3 h-8 w-8 text-slate-300"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-slate-800">
                  Không tìm thấy dữ liệu học kỳ phù hợp
                </p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  {hasActiveFilters
                    ? "Không có học phần nào khớp với bộ lọc hiện tại. Thử đặt lại bộ lọc để xem toàn bộ bảng điểm."
                    : "Chưa ghi nhận dữ liệu bảng điểm cho sinh viên này."}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedSemester("ALL");
                      setStatusFilter("ALL");
                      setSearchQuery("");
                    }}
                    className="mt-4 h-8 cursor-pointer text-xs font-semibold"
                  >
                    Đặt lại bộ lọc
                  </Button>
                )}
              </div>
            ) : (
              filteredSemesterGroups.map((group) => {
                const isCollapsed = Boolean(collapsedMap[group.semesterCode]);

                return (
                  <div
                    key={group.semesterCode}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    {/* Semester Section Header */}
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleSemester(group.semesterCode)}
                      className="flex w-full cursor-pointer flex-col gap-3 border-b border-slate-100 bg-slate-50/80 p-4 text-left transition-colors hover:bg-slate-100/70 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Badge
                          className={cn(
                            "font-mono text-xs font-bold tabular-nums",
                            group.isInProgress
                              ? "bg-blue-600 text-white"
                              : "bg-slate-900 text-white",
                          )}
                        >
                          {group.semesterCode}
                        </Badge>
                        <span className="font-heading text-sm font-bold text-slate-900">
                          {group.semesterName}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-semibold",
                            group.isInProgress
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700",
                          )}
                        >
                          {group.isInProgress ? "Đang học" : "Hoàn thành"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                        <span>
                          <span className="text-slate-500">GPA kỳ: </span>
                          <strong
                            className={cn(
                              "font-mono",
                              group.isInProgress
                                ? "text-blue-700"
                                : group.semesterGpa !== null &&
                                    group.semesterGpa >= 3.0
                                  ? "text-emerald-700"
                                  : "text-slate-900",
                            )}
                          >
                            {group.isInProgress
                              ? "Đang cập nhật"
                              : group.semesterGpa !== null
                                ? group.semesterGpa.toFixed(2)
                                : "—"}
                          </strong>
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          <span className="text-slate-500">Tích lũy: </span>
                          <strong className="font-mono text-slate-900">
                            {group.cumulativeGpa !== null
                              ? group.cumulativeGpa.toFixed(2)
                              : "—"}
                          </strong>
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          <strong className="text-slate-900">
                            {group.passedCredits}
                          </strong>
                          <span className="text-slate-500">
                            /{group.attemptedCredits} TC
                          </span>
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-medium text-slate-700">
                          {group.courses.length > 0
                            ? group.courses.length
                            : group.coursesCount}{" "}
                          môn
                        </span>
                        <span className="ml-1 text-slate-500">
                          {isCollapsed ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </span>
                      </div>
                    </button>

                    {/* Semester Courses Table */}
                    {!isCollapsed && (
                      <div>
                        {group.courses.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="border-b border-slate-100 bg-white text-xs font-semibold text-slate-500 uppercase">
                                <tr>
                                  <th className="px-4 py-2.5">Mã HP</th>
                                  <th className="px-4 py-2.5">Tên học phần</th>
                                  <th className="px-4 py-2.5">TC</th>
                                  <th className="px-4 py-2.5">
                                    Điểm (Hệ 4 / Chữ)
                                  </th>
                                  <th className="px-4 py-2.5">Điểm thành phần</th>
                                  <th className="px-4 py-2.5">Trạng thái</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {group.courses.map((course) => {
                                  const isCompleted =
                                    course.status === "completed";
                                  const isEnrolled = course.status === "enrolled";

                                  return (
                                    <tr
                                      key={course.id}
                                      className="transition-colors hover:bg-slate-50/70"
                                    >
                                      <td className="px-4 py-3 align-top font-mono text-xs font-bold text-slate-900">
                                        <div>{course.courseCode}</div>
                                        {course.classGroup && (
                                          <div className="mt-0.5 font-sans text-xs font-normal text-slate-500">
                                            Nhóm {course.classGroup}
                                          </div>
                                        )}
                                      </td>

                                      <td className="px-4 py-3 align-top">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-medium text-slate-800">
                                            {course.courseName}
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
                                        {course.lecturerName && (
                                          <p className="mt-0.5 text-xs text-slate-500">
                                            GV: {course.lecturerName}
                                          </p>
                                        )}
                                      </td>

                                      <td className="px-4 py-3 align-top font-medium text-slate-700 tabular-nums">
                                        {course.credits}
                                      </td>

                                      <td className="px-4 py-3 align-top font-mono tabular-nums">
                                        {isEnrolled ? (
                                          <span className="font-sans text-xs font-medium text-slate-500">
                                            Đang học
                                          </span>
                                        ) : course.gpa4 !== null ? (
                                          <div className="flex items-baseline gap-1.5">
                                            <span
                                              className={cn(
                                                "font-bold",
                                                course.gpa4 >= 3.6
                                                  ? "text-emerald-700"
                                                  : course.gpa4 >= 2.5
                                                    ? "text-blue-700"
                                                    : course.gpa4 >= 2.0
                                                      ? "text-slate-800"
                                                      : "text-rose-600",
                                              )}
                                            >
                                              {course.gpa4.toFixed(1)}
                                            </span>
                                            {course.letterGrade && (
                                              <span className="text-xs font-semibold text-slate-500">
                                                ({course.letterGrade})
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-slate-400">
                                            —
                                          </span>
                                        )}
                                      </td>

                                      <td className="px-4 py-3 align-top text-xs text-slate-500 tabular-nums">
                                        {course.finalScore !== null ? (
                                          <div className="flex flex-wrap items-center gap-1.5 font-mono">
                                            <span className="font-semibold text-slate-800">
                                              Tổng kết: {course.finalScore}
                                            </span>
                                            {course.giuaKy !== null && (
                                              <span className="text-slate-500">
                                                · GK: {course.giuaKy}
                                              </span>
                                            )}
                                            {course.cuoiKy !== null && (
                                              <span className="text-slate-500">
                                                · CK: {course.cuoiKy}
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-xs text-slate-400">
                                            {isEnrolled
                                              ? "Chờ tổng kết"
                                              : "—"}
                                          </span>
                                        )}
                                      </td>

                                      <td className="px-4 py-3 align-top">
                                        {isCompleted ? (
                                          <Badge
                                            variant="outline"
                                            className="gap-1 border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                                          >
                                            <CheckCircle2
                                              className="h-3 w-3"
                                              aria-hidden="true"
                                            />
                                            <span>Đạt</span>
                                          </Badge>
                                        ) : isEnrolled ? (
                                          <Badge
                                            variant="outline"
                                            className="gap-1 border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700"
                                          >
                                            <Clock
                                              className="h-3 w-3"
                                              aria-hidden="true"
                                            />
                                            <span>Đang học</span>
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant="outline"
                                            className="gap-1 border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"
                                          >
                                            <XCircle
                                              className="h-3 w-3"
                                              aria-hidden="true"
                                            />
                                            <span>Chưa đạt</span>
                                          </Badge>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 p-4 text-xs text-slate-600 tabular-nums">
                            <Info
                              className="h-4 w-4 shrink-0 text-blue-600"
                              aria-hidden="true"
                            />
                            <span>
                              Tổng kết học kỳ:{" "}
                              <strong>{group.coursesCount} môn</strong> (
                              <strong className="text-slate-900">
                                {group.passedCredits}
                              </strong>
                              /{group.attemptedCredits} TC đạt · GPA kỳ:{" "}
                              <strong className="text-slate-900">
                                {group.semesterGpa !== null
                                  ? group.semesterGpa.toFixed(2)
                                  : "—"}
                              </strong>
                              {group.cumulativeGpa !== null && (
                                <>
                                  {" "}
                                  · GPA tích lũy:{" "}
                                  <strong>
                                    {group.cumulativeGpa.toFixed(2)}
                                  </strong>
                                </>
                              )}
                              ). Chi tiết điểm từng môn được lưu trữ ở cấp học
                              vụ.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
