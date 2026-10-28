import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/features/auth";
import {
  useLecturerCurrentClasses,
  useAllClassesEnrollments,
} from "../api/lecturer-api";
import type { Enrollment } from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Mail,
  Search,
  UserCheck,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface DerivedIntervention {
  id: string;
  studentId: string;
  classId: string;
  courseCode: string;
  riskScore: number;
  riskLevel: "CRITICAL" | "WARNING" | "RESOLVED";
  reason: string;
  suggestedAction: string;
  status: "pending" | "resolved";
  rawEnrollment: Enrollment;
}

export const LecturerInterventionsPage = () => {
  const { data: user } = useAuthUser();
  const lecturerId = user?.user_code || user?.id;

  const { data: classes = [], isLoading: isLoadingClasses } =
    useLecturerCurrentClasses(lecturerId);

  const classIds = useMemo(() => classes.map((c) => c.class_id), [classes]);
  const enrollmentsQueries = useAllClassesEnrollments(classIds);
  const isLoadingEnrollments = enrollmentsQueries.some((q) => q.isLoading);

  const allEnrollments = useMemo(() => {
    return enrollmentsQueries.flatMap((q) => q.data ?? []);
  }, [enrollmentsQueries]);

  const [activeFilter, setActiveFilter] = useState<
    "ALL" | "CRITICAL" | "WARNING" | "RESOLVED"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [advisedIds, setAdvisedIds] = useState<Set<string>>(new Set());

  // Derive interventions dynamically from real class enrollments
  const interventions: DerivedIntervention[] = useMemo(() => {
    const list: DerivedIntervention[] = [];

    for (const enr of allEnrollments) {
      const isAdvised = advisedIds.has(enr.id);

      if (isAdvised) {
        list.push({
          id: enr.id,
          studentId: enr.student_id,
          classId: enr.class_id,
          courseCode: enr.course_code,
          riskScore: 20,
          riskLevel: "RESOLVED",
          reason: "Academic advising completed. Intervention plan acknowledged.",
          suggestedAction: "Monitor final examination results and progress.",
          status: "resolved",
          rawEnrollment: enr,
        });
        continue;
      }

      // Check Critical: Midterm below 4.0
      if (enr.giua_ky !== null && enr.giua_ky < 4.0) {
        const score = Math.round((1 - enr.giua_ky / 10) * 100);
        list.push({
          id: enr.id,
          studentId: enr.student_id,
          classId: enr.class_id,
          courseCode: enr.course_code,
          riskScore: Math.max(score, 70),
          riskLevel: "CRITICAL",
          reason: `Midterm evaluation score is ${enr.giua_ky}/10 (below 4.0 passing threshold).`,
          suggestedAction:
            "Schedule 1-on-1 counseling session, review lab assignments, & assign TA tutoring.",
          status: "pending",
          rawEnrollment: enr,
        });
        continue;
      }

      // Check Warning: Repeated Course
      if (enr.retaken) {
        list.push({
          id: enr.id,
          studentId: enr.student_id,
          classId: enr.class_id,
          courseCode: enr.course_code,
          riskScore: enr.giua_ky !== null ? Math.round((1 - enr.giua_ky / 10) * 100) : 55,
          riskLevel: enr.giua_ky !== null && enr.giua_ky < 5.0 ? "CRITICAL" : "WARNING",
          reason: "Enrolled as a repeated course after previous unsuccessful completion.",
          suggestedAction:
            "Verify foundational prerequisite understanding and track continuous assessment.",
          status: "pending",
          rawEnrollment: enr,
        });
        continue;
      }

      // Check Warning: Lab performance weak
      if (enr.lab !== null && enr.lab < 4.0) {
        list.push({
          id: enr.id,
          studentId: enr.student_id,
          classId: enr.class_id,
          courseCode: enr.course_code,
          riskScore: 50,
          riskLevel: "WARNING",
          reason: `Compulsory lab exercise average is ${enr.lab}/10.`,
          suggestedAction: "Urge student to attend makeup lab sessions before cut-off deadline.",
          status: "pending",
          rawEnrollment: enr,
        });
        continue;
      }

      // Completed / Passed records
      if (enr.passed === true) {
        list.push({
          id: enr.id,
          studentId: enr.student_id,
          classId: enr.class_id,
          courseCode: enr.course_code,
          riskScore: 10,
          riskLevel: "RESOLVED",
          reason: `Course completed successfully with grade: ${enr.letter_grade ?? "Passed"}.`,
          suggestedAction: "Maintain current academic momentum.",
          status: "resolved",
          rawEnrollment: enr,
        });
      }
    }

    return list;
  }, [allEnrollments, advisedIds]);

  const filtered = useMemo(() => {
    return interventions.filter((item) => {
      const matchesFilter =
        activeFilter === "ALL" ||
        (activeFilter === "CRITICAL" && item.riskLevel === "CRITICAL") ||
        (activeFilter === "WARNING" && item.riskLevel === "WARNING") ||
        (activeFilter === "RESOLVED" && item.status === "resolved");

      const matchesSearch =
        item.studentId.includes(searchQuery.trim()) ||
        item.courseCode.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        item.classId.toLowerCase().includes(searchQuery.toLowerCase().trim());

      return matchesFilter && matchesSearch;
    });
  }, [interventions, activeFilter, searchQuery]);

  const handleAdvise = (id: string, studentId: string) => {
    setAdvisedIds((prev) => new Set([...prev, id]));
    toast.success(`Intervention recorded for student ${studentId}`);
  };

  const handleNotify = (studentId: string, courseCode: string) => {
    const subject = encodeURIComponent(`[${courseCode}] Academic Advising Notice`);
    const body = encodeURIComponent(
      `Dear Student ${studentId},\n\nI am contacting you regarding your performance in ${courseCode}. Please schedule an appointment during my office hours to discuss academic support strategies.\n\nBest regards,\nFaculty Member`,
    );
    window.open(`mailto:${studentId}@hcmut.edu.vn?subject=${subject}&body=${body}`, "_self");
  };

  const criticalCount = interventions.filter((i) => i.riskLevel === "CRITICAL").length;
  const warningCount = interventions.filter((i) => i.riskLevel === "WARNING").length;
  const resolvedCount = interventions.filter((i) => i.status === "resolved").length;

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Intervention & Early Alerts
            </h1>
            <Badge className="bg-amber-600 text-white font-medium">
              Academic Risk Radar
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Real-time flags derived from midterm scores, lab exercises, and repetition histories across your active classes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs"
          >
            {classes.length} Active Teaching Sections
          </Badge>
        </div>
      </div>

      {/* 2. Controls & Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by student ID, course code, or class ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs bg-white"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={activeFilter === "ALL" ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 rounded-md px-2.5 text-xs font-medium cursor-pointer",
              activeFilter === "ALL"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50",
            )}
            onClick={() => setActiveFilter("ALL")}
          >
            <Filter className="mr-1.5 h-3 w-3" />
            All Alerts ({interventions.length})
          </Button>

          <Button
            variant={activeFilter === "CRITICAL" ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 rounded-md px-2.5 text-xs font-medium cursor-pointer",
              activeFilter === "CRITICAL"
                ? "bg-rose-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50",
            )}
            onClick={() => setActiveFilter("CRITICAL")}
          >
            Critical Risk ({criticalCount})
          </Button>

          <Button
            variant={activeFilter === "WARNING" ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 rounded-md px-2.5 text-xs font-medium cursor-pointer",
              activeFilter === "WARNING"
                ? "bg-amber-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50",
            )}
            onClick={() => setActiveFilter("WARNING")}
          >
            Moderate ({warningCount})
          </Button>

          <Button
            variant={activeFilter === "RESOLVED" ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 rounded-md px-2.5 text-xs font-medium cursor-pointer",
              activeFilter === "RESOLVED"
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50",
            )}
            onClick={() => setActiveFilter("RESOLVED")}
          >
            Resolved ({resolvedCount})
          </Button>
        </div>
      </div>

      {/* 3. Loading State */}
      {(isLoadingClasses || isLoadingEnrollments) && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* 4. Empty State */}
      {!isLoadingClasses && !isLoadingEnrollments && filtered.length === 0 && (
        <Card className="border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            No Interventions Found
          </h3>
          <p className="mt-1 max-w-sm mx-auto text-xs text-slate-500">
            {interventions.length === 0
              ? "No critical academic risk factors detected across your current enrolled students."
              : "No alert records match the selected filter or search keyword."}
          </p>
        </Card>
      )}

      {/* 5. Intervention Cards List */}
      {!isLoadingClasses && !isLoadingEnrollments && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((item) => (
            <Card
              key={item.id}
              className={cn(
                "border-l-4 border-slate-200 bg-white shadow-xs transition-all hover:border-slate-300",
                item.riskLevel === "CRITICAL"
                  ? "border-l-rose-500"
                  : item.riskLevel === "WARNING"
                    ? "border-l-amber-500"
                    : "border-l-emerald-500",
              )}
            >
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1",
                        item.riskLevel === "CRITICAL"
                          ? "bg-rose-50 text-rose-600 ring-rose-100"
                          : item.riskLevel === "WARNING"
                            ? "bg-amber-50 text-amber-600 ring-amber-100"
                            : "bg-emerald-50 text-emerald-600 ring-emerald-100",
                      )}
                    >
                      {item.status === "resolved" ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : item.riskLevel === "CRITICAL" ? (
                        <ShieldAlert className="h-5 w-5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          Student ID: {item.studentId}
                        </span>
                        <Badge
                          variant="outline"
                          className="border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-semibold"
                        >
                          {item.courseCode}
                        </Badge>
                        <span className="font-mono text-[11px] text-slate-400">
                          {item.classId}
                        </span>
                        <Badge
                          className={cn(
                            "text-[10px] font-semibold",
                            item.riskLevel === "CRITICAL"
                              ? "bg-rose-100 text-rose-800 border-rose-200"
                              : item.riskLevel === "WARNING"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-emerald-100 text-emerald-800 border-emerald-200",
                          )}
                        >
                          Risk Score: {item.riskScore}%
                        </Badge>
                      </div>

                      <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                        {item.reason}
                      </p>

                      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-700">
                        <span className="font-semibold text-slate-900">
                          Suggested Action:{" "}
                        </span>
                        {item.suggestedAction}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400">Active HK261</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-slate-700 cursor-pointer hover:bg-slate-50"
                        onClick={() => handleNotify(item.studentId, item.courseCode)}
                      >
                        <Mail className="mr-1.5 h-3.5 w-3.5" />
                        Notify
                      </Button>
                      {item.status !== "resolved" && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs cursor-pointer"
                          onClick={() => handleAdvise(item.id, item.studentId)}
                        >
                          <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                          Advise
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
