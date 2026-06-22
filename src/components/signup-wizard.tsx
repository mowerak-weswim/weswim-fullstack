"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DAY_OPTIONS,
  LEVEL_CHIPS,
  REGION1_OPTIONS,
  TIME_OPTIONS,
  defaultRegion2For,
  getRegion2Options,
} from "@/lib/group-find/constants";
import {
  filterVenuesByRegionAndQuery,
} from "@/lib/group-find/venue-filter";
import {
  findGroup,
  listVenues,
  requestVenue,
  updateMyProfile,
  type VenueItem,
} from "@/lib/api";
import { upsertUserProfile } from "@/lib/auth/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import { SignupCompleteView } from "@/components/signup-complete-view";

import "@/styles/weswim-signup.css";

const STEPS = [
  { title: "기본 정보", subtitle: "닉네임 · 이메일 · 비밀번호" },
  { title: "회원 유형", subtitle: "일반 · 강사" },
  { title: "수영장 선택", subtitle: "지역 · 수영장" },
  { title: "강습반 선택", subtitle: "레벨 · 요일 · 시간" },
] as const;

function passwordStrength(pw: string): number {
  if (pw.length < 8) {
    return 0;
  }
  let score = 1;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) {
    score += 1;
  }
  if (pw.length >= 12) {
    score += 1;
  }
  return score;
}

function strengthLabel(level: number): string {
  if (level <= 0) {
    return "너무 짧아요";
  }
  if (level === 1) {
    return "보통";
  }
  return "안전해요";
}

