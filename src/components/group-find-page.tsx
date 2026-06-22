"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { GroupMembershipRow } from "@/components/group-membership-row";
import { SiteGnb } from "@/components/layout/site-gnb";
import {
  DAY_OPTIONS,
  LEVEL_CHIPS,
  REGION1_OPTIONS,
  TIME_OPTIONS,
  daysKoFromValues,
  defaultRegion2For,
  getRegion2Options,
  levelPubLabel,
} from "@/lib/group-find/constants";
import { filterVenuesByRegionAndQuery } from "@/lib/group-find/venue-filter";
import {
  findGroup,
  getGroup,
  getGroupMembers,
  getMyGroups,
  listVenues,
  requestVenue,
  type GroupDetail,
  type GroupMember,
  type GroupMembership,
  type VenueItem,
} from "@/lib/api";
import { avatarInitial, avatarVariant } from "@/lib/format/relative-time";
import {
  MAX_MEMBERSHIPS,
  MAX_WAITING_GROUPS,
} from "@/lib/group-limits";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-group-find.css";
import "@/styles/weswim-group-membership.css";

type ResultState = "empty" | "found" | "waiting";

export function GroupFindPage() {
  const router = useRouter();

  const [venues, setVenues] = useState<VenueItem[]>([]);
  const [myGroups, setMyGroups] = useState<GroupMembership[]>([]);

  const [region1, setRegion1] = useState("seoul");
  const [region2, setRegion2] = useState("songpa");
  const [poolSearch, setPoolSearch] = useState("");
  const [venueId, setVenueId] = useState("");
  const [level, setLevel] = useState("beginner_2");
  const [days, setDays] = useState<string[]>(["tue", "thu"]);
  const [time, setTime] = useState("19:30");

  const [resultState, setResultState] = useState<ResultState>("empty");
  const [resultTitle, setResultTitle] = useState("조건을 선택해보세요");
  const [foundGroup, setFoundGroup] = useState<GroupDetail | null>(null);
  const [foundMembers, setFoundMembers] = useState<GroupMember[]>([]);
  const [waitingMessage, setWaitingMessage] = useState<string | null>(null);
  const [searchIsMember, setSearchIsMember] = useState(false);
  const [joining, setJoining] = useState(false);

  const [finding, setFinding] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [regName, setRegName] = useState("");
  const [regAddr, setRegAddr] = useState("");
  const [regNotice, setRegNotice] = useState(false);
  const [toastMulti, setToastMulti] = useState<{
    type: "ok" | "warn";
    title: string;
    sub: string;
  } | null>(null);

  const region1Label =
    REGION1_OPTIONS.find((r) => r.value === region1)?.label ?? "";
  const region2Options = useMemo(
    () => getRegion2Options(region1),
    [region1],
  );
  const region2Label =
    region2Options.find((r) => r.value === region2)?.label ?? "";
  const regionHint = `${region1Label.replace("특별시", "").replace("광역시", "").trim()} ${region2Label}`;

  const selectedVenue = venues.find((v) => v.venue_id === venueId);
  const levelLabel = levelPubLabel(level);
  const daysHint = daysKoFromValues(days) || "미선택";

  const filteredPools = useMemo(
    () =>
      filterVenuesByRegionAndQuery(venues, {
        region1,
        region2,
        query: poolSearch,
      }),
    [venues, region1, region2, poolSearch],
  );

  const similarPools = useMemo(() => {
    const q = poolSearch.trim();
    if (q.length < 2) {
      return [];
    }
    return venues
      .filter(
        (v) =>
          v.name.includes(q) ||
          (v.address ?? "").includes(q) ||
          (v.region ?? "").includes(q),
      )
      .slice(0, 5);
  }, [venues, poolSearch]);

  const stepDone = {
    region: Boolean(region1 && region2),
    pool: Boolean(venueId),
    level: Boolean(level),
    days: days.length > 0,
    time: Boolean(time),
  };

  const allStepsDone = Object.values(stepDone).every(Boolean);

  const loadInitial = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const venueList = await listVenues(undefined, session?.access_token, 100);
      setVenues(venueList);
      if (venueList.length > 0) {
        setVenueId((prev) => prev || venueList[0].venue_id);
      }

      if (session?.access_token) {
        const groups = await getMyGroups(session.access_token);
        setMyGroups(groups);
      }
    } catch {
      /* venues may be empty before seed */
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const opts = getRegion2Options(region1);
    setRegion2((current) => {
      if (opts.some((o) => o.value === current)) {
        return current;
      }
      return opts[0]?.value ?? defaultRegion2For(region1);
    });
  }, [region1]);

  useEffect(() => {
    if (
      filteredPools.length > 0 &&
      !filteredPools.some((p) => p.venue_id === venueId)
    ) {
      setVenueId(filteredPools[0].venue_id);
    }
  }, [filteredPools, venueId]);

  function toggleDay(value: string) {
    setDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
    setResultState("empty");
  }

  function showToastMulti(
    type: "ok" | "warn",
    title: string,
    sub: string,
  ) {
    setToastMulti({ type, title, sub });
    setTimeout(() => setToastMulti(null), 4500);
  }

  async function handleVenueRequest() {
    if (!regName.trim() || !regAddr.trim()) {
      return;
    }
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace("/login?next=/group/find");
        return;
      }

      const region = [
        REGION1_OPTIONS.find((r) => r.value === region1)?.label,
        region2Options.find((r) => r.value === region2)?.label,
      ]
        .filter(Boolean)
        .join(" ");
      const result = await requestVenue(
        {
          name: regName.trim(),
          address: regAddr.trim(),
          region,
        },
        session.access_token,
      );

      const venueList = await listVenues(undefined, session.access_token, 100);
      setVenues(venueList);
      setVenueId(result.venue_id);
      setRegOpen(false);
      setRegNotice(true);
      showToastMulti(
        "ok",
        result.message,
        "다른 회원 검색에는 확인 후 나타날 수 있어요.",
      );
      setRegName("");
      setRegAddr("");
    } catch (err) {
      showToastMulti(
        "warn",
        "등록 요청 실패",
        err instanceof Error ? err.message : "다시 시도해 주세요.",
      );
    }
  }

  async function getAccessToken(): Promise<string | null> {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      showToastMulti(
        "warn",
        "로그인이 필요해요",
        "로그인 후 대기방 만들기를 이어갈 수 있어요.",
      );
      router.replace("/login?next=/group/find");
      return null;
    }
    return session.access_token;
  }

  async function loadGroupPreview(
    groupId: string,
    accessToken: string,
    isMember: boolean,
  ) {
    const detail = await getGroup(groupId);
    setFoundGroup(detail);
    if (isMember) {
      const members = await getGroupMembers(groupId, accessToken);
      setFoundMembers(members);
    } else {
      setFoundMembers([]);
    }
    return detail;
  }

  async function handleFind() {
    if (!allStepsDone) {
      showToastMulti("warn", "조건을 모두 선택해 주세요", "지역·수영장·레벨·요일·시간을 확인해 주세요.");
      return;
    }

    setFinding(true);
    setSearchIsMember(false);
    try {
      const token = await getAccessToken();
      if (!token) {
        return;
      }

      const result = await findGroup(
        {
          venue_id: venueId,
          level,
          schedule: { days, time },
          create_if_missing: false,
          join: false,
        },
        token,
      );

      if (result.status === "not_found") {
        setFoundGroup(null);
        setFoundMembers([]);
        setResultState("waiting");
        setResultTitle("오리발 대기방 만들기");
        setWaitingMessage(result.message);
        showToastMulti(
          "ok",
          "이 시간대 반이 없어요",
          "대기방 만들기를 누르면 오리발 대기방이 생성돼요.",
        );
        return;
      }

      if (!result.group_id) {
        throw new Error("그룹 정보를 불러오지 못했습니다.");
      }

      const isMember = Boolean(result.is_member);
      setSearchIsMember(isMember);
      await loadGroupPreview(result.group_id, token, isMember);

      if (result.status === "active") {
        setResultState("found");
        setResultTitle("레인방을 찾았어요!");
        showToastMulti(
          "ok",
          result.message,
          isMember
            ? "이미 이 반에 소속되어 있어요."
            : "레인방 입장하기를 누르면 반에 합류할 수 있어요.",
        );
      } else {
        setResultState("waiting");
        setResultTitle(
          isMember ? "오리발 대기방" : "오리발 대기방 입장",
        );
        setWaitingMessage(result.message);
        showToastMulti(
          "ok",
          isMember ? "이미 대기방에 있어요" : result.message,
          isMember
            ? "멤버가 2명 이상 모이면 자동으로 활성화됩니다."
            : "대기방 만들기를 누르면 대기방에 입장할 수 있어요.",
        );
      }

    } catch (err) {
      showToastMulti(
        "warn",
        "반 찾기에 실패했어요",
        err instanceof Error ? err.message : "잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setFinding(false);
    }
  }

  async function handleJoinGroup(options?: { createIfMissing?: boolean }) {
    if (!allStepsDone) {
      showToastMulti(
        "warn",
        "조건을 모두 선택해 주세요",
        "지역·수영장·레벨·요일·시간을 확인해 주세요.",
      );
      return;
    }

    if (!searchIsMember) {
      if (!canJoinMore) {
        showToastMulti(
          "warn",
          "소속 한도에 도달했어요",
          `최대 ${MAX_MEMBERSHIPS}개 반까지 소속할 수 있어요.`,
        );
        return;
      }
      if (waitingCount >= MAX_WAITING_GROUPS) {
        showToastMulti(
          "warn",
          "대기방 한도에 도달했어요",
          `오리발 대기방은 최대 ${MAX_WAITING_GROUPS}개까지 만들 수 있어요.`,
        );
        return;
      }
    }

    setJoining(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        return;
      }

      const result = await findGroup(
        {
          venue_id: venueId,
          level,
          schedule: { days, time },
          create_if_missing: options?.createIfMissing ?? true,
          join: true,
        },
        token,
      );

      if (!result.group_id) {
        throw new Error("반 입장에 실패했습니다.");
      }

      await loadGroupPreview(result.group_id, token, true);
      setSearchIsMember(true);

      const groups = await getMyGroups(token);
      setMyGroups(groups);

      if (result.status === "active") {
        setResultState("found");
        setResultTitle("레인방을 찾았어요!");
        showToastMulti("ok", result.message, "우리반 페이지로 이동할 수 있어요.");
      } else {
        setResultState("waiting");
        setResultTitle("오리발 대기방");
        setWaitingMessage(result.message);
        showToastMulti(
          "ok",
          result.message,
          "멤버가 2명 이상 모이면 자동으로 활성화됩니다.",
        );
      }
    } catch (err) {
      showToastMulti(
        "warn",
        "입장에 실패했어요",
        err instanceof Error ? err.message : "잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setJoining(false);
    }
  }

  async function handleCreateWaiting() {
    await handleJoinGroup({ createIfMissing: true });
  }

  const membershipCount = myGroups.length;
  const waitingCount = myGroups.filter((g) => g.status === "waiting").length;
  const canJoinMore = membershipCount < MAX_MEMBERSHIPS;
  const canCreateWaiting =
    waitingCount < MAX_WAITING_GROUPS && canJoinMore;
  const slotsLeft = MAX_MEMBERSHIPS - membershipCount;

  return (
    <>
      <SiteGnb activeNav="group" />
      <div className="group-find-page">
        <div className="page">
          <div className="hero">
            <div className="hero-info">
              <div className="crumb">
                <Link href="/group">우리반</Link>
                <span className="ms sep" aria-hidden="true">
                  chevron_right
                </span>
                <b>반 찾기</b>
              </div>
              <h1>
                새로운 <span className="accent">레인방</span>을 찾아볼까요?
              </h1>
              <p className="sub">
                조건이 모두 일치하면 활동 중인 반을 찾아드려요. 반이 없으면{" "}
                <b>대기방 만들기</b>로 오리발 대기방을 생성할 수 있어요. 멤버가
                2명 이상이면 자동으로 활성화됩니다.
              </p>
            </div>

            {membershipCount > 0 && (
              <div className="current-class current-class-list">
                <div className="cc-info" style={{ flex: 1 }}>
                  <div className="cc-eb">
                    현재 소속 ({membershipCount}/{MAX_MEMBERSHIPS})
                    {waitingCount > 0
                      ? ` · 대기방 ${waitingCount}/${MAX_WAITING_GROUPS}`
                      : ""}
                  </div>
                  {myGroups.map((g) => (
                    <GroupMembershipRow
                      key={g.group_id}
                      group={g}
                      variant="history"
                      href={`/group?groupId=${g.group_id}`}
                    />
                  ))}
                </div>
                {canJoinMore && slotsLeft > 0 && (
                  <span className="cc-limit">+{slotsLeft} 가능</span>
                )}
              </div>
            )}
          </div>

          <div className="main">
            <section className="panel">
              <div className="panel-head">
                <span className="ms" aria-hidden="true">
                  tune
                </span>
                <h2>조건 선택</h2>
              </div>
              <div className="panel-body">
                <div className={`step${stepDone.region ? " done" : ""}`}>
                  <div className="step-head">
                    <span className="step-num">1</span>
                    <span className="step-label">지역</span>
                    <span className="step-hint">{regionHint}</span>
                  </div>
                  <div className="region-row">
                    <div className="input select">
                      <span className="ms" aria-hidden="true">
                        location_on
                      </span>
                      <select
                        value={region1}
                        onChange={(e) => {
                          const next = e.target.value;
                          setRegion1(next);
                          setRegion2(defaultRegion2For(next));
                          setResultState("empty");
                        }}
                      >
                        {REGION1_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="input select">
                      <span className="ms" aria-hidden="true">
                        apartment
                      </span>
                      <select
                        value={region2}
                        onChange={(e) => {
                          setRegion2(e.target.value);
                          setResultState("empty");
                        }}
                      >
                        {region2Options.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className={`step${stepDone.pool ? " done" : ""}`}>
                  <div className="step-head">
                    <span className="step-num">2</span>
                    <span className="step-label">수영장</span>
                    <span className="step-hint">
                      {selectedVenue?.name ?? "선택"}
                    </span>
                  </div>
                  <div className="input pool-search">
                    <span className="ms" aria-hidden="true">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="수영장 이름으로 검색"
                      value={poolSearch}
                      onChange={(e) => setPoolSearch(e.target.value)}
                    />
                  </div>
                  <div className="pool-list">
                    {filteredPools.length === 0 ? (
                      <p
                        style={{
                          padding: 16,
                          fontSize: 13,
                          color: "var(--gray-500)",
                        }}
                      >
                        조건에 맞는 수영장이 없습니다.
                      </p>
                    ) : (
                      filteredPools.map((pool) => (
                        <div
                          key={pool.venue_id}
                          role="button"
                          tabIndex={0}
                          className={`pool-item${venueId === pool.venue_id ? " on" : ""}`}
                          onClick={() => {
                            setVenueId(pool.venue_id);
                            setResultState("empty");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setVenueId(pool.venue_id);
                              setResultState("empty");
                            }
                          }}
                        >
                          <div className="p-ico">
                            <span className="ms" aria-hidden="true">
                              pool
                            </span>
                          </div>
                          <div className="p-info">
                            <div className="p-name">{pool.name}</div>
                            <div className="p-meta">
                              <span>{pool.address ?? pool.region ?? ""}</span>
                            </div>
                          </div>
                          <span className="ms p-check" aria-hidden="true">
                            check_circle
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    className="reg-link"
                    onClick={() => setRegOpen((o) => !o)}
                  >
                    <span className="ms" aria-hidden="true">
                      add_location_alt
                    </span>
                    우리 수영장이 없나요? 등록 요청하기
                  </button>

                  {similarPools.length > 0 && (
                    <div className="similar-pools show">
                      <div className="sp-label">
                        <span className="ms" aria-hidden="true">
                          search
                        </span>
                        혹시 이 수영장을 찾으시나요?
                      </div>
                      <div className="sp-list">
                        {similarPools.map((p) => (
                          <div key={p.venue_id} className="sp-item">
                            <div className="sp-ico">
                              <span className="ms" aria-hidden="true">
                                pool
                              </span>
                            </div>
                            <div className="sp-info">
                              <div className="sp-name">{p.name}</div>
                              <div className="sp-addr">
                                {p.address ?? p.region}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="sp-select-btn"
                              onClick={() => {
                                setVenueId(p.venue_id);
                                setPoolSearch(p.name);
                                setResultState("empty");
                              }}
                            >
                              이 수영장 선택
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="sp-new-btn"
                        onClick={() => setRegOpen(true)}
                      >
                        <span className="ms" aria-hidden="true">
                          add_location_alt
                        </span>
                        찾는 수영장이 없어요 — 직접 새로 등록하기
                      </button>
                    </div>
                  )}

                  {regNotice && (
                    <div className="reg-inline-notice show">
                      <div className="rin-line1">
                        <span className="ms" aria-hidden="true">
                          check_circle
                        </span>
                        등록됐어요. 지금 이 수영장으로 반 설정을 이어갈 수 있어요.
                      </div>
                      <div className="rin-line2">
                        다른 회원이 검색에서 찾으려면 확인 후 목록에 공개돼요.
                      </div>
                    </div>
                  )}

                  <div className={`reg-form${regOpen ? " show" : ""}`}>
                    <div className="reg-form-inner">
                      <div className="drag-handle" aria-hidden="true" />
                      <div className="reg-form-head">
                        <span className="ms" aria-hidden="true">
                          add_location_alt
                        </span>
                        <span className="rf-title">수영장 등록 요청</span>
                        <button
                          type="button"
                          className="rf-close"
                          aria-label="닫기"
                          onClick={() => setRegOpen(false)}
                        >
                          <span className="ms" aria-hidden="true">
                            close
                          </span>
                        </button>
                      </div>
                      <div className="reg-form-notice">
                        <span className="ms" aria-hidden="true">
                          info
                        </span>
                        <span>
                          이름과 주소를 입력해주세요. 등록 후{" "}
                          <b>확인 절차</b>를 거쳐 전체 목록에 공개됩니다.
                        </span>
                      </div>
                      <div className="field-mini">
                        <label htmlFor="regPoolName">수영장 이름</label>
                        <div className="input">
                          <span className="ms" aria-hidden="true">
                            pool
                          </span>
                          <input
                            id="regPoolName"
                            type="text"
                            placeholder="예: 한강시민수영장"
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="field-mini">
                        <label htmlFor="regPoolAddr">주소</label>
                        <div className="input">
                          <span className="ms" aria-hidden="true">
                            location_on
                          </span>
                          <input
                            id="regPoolAddr"
                            type="text"
                            placeholder="시/도, 구/군 포함된 도로명/지번 주소"
                            value={regAddr}
                            onChange={(e) => setRegAddr(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="reg-form-actions">
                        <button
                          type="button"
                          className="btn-cancel"
                          onClick={() => setRegOpen(false)}
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          className="btn-submit"
                          disabled={!regName.trim() || !regAddr.trim()}
                          onClick={() => void handleVenueRequest()}
                        >
                          <span className="ms" aria-hidden="true">
                            send
                          </span>
                          등록 요청하기
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`step${stepDone.level ? " done" : ""}`}>
                  <div className="step-head">
                    <span className="step-num">3</span>
                    <span className="step-label">레벨</span>
                    <span className="step-hint">{levelLabel}</span>
                  </div>
                  <div className="chip-row">
                    {LEVEL_CHIPS.map((chip) => (
                      <button
                        key={chip.api}
                        type="button"
                        className={`chip${level === chip.api ? " on" : ""}`}
                        onClick={() => {
                          setLevel(chip.api);
                          setResultState("empty");
                        }}
                      >
                        {chip.pub}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`step${stepDone.days ? " done" : ""}`}>
                  <div className="step-head">
                    <span className="step-num">4</span>
                    <span className="step-label">요일</span>
                    <span className="step-hint">{daysHint}</span>
                  </div>
                  <div className="day-row">
                    {DAY_OPTIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        className={`day${d.wknd ? " wknd" : ""}${days.includes(d.value) ? " on" : ""}`}
                        onClick={() => toggleDay(d.value)}
                      >
                        {d.ko}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`step${stepDone.time ? " done" : ""}`}>
                  <div className="step-head">
                    <span className="step-num">5</span>
                    <span className="step-label">시간</span>
                    <span className="step-hint">{time}</span>
                  </div>
                  <div className="time-row">
                    <div className="input select">
                      <span className="ms" aria-hidden="true">
                        schedule
                      </span>
                      <select
                        value={time}
                        onChange={(e) => {
                          setTime(e.target.value);
                          setResultState("empty");
                        }}
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="input">
                      <span className="ms" aria-hidden="true">
                        timer
                      </span>
                      <span style={{ fontSize: 13, color: "var(--gray-500)" }}>
                        50분 / 자동
                      </span>
                    </div>
                  </div>
                  <div className="time-presets">
                    <button
                      type="button"
                      className="time-preset"
                      onClick={() => {
                        setTime("06:00");
                        setResultState("empty");
                      }}
                    >
                      <span className="ms" aria-hidden="true">
                        wb_twilight
                      </span>
                      새벽 (06:00)
                    </button>
                    <button
                      type="button"
                      className="time-preset"
                      onClick={() => {
                        setTime("10:00");
                        setResultState("empty");
                      }}
                    >
                      <span className="ms" aria-hidden="true">
                        light_mode
                      </span>
                      오전 (10:00)
                    </button>
                    <button
                      type="button"
                      className="time-preset"
                      onClick={() => {
                        setTime("19:00");
                        setResultState("empty");
                      }}
                    >
                      <span className="ms" aria-hidden="true">
                        bedtime
                      </span>
                      저녁 (19:00)
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="find-btn"
                  disabled={finding || !canJoinMore}
                  onClick={() => void handleFind()}
                >
                  <span className="ms" aria-hidden="true">
                    travel_explore
                  </span>
                  {finding ? "찾는 중…" : "반 찾기"}
                </button>
                {!canJoinMore && (
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "var(--coral-dark)",
                      textAlign: "center",
                    }}
                  >
                    최대 {MAX_MEMBERSHIPS}개 반까지 소속할 수 있어요.
                  </p>
                )}
              </div>
            </section>

            <aside className="panel result-panel">
              <div className="result-deco">
                <div className="lane-stripes" aria-hidden="true">
                  <div />
                  <div />
                  <div />
                </div>
                <div className="label">실시간 결과</div>
                <div className="title">{resultTitle}</div>
              </div>

              <div
                className={`result-state${resultState === "empty" ? " active" : ""}`}
                data-state="empty"
              >
                <div className="empty">
                  <div className="empty-illo">
                    <span className="ms" aria-hidden="true">
                      pool
                    </span>
                  </div>
                  <h3>조건을 모두 선택하면 결과가 보여요</h3>
                  <p>
                    같은 <b>수영장 + 레벨 + 요일 + 시간</b> 조합의 레인방이 있는지
                    확인해드릴게요.
                  </p>
                  <div className="checklist">
                    {(
                      [
                        ["지역", regionHint],
                        ["수영장", selectedVenue?.name ?? "—"],
                        ["레벨", levelLabel],
                        ["요일", daysHint],
                        ["시간", time],
                      ] as const
                    ).map(([lbl, val]) => {
                      const done =
                        (lbl === "지역" && stepDone.region) ||
                        (lbl === "수영장" && stepDone.pool) ||
                        (lbl === "레벨" && stepDone.level) ||
                        (lbl === "요일" && stepDone.days) ||
                        (lbl === "시간" && stepDone.time);
                      return (
                        <div
                          key={lbl}
                          className={`check-item${done ? " done" : ""}`}
                        >
                          <span className="ms" aria-hidden="true">
                            check
                          </span>
                          <span className="lbl">{lbl}</span>
                          <span className="val">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div
                className={`result-state${resultState === "found" ? " active" : ""}`}
                data-state="found"
              >
                {foundGroup && (
                  <div className="found-card">
                    <div className="found-head">
                      <span className="found-badge">
                        <span className="ms" aria-hidden="true">
                          check
                        </span>
                        레인방 발견
                      </span>
                    </div>
                    <div className="found-title">
                      <span className="accent">
                        {foundGroup.venue_name?.slice(0, 6) ?? "레인"}
                      </span>{" "}
                      {levelPubLabel(foundGroup.level)}반 · {daysHint} {time}
                    </div>
                    <div className="found-sub">
                      {foundGroup.venue_name} — 이미 활동 중인 반이라 지금 바로
                      입장할 수 있어요.
                    </div>
                    <div className="found-stats">
                      <div className="fs-cell">
                        <div className="v">{foundGroup.member_count}</div>
                        <div className="l">현재 멤버</div>
                      </div>
                      <div className="fs-cell">
                        <div className="v">—</div>
                        <div className="l">활동 기간</div>
                      </div>
                      <div className="fs-cell">
                        <div className="v">—</div>
                        <div className="l">평균 출석</div>
                      </div>
                    </div>
                    {foundMembers.length > 0 && (
                      <div className="members-preview">
                        <div className="mp-head">
                          <div className="mp-title">
                            <span className="ms" aria-hidden="true">
                              groups
                            </span>
                            활동 멤버
                          </div>
                          <Link className="mp-link" href="/group">
                            전체 보기 →
                          </Link>
                        </div>
                        <div className="av-stack">
                          {foundMembers.slice(0, 4).map((m) => (
                            <span
                              key={m.user_id}
                              className={`av ${avatarVariant(m.nickname)}`}
                            >
                              {avatarInitial(m.nickname)}
                            </span>
                          ))}
                          {foundMembers.length > 4 && (
                            <span className="av more">
                              +{foundMembers.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="found-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          setResultState("empty");
                          setResultTitle("조건을 선택해보세요");
                        }}
                      >
                        뒤로
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={joining}
                        onClick={() => {
                          if (searchIsMember) {
                            router.push("/group");
                            return;
                          }
                          void handleJoinGroup({ createIfMissing: true });
                        }}
                      >
                        <span className="ms" aria-hidden="true">
                          login
                        </span>
                        {joining
                          ? "입장 중…"
                          : searchIsMember
                            ? "우리반으로 이동"
                            : "레인방 입장하기"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div
                className={`result-state${resultState === "waiting" ? " active" : ""}`}
                data-state="waiting"
              >
                <div className="waiting-card">
                  <span className="waiting-badge">
                    <span className="ms" aria-hidden="true">
                      hourglass_top
                    </span>
                    오리발 대기방
                  </span>
                  <div className="waiting-title">
                    아직 이 시간대 <span className="accent">반이 없어요</span>
                  </div>
                  <div className="waiting-sub">
                    {waitingMessage ??
                      `동일 조합 (${selectedVenue?.name ?? ""} · ${levelLabel} · ${daysHint} · ${time})의 활동 중인 반은 없지만, 같은 조건의 다른 멤버가 들어오면 자동으로 매칭돼요.`}
                  </div>
                  <div className="activation-rule">
                    <div className="ico">
                      <span className="ms" aria-hidden="true">
                        auto_awesome
                      </span>
                    </div>
                    <div className="ar-text">
                      <div className="ar-t">멤버 2명부터 자동 활성화</div>
                      <div className="ar-s">
                        두 번째 멤버 입장 시 잡담/공지/에티켓 3채널이 모두 열려요.
                        활성화 시점에 알림으로 알려드릴게요.
                      </div>
                    </div>
                  </div>
                  {!searchIsMember && !canCreateWaiting && (
                    <p
                      style={{
                        marginBottom: 12,
                        fontSize: 12,
                        color: "var(--coral-dark)",
                        lineHeight: 1.5,
                      }}
                    >
                      {!canJoinMore
                        ? `최대 ${MAX_MEMBERSHIPS}개 반까지 소속할 수 있어요.`
                        : `오리발 대기방은 최대 ${MAX_WAITING_GROUPS}개까지 만들 수 있어요.`}
                    </p>
                  )}
                  <div className="found-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setResultState("empty");
                        setResultTitle("조건을 선택해보세요");
                      }}
                    >
                      조건 바꾸기
                    </button>
                    <button
                      type="button"
                      className="btn btn-accent"
                      disabled={joining}
                      onClick={() => {
                        if (searchIsMember) {
                          showToastMulti(
                            "ok",
                            "이미 대기방에 있어요",
                            "우리반 페이지로 이동합니다.",
                          );
                          router.push("/group");
                          return;
                        }
                        void handleCreateWaiting();
                      }}
                    >
                      <span className="ms" aria-hidden="true">
                        add
                      </span>
                      {joining
                        ? "처리 중…"
                        : searchIsMember
                          ? "우리반으로 이동"
                          : "대기방 만들기"}
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div
          className={`reg-backdrop${regOpen ? " show" : ""}`}
          role="presentation"
          onClick={() => setRegOpen(false)}
        />

        <div className={`toast-multi${toastMulti ? " show" : ""}`}>
          <div className={`tm-ico ${toastMulti?.type === "ok" ? "ok" : "warn"}`}>
            <span className="ms" aria-hidden="true">
              {toastMulti?.type === "ok" ? "check" : "warning"}
            </span>
          </div>
          <div className="tm-body">
            <div className="tm-title">{toastMulti?.title}</div>
            <div className="tm-sub">{toastMulti?.sub}</div>
          </div>
        </div>

      </div>
    </>
  );
}
