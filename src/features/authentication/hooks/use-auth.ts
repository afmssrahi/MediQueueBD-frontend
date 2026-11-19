"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { authService, type LoginRequest, type RegisterRequest } from "../services/auth.service";
import { userService, type UpdateProfileRequest } from "../services/user.service";
import { useSession } from "@/stores/session";
import { homeRouteFor } from "@/lib/rbac";

/** The query keys used by the authentication feature. */
export const authKeys = {
  demoAccounts: ["auth", "demo-accounts"] as const,
  me: ["auth", "me"] as const,
};

/** The demo accounts shown on the login screen. */
export function useDemoAccounts() {
  return useQuery({
    queryKey: authKeys.demoAccounts,
    queryFn: () => authService.getDemoAccounts(),
    staleTime: Infinity,
  });
}

/** The signed-in user, refreshed from the server. */
export function useCurrentUser() {
  const userId = useSession((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => userService.getMe(),
    enabled: Boolean(userId),
  });
}

/** Sign in. On success the session store is updated. */
export function useLogin() {
  const queryClient = useQueryClient();
  const signIn = useSession((state) => state.signIn);

  return useMutation({
    mutationFn: (payload: LoginRequest) => authService.login(payload),
    onSuccess: (user, variables) => {
      signIn(user, variables.remember ?? false);
      void queryClient.invalidateQueries();
    },
  });
}

/** Register a new account. */
export function useRegister() {
  const queryClient = useQueryClient();
  const signIn = useSession((state) => state.signIn);

  return useMutation({
    mutationFn: (payload: RegisterRequest) => authService.register(payload),
    onSuccess: (user) => {
      signIn(user, false);
      void queryClient.invalidateQueries();
    },
  });
}

/** Request a password reset. UI only — no email is sent. */
export function useForgotPassword() {
  return useMutation({
    mutationFn: authService.forgotPassword,
  });
}

/** Set a new password. */
export function useResetPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.resetPassword,
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

/** Sign out and clear the cached data. */
export function useLogout(): () => void {
  const queryClient = useQueryClient();
  const signOut = useSession((state) => state.signOut);

  return () => {
    void authService.logout().catch(() => {
      // The local session is cleared even if the demo transport errors.
    });
    signOut();
    queryClient.clear();
  };
}

/** Update the signed-in user's profile. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const updateProfile = useSession((state) => state.updateProfile);

  return useMutation({
    mutationFn: (payload: UpdateProfileRequest) =>
      userService.updateProfile(payload),
    onSuccess: (user) => {
      updateProfile(user);
      void queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

/** Change the signed-in user's password. */
export function useChangePassword() {
  return useMutation({
    mutationFn: userService.changePassword,
  });
}

/**
 * Sign in as another demo role without re-entering credentials.
 *
 * This exists only because the prototype is a demo. It is clearly labelled
 * as such wherever it appears.
 */
export function useSwitchRole() {
  const queryClient = useQueryClient();
  const signIn = useSession((state) => state.signIn);

  return useMutation({
    mutationFn: async (email: string) => {
      const accounts = await authService.getDemoAccounts();
      const account = accounts.find((item) => item.email === email);
      if (!account) throw new Error("That demo account does not exist.");
      return authService.login({ email, password: account.password });
    },
    onSuccess: (user) => {
      signIn(user, false);
      void queryClient.clear();
    },
  });
}

/** The landing route for the signed-in user. */
export function useHomeRoute(): string {
  const role = useSession((state) => state.user?.role ?? null);
  return role ? homeRouteFor(role) : "/login";
}

export type { UseQueryResult };
