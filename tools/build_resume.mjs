// Prints resume.html to assets/Lekan_Lawal_Resume.pdf, so the page and the download are always
// the same document. The print styles in resume.html decide the PDF's look; this checks it fits
// on one page and that its text can be read back (as screening software would).
//
//   python3 -m http.server 8800 &   then   node tools/build_resume.mjs [http://localhost:8800/]
import { execFileSync } from "node:child_process";

const base = process.argv[2] || "http://localhost:8800/";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");   // or a global install
const browser = await chromium.launch();
const page = await browser.newPage();
// fetch the web fonts with curl (follows the machine's proxy settings), so the PDF always gets them
await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
  const url = route.request().url();
  const body = execFileSync("curl", ["-sSL", "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36", url]);
  route.fulfill({ body, contentType: url.includes("googleapis") ? "text/css" : "font/woff2" });
});
await page.goto(new URL("resume.html", base).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: "assets/Lekan_Lawal_Resume.pdf", format: "Letter", printBackground: false, preferCSSPageSize: true });
await browser.close();

const info = execFileSync("pdfinfo", ["assets/Lekan_Lawal_Resume.pdf"]).toString();
const pages = Number(info.match(/Pages:\s+(\d+)/)[1]);
const fonts = execFileSync("pdffonts", ["assets/Lekan_Lawal_Resume.pdf"]).toString();
if (!/Inter/.test(fonts)) console.warn("Warning: Inter isn't embedded; the PDF fell back to another font.");
const text = execFileSync("pdftotext", ["-layout", "assets/Lekan_Lawal_Resume.pdf", "-"]).toString();
console.log(`assets/Lekan_Lawal_Resume.pdf: ${pages} page(s), ${text.split(/\s+/).length} words of readable text`);
if (pages !== 1) { console.error("The résumé runs past one page: tighten the content or the print styles."); process.exit(1); }
