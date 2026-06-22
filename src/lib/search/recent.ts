const STORAGE_KEY = "weswim_recent_searches";
const MAX_RECENT = 8;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return getRecentSearches();
  }
  const next = [trimmed, ...getRecentSearches().filter((q) => q !== trimmed)].slice(
    0,
    MAX_RECENT,
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeRecentSearch(query: string): string[] {
  const next = getRecentSearches().filter((q) => q !== query);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearRecentSearches(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
