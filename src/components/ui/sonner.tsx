"use client";

import { Toaster as Sonner } from "sonner";
import { useUi } from "@/stores/ui";

export function Toaster() {
  const theme = useUi((state) => state.theme);

  return (
    <Sonner
      theme={theme === "dark" ? "dark" : "light"}
      position="top-right"
      richColors
      closeButton
    />
  );
}
