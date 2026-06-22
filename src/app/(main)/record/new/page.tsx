import { Suspense } from "react";

import { RecordNewPage } from "@/components/record-new-page";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="record-screen">
          <p style={{ padding: 32, color: "var(--gray-500)" }}>불러오는 중…</p>
        </div>
      }
    >
      <RecordNewPage />
    </Suspense>
  );
}
