import { useMemo } from "react";
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
import {
  useLecturerCurrentClasses,
  useActiveSemester,
  useAllClassesEnrollments,
} from "../api/lecturer-api";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export const LecturerDashboardPage = () => {
  const navigate = useNavigate();
  const { data: user } = useAuthUser();
  const lecturerId = user?.user_code || user?.id;

  const {
    data: classes = [],
    isLoading: isLoadingClasses,
  } = useLecturerCurrentClasses(lecturerId);

  const { data: activeSemester } = useActiveSemester();

  // Fetch enrollments across all assigned classes
  const classIds = useMemo(() => classes.map((c) => c.class_id), [classes]);
  const enrollmentsQueries = useAllClassesEnrollments(classIds);
  const isLoadingEnrollments = enrollmentsQueries.some((q) => q.isLoading);

  // Combine all enrollments
  const allEnrollments = useMemo(() => {
    return enrollmentsQueries.flatMap((q) => q.data ?? []);
  }, [enrollmentsQueries]);

  const greetingName = user?.name
    ? user.name.split(" ").slice(-1)[0]
    : "Professor";

  const semesterDisplay = activeSemester?.semester_code
    ? activeSemester.semester_code.startsWith("HK")
      ? `Semester ${activeSemester.semester_code.slice(2)}`
      : activeSemester.semester_code
    : "Semester 261";

  // Real Calculated Metrics
  const totalStudents = useMemo(() => {
    if (allEnrollments.length > 0) return allEnrollments.length;
    return classes.reduce((acc, c) => acc + (c.total_students || 0), 0);
  }, [allEnrollments, classes]);

  const atRiskStudents = useMemo(() => {
    return allEnrollments.filter(
      (s) =>
        (s.giua_ky !== null && s.giua_ky < 4.0) ||
        (s.retaken && (s.giua_ky === null || s.giua_ky < 5.0)),
    );
  }, [allEnrollments]);

  const avgPerformance = useMemo(() => {
    const scoredGpa = allEnrollments.filter(
      (s) => s.gpa_4 !== null && s.gpa_4 > 0,
    );
    if (scoredGpa.length > 0) {
      const sum = scoredGpa.reduce((acc, s) => acc + (s.gpa_4 || 0), 0);
      return {
        value: (sum / scoredGpa.length).toFixed(2),
        label: "4.0 Grade Point Scale",
      };
    }

    const scoredMidterm = allEnrollments.filter(
      (s) => s.giua_ky !== null && s.giua_ky >= 0,
    );
    if (scoredMidterm.length > 0) {
      const sum = scoredMidterm.reduce((acc, s) => acc + (s.giua_ky || 0), 0);
      return {
        value: `${(sum / scoredMidterm.length).toFixed(1)}/10`,
        label: "Avg Midterm Evaluation",
      };
    }

    return {
      value: "—",
      label: "Pending grade submissions",
    };
  }, [allEnrollments]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Welcome back, {greetingName}!
            </h1>
            <Badge className="bg-blue-600 text-white font-medium">
              Faculty Portal
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Real-time teaching class monitoring, student risk evaluations, and early intervention management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-2xs"
          >
            <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {semesterDisplay} • Active Term
          </Badge>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Active Classes */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Active Classes
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
              Assigned in {semesterDisplay}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Students */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Total Students
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
                {totalStudents}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Across all assigned sections
            </p>
          </CardContent>
        </Card>

        {/* Card 3: At-Risk Students */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              At-Risk Students
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEnrollments ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-600">
                  {atRiskStudents.length}
                </span>
                {atRiskStudents.length > 0 ? (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0.2">
                    Action Required
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5">
                    Safe
                  </Badge>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Midterm &lt; 4.0 or Repeated Course
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Avg Section Performance */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Avg Performance
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEnrollments ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-black text-slate-900">
                {avgPerformance.value}
              </div>
            )}
            <p className="mt-1 text-xs text-emerald-600 font-medium">
              {avgPerformance.label}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Main Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (col-span-2): My Classes Quick Roster */}
        <Card className="border-slate-200 bg-white shadow-xs lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                Assigned Classes
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Active teaching sections for {semesterDisplay}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50 cursor-pointer"
              onClick={() => navigate("/lecturer/classes")}
            >
              <span>View All Classes</span>
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
                No active classes found for this semester.
              </div>
            ) : (
              classes.map((cls) => (
                <div
                  key={cls.class_id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-4 transition-colors hover:bg-slate-50 gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-mono font-bold text-xs">
                      {cls.class_group}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {cls.course_code}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold text-slate-600 bg-white"
                        >
                          {cls.total_students} Students
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-blue-700 border-blue-200 bg-blue-50"
                        >
                          {cls.credits} Credits
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600 font-medium">
                        {cls.course_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-[11px] text-slate-500">
                      {cls.class_id}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-blue-700 hover:bg-blue-50 cursor-pointer"
                      onClick={() => navigate("/lecturer/classes")}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right Column: Pending Interventions Preview */}
        <Card className="flex flex-col justify-between border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900">
                Early Risk Radar
              </CardTitle>
              <Badge
                variant={atRiskStudents.length > 0 ? "destructive" : "outline"}
                className="text-[11px] font-medium"
              >
                {atRiskStudents.length} Flagged
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Students identified with academic risk factors
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-1 flex-1">
            {isLoadingEnrollments ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : atRiskStudents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <p className="font-medium text-slate-700">
                  All Students Performing Well
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  No students in your active sections currently have failing midterm grades or critical risks.
                </p>
              </div>
            ) : (
              atRiskStudents.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono font-bold text-slate-900">
                      ID: {item.student_id}
                    </p>
                    <Badge
                      variant="destructive"
                      className="text-[9px] px-1.5 py-0"
                    >
                      {item.retaken ? "Repeated" : "Low Score"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="font-semibold text-blue-700">
                      {item.course_code}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {item.class_id}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-rose-600 font-medium">
                    {item.giua_ky !== null
                      ? `Midterm score: ${item.giua_ky}/10`
                      : "Repeating course without midterm recorded"}
                  </p>
                </div>
              ))
            )}
          </CardContent>

          <div className="border-t border-slate-100 p-4 pt-3">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs cursor-pointer"
              onClick={() => navigate("/lecturer/alerts")}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Open Intervention Management
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
