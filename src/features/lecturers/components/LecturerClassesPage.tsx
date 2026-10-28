import { useState, useMemo } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/features/auth";
import {
  useLecturerCurrentClasses,
  useActiveSemester,
  useClassEnrollments,
} from "../api/lecturer-api";
import type { LecturerCurrentClassItem } from "@/types";
import {
  ArrowRight,
  BookOpen,
  Search,
  Users,
  Calendar,
  AlertTriangle,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
} from "lucide-react";

export const LecturerClassesPage = () => {
  const { data: user } = useAuthUser();
  const lecturerId = user?.user_code || user?.id;

  const {
    data: classes = [],
    isLoading,
    isError,
    refetch,
  } = useLecturerCurrentClasses(lecturerId);

  const { data: activeSemester } = useActiveSemester();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] =
    useState<LecturerCurrentClassItem | null>(null);

  // Real class roster enrollments query
  const {
    data: roster = [],
    isLoading: isLoadingRoster,
  } = useClassEnrollments(selectedClass?.class_id);

  const semesterDisplay = activeSemester?.semester_code
    ? activeSemester.semester_code.startsWith("HK")
      ? `Semester ${activeSemester.semester_code.slice(2)}`
      : activeSemester.semester_code
    : "Semester 261";

  // Filter classes based on search
  const filteredClasses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return classes;
    return classes.filter(
      (c) =>
        c.course_code.toLowerCase().includes(q) ||
        c.course_name.toLowerCase().includes(q) ||
        c.class_group.toLowerCase().includes(q) ||
        c.class_id.toLowerCase().includes(q),
    );
  }, [classes, searchQuery]);

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              My Teaching Classes
            </h1>
            <Badge className="bg-blue-600 text-white font-medium">
              {classes.length} {classes.length === 1 ? "Section" : "Sections"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Real-time teaching classes assigned for the active academic term.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs"
          >
            <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {semesterDisplay} • Active Term
          </Badge>
        </div>
      </div>

      {/* 2. Search & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by course code, name, or group..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs bg-white"
          />
        </div>

        <div className="text-xs text-slate-500">
          Showing {filteredClasses.length} of {classes.length} classes
        </div>
      </div>

      {/* 3. Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="pt-4 border-t border-slate-100 flex justify-between">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 4. Error State */}
      {!isLoading && isError && (
        <Card className="border-rose-200 bg-rose-50/50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-600 mb-2" />
          <h3 className="text-sm font-semibold text-rose-900">
            Failed to load assigned classes
          </h3>
          <p className="mt-1 text-xs text-rose-700">
            Unable to connect to the backend server.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="mt-4 border-rose-300 text-rose-800 hover:bg-rose-100"
          >
            Retry
          </Button>
        </Card>
      )}

      {/* 5. Empty State */}
      {!isLoading && !isError && classes.length === 0 && (
        <Card className="border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            No Teaching Classes Found
          </h3>
          <p className="mt-1 max-w-sm mx-auto text-xs text-slate-500">
            No active class sections are assigned to faculty ID{" "}
            <span className="font-mono font-semibold">{lecturerId}</span> for{" "}
            {semesterDisplay}.
          </p>
        </Card>
      )}

      {/* 6. Class Cards Grid */}
      {!isLoading && !isError && classes.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {filteredClasses.map((item) => (
            <Card
              key={item.class_id}
              className="border-slate-200 bg-white shadow-xs transition-all hover:border-slate-300 hover:shadow-sm"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-slate-900 font-mono text-xs font-bold text-white">
                        {item.course_code}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700 font-mono text-xs font-semibold"
                      >
                        Group {item.class_group}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-slate-600 text-[11px]"
                      >
                        {item.credits} Credits
                      </Badge>
                    </div>
                    <CardTitle className="mt-2 text-base font-bold text-slate-900">
                      {item.course_name}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 font-mono">
                      Class ID: {item.class_id}
                    </CardDescription>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <BookOpen className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-2">
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="font-bold text-slate-900">
                      {item.total_students}
                    </span>{" "}
                    Enrolled Students
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {item.academic_year || "2026-2027"} • Term {item.term ?? 1}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-slate-700 cursor-pointer hover:bg-slate-50"
                    onClick={() => setSelectedClass(item)}
                  >
                    <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                    Student Roster
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs cursor-pointer"
                    onClick={() => setSelectedClass(item)}
                  >
                    Grade Evaluation
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 7. Class Roster Detail Slide-over / Modal */}
      {selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-700 text-white font-mono text-xs">
                    {selectedClass.course_code}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold"
                  >
                    Group {selectedClass.class_group}
                  </Badge>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedClass.class_id}
                  </span>
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {selectedClass.course_name} — Student Grade Roster
                </h2>
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedClass(null)}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/60">
                  <p className="text-[11px] font-medium text-slate-500 uppercase">
                    Total Enrolled
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {roster.length > 0 ? roster.length : selectedClass.total_students}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/60">
                  <p className="text-[11px] font-medium text-slate-500 uppercase">
                    Repeated Course
                  </p>
                  <p className="text-xl font-bold text-amber-600">
                    {roster.filter((r) => r.retaken).length}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/60">
                  <p className="text-[11px] font-medium text-slate-500 uppercase">
                    Midterm &lt; 4.0
                  </p>
                  <p className="text-xl font-bold text-rose-600">
                    {roster.filter((r) => r.giua_ky !== null && r.giua_ky < 4.0).length}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/60">
                  <p className="text-[11px] font-medium text-slate-500 uppercase">
                    Passed
                  </p>
                  <p className="text-xl font-bold text-emerald-600">
                    {roster.filter((r) => r.passed).length}
                  </p>
                </div>
              </div>

              {/* Roster Table */}
              {isLoadingRoster ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : roster.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
                  No student enrollments recorded yet for class ID{" "}
                  <span className="font-mono font-semibold">
                    {selectedClass.class_id}
                  </span>
                  .
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Student ID</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Quiz</th>
                        <th className="py-2.5 px-3">Lab</th>
                        <th className="py-2.5 px-3">Midterm</th>
                        <th className="py-2.5 px-3">Final</th>
                        <th className="py-2.5 px-3">GPA 4</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {roster.map((student) => {
                        const isAtRisk =
                          (student.giua_ky !== null && student.giua_ky < 4.0) ||
                          student.retaken;

                        return (
                          <tr
                            key={student.id}
                            className={cn(
                              "hover:bg-slate-50/80 transition-colors",
                              isAtRisk && "bg-rose-50/40",
                            )}
                          >
                            <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                              {student.student_id}
                            </td>
                            <td className="py-2 px-3">
                              {student.retaken ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]"
                                >
                                  Retaken
                                </Badge>
                              ) : (
                                <span className="text-slate-400 text-[11px]">
                                  Regular
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono">
                              {student.quiz !== null ? student.quiz : "—"}
                            </td>
                            <td className="py-2 px-3 font-mono">
                              {student.lab !== null ? student.lab : "—"}
                            </td>
                            <td className="py-2 px-3 font-mono">
                              <span
                                className={cn(
                                  student.giua_ky !== null &&
                                    student.giua_ky < 4.0 &&
                                    "font-bold text-rose-600",
                                )}
                              >
                                {student.giua_ky !== null
                                  ? student.giua_ky
                                  : "—"}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono">
                              {student.cuoi_ky !== null ? student.cuoi_ky : "—"}
                            </td>
                            <td className="py-2 px-3 font-mono font-semibold">
                              {student.gpa_4 !== null ? student.gpa_4 : "—"}
                            </td>
                            <td className="py-2 px-3">
                              {student.passed === true ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                  <CheckCircle2 className="h-3 w-3" /> Passed
                                </span>
                              ) : student.passed === false ? (
                                <span className="inline-flex items-center gap-1 text-rose-700 font-semibold text-[11px]">
                                  <AlertTriangle className="h-3 w-3" /> Failed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-500 text-[11px]">
                                  <Clock className="h-3 w-3" /> In Progress
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50 rounded-b-xl">
              <span className="text-xs text-slate-500">
                Connected to HCMUT Academic Database • Real API
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedClass(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
