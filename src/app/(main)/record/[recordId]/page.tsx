import { RecordDetailPage } from "@/components/record-detail-page";

export default function Page({
  params,
}: {
  params: { recordId: string };
}) {
  return <RecordDetailPage recordId={params.recordId} />;
}
