import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
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
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
  const hasMore = Boolean(notificationData?.has_more) && limit < MAX_NOTIFICATION_LIMIT;

  // Subtle indicator when user has sent items waiting to be read by recipient
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
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-hidden cursor-pointer"
      >
        <Bell className="h-5 w-5" />
        {effectiveUnreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold text-white ring-2 ring-white shadow-xs">
            {effectiveUnreadCount > 99 ? "99+" : effectiveUnreadCount}
          </span>
        ) : hasPendingSent ? (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-88 sm:w-100 mt-1 p-0 overflow-hidden"
      >
        {/* Header */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-bold text-slate-900">
                Thông báo ({role === "lecturer" ? "Giảng viên" : "Sinh viên"})
              </span>
            </div>

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
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 cursor-pointer"
                >
                  <CheckCheck className="h-3 w-3" />
                  <span>Đọc tất cả ({effectiveUnreadCount})</span>
                </button>
              ) : (
                <span className="text-[11px] font-medium text-slate-400">
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
                title="Làm mới thông báo"
                className="rounded p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
              >
                <RefreshCw
                  className={cn("h-3 w-3", isFetching && "animate-spin")}
                />
              </button>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        {/* Filter Pills: Tất cả | Đã nhận | Đã gửi */}
        <div className="grid grid-cols-3 gap-1 border-b border-slate-100 bg-white px-2.5 py-2 text-[11px]">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFilter("all");
              setLimit(DEFAULT_PAGE_SIZE);
            }}
            className={cn(
              "rounded-md py-1 font-semibold transition-colors cursor-pointer",
              filter === "all"
                ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            Tất cả ({allCount})
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFilter("received");
              setLimit(DEFAULT_PAGE_SIZE);
            }}
            className={cn(
              "rounded-md py-1 font-semibold transition-colors cursor-pointer",
              filter === "received"
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            Đã nhận ({receivedCount})
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFilter("sent");
              setLimit(DEFAULT_PAGE_SIZE);
            }}
            className={cn(
              "rounded-md py-1 font-semibold transition-colors cursor-pointer",
              filter === "sent"
                ? "bg-slate-100 text-slate-800 ring-1 ring-slate-300"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            Đã gửi ({sentCount})
          </button>
        </div>

        {/* Individual Notification Events Feed */}
        <div className="max-h-96 overflow-y-auto p-1">
          {isLoading ? (
            <div className="space-y-2 p-2.5">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <MessageSquare className="mx-auto h-7 w-7 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                {filter === "received"
                  ? "Chưa có thông báo nhận được"
                  : filter === "sent"
                    ? "Chưa có thông báo đã gửi"
                    : "Chưa có thông báo cố vấn nào"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Mọi tin nhắn, lịch hẹn và nhiệm vụ sẽ được lưu và hiển thị đầy
                đủ tại đây.
              </p>
            </div>
          ) : (
            <>
              <DropdownMenuGroup>
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
                        "flex flex-col items-start gap-1.5 rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
                        isUnreadReceived
                          ? "bg-blue-50/75 focus:bg-blue-50"
                          : "focus:bg-slate-50",
                      )}
                    >
                      {/* Row 1: Counterpart + Course + Timestamp */}
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isUnreadReceived && (
                            <span className="h-2 w-2 rounded-full bg-rose-600 shrink-0" />
                          )}
                          <span className="truncate text-xs font-bold text-slate-900">
                            {counterpartName}
                          </span>
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] px-1 py-0 border-slate-200 bg-white text-slate-700 shrink-0"
                          >
                            {item.course_code}
                          </Badge>
                        </div>

                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400 shrink-0">
                          <Clock className="h-2.5 w-2.5" />
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>

                      {/* Row 2: Event Type + Direction & Read Receipt */}
                      <div className="flex w-full flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          <TypeIcon className="h-2.5 w-2.5" />
                          {typeMeta.label}
                        </span>

                        {isSentByMe ? (
                          item.is_read ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-1.5 py-0 gap-1"
                            >
                              <CheckCheck className="h-2.5 w-2.5" />
                              <span>
                                Đã gửi • {counterpartRoleLabel} đã xem
                              </span>
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-blue-200 bg-blue-50/70 text-blue-700 text-[10px] font-semibold px-1.5 py-0 gap-1"
                            >
                              <ArrowUpRight className="h-2.5 w-2.5" />
                              <span>
                                Đã gửi • Chờ {counterpartRoleLabel} xem
                              </span>
                            </Badge>
                          )
                        ) : isUnreadReceived ? (
                          <Badge className="bg-rose-600 text-white hover:bg-rose-600 text-[10px] font-semibold px-1.5 py-0 gap-1">
                            <ArrowDownLeft className="h-2.5 w-2.5" />
                            <span>
                              Đã nhận từ {counterpartRoleLabel} • Chưa đọc
                            </span>
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50/70 text-emerald-700 text-[10px] font-semibold px-1.5 py-0 gap-1"
                          >
                            <ArrowDownLeft className="h-2.5 w-2.5" />
                            <span>
                              Đã nhận từ {counterpartRoleLabel} • Đã đọc
                            </span>
                          </Badge>
                        )}
                      </div>

                      {/* Row 3: Content Preview */}
                      <p className="w-full line-clamp-2 text-[11px] leading-relaxed text-slate-600">
                        <span className="font-semibold text-slate-700">
                          {isSentByMe ? "Bạn: " : `${counterpartRoleLabel}: `}
                        </span>
                        {item.content}
                      </p>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>

              {(hasMore || limit > DEFAULT_PAGE_SIZE) && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-center">
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
                      className="flex-1 rounded-md border border-slate-200 bg-slate-50 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
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
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
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
        <div className="p-1 bg-slate-50/60">
          <DropdownMenuItem
            onClick={() => navigate(targetBasePath)}
            className="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-semibold text-blue-700 focus:bg-blue-50 focus:text-blue-800 cursor-pointer"
          >
            <span>
              {role === "lecturer"
                ? "Mở Trung tâm Cố vấn & Can thiệp"
                : "Mở Cố vấn & Hướng dẫn Môn học"}
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
