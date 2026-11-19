import { API_ROUTES, buildPath } from "@/api/routes";
import { request } from "@/services/request";
import type { AppNotification } from "@/types";

/** The notification service. */

export const notificationService = {
  async list(filters: { type?: string; unread?: boolean } = {}): Promise<AppNotification[]> {
    const { data } = await request<AppNotification[]>({
      method: API_ROUTES.listNotifications.method,
      path: API_ROUTES.listNotifications.path,
      query: {
        type: filters.type,
        unread: filters.unread === undefined ? undefined : String(filters.unread),
      },
    });
    return data;
  },

  async markRead(id: string): Promise<AppNotification> {
    const { data } = await request<AppNotification>({
      method: API_ROUTES.markNotificationRead.method,
      path: buildPath(API_ROUTES.markNotificationRead, { id }),
    });
    return data;
  },

  async markAllRead(): Promise<void> {
    await request({
      method: API_ROUTES.markAllNotificationsRead.method,
      path: API_ROUTES.markAllNotificationsRead.path,
    });
  },

  async remove(id: string): Promise<void> {
    await request({
      method: API_ROUTES.deleteNotification.method,
      path: buildPath(API_ROUTES.deleteNotification, { id }),
    });
  },
};
