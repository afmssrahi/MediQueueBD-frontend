"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/notifications/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import { formatRelative } from "@/lib/format";

/** The notification bell in the top bar. */
export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const remove = useDeleteNotification();

  const unread = (notifications ?? []).filter((item) => !item.read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t("nav.notifications")}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{t("notifications.title")}</p>
            {unread > 0 && (
              <p className="text-xs text-muted-foreground">
                {unread} {t("notifications.unread")}
              </p>
            )}
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck />
              <span className="hidden sm:inline">
                {t("notifications.markAllRead")}
              </span>
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-96">
          {isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : (notifications ?? []).length === 0 ? (
            <EmptyState
              title={t("notifications.empty")}
              description={t("notifications.emptyHint")}
              className="border-0"
            />
          ) : (
            <ul className="divide-y">
              {(notifications ?? []).map((notification) => (
                <li
                  key={notification.id}
                  className="flex items-start gap-2 px-4 py-3 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                      <p
                        className={
                          notification.read
                            ? "truncate text-sm text-muted-foreground"
                            : "truncate text-sm font-medium"
                        }
                      >
                        {notification.title}
                      </p>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {notification.body}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatRelative(notification.createdAt)}
                    </p>
                    {notification.href && (
                      <Link
                        href={notification.href}
                        onClick={() => setOpen(false)}
                        className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                      >
                        {t("common.viewDetails")}
                      </Link>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-0.5">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => markRead.mutate(notification.id)}
                        aria-label={t("notifications.markRead")}
                      >
                        <CheckCheck />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove.mutate(notification.id)}
                      aria-label={t("notifications.delete")}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
