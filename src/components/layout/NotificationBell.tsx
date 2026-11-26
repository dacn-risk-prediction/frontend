import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  advisingKeys,
  useAdvisingNotifications,
  useMarkAllNotificationsRead,
  useMarkSessionRead,
} from "@/features/advising/api/advising-api";
import { cn } from "@/lib/utils";
import type {
  AdvisingNotificationItem,
  NotificationDirection,
} from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Calendar,
  CheckCheck,
  Clock,
  ListTodo,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface NotificationBellProps {
  role: "student" | "lecturer";
  unreadCount: number;
  enabled?: boolean;
}

const DEFAULT_PAGE_SIZE = 5;
const MAX_NOTIFICATION_LIMIT = 100;

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMessageTypeMeta(messageType?: string): {
  label: string;
  Icon: typeof MessageSquare;
} {
  if (messageType === "APPOINTMENT_NOTICE") {
    return { label: "Lịch hẹn", Icon: Calendar };
  }
  if (messageType === "TASK_NOTICE") {
    return { label: "Nhiệm vụ", Icon: ListTodo };
  }
  return { label: "Tin nhắn", Icon: MessageSquare };
}

export const NotificationBell = ({
  role,
  unreadCount,
  enabled = true,
}: NotificationBellProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationDirection>("all");
  const [limit, setLimit] = useState<number>(DEFAULT_PAGE_SIZE);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const {
    data: notificationData,
    isLoading,
    isError,
    isFetching,
    refetch: refetchNotifications,
  } = useAdvisingNotifications(filter, limit, enabled && isOpen);

  const markSessionReadMutation = useMarkSessionRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const items = notificationData?.items ?? [];
  const effectiveUnreadCount = unreadCount;
  const receivedCount = notificationData?.received_count ?? 0;
  const sentCount = notificationData?.sent_count ?? 0;
  const allCount = receivedCount + sentCount;
  const hasMore =
    Boolean(notificationData?.has_more) && limit < MAX_NOTIFICATION_LIMIT;

  const hasPendingSent = items.some(
    (item) => item.direction === "sent" && !item.is_read,
  );

  const targetBasePath =
    role === "lecturer" ? "/lecturer/alerts" : "/student/advising";

  const handleRefresh = () => {
    void refetchNotifications();
    void queryClient.invalidateQueries({
      queryKey: advisingKeys.unreadCount(),
    });
    void queryClient.invalidateQueries({
      queryKey: advisingKeys.sessions(),
    });
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      handleRefresh();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllReadMutation.mutateAsync();
      toast.success("Đã đánh dấu tất cả thông báo là đã đọc.");
    } catch {
      toast.error("Không thể cập nhật trạng thái thông báo.");
    }
  };

  const handleOpenNotification = (item: AdvisingNotificationItem) => {
    if (item.direction === "received" && !item.is_read) {
      markSessionReadMutation.mutate(item.session_id);
    }

    if (role === "lecturer") {
      const targetTab =
        item.message_type === "APPOINTMENT_NOTICE"
          ? "bookings"
          : item.message_type === "TASK_NOTICE"
            ? "action-plan"
            : "messages";
      navigate(
        `/lecturer/alerts?student=${encodeURIComponent(item.student_id)}&course=${encodeURIComponent(item.course_code)}&tab=${targetTab}`,
      );
    } else {
      const targetTab =
        item.message_type === "APPOINTMENT_NOTICE"
          ? "booking"
          : item.message_type === "TASK_NOTICE"
            ? "action-plan"
            : "feed";
      navigate(
        `/student/advising?course=${encodeURIComponent(item.course_code)}&tab=${targetTab}`,
      );
    }
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        aria-label="Mở danh sách thông báo cố vấn"
        title={
          effectiveUnreadCount > 0
            ? `${effectiveUnreadCount} thông báo mới chưa đọc`
            : hasPendingSent
              ? "Có thông báo đã gửi đang chờ xem"
              : "Thông báo cố vấn học vụ"
        }
        className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {effectiveUnreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white ring-2 ring-white tabular-nums">
            {effectiveUnreadCount > 99 ? "99+" : effectiveUnreadCount}
          </span>
        ) : hasPendingSent ? (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="mt-1 w-88 overflow-hidden p-0 sm:w-100"
      >
        {/* Header */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <span className="text-xs font-bold text-slate-900">
              Thông báo cố vấn
            </span>

            <div className="flex items-center gap-1.5">
              {effectiveUnreadCount > 0 ? (
                <button
                  type="button"
                  disabled={markAllReadMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleMarkAllRead();
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-sidebar-accent px-2 py-1 text-xs font-semibold text-sidebar-accent-foreground hover:bg-blue-100 tabular-nums"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Đọc tất cả ({effectiveUnreadCount})</span>
                </button>
              ) : (
                <span className="text-xs font-medium text-slate-500">
                  Đã đọc hết
                </span>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRefresh();
                }}
                aria-label="Làm mới thông báo"
                title="Làm mới thông báo"
                className="cursor-pointer rounded-md p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
                  aria-hidden="true"
                />
              </button>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        {/* Filter Tabs */}
        <div
          role="tablist"
          aria-label="Lọc loại thông báo"
          className="grid grid-cols-3 gap-1 border-b border-slate-200 bg-white px-2.5 py-2 text-xs tabular-nums"
        >
          {(
            [
              { id: "all", label: `Tất cả (${allCount})` },
              { id: "received", label: `Đã nhận (${receivedCount})` },
              { id: "sent", label: `Đã gửi (${sentCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setFilter(tab.id);
                setLimit(DEFAULT_PAGE_SIZE);
              }}
              className={cn(
                "cursor-pointer rounded-md py-1.5 font-semibold transition-colors",
                filter === tab.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : isError ? (
            <div className="px-4 py-6 text-center">
              <AlertCircle
                className="mx-auto mb-2 h-6 w-6 text-destructive"
                aria-hidden="true"
              />
              <p className="text-xs font-semibold text-slate-900">
                Không thể tải danh sách thông báo
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRefresh();
                }}
                className="mt-2.5 h-8 cursor-pointer gap-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Thử lại</span>
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MessageSquare
                className="mx-auto mb-2 h-6 w-6 text-slate-400"
                aria-hidden="true"
              />
              <p className="text-xs font-semibold text-slate-800">
                {filter === "received"
                  ? "Chưa có thông báo nhận được"
                  : filter === "sent"
                    ? "Chưa có thông báo đã gửi"
                    : "Chưa có thông báo cố vấn nào"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Tin nhắn, lịch hẹn và nhiệm vụ sẽ hiển thị tại đây.
              </p>
            </div>
          ) : (
            <>
              <DropdownMenuGroup className="divide-y divide-slate-100">
                {items.map((item) => {
                  const isSentByMe = item.direction === "sent";
                  const isUnreadReceived = !isSentByMe && !item.is_read;
                  const counterpartName =
                    role === "lecturer"
                      ? item.student_name || `Sinh viên ${item.student_id}`
                      : item.lecturer_name || "Giảng viên phụ trách";
                  const counterpartRoleLabel =
                    role === "lecturer" ? "SV" : "GV";
                  const typeMeta = getMessageTypeMeta(item.message_type);
                  const TypeIcon = typeMeta.Icon;

                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => handleOpenNotification(item)}
                      className={cn(
                        "flex cursor-pointer flex-col items-start gap-1.5 rounded-none px-3.5 py-2.5 transition-colors",
                        isUnreadReceived
                          ? "bg-sidebar-accent/70 focus:bg-sidebar-accent"
                          : "focus:bg-slate-50",
                      )}
                    >
                      {/* Row 1: Counterpart + Course + Timestamp */}
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {isUnreadReceived && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-destructive"
                              aria-hidden="true"
                            />
                          )}
                          <span className="truncate text-xs font-bold text-slate-900">
                            {counterpartName}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-slate-500">
                            · {item.course_code}
                          </span>
                        </div>

                        <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500 tabular-nums">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>

                      {/* Row 2: Type metadata + single status badge */}
                      <div className="flex w-full items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                          <TypeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          {typeMeta.label}
                        </span>

                        {isSentByMe ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1 px-2 py-0 text-xs font-semibold",
                              item.is_read
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-50 text-slate-700",
                            )}
                          >
                            {item.is_read ? (
                              <CheckCheck className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                            )}
                            <span>
                              {item.is_read
                                ? `${counterpartRoleLabel} đã xem`
                                : `Chờ ${counterpartRoleLabel} xem`}
                            </span>
                          </Badge>
                        ) : isUnreadReceived ? (
                          <Badge
                            variant="destructive"
                            className="gap-1 px-2 py-0 text-xs font-semibold"
                          >
                            <ArrowDownLeft className="h-3 w-3" aria-hidden="true" />
                            <span>Chưa đọc</span>
                          </Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <ArrowDownLeft className="h-3 w-3" aria-hidden="true" />
                            Đã đọc
                          </span>
                        )}
                      </div>

                      {/* Row 3: Content Preview */}
                      <p className="line-clamp-2 w-full text-xs leading-relaxed text-slate-600">
                        <span className="font-semibold text-slate-800">
                          {isSentByMe ? "Bạn: " : `${counterpartRoleLabel}: `}
                        </span>
                        {item.content}
                      </p>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>

              {(hasMore || limit > DEFAULT_PAGE_SIZE) && (
                <div className="flex items-center gap-1.5 p-2 text-center">
                  {hasMore && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLimit((prev) =>
                          Math.min(
                            MAX_NOTIFICATION_LIMIT,
                            prev + DEFAULT_PAGE_SIZE,
                          ),
                        );
                      }}
                      className="flex-1 cursor-pointer rounded-md border border-slate-200 bg-slate-50 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 tabular-nums"
                    >
                      Xem thêm ({items.length}/{notificationData?.total})
                    </button>
                  )}
                  {limit > DEFAULT_PAGE_SIZE && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLimit(DEFAULT_PAGE_SIZE);
                      }}
                      className="cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Thu gọn
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DropdownMenuSeparator className="my-0" />

        {/* Footer */}
        <div className="bg-slate-50 p-1">
          <DropdownMenuItem
            onClick={() => navigate(targetBasePath)}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 py-2 text-xs font-semibold text-sidebar-accent-foreground focus:bg-sidebar-accent"
          >
            <span>
              {role === "lecturer"
                ? "Mở Cố vấn & Can thiệp"
                : "Mở Cố vấn & Hướng dẫn"}
            </span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
