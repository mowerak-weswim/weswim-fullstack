import fs from "fs";

const map = [
  ["grp-page", "page"],
  ["grp-sb", "sb"],
  ["grp-lane", "lane-card"],
  ["grp-lane-name", "lane-name"],
  ["grp-lane-meta", "lane-info"],
  ["grp-ch-block", "sb-block"],
  ["grp-ch-ico", "ch-ico"],
  ["grp-ch-name", "ch-name"],
  ["grp-ch", "ch"],
  ["grp-feed", "feed"],
  ["grp-ch-head", "ch-head"],
  ["grp-ch-sub", "ch-h-sub"],
  ["grp-tabs", "mob-tabs"],
  ["grp-tab", "mob-tab"],
  ["grp-feed-body", "feed-body"],
  ["grp-post-head", "post-head"],
  ["grp-post-text", "post-body"],
  ["grp-post", "post"],
  ["grp-compose", "composer"],
  ["grp-side", "sb-r"],
  ["grp-widget-title", "widget-title"],
  ["grp-widget", "widget"],
  ["grp-notice-card", "notice-card"],
  ["grp-nc-title", "nc-title"],
  ["grp-nc-meta", "nc-meta"],
  ["grp-vote-fill", "vote-fill"],
  ["grp-vote-bar", "vote-bar"],
  ["grp-rsvp", "rsvp"],
];

let css = fs.readFileSync("src/styles/weswim-group.css", "utf8");
for (const [from, to] of map.sort((a, b) => b[0].length - a[0].length)) {
  css = css.replaceAll(`.${from}`, `.${to}`);
}

css = css.replace(/^(\s*)(\.[a-zA-Z][^{]+)\{/gm, (match, indent, selector) => {
  if (selector.includes(".group-screen") || selector.trim().startsWith(".av")) {
    return match;
  }
  const parts = selector.split(",").map((part) => {
    const trimmed = part.trim();
    if (trimmed.startsWith(".group-screen") || trimmed.startsWith(".av")) {
      return trimmed;
    }
    return `.group-screen ${trimmed}`;
  });
  return `${indent}${parts.join(", ")} {`;
});

const extra = `
.group-screen .lane-card { position: relative; overflow: hidden; }
.group-screen .lane-card::after {
  content: "";
  position: absolute;
  right: -30px;
  bottom: -40px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 168, 181, 0.4) 0%, transparent 65%);
}
.group-screen .lane-card > * { position: relative; z-index: 2; }
.group-screen .lane-eb {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 6px;
}
.group-screen .lane-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}
.group-screen .sb-block-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--gray-500);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 8px 10px 6px;
}
.group-screen .ch-info { flex: 1; min-width: 0; }
.group-screen .ch .ch-ico {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.group-screen .ch.on .ch-ico { background: var(--aqua); }
.group-screen .ch.on .ch-ico .ms { color: #fff; }
.group-screen .ch .ch-ico .ms { font-size: 18px; color: var(--gray-500); }
.group-screen .ch-head .ch-h-ico {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: var(--aqua-light);
  display: flex;
  align-items: center;
  justify-content: center;
}
.group-screen .ch-head .ch-h-ico .ms { font-size: 24px; color: var(--aqua); }
.group-screen .other-classes a {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--gray-700);
  font-weight: 500;
  padding: 8px 10px;
  text-decoration: none;
}
.group-screen .other-classes a .ms { font-size: 16px; color: var(--gray-500); }

/* schedule-detail.tsx compatibility */
.rsvp,
.vote-bar,
.vote-fill {
  /* aliases defined above under .group-screen */
}
`;

fs.writeFileSync(
  "src/styles/weswim-group.css",
  `/* Pub group.html — scoped .group-screen */\n${css}\n${extra}`,
);
console.log("wrote weswim-group.css");
