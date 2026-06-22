import { Suspense } from "react";

import { GroupPage } from "@/components/group-page";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="ws-page">
          <p style={{ color: "var(--gray-500)" }}>불러오는 중…</p>
        </div>
      }
    >
      <GroupPage />
    </Suspense>
  );
}
