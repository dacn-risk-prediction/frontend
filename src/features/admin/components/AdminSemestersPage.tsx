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
import type { Semester } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  useAdminSemesters,
  useCreateSemester,
  useDeleteSemester,
  useSwitchActiveSemester,
  useUpdateSemester,
} from "../api/admin-api";
import {
  semesterFormSchema,
  type SemesterFormValues,
} from "../schemas/admin-schemas";

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoOrNull(localVal?: string): string | null {
  if (!localVal || !localVal.trim()) return null;
  const d = new Date(localVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

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

export const AdminSemestersPage = () => {
  const { data: semesters = [], isLoading } = useAdminSemesters();
  const createSemesterMutation = useCreateSemester();
  const updateSemesterMutation = useUpdateSemester();
  const deleteSemesterMutation = useDeleteSemester();
  const switchActiveMutation = useSwitchActiveSemester();

  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<Semester | null>(null);
  const [deletingSemester, setDeletingSemester] = useState<Semester | null>(null);
  const [nowTimestamp] = useState(() => Date.now());

  const form = useForm<SemesterFormValues>({
    resolver: zodResolver(semesterFormSchema),
    defaultValues: {
      semester_code: "",
      academic_year: "2026-2027",
      term: 1,
      is_active: false,
      withdraw_deadline: "",
    },
  });

  const openCreateModal = () => {
    setSelectedSemester(null);
    form.reset({
      semester_code: "",
      academic_year: "2026-2027",
      term: 1,
      is_active: false,
      withdraw_deadline: "",
    });
    setModalMode("create");
  };

  const openEditModal = (sem: Semester) => {
    setSelectedSemester(sem);
    form.reset({
      semester_code: sem.semester_code,
      academic_year: sem.academic_year,
      term: sem.term,
      is_active: Boolean(sem.is_active),
      withdraw_deadline: toDatetimeLocalValue(sem.withdraw_deadline),
    });
    setModalMode("edit");
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const deadlineIso = toIsoOrNull(values.withdraw_deadline);
    try {
      if (modalMode === "create") {
        await createSemesterMutation.mutateAsync({
          semester_code: values.semester_code,
          academic_year: values.academic_year,
          term: values.term,
          is_active: values.is_active,
          withdraw_deadline: deadlineIso,
        });
        toast.success(`Đã thêm học kỳ ${values.semester_code}.`);
      } else if (modalMode === "edit" && selectedSemester) {
        await updateSemesterMutation.mutateAsync({
          semesterCode: selectedSemester.semester_code,
          payload: {
            academic_year: values.academic_year,
            term: values.term,
            is_active: selectedSemester.is_active ? true : values.is_active,
            withdraw_deadline: deadlineIso,
          },
        });
        toast.success(`Đã cập nhật học kỳ ${selectedSemester.semester_code}.`);
      }
      setModalMode(null);
    } catch (err) {
      toast.error(extractApiError(err, "Không thể lưu thông tin học kỳ."));
    }
  });

  const handleSetActive = async (sem: Semester) => {
    try {
      await switchActiveMutation.mutateAsync(sem.semester_code);
      toast.success(`Đã chuyển học kỳ hiện hành sang ${sem.semester_code}.`);
    } catch (err) {
      toast.error(extractApiError(err, "Không thể chuyển học kỳ hiện hành."));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSemester) return;
    try {
      await deleteSemesterMutation.mutateAsync(deletingSemester.semester_code);
      toast.success(`Đã xóa học kỳ ${deletingSemester.semester_code}.`);
      setDeletingSemester(null);
    } catch (err) {
      toast.error(extractApiError(err, "Không thể xóa học kỳ này."));
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Quản lý Học kỳ &amp; Hạn Rút môn
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Quản lý danh sách học kỳ, chuyển học kỳ hiện hành và thiết lập thời hạn rút môn học.
          </p>
        </div>

        <Button
          size="sm"
          onClick={openCreateModal}
          className="cursor-pointer gap-1.5 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>Thêm học kỳ mới</span>
        </Button>
      </div>

      {/* Semesters List Card */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Calendar className="h-4.5 w-4.5 text-blue-600" />
            Danh sách Học kỳ ({semesters.length})
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Chỉ nên duy trì 1 học kỳ ở trạng thái Hiện hành để toàn bộ dashboard SV/GV đồng bộ chính xác.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : semesters.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Chưa có học kỳ nào trong hệ thống.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Mã học kỳ</th>
                    <th className="px-4 py-3">Năm học</th>
                    <th className="px-4 py-3">Đợt / Kỳ</th>
                    <th className="px-4 py-3">Hạn rút môn</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {semesters.map((sem) => {
                    const deadlineDate = sem.withdraw_deadline
                      ? new Date(sem.withdraw_deadline)
                      : null;
                    const isDeadlineValid =
                      deadlineDate !== null && !Number.isNaN(deadlineDate.getTime());
                    const isExpired =
                      isDeadlineValid && deadlineDate.getTime() < nowTimestamp;

                    return (
                      <tr
                        key={sem.semester_code}
                        className={cn(
                          "transition-colors hover:bg-slate-50/70",
                          sem.is_active && "bg-blue-50/30",
                        )}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">
                          {sem.semester_code}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          {sem.academic_year}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          Học kỳ {sem.term}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {isDeadlineValid ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 font-mono text-slate-800">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                {deadlineDate.toLocaleString("vi-VN")}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-semibold",
                                  isExpired
                                    ? "border-slate-200 bg-slate-100 text-slate-600"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                                )}
                              >
                                {isExpired ? "Đã hết hạn" : "Còn hạn rút"}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Chưa thiết lập</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sem.is_active ? (
                            <Badge className="bg-emerald-600 text-[11px] font-semibold text-white">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Đang hoạt động
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-slate-200 bg-slate-50 text-[11px] text-slate-500"
                            >
                              Đã lưu trữ
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {!sem.is_active && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={switchActiveMutation.isPending}
                                onClick={() => void handleSetActive(sem)}
                                className="h-7 cursor-pointer border-blue-200 bg-blue-50/50 px-2.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                Đặt hiện hành
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(sem)}
                              className="h-7 cursor-pointer px-2 text-xs text-slate-600 hover:text-blue-700"
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Sửa
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={Boolean(sem.is_active)}
                              onClick={() => setDeletingSemester(sem)}
                              className="h-7 cursor-pointer px-2 text-xs text-slate-500 hover:text-rose-600 disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {modalMode === "create"
                  ? "Thêm học kỳ mới"
                  : `Cập nhật học kỳ ${selectedSemester?.semester_code}`}
              </h2>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Mã học kỳ *</Label>
                  <Input
                    {...form.register("semester_code")}
                    disabled={modalMode === "edit"}
                    placeholder="VD: HK262"
                    className="h-9 text-xs"
                  />
                  {form.formState.errors.semester_code && (
                    <p className="text-[11px] text-rose-600">
                      {form.formState.errors.semester_code.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Năm học *</Label>
                  <Input
                    {...form.register("academic_year")}
                    placeholder="2026-2027"
                    className="h-9 text-xs"
                  />
                  {form.formState.errors.academic_year && (
                    <p className="text-[11px] text-rose-600">
                      {form.formState.errors.academic_year.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Đợt học kỳ (1–4) *</Label>
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    {...form.register("term", { valueAsNumber: true })}
                    className="h-9 text-xs"
                  />
                  {form.formState.errors.term && (
                    <p className="text-[11px] text-rose-600">
                      {form.formState.errors.term.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Hạn rút môn học
                  </Label>
                  <Input
                    type="datetime-local"
                    {...form.register("withdraw_deadline")}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <label
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700",
                  modalMode === "edit" && selectedSemester?.is_active
                    ? "opacity-70 cursor-not-allowed"
                    : "cursor-pointer",
                )}
              >
                <input
                  type="checkbox"
                  disabled={modalMode === "edit" && Boolean(selectedSemester?.is_active)}
                  {...form.register("is_active")}
                  className="h-4 w-4 accent-blue-600"
                />
                <span>
                  {modalMode === "edit" && selectedSemester?.is_active
                    ? "Đang là học kỳ hiện hành (hãy chọn học kỳ khác làm hiện hành để thay thế)"
                    : "Đặt làm học kỳ hiện hành"}
                </span>
              </label>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalMode(null)}
                  className="cursor-pointer text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    createSemesterMutation.isPending ||
                    updateSemesterMutation.isPending
                  }
                  className="cursor-pointer bg-blue-600 text-xs text-white hover:bg-blue-700"
                >
                  Lưu học kỳ
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingSemester && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">Xác nhận xóa học kỳ</h2>
            <p className="mt-2 text-xs text-slate-600">
              Bạn có chắc chắn muốn xóa học kỳ{" "}
              <strong className="text-slate-900">{deletingSemester.semester_code}</strong>?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingSemester(null)}
                className="cursor-pointer text-xs"
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteSemesterMutation.isPending}
                onClick={() => void handleConfirmDelete()}
                className="cursor-pointer text-xs"
              >
                Xóa học kỳ
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
