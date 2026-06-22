import fs from "node:fs";
import path from "node:path";

const htmlPath = path.join(
  process.cwd(),
  "reference/publishing/screens/signup-complete.html",
);
const outPath = path.join(process.cwd(), "src/styles/weswim-signup-complete.css");

const html = fs.readFileSync(htmlPath, "utf8");
const match = html.match(/<style>([\s\S]*?)<\/style>/);
if (!match) {
  throw new Error("style block not found");
}

let css = match[1];
css = css.replace(/\bbody\b/g, ".signup-complete-page");
css = css.replace(/html,\.signup-complete-page/g, ".signup-complete-page");
css = css.replace(/html,body/g, ".signup-complete-page");

const header = `/* From reference/publishing/screens/signup-complete.html — scoped to .signup-complete-page */\n`;
fs.writeFileSync(outPath, header + css);
console.log("wrote", outPath, fs.statSync(outPath).size, "bytes");
