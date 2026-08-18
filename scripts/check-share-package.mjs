import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const forbiddenNames = new Set([".dev.vars", ".env", ".env.local", "經典文學闖關島.txt"]);
const ignoredDirectories = new Set(["node_modules", "dist", ".git", ".wrangler", ".next", ".vinext"]);
const forbiddenPatterns = [
  { label: "Cloudflare account_id", pattern: /["']account_id["']\s*:/ },
  { label: "Cloudflare database_id", pattern: /["']database_id["']\s*:/ },
  { label: "ChatGPT Sites project ID", pattern: /appgprj_[a-z0-9]+/i },
  { label: "疑似 Cloudflare Token", pattern: /\b(?:cfut_|cfat_)[A-Za-z0-9_-]{20,}\b/ },
];

const problems = [];
const requiredFiles = [
  "app/api/platform/route.ts",
  "app/page.tsx",
  "drizzle/0000_organic_killmonger.sql",
  "drizzle/0001_mature_sir_ram.sql",
  "drizzle/0002_fantastic_preak.sql",
  "public/islands/five-islands-map.jpg",
  "教師部署圖文說明.html",
];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    const display = relative(root, absolute);
    if (entry.isDirectory()) {
      await visit(absolute);
      continue;
    }
    if (forbiddenNames.has(entry.name)) problems.push(`${display}：不可分享的秘密檔案名稱`);
    const info = await stat(absolute);
    if (info.size > 2_000_000 || /\.(?:png|jpe?g|gif|webp|zip|gz|xlsx|docx|pdf)$/i.test(entry.name)) continue;
    const content = await readFile(absolute, "utf8");
    for (const check of forbiddenPatterns) {
      if (check.pattern.test(content)) problems.push(`${display}：包含 ${check.label}`);
    }
  }
}

await visit(root);

for (const file of requiredFiles) {
  try { await stat(join(root, file)); }
  catch { problems.push(`${file}：分享包缺少必要檔案`); }
}

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (packageJson.version !== "1.1.0") problems.push("package.json：版本必須為 1.1.0");
if (!String(packageJson.scripts?.deploy ?? "").includes("db:migrations:apply")) problems.push("package.json：一鍵部署前未設定 D1 遷移");
if (!String(packageJson.scripts?.["db:migrations:apply"] ?? "").includes("d1 migrations apply DB --remote")) problems.push("package.json：D1 遷移必須使用綁定名稱 DB");

const wrangler = await readFile(join(root, "wrangler.jsonc"), "utf8");
if (!/"migrations_dir"\s*:\s*"drizzle"/.test(wrangler)) problems.push("wrangler.jsonc：缺少 drizzle 遷移目錄設定");

const platformApi = await readFile(join(root, "app/api/platform/route.ts"), "utf8");
if (!platformApi.includes("sessions_student_subject_unique")) problems.push("學生單一登入保護索引尚未包含在 API");

if (problems.length) {
  console.error("分享安全檢查未通過：");
  problems.forEach((problem) => console.error(`- ${problem}`));
  process.exit(1);
}

console.log("分享安全檢查通過：未發現帳戶 ID、資料庫 ID、Sites 專案 ID、Token 或秘密檔案。");
