import { NextRequest, NextResponse } from "next/server";

type Role = "student" | "teacher";
type PlatformEnv = { DB?: D1Database; TEACHER_USERNAME?: string; TEACHER_PASSWORD?: string };

const ISLANDS = ["mist", "trail", "arts", "classics", "compass"] as const;
const ISLAND_NAMES: Record<string, string> = { mist: "字詞迷霧島", trail: "文意尋蹤島", arts: "語藝幻境島", classics: "國學寶藏島", compass: "線索羅盤島" };
const CONFIDENCE_LABELS: Record<string, string> = { sure: "很確定", familiar: "有印象", guess: "我猜的" };
const now = () => new Date().toISOString();
const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const normalized = (value: unknown) => String(value ?? "").trim();
const randomSalt = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const passwordDigest = async (password: string, salt: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return Array.from(new Uint8Array(bits)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const constantEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let mismatch = 0; for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
};

async function getDatabase() {
  const { env } = await import("cloudflare:workers");
  const db = (env as unknown as PlatformEnv).DB;
  if (!db) throw new Error("雲端資料庫尚未綁定，請重新發布網站。");
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, class_id TEXT NOT NULL, seat TEXT NOT NULL, student_no TEXT, name TEXT NOT NULL, nickname TEXT, pin_digest TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(class_id, seat))"),
    db.prepare("CREATE TABLE IF NOT EXISTS sessions (token_digest TEXT PRIMARY KEY, role TEXT NOT NULL, subject_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS teacher_credentials (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_salt TEXT NOT NULL, password_digest TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS question_versions (id TEXT PRIMARY KEY, version_number INTEGER NOT NULL UNIQUE, status TEXT NOT NULL, created_at TEXT NOT NULL, published_at TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, version_id TEXT NOT NULL, question_id TEXT NOT NULL, island TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, stem TEXT NOT NULL, passage TEXT, option_a TEXT NOT NULL, option_b TEXT NOT NULL, option_c TEXT NOT NULL, option_d TEXT NOT NULL, correct_index INTEGER NOT NULL, explanation TEXT NOT NULL, hint TEXT NOT NULL, source TEXT, work_tag TEXT, UNIQUE(version_id, question_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, version_id TEXT NOT NULL, island TEXT NOT NULL, score INTEGER NOT NULL, correct_count INTEGER NOT NULL, sure_count INTEGER NOT NULL, hint_count INTEGER NOT NULL, completed_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS answers (attempt_id TEXT NOT NULL, question_id TEXT NOT NULL, selected_index INTEGER NOT NULL, confidence TEXT NOT NULL, used_hint INTEGER NOT NULL, correct INTEGER NOT NULL, PRIMARY KEY(attempt_id, question_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS progress (student_id TEXT NOT NULL, island TEXT NOT NULL, best_score INTEGER NOT NULL DEFAULT 0, trophy INTEGER NOT NULL DEFAULT 0, no_hint_best INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY(student_id, island))"),
  ]);
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now()),
    db.prepare("DELETE FROM sessions WHERE role='student' AND rowid NOT IN (SELECT MAX(rowid) FROM sessions WHERE role='student' GROUP BY subject_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS sessions_student_subject_unique ON sessions(subject_id) WHERE role='student'"),
  ]);
  return db;
}

async function createSession(db: D1Database, role: Role, subjectId: string) {
  const token = `${role}.${crypto.randomUUID()}.${crypto.randomUUID()}`;
  const tokenDigest = await digest(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * (role === "teacher" ? 8 : 24 * 14)).toISOString();
  const insert = db.prepare("INSERT INTO sessions (token_digest, role, subject_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").bind(tokenDigest, role, subjectId, expiresAt, now());
  if (role === "student") {
    await db.batch([
      db.prepare("DELETE FROM sessions WHERE role='student' AND subject_id=?").bind(subjectId),
      insert,
    ]);
  } else {
    await insert.run();
  }
  return token;
}

async function authenticate(request: NextRequest, db: D1Database, expectedRole: Role) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const row = await db.prepare("SELECT role, subject_id AS subjectId, expires_at AS expiresAt FROM sessions WHERE token_digest = ?").bind(await digest(token)).first<{ role: Role; subjectId: string; expiresAt: string }>();
  if (!row || row.role !== expectedRole || row.expiresAt < now()) return null;
  return row;
}

