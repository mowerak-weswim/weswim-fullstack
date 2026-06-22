import { Suspense } from "react";

import { SearchPage } from "@/components/search-page";

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>검색 준비 중…</p>}>
      <SearchPage />
    </Suspense>
  );
}
