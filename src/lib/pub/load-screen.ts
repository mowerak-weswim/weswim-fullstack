import { readFile } from "fs/promises";
import path from "path";

import { rewritePubHtml, stripPubChrome } from "./rewrite-html";
import { scopePubStyles } from "./scope-styles";

const SCREENS_DIR = path.join(
  process.cwd(),
  "reference/publishing/screens",
);

export type PubScreenContent = {
  styles: string;
  html: string;
};

export async function loadPubScreen(filename: string): Promise<PubScreenContent> {
  const raw = await readFile(path.join(SCREENS_DIR, filename), "utf8");

  const styleMatch = raw.match(/<style>([\s\S]*?)<\/style>/i);
  const styles = scopePubStyles(styleMatch?.[1]?.trim() ?? "");

  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<script/i);
  let body = bodyMatch?.[1]?.trim() ?? "";

  body = stripPubChrome(body);
  body = rewritePubHtml(body);

  return { styles, html: body };
}
