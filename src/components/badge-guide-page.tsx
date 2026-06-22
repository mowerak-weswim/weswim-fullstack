"use client";

import { SiteGnb } from "@/components/layout/site-gnb";

const GUIDE_CSS = `
.badge-guide-screen{--navy:#1B3A5C;--navy-dark:#142D47;--navy-light:#E8EEF4;--aqua:#0096A0;--aqua-hover:#00A8B5;--aqua-dark:#006970;--aqua-light:#E6F6F7;--aqua-whisper:#F2FBFC;--coral:#E8734A;--coral-dark:#C45A33;--coral-light:#FDF0EB;--mint:#7DD3C8;--mint-light:#E8F7F4;--sun:#F4B740;--sun-light:#FCF1D8;--bg:#F5F7FA;--white:#FFFFFF;--gray-100:#ECEFF4;--gray-200:#D0D7E2;--gray-300:#B4BECD;--gray-500:#6B7A99;--gray-700:#3D4A66;--text-main:#1A1A2E;--font-sans:'Pretendard Variable','Pretendard','Helvetica Neue',sans-serif;--font-display:'Helvetica Neue','Pretendard Variable',sans-serif;font-family:var(--font-sans);color:var(--text-main);background:var(--bg)}
.badge-guide-screen *,.badge-guide-screen *::before,.badge-guide-screen *::after{box-sizing:border-box;margin:0;padding:0}
.badge-guide-screen .ms{font-family:'Material Symbols Rounded';font-weight:500;font-style:normal;display:inline-flex;align-items:center;justify-content:center;line-height:1;text-transform:none;white-space:nowrap;-webkit-font-smoothing:antialiased;font-feature-settings:'liga';vertical-align:middle;font-size:20px;font-variation-settings:'opsz' 24,'wght' 500,'FILL' 0,'GRAD' 0}
.badge-guide-screen button{font-family:inherit;cursor:pointer}
.badge-guide-screen a{color:inherit;text-decoration:none}
.badge-guide-screen .sub-header{background:var(--white);border-bottom:1px solid var(--gray-200)}
.badge-guide-screen .sub-header-inner{max-width:1200px;margin:0 auto;padding:0 32px;height:52px;display:flex;align-items:center;gap:8px}
.badge-guide-screen .sub-breadcrumb{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--gray-500)}
.badge-guide-screen .sub-breadcrumb .cur{color:var(--navy);font-weight:700}
.badge-guide-screen .sub-header-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.badge-guide-screen .sub-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:99px;font-size:12px;font-weight:700;background:var(--aqua-light);color:var(--aqua-dark)}
.badge-guide-screen .sub-cta{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;background:var(--aqua);color:#fff;font-size:13px;font-weight:700}
.badge-guide-screen .page-wrap{max-width:1200px;margin:0 auto;padding:40px 32px 80px;display:grid;grid-template-columns:1fr 268px;gap:28px;align-items:start}
.badge-guide-screen .hero{background:linear-gradient(135deg,var(--navy) 0%,#0D2540 100%);border-radius:16px;padding:36px 40px 40px;margin-bottom:28px;position:relative;overflow:hidden}
.badge-guide-screen .hero-title{font-family:var(--font-display);font-size:42px;font-weight:800;letter-spacing:-.04em;line-height:1.05;color:#fff;margin-bottom:10px}
.badge-guide-screen .accent{color:var(--aqua-hover)}
.badge-guide-screen .hero-sub{font-size:14px;color:rgba(255,255,255,.6);margin-bottom:20px}
.badge-guide-screen .hero-stats{display:flex;gap:0;background:rgba(255,255,255,.06);border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.08)}
.badge-guide-screen .hero-stat{flex:1;padding:14px 20px;border-right:1px solid rgba(255,255,255,.08)}
.badge-guide-screen .hero-stat:last-child{border-right:none}
.badge-guide-screen .hero-stat .num{font-family:var(--font-display);font-size:28px;font-weight:800;color:#fff;line-height:1}
.badge-guide-screen .hero-stat .lbl{font-size:11px;color:rgba(255,255,255,.45);margin-top:3px}
.badge-guide-screen .sec-header{display:flex;align-items:center;gap:12px;margin-bottom:16px;margin-top:32px}
.badge-guide-screen .sec-num{font-family:var(--font-display);font-size:11px;font-weight:700;color:var(--aqua);letter-spacing:.1em;background:var(--aqua-light);padding:3px 8px;border-radius:99px}
.badge-guide-screen .sec-title{font-size:18px;font-weight:800;color:var(--navy)}
.badge-guide-screen .sec-desc{font-size:12px;color:var(--gray-500);margin-left:auto}
.badge-guide-screen .sec-divider{height:1px;background:var(--gray-200);margin-bottom:16px}
.badge-guide-screen .badge-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.badge-guide-screen .badge-card{background:var(--white);border:1px solid var(--gray-200);border-radius:14px;padding:18px 20px}
.badge-guide-screen .card-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.badge-guide-screen .card-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px}
.badge-guide-screen .card-name{font-size:13px;font-weight:700;color:var(--navy)}
.badge-guide-screen .card-sub{font-size:11px;color:var(--gray-500);margin-top:2px}
.badge-guide-screen .special-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
.badge-guide-screen .sp-card{background:var(--white);border:1px solid var(--gray-200);border-radius:12px;padding:14px 16px}
.badge-guide-screen .repeat-section{background:var(--white);border:1px solid var(--gray-200);border-radius:14px;padding:18px 20px;margin-bottom:12px}
.badge-guide-screen .summary-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}
.badge-guide-screen .sum-card{background:var(--white);border:1px solid var(--gray-200);border-radius:12px;padding:14px 16px;text-align:center}
.badge-guide-screen .sum-num{font-family:var(--font-display);font-size:26px;font-weight:800;line-height:1}
.badge-guide-screen .sum-lbl{font-size:11px;color:var(--gray-500);margin-top:4px}
.badge-guide-screen .sidebar{display:flex;flex-direction:column;gap:14px;position:sticky;top:88px}
.badge-guide-screen .widget{background:var(--white);border:1px solid var(--gray-200);border-radius:14px;padding:18px}
.badge-guide-screen .widget-title{font-size:12px;font-weight:700;color:var(--gray-500);letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:6px}
@media(max-width:1100px){.badge-guide-screen .page-wrap{grid-template-columns:1fr}.badge-guide-screen .sidebar{display:none}}
@media(max-width:700px){.badge-guide-screen .page-wrap{padding:20px 16px 60px}.badge-guide-screen .badge-grid{grid-template-columns:1fr}.badge-guide-screen .special-grid{grid-template-columns:1fr 1fr}.badge-guide-screen .hero-title{font-size:30px}}
`;

