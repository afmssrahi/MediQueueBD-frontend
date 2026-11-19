"use client";

import { Moon, Sun } from "lucide-react";
import { useUi } from "@/stores/ui";
import { useTranslation } from "@/i18n/provider";
import { Button } from "@/components/ui/button";

/** The light/dark toggle in the top bar. */
export function ThemeToggle() {
  const theme = useUi((state) => state.theme);
  const toggleTheme = useUi((state) => state.toggleTheme);
  const { t } = useTranslation();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={
        theme === "dark" ? t("common.lightMode") : t("common.darkMode")
      }
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
