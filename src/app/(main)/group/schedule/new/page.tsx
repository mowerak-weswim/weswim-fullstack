import { Suspense } from "react";

import { ScheduleWritePage } from "@/components/schedule-write-page";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="ws-page">
          <p style={{ color: "var(--gray-500)" }}>불러오는 중…</p>
        </div>
      }
    >
      <ScheduleWritePage />
    </Suspense>
  );
}
