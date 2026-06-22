import fs from "fs";
import path from "path";

const pubDir = path.resolve("..", "WeSwim_publishing", "screens");

function scopeCss(input, prefix) {
  let result = "";
  let i = 0;
  while (i < input.length) {
    const atIdx = input.indexOf("@", i);
    const braceIdx = input.indexOf("{", i);
    if (braceIdx === -1) {
      break;
    }
    if (atIdx !== -1 && atIdx < braceIdx) {
      const atEnd = input.indexOf("{", atIdx);
      const atRule = input.slice(atIdx, atEnd).trim();
      let depth = 0;
      let j = atEnd;
      while (j < input.length) {
        if (input[j] === "{") {
          depth += 1;
        } else if (input[j] === "}") {
          depth -= 1;
          if (depth === 0) {
            j += 1;
            break;
          }
        }
        j += 1;
      }
      const block = input.slice(atEnd + 1, j - 1);
      if (atRule.startsWith("@keyframes")) {
        result += input.slice(atIdx, j);
      } else {
        result += `${atRule}{${scopeCss(block, prefix)}}`;
      }
      i = j;
      continue;
    }
    const sel = input.slice(i, braceIdx).trim();
    let depth = 0;
    let j = braceIdx;
    while (j < input.length) {
      if (input[j] === "{") {
        depth += 1;
      } else if (input[j] === "}") {
        depth -= 1;
        if (depth === 0) {
          j += 1;
          break;
        }
      }
      j += 1;
    }
    const body = input.slice(braceIdx + 1, j - 1);
    const p = prefix.trim();
    if (sel && !sel.startsWith(p)) {
      const parts = sel.split(",").map((s) => {
        const t = s.trim();
        if (!t || t.startsWith(p)) {
          return t;
        }
        return `${prefix}${t}`;
      });
      result += `${parts.join(", ")}{${body}}`;
    } else {
      result += `${sel}{${body}}`;
    }
    i = j;
  }
  return result;
}

const VARS = `--navy:#1B3A5C;--navy-dark:#142D47;--navy-light:#E8EEF4;
--aqua:#0096A0;--aqua-hover:#00A8B5;--aqua-dark:#006970;
--aqua-light:#E6F6F7;--aqua-whisper:#F2FBFC;
--coral:#E8734A;--coral-dark:#C45A33;--coral-light:#FDF0EB;
--mint:#7DD3C8;--mint-light:#E8F7F4;
--sun:#F4B740;--sun-light:#FCF1D8;
--bg:#F5F7FA;--white:#FFFFFF;
--gray-100:#ECEFF4;--gray-200:#D0D7E2;--gray-300:#B4BECD;
--gray-500:#6B7A99;--gray-700:#3D4A66;--text-main:#1A1A2E;
--error:#E54B4B;--success:#00A37A;
--font-sans:'Pretendard Variable','Pretendard','Helvetica Neue','Apple SD Gothic Neo',sans-serif;
--font-display:'Helvetica Neue','Pretendard Variable','Pretendard',sans-serif;`;

function extract(htmlFile, wrapper, outFile, extra = "") {
  const html = fs.readFileSync(path.join(pubDir, htmlFile), "utf8");
  let css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  css = css.replace(/:root\s*\{[\s\S]*?\}\s*/m, "");
  css = css.replace(/html,body\{[^}]*\}/, "");
  css = css.replace(/body\{[^}]*\}/, "");
  css = css.replace(/\*\{font-family:[^}]+\}/, "");

  const vars = `.${wrapper} {
  ${VARS}
  font-family: var(--font-sans);
  color: var(--text-main);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}
${extra}
`;

  const scoped = vars + scopeCss(css, `.${wrapper} `);
  fs.writeFileSync(path.join("src/styles", outFile), scoped);
  console.log(outFile, scoped.length);
}

extract("my.html", "my-screen", "weswim-my.css", `.my-screen .page {
  max-width: 1320px;
  padding: 24px 32px 80px;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 28px;
}
.my-screen .profile-hero { margin-bottom: 0; }
`);

extract(
  "my-settings.html",
  "my-settings-screen",
  "weswim-my-settings.css",
  `.my-settings-screen .page { max-width: 960px; display: block; }
`,
);

extract(
  "my-badges.html",
  "my-badges-screen",
  "weswim-my-badges.css",
  `.my-badges-screen .page { max-width: 900px; display: block; }
`,
);

extract(
  "notifications.html",
  "notifications-screen",
  "weswim-notifications.css",
);

extract(
  "user-profile.html",
  "user-profile-screen",
  "weswim-user-profile.css",
  `.user-profile-screen .page { max-width: 1320px; display: block; }
`,
);

extract(
  "community-post.html",
  "community-post-screen",
  "weswim-community-post.css",
  `.community-post-screen .page {
  max-width: 1320px;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
}
`,
);

extract(
  "weswim_badge_guide.html",
  "badge-guide-screen",
  "weswim-badge-guide.css",
  `.badge-guide-screen .page-wrap { max-width: 1200px; }
`,
);

console.log("done");
