import { UserProfilePage } from "@/components/user-profile-page";

export default function Page({ params }: { params: { id: string } }) {
  return <UserProfilePage userId={params.id} />;
}