function SignupBrandPanel({ currentStep }: { currentStep: number }) {
  return (
    <aside className="brand">
      <div className="logo">
        <span className="We">We</span>
        <span className="Swim">Swim</span>
      </div>
      <div className="brand-tag">나만의 레인, 우리들의 수영장</div>
      <p className="stepper-eyebrow">Sign up · 4 Steps</p>
      <h2 className="stepper-title">
        <span className="accent">3분</span>이면 충분해요.
        <br />
        레인방까지 함께 가요.
      </h2>
      <div className="stepper">
        {STEPS.map((s, index) => {
          const n = index + 1;
          const state =
            currentStep > n ? "done" : currentStep === n ? "current" : "wait";
          return (
            <div key={s.title} className={`step ${state}`}>
              <div className="num">
                {state === "done" ? (
                  <span className="ms" aria-hidden="true">
                    check
                  </span>
                ) : (
                  n
                )}
              </div>
              <div className="info">
                <div className="t">{s.title}</div>
                <div className="s">{s.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="brand-bot">
        <span>© 2026 WeSwim</span>
        <span>
          이미 회원이신가요? <Link href="/login">로그인</Link>
        </span>
      </div>
    </aside>
  );
}

export function SignupWizard() {
  const [step, setStep] = useState(1);
  const [complete, setComplete] = useState(false);
  const [groupStatus, setGroupStatus] = useState("active");

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [userType, setUserType] = useState<"member" | "instructor" | null>(null);

  const [venues, setVenues] = useState<VenueItem[]>([]);
  const [region1, setRegion1] = useState("seoul");
  const [region2, setRegion2] = useState("songpa");
  const [poolSearch, setPoolSearch] = useState("");
  const [venueId, setVenueId] = useState("");
  /** 사용자가 목록·등록 요청으로 직접 고른 경우만 true (자동 선택 없음) */
  const [venuePicked, setVenuePicked] = useState(false);

  const [level, setLevel] = useState("beginner_2");
  const [days, setDays] = useState<string[]>(["mon", "wed", "fri"]);
  const [time, setTime] = useState("07:00");

  const [findMessage, setFindMessage] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [regOpen, setRegOpen] = useState(false);
  const [regName, setRegName] = useState("");
  const [regAddr, setRegAddr] = useState("");
  const [venuesLoading, setVenuesLoading] = useState(false);

  const progressPct = complete ? 100 : (step / STEPS.length) * 100;

  const region2Options = useMemo(
    () => getRegion2Options(region1),
    [region1],
  );

  const filteredPools = useMemo(
    () =>
      filterVenuesByRegionAndQuery(venues, {
        region1,
        region2,
        query: poolSearch,
      }),
    [venues, region1, region2, poolSearch],
  );

  const selectedVenue = venues.find((v) => v.venue_id === venueId);
  const venueInFilteredList = filteredPools.some((v) => v.venue_id === venueId);
  const step3Valid = venuePicked && venueInFilteredList;

  const pwStrength = passwordStrength(password);

  const step1Valid =
    nickname.trim().length >= 2 &&
    email.includes("@") &&
    pwStrength >= 2 &&
    password === password2;

  const loadVenues = useCallback(async (searchQuery?: string) => {
    setVenuesLoading(true);
    try {
      const list = await listVenues(searchQuery, undefined, 100);
      setVenues(list);
    } catch {
      setVenues([]);
    } finally {
      setVenuesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === 3) {
      void loadVenues();
    }
  }, [step, loadVenues]);

  useEffect(() => {
    const opts = getRegion2Options(region1);
    setRegion2((current) => {
      if (opts.some((o) => o.value === current)) {
        return current;
      }
      setVenueId("");
      setVenuePicked(false);
      return opts[0]?.value ?? defaultRegion2For(region1);
    });
  }, [region1]);

  useEffect(() => {
    if (!venueId) {
      return;
    }
    if (!filteredPools.some((v) => v.venue_id === venueId)) {
      setVenueId("");
      setVenuePicked(false);
    }
  }, [filteredPools, venueId]);

  function selectPool(id: string) {
    setVenueId(id);
    setVenuePicked(true);
    setErrorMessage(null);
  }

  function toggleDay(value: string) {
    setDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  async function handleVenueRequest() {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setErrorMessage("수영장 등록은 가입 완료 후 이용할 수 있어요.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const r1 = REGION1_OPTIONS.find((r) => r.value === region1);
      const res = await requestVenue(
        { name: regName.trim(), address: regAddr.trim(), region: r1?.label },
        session.access_token,
      );
      setVenueId(res.venue_id);
      setVenuePicked(true);
      await loadVenues();
      setRegOpen(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "등록 요청 실패");
    } finally {
      setLoading(false);
    }
  }

  async function finishSignup() {
    if (!step3Valid || days.length === 0) {
      setErrorMessage(
        !step3Valid
          ? "수영장을 목록에서 선택해 주세요."
          : "요일을 선택해 주세요.",
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setFindMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nickname } },
      });

      if (error) {
        throw error;
      }

      if (!data.session?.access_token) {
        setErrorMessage(
          "이메일 인증이 필요합니다. 인증 후 로그인하여 반 찾기를 이어주세요.",
        );
        return;
      }

      const token = data.session.access_token;

      if (data.user) {
        const profileResult = await upsertUserProfile(supabase, {
          userId: data.user.id,
          email,
          nickname,
        });
        if (!profileResult.ok) {
          throw new Error(profileResult.message);
        }
      }

      if (userType) {
        await updateMyProfile({ user_type: userType, level }, token);
      }

      const findRes = await findGroup(
        {
          venue_id: venueId,
          level,
          schedule: { days, time },
          create_if_missing: true,
          join: true,
        },
        token,
      );

      if (!findRes.group_id) {
        throw new Error("반 찾기에 실패했습니다.");
      }
      setGroupId(findRes.group_id);
      setGroupStatus(findRes.status ?? "active");
      setFindMessage(findRes.message);
      setComplete(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (complete) {
    return (
      <SignupCompleteView
        nickname={nickname}
        venueName={selectedVenue?.name ?? "수영장"}
        level={level}
        days={days}
        time={time}
        groupId={groupId}
        groupStatus={groupStatus}
      />
    );
  }

  return (
    <main className="shell">
      <SignupBrandPanel currentStep={step} />

      <section className="form-side">
        <div className="form-top">
          <button
            type="button"
            className="btn-back"
            disabled={step <= 1 || loading}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            <span className="ms" aria-hidden="true">
              arrow_back
            </span>
            이전
          </button>
          <div className="help">
            도움이 필요하신가요? <Link href="/search">고객센터</Link>
          </div>
        </div>

        <div className="progress">
          <div
            className="progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="progress-meta">
          <span>
            Step {step} / {STEPS.length}
          </span>
          <span>{STEPS[step - 1]?.title}</span>
        </div>

        {errorMessage && (
          <div className="alert-error" style={{ marginTop: 16 }}>
            {errorMessage}
          </div>
        )}

        <div className="form-card">
          <div className={`panel${step === 1 ? " active" : ""}`}>
            <h1>기본 정보를 입력해주세요</h1>
            <p className="sub">레인방에 들어가려면 닉네임, 이메일, 비밀번호가 필요해요.</p>
            <div className="field">
              <label className="label" htmlFor="su-nickname">
                닉네임
              </label>
              <div className="input">
                <span className="ms" aria-hidden="true">
                  face
                </span>
                <input
                  id="su-nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="4~20자 (한글·영문·숫자)"
                  maxLength={20}
                />
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="su-email">
                이메일
              </label>
              <div className="input">
                <span className="ms" aria-hidden="true">
                  mail
                </span>
                <input
                  id="su-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일 주소"
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="su-password">
                비밀번호
              </label>
              <div className="input">
                <span className="ms" aria-hidden="true">
                  lock
                </span>
                <input
                  id="su-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상, 영문+숫자 포함"
                />
                <button
                  type="button"
                  className="toggle-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="비밀번호 표시"
                >
                  <span className="ms" aria-hidden="true">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {password.length > 0 ? (
                <div className="strength">
                  <div
                    className="strength-bars"
                    data-level={pwStrength || 1}
                  >
                    <div className="seg" />
                    <div className="seg" />
                    <div className="seg" />
                  </div>
                  <div className="strength-text">{strengthLabel(pwStrength)}</div>
                </div>
              ) : null}
            </div>
            <div className="field">
              <label className="label" htmlFor="su-password2">
                비밀번호 확인
              </label>
              <div
                className={`input${password2 && password !== password2 ? " err" : password2 && password === password2 ? " ok" : ""}`}
              >
                <span className="ms" aria-hidden="true">
                  lock_reset
                </span>
                <input
                  id="su-password2"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="비밀번호 재입력"
                />
              </div>
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
              >
                다음 단계로
              </button>
            </div>
          </div>

          <div className={`panel${step === 2 ? " active" : ""}`}>
            <h1>어떤 분이신가요?</h1>
            <p className="sub">
              회원 유형은 가입 후에도 마이페이지에서 언제든 변경할 수 있어요.
            </p>
            <div className="role-grid">
              {(
                [
                  ["member", "pool", "일반 회원", "수영을 즐기는 수강생 / 자유 수영러"],
                  [
                    "instructor",
                    "workspace_premium",
                    "강사 회원",
                    "수영 강습을 지도하는 강사",
                  ],
                ] as const
              ).map(([role, icon, name, sub]) => (
                <div
                  key={role}
                  className={`role-card${userType === role ? " on" : ""}`}
                  onClick={() => setUserType(role)}
                  onKeyDown={(e) => e.key === "Enter" && setUserType(role)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="check">
                    <span className="ms" aria-hidden="true">
                      check
                    </span>
                  </div>
                  <div className="ico">
                    <span className="ms" aria-hidden="true">
                      {icon}
                    </span>
                  </div>
                  <div>
                    <div className="role-name">{name}</div>
                    <div className="role-sub">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className={`notice${userType === "instructor" ? " show" : ""}`}>
              <b>강사 뱃지는 자기신고제예요.</b> 강사실 게시판에 글을 쓸 수 있고, 강사
              마크가 함께 표시돼요. 허위 신고가 누적되면 이용이 제한될 수 있어요.
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!userType}
                onClick={() => setStep(3)}
              >
                다음 단계로
              </button>
            </div>
          </div>

          <div className={`panel${step === 3 ? " active" : ""}`}>
            <h1>수영장을 선택해주세요</h1>
            <p className="sub">
              지역을 먼저 선택한 뒤 수영장을 찾아보세요. 없으면 직접 등록 요청할 수
              있어요.
            </p>
            <div className="region-row">
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label">시 / 도</label>
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
                      setVenueId("");
                      setVenuePicked(false);
                    }}
                  >
                    {REGION1_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label">시 / 군 / 구</label>
                <div className="input select">
                  <span className="ms" aria-hidden="true">
                    location_on
                  </span>
                  <select
                    value={region2}
                    onChange={(e) => {
                      setRegion2(e.target.value);
                      setVenueId("");
                      setVenuePicked(false);
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
            <div className="field">
              <label className="label">수영장 검색</label>
              <div className="input">
                <span className="ms" aria-hidden="true">
                  search
                </span>
                <input
                  value={poolSearch}
                  onChange={(e) => setPoolSearch(e.target.value)}
                  placeholder="수영장 이름 또는 지역"
                />
              </div>
            </div>
            <div
              className={`notice${!venuePicked ? " show" : ""}`}
              style={{ marginBottom: 12 }}
            >
              아래 목록에서 <b>수영장을 탭해 선택</b>해 주세요. 선택 전에는 다음
              단계로 이동할 수 없어요.
            </div>
            <div className="pool-list">
              {venuesLoading ? (
                <p
                  style={{
                    padding: "16px",
                    margin: 0,
                    fontSize: 13,
                    color: "var(--gray-500)",
                    textAlign: "center",
                  }}
                >
                  수영장 목록을 불러오는 중…
                </p>
              ) : filteredPools.length === 0 ? (
                <p
                  style={{
                    padding: "16px",
                    margin: 0,
                    fontSize: 13,
                    color: "var(--gray-500)",
                    textAlign: "center",
                  }}
                >
                  선택한 지역과 검색어에 모두 맞는 수영장이 없어요. 지역·검색어를
                  바꾸거나 등록 요청을 이용해 주세요.
                </p>
              ) : (
                filteredPools.map((v) => (
                <div
                  key={v.venue_id}
                  className={`pool-item${venueId === v.venue_id && venuePicked ? " on" : ""}`}
                  onClick={() => selectPool(v.venue_id)}
                  onKeyDown={(e) => e.key === "Enter" && selectPool(v.venue_id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="p-ico">
                    <span className="ms" aria-hidden="true">
                      pool
                    </span>
                  </div>
                  <div className="p-info">
                    <div className="p-name">{v.name}</div>
                    <div className="p-addr">{v.address ?? v.region ?? ""}</div>
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
              className="pool-link"
              style={{ border: "none", background: "transparent", font: "inherit" }}
              onClick={() => setRegOpen((o) => !o)}
            >
              <span className="ms" aria-hidden="true">
                add_location_alt
              </span>
              우리 수영장이 없나요? 등록 요청하기
            </button>
            <div className={`request-form${regOpen ? " show" : ""}`}>
                <div className="field">
                  <label className="label">수영장 이름</label>
                  <div className="input">
                    <input
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="field">
                  <label className="label">주소</label>
                  <div className="input">
                    <input
                      value={regAddr}
                      onChange={(e) => setRegAddr(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={
                    loading || regName.trim().length < 2 || regAddr.trim().length < 5
                  }
                  onClick={() => void handleVenueRequest()}
                >
                  등록 요청하기
                </button>
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!step3Valid}
                onClick={() => {
                  if (!step3Valid) {
                    setErrorMessage("수영장을 목록에서 선택해 주세요.");
                    return;
                  }
                  setStep(4);
                }}
              >
                다음 단계로
              </button>
            </div>
          </div>

          <div className={`panel${step === 4 ? " active" : ""}`}>
            <h1>강습반을 선택해주세요</h1>
            <p className="sub">레벨, 요일, 시간을 선택하면 동일 조합의 레인방을 찾아드려요.</p>
            <div className="field">
              <label className="label">레벨</label>
              <div className="chip-row">
                {LEVEL_CHIPS.map((chip) => (
                  <button
                    key={chip.api}
                    type="button"
                    className={`chip${level === chip.api ? " on" : ""}`}
                    onClick={() => setLevel(chip.api)}
                  >
                    {chip.pub}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="label">요일</label>
              <div className="day-row">
                {DAY_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={`day${days.includes(d.value) ? " on" : ""}`}
                    onClick={() => toggleDay(d.value)}
                  >
                    {d.ko}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="label">시간</label>
              <div className="input select">
                <select value={time} onChange={(e) => setTime(e.target.value)}>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {findMessage && (
              <div className="result found show">
                <div className="r-head">
                  <div className="r-ico">
                    <span className="ms" aria-hidden="true">
                      groups
                    </span>
                  </div>
                  <div className="r-title">레인방을 찾았어요</div>
                </div>
                <div className="r-body">
                  <b>{findMessage}</b>
                </div>
              </div>
            )}
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading || days.length === 0}
                onClick={() => void finishSignup()}
              >
                {loading ? "가입 중…" : "가입 완료 · 반 찾기"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
