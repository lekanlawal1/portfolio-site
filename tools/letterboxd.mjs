// Saves my latest Letterboxd diary entries to data/letterboxd.json for the About section: poster,
// title, rating and the start of my review (the page shows it only when you point at the poster).
// Letterboxd's feed can't be read from the page itself (it doesn't allow other sites to fetch it),
// so a scheduled GitHub Action runs this and commits the result when it changes.
//
//   node tools/letterboxd.mjs            writes data/letterboxd.json from the live feed
//   node tools/letterboxd.mjs feed.xml   the same from a saved copy (for testing)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const USER = "lekanlawal", SHOW = 6;
const xml = process.argv[2] ? readFileSync(process.argv[2], "utf8")
  : await fetch(`https://letterboxd.com/${USER}/rss/`, { headers: { "User-Agent": "portfolio-site feed reader" } }).then((r) => {
      if (!r.ok) throw new Error(`Letterboxd answered ${r.status}`);
      return r.text();
    });

const tag = (item, name) => (item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)) || [])[1]?.trim() || "";
const decode = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const films = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1])
  .filter((item) => tag(item, "letterboxd:filmTitle"))          // lists and other entries have no film
  .slice(0, SHOW)
  .map((item) => {
    const html = decode(tag(item, "description"));
    const poster = (html.match(/<img src="([^"]+)"/) || [])[1] || "";
    const text = html.replace(/<img[^>]*>/g, "").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return {
      title: decode(tag(item, "letterboxd:filmTitle")),
      year: tag(item, "letterboxd:filmYear"),
      rating: Number(tag(item, "letterboxd:memberRating")) || null,   // 0.5 to 5, or none
      url: tag(item, "link"),
      poster: poster.replace(/-0-\d+-0-\d+-crop/, "-0-300-0-450-crop"),   // the 300 x 450 poster is about 25 KB
      // a review marked as spoilers stays on Letterboxd; long ones are cut at a word
      review: /^This review may contain spoilers/.test(text) ? "" : text.length > 90 ? text.slice(0, 90).replace(/\s+\S*$/, "") + "..." : text,
    };
  })
  // only Letterboxd's own pages and posters ever reach the site
  .filter((f) => f.url.startsWith("https://letterboxd.com/") && f.poster.startsWith("https://a.ltrbxd.com/"));

if (!films.length) throw new Error("no films in the feed; leaving the saved list alone");
mkdirSync("data", { recursive: true });
writeFileSync("data/letterboxd.json", JSON.stringify({ profile: `https://letterboxd.com/${USER}/`, films }, null, 1) + "\n");
console.log(`data/letterboxd.json: ${films.length} films, latest ${films[0].title}`);
