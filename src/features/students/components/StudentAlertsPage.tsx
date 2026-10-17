import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  AlertTriangle,
  Info,
  CheckCircle2,
  GraduationCap,
  Award,
  BookOpen,
  RefreshCw,
  ArrowRight,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/features/auth";
import {
  useStudentSummary,
  useStudentDetail,
  useStudentEnrollments,
  useStudentCurrentCourses,
} from "../api/student-api";

const DEGREE_TOTAL_CREDITS = 128;

export interface DerivedAlert {
  id: string;
  type: "critical" | "warning" | "info" | "success";
  title: string;
  badge: string;
  description: string;
  timestamp: string;
  actionText?: string;
  actionLink?: string;
  category: "RISK" | "ENROLLMENT" | "DEGREE" | "SYSTEM";
}

export const StudentAlertsPage = () => {
  const navigate = useNavigate();
  const { data: user } = useAuthUser();
  const studentId = user?.user_code || user?.id;

  // Real Student API Data
  const { data: summary, isLoading: isLoadingSummary } =
    useStudentSummary(studentId);
  const { data: studentDetail } = useStudentDetail(studentId);
  const { data: enrollments } = useStudentEnrollments(studentId);
  const { data: currentCourses, isLoading: isLoadingCurrent } =
    useStudentCurrentCourses(studentId);

  // Filter state
  const [activeFilter, setActiveFilter] = useState<
    "ALL" | "RISK" | "ENROLLMENT" | "DEGREE"
  >("ALL");

  // Read alerts state (persisted in localStorage per student)
  const storageKey = `aurora_read_alerts_${studentId ?? "guest"}`;
  const [readAlertIds, setReadAlertIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(readAlertIds));
    } catch {
      // ignore
    }
  }, [readAlertIds, storageKey]);

  // Graduation status detection
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

  const cumulativeGpa = summary?.cumulative_gpa ?? 0;
  const passedCredits = summary?.total_passed_credits ?? 0;
  const remainingCredits = Math.max(0, DEGREE_TOTAL_CREDITS - passedCredits);

  // ==========================================
  // Dynamic Derived Alerts Generation Engine
  // ==========================================
  const derivedAlerts = useMemo<DerivedAlert[]>(() => {
    const list: DerivedAlert[] = [];

    // 1. Critical Academic Probation Warning (GPA < 2.0)
    if (summary && cumulativeGpa > 0 && cumulativeGpa < 2.0) {
      list.push({
        id: "alert-academic-probation",
        type: "critical",
        title: "Academic Standing Warning: Low Cumulative GPA",
        badge: "Academic Probation",
        description: `Your Cumulative GPA is currently ${cumulativeGpa.toFixed(2)}/4.0, which falls below the satisfactory threshold of 2.00. We recommend scheduling an advising session with your academic advisor or evaluating scenario recovery in the XAI Simulator.`,
        timestamp: "Active Policy Warning",
        actionText: "Launch What-If Simulator",
        actionLink: "/student/what-if",
        category: "RISK",
      });
    }

    // 2. Recent Term Performance Drop Alert
    if (summary?.semester_gpas && summary.semester_gpas.length >= 2) {
      const completedTerms = summary.semester_gpas.filter(
        (s) => Number(s.passed_credits ?? 0) > 0 || Number(s.semester_gpa ?? 0) > 0,
      );
      if (completedTerms.length >= 2) {
        const last = completedTerms[completedTerms.length - 1];
        const prev = completedTerms[completedTerms.length - 2];
        const lastGpa = Number(last.semester_gpa ?? last.gpa ?? 0);
        const prevGpa = Number(prev.semester_gpa ?? prev.gpa ?? 0);
        const delta = lastGpa - prevGpa;

        if (delta <= -0.4 && lastGpa < 2.5) {
          list.push({
            id: `alert-gpa-drop-${last.semester_code}`,
            type: "warning",
            title: `Performance Drop in ${last.semester_code}`,
            badge: "Term Variance",
            description: `Your term GPA declined from ${prevGpa.toFixed(2)} in ${prev.semester_code} to ${lastGpa.toFixed(2)} in ${last.semester_code} (${delta.toFixed(2)} drop). Analyzing past course grades can help identify core subject areas for reinforcement.`,
            timestamp: `Semester ${last.semester_code} Review`,
            actionText: "View Academic Record",
            actionLink: "/student/academic-record",
            category: "RISK",
          });
        }
      }
    }

    // 3. Retaken Courses in Active Semester
    const activeSemester =
      currentCourses?.[0]?.class_id?.split("_")[0] || "HK261";

    if (currentCourses && currentCourses.length > 0) {
      const retakenCourses = currentCourses.filter((c) => c.retaken);
      if (retakenCourses.length > 0) {
        const names = retakenCourses.map((c) => c.course_code).join(", ");
        list.push({
          id: `alert-retaken-${activeSemester.toLowerCase()}`,
          type: "warning",
          title: `Active Course Retake: ${names}`,
          badge: "Course Retake",
          description: `You are currently retaking ${retakenCourses.length} ${retakenCourses.length === 1 ? "course" : "courses"} in semester ${activeSemester} (${names}). Earning a higher score will replace previous lower evaluations and positively impact your Cumulative GPA.`,
          timestamp: `Semester ${activeSemester} Registration`,
          actionText: "Simulate Performance",
          actionLink: `/student/what-if?course=${retakenCourses[0].course_code}`,
          category: "ENROLLMENT",
        });
      }
    }

    // 4. Failed Prerequisite Alert from Enrollments
    if (enrollments && enrollments.length > 0) {
      const failed = enrollments.filter(
        (e) => e.passed === false || (e.gpa_4 !== null && e.gpa_4 < 2.0),
      );
      // Exclude courses currently being retaken in current semester
      const activeRetakingCodes = new Set(
        (currentCourses ?? []).map((c) => c.course_code),
      );
      const unresolvedFailed = failed.filter(
        (e) => !activeRetakingCodes.has(e.course_code),
      );

      if (unresolvedFailed.length > 0) {
        const topCourse = unresolvedFailed[0];
        list.push({
          id: `alert-failed-course-${topCourse.course_code}`,
          type: "warning",
          title: `Prerequisite Course Alert: ${topCourse.course_code}`,
          badge: "Needs Re-enrollment",
          description: `Course ${topCourse.course_code} recorded an unpassed grade (${topCourse.letter_grade ?? "F"}) in semester ${topCourse.semester_code}. Ensure you plan re-enrollment in upcoming terms to satisfy prerequisite requirements for higher-level courses.`,
          timestamp: `Recorded in ${topCourse.semester_code}`,
          actionText: "Inspect Full Transcript",
          actionLink: "/student/academic-record",
          category: "RISK",
        });
      }
    }

    // 5. Active Current Semester Enrollment Status
    if (currentCourses && currentCourses.length > 0) {
      const totalCredits = currentCourses.reduce(
        (acc, c) => acc + (Number(c.credits) || 0),
        0,
      );
      const courseTitles = currentCourses
        .slice(0, 2)
        .map((c) => c.course_name)
        .join(", ");
      const extraCount =
        currentCourses.length > 2
          ? ` and ${currentCourses.length - 2} more`
          : "";

      list.push({
        id: `alert-${activeSemester.toLowerCase()}-active-enrollment`,
        type: "info",
        title: `Semester ${activeSemester} Active Enrollment (${currentCourses.length} Courses)`,
        badge: "In Progress",
        description: `You are officially registered for ${totalCredits} credits this semester, including ${courseTitles}${extraCount}. Continuous evaluations and midterms are ongoing.`,
        timestamp: `Active Semester ${activeSemester}`,
        actionText: "View Registered Courses",
        actionLink: "/student/overview",
        category: "ENROLLMENT",
      });
    } else if (!isGraduated && summary) {
      // Notice if student has no courses in active semester
      list.push({
        id: `alert-no-${activeSemester.toLowerCase()}-registration`,
        type: "warning",
        title: `No Registered Courses in Semester ${activeSemester}`,
        badge: "Registration Check",
        description: `Our records indicate zero registered course units in the current semester ${activeSemester}. If you intended to enroll in classes for this semester, please verify your course registration on the MyBK student portal.`,
        timestamp: `Semester ${activeSemester} Schedule`,
        actionText: "Contact Academic Affairs",
        category: "ENROLLMENT",
      });
    }

    // 6. Degree Awarded Milestone
    if (isGraduated) {
      list.push({
        id: "alert-degree-conferred",
        type: "success",
        title: "Degree Conferred: Academic Requirements Completed",
        badge: "Graduation Confirmed",
        description: `Congratulations! Official university records confirm that you have satisfied degree requirements for ${studentDetail?.major ? studentDetail.major : "Computer Science"} with ${passedCredits} completed credits, officially conferred in semester ${graduateSemester}.`,
        timestamp: `Graduated in ${graduateSemester}`,
        actionText: "View Official Degree Record",
        actionLink: "/student/academic-record",
        category: "DEGREE",
      });
    } else if (passedCredits >= 100) {
      // 7. Senior Degree Audit Milestone
      list.push({
        id: "alert-senior-milestone",
        type: "success",
        title: `Senior Degree Audit Milestone: ${passedCredits} Credits Earned`,
        badge: "Graduation Track",
        description: `You have successfully completed ${passedCredits} out of ${DEGREE_TOTAL_CREDITS} bachelor credits (${remainingCredits} credits remaining). You are on track for senior graduation audit and capstone evaluation.`,
        timestamp: "Degree Progress Audit",
        actionText: "Audit Degree Progress",
        actionLink: "/student/academic-record",
        category: "DEGREE",
      });
    } else if (summary && passedCredits === 0) {
      // 8. Freshman Onboarding Welcome
      list.push({
        id: "alert-freshman-onboarding",
        type: "info",
        title: "Welcome to Aurora Academic Intelligence",
        badge: "Orientation",
        description: `Your student profile has been registered in the Academic Intelligence system for Cohort ${studentDetail?.cohort ?? "K26"}. Progress evaluations, term GPA trends, and AI risk projections will automatically activate as midterms conclude.`,
        timestamp: "Student Profile Activated",
        actionText: "Explore Simulator",
        actionLink: "/student/what-if",
        category: "SYSTEM",
      });
    }

    return list;
  }, [
    summary,
    cumulativeGpa,
    currentCourses,
    enrollments,
    isGraduated,
    graduateSemester,
    passedCredits,
    remainingCredits,
    studentDetail,
  ]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    if (activeFilter === "ALL") return derivedAlerts;
    return derivedAlerts.filter((alert) => alert.category === activeFilter);
  }, [derivedAlerts, activeFilter]);

  // Mark all alerts as read
  const handleMarkAllRead = () => {
    const allIds = derivedAlerts.map((a) => a.id);
    setReadAlertIds(allIds);
  };

  // Mark individual alert as read
  const handleToggleRead = (id: string) => {
    setReadAlertIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Unread count
  const unreadCount = useMemo(() => {
    return derivedAlerts.filter((a) => !readAlertIds.includes(a.id)).length;
  }, [derivedAlerts, readAlertIds]);

  const isLoading = isLoadingSummary || isLoadingCurrent;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Academic Alerts & Notifications
            </h1>
            {unreadCount > 0 && (
              <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5 font-semibold">
                {unreadCount} New
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Real-time academic standing warnings, registration updates, and degree audit milestones.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-fit bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
        >
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
          Mark all as read
        </Button>
      </div>

      {/* 2. Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
          <Filter className="h-3 w-3" /> Filter:
        </span>
        <Button
          variant={activeFilter === "ALL" ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-7 rounded-md px-2.5 text-xs font-medium cursor-pointer",
            activeFilter === "ALL"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 hover:bg-slate-50"
          )}
          onClick={() => setActiveFilter("ALL")}
        >
          All Alerts ({derivedAlerts.length})
        </Button>
        <Button
          variant={activeFilter === "RISK" ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-7 rounded-md px-2.5 text-xs font-medium cursor-pointer",
            activeFilter === "RISK"
              ? "bg-rose-600 text-white"
              : "bg-white text-slate-600 hover:bg-slate-50"
          )}
          onClick={() => setActiveFilter("RISK")}
        >
          Academic Risks ({derivedAlerts.filter((a) => a.category === "RISK").length})
        </Button>
        <Button
          variant={activeFilter === "ENROLLMENT" ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-7 rounded-md px-2.5 text-xs font-medium cursor-pointer",
            activeFilter === "ENROLLMENT"
              ? "bg-blue-600 text-white"
              : "bg-white text-slate-600 hover:bg-slate-50"
          )}
          onClick={() => setActiveFilter("ENROLLMENT")}
        >
          Enrollments ({derivedAlerts.filter((a) => a.category === "ENROLLMENT").length})
        </Button>
        <Button
          variant={activeFilter === "DEGREE" ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-7 rounded-md px-2.5 text-xs font-medium cursor-pointer",
            activeFilter === "DEGREE"
              ? "bg-emerald-600 text-white"
              : "bg-white text-slate-600 hover:bg-slate-50"
          )}
          onClick={() => setActiveFilter("DEGREE")}
        >
          Degree Milestones ({derivedAlerts.filter((a) => a.category === "DEGREE").length})
        </Button>
      </div>

      {/* 3. Alerts List */}
      <div className="space-y-4">
        {isLoading ? (
          // Loading Skeleton
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
          // Empty State
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-base font-bold text-slate-800">
                All Caught Up!
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                No active notifications or alerts found in this category. You are in good standing with all course requirements.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map((alert) => {
            const isRead = readAlertIds.includes(alert.id);

            // Styling based on alert severity
            const borderClass =
              alert.type === "critical"
                ? "border-l-rose-500"
                : alert.type === "warning"
                  ? "border-l-amber-500"
                  : alert.type === "success"
                    ? "border-l-emerald-500"
                    : "border-l-blue-500";

            const iconBg =
              alert.type === "critical"
                ? "bg-rose-50 text-rose-600 ring-1 ring-rose-100"
                : alert.type === "warning"
                  ? "bg-amber-50 text-amber-600 ring-1 ring-amber-100"
                  : alert.type === "success"
                    ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
                    : "bg-blue-50 text-blue-600 ring-1 ring-blue-100";

            const badgeClass =
              alert.type === "critical"
                ? "bg-rose-100 text-rose-800 border-rose-200"
                : alert.type === "warning"
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : alert.type === "success"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : "bg-blue-100 text-blue-800 border-blue-200";

            const linkColor =
              alert.type === "critical"
                ? "text-rose-600 hover:text-rose-700"
                : alert.type === "warning"
                  ? "text-amber-700 hover:text-amber-800"
                  : alert.type === "success"
                    ? "text-emerald-700 hover:text-emerald-800"
                    : "text-blue-700 hover:text-blue-800";

            return (
              <Card
                key={alert.id}
                className={cn(
                  "border-l-4 border-slate-200 bg-white shadow-xs transition-all hover:border-slate-300",
                  borderClass,
                  isRead && "opacity-75"
                )}
              >
                <CardContent className="flex items-start gap-4 p-5">
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      iconBg
                    )}
                  >
                    {alert.type === "critical" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : alert.type === "warning" ? (
                      alert.badge === "Course Retake" ? (
                        <RefreshCw className="h-5 w-5" />
                      ) : (
                        <Bell className="h-5 w-5" />
                      )
                    ) : alert.type === "success" ? (
                      alert.badge === "Graduation Confirmed" ? (
                        <GraduationCap className="h-5 w-5" />
                      ) : (
                        <Award className="h-5 w-5" />
                      )
                    ) : alert.category === "ENROLLMENT" ? (
                      <BookOpen className="h-5 w-5" />
                    ) : (
                      <Info className="h-5 w-5" />
                    )}
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">
                          {alert.title}
                        </p>
                        {isRead && (
                          <span className="text-[10px] font-medium text-slate-400">
                            (Read)
                          </span>
                        )}
                      </div>
                      <Badge className={cn("border text-[10px] font-semibold", badgeClass)}>
                        {alert.badge}
                      </Badge>
                    </div>

                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      {alert.description}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span>{alert.timestamp}</span>
                        {alert.actionText && alert.actionLink && (
                          <>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => navigate(alert.actionLink!)}
                              className={cn(
                                "inline-flex items-center font-semibold hover:underline cursor-pointer",
                                linkColor
                              )}
                            >
                              <span>{alert.actionText}</span>
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleRead(alert.id)}
                        className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {isRead ? "Mark as unread" : "Dismiss"}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
