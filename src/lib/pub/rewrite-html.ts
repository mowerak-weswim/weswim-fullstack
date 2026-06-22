import { PUB_HREF_MAP } from "./href-map";

export function rewritePubHtml(html: string): string {
  let result = html;

  for (const [file, route] of Object.entries(PUB_HREF_MAP)) {
    const escaped = file.replace(/\./g, "\\.");
    result = result.replaceAll(`href="${file}"`, `href="${route}"`);
    result = result.replaceAll(`href='${file}'`, `href='${route}'`);
    result = result.replace(
      new RegExp(`onclick="location\\.href='${escaped}'"`, "g"),
      `data-href="${route}" role="link" tabindex="0"`,
    );
    result = result.replace(
      new RegExp(`onclick='location\\.href="${escaped}"'`, "g"),
      `data-href="${route}" role="link" tabindex="0"`,
    );
  }

  result = result.replace(
    /onclick="history\.back\(\)"/g,
    'data-nav-back="" type="button"',
  );

  return result;
}

export function stripPubChrome(html: string): string {
  return html
    .replace(/<header class="gnb">[\s\S]*?<\/header>/i, "")
    .replace(/<!--\s*드로어\s*-->[\s\S]*?<\/aside>/i, "")
    .replace(/<div class="drw-ov"[\s\S]*?<\/aside>/i, "")
    .replace(/<div class="state-toggle">[\s\S]*?<\/div>\s*/i, "");
}
