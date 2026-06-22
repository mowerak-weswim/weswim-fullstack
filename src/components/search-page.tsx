"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  getTrendingSearches,
  searchAll,
  type SearchResponse,
  type TrendingSearch,
} from "@/lib/api";
import { getCategoryMeta } from "@/lib/community/categories";
import { avatarInitial, avatarVariant } from "@/lib/format/relative-time";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from "@/lib/search/recent";

import "@/styles/weswim-search.css";

type Tab = "all" | "posts" | "users" | "venues";

export function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [trending, setTrending] = useState<TrendingSearch[]>([]);

  useEffect(() => {
    setRecent(getRecentSearches());
    void getTrendingSearches()
      .then(setTrending)
      .catch(() => {
        setTrending([]);
      });
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setResults(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await searchAll(trimmed);
      setResults(data);
      setRecent(addRecentSearch(trimmed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색에 실패했습니다.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQ.trim()) {
      void runSearch(initialQ);
    }
  }, [initialQ, runSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    void runSearch(q);
  }

  function applySearchTerm(term: string) {
    setQuery(term);
    router.replace(`/search?q=${encodeURIComponent(term)}`);
    void runSearch(term);
  }

  const posts =
    activeTab === "all" || activeTab === "posts" ? (results?.posts ?? []) : [];
  const users =
    activeTab === "all" || activeTab === "users" ? (results?.users ?? []) : [];
  const venues =
    activeTab === "all" || activeTab === "venues" ? (results?.venues ?? []) : [];
  const hasQuery = query.trim().length > 0;
  const noResults =
    hasQuery &&
    !loading &&
    !error &&
    results &&
    posts.length === 0 &&
    users.length === 0 &&
    venues.length === 0;

  function SuggestBlocks() {
    return (
      <>
        <div className="suggest-block">
          <div className="sb-head">
            <div className="sb-head-title">최근 검색</div>
            {recent.length > 0 && (
              <button
                type="button"
                className="sb-head-clear"
                onClick={() => {
                  clearRecentSearches();
                  setRecent([]);
                }}
              >
                전체 삭제
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
              최근 검색어가 없어요.
            </p>
          ) : (
            <div className="recent-list">
              {recent.map((term) => (
                <div key={term} className="recent-item">
                  <button
                    type="button"
                    className="recent-item-main"
                    onClick={() => applySearchTerm(term)}
                  >
                    <div className="ri-ico">
                      <span className="ms" aria-hidden="true">
                        search
                      </span>
                    </div>
                    <div className="ri-text">{term}</div>
                  </button>
                  <button
                    type="button"
                    className="ri-del"
                    aria-label={`${term} 삭제`}
                    onClick={() => setRecent(removeRecentSearch(term))}
                  >
                    <span className="ms" aria-hidden="true">
                      close
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="suggest-block">
          <div className="sb-head">
            <div className="sb-head-title">지금 뜨는 검색어</div>
          </div>
          <div className="hot-tags">
            {trending.map((item) => (
              <button
                key={item.rank}
                type="button"
                className="hot-tag"
                onClick={() => applySearchTerm(item.label)}
              >
                <span className="rank">{item.rank}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="search-screen">
      <header className="gnb search-gnb">
        <div className="gnb-inner">
          <Link className="gnb-logo" href="/">
            <span className="We">We</span>
            <span className="Swim">Swim</span>
          </Link>
          <form className="gnb-search-wrap" onSubmit={handleSubmit}>
            <span className="ms gnb-search-ico" aria-hidden="true">
              search
            </span>
            <input
              className="gnb-search-input"
              type="search"
              placeholder="수영, 영법, 수영장, 닉네임 검색…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query.trim().length > 0 && (
              <button
                type="button"
                className={`gnb-search-clear show`}
                aria-label="지우기"
                onClick={() => {
                  setQuery("");
                  setResults(null);
                  router.replace("/search");
                }}
              >
                <span className="ms" aria-hidden="true">
                  close
                </span>
              </button>
            )}
          </form>
          <Link className="gnb-back" href="/" aria-label="닫기">
            <span className="ms" aria-hidden="true">
              close
            </span>
          </Link>
        </div>
      </header>

      <div className="page">
        <div className="main-col">
          <div className="search-type-tabs" role="tablist">
            {(
              [
                ["all", "전체", "grid_view"],
                ["posts", "게시글", "article"],
                ["users", "회원", "person"],
                ["venues", "수영장", "pool"],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                className={`stt${activeTab === id ? " on" : ""}`}
                onClick={() => setActiveTab(id)}
              >
                <span className="ms" aria-hidden="true">
                  {icon}
                </span>
                {label}
              </button>
            ))}
          </div>

          {!hasQuery && <SuggestBlocks />}

          {loading && hasQuery && (
            <p style={{ color: "var(--gray-500)", fontSize: 14 }}>검색 중…</p>
          )}

          {error && <div className="alert-error">{error}</div>}

          {noResults && (
            <div className="empty-state">
              <span className="ms es-ico" aria-hidden="true">
                sentiment_dissatisfied
              </span>
              <p className="es-t">검색 결과가 없어요</p>
              <p className="es-s">다른 키워드로 다시 검색해 보세요.</p>
            </div>
          )}

          {posts.length > 0 && (
            <section className="result-section">
              <div className="rs-head">
                <div className="rs-title">
                  <span className="ms" aria-hidden="true">
                    article
                  </span>
                  게시글
                  <span className="rs-count">{posts.length}</span>
                </div>
              </div>
              {posts.map((post) => {
                const cat = getCategoryMeta(post.category);
                return (
                  <Link
                    key={post.post_id}
                    href={`/community/${post.post_id}`}
                    className="res-post"
                  >
                    <span className="rp-cat">{cat.label}</span>
                    <div className="rp-title">
                      {post.title || post.content.slice(0, 60)}
                    </div>
                    <p className="rp-body">{post.content.slice(0, 120)}</p>
                    <div className="rp-meta">
                      <span className="ms" aria-hidden="true">
                        person
                      </span>
                      {post.nickname ?? "익명"} ·{" "}
                      {new Date(post.created_at).toLocaleDateString("ko-KR")}
                    </div>
                  </Link>
                );
              })}
            </section>
          )}

          {users.length > 0 && (
            <section className="result-section">
              <div className="rs-head">
                <div className="rs-title">
                  <span className="ms" aria-hidden="true">
                    person
                  </span>
                  회원
                  <span className="rs-count">{users.length}</span>
                </div>
              </div>
              {users.map((user) => (
                <Link
                  key={user.user_id}
                  href={`/users/${user.user_id}`}
                  className="res-user"
                >
                  <div className={`ru-av ${avatarVariant(user.nickname)}`}>
                    {avatarInitial(user.nickname)}
                  </div>
                  <div className="ru-info">
                    <div className="ru-name">{user.nickname}</div>
                    <div className="ru-sub">{user.user_type}</div>
                  </div>
                  <span className="ms ru-arrow" aria-hidden="true">
                    chevron_right
                  </span>
                </Link>
              ))}
            </section>
          )}

          {venues.length > 0 && (
            <section className="result-section">
              <div className="rs-head">
                <div className="rs-title">
                  <span className="ms" aria-hidden="true">
                    pool
                  </span>
                  수영장
                  <span className="rs-count">{venues.length}</span>
                </div>
              </div>
              {venues.map((venue) => (
                <Link
                  key={venue.venue_id}
                  href={`/venues/${venue.venue_id}`}
                  className="res-pool"
                >
                  <div className="rp-ico">
                    <span className="ms" aria-hidden="true">
                      pool
                    </span>
                  </div>
                  <div className="rp-info">
                    <div className="rp-pname">{venue.name}</div>
                    <div className="rp-paddr">{venue.region ?? "지역 미등록"}</div>
                  </div>
                </Link>
              ))}
            </section>
          )}
        </div>

        <aside className="sidebar">
          <div className="widget">
            <div className="widget-title">
              <span className="ms" aria-hidden="true">
                pool
              </span>
              인기 수영장
            </div>
            {venues.slice(0, 4).map((venue) => (
              <Link
                key={venue.venue_id}
                href={`/venues/${venue.venue_id}`}
                className="pool-item"
              >
                <div className="pi-ico">
                  <span className="ms" aria-hidden="true">
                    pool
                  </span>
                </div>
                <div>
                  <div className="pi-name">{venue.name}</div>
                  <div className="pi-addr">{venue.region ?? ""}</div>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
