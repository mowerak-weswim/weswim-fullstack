import { Suspense } from "react";

import { HomeAuthStatus } from "@/components/home-auth-status";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm">로딩 중...</main>}>
      <HomeAuthStatus />
    </Suspense>
  );
}
