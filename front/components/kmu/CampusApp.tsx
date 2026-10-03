"use client";
import dynamic from "next/dynamic";
// The reference reads localStorage and the current date during initialization.
// Keep that initialization in the browser to avoid mismatched server markup.
const CampusDashboard = dynamic(
  () => import("./CampusDashboard").then((module) => module.CampusDashboard),
  {
    ssr: false,
    loading: () => (
      <div
        className="grid min-h-screen place-items-center text-[var(--muted)]"
        role="status"
      >
        맞춤 공지를 준비하고 있어요…
      </div>
    ),
  },
);
export default function CampusApp() {
  return <CampusDashboard />;
}