function islandId(value: unknown) {
  const aliases: Record<string, string> = { "字詞迷霧島": "mist", "文意尋蹤島": "trail", "語藝幻境島": "arts", "國學寶藏島": "classics", "線索羅盤島": "compass" };
  const id = aliases[normalized(value)] ?? normalized(value).toLowerCase();
  return ISLANDS.includes(id as typeof ISLANDS[number]) ? id : "";
}

function correctIndex(value: unknown) {
  const raw = normalized(value).toUpperCase();
  if (["A", "B", "C", "D"].includes(raw)) return raw.charCodeAt(0) - 65;
  const number = Number(raw);
  return Number.isInteger(number) && number >= 0 && number <= 3 ? number : Number.isInteger(number) && number >= 1 && number <= 4 ? number - 1 : -1;
}

const badgeForScore = (score: number) => score >= 200 ? "傳奇島主" : score >= 160 ? "經典守護者" : score >= 110 ? "解謎領航家" : score >= 60 ? "知識採集者" : "登島初探者";
const optionLetter = (index: number) => index >= 0 && index <= 3 ? String.fromCharCode(65 + index) : "";
const stripSimpleMarkup = (value: string) => value.replace(/\*\*([\s\S]*?)\*\*/g, "$1").replace(/__([\s\S]*?)__/g, "$1");

type AttemptRow = {
  id: string; studentId: string; classCode: string; className: string; seat: string; nickname: string;
  island: string; score: number; correctCount: number; sureCount: number; hintCount: number; completedAt: string;
};

async function getAttemptSummaries(db: D1Database) {
  const result = await db.prepare(`
    SELECT a.id, a.student_id AS studentId, c.code AS classCode, c.name AS className, s.seat,
      COALESCE(NULLIF(s.nickname,''),NULLIF(s.name,''),'未命名旅人') AS nickname,
      a.island, a.score, a.correct_count AS correctCount, a.sure_count AS sureCount,
      a.hint_count AS hintCount, a.completed_at AS completedAt
    FROM attempts a
    JOIN students s ON s.id=a.student_id
    JOIN classes c ON c.id=s.class_id
    ORDER BY a.completed_at ASC,a.id ASC
  `).all<AttemptRow>();
  const counts = new Map<string, number>();
  return result.results.map((row) => {
    const key = `${row.studentId}\u0000${row.island}`;
    const challengeNumber = (counts.get(key) ?? 0) + 1;
    counts.set(key, challengeNumber);
    return {
      attemptId: row.id,
      challengeId: `${row.classCode}-${row.seat}-${row.island}-${challengeNumber}`,
      classCode: row.classCode,
      className: row.className,
      seat: row.seat,
      nickname: row.nickname,
      island: row.island,
      islandName: ISLAND_NAMES[row.island] ?? row.island,
      completedAt: row.completedAt,
      challengeNumber,
      score: row.score,
      badge: badgeForScore(row.score),
      trophy: row.correctCount >= 18 && row.sureCount >= 10,
      hintCount: row.hintCount,
    };
  });
}

