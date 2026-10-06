"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && theme === "dark";
  const label = dark ? "Ativar modo claro" : "Ativar modo escuro";
  return <button className="icon-btn theme-toggle" type="button" disabled={!mounted} aria-label={label} title={label} onClick={() => setTheme(dark ? "light" : "dark")}>
    {dark ? <Sun size={20} /> : <Moon size={20} />}
  </button>;
}
