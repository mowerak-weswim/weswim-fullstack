import { PoolCommunityPage } from "@/components/pool-community-page";

type PageProps = {
  params: Promise<{ venueId: string }>;
};

export default async function VenuePage({ params }: PageProps) {
  const { venueId } = await params;
  return <PoolCommunityPage venueId={venueId} />;
}