async function getTeacherReport(db: D1Database) {
  const summaries = await getAttemptSummaries(db);
  const challengeIds = new Map(summaries.map((row) => [row.attemptId, row.challengeId]));
  const answerResult = await db.prepare(`
    SELECT ans.attempt_id AS attemptId,a.student_id AS studentId,a.island,a.completed_at AS completedAt,
      ans.question_id AS questionId,ans.selected_index AS selectedIndex,ans.confidence,
      ans.used_hint AS usedHint,ans.correct,q.correct_index AS correctIndex,q.stem
    FROM answers ans
    JOIN attempts a ON a.id=ans.attempt_id
    JOIN questions q ON q.version_id=a.version_id AND q.question_id=ans.question_id
    ORDER BY a.completed_at ASC,ans.attempt_id ASC,ans.question_id ASC
  `).all<{
    attemptId: string; studentId: string; island: string; completedAt: string; questionId: string;
    selectedIndex: number; confidence: string; usedHint: number; correct: number; correctIndex: number; stem: string;
  }>();
  const details = answerResult.results.map((row) => ({
    challengeId: challengeIds.get(row.attemptId) ?? row.attemptId,
    questionId: row.questionId,
    selectedAnswer: optionLetter(row.selectedIndex),
    correctAnswer: optionLetter(row.correctIndex),
    correct: Boolean(row.correct),
    confidence: CONFIDENCE_LABELS[row.confidence] ?? row.confidence,
    usedHint: Boolean(row.usedHint),
  }));
  const firstSeen = new Set<string>();
  const statistics = new Map<string, {
    questionId: string; island: string; islandName: string; stem: string; firstCount: number;
    correctCount: number; sureCount: number; familiarCount: number; guessCount: number; sureWrongCount: number;
  }>();
  for (const row of answerResult.results) {
    const firstKey = `${row.studentId}\u0000${row.island}\u0000${row.questionId}`;
    if (firstSeen.has(firstKey)) continue;
    firstSeen.add(firstKey);
    const statKey = `${row.island}\u0000${row.questionId}`;
    const stat = statistics.get(statKey) ?? {
      questionId: row.questionId,
      island: row.island,
      islandName: ISLAND_NAMES[row.island] ?? row.island,
      stem: stripSimpleMarkup(row.stem),
      firstCount: 0,
      correctCount: 0,
      sureCount: 0,
      familiarCount: 0,
      guessCount: 0,
      sureWrongCount: 0,
    };
    stat.firstCount += 1;
    stat.correctCount += row.correct ? 1 : 0;
    if (row.confidence === "sure") {
      stat.sureCount += 1;
      if (!row.correct) stat.sureWrongCount += 1;
    } else if (row.confidence === "familiar") stat.familiarCount += 1;
    else stat.guessCount += 1;
    statistics.set(statKey, stat);
  }
  const questionStats = [...statistics.values()]
    .map((stat) => ({
      questionId: stat.questionId,
      island: stat.island,
      islandName: stat.islandName,
      stem: stat.stem,
      firstCount: stat.firstCount,
      accuracy: stat.firstCount ? stat.correctCount / stat.firstCount : 0,
      sureCount: stat.sureCount,
      familiarCount: stat.familiarCount,
      guessCount: stat.guessCount,
      unfamiliarity: stat.firstCount ? stat.guessCount / stat.firstCount : 0,
      confidentWrongRate: stat.sureCount ? stat.sureWrongCount / stat.sureCount : 0,
    }))
    .sort((left, right) => ISLANDS.indexOf(left.island as typeof ISLANDS[number]) - ISLANDS.indexOf(right.island as typeof ISLANDS[number]) || left.questionId.localeCompare(right.questionId));
  return { summaries: [...summaries].reverse(), details, questionStats };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = normalized(body.action);
    const db = await getDatabase();

    if (action === "studentLogin") {
      const code = normalized(body.classCode).toUpperCase();
      const seat = normalized(body.seat).padStart(2, "0");
      const pin = normalized(body.pin);
      const student = await db.prepare("SELECT s.id, s.name, s.nickname, c.name AS className FROM students s JOIN classes c ON c.id=s.class_id WHERE c.code=? AND s.seat=? AND s.active=1 AND c.active=1 AND s.pin_digest=?").bind(code, seat, await digest(`student:${pin}`)).first<{ id: string; name: string; nickname: string | null; className: string }>();
      if (!student) return json({ error: "班級代碼、座號或 PIN 碼不正確。" }, 401);
      await db.prepare("UPDATE students SET last_login_at=?, updated_at=? WHERE id=?").bind(now(), now(), student.id).run();
      const progress = await db.prepare("SELECT island, best_score AS bestScore, trophy FROM progress WHERE student_id=?").bind(student.id).all<{ island: string; bestScore: number; trophy: number }>();
      return json({ token: await createSession(db, "student", student.id), student, progress: progress.results });
    }

    if (action === "teacherLogin") {
      const username = normalized(body.username); const password = normalized(body.password);
      let credentials = await db.prepare("SELECT username,password_salt AS passwordSalt,password_digest AS passwordDigest FROM teacher_credentials WHERE id='primary'").first<{ username: string; passwordSalt: string; passwordDigest: string }>();
      if (!credentials) {
        const { env } = await import("cloudflare:workers"); const platformEnv = env as unknown as PlatformEnv;
        if (!platformEnv.TEACHER_USERNAME || !platformEnv.TEACHER_PASSWORD) return json({ error: "教師管理帳號尚未設定。" }, 503);
        if (!/^[^\s]{4,50}$/.test(platformEnv.TEACHER_USERNAME) || !/^\d{6,}$/.test(platformEnv.TEACHER_PASSWORD)) return json({ error: "首次登入設定不符合規則：帳號需為 4～50 個不含空白的字元，密碼需為至少 6 位純數字。請至 Cloudflare 的 Variables and Secrets 修正。" }, 503);
        if (username !== platformEnv.TEACHER_USERNAME || password !== platformEnv.TEACHER_PASSWORD) return json({ error: "管理員帳號或密碼不正確。" }, 401);
        const salt = randomSalt(); const storedDigest = await passwordDigest(password, salt);
        await db.prepare("INSERT OR IGNORE INTO teacher_credentials (id,username,password_salt,password_digest,updated_at) VALUES ('primary',?,?,?,?)").bind(username, salt, storedDigest, now()).run();
        credentials = { username, passwordSalt: salt, passwordDigest: storedDigest };
      }
      const candidate = await passwordDigest(password, credentials.passwordSalt);
      if (username !== credentials.username || !constantEqual(candidate, credentials.passwordDigest)) return json({ error: "管理員帳號或密碼不正確。" }, 401);
      return json({ token: await createSession(db, "teacher", "primary"), username: credentials.username });
    }

    const teacher = await authenticate(request, db, "teacher");
    if (["teacherOverview", "teacherReport", "createClass", "setClassActive", "deleteClass", "importStudents", "importQuestions", "changeTeacherCredentials"].includes(action)) {
      if (!teacher) return json({ error: "教師登入已逾時，請重新登入。" }, 401);

      if (action === "changeTeacherCredentials") {
        const currentPassword = normalized(body.currentPassword); const newUsername = normalized(body.newUsername); const newPassword = normalized(body.newPassword);
        if (!/^[^\s]{4,50}$/.test(newUsername)) return json({ error: "管理帳號需為 4～50 個字元，且不可包含空白。" }, 400);
        if (!/^\d{6,}$/.test(newPassword)) return json({ error: "新密碼需為至少 6 位數字。" }, 400);
        const credentials = await db.prepare("SELECT password_salt AS passwordSalt,password_digest AS passwordDigest FROM teacher_credentials WHERE id='primary'").first<{ passwordSalt: string; passwordDigest: string }>();
        if (!credentials) return json({ error: "帳號尚未完成啟用，請重新登入後再試。" }, 409);
        const currentDigest = await passwordDigest(currentPassword, credentials.passwordSalt);
        if (!constantEqual(currentDigest, credentials.passwordDigest)) return json({ error: "目前密碼不正確。" }, 401);
        const salt = randomSalt(); const newDigest = await passwordDigest(newPassword, salt);
        await db.batch([
          db.prepare("UPDATE teacher_credentials SET username=?,password_salt=?,password_digest=?,updated_at=? WHERE id='primary'").bind(newUsername, salt, newDigest, now()),
          db.prepare("DELETE FROM sessions WHERE role='teacher'"),
        ]);
        return json({ ok: true });
      }

      if (action === "createClass") {
        const code = normalized(body.code).toUpperCase();
        const name = normalized(body.name);
        if (!code || !name) return json({ error: "請填寫班級代碼與班級名稱。" }, 400);
        await db.prepare("INSERT INTO classes (id,code,name,active,created_at) VALUES (?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name, active=1").bind(crypto.randomUUID(), code, name, 1, now()).run();
        return json({ ok: true });
      }

      if (action === "setClassActive") {
        const code = normalized(body.code).toUpperCase();
        const classRow = await db.prepare("SELECT id FROM classes WHERE code=?").bind(code).first<{ id: string }>();
        if (!classRow) return json({ error: "找不到指定班級。" }, 404);
        await db.prepare("UPDATE classes SET active=? WHERE id=?").bind(Boolean(body.active) ? 1 : 0, classRow.id).run();
        return json({ ok: true });
      }

      if (action === "deleteClass") {
        const code = normalized(body.code).toUpperCase();
        if (normalized(body.confirmCode).toUpperCase() !== code) return json({ error: "班級刪除確認失敗。" }, 400);
        const classRow = await db.prepare("SELECT id FROM classes WHERE code=?").bind(code).first<{ id: string }>();
        if (!classRow) return json({ error: "找不到指定班級。" }, 404);
        await db.batch([
          db.prepare("DELETE FROM answers WHERE attempt_id IN (SELECT a.id FROM attempts a JOIN students s ON s.id=a.student_id WHERE s.class_id=?)").bind(classRow.id),
          db.prepare("DELETE FROM progress WHERE student_id IN (SELECT id FROM students WHERE class_id=?)").bind(classRow.id),
          db.prepare("DELETE FROM sessions WHERE role='student' AND subject_id IN (SELECT id FROM students WHERE class_id=?)").bind(classRow.id),
          db.prepare("DELETE FROM attempts WHERE student_id IN (SELECT id FROM students WHERE class_id=?)").bind(classRow.id),
          db.prepare("DELETE FROM students WHERE class_id=?").bind(classRow.id),
          db.prepare("DELETE FROM classes WHERE id=?").bind(classRow.id),
        ]);
        return json({ ok: true });
      }

      if (action === "teacherReport") return json(await getTeacherReport(db));

      if (action === "importStudents") {
        const code = normalized(body.classCode).toUpperCase();
        const classRow = await db.prepare("SELECT id FROM classes WHERE code=?").bind(code).first<{ id: string }>();
        if (!classRow) return json({ error: "找不到班級代碼，請先建立班級。" }, 400);
        const rows = Array.isArray(body.rows) ? body.rows as Record<string, unknown>[] : [];
        if (!rows.length) return json({ error: "學生名單沒有資料。" }, 400);
        const statements = [];
        for (const row of rows) {
          const seat = normalized(row.seat ?? row["座號"]).padStart(2, "0");
          const name = normalized(row.name ?? row["姓名"]);
          const studentNo = normalized(row.studentNo ?? row["學號"]);
          const pin = normalized(row.pin ?? row["PIN"] ?? studentNo);
          if (!seat || !name || !pin) return json({ error: `名單中的座號 ${seat || "未知"} 缺少姓名或 PIN。` }, 400);
          const stamp = now();
          statements.push(db.prepare("INSERT INTO students (id,class_id,seat,student_no,name,nickname,pin_digest,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(class_id,seat) DO UPDATE SET student_no=excluded.student_no,name=excluded.name,pin_digest=excluded.pin_digest,active=1,updated_at=excluded.updated_at").bind(crypto.randomUUID(), classRow.id, seat, studentNo || null, name, null, await digest(`student:${pin}`), 1, stamp, stamp));
        }
        await db.batch(statements);
        return json({ ok: true, count: rows.length });
      }

      if (action === "importQuestions") {
        const rows = Array.isArray(body.rows) ? body.rows as Record<string, unknown>[] : [];
        if (!rows.length) return json({ error: "題庫沒有資料。" }, 400);
        const parsed = rows.map((row) => ({
          questionId: normalized(row.questionId ?? row["題目ID"] ?? row["題目 ID"]), island: islandId(row.island ?? row["島嶼"] ?? row["所屬島嶼"]),
          stem: normalized(row.stem ?? row["題幹"]), passage: normalized(row.passage ?? row["題文"] ?? row["閱讀文本"]),
          options: [normalized(row.optionA ?? row["選項A"] ?? row["選項 A"]), normalized(row.optionB ?? row["選項B"] ?? row["選項 B"]), normalized(row.optionC ?? row["選項C"] ?? row["選項 C"]), normalized(row.optionD ?? row["選項D"] ?? row["選項 D"])],
          answer: correctIndex(row.answer ?? row["正確選項"] ?? row["正解"]), explanation: normalized(row.explanation ?? row["解析"]), hint: normalized(row.hint ?? row["提示"]), source: normalized(row.source ?? row["出處"]), workTag: normalized(row.workTag ?? row["篇目標籤"]),
          enabled: !["停用", "草稿", "0", "false"].includes(normalized(row.enabled ?? row["啟用狀態"] ?? row["狀態"] ?? "啟用").toLowerCase()),
        }));
        const ids = new Set<string>();
        for (const item of parsed) {
          if (!item.questionId || !item.island || !item.stem || item.options.some((option) => !option) || item.answer < 0 || !item.explanation || !item.hint) return json({ error: `題目 ${item.questionId || "未知"} 欄位不完整。` }, 400);
          if (ids.has(item.questionId)) return json({ error: `題目 ID 重複：${item.questionId}` }, 400);
          ids.add(item.questionId);
        }
        const counts = Object.fromEntries(ISLANDS.map((id) => [id, parsed.filter((item) => item.island === id && item.enabled).length]));
        if (ISLANDS.some((id) => counts[id] !== 20)) return json({ error: `正式發布需每島恰好 20 題。目前：${ISLANDS.map((id) => `${id} ${counts[id]} 題`).join("、")}` }, 400);
        const latest = await db.prepare("SELECT COALESCE(MAX(version_number),0) AS versionNumber FROM question_versions").first<{ versionNumber: number }>();
        const versionNumber = (latest?.versionNumber ?? 0) + 1; const versionId = crypto.randomUUID(); const stamp = now();
        const statements = [db.prepare("INSERT INTO question_versions (id,version_number,status,created_at,published_at) VALUES (?,?,?,?,?)").bind(versionId, versionNumber, "published", stamp, stamp)];
        parsed.forEach((item) => statements.push(db.prepare("INSERT INTO questions (id,version_id,question_id,island,enabled,stem,passage,option_a,option_b,option_c,option_d,correct_index,explanation,hint,source,work_tag) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), versionId, item.questionId, item.island, item.enabled ? 1 : 0, item.stem, item.passage || null, ...item.options, item.answer, item.explanation, item.hint, item.source || null, item.workTag || null)));
        await db.batch(statements);
        return json({ ok: true, versionNumber, count: parsed.length });
      }

      const stats = await db.prepare("SELECT (SELECT COUNT(*) FROM classes WHERE active=1) AS classCount,(SELECT COUNT(*) FROM students WHERE active=1) AS studentCount,(SELECT COUNT(*) FROM attempts) AS attemptCount,(SELECT COALESCE(ROUND(AVG(score)/2.0),0) FROM attempts) AS accuracy,(SELECT COALESCE(MAX(version_number),0) FROM question_versions WHERE status='published') AS versionNumber,(SELECT COUNT(*) FROM questions q JOIN question_versions v ON v.id=q.version_id WHERE v.status='published' AND v.version_number=(SELECT MAX(version_number) FROM question_versions WHERE status='published')) AS questionCount").first();
      const classes = await db.prepare("SELECT c.code,c.name,c.active,COUNT(s.id) AS studentCount FROM classes c LEFT JOIN students s ON s.class_id=c.id GROUP BY c.id ORDER BY c.created_at DESC").all();
      const students = await db.prepare("SELECT c.code AS classCode,c.name AS className,s.seat,s.name,s.nickname,s.last_login_at AS lastLoginAt FROM students s JOIN classes c ON c.id=s.class_id ORDER BY c.code,s.seat").all();
      const attempts = await getAttemptSummaries(db);
      return json({ stats, classes: classes.results, students: students.results, attempts: attempts.reverse().slice(0, 200) });
    }

    const studentSession = await authenticate(request, db, "student");
    if (!studentSession) return json({ error: "登入階段已失效；此帳號可能已在另一台裝置登入。為保護帳號，請重新登入。" }, 401);

    if (action === "studentSessionStatus") return json({ ok: true });

    if (action === "studentLogout") {
      const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (token) await db.prepare("DELETE FROM sessions WHERE token_digest=? AND role='student'").bind(await digest(token)).run();
      return json({ ok: true });
    }

    if (action === "setNickname") {
      const nickname = normalized(body.nickname).slice(0, 10);
      if (nickname.length < 2) return json({ error: "暱稱請輸入 2～10 個字。" }, 400);
      await db.prepare("UPDATE students SET nickname=?,updated_at=? WHERE id=?").bind(nickname, now(), studentSession.subjectId).run();
      return json({ ok: true, nickname });
    }

    if (action === "getQuestions") {
      const island = islandId(body.island);
      const version = await db.prepare("SELECT id,version_number AS versionNumber FROM question_versions WHERE status='published' ORDER BY version_number DESC LIMIT 1").first<{ id: string; versionNumber: number }>();
      if (!version) return json({ error: "教師尚未發布正式題庫。" }, 404);
      const result = await db.prepare("SELECT question_id AS id,stem,passage,option_a AS optionA,option_b AS optionB,option_c AS optionC,option_d AS optionD,correct_index AS answer,explanation,hint,source FROM questions WHERE version_id=? AND island=? AND enabled=1 ORDER BY RANDOM() LIMIT 20").bind(version.id, island).all<Record<string, unknown>>();
      return json({ versionId: version.id, versionNumber: version.versionNumber, questions: result.results.map((row) => ({ id: row.id, stem: row.stem, passage: row.passage || undefined, options: [row.optionA, row.optionB, row.optionC, row.optionD], answer: row.answer, explanation: row.explanation, hint: row.hint, source: row.source || "教師題庫" })) });
    }

    if (action === "completeAttempt") {
      const island = islandId(body.island); const versionId = normalized(body.versionId);
      const records = Array.isArray(body.answers) ? body.answers as Record<string, unknown>[] : [];
      const correctRows = await db.prepare("SELECT question_id AS questionId,correct_index AS correctIndex FROM questions WHERE version_id=? AND island=? AND enabled=1").bind(versionId, island).all<{ questionId: string; correctIndex: number }>();
      const answerKey = new Map(correctRows.results.map((row) => [row.questionId, row.correctIndex]));
      if (!versionId || answerKey.size !== 20 || records.length !== 20) return json({ error: "作答資料不完整，未寫入成績。" }, 400);
      const evaluated = records.map((record) => ({ questionId: normalized(record.questionId), selected: Number(record.selected), confidence: normalized(record.confidence), usedHint: Boolean(record.usedHint), correct: answerKey.get(normalized(record.questionId)) === Number(record.selected) }));
      const correctCount = evaluated.filter((record) => record.correct).length; const sureCount = evaluated.filter((record) => record.confidence === "sure").length; const hintCount = evaluated.filter((record) => record.usedHint).length; const score = correctCount * 10; const trophy = correctCount >= 18 && sureCount >= 10 ? 1 : 0; const attemptId = crypto.randomUUID(); const stamp = now();
      const statements = [db.prepare("INSERT INTO attempts (id,student_id,version_id,island,score,correct_count,sure_count,hint_count,completed_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(attemptId, studentSession.subjectId, versionId, island, score, correctCount, sureCount, hintCount, stamp)];
      evaluated.forEach((record) => statements.push(db.prepare("INSERT INTO answers (attempt_id,question_id,selected_index,confidence,used_hint,correct) VALUES (?,?,?,?,?,?)").bind(attemptId, record.questionId, record.selected, record.confidence, record.usedHint ? 1 : 0, record.correct ? 1 : 0)));
      statements.push(db.prepare("INSERT INTO progress (student_id,island,best_score,trophy,no_hint_best,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(student_id,island) DO UPDATE SET best_score=MAX(best_score,excluded.best_score),trophy=MAX(trophy,excluded.trophy),no_hint_best=MAX(no_hint_best,excluded.no_hint_best),updated_at=excluded.updated_at").bind(studentSession.subjectId, island, score, trophy, hintCount === 0 ? score : 0, stamp));
      await db.batch(statements);
      return json({ score, correctCount, sureCount, hintCount, trophy: Boolean(trophy) });
    }

    if (action === "leaderboard") {
      const island = islandId(body.island);
      const result = await db.prepare("SELECT c.name AS className,COALESCE(NULLIF(s.nickname,''),'未命名旅人') AS nickname,p.best_score AS score,p.no_hint_best AS noHintBest FROM progress p JOIN students s ON s.id=p.student_id JOIN classes c ON c.id=s.class_id WHERE p.island=? ORDER BY p.best_score DESC,p.no_hint_best DESC,s.seat ASC LIMIT 20").bind(island).all<{ className: string; nickname: string; score: number; noHintBest: number }>();
      let previousScore = -1; let rank = 0;
      return json({ players: result.results.map((player, index) => { if (player.score !== previousScore) rank = index + 1; previousScore = player.score; return { rank, className: player.className, nickname: player.nickname, score: player.score, hint: player.noHintBest >= player.score && player.score > 0 }; }) });
    }

    return json({ error: "未知操作。" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "伺服器暫時無法處理請求。" }, 500);
  }
}
