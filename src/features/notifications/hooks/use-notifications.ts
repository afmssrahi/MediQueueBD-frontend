"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "../services/notification.service";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (filters: { type?: string; unread?: boolean }) =>
    ["notifications", "list", filters] as const,
};

/** The signed-in user's notifications. */
export function useNotifications(filters: { type?: string; unread?: boolean } = {}) {
  return useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: () => notificationService.list(filters),
    refetchInterval: 60_000,
  });
}

/** Mark one notification as read. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/** Mark every notification as read. */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/** Delete a notification. */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
