import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished game entry screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="zh-Hant">/);
  assert.match(html, /<title>經典文學闖關島｜高中統測篇<\/title>/);
  assert.match(html, /準備好登島了嗎/);
  assert.match(html, /班級代碼、座號與 PIN 由任課教師提供/);
  assert.match(html, /教師管理端/);
  assert.doesNotMatch(html, /DEMO114|試玩帳號|teacher\.demo/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("includes mobile, accessibility, game, and formal teacher contracts", async () => {
  const [page, css, layout, platformApi] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/platform/route.ts", import.meta.url), "utf8"),
  ]);
  for (const name of ["字詞迷霧島", "文意尋蹤島", "語藝幻境島", "國學寶藏島", "線索羅盤島"]) assert.match(page, new RegExp(name));
  assert.match(page, /role="radiogroup"/);
  assert.match(page, /很確定/);
  assert.match(page, /題庫匯入與版本/);
  assert.match(page, /five-islands-map\.jpg/);
  assert.match(page, /目前穿搭 · 五階中的第/);
  assert.match(page, /魔幻輕音樂與遊戲音效/);
  assert.match(page, /playMusicBar/);
  assert.match(page, /經典，是歷史留給我們的寶藏/);
  assert.match(page, /五座島嶼，收藏五種文學力量/);
  assert.match(page, /閱讀完畢後，點選「下一幕」繼續故事/);
  assert.match(page, /為旅程命名/);
  assert.doesNotMatch(page, /<span>舟<\/span>/);
  assert.doesNotMatch(page, /簡要解析/);
  assert.doesNotMatch(page, /screen !== "story"/);
  assert.match(page, /storyStep/);
  assert.match(page, /nickname-backdrop/);
  assert.match(page, /accessoryMilestones/);
  assert.match(page, /outfitPreviewTier/);
  assert.match(page, /modian-sheet-v2\.png/);
  assert.match(page, /造型預覽/);
  assert.match(page, /點選預覽/);
  assert.match(page, /尚未收藏，也可以先預覽/);
  assert.match(page, /尚未獲得知己獎盃/);
  assert.match(page, /trophies\[island\.id\]/);
  assert.match(page, /liveLeaderboard/);
  assert.match(page, /切換島嶼排行榜/);
  assert.match(page, /importQuestionFile/);
  assert.match(page, /importStudentFile/);
  assert.match(page, /renderMarkedText/);
  assert.match(page, /\*\*重要文字\*\*/);
  assert.match(page, /__關鍵文字__/);
  assert.match(page, /儲存格內換行會原樣顯示/);
  assert.match(page, /setClassActive/);
  assert.match(page, /deleteClass/);
  assert.match(page, /匯出 Excel（\.xlsx）/);
  assert.match(page, /學生作答摘要/);
  assert.match(page, /逐題作答明細/);
  assert.match(page, /題目統計/);
  assert.match(page, /正式題庫 · 每島 20 題/);
  assert.match(page, /班級與遊戲暱稱/);
  assert.match(page, /旅人暱稱/);
  assert.match(page, /同一帳號同時只能在一台裝置登入/);
  assert.match(page, /studentSessionStatus/);
  assert.match(page, /studentLogout/);
  assert.match(page, /帳號安全/);
  assert.match(page, /changeTeacherCredentials/);
  assert.match(page, /setTeacherTab\("security"\); await loadTeacherData/);
  assert.match(page, /目前密碼/);
  assert.match(page, /所有教師端登入階段會登出/);
  assert.match(page, /請輸入至少 6 位數字/);
  assert.match(page, /pattern="\[0-9\]\{6,\}"/);
  assert.match(platformApi, /\^\\d\{6,\}\$/);
  assert.match(platformApi, /新密碼需為至少 6 位數字/);
  assert.match(platformApi, /iterations: 100000/);
  assert.match(platformApi, /teacherReport/);
  assert.match(platformApi, /首次作答人數|firstCount/);
  assert.match(platformApi, /setClassActive/);
  assert.match(platformApi, /deleteClass/);
  assert.match(platformApi, /sessions_student_subject_unique/);
  assert.match(platformApi, /DELETE FROM sessions WHERE role='student' AND subject_id=\?/);
  assert.match(platformApi, /可能已在另一台裝置登入/);
  assert.match(platformApi, /首次登入設定不符合規則/);
  assert.doesNotMatch(platformApi, /iterations: 120000/);
  assert.doesNotMatch(page, /alt="墨點造型"/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /@media\(max-width:640px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.island-hotspot/);
  assert.match(css, /background-size:300% 200%/);
  assert.match(css, /\.story-page/);
  assert.match(css, /\.story-reading-hint/);
  assert.match(css, /\.outfit-roadmap/);
  assert.match(css, /\.outfit-preview-modal/);
  assert.match(css, /\.achievement-page/);
  assert.match(css, /\.achievement-atmosphere/);
  assert.match(css, /@keyframes achievementMist/);
  assert.match(css, /grid-template-columns:repeat\(5,1fr\)/);
  assert.match(css, /\.island-trophy/);
  assert.match(css, /\.leaderboard-tabs/);
  assert.match(css, /\.leader-identity/);
  assert.match(css, /\.security-layout/);
  assert.match(css, /\.rich-question-text/);
  assert.match(css, /\.class-card-actions/);
  assert.match(layout, /og\.png/);
  for (const file of ["modian.jpg", "qingzong.jpg", "feiyu.jpg", "yanjia.jpg", "xingluo.jpg"]) await access(new URL(`../public/guardians/${file}`, import.meta.url));
  for (const file of ["modian-sheet-v2.png", "qingzong-sheet.jpg", "feiyu-sheet.jpg", "yanjia-sheet.jpg", "xingluo-sheet.jpg"]) await access(new URL(`../public/guardians/outfits/${file}`, import.meta.url));
  await access(new URL("../public/islands/five-islands-map.jpg", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
});
