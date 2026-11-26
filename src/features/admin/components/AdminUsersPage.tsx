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
import { extractApiError } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { User, UserRole } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { flexRender, type SortingState } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import {
  AlertCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuthUser } from "@/features/auth";
import {
  useAdminUsers,
  useCreateAdminProfile,
  useCreateLecturerProfile,
  useCreateStudentProfile,
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
} from "../api/admin-api";
import {
  userCreateSchema,
  userEditSchema,
  type UserCreateFormValues,
  type UserEditFormValues,
} from "../schemas/admin-schemas";

const PAGE_SIZE = 20;

const ROLE_LABELS: Record<UserRole, string> = {
  student: "Sinh viên",
  lecturer: "Giảng viên",
  admin: "Quản trị viên",
};

export const AdminUsersPage = () => {
  const { data: currentUser } = useAuthUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPage = Number(searchParams.get("page") || "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const roleParam = searchParams.get("role") || "";
  const roleFilter: UserRole | "" =
    roleParam === "student" || roleParam === "lecturer" || roleParam === "admin"
      ? roleParam
      : "";
  const searchParam = searchParams.get("search") || "";

  const [searchDraft, setSearchDraft] = useState(searchParam);
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    setSearchDraft(searchParam);
  }, [searchParam]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isCreateOpen && !editingUser && !deletingUser) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCreateOpen(false);
        setEditingUser(null);
        setDeletingUser(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCreateOpen, editingUser, deletingUser]);

  const skip = (page - 1) * PAGE_SIZE;
  // Fetch PAGE_SIZE + 1 to detect accurately whether a next page exists
  const {
    data: rawUsers = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useAdminUsers({
    skip,
    limit: PAGE_SIZE + 1,
    role: roleFilter,
    search: searchParam,
  });
  const hasNextPage = rawUsers.length > PAGE_SIZE;
  const users = useMemo(() => rawUsers.slice(0, PAGE_SIZE), [rawUsers]);

  const createUserMutation = useCreateUser();
  const createAdminProfileMutation = useCreateAdminProfile();
  const createStudentProfileMutation = useCreateStudentProfile();
  const createLecturerProfileMutation = useCreateLecturerProfile();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  const updateUrlParams = (updates: {
    page?: number;
    role?: string;
    search?: string;
  }) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (updates.page !== undefined) {
        if (updates.page <= 1) next.delete("page");
        else next.set("page", String(updates.page));
      }
      if (updates.role !== undefined) {
        if (!updates.role) next.delete("role");
        else next.set("role", updates.role);
      }
      if (updates.search !== undefined) {
        if (!updates.search.trim()) next.delete("search");
        else next.set("search", updates.search.trim());
      }
      return next;
    });
  };

  // Create Form
  const createForm = useForm<UserCreateFormValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      user_code: "",
      name: "",
      email: "",
      role: "student",
      title: "",
      department: "Khoa KH & KT Máy tính",
      cohort: "K26",
      major: "Khoa học Máy tính",
      password: "",
    },
  });

  const watchedCreateRole = createForm.watch("role");

  // Edit Form
  const editForm = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "student",
      title: "",
      password: "",
    },
  });

  const openEditModal = (u: User) => {
    setEditingUser(u);
    editForm.reset({
      name: u.name,
      email: u.email,
      role: u.role,
      title: u.title || "",
      password: "",
    });
  };

  const handleCreateSubmit = createForm.handleSubmit(async (values) => {
    try {
      const created = await createUserMutation.mutateAsync({
        user_code: values.user_code,
        name: values.name,
        email: values.email,
        role: values.role,
        title: values.title?.trim() || null,
        password: values.password,
      });

      if (values.role === "admin") {
        try {
          await createAdminProfileMutation.mutateAsync({
            admin_id: created.user_code,
            department: values.department?.trim() || "Phòng Đào tạo",
            user_id: created.id,
          });
        } catch {
          // Admin profile may already exist
        }
      } else if (values.role === "student") {
        try {
          await createStudentProfileMutation.mutateAsync({
            student_id: created.user_code,
            cohort: values.cohort?.trim() || "K26",
            major: values.major?.trim() || "Khoa học Máy tính",
            user_id: created.id,
          });
        } catch {
          // Student profile may already exist
        }
      } else if (values.role === "lecturer") {
        try {
          await createLecturerProfileMutation.mutateAsync({
            lecturer_id: created.user_code,
            departments: values.department?.trim() || "Khoa KH & KT Máy tính",
            user_id: created.id,
          });
        } catch {
          // Lecturer profile may already exist
        }
      }

      toast.success(`Đã tạo tài khoản ${created.user_code} thành công.`);
      createForm.reset();
      setIsCreateOpen(false);
    } catch (err) {
      toast.error(extractApiError(err, "Không thể tạo tài khoản người dùng."));
    }
  });

  const handleEditSubmit = editForm.handleSubmit(async (values) => {
    if (!editingUser) return;
    try {
      await updateUserMutation.mutateAsync({
        userId: editingUser.id,
        payload: {
          name: values.name,
          email: values.email,
          role: values.role,
          title: values.title?.trim() || null,
          ...(values.password?.trim() ? { password: values.password.trim() } : {}),
        },
      });
      toast.success(`Đã cập nhật tài khoản ${editingUser.user_code}.`);
      setEditingUser(null);
    } catch (err) {
      toast.error(extractApiError(err, "Không thể cập nhật tài khoản."));
    }
  });

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    if (deletingUser.id === currentUser?.id) {
      toast.error("Không thể tự xóa tài khoản quản trị đang đăng nhập.");
      setDeletingUser(null);
      return;
    }
    try {
      await deleteUserMutation.mutateAsync(deletingUser.id);
      toast.success(`Đã xóa tài khoản ${deletingUser.user_code}.`);
      if (users.length === 1 && page > 1) {
        updateUrlParams({ page: page - 1 });
      }
      setDeletingUser(null);
    } catch (err) {
      toast.error(extractApiError(err, "Không thể xóa tài khoản."));
    }
  };

  const columns = useMemo<LegacyColumnDef<User>[]>(
    () => [
      {
        accessorKey: "user_code",
        header: "Mã định danh",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-slate-900">
            {row.original.user_code}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Họ và tên",
        cell: ({ row }) => (
          <div>
            <p className="text-xs font-semibold text-slate-900">
              {row.original.name}
            </p>
            {row.original.title && (
              <p className="text-[11px] text-slate-500">{row.original.title}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-xs text-slate-600">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "role",
        header: "Vai trò",
        cell: ({ row }) => {
          const r = row.original.role;
          return (
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-semibold",
                r === "admin" && "border-indigo-200 bg-indigo-50 text-indigo-700",
                r === "lecturer" && "border-blue-200 bg-blue-50 text-blue-700",
                r === "student" &&
                  "border-emerald-200 bg-emerald-50 text-emerald-700",
              )}
            >
              {ROLE_LABELS[r] || r}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Thao tác",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditModal(row.original)}
              className="h-7 cursor-pointer px-2 text-xs text-slate-600 hover:text-blue-700"
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Sửa
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={row.original.id === currentUser?.id}
              title={
                row.original.id === currentUser?.id
                  ? "Không thể tự xóa tài khoản đang đăng nhập"
                  : "Xóa tài khoản"
              }
              onClick={() => setDeletingUser(row.original)}
              className="h-7 cursor-pointer px-2 text-xs text-slate-500 hover:text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Xóa
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser?.id],
  );

  const table = useLegacyTable({
    data: users,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Quản lý Tài khoản Người dùng
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Quản trị danh sách tài khoản Sinh viên, Giảng viên và Quản trị viên trong hệ thống.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            createForm.reset();
            setIsCreateOpen(true);
          }}
          className="h-9 cursor-pointer gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-brand-blue-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Tạo tài khoản mới</span>
        </Button>
      </div>

      {isError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span>Không thể tải danh sách tài khoản người dùng. Vui lòng thử lại.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="h-8 w-fit cursor-pointer gap-1.5 border-rose-200 bg-white text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      {/* Filters & Table Card */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Users className="h-4.5 w-4.5 text-blue-600" />
                Danh sách Tài khoản (Trang {page})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Hiển thị {users.length} bản ghi trên trang hiện tại
                {isFetching && !isLoading ? " • Đang cập nhật..." : ""}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Role Filter Pills */}
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
                {(
                  [
                    { value: "", label: "Tất cả" },
                    { value: "student", label: "Sinh viên" },
                    { value: "lecturer", label: "Giảng viên" },
                    { value: "admin", label: "Quản trị" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.value || "all"}
                    type="button"
                    onClick={() =>
                      updateUrlParams({ role: item.value, page: 1 })
                    }
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                      roleFilter === item.value
                        ? "bg-white text-blue-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Search Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateUrlParams({ search: searchDraft, page: 1 });
                }}
                className="flex items-center gap-1.5"
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    placeholder="Tìm tên, mã số, email..."
                    className="h-8 w-52 pl-8 text-xs"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="h-8 cursor-pointer text-xs"
                >
                  Tìm
                </Button>
                {searchParam && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSearchDraft("");
                      updateUrlParams({ search: "", page: 1 });
                    }}
                    className="h-8 cursor-pointer px-2 text-xs text-slate-500"
                  >
                    Xóa lọc
                  </Button>
                )}
              </form>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Không tìm thấy tài khoản phù hợp
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Thử thay đổi bộ lọc vai trò hoặc từ khóa tìm kiếm.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase text-slate-500">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const canSort = header.column.getCanSort();
                        return (
                          <th
                            key={header.id}
                            className={cn(
                              "px-4 py-3",
                              header.id === "actions" && "text-right",
                            )}
                          >
                            {canSort ? (
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                className="inline-flex items-center gap-1 font-semibold uppercase hover:text-slate-800 cursor-pointer"
                              >
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                                <ArrowUpDown className="h-3 w-3 text-slate-400" />
                              </button>
                            ) : (
                              flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <span>
              Trang <strong>{page}</strong> • Mỗi trang {PAGE_SIZE} tài khoản
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateUrlParams({ page: page - 1 })}
                className="h-8 cursor-pointer gap-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNextPage}
                onClick={() => updateUrlParams({ page: page + 1 })}
                className="h-8 cursor-pointer gap-1 text-xs"
              >
                Sau
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create User Modal */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Tạo tài khoản mới
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Mã định danh *</Label>
                  <Input
                    {...createForm.register("user_code")}
                    placeholder="VD: AD00009, GV00100, 2610001"
                    className="h-9 text-xs"
                  />
                  {createForm.formState.errors.user_code && (
                    <p className="text-[11px] text-rose-600">
                      {createForm.formState.errors.user_code.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Vai trò *</Label>
                  <select
                    {...createForm.register("role")}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
                  >
                    <option value="student">Sinh viên</option>
                    <option value="lecturer">Giảng viên</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Họ và tên *</Label>
                <Input
                  {...createForm.register("name")}
                  placeholder="Nguyễn Văn A"
                  className="h-9 text-xs"
                />
                {createForm.formState.errors.name && (
                  <p className="text-[11px] text-rose-600">
                    {createForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Email *</Label>
                  <Input
                    type="email"
                    {...createForm.register("email")}
                    placeholder="user@hcmut.edu.vn"
                    className="h-9 text-xs"
                  />
                  {createForm.formState.errors.email && (
                    <p className="text-[11px] text-rose-600">
                      {createForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Mật khẩu *</Label>
                  <Input
                    type="password"
                    {...createForm.register("password")}
                    placeholder="Tối thiểu 6 ký tự"
                    className="h-9 text-xs"
                  />
                  {createForm.formState.errors.password && (
                    <p className="text-[11px] text-rose-600">
                      {createForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Chức danh / Ghi chú</Label>
                  <Input
                    {...createForm.register("title")}
                    placeholder="VD: TS., Chuyên viên ĐT..."
                    className="h-9 text-xs"
                  />
                </div>
                {(watchedCreateRole === "admin" ||
                  watchedCreateRole === "lecturer") && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      {watchedCreateRole === "admin"
                        ? "Phòng ban quản trị"
                        : "Khoa / Bộ môn"}
                    </Label>
                    <Input
                      {...createForm.register("department")}
                      placeholder={
                        watchedCreateRole === "admin"
                          ? "Phòng Đào tạo"
                          : "Khoa KH & KT Máy tính"
                      }
                      className="h-9 text-xs"
                    />
                  </div>
                )}
              </div>

              {watchedCreateRole === "student" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Khóa (Cohort)</Label>
                    <Input
                      {...createForm.register("cohort")}
                      placeholder="VD: K26"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Ngành đào tạo</Label>
                    <Input
                      {...createForm.register("major")}
                      placeholder="VD: Khoa học Máy tính"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                  className="cursor-pointer text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createUserMutation.isPending}
                  className="cursor-pointer bg-blue-600 text-xs text-white hover:bg-blue-700"
                >
                  {createUserMutation.isPending ? "Đang tạo..." : "Tạo tài khoản"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Cập nhật tài khoản
                </h2>
                <p className="font-mono text-xs text-slate-500">
                  {editingUser.user_code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Họ và tên *</Label>
                <Input {...editForm.register("name")} className="h-9 text-xs" />
                {editForm.formState.errors.name && (
                  <p className="text-[11px] text-rose-600">
                    {editForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Email *</Label>
                  <Input
                    type="email"
                    {...editForm.register("email")}
                    className="h-9 text-xs"
                  />
                  {editForm.formState.errors.email && (
                    <p className="text-[11px] text-rose-600">
                      {editForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Vai trò *</Label>
                  <select
                    {...editForm.register("role")}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
                  >
                    <option value="student">Sinh viên</option>
                    <option value="lecturer">Giảng viên</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Chức danh</Label>
                  <Input {...editForm.register("title")} className="h-9 text-xs" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Mật khẩu mới (để trống nếu giữ nguyên)
                  </Label>
                  <Input
                    type="password"
                    {...editForm.register("password")}
                    placeholder="••••••"
                    className="h-9 text-xs"
                  />
                  {editForm.formState.errors.password && (
                    <p className="text-[11px] text-rose-600">
                      {editForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingUser(null)}
                  className="cursor-pointer text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateUserMutation.isPending}
                  className="cursor-pointer bg-blue-600 text-xs text-white hover:bg-blue-700"
                >
                  {updateUserMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">
              Xác nhận xóa tài khoản
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Bạn có chắc chắn muốn xóa tài khoản{" "}
              <strong className="text-slate-900">
                {deletingUser.name} ({deletingUser.user_code})
              </strong>
              ? Thao tác này không thể hoàn tác.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingUser(null)}
                className="cursor-pointer text-xs"
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteUserMutation.isPending}
                onClick={() => void handleConfirmDelete()}
                className="cursor-pointer text-xs"
              >
                {deleteUserMutation.isPending ? "Đang xóa..." : "Xóa tài khoản"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
