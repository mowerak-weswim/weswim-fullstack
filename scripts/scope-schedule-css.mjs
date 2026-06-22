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

function extractScoped(htmlFile, wrapperClass, extra = "") {
  const html = fs.readFileSync(path.join(pubDir, htmlFile), "utf8");
  let css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  css = css.replace(/:root\s*\{[\s\S]*?\}\s*/m, "");
  css = css.replace(/html,body\{[^}]*\}/, "");
  css = css.replace(/body\{[^}]*\}/, "");

  const vars = `.${wrapperClass} {
  --navy:#1B3A5C; --navy-dark:#142D47; --navy-light:#E8EEF4;
  --aqua:#0096A0; --aqua-hover:#00A8B5; --aqua-dark:#006970;
  --aqua-light:#E6F6F7; --aqua-whisper:#F2FBFC;
  --coral:#E8734A; --coral-dark:#C45A33; --coral-light:#FDF0EB;
  --sun:#F4B740; --sun-light:#FCF1D8; --sun-dark:#9B6D0A;
  --mint:#7DD3C8; --mint-light:#E8F7F4;
  --bg:#F5F7FA; --white:#FFFFFF;
  --gray-100:#ECEFF4; --gray-200:#D0D7E2; --gray-300:#B4BECD;
  --gray-500:#6B7A99; --gray-700:#3D4A66; --text-main:#1A1A2E;
  --error:#E54B4B;
  --font-sans:'Pretendard Variable','Pretendard','Helvetica Neue','Apple SD Gothic Neo',sans-serif;
  --font-display:'Helvetica Neue','Pretendard Variable','Pretendard',sans-serif;
  font-family: var(--font-sans);
  color: var(--text-main);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}
${extra}
`;

  return vars + scopeCss(css, `.${wrapperClass} `);
}

const writeVars = `.schedule-write-screen .page {
  display: block;
  max-width: 680px;
}
`;

const detailVars = `.schedule-detail-screen .page {
  max-width: 1320px;
}
`;

fs.writeFileSync(
  "src/styles/weswim-schedule-write.css",
  extractScoped("schedule-write.html", "schedule-write-screen", writeVars),
);
fs.writeFileSync(
  "src/styles/weswim-schedule-detail.css",
  extractScoped("schedule-detail.html", "schedule-detail-screen", detailVars),
);
console.log("schedule CSS written");
