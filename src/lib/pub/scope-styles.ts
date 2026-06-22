const SCOPE = ".pub-html-root";

/** Global weswim.css rules that leak into pub screens without explicit overrides. */
const PUB_ISOLATION_RESET = `
${SCOPE} .page {
  display: block;
  grid-template-columns: unset;
  gap: unset;
  align-items: unset;
}
${SCOPE} .post-title,
${SCOPE} .post-body {
  padding: unset;
  border: unset;
  white-space: unset;
}
`;

function extractBraceBlock(
  css: string,
  start: number,
): { content: string; endIndex: number } {
  let depth = 1;
  let i = start;

  while (i < css.length && depth > 0) {
    if (css[i] === "{") {
      depth += 1;
    } else if (css[i] === "}") {
      depth -= 1;
    }
    i += 1;
  }

  return { content: css.slice(start, i - 1), endIndex: i - 1 };
}

function scopeSelectorList(selectors: string): string {
  return selectors
    .split(",")
    .map((raw) => {
      const sel = raw.trim();
      if (!sel) {
        return sel;
      }
      if (sel === ":root" || sel === "html" || sel === "body") {
        return SCOPE;
      }
      if (sel === "html,body" || sel === "html, body") {
        return SCOPE;
      }
      if (sel.startsWith("html ") || sel.startsWith("body ")) {
        return `${SCOPE} ${sel.replace(/^(html|body)\s+/, "")}`;
      }
      if (sel === "*") {
        return `${SCOPE}, ${SCOPE} *`;
      }
      if (sel.startsWith("*::")) {
        return `${SCOPE} ${sel}`;
      }
      if (sel.includes("*,") || sel.includes(", *")) {
        return sel
          .split(",")
          .map((part) => {
            const piece = part.trim();
            if (piece === "*") {
              return `${SCOPE} *`;
            }
            if (piece.startsWith("*::")) {
              return `${SCOPE} ${piece}`;
            }
            return `${SCOPE} ${piece}`;
          })
          .join(", ");
      }
      return `${SCOPE} ${sel}`;
    })
    .join(", ");
}

function scopeCssRules(css: string): string {
  let result = "";
  let i = 0;

  while (i < css.length) {
    if (css[i] === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      if (end === -1) {
        break;
      }
      result += css.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    while (i < css.length && /\s/.test(css[i])) {
      i += 1;
    }

    if (i >= css.length) {
      break;
    }

    if (css[i] === "@") {
      const openBrace = css.indexOf("{", i);
      if (openBrace === -1) {
        result += css.slice(i);
        break;
      }

      const header = css.slice(i, openBrace).trim();
      const { content, endIndex } = extractBraceBlock(css, openBrace + 1);

      if (header.startsWith("@media") || header.startsWith("@supports")) {
        result += `${header}{${scopeCssRules(content)}}`;
      } else {
        result += `${header}{${content}}`;
      }

      i = endIndex + 1;
      continue;
    }

    const openBrace = css.indexOf("{", i);
    if (openBrace === -1) {
      result += css.slice(i);
      break;
    }

    const selectors = css.slice(i, openBrace).trim();
    const { content, endIndex } = extractBraceBlock(css, openBrace + 1);

    if (selectors) {
      result += `${scopeSelectorList(selectors)}{${content}}`;
    }

    i = endIndex + 1;
  }

  return result;
}

export function scopePubStyles(css: string): string {
  if (!css.trim()) {
    return PUB_ISOLATION_RESET;
  }

  return `${PUB_ISOLATION_RESET}\n${scopeCssRules(css)}`;
}
