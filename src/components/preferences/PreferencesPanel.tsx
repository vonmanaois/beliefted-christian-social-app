"use client";

import ThemeToggle from "@/components/layout/ThemeToggle";

export default function PreferencesPanel() {
  return (
    <div className="flex flex-col gap-6">
      <ThemeToggle />
    </div>
  );
}
