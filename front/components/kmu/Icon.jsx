"use client";

import { iconPaths } from "@/data/profile";
export function Icon({ name: name, className = "icon" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}
