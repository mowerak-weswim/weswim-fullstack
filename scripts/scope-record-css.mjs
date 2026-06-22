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

const html = fs.readFileSync(path.join(pubDir, "record.html"), "utf8");
let css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
css = css.replace(/\/\*[\s\S]*?\*\//g, "");
css = css.replace(/:root\s*\{[\s\S]*?\}\s*/m, "");
css = css.replace(/html,body\{[^}]*\}/, "");
css = css.replace(/body\{[^}]*\}/, "");
css = css.replace(/body\[data-state/g, ".record-screen[data-state");
css = css.replace(/body\.dataset/g, ".record-screen.dataset");
css = css.replace(/\.sidebar\{order:1;position:static;margin-bottom:0\}/, "");
/* record-detail sidebar block — duplicates sticky rule after mobile hide */
css = css.replace(
  /\.sidebar\{display:flex;flex-direction:column;gap:16px;position:sticky;top:88px\}/,
  "",
);

const wrapper = "record-screen";
const prefix = `.${wrapper} `;

const vars = `.${wrapper} {
  --navy:#1B3A5C; --navy-dark:#142D47; --navy-light:#E8EEF4;
  --aqua:#0096A0; --aqua-hover:#00A8B5; --aqua-dark:#006970;
  --aqua-light:#E6F6F7; --aqua-whisper:#F2FBFC;
  --coral:#E8734A; --coral-dark:#C45A33; --coral-light:#FDF0EB;
  --mint:#7DD3C8; --mint-light:#E8F7F4;
  --sun:#F4B740; --sun-light:#FCF1D8;
  --bg:#F5F7FA; --white:#FFFFFF;
  --gray-100:#ECEFF4; --gray-200:#D0D7E2; --gray-300:#B4BECD;
  --gray-500:#6B7A99; --gray-700:#3D4A66; --text-main:#1A1A2E;
  --error:#E54B4B; --success:#00A37A;
  --font-sans:'Pretendard Variable','Pretendard','Helvetica Neue','Apple SD Gothic Neo',sans-serif;
  --font-display:'Helvetica Neue','Pretendard Variable','Pretendard',sans-serif;
  font-family: var(--font-sans);
  color: var(--text-main);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}
.${wrapper} .state-toggle { display: none !important; }
.${wrapper} .page {
  max-width: 1240px;
  margin: 0 auto;
  padding: 32px 32px 80px;
  display: block !important;
  grid-template-columns: unset;
  gap: unset;
  align-items: unset;
}
.${wrapper} .sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 88px;
  order: unset;
}
.${wrapper} a.rec-mini {
  cursor: pointer;
  transition: background 0.12s ease;
}
.${wrapper} a.rec-mini:hover {
  background: var(--bg);
  margin: 0 -8px;
  padding-left: 8px;
  padding-right: 8px;
  border-radius: 8px;
}
`;

const mobileFooter = `
@media (max-width: 1024px) {
  .${wrapper} .main {
    grid-template-columns: 1fr;
  }
  .${wrapper} .form-panel {
    order: 2;
  }
  .${wrapper} .sidebar,
  .${wrapper} .sb,
  .${wrapper} .side-panel {
    display: none !important;
    position: static;
  }
}
@media (max-width: 880px) {
  .${wrapper} .page {
    padding: 16px 16px 60px;
  }
  .${wrapper} .main {
    padding: 0;
  }
  .${wrapper} .form-body {
    padding: 20px 16px 24px;
  }
  .${wrapper} .hero-dist {
    padding: 24px 16px 28px;
  }
  .${wrapper} .actions {
    padding: 0 16px 20px;
  }
}
`;

const scoped = vars + scopeCss(css, prefix) + mobileFooter;
fs.writeFileSync("src/styles/weswim-record.css", scoped);
console.log("written", scoped.length);
