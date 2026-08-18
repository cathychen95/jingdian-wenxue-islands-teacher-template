import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("classes_code_unique").on(table.code)]);

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull().references(() => classes.id),
  seat: text("seat").notNull(),
  studentNo: text("student_no"),
  name: text("name").notNull(),
  nickname: text("nickname"),
  pinDigest: text("pin_digest").notNull(),
  active: integer("active").notNull().default(1),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("students_class_seat_unique").on(table.classId, table.seat)]);

export const sessions = sqliteTable("sessions", {
  tokenDigest: text("token_digest").primaryKey(),
  role: text("role").notNull(),
  subjectId: text("subject_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("sessions_student_subject_unique").on(table.subjectId).where(sql`${table.role} = 'student'`)]);

export const teacherCredentials = sqliteTable("teacher_credentials", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordDigest: text("password_digest").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("teacher_credentials_username_unique").on(table.username)]);

export const questionVersions = sqliteTable("question_versions", {
  id: text("id").primaryKey(),
  versionNumber: integer("version_number").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  publishedAt: text("published_at"),
}, (table) => [uniqueIndex("question_versions_number_unique").on(table.versionNumber)]);

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => questionVersions.id),
  questionId: text("question_id").notNull(),
  island: text("island").notNull(),
  enabled: integer("enabled").notNull().default(1),
  stem: text("stem").notNull(),
  passage: text("passage"),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation").notNull(),
  hint: text("hint").notNull(),
  source: text("source"),
  workTag: text("work_tag"),
}, (table) => [uniqueIndex("questions_version_question_unique").on(table.versionId, table.questionId)]);

export const attempts = sqliteTable("attempts", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  versionId: text("version_id").notNull().references(() => questionVersions.id),
  island: text("island").notNull(),
  score: integer("score").notNull(),
  correctCount: integer("correct_count").notNull(),
  sureCount: integer("sure_count").notNull(),
  hintCount: integer("hint_count").notNull(),
  completedAt: text("completed_at").notNull(),
});

export const answers = sqliteTable("answers", {
  attemptId: text("attempt_id").notNull().references(() => attempts.id),
  questionId: text("question_id").notNull(),
  selectedIndex: integer("selected_index").notNull(),
  confidence: text("confidence").notNull(),
  usedHint: integer("used_hint").notNull(),
  correct: integer("correct").notNull(),
}, (table) => [primaryKey({ columns: [table.attemptId, table.questionId] })]);

export const progress = sqliteTable("progress", {
  studentId: text("student_id").notNull().references(() => students.id),
  island: text("island").notNull(),
  bestScore: integer("best_score").notNull().default(0),
  trophy: integer("trophy").notNull().default(0),
  noHintBest: integer("no_hint_best").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.studentId, table.island] })]);
