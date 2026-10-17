import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuthUser } from "@/features/auth";
import {
  ArrowRight,
  Award,
  BookOpen,
  GraduationCap,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStudentCurrentCourses, useStudentSummary } from "../api/student-api";

// Standard Bachelor Degree Credit Requirement
const DEGREE_TOTAL_CREDITS = 128;

export const StudentOverviewPage = () => {
  const navigate = useNavigate();
  const { data: user } = useAuthUser();

  // Primary student ID from user profile
  const studentId = user?.user_code || user?.id;

  // Fetch real Academic Summary & Semester GPA History
  const { data: summary } = useStudentSummary(studentId);

  // Fetch real current registered courses (GET /students/{id}/current)
  const { data: currentCourses, isLoading: isLoadingCourses } =
    useStudentCurrentCourses(studentId);

  // 1. Personalized Greeting name
  const greetingName = user?.name
    ? user.name.split(" ").slice(-1)[0]
    : "Nguyen";

  // Check if student is a brand new freshman with only 1 in-progress semester
  const isFirstTermOnly =
    Boolean(summary) &&
    summary?.total_passed_credits === 0 &&
    summary?.passed_courses_count === 0 &&
    summary?.failed_courses_count === 0;

  // 2. Real Cumulative GPA & Delta computation
  const cumulativeGpa = summary?.cumulative_gpa ?? 3.2;

  // Compute GPA change from the last two COMPLETED semesters (ignoring active in-progress terms with 0.0)
  const gpaDelta = useMemo(() => {
    if (summary?.semester_gpas && summary.semester_gpas.length >= 1) {
      // Completed semesters have finalized GPA or passed credits
      const completedList = summary.semester_gpas.filter(
        (s) =>
          Number(s.semester_gpa ?? s.gpa ?? 0) > 0 ||
          Number(s.passed_credits ?? 0) > 0,
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
    return 0.1; // Default baseline
  }, [summary]);

  // 3. Real Credits Passed & Progress Computation
  const passedCredits = summary?.total_passed_credits ?? 112;
  const creditsPercentage = Math.min(
    100,
    Math.round((passedCredits / DEGREE_TOTAL_CREDITS) * 100),
  );
  const remainingCredits = Math.max(0, DEGREE_TOTAL_CREDITS - passedCredits);

  // 4. Overall Status computation (Graduated vs Active Term Enrollment)
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

    // Historical student: finished past terms and not currently enrolled in active term HK261
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

  const currentTermEnrollment = useMemo(() => {
    if (currentCourses && currentCourses.length > 0) {
      const credits = currentCourses.reduce(
        (acc, c) => acc + (Number(c.credits) || 0),
        0,
      );
      const termCode = currentCourses[0]?.class_id?.split("_")[0] || "HK261";
      return {
        termCode,
        credits,
        classesCount: currentCourses.length,
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
      termCode: "HK261",
      credits: 0,
      classesCount: 0,
    };
  }, [currentCourses, summary]);

  // 5. Dynamic GPA Trend Line Chart mapping real semester_gpas
  const displaySemesters = useMemo(() => {
    if (summary?.semester_gpas && summary.semester_gpas.length > 0) {
      return summary.semester_gpas.map((s, idx, arr) => {
        const rawGpa = Number(s.semester_gpa ?? s.gpa ?? 0);
        // Detect if this is the active in-progress term (last term, gpa 0.0, 0 passed credits, but has attempted credits)
        const isInProgress =
          idx === arr.length - 1 &&
          rawGpa === 0 &&
          Number(s.passed_credits ?? 0) === 0 &&
          Number(s.attempted_credits ?? 0) > 0;

        return {
          code: s.semester_code,
          gpa: rawGpa,
          isInProgress,
        };
      });
    }
    // Fallback semesters if not loaded or empty
    return [
      { code: "HK241", gpa: 2.9, isInProgress: false },
      { code: "HK242", gpa: 3.05, isInProgress: false },
      { code: "HK251", gpa: 3.1, isInProgress: false },
      { code: "HK252", gpa: 3.12, isInProgress: false },
      { code: "HK261", gpa: 3.2, isInProgress: true },
    ];
  }, [summary]);

  // Chart layout configuration:
  // ViewBox: 0 0 650 230
  // Y-Scale: Min GPA 1.0 (y=175) to Max GPA 4.0 (y=30), Span = 145px
  // X-Range: from x=60 to x=600, Span = 540px
  const chartPoints = useMemo(() => {
    const total = displaySemesters.length;
    // Find last completed semester GPA to project anchor for in-progress semester
    const lastCompleted = [...displaySemesters]
      .reverse()
      .find((d) => !d.isInProgress);
    const baselineGpa = lastCompleted?.gpa ?? 2.0;

    return displaySemesters.map((item, index) => {
      const x = total === 1 ? 330 : 60 + (index * 540) / (total - 1);
      const effectiveGpa = item.isInProgress ? baselineGpa : item.gpa;

      // Scale: 1.0 -> y=175, 4.0 -> y=30
      const clampedGpa = Math.max(1.0, Math.min(4.0, effectiveGpa));
      const y = 175 - ((clampedGpa - 1.0) / 3.0) * 145;

      return {
        ...item,
        x,
        y,
        displayGpa: effectiveGpa,
      };
    });
  }, [displaySemesters]);

  // Completed points (for solid curve) & In-progress point
  const completedPoints = useMemo(
    () => chartPoints.filter((p) => !p.isInProgress),
    [chartPoints],
  );
  const inProgressPoint = useMemo(
    () => chartPoints.find((p) => p.isInProgress),
    [chartPoints],
  );

  // Smooth Bezier Curve Path & Area Gradient for completed points
  const { curvePath, areaPath } = useMemo(() => {
    if (completedPoints.length === 0) return { curvePath: "", areaPath: "" };
    if (completedPoints.length === 1) {
      const p = completedPoints[0];
      return {
        curvePath: `M ${p.x - 30},${p.y} L ${p.x + 30},${p.y}`,
        areaPath: `M ${p.x - 30},${p.y} L ${p.x + 30},${p.y} L ${p.x + 30},175 L ${p.x - 30},175 Z`,
      };
    }

    let curve = `M ${completedPoints[0].x},${completedPoints[0].y}`;
    for (let i = 0; i < completedPoints.length - 1; i++) {
      const curr = completedPoints[i];
      const next = completedPoints[i + 1];
      const cpX1 = curr.x + (next.x - curr.x) / 2;
      const cpY1 = curr.y;
      const cpX2 = curr.x + (next.x - curr.x) / 2;
      const cpY2 = next.y;
      curve += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${next.x},${next.y}`;
    }

    const first = completedPoints[0];
    const last = completedPoints[completedPoints.length - 1];
    const area = `${curve} L ${last.x},175 L ${first.x},175 Z`;

    return { curvePath: curve, areaPath: area };
  }, [completedPoints]);

  const latestCompletedPoint = completedPoints[completedPoints.length - 1];

  return (
    <div className="space-y-8 pb-10">
      {/* 1. Personalized Greeting */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Good morning, {greetingName}.
          </h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Here is your academic health at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-2xs"
          >
            <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Semester 261 • Active Term
          </Badge>
        </div>
      </div>

      {/* 2. Quick Stats (Top Row - 3 Dark Cards) */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Card 1: Cumulative GPA (Real API Data) */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-6 text-white shadow-md transition-all hover:border-slate-700">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Cumulative GPA
              </p>
              <div className="mt-2 flex items-baseline gap-1">
                {isFirstTermOnly ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-white">
                      Pending
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      (1st Term)
                    </span>
                  </div>
                ) : (
                  <>
                    <span className="text-3xl font-extrabold tracking-tight text-white">
                      {cumulativeGpa.toFixed(2)}
                    </span>
                    <span className="text-base font-semibold text-slate-400">
                      / 4.0
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-emerald-400 ring-1 ring-slate-700/50">
              <Award className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold">
            {isFirstTermOnly ? (
              <span className="text-blue-400">
                1st semester active • Midterms in evaluation
              </span>
            ) : gpaDelta > 0 ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />+{gpaDelta.toFixed(2)}{" "}
                from last completed semester
              </span>
            ) : gpaDelta < 0 ? (
              <span className="flex items-center gap-1 text-rose-400">
                <TrendingDown className="h-3.5 w-3.5" />
                {gpaDelta.toFixed(2)} from last completed semester
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-400">
                <Minus className="h-3.5 w-3.5" />
                Unchanged from last completed semester
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Credits Completed (Real API Data) */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-6 text-white shadow-md transition-all hover:border-slate-700">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Credits Completed
              </p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-white">
                  {passedCredits}
                </span>
                <span className="text-base font-semibold text-slate-400">
                  / {DEGREE_TOTAL_CREDITS}
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-blue-400 ring-1 ring-slate-700/50">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4">
            <Progress
              value={creditsPercentage}
              className="h-2 w-full **:data-[slot=progress-track]:bg-slate-800 **:data-[slot=progress-indicator]:bg-blue-500"
            />
            <p className="mt-2 text-[11px] font-medium text-slate-400">
              {creditsPercentage}% completed • {remainingCredits} credits
              remaining
            </p>
          </div>
        </div>

        {/* Card 3: Overall Status */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-6 text-white shadow-md transition-all hover:border-slate-700">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Overall Status
              </p>
              <div className="mt-2">
                {isGraduated ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-emerald-400">
                      Graduated
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <div className="flex items-baseline gap-1 whitespace-nowrap">
                      <span className="text-3xl font-extrabold tracking-tight text-white">
                        {currentTermEnrollment.credits}
                      </span>
                      <span className="text-sm font-semibold text-slate-400">
                        Credits
                      </span>
                    </div>
                    <span className="font-bold text-slate-600">•</span>
                    <div className="flex items-baseline gap-1 whitespace-nowrap">
                      <span className="text-2xl font-bold tracking-tight text-blue-400">
                        {currentTermEnrollment.classesCount}
                      </span>
                      <span className="text-sm font-semibold text-slate-400">
                        {currentTermEnrollment.classesCount === 1
                          ? "Class"
                          : "Classes"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 ring-1 ring-slate-700/50",
                isGraduated ? "text-emerald-400" : "text-blue-400"
              )}
            >
              {isGraduated ? (
                <GraduationCap className="h-5 w-5" />
              ) : (
                <BookOpen className="h-5 w-5" />
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 px-2 py-0.5 text-xs font-semibold",
                isGraduated
                  ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                  : "border-blue-500/30 bg-blue-500/20 text-blue-300"
              )}
            >
              {isGraduated
                ? graduateSemester
                : `${currentTermEnrollment.termCode} Enrolled`}
            </Badge>
            <span className="truncate text-xs font-medium text-slate-400">
              {isGraduated
                ? `Graduated in semester ${graduateSemester}`
                : "Active semester enrollment"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Academic Insights (Middle Row - 2 Columns CSS Grid) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (col-span-2): GPA Trend Line Chart */}
        <Card className="border-slate-200 bg-white shadow-xs lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                GPA Trend
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Performance progression over historical semesters
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                <span>Semester GPA</span>
              </div>
              <div className="hidden items-center gap-1.5 text-xs font-medium text-slate-400 sm:flex">
                <span className="h-0.5 w-3 border-t border-dashed border-slate-300" />
                <span>Good Standing (2.50)</span>
              </div>
              {inProgressPoint && (
                <div className="hidden items-center gap-1.5 text-xs font-medium text-blue-600 md:flex">
                  <span className="h-2 w-2 rounded-full border-2 border-blue-600 bg-white" />
                  <span>In Progress</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="relative w-full overflow-hidden">
              {/* Dynamic SVG Curve Line Chart */}
              <svg
                viewBox="0 0 650 230"
                className="w-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  {/* Subtle Area Gradient under line */}
                  <linearGradient
                    id="gpaAreaGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#1488DB" stopOpacity="0.25" />
                    <stop offset="85%" stopColor="#1488DB" stopOpacity="0.02" />
                    <stop offset="100%" stopColor="#1488DB" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Line Stroke Gradient */}
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
                  {/* 4.0 */}
                  <line
                    x1="52"
                    y1="30"
                    x2="615"
                    y2="30"
                    strokeDasharray="3 3"
                  />
                  {/* 3.0 */}
                  <line
                    x1="52"
                    y1="78"
                    x2="615"
                    y2="78"
                    strokeDasharray="3 3"
                  />
                  {/* 2.0 */}
                  <line
                    x1="52"
                    y1="127"
                    x2="615"
                    y2="127"
                    strokeDasharray="3 3"
                  />
                  {/* Baseline 1.0 */}
                  <line
                    x1="52"
                    y1="175"
                    x2="615"
                    y2="175"
                    stroke="#e2e8f0"
                    strokeWidth="1.2"
                  />
                </g>

                {/* Y-Axis Labels */}
                <g
                  className="fill-slate-400 text-[10px] font-medium"
                  textAnchor="end"
                >
                  <text x="46" y="34">
                    4.0
                  </text>
                  <text x="46" y="82">
                    3.0
                  </text>
                  <text x="46" y="106">
                    2.5
                  </text>
                  <text x="46" y="131">
                    2.0
                  </text>
                  <text x="46" y="179">
                    1.0
                  </text>
                </g>

                {/* Benchmark Line (Good Standing 2.50) at y=102.5 */}
                <line
                  x1="52"
                  y1="102.5"
                  x2="615"
                  y2="102.5"
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />

                {/* Dynamic Area Fill for Completed Semesters */}
                {areaPath && <path d={areaPath} fill="url(#gpaAreaGradient)" />}

                {/* Dynamic Smooth Curve Line for Completed Semesters */}
                {curvePath && (
                  <path
                    d={curvePath}
                    fill="none"
                    stroke="url(#gpaLineGradient)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                )}

                {/* Dashed Bridge Line extending to In-Progress Semester (e.g., HK261) */}
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

                {/* Render Dynamic Data Points */}
                {chartPoints.map((pt) => {
                  if (pt.isInProgress) {
                    return (
                      <g key={pt.code}>
                        {/* Hollow In-Progress Circle with pulsing halo */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={6}
                          fill="#FFFFFF"
                          stroke="#1488DB"
                          strokeWidth="2.5"
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={11}
                          fill="none"
                          stroke="#1488DB"
                          strokeWidth="1.5"
                          opacity="0.4"
                        />
                        {/* "In Progress" Badge above circle */}
                        <g
                          transform={`translate(${pt.x}, ${Math.max(22, pt.y - 25)})`}
                          textAnchor="middle"
                        >
                          <rect
                            x="-36"
                            y="-16"
                            width="72"
                            height="20"
                            rx="10"
                            fill="#1488DB"
                            className="shadow-sm"
                          />
                          <text
                            x="0"
                            y="-2"
                            fill="#ffffff"
                            fontSize="10"
                            fontWeight="bold"
                          >
                            In Progress
                          </text>
                        </g>

                        {/* Pixel-perfect X-Axis Semester Label directly beneath dot */}
                        <text
                          x={pt.x}
                          y={202}
                          textAnchor="middle"
                          className="fill-blue-700 text-[11px] font-bold"
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
                      {/* Completed Point Circle */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isLatestCompleted && !inProgressPoint ? 6 : 5}
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
                          r={10}
                          fill="none"
                          stroke="#1488DB"
                          strokeWidth="1.5"
                          opacity="0.4"
                        />
                      )}

                      {/* GPA Value Label above Circle */}
                      <text
                        x={pt.x}
                        y={pt.y - 12}
                        className="fill-slate-600 text-[11px] font-semibold"
                        textAnchor="middle"
                      >
                        {pt.gpa.toFixed(2)}
                      </text>

                      {/* Pixel-perfect X-Axis Semester Label directly beneath dot */}
                      <text
                        x={pt.x}
                        y={202}
                        textAnchor="middle"
                        className="fill-slate-600 text-[11px] font-semibold"
                      >
                        {pt.code}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </CardContent>
        </Card>

        {/* Right Column (col-span-1): Registered Courses in Semester HK261 */}
        <Card className="flex flex-col justify-between border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900">
                Registered Courses
              </CardTitle>
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700"
              >
                {isLoadingCourses
                  ? "Loading..."
                  : isGraduated
                    ? "Graduated"
                    : `${currentCourses?.length ?? 0} ${
                        (currentCourses?.length ?? 0) === 1 ? "Course" : "Courses"
                      }`}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Semester 261 • Active Enrollment
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-1">
            {isLoadingCourses ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-lg border border-slate-100 bg-slate-50/70 p-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1.5">
                        <div className="h-4 w-28 rounded bg-slate-200" />
                        <div className="h-3 w-44 rounded bg-slate-200" />
                      </div>
                      <div className="h-7 w-20 rounded bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isGraduated ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Degree Completed
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  This student has graduated ({graduateSemester}) and has no
                  active course registrations for the current semester.
                </p>
              </div>
            ) : !currentCourses || currentCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <BookOpen className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  No Registered Courses
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  No courses registered in the current semester for this student.
                </p>
              </div>
            ) : (
              <div className="max-h-95 space-y-3 overflow-y-auto pr-1">
                {currentCourses.map((course) => (
                  <div
                    key={course.class_id || course.course_code}
                    className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {course.course_code}
                      </span>
                      {course.class_group && (
                        <Badge
                          variant="outline"
                          className="h-4.5 border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-600"
                        >
                          Group {course.class_group}
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className="h-4.5 border border-blue-100 bg-blue-50 px-1.5 text-[10px] font-medium text-blue-700"
                      >
                        {course.credits}{" "}
                        {course.credits === 1 ? "credit" : "credits"}
                      </Badge>
                      {course.retaken && (
                        <Badge
                          variant="outline"
                          className="h-4.5 border-amber-200 bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700"
                        >
                          Retaken
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1.5 text-xs font-semibold text-slate-800">
                      {course.course_name}
                    </p>

                    {course.lecturer_name && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <User className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">{course.lecturer_name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Featured Action (Bottom Row - Full Width Brand Blue Card) */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        {/* Decorative background glow circles */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute right-1/4 -bottom-24 h-48 w-48 rounded-full bg-blue-400/20 blur-xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-xs">
                <Sparkles className="h-3.5 w-3.5" />
                XAI Simulator
              </span>
              <span className="text-xs text-blue-100 font-medium">
                Transparent Explainable Insights
              </span>
            </div>

            <h2 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
              Explore your academic future with XAI
            </h2>

            <p className="text-sm leading-relaxed text-blue-50/90 sm:text-base">
              Test different grades and scenarios to understand what could
              improve your academic risk profile — with transparent AI
              explanations at every step.
            </p>
          </div>

          <div className="shrink-0">
            <Button
              size="lg"
              className="group cursor-pointer rounded-xl bg-white px-6 py-3 font-semibold text-blue-700 shadow-md transition-all hover:bg-blue-50 hover:shadow-lg active:scale-95"
              onClick={() => navigate("/student/what-if")}
            >
              <span>Launch Simulator</span>
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
