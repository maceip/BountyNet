"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function initThemeFromStorage(): void {
  const root = document.documentElement;
  const saved = localStorage.getItem("bountynet.theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeToggle(): React.ReactElement {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("bountynet.theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <Button
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      className="size-9 sm:size-8"
      onClick={() => setDark((d) => !d)}
      size="icon"
      title="Toggle light / dark theme"
      type="button"
      variant="ghost"
    >
      {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  );
}
