import { Suspense } from "react";

import { ScheduleDetailPage } from "@/components/schedule-detail-page";

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense
      fallback={
        <div className="ws-page">
          <p style={{ color: "var(--gray-500)" }}>불러오는 중…</p>
        </div>
      }
    >
      <ScheduleDetailPage scheduleId={params.id} />
    </Suspense>
  );
}
