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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AcademicClass, Course } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BookOpen,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useAdminClasses,
  useAdminCourses,
  useAdminCurriculumDetail,
  useAdminCurriculums,
  useAdminLecturers,
  useAdminSemesters,
  useCreateClass,
  useCreateCourse,
  useDeleteClass,
  useDeleteCourse,
  useUpdateClass,
  useUpdateCourse,
} from "../api/admin-api";
import {
  classFormSchema,
  courseFormSchema,
  type ClassFormValues,
  type CourseFormValues,
} from "../schemas/admin-schemas";

type AcademicsTab = "courses" | "classes" | "curriculums";

function extractApiError(err: unknown, fallback: string): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { detail?: unknown } } }).response
      ?.data?.detail === "string"
  ) {
    return (err as { response: { data: { detail: string } } }).response.data
      .detail;
  }
  return fallback;
}

export const AdminAcademicsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: AcademicsTab =
    tabParam === "classes" || tabParam === "curriculums" ? tabParam : "courses";

  const [courseSearch, setCourseSearch] = useState("");
  const [classSemester, setClassSemester] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string>("");

  // Full catalog query kept independent from Tab 1's courseSearch so Tabs 2 & 3 never lose names/options
  const { data: allCourses = [] } = useAdminCourses();
  const { data: courses = [], isLoading: isLoadingCourses } =
    useAdminCourses(courseSearch);
  const { data: semesters = [] } = useAdminSemesters();
  const { data: lecturers = [] } = useAdminLecturers();
  const { data: classes = [], isLoading: isLoadingClasses } = useAdminClasses({
    semester_code: classSemester || undefined,
    search: classSearch || undefined,
  });
  const { data: curriculums = [], isLoading: isLoadingCurriculums } =
    useAdminCurriculums();

  const effectiveCurriculumId =
    selectedCurriculumId || curriculums[0]?.curriculum_id || "";
  const { data: curriculumDetail, isLoading: isLoadingCurriculumDetail } =
    useAdminCurriculumDetail(effectiveCurriculumId);

  const createCourseMutation = useCreateCourse();
  const updateCourseMutation = useUpdateCourse();
  const deleteCourseMutation = useDeleteCourse();
  const createClassMutation = useCreateClass();
  const updateClassMutation = useUpdateClass();
  const deleteClassMutation = useDeleteClass();

  // Course modal state
  const [courseModal, setCourseModal] = useState<"create" | "edit" | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);

  // Class modal state
  const [classModal, setClassModal] = useState<"create" | "edit" | null>(null);
  const [editingClass, setEditingClass] = useState<AcademicClass | null>(null);
  const [deletingClass, setDeletingClass] = useState<AcademicClass | null>(null);

  const courseForm = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: { course_code: "", course_name: "", credits: 3 },
  });

  const classForm = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      class_id: "",
      class_group: "L01",
      course_code: "",
      semester_code: "",
      lecturer_id: "",
    },
  });

  const handleTabChange = (tab: AcademicsTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  const courseNameMap = useMemo(() => {
    const map = new Map<string, Course>();
    for (const c of allCourses) map.set(c.course_code, c);
    return map;
  }, [allCourses]);

  // Group curriculum structures by knowledge block
  const groupedCurriculumBlocks = useMemo(() => {
    if (!curriculumDetail?.structures) return [];
    const map = new Map<
      string,
      {
        blockId: string;
        blockName: string;
        category: string | null;
        requiredCredits: number | null;
        items: typeof curriculumDetail.structures;
      }
    >();
    for (const st of curriculumDetail.structures) {
      const key = st.block_id || "OTHER";
      const existing = map.get(key);
      if (existing) {
        existing.items.push(st);
      } else {
        map.set(key, {
          blockId: key,
          blockName: st.knowledge_block?.block_name_vi || key,
          category: st.knowledge_block?.category || null,
          requiredCredits: st.knowledge_block?.required_credits ?? null,
          items: [st],
        });
      }
    }
    return Array.from(map.values());
  }, [curriculumDetail]);

  const handleCourseSubmit = courseForm.handleSubmit(async (values) => {
    try {
      if (courseModal === "create") {
        await createCourseMutation.mutateAsync(values);
        toast.success(`Đã thêm môn học ${values.course_code}.`);
      } else if (courseModal === "edit" && editingCourse) {
        await updateCourseMutation.mutateAsync({
          courseCode: editingCourse.course_code,
          payload: {
            course_name: values.course_name,
            credits: values.credits,
          },
        });
        toast.success(`Đã cập nhật môn học ${editingCourse.course_code}.`);
      }
      setCourseModal(null);
    } catch (err) {
      toast.error(extractApiError(err, "Không thể lưu môn học."));
    }
  });

  const handleClassSubmit = classForm.handleSubmit(async (values) => {
    try {
      if (classModal === "create") {
        await createClassMutation.mutateAsync({
          class_id: values.class_id,
          class_group: values.class_group,
          course_code: values.course_code,
          semester_code: values.semester_code,
          lecturer_id: values.lecturer_id?.trim() || null,
        });
        toast.success(`Đã mở lớp học phần ${values.class_id}.`);
      } else if (classModal === "edit" && editingClass) {
        await updateClassMutation.mutateAsync({
          classId: editingClass.class_id,
          payload: {
            class_group: values.class_group,
            course_code: values.course_code,
            semester_code: values.semester_code,
            lecturer_id: values.lecturer_id?.trim() || null,
          },
        });
        toast.success(`Đã cập nhật lớp học phần ${editingClass.class_id}.`);
      }
      classForm.reset();
      setClassModal(null);
      setEditingClass(null);
    } catch (err) {
      toast.error(extractApiError(err, "Không thể lưu lớp học phần."));
    }
  });

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Danh mục Học vụ &amp; Khung CTĐT
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Quản lý môn học, lớp học phần theo học kỳ và tra cứu cấu trúc Chương trình Đào tạo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "courses" && (
            <Button
              size="sm"
              onClick={() => {
                setEditingCourse(null);
                courseForm.reset({ course_code: "", course_name: "", credits: 3 });
                setCourseModal("create");
              }}
              className="cursor-pointer gap-1.5 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm môn học</span>
            </Button>
          )}
          {activeTab === "classes" && (
            <Button
              size="sm"
              onClick={() => {
                setEditingClass(null);
                classForm.reset({
                  class_id: "",
                  class_group: "L01",
                  course_code: allCourses[0]?.course_code || "",
                  semester_code:
                    semesters.find((s) => s.is_active)?.semester_code ||
                    semesters[0]?.semester_code ||
                    "",
                  lecturer_id: lecturers[0]?.lecturer_id || "",
                });
                setClassModal("create");
              }}
              className="cursor-pointer gap-1.5 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>Mở lớp học phần</span>
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(
          [
            { id: "courses", label: `Môn học (${courses.length})`, icon: BookOpen },
            { id: "classes", label: `Lớp học phần (${classes.length})`, icon: Layers },
            {
              id: "curriculums",
              label: `Khung CTĐT (${curriculums.length})`,
              icon: GraduationCap,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer",
                isActive
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: COURSES */}
      {activeTab === "courses" && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Danh mục Môn học
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Mã học phần, tên môn và số tín chỉ chuẩn
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="Tìm mã môn hoặc tên môn..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoadingCourses ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-140 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Mã môn</th>
                      <th className="px-4 py-3">Tên học phần</th>
                      <th className="px-4 py-3">Tín chỉ</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {courses.map((course) => (
                      <tr key={course.course_code} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-900">
                          {course.course_code}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium text-slate-800">
                          {course.course_name}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="secondary"
                            className="bg-blue-50 text-[11px] font-semibold text-blue-700"
                          >
                            {course.credits} TC
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingCourse(course);
                              courseForm.reset({
                                course_code: course.course_code,
                                course_name: course.course_name,
                                credits: course.credits,
                              });
                              setCourseModal("edit");
                            }}
                            className="h-7 cursor-pointer px-2 text-xs text-slate-600 hover:text-blue-700"
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Sửa
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingCourse(course)}
                            className="h-7 cursor-pointer px-2 text-xs text-slate-500 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: ACADEMIC CLASSES */}
      {activeTab === "classes" && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Danh sách Lớp Học phần
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Lọc theo học kỳ và mã lớp để rà soát phân công giảng viên
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={classSemester}
                onChange={(e) => setClassSemester(e.target.value)}
                className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700"
              >
                <option value="">Tất cả học kỳ</option>
                {semesters.map((s) => (
                  <option key={s.semester_code} value={s.semester_code}>
                    {s.semester_code} ({s.academic_year})
                  </option>
                ))}
              </select>
              <div className="relative w-52">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  placeholder="Tìm mã lớp, nhóm..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoadingClasses ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : classes.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Không có lớp học phần phù hợp với bộ lọc.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-140 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Mã lớp</th>
                      <th className="px-4 py-3">Nhóm</th>
                      <th className="px-4 py-3">Môn học</th>
                      <th className="px-4 py-3">Học kỳ</th>
                      <th className="px-4 py-3">Mã Giảng viên</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classes.map((cls) => (
                      <tr key={cls.class_id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-900">
                          {cls.class_id}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">
                          {cls.class_group}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-800">
                          <span className="font-mono font-semibold">
                            {cls.course_code || "—"}
                          </span>
                          {cls.course_code && courseNameMap.get(cls.course_code) && (
                            <span className="ml-1.5 text-slate-500">
                              — {courseNameMap.get(cls.course_code)?.course_name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                          {cls.semester_code || "—"}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                          {cls.lecturer_id || "Chưa phân công"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingClass(cls);
                              classForm.reset({
                                class_id: cls.class_id,
                                class_group: cls.class_group,
                                course_code: cls.course_code || "",
                                semester_code: cls.semester_code || "",
                                lecturer_id: cls.lecturer_id || "",
                              });
                              setClassModal("edit");
                            }}
                            className="h-7 cursor-pointer px-2 text-xs text-slate-600 hover:text-blue-700"
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Sửa
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingClass(cls)}
                            className="h-7 cursor-pointer px-2 text-xs text-slate-500 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: CURRICULUMS */}
      {activeTab === "curriculums" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="border-slate-200 bg-white shadow-xs lg:col-span-4">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Danh sách Khung CTĐT
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Chọn một chương trình để xem khối kiến thức
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {isLoadingCurriculums ? (
                <Skeleton className="h-24 w-full rounded-xl" />
              ) : curriculums.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  Chưa có khung CTĐT nào.
                </p>
              ) : (
                curriculums.map((cur) => {
                  const isSelected = cur.curriculum_id === effectiveCurriculumId;
                  return (
                    <button
                      key={cur.curriculum_id}
                      type="button"
                      onClick={() => setSelectedCurriculumId(cur.curriculum_id)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition-all cursor-pointer",
                        isSelected
                          ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {cur.curriculum_id}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold"
                        >
                          {cur.cohort}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-800">
                        {cur.curriculum_name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {cur.major_name} • {cur.total_credits ?? 128} tín chỉ
                      </p>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-xs lg:col-span-8">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base font-bold text-slate-900">
                {curriculumDetail?.curriculum_name || "Chi tiết Khung Chương trình"}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {curriculumDetail
                  ? `${curriculumDetail.major_name} • Khóa ${curriculumDetail.cohort} • Tổng ${curriculumDetail.total_credits ?? 128} tín chỉ • ${curriculumDetail.structures.length} học phần cấu thành`
                  : "Đang tải chi tiết cấu trúc chương trình..."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {isLoadingCurriculumDetail ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              ) : groupedCurriculumBlocks.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  Khung CTĐT này chưa có phân bổ học phần.
                </p>
              ) : (
                groupedCurriculumBlocks.map((block) => (
                  <div
                    key={block.blockId}
                    className="overflow-hidden rounded-xl border border-slate-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {block.blockName}
                        </p>
                        {block.category && (
                          <p className="text-[11px] text-slate-500">
                            Phân loại: {block.category}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-white text-[11px] font-semibold text-blue-700 border-blue-200"
                      >
                        {block.items.length} môn
                        {block.requiredCredits !== null
                          ? ` • Yêu cầu ${block.requiredCredits} TC`
                          : ""}
                      </Badge>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {block.items.map((item) => {
                        const meta = item.course_code
                          ? courseNameMap.get(item.course_code)
                          : undefined;
                        return (
                          <div
                            key={item.structure_id}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-slate-900">
                                {item.course_code || "—"}
                              </span>
                              <span className="truncate text-slate-700">
                                {meta?.course_name || item.course_code || ""}
                              </span>
                              {item.course_type && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {item.course_type}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500">
                              {item.recommended_semester && (
                                <span>Đề xuất: {item.recommended_semester}</span>
                              )}
                              <span className="font-semibold text-slate-800">
                                {item.credits ?? meta?.credits ?? 0} TC
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Course Create / Edit Modal */}
      {courseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {courseModal === "create"
                  ? "Thêm môn học mới"
                  : `Sửa môn ${editingCourse?.course_code}`}
              </h2>
              <button
                type="button"
                onClick={() => setCourseModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCourseSubmit} className="mt-4 space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Mã môn học *</Label>
                <Input
                  {...courseForm.register("course_code")}
                  disabled={courseModal === "edit"}
                  placeholder="CO3041"
                  className="h-9 text-xs"
                />
                {courseForm.formState.errors.course_code && (
                  <p className="text-[11px] text-rose-600">
                    {courseForm.formState.errors.course_code.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tên học phần *</Label>
                <Input
                  {...courseForm.register("course_name")}
                  placeholder="Công nghệ Phần mềm"
                  className="h-9 text-xs"
                />
                {courseForm.formState.errors.course_name && (
                  <p className="text-[11px] text-rose-600">
                    {courseForm.formState.errors.course_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Số tín chỉ *</Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  {...courseForm.register("credits", { valueAsNumber: true })}
                  className="h-9 text-xs"
                />
                {courseForm.formState.errors.credits && (
                  <p className="text-[11px] text-rose-600">
                    {courseForm.formState.errors.credits.message}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCourseModal(null)}
                  className="cursor-pointer text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    createCourseMutation.isPending || updateCourseMutation.isPending
                  }
                  className="cursor-pointer bg-blue-600 text-xs text-white hover:bg-blue-700"
                >
                  Lưu môn học
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Class Create / Edit Modal */}
      {classModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {classModal === "create"
                  ? "Mở lớp học phần mới"
                  : `Cập nhật lớp ${editingClass?.class_id}`}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setClassModal(null);
                  setEditingClass(null);
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleClassSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Mã lớp *</Label>
                  <Input
                    {...classForm.register("class_id")}
                    disabled={classModal === "edit"}
                    placeholder="HK261_CO3041_L01"
                    className="h-9 text-xs"
                  />
                  {classForm.formState.errors.class_id && (
                    <p className="text-[11px] text-rose-600">
                      {classForm.formState.errors.class_id.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nhóm lớp *</Label>
                  <Input
                    {...classForm.register("class_group")}
                    placeholder="L01"
                    className="h-9 text-xs"
                  />
                  {classForm.formState.errors.class_group && (
                    <p className="text-[11px] text-rose-600">
                      {classForm.formState.errors.class_group.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Mã môn học *</Label>
                  <select
                    {...classForm.register("course_code")}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                  >
                    {allCourses.map((c) => (
                      <option key={c.course_code} value={c.course_code}>
                        {c.course_code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Học kỳ *</Label>
                  <select
                    {...classForm.register("semester_code")}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                  >
                    {semesters.map((s) => (
                      <option key={s.semester_code} value={s.semester_code}>
                        {s.semester_code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Giảng viên phụ trách</Label>
                <select
                  {...classForm.register("lecturer_id")}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value="">— Chưa phân công —</option>
                  {lecturers.map((l) => (
                    <option key={l.lecturer_id} value={l.lecturer_id}>
                      {l.lecturer_id} ({l.departments})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setClassModal(null);
                    setEditingClass(null);
                  }}
                  className="cursor-pointer text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    createClassMutation.isPending || updateClassMutation.isPending
                  }
                  className="cursor-pointer bg-blue-600 text-xs text-white hover:bg-blue-700"
                >
                  {classModal === "create" ? "Tạo lớp" : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Course / Class Modals */}
      {deletingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">Xác nhận xóa môn học</h2>
            <p className="mt-2 text-xs text-slate-600">
              Bạn muốn xóa môn{" "}
              <strong className="text-slate-900">
                {deletingCourse.course_code} — {deletingCourse.course_name}
              </strong>
              ?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingCourse(null)}
                className="cursor-pointer text-xs"
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteCourseMutation.isPending}
                onClick={async () => {
                  try {
                    await deleteCourseMutation.mutateAsync(deletingCourse.course_code);
                    toast.success(`Đã xóa môn ${deletingCourse.course_code}.`);
                    setDeletingCourse(null);
                  } catch (err) {
                    toast.error(extractApiError(err, "Không thể xóa môn học."));
                  }
                }}
                className="cursor-pointer text-xs"
              >
                Xóa môn
              </Button>
            </div>
          </div>
        </div>
      )}

      {deletingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">
              Xác nhận xóa lớp học phần
            </h2>
            <p className="mt-2 text-xs text-slate-600">
              Bạn muốn xóa lớp{" "}
              <strong className="text-slate-900">{deletingClass.class_id}</strong>?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingClass(null)}
                className="cursor-pointer text-xs"
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteClassMutation.isPending}
                onClick={async () => {
                  try {
                    await deleteClassMutation.mutateAsync(deletingClass.class_id);
                    toast.success(`Đã xóa lớp ${deletingClass.class_id}.`);
                    setDeletingClass(null);
                  } catch (err) {
                    toast.error(extractApiError(err, "Không thể xóa lớp học phần."));
                  }
                }}
                className="cursor-pointer text-xs"
              >
                Xóa lớp
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
