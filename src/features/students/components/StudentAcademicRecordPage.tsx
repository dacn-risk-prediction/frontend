import { useState, useMemo } from "react";
import {
  GraduationCap,
  Award,
  BookOpen,
  Clock,
  Search,
  Filter,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/features/auth";
import {
  useStudentSummary,
  useStudentDetail,
  useStudentEnrollments,
  useStudentCurrentCourses,
  useAllCourses,
} from "../api/student-api";

// Standard Bachelor Degree Requirement (HCMUT)
const DEGREE_TOTAL_CREDITS = 128;

// Helper to rank semester codes chronologically for newest-to-oldest sorting
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

// Helper to format academic term into a human-readable title
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
        ? "Semester 1"
        : termNum === "2"
          ? "Semester 2"
          : "Summer Term";
    return `Semester ${yearPrefix}${termNum} • ${termLabel} (${fullYearStart} - ${fullYearEnd})`;
  }
  return `Semester ${code}`;
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
  const { data: user } = useAuthUser();
  const studentId = user?.user_code || user?.id;

  // Real API Queries
  const { data: summary } = useStudentSummary(studentId);
  const { data: studentDetail } = useStudentDetail(studentId);
  const { data: enrollments } = useStudentEnrollments(studentId);
  const { data: currentCourses } = useStudentCurrentCourses(studentId);
  const { data: allCourses } = useAllCourses();

  // Filters state
  const [selectedSemester, setSelectedSemester] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PASSED" | "ENROLLED" | "FAILED"
  >("ALL");

  // Track collapsed semesters (empty map = all expanded by default)
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const toggleSemester = (code: string) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  // 1. Graduation & Academic Standing Computation
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

    if (summary?.semester_gpas && summary.semester_gpas.length > 0) {
      const lastTerm = summary.semester_gpas[summary.semester_gpas.length - 1];
      if (
        lastTerm.semester_code !== "HK261" &&
        (summary.total_passed_credits >= 110 ||
          Number(lastTerm.passed_credits ?? 0) > 0)
      ) {
        return true;
      }
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

  const passedCredits = summary?.total_passed_credits ?? 0;
  const cumulativeGpa = summary?.cumulative_gpa ?? 0.0;
  const creditsPercentage = Math.min(
    100,
    Math.round((passedCredits / DEGREE_TOTAL_CREDITS) * 100),
  );
  const remainingCredits = Math.max(0, DEGREE_TOTAL_CREDITS - passedCredits);

  // Standing calculation
  const academicStanding = useMemo(() => {
    if (isGraduated) return "Graduated";
    if (passedCredits >= 105) return "Senior (Year 4)";
    if (passedCredits >= 70) return "Junior (Year 3)";
    if (passedCredits >= 35) return "Sophomore (Year 2)";
    return "Freshman (Year 1)";
  }, [isGraduated, passedCredits]);

  // Major Name formatting
  const majorName = useMemo(() => {
    if (studentDetail?.major) {
      return studentDetail.major
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
    return "Computer Science (B.S.)";
  }, [studentDetail]);

  const cohortLabel = studentDetail?.cohort ?? "K26";

  // 2. Build Unified Semester Groups (Sorted from Newest to Oldest)
  const groupedSemesters = useMemo<SemesterGroup[]>(() => {
    const courseMap = new Map(
      (allCourses ?? []).map((c) => [c.course_code, c]),
    );

    // Map semesterCode -> semester summary metadata
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
        const cumGpa = Number(s.gpa ?? 0);
        const isInProgress =
          idx === arr.length - 1 &&
          rawGpa === 0 &&
          Number(s.passed_credits ?? 0) === 0 &&
          Number(s.attempted_credits ?? 0) > 0;

        summaryMap.set(s.semester_code, {
          semesterGpa: isInProgress ? null : rawGpa,
          cumulativeGpa: isInProgress ? null : cumGpa,
          passedCredits: Number(s.passed_credits ?? 0),
          attemptedCredits: Number(s.attempted_credits ?? 0),
          coursesCount: Number(s.courses_count ?? 0),
          isInProgress,
        });
      });
    }

    const semesterSet = new Set<string>();
    summaryMap.forEach((_, code) => semesterSet.add(code));

    // Group courses by semesterCode
    const coursesBySemester = new Map<string, SemesterCourseItem[]>();

    // 1. Historical enrollments
    if (enrollments && enrollments.length > 0) {
      for (const e of enrollments) {
        semesterSet.add(e.semester_code);
        const catalogCourse = courseMap.get(e.course_code);
        const isPass =
          e.passed === true || (e.gpa_4 !== null && e.gpa_4 >= 2.0);
        const isFailed =
          e.passed === false || (e.gpa_4 !== null && e.gpa_4 < 2.0);

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

    // 2. Active current registered courses
    if (currentCourses && currentCourses.length > 0) {
      const currentTermCode =
        currentCourses[0]?.class_id?.split("_")[0] || "HK261";
      semesterSet.add(currentTermCode);
      const list = coursesBySemester.get(currentTermCode) || [];
      for (const item of currentCourses) {
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

    // Sort semester codes from newest to oldest (descending rank)
    const sortedCodes = Array.from(semesterSet).sort(
      (a, b) => parseSemesterRank(b) - parseSemesterRank(a),
    );

    const activeTermCode =
      currentCourses?.[0]?.class_id?.split("_")[0] || "HK261";

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

      return {
        semesterCode: code,
        semesterName: formatSemesterName(code),
        semesterGpa: summaryInfo?.semesterGpa ?? null,
        cumulativeGpa: summaryInfo?.cumulativeGpa ?? null,
        passedCredits: passed,
        attemptedCredits: attempted,
        coursesCount: count,
        isInProgress,
        courses,
      };
    });
  }, [summary, enrollments, currentCourses, allCourses]);

  // List of distinct semester codes for dropdown filter
  const availableSemesters = useMemo(() => {
    return groupedSemesters.map((g) => g.semesterCode);
  }, [groupedSemesters]);

  // Filtered semester groups (preserves newest-to-oldest order)
  const filteredSemesterGroups = useMemo(() => {
    return groupedSemesters
      .map((group) => {
        // Specific semester selection
        if (
          selectedSemester !== "ALL" &&
          group.semesterCode !== selectedSemester
        ) {
          return null;
        }

        // Filter courses inside this semester
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

        // If query active and no courses match inside this group, omit group
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

  return (
    <div className="space-y-6">
      {/* 1. Header & Title Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Academic Record
            </h1>
            <Badge
              variant="outline"
              className="border-slate-200 bg-white font-mono text-xs text-slate-600"
            >
              ID: {studentId}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Official degree audit, semester results, and complete transcript
            ordered from newest to oldest.
          </p>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "w-fit px-3 py-1 text-xs font-semibold",
            isGraduated
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-blue-200 bg-blue-50 text-blue-700"
          )}
        >
          {isGraduated ? (
            <>
              <GraduationCap className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
              Official Degree Awarded
            </>
          ) : (
            <>
              <Award className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
              Official Degree Audit
            </>
          )}
        </Badge>
      </div>

      {/* 2. Key Academic Standing Cards (Real API Data) */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Card 1: Major & Cohort */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Degree & Major
              </p>
              <div className="mt-2">
                <p className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                  {majorName}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50/60 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700"
                  >
                    Cohort {cohortLabel}
                  </Badge>
                  <span className="text-xs font-medium text-slate-500">
                    Undergraduate Program
                  </span>
                </div>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Card 2: Academic Standing & Cumulative GPA */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Academic Standing
              </p>
              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-slate-900 sm:text-xl">
                    {academicStanding}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] font-semibold",
                      isGraduated || cumulativeGpa >= 3.0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-blue-200 bg-blue-50 text-blue-700"
                    )}
                  >
                    {isGraduated ? "Completed" : "Good Standing"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  GPA:{" "}
                  <span className="font-bold text-slate-900">
                    {cumulativeGpa.toFixed(2)}
                  </span>{" "}
                  / 4.0 • {summary?.passed_courses_count ?? 0} Passed Courses
                </p>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <Award className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Card 3: Degree Progress / Credits */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Degree Progress
              </p>
              <div className="mt-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-slate-900 sm:text-xl">
                    {passedCredits}
                  </span>
                  <span className="text-sm font-semibold text-slate-500">
                    / {DEGREE_TOTAL_CREDITS} Credits
                  </span>
                </div>
                <div className="mt-2">
                  <Progress
                    value={creditsPercentage}
                    className="h-2 w-full **:data-[slot=progress-indicator]:bg-blue-600 **:data-[slot=progress-track]:bg-slate-100"
                  />
                  <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                    {isGraduated
                      ? `Graduated in ${graduateSemester} (${passedCredits} credits)`
                      : `${creditsPercentage}% completed • ${remainingCredits} credits remaining`}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              {isGraduated ? (
                <GraduationCap className="h-5 w-5" />
              ) : (
                <Clock className="h-5 w-5" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Unified Semester Results & Course Transcript (Newest to Oldest) */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <GraduationCap className="h-5 w-5 text-blue-700" />
                Comprehensive Semester Transcript
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Complete historical record of semester performance and
                individual course grades, ordered from newest to oldest.
              </CardDescription>
            </div>

            {/* Live Search & Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48 sm:w-60">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search course code or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 bg-slate-50/50 pl-8 pr-2.5 text-xs"
                />
              </div>

              {availableSemesters.length > 0 && (
                <div className="flex items-center">
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ALL">All Semesters</option>
                    {availableSemesters.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Status Filter Pills */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1">
            <span className="mr-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Filter className="h-3 w-3" /> Filter:
            </span>
            <Button
              variant={statusFilter === "ALL" ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-6 rounded-md px-2 text-[11px] font-medium",
                statusFilter === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              )}
              onClick={() => setStatusFilter("ALL")}
            >
              All Semesters ({groupedSemesters.length})
            </Button>
            <Button
              variant={statusFilter === "PASSED" ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-6 rounded-md px-2 text-[11px] font-medium",
                statusFilter === "PASSED"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              )}
              onClick={() => setStatusFilter("PASSED")}
            >
              Passed Only
            </Button>
            <Button
              variant={statusFilter === "ENROLLED" ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-6 rounded-md px-2 text-[11px] font-medium",
                statusFilter === "ENROLLED"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              )}
              onClick={() => setStatusFilter("ENROLLED")}
            >
              In Progress
            </Button>
            <Button
              variant={statusFilter === "FAILED" ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-6 rounded-md px-2 text-[11px] font-medium",
                statusFilter === "FAILED"
                  ? "bg-rose-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              )}
              onClick={() => setStatusFilter("FAILED")}
            >
              Failed / Retaken
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-1">
          {filteredSemesterGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <BookOpen className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                No Academic Records Found
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                No semester records matched your filter criteria. Try resetting
                the semester filter or search query.
              </p>
            </div>
          ) : (
            filteredSemesterGroups.map((group) => {
              const isCollapsed = Boolean(collapsedMap[group.semesterCode]);

              return (
                <div
                  key={group.semesterCode}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs transition-all hover:border-slate-300"
                >
                  {/* Semester Section Header */}
                  <div
                    onClick={() => toggleSemester(group.semesterCode)}
                    className="flex cursor-pointer flex-col gap-3 border-b border-slate-100 bg-slate-50/80 p-4 transition-colors hover:bg-slate-100/70 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* Left: Semester Code, Name, Status */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge
                        className={cn(
                          "font-mono text-xs font-bold",
                          group.isInProgress
                            ? "bg-blue-600 text-white"
                            : "bg-slate-900 text-white"
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
                          "text-[11px] font-semibold",
                          group.isInProgress
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {group.isInProgress ? "Active Term" : "Completed"}
                      </Badge>
                    </div>

                    {/* Right: Semester GPA & Credits Summary Metrics */}
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs">
                      <div className="flex items-baseline gap-1">
                        <span className="font-medium text-slate-500">
                          Term GPA:
                        </span>
                        <span
                          className={cn(
                            "font-mono font-bold",
                            group.isInProgress
                              ? "text-blue-600"
                              : group.semesterGpa !== null &&
                                  group.semesterGpa >= 3.0
                                ? "text-emerald-600"
                                : "text-slate-900"
                          )}
                        >
                          {group.isInProgress
                            ? "In Evaluation"
                            : group.semesterGpa !== null
                              ? group.semesterGpa.toFixed(2)
                              : "-"}
                        </span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-medium text-slate-500">
                          Cum. GPA:
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {group.cumulativeGpa !== null
                            ? `${group.cumulativeGpa.toFixed(2)}`
                            : "-"}
                        </span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-medium text-slate-500">
                          Credits:
                        </span>
                        <span className="font-semibold text-slate-900">
                          {group.passedCredits}
                        </span>
                        <span className="text-slate-400">
                          /{group.attemptedCredits}
                        </span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-medium text-slate-500">
                          Courses:
                        </span>
                        <span className="font-semibold text-slate-900">
                          {group.courses.length > 0
                            ? group.courses.length
                            : group.coursesCount}
                        </span>
                      </div>
                      <div className="ml-1 text-slate-400">
                        {isCollapsed ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronUp className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Semester Courses Table / Details */}
                  {!isCollapsed && (
                    <div className="p-0">
                      {group.courses.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-100 bg-white text-xs font-semibold uppercase text-slate-500">
                              <tr>
                                <th className="px-4 py-2.5">Course Code</th>
                                <th className="px-4 py-2.5">Course Name</th>
                                <th className="px-4 py-2.5">Credits</th>
                                <th className="px-4 py-2.5">
                                  Grade (4.0 / Letter)
                                </th>
                                <th className="px-4 py-2.5">Scores</th>
                                <th className="px-4 py-2.5">Status</th>
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
                                    className="transition-colors hover:bg-slate-50/60"
                                  >
                                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                                      <div className="flex items-center gap-1.5">
                                        <span>{course.courseCode}</span>
                                        {course.classGroup && (
                                          <Badge
                                            variant="outline"
                                            className="h-4 border-slate-200 bg-slate-50 px-1 text-[10px] text-slate-600"
                                          >
                                            {course.classGroup}
                                          </Badge>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800">
                                      <div>
                                        <span>{course.courseName}</span>
                                        {course.retaken && (
                                          <Badge
                                            variant="outline"
                                            className="ml-2 border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
                                          >
                                            Retaken
                                          </Badge>
                                        )}
                                        {course.lecturerName && (
                                          <p className="mt-0.5 text-[11px] text-slate-400">
                                            Lecturer: {course.lecturerName}
                                          </p>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-600">
                                      {course.credits}
                                    </td>
                                    <td className="px-4 py-3 font-mono">
                                      {isEnrolled ? (
                                        <Badge
                                          variant="secondary"
                                          className="border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700"
                                        >
                                          In Progress
                                        </Badge>
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
                                                    ? "text-slate-700"
                                                    : "text-rose-600"
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
                                          -
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">
                                      {course.finalScore !== null ? (
                                        <div className="flex flex-wrap items-center gap-1.5 font-mono">
                                          <span className="font-semibold text-slate-800">
                                            Final: {course.finalScore}
                                          </span>
                                          {course.giuaKy !== null && (
                                            <span className="text-slate-400">
                                              • Mid: {course.giuaKy}
                                            </span>
                                          )}
                                          {course.cuoiKy !== null && (
                                            <span className="text-slate-400">
                                              • End: {course.cuoiKy}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-slate-400">
                                          {isEnrolled
                                            ? "Evaluation in progress"
                                            : "N/A"}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {isCompleted ? (
                                        <Badge
                                          variant="outline"
                                          className="border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                                        >
                                          Passed
                                        </Badge>
                                      ) : isEnrolled ? (
                                        <Badge
                                          variant="outline"
                                          className="border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700"
                                        >
                                          Enrolled
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className="border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"
                                        >
                                          Failed
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
                        <div className="flex items-center gap-2.5 p-4 text-xs text-slate-600">
                          <Info className="h-4 w-4 shrink-0 text-blue-600" />
                          <span>
                            Official Academic Record:{" "}
                            <strong>
                              {group.coursesCount}{" "}
                              {group.coursesCount === 1 ? "course" : "courses"}{" "}
                              completed
                            </strong>{" "}
                            (
                            <span className="font-semibold text-slate-800">
                              {group.passedCredits}
                            </span>{" "}
                            / {group.attemptedCredits} credits passed • Term
                            GPA:{" "}
                            <strong className="text-slate-900">
                              {group.semesterGpa !== null
                                ? group.semesterGpa.toFixed(2)
                                : "N/A"}
                            </strong>
                            {group.cumulativeGpa !== null && (
                              <>
                                {" "}
                                • Cum. GPA:{" "}
                                <strong>
                                  {group.cumulativeGpa.toFixed(2)}
                                </strong>
                              </>
                            )}
                            ). Individual course grades archived in university
                            database.
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
    </div>
  );
};
