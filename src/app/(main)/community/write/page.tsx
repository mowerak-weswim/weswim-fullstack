import { Suspense } from "react";

import { CommunityWriteForm } from "@/components/community-write-form";

export default function CommunityWritePage() {
  return (
    <Suspense
      fallback={
        <div className="community-write-screen">
          <div className="page">
            <p className="write-loading">불러오는 중...</p>
          </div>
        </div>
      }
    >
      <CommunityWriteForm />
    </Suspense>
  );
}