const GUIDE_HTML = `
<div class="sub-header">
  <div class="sub-header-inner">
    <div class="sub-breadcrumb">
      <a href="/">홈</a>
      <span class="sep">›</span>
      <span class="cur">뱃지 시스템</span>
    </div>
    <div class="sub-header-right">
      <a href="/my/badges" class="sub-cta">
        <span class="ms" aria-hidden="true">military_tech</span>
        내 배지 보기
      </a>
      <div class="sub-pill"><span class="ms">military_tech</span>MVP 25개 이상</div>
    </div>
  </div>
</div>
<div class="page-wrap">
  <main class="main">
    <div class="hero">
      <div class="hero-title">레인 위의 <span class="accent">성취</span>를<br>모두 기록합니다</div>
      <div class="hero-sub">수영 기록이 쌓일수록 빛나는 나만의 컬렉션 — 작은 습관도 놓치지 않아요</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="num" style="color:var(--aqua-hover)">25+</div><div class="lbl">MVP 뱃지 총계</div></div>
        <div class="hero-stat"><div class="num" style="color:#FAC775">4</div><div class="lbl">기본 카테고리</div></div>
        <div class="hero-stat"><div class="num" style="color:#F5C4B3">5+</div><div class="lbl">스페셜 뱃지 유형</div></div>
        <div class="hero-stat"><div class="num" style="color:#C0DD97">∞</div><div class="lbl">누적 거리 무한 성장</div></div>
      </div>
    </div>
    <div id="sec01">
      <div class="sec-header"><span class="sec-num">01</span><span class="sec-title">기본 뱃지</span><span class="sec-desc">꾸준히 수영하면 자연스럽게 쌓이는 4가지 카테고리</span></div>
      <div class="sec-divider"></div>
      <div class="badge-grid">
        <div class="badge-card"><div class="card-head"><div class="card-icon" style="background:var(--aqua-light)"><i class="ti ti-route" style="color:var(--aqua-dark)"></i></div><div><div class="card-name">총 누적 거리</div><div class="card-sub">영구 누적 · 한번 달성하면 평생 유지</div></div></div></div>
        <div class="badge-card"><div class="card-head"><div class="card-icon" style="background:#FAEEDA"><i class="ti ti-trophy" style="color:#633806"></i></div><div><div class="card-name">하루 수영 거리</div><div class="card-sub">수영대회 거리 기준 · 이달 최고 기록으로 판정</div></div></div></div>
      </div>
    </div>
    <div id="sec02">
      <div class="sec-header"><span class="sec-num">02</span><span class="sec-title">스페셜 뱃지</span><span class="sec-desc">특별한 활동과 이벤트에서만 얻을 수 있는 희귀 뱃지</span></div>
      <div class="sec-divider"></div>
      <div class="special-grid">
        <div class="sp-card"><div class="card-name">목표 달성</div></div>
        <div class="sp-card"><div class="card-name">소통</div></div>
        <div class="sp-card"><div class="card-name">대회 참가</div></div>
        <div class="sp-card"><div class="card-name">기록 갱신</div></div>
        <div class="sp-card"><div class="card-name">레인방 활동</div></div>
        <div class="sp-card"><div class="card-name">시즌 한정 (추후 추가)</div></div>
      </div>
    </div>
    <div id="sec03">
      <div class="sec-header"><span class="sec-num">03</span><span class="sec-title">반복 달성 시스템</span><span class="sec-desc">같은 뱃지를 반복하면 횟수가 쌓이고 마스터가 해금됩니다</span></div>
      <div class="sec-divider"></div>
      <div class="repeat-section">횟수 카운팅 / 연속 달성 규칙 예시</div>
    </div>
    <div id="sec04">
      <div class="sec-header"><span class="sec-num">04</span><span class="sec-title">마이페이지 뱃지 컬렉션</span><span class="sec-desc">내가 쌓아온 모든 성취가 한 곳에</span></div>
      <div class="sec-divider"></div>
      <div class="repeat-section">마이페이지 미리보기 예시</div>
    </div>
    <div class="summary-strip" style="margin-top:28px">
      <div class="sum-card"><div class="sum-num" style="color:var(--aqua-dark)">9<span style="font-size:14px;color:var(--gray-500)">개</span></div><div class="sum-lbl">누적 거리 뱃지</div></div>
      <div class="sum-card"><div class="sum-num" style="color:#633806">11<span style="font-size:14px;color:var(--gray-500)">개</span></div><div class="sum-lbl">기본 뱃지</div></div>
      <div class="sum-card"><div class="sum-num" style="color:#3C3489">14<span style="font-size:14px;color:var(--gray-500)">개+</span></div><div class="sum-lbl">스페셜 뱃지</div></div>
    </div>
  </main>
  <aside class="sidebar">
    <div class="widget"><div class="widget-title"><span class="ms">list</span>목차</div></div>
    <div class="widget"><div class="widget-title"><span class="ms">military_tech</span>내 뱃지 현황</div></div>
    <div class="widget"><div class="widget-title"><span class="ms">local_fire_department</span>연속 달성 현황</div></div>
  </aside>
</div>
`;

export function BadgeGuidePage() {
  return (
    <>
      <link
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"
        rel="stylesheet"
      />
      <SiteGnb activeNav="my" />
      <style>{GUIDE_CSS}</style>
      <div
        className="badge-guide-screen"
        dangerouslySetInnerHTML={{ __html: GUIDE_HTML }}
      />
    </>
  );
}

