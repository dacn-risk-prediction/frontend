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
import { cn } from "@/lib/utils";
import type {
  Course,
  Enrollment,
  StudentCurrentCourseItem,
} from "@/types";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  GitBranch,
  GraduationCap,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  useCourseDetail,
  useCurriculumDetail,
  useCurriculums,
} from "../api/student-api";

type CourseCompletionState = "passed" | "enrolled" | "failed" | "not_taken";

interface CurriculumProgressTabProps {
  studentCohort?: string | null;
  enrollments: Enrollment[];
  currentCourses: StudentCurrentCourseItem[];
  allCourses: Course[];
}

export const CurriculumProgressTab = ({
  studentCohort,
  enrollments,
  currentCourses,
  allCourses,
}: CurriculumProgressTabProps) => {
  const {
    data: curriculums = [],
    isLoading: isLoadingCurriculums,
    isError: isCurriculumsError,
    refetch: refetchCurriculums,
  } = useCurriculums();

  const [manualCurriculumId, setManualCurriculumId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | CourseCompletionState
  >("ALL");
  const [inspectedCourseCode, setInspectedCourseCode] = useState<string | null>(
    null,
  );

  const defaultCurriculumId = useMemo(() => {
    if (curriculums.length === 0) return "";
    if (studentCohort) {
      const normalized = studentCohort.trim().toUpperCase();
      const matched = curriculums.find(
        (c) => c.cohort.trim().toUpperCase() === normalized,
      );
      if (matched) return matched.curriculum_id;
    }
    return curriculums[0].curriculum_id;
  }, [curriculums, studentCohort]);

  const activeCurriculumId = manualCurriculumId || defaultCurriculumId;

  const {
    data: curriculumDetail,
    isLoading: isLoadingDetail,
    isError: isDetailError,
    refetch: refetchDetail,
  } = useCurriculumDetail(activeCurriculumId);
  const { data: inspectedCourseDetail, isLoading: isLoadingInspected } =
    useCourseDetail(inspectedCourseCode ?? undefined);

  const courseCatalogMap = useMemo(() => {
    const map = new Map<string, Course>();
    for (const c of allCourses) {
      map.set(c.course_code.toUpperCase(), c);
    }
    return map;
  }, [allCourses]);

  const courseStatusMap = useMemo(() => {
    const map = new Map<
      string,
      { status: CourseCompletionState; bestGrade: string | null }
    >();

    for (const e of enrollments) {
      const code = e.course_code.toUpperCase();
      const isPassed =
        e.passed === true ||
        (e.final_score !== null && Number(e.final_score) === 12) ||
        (e.passed !== false && e.gpa_4 !== null && e.gpa_4 >= 1.0);
      const isFailed =
        e.passed === false || (!isPassed && e.gpa_4 !== null && e.gpa_4 < 1.0);

      const prev = map.get(code);
      if (isPassed) {
        map.set(code, {
          status: "passed",
          bestGrade:
            e.final_score !== null && Number(e.final_score) === 12
              ? "Miễn"
              : e.letter_grade || prev?.bestGrade || null,
        });
      } else if (!prev && isFailed) {
        map.set(code, { status: "failed", bestGrade: e.letter_grade || "F" });
      } else if (!prev) {
        map.set(code, { status: "enrolled", bestGrade: null });
      }
    }

    for (const c of currentCourses) {
      const code = c.course_code.toUpperCase();
      const prev = map.get(code);
      if (!prev || prev.status !== "passed") {
        map.set(code, { status: "enrolled", bestGrade: null });
      }
    }

    return map;
  }, [enrollments, currentCourses]);

  const groupedBlocks = useMemo(() => {
    if (!curriculumDetail?.structures) return [];
    const blockMap = new Map<
      string,
      {
        blockId: string;
        blockName: string;
        category: string | null;
        requiredCredits: number | null;
        earnedCredits: number;
        totalCourses: number;
        passedCourses: number;
        courses: Array<{
          structureId: number;
          courseCode: string;
          courseName: string;
          credits: number;
          courseType: string | null;
          recommendedSemester: string | null;
          prerequisitesText: string | null;
          status: CourseCompletionState;
          bestGrade: string | null;
        }>;
      }
    >();

    for (const st of curriculumDetail.structures) {
      const blockId = st.block_id || "GENERAL";
      const code = (st.course_code || "").toUpperCase();
      const catalog = code ? courseCatalogMap.get(code) : undefined;
      const statusEntry = code ? courseStatusMap.get(code) : undefined;
      const status: CourseCompletionState = statusEntry?.status ?? "not_taken";
      const credits = st.credits ?? catalog?.credits ?? 0;

      const courseRow = {
        structureId: st.structure_id,
        courseCode: st.course_code || "—",
        courseName: catalog?.course_name || st.course_code || "Học phần",
        credits,
        courseType: st.course_type,
        recommendedSemester: st.recommended_semester,
        prerequisitesText: st.prerequisites,
        status,
        bestGrade: statusEntry?.bestGrade ?? null,
      };

      const existing = blockMap.get(blockId);
      if (existing) {
        existing.courses.push(courseRow);
        existing.totalCourses += 1;
        if (status === "passed") {
          existing.passedCourses += 1;
          existing.earnedCredits += credits;
        }
      } else {
        blockMap.set(blockId, {
          blockId,
          blockName: st.knowledge_block?.block_name_vi || blockId,
          category: st.knowledge_block?.category || null,
          requiredCredits: st.knowledge_block?.required_credits ?? null,
          earnedCredits: status === "passed" ? credits : 0,
          totalCourses: 1,
          passedCourses: status === "passed" ? 1 : 0,
          courses: [courseRow],
        });
      }
    }

    return Array.from(blockMap.values());
  }, [curriculumDetail, courseCatalogMap, courseStatusMap]);

  const filteredBlocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return groupedBlocks
      .map((block) => {
        const matchingCourses = block.courses.filter((c) => {
          if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
          if (q) {
            return (
              c.courseCode.toLowerCase().includes(q) ||
              c.courseName.toLowerCase().includes(q) ||
              (c.prerequisitesText?.toLowerCase().includes(q) ?? false)
            );
          }
          return true;
        });
        if (matchingCourses.length === 0) return null;
        return { ...block, courses: matchingCourses };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  }, [groupedBlocks, searchQuery, statusFilter]);

  const totalCurriculumStats = useMemo(() => {
    let passed = 0;
    let enrolled = 0;
    let failed = 0;
    let notTaken = 0;
    for (const block of groupedBlocks) {
      for (const c of block.courses) {
        if (c.status === "passed") passed += 1;
        else if (c.status === "enrolled") enrolled += 1;
        else if (c.status === "failed") failed += 1;
        else notTaken += 1;
      }
    }
    return {
      passed,
      enrolled,
      failed,
      notTaken,
      total: passed + enrolled + failed + notTaken,
    };
  }, [groupedBlocks]);

  const hasError = isCurriculumsError || isDetailError;

  return (
    <div className="space-y-5">
      {hasError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle
              className="h-4 w-4 shrink-0 text-rose-600"
              aria-hidden="true"
            />
            <span>Không thể tải khung chương trình đào tạo. Vui lòng thử lại.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isCurriculumsError) void refetchCurriculums();
              if (isDetailError) void refetchDetail();
            }}
            className="h-8 w-fit cursor-pointer gap-1.5 border-rose-200 bg-white text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      {/* Curriculum Selector & Filter Header */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <GraduationCap
                  className="h-4.5 w-4.5 text-primary"
                  aria-hidden="true"
                />
                Khung chương trình đào tạo &amp; Môn tiên quyết
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs text-slate-500">
                Đối chiếu bảng điểm đã tích lũy với từng khối kiến thức và tra
                cứu điều kiện học trước / song hành.
              </CardDescription>
            </div>

            {curriculums.length > 0 && (
              <select
                aria-label="Chọn khung chương trình đào tạo"
                value={activeCurriculumId}
                onChange={(e) => setManualCurriculumId(e.target.value)}
                className="h-8 rounded-lg border border-input bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              >
                {curriculums.map((c) => (
                  <option key={c.curriculum_id} value={c.curriculum_id}>
                    {c.curriculum_id} — {c.curriculum_name} ({c.cohort})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Summary Strip + Filters */}
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              {(
                [
                  { id: "ALL", label: `Tất cả (${totalCurriculumStats.total})` },
                  {
                    id: "passed",
                    label: `Đã đạt (${totalCurriculumStats.passed})`,
                  },
                  {
                    id: "enrolled",
                    label: `Đang học (${totalCurriculumStats.enrolled})`,
                  },
                  {
                    id: "failed",
                    label: `Chưa đạt (${totalCurriculumStats.failed})`,
                  },
                  {
                    id: "not_taken",
                    label: `Chưa học (${totalCurriculumStats.notTaken})`,
                  },
                ] as const
              ).map((pill) => (
                <Button
                  key={pill.id}
                  variant={statusFilter === pill.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(pill.id)}
                  className={cn(
                    "h-8 cursor-pointer rounded-lg px-3 text-xs font-semibold",
                    statusFilter === pill.id
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {pill.label}
                </Button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute top-2 left-2.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã môn, tên môn, tiên quyết..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        {/* Inline Course Prerequisites Inspector (Hairline strip, not nested card) */}
        {inspectedCourseCode && (
          <div className="border-b border-slate-200 bg-sidebar-accent/50 px-5 py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitBranch
                  className="h-4 w-4 shrink-0 text-sidebar-accent-foreground"
                  aria-hidden="true"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Điều kiện tiên quyết / song hành — {inspectedCourseCode}
                    {inspectedCourseDetail?.course_name
                      ? ` (${inspectedCourseDetail.course_name})`
                      : ""}
                  </h4>
                  <p className="text-xs text-slate-600">
                    Kiểm tra tự động tình trạng hoàn thành các học phần điều kiện.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng bảng kiểm tra tiên quyết"
                onClick={() => setInspectedCourseCode(null)}
                className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-900"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3">
              {isLoadingInspected ? (
                <Skeleton className="h-10 w-full rounded-lg" />
              ) : !inspectedCourseDetail ||
                inspectedCourseDetail.prerequisites.length === 0 ? (
                <p className="text-xs text-slate-600">
                  Môn học này không có điều kiện tiên quyết ràng buộc trong danh
                  mục học phần.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {inspectedCourseDetail.prerequisites.map((pr) => {
                    const relCode = pr.related_course_code.toUpperCase();
                    const relStatus = courseStatusMap.get(relCode)?.status;
                    const relMeta = courseCatalogMap.get(relCode);
                    const isMet =
                      relStatus === "passed" ||
                      (pr.relation_type === "COREQ" && relStatus === "enrolled");

                    return (
                      <div
                        key={pr.course_prerequisite_id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                          isMet
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-amber-200 bg-white text-slate-800",
                        )}
                      >
                        {isMet ? (
                          <CheckCircle2
                            className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                            aria-hidden="true"
                          />
                        ) : (
                          <Clock
                            className="h-3.5 w-3.5 shrink-0 text-amber-600"
                            aria-hidden="true"
                          />
                        )}
                        <span className="font-mono font-bold">{relCode}</span>
                        {relMeta && (
                          <span className="text-slate-600">
                            {relMeta.course_name}
                          </span>
                        )}
                        <span className="text-slate-500">
                          ·{" "}
                          {pr.relation_type === "COREQ"
                            ? "Song hành"
                            : "Tiên quyết"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <CardContent className="divide-y divide-slate-200 p-0">
          {isLoadingCurriculums || isLoadingDetail ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredBlocks.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen
                className="mx-auto h-8 w-8 text-slate-300"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Không có học phần nào khớp bộ lọc
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Thử chọn trạng thái &ldquo;Tất cả&rdquo; hoặc xóa từ khóa tìm
                kiếm.
              </p>
            </div>
          ) : (
            filteredBlocks.map((block) => {
              const blockPercent =
                block.requiredCredits && block.requiredCredits > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (block.earnedCredits / block.requiredCredits) * 100,
                      ),
                    )
                  : block.totalCourses > 0
                    ? Math.round((block.passedCourses / block.totalCourses) * 100)
                    : 0;

              return (
                <section key={block.blockId}>
                  {/* Knowledge Block Header */}
                  <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {block.blockName}
                        </h3>
                        {block.category && (
                          <span className="text-xs font-medium text-slate-500">
                            · {block.category}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                        Hoàn thành {block.passedCourses}/{block.totalCourses} môn
                        trong khối kiến thức
                      </p>
                    </div>

                    <div className="flex items-center gap-3 sm:w-64">
                      <div className="flex-1">
                        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700 tabular-nums">
                          <span>Tiến độ khối</span>
                          <span className="font-mono">
                            {block.earnedCredits}
                            {block.requiredCredits !== null
                              ? ` / ${block.requiredCredits} TC`
                              : " TC"}
                          </span>
                        </div>
                        <Progress
                          value={blockPercent}
                          className="h-1.5 bg-slate-200 **:data-[slot=progress-indicator]:bg-primary"
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-xs font-bold text-sidebar-accent-foreground tabular-nums">
                        {blockPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Courses Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-white text-xs font-semibold text-slate-500">
                        <tr>
                          <th className="px-5 py-2.5">Mã môn</th>
                          <th className="px-4 py-2.5">Tên học phần</th>
                          <th className="px-4 py-2.5">TC</th>
                          <th className="px-4 py-2.5">HK đề xuất</th>
                          <th className="px-4 py-2.5">Tiên quyết</th>
                          <th className="px-5 py-2.5">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {block.courses.map((course) => (
                          <tr
                            key={course.structureId}
                            className="transition-colors hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-3 font-mono font-bold text-slate-900 tabular-nums">
                              {course.courseCode}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              <span>{course.courseName}</span>
                              {course.courseType && (
                                <span className="ml-1.5 text-xs text-slate-500">
                                  · {course.courseType}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-700 tabular-nums">
                              {course.credits}
                            </td>
                            <td className="px-4 py-3 text-slate-600 tabular-nums">
                              {course.recommendedSemester || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {course.prerequisitesText && (
                                  <span className="font-mono text-xs text-slate-600">
                                    {course.prerequisitesText}
                                  </span>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setInspectedCourseCode(course.courseCode)
                                  }
                                  className="h-7 cursor-pointer px-2 text-xs font-semibold text-primary hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                >
                                  <GitBranch
                                    className="mr-1 h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  Kiểm tra
                                </Button>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              {course.status === "passed" && (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700"
                                >
                                  <CheckCircle2
                                    className="mr-1 h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  Đã đạt
                                  {course.bestGrade
                                    ? ` (${course.bestGrade})`
                                    : ""}
                                </Badge>
                              )}
                              {course.status === "enrolled" && (
                                <Badge
                                  variant="outline"
                                  className="border-blue-200 bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground"
                                >
                                  <Clock
                                    className="mr-1 h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  Đang học
                                </Badge>
                              )}
                              {course.status === "failed" && (
                                <Badge
                                  variant="outline"
                                  className="border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700"
                                >
                                  <XCircle
                                    className="mr-1 h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  Chưa đạt
                                </Badge>
                              )}
                              {course.status === "not_taken" && (
                                <Badge
                                  variant="outline"
                                  className="border-slate-200 bg-slate-50 text-xs font-medium text-slate-600"
                                >
                                  Chưa học
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};
