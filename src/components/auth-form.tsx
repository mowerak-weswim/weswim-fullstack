"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { upsertUserProfile } from "@/lib/auth/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import "@/styles/weswim-login.css";

function LoginBrandPanel() {
  return (
    <aside className="brand">
      <div className="brand-top">
        <div className="logo">
          <span className="We">We</span>
          <span className="Swim">Swim</span>
        </div>
      </div>

      <div className="brand-mid">
        <div className="quote-eyebrow">나만의 레인, 우리들의 수영장</div>
        <h2 className="quote">
          물속에선 말이 없지만,
          <br />
          밖에선 <span className="accent">한 레인</span>이에요.
        </h2>
        <p className="quote-sub">
          같은 반 사람들과 수업 후기를 나누고, 오늘 채운 거리를 기록으로
          남겨요. WeSwim은 수영의 물리적 한계를 디지털로 잇는 커뮤니티예요.
        </p>
      </div>

      <div className="brand-bot">
        <div className="stat">
          <b>2,400+</b>
          <span>활동 레인방</span>
        </div>
        <div className="stat">
          <b>180+</b>
          <span>등록 수영장</span>
        </div>
        <div className="stat">
          <b>매일</b>
          <span>새 기록 갱신</span>
        </div>
      </div>

      <div className="lanes" aria-hidden="true">
        <div className="lane-line" />
        <div className="lane-line" />
        <div className="lane-line" />
        <div className="lane-line" />
      </div>
    </aside>
  );
}

export function AuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        const resolvedNickname =
          (data.user.user_metadata?.nickname as string | undefined) ??
          email.split("@")[0];

        const profileResult = await upsertUserProfile(supabase, {
          userId: data.user.id,
          email: data.user.email ?? email,
          nickname: resolvedNickname,
        });

        if (!profileResult.ok) {
          throw new Error(profileResult.message);
        }
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "이메일 또는 비밀번호가 일치하지 않아요",
      );
    } finally {
      setLoading(false);
    }
  }

  const hasInput = email.trim().length > 0 && password.trim().length > 0;

  function handleSocialKakao() {
    setErrorMessage("카카오 로그인은 준비 중입니다. 이메일로 로그인해 주세요.");
  }

  function handleSocialEmailFocus() {
    document.getElementById("email")?.focus();
  }

  return (
    <main className="login-screen shell">
      <LoginBrandPanel />

      <section className="form-side">
        <div className="form-top">
          <span />
          <div className="help">
            처음이신가요?
            <Link href="/signup">회원가입</Link>
          </div>
        </div>

        <div className="form-card">
          <h1>다시 만나서 반가워요</h1>
          <p className="sub">
            레인방과 나의 레인이 기다리고 있어요. 이메일로 로그인해 주세요.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label className="label" htmlFor="email">
                이메일
              </label>
              <div
                className={`input${errorMessage ? " err" : ""}`}
                id="emailWrap"
              >
                <span className="ms" aria-hidden="true">
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="이메일 주소를 입력해주세요"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="password">
                비밀번호
              </label>
              <div
                className={`input${errorMessage ? " err" : ""}`}
                id="pwWrap"
              >
                <span className="ms" aria-hidden="true">
                  lock
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="비밀번호를 입력해주세요"
                  autoComplete="current-password"
                  required
                  minLength={6}
                />
                <button
                  className="toggle-eye"
                  aria-label={
                    showPassword ? "비밀번호 숨기기" : "비밀번호 보기"
                  }
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  <span className="ms" aria-hidden="true">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {errorMessage ? (
                <div className="err-msg show">
                  <span className="ms" aria-hidden="true">
                    error
                  </span>
                  {errorMessage}
                </div>
              ) : null}
            </div>

            <div className="row-between">
              <label className="checkbox">
                <input
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  type="checkbox"
                />
                로그인 상태 유지
              </label>
              <a className="forgot" href="#forgot">
                비밀번호를 잊으셨나요?
              </a>
            </div>

            <button
              className="btn-login"
              disabled={loading || !hasInput}
              type="submit"
            >
              {loading ? "처리 중..." : "로그인"}
            </button>

            <div className="divider">또는</div>

            <div className="social-row">
              <button
                className="btn-social"
                type="button"
                onClick={handleSocialKakao}
              >
                <span
                  className="ms"
                  style={{ color: "#F4B740" }}
                  aria-hidden="true"
                >
                  chat_bubble
                </span>
                카카오로 계속하기
              </button>
              <button
                className="btn-social"
                type="button"
                onClick={handleSocialEmailFocus}
              >
                <span
                  className="ms"
                  style={{ color: "var(--gray-700)" }}
                  aria-hidden="true"
                >
                  alternate_email
                </span>
                이메일로 계속하기
              </button>
            </div>
          </form>
        </div>

        <div className="form-bot">
          <span>© 2026 WeSwim · by SpotTalk</span>
          <div>
            <a href="#terms">서비스 약관</a>
            <a href="#privacy">개인정보 처리방침</a>
            <a href="#help">고객센터</a>
          </div>
        </div>
      </section>
    </main>
  );
}
