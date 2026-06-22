import { CommunityPostDetail } from "@/components/community-post-detail";

type Props = { params: { postId: string } };

export default function CommunityPostPage({ params }: Props) {
  return <CommunityPostDetail postId={params.postId} />;
}
