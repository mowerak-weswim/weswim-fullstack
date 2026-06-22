import { PubHtmlRoot } from "@/components/pub/pub-html-root";
import { SiteGnb } from "@/components/layout/site-gnb";
import { loadPubScreen } from "@/lib/pub/load-screen";

type PubPageProps = {
  file: string;
  activeNav?: "home" | "group" | "record" | "my";
  showGnb?: boolean;
};

export async function PubPage({
  file,
  activeNav = "home",
  showGnb = true,
}: PubPageProps) {
  const { styles, html } = await loadPubScreen(file);

  return (
    <>
      {showGnb ? <SiteGnb activeNav={activeNav} /> : null}
      <PubHtmlRoot styles={styles} html={html} />
    </>
  );
}
