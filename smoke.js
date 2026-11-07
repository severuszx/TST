#!/usr/bin/env node
/* 线上冒烟：页面 200 + 标题/正文，核心接口 200。Node 18+（内置 fetch）。 */
const BASE = process.env.TST_BASE || "https://theslowtide.pages.dev";
const API = process.env.TST_API || "https://theslowtidefk.pages.dev";
const pages = ["/", "/login.html", "/profile.html", "/tool.html", "/shop.html", "/hogwarts.html", "/planning.html", "/download.html"];
const apis = ["/api/data", "/api/debug/verify", "/api/tst-log/list", "/api/version"];
let failed = 0;

async function hit(url, label, minLen) {
  try {
    const r = await fetch(url, { redirect: "manual" });
    const text = r.status >= 200 && r.status < 300 ? await r.text() : "";
    const ok = r.status >= 200 && r.status < 400 && (!minLen || text.length >= minLen);
    console.log(`${ok ? "OK " : "FAIL"} ${label} status=${r.status} bytes=${text.length}`);
    if (!ok) failed++;
  } catch (e) {
    console.log(`FAIL ${label} ${e.message}`);
    failed++;
  }
}

(async () => {
  for (const p of pages) await hit(BASE + p + "?smoke=" + Date.now(), p, p === "/" ? 1000 : 200);
  for (const p of apis) await hit(API + p, p, 0);
  if (failed) {
    console.log(`SMOKE FAILED: ${failed}`);
    process.exit(1);
  }
  console.log("SMOKE OK");
})();
