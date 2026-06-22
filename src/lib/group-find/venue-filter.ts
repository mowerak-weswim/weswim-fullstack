import type { VenueItem } from "@/lib/api";

import {
  REGION1_OPTIONS,
  type Region1Option,
  type Region2Option,
  getRegion2Options,
} from "@/lib/group-find/constants";

export { getRegion2Options };

export function filterVenuesByRegionAndQuery(
  venues: VenueItem[],
  params: {
    region1: string;
    region2: string;
    query?: string;
  },
): VenueItem[] {
  const r1 = REGION1_OPTIONS.find((r) => r.value === params.region1);
  const r2 = getRegion2Options(params.region1).find(
    (r) => r.value === params.region2,
  );
  const q = (params.query ?? "").trim().toLowerCase();

  return venues.filter((v) => {
    const hay = `${v.region ?? ""} ${v.address ?? ""} ${v.name}`.toLowerCase();

    if (r1 && !matchesRegionToken(hay, r1)) {
      return false;
    }
    if (r2 && !matchesRegionToken(hay, r2)) {
      return false;
    }
    if (q && !hay.includes(q)) {
      return false;
    }
    return true;
  });
}

function matchesRegionToken(
  haystack: string,
  option: Region1Option | Region2Option,
): boolean {
  return haystack.includes(option.match.toLowerCase());
}
