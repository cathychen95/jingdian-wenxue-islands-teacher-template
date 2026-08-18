"use client";

import { ChangeEvent, FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type IslandId = "mist" | "trail" | "arts" | "classics" | "compass";
type Screen = "login" | "story" | "nickname" | "map" | "island" | "quiz" | "feedback" | "result" | "analysis" | "achievements" | "settings" | "teacher-login" | "teacher";
type Confidence = "sure" | "familiar" | "guess";
type Question = { id: string; stem: string; passage?: string; options: string[]; answer: number; hint: string; explanation: string; source: string };
type Island = { id: IslandId; name: string; subtitle: string; guardian: string; species: string; personality: string; image: string; className: string; quote: string; accessories: string[]; questions: Question[] };
type AnswerRecord = { question: Question; selected: number; confidence: Confidence; usedHint: boolean; correct: boolean };
type LeaderboardPlayer = { rank: number; className: string; nickname: string; score: number; hint: boolean };
type TeacherAttempt = { attemptId: string; challengeId: string; classCode: string; className: string; seat: string; nickname: string; island: IslandId; islandName: string; completedAt: string; challengeNumber: number; score: number; badge: string; trophy: boolean; hintCount: number };
type TeacherAnswerDetail = { challengeId: string; questionId: string; selectedAnswer: string; correctAnswer: string; correct: boolean; confidence: string; usedHint: boolean };
type TeacherQuestionStat = { questionId: string; island: IslandId; islandName: string; stem: string; firstCount: number; accuracy: number; sureCount: number; familiarCount: number; guessCount: number; unfamiliarity: number; confidentWrongRate: number };
type TeacherReport = { summaries: TeacherAttempt[]; details: TeacherAnswerDetail[]; questionStats: TeacherQuestionStat[] };
type TeacherData = { stats?: Record<string, number>; classes?: Record<string, unknown>[]; students?: Record<string, unknown>[]; attempts?: TeacherAttempt[] };

function renderMarkedText(value: string, path = "text"): ReactNode[] {
  const normalizedValue = String(value ?? "").replace(/\r\n?/g, "\n");
  const pattern = /(\*\*([\s\S]*?)\*\*|__([\s\S]*?)__|\n)/g;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of normalizedValue.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push(normalizedValue.slice(cursor, start));
    if (match[0] === "\n") parts.push(<br key={`${path}-br-${index}`} />);
    else if (match[2] !== undefined) parts.push(<strong key={`${path}-strong-${index}`}>{renderMarkedText(match[2], `${path}-strong-${index}`)}</strong>);
    else parts.push(<u key={`${path}-underline-${index}`}>{renderMarkedText(match[3] ?? "", `${path}-underline-${index}`)}</u>);
    cursor = start + match[0].length;
    index += 1;
  }
  if (cursor < normalizedValue.length) parts.push(normalizedValue.slice(cursor));
  return parts;
}

const RichText = ({ children }: { children: string }) => <>{renderMarkedText(children)}</>;

const islands: Island[] = [
  { id: "mist", name: "字詞迷霧島", subtitle: "形音義辨析", guardian: "墨點", species: "墨靈貓", personality: "敏銳細心、略帶傲嬌", image: "/guardians/modian.jpg", className: "island-ink", quote: "字形差一筆，意思可就差遠了。讓我來看看你的眼力！", accessories: ["墨滴識字領巾", "偏旁採集袋", "聲韻聽辨鏡", "方格守字披風", "筆鋒島主冠"], questions: [
    { id: "W-001", stem: "下列「形單影隻」的讀音，何者正確？", options: ["ㄒㄧㄥˊ ㄉㄢ ㄧㄥˇ ㄓ", "ㄒㄧㄥˋ ㄉㄢ ㄧㄥˋ ㄓ", "ㄒㄧㄥˊ ㄉㄢ ㄧㄣˇ ㄓˇ", "ㄒㄧㄣˊ ㄉㄢ ㄧㄥˇ ㄓ"], answer: 0, hint: "留意「形」和「隻」的聲調。", explanation: "「形單影隻」讀作 ㄒㄧㄥˊ ㄉㄢ ㄧㄥˇ ㄓ，形容孤單無伴。", source: "統測國文｜字音辨析" },
    { id: "W-002", stem: "下列成語用字，何者完全正確？", options: ["不逕而走", "不脛而走", "不徑而走", "不競而走"], answer: 1, hint: "這個字和小腿有關，不是道路。", explanation: "正確寫法是「不脛而走」；脛是小腿，比喻事物無需推行便迅速傳播。", source: "統測國文｜字形辨析" },
  ] },
  { id: "trail", name: "文意尋蹤島", subtitle: "文意理解", guardian: "青蹤", species: "靈角鹿", personality: "沉穩溫柔、善於傾聽", image: "/guardians/qingzong.jpg", className: "island-cyan", quote: "答案往往藏在上下文裡，我們沿著句子的足跡慢慢找。", accessories: ["葉脈線索墜飾", "尋蹤地圖囊", "文脈引路角環", "青簡守護披肩", "文心尋蹤冠"], questions: [
    { id: "R-001", passage: "余憶童稚時，能張目對日，明察秋毫；見藐小之物必細察其紋理，故時有物外之趣。", stem: "依據文意，作者能獲得「物外之趣」的主要原因是什麼？", options: ["擁有珍奇玩具", "細心觀察並發揮想像", "經常外出旅行", "熟讀大量古籍"], answer: 1, hint: "找出「故」字前面的原因。", explanation: "作者細察微小事物的紋理，再以想像轉化，因此產生超越事物本身的趣味。", source: "沈復〈兒時記趣〉" },
    { id: "R-002", passage: "故天將降大任於是人也，必先苦其心志，勞其筋骨，餓其體膚。", stem: "這段話最強調下列哪一觀點？", options: ["成功全憑運氣", "磨難能鍛鍊承擔大任的能力", "身體勞動比讀書重要", "人才不需要外在考驗"], answer: 1, hint: "想想「先苦」和「大任」之間的關係。", explanation: "文句指出承擔大任前往往先經歷身心磨鍊，以增益其所不能。", source: "《孟子・告子下》" },
  ] },
  { id: "arts", name: "語藝幻境島", subtitle: "詞語、句型、修辭解讀", guardian: "緋語", species: "赤尾狐仙", personality: "機靈幽默、喜歡變化", image: "/guardians/feiyu.jpg", className: "island-red", quote: "一句話可以變出好多風景。看清楚，我的尾巴要施展修辭啦！", accessories: ["標點幻音尾鈴", "語詞變幻頸帶", "句型編織腰封", "修辭幻術斗篷", "三藝流光額冠"], questions: [
    { id: "A-001", stem: "「月光如流水一般，靜靜地瀉在這一片葉子和花上。」主要使用何種修辭？", options: ["譬喻", "設問", "借代", "頂真"], answer: 0, hint: "句中有一個明顯的比喻詞。", explanation: "以「如」將月光比作流水，屬於明喻。", source: "朱自清〈荷塘月色〉" },
    { id: "A-002", stem: "「風來了，竹林醒了；雨來了，山谷唱了。」最明顯運用何種修辭？", options: ["轉品", "擬人", "映襯", "層遞"], answer: 1, hint: "竹林真的會醒、山谷真的會唱嗎？", explanation: "把「醒」與「唱」等人的行為賦予自然景物，屬於擬人。", source: "示範題｜修辭判讀" },
  ] },
  { id: "classics", name: "國學寶藏島", subtitle: "國學常識", guardian: "硯甲", species: "藏書玄龜", personality: "博學可靠、慢條斯理", image: "/guardians/yanjia.jpg", className: "island-gold", quote: "別急，典籍的寶藏需要慢慢翻。這一題，我的龜甲裡正好有線索。", accessories: ["竹簡博聞牌", "典籍卷軸架", "朝代年輪盤", "藏經守護甲", "博古島主冠"], questions: [
    { id: "C-001", stem: "被譽為「史家之絕唱，無韻之離騷」的《史記》，作者是誰？", options: ["班固", "司馬遷", "司馬光", "左丘明"], answer: 1, hint: "他曾任太史令，忍辱完成通史。", explanation: "《史記》由西漢司馬遷撰寫，是中國第一部紀傳體通史。", source: "國學常識｜史傳文學" },
    { id: "C-002", stem: "下列何人不屬於「唐宋八大家」？", options: ["韓愈", "柳宗元", "蘇軾", "李白"], answer: 3, hint: "其中一位以浪漫詩風聞名，而非古文運動。", explanation: "李白是盛唐詩人；唐宋八大家中的唐代作家為韓愈、柳宗元。", source: "國學常識｜文學流派" },
  ] },
  { id: "compass", name: "線索羅盤島", subtitle: "綜合判讀", guardian: "星羅", species: "羅盤紙鶴", personality: "冷靜理性、重視證據", image: "/guardians/xingluo.jpg", className: "island-blue", quote: "先把線索排好，再決定方向。證據不會大聲說話，但它很誠實。", accessories: ["星點探索腳環", "線索羅盤章", "圖表判讀翼箋", "群星領航披巾", "天穹島主光環"], questions: [
    { id: "L-001", passage: "閱讀調查：紙本閱讀 35%、手機閱讀 45%、平板閱讀 12%、其他 8%。", stem: "依據資料，下列敘述何者正確？", options: ["紙本閱讀比例最高", "手機閱讀超過總數一半", "手機閱讀比紙本高 10 個百分點", "平板與其他合計超過紙本"], answer: 2, hint: "先比較 45 與 35 的差距。", explanation: "手機閱讀 45%，紙本閱讀 35%，兩者相差 10 個百分點。", source: "示範題｜圖表判讀" },
    { id: "L-002", passage: "甲主張保留老樹可降低夏季體感溫度；乙資料顯示有樹蔭區平均比無樹蔭區低 2.4°C。", stem: "乙資料對甲主張具有何種作用？", options: ["提出反例", "提供數據支持", "轉移討論主題", "否定因果關係"], answer: 1, hint: "判斷數據與主張的方向是否一致。", explanation: "乙資料以溫度差異的實測數據，支持老樹樹蔭可降低體感溫度的主張。", source: "示範題｜跨文本判讀" },
  ] },
];

const confidenceMeta: Record<Confidence, { emoji: string; label: string }> = { sure: { emoji: "😎", label: "很確定" }, familiar: { emoji: "🙂", label: "有印象" }, guess: { emoji: "🤔", label: "我猜的" } };
const badgeFor = (score: number) => score >= 200 ? "傳奇島主" : score >= 160 ? "經典守護者" : score >= 110 ? "解謎領航家" : score >= 60 ? "知識採集者" : "登島初探者";
const unlockedCount = (score: number) => score >= 200 ? 5 : score >= 160 ? 4 : score >= 110 ? 3 : score >= 60 ? 2 : 1;
const outfitSheets: Record<IslandId, string> = { mist: "/guardians/outfits/modian-sheet-v2.png", trail: "/guardians/outfits/qingzong-sheet.jpg", arts: "/guardians/outfits/feiyu-sheet.jpg", classics: "/guardians/outfits/yanjia-sheet.jpg", compass: "/guardians/outfits/xingluo-sheet.jpg" };
const outfitPositions = ["0% 0%", "50% 0%", "100% 0%", "0% 100%", "50% 100%"];
const accessoryMilestones = ["登島即獲得", "達 60 分", "達 110 分", "達 160 分", "達 200 分"];
const storyScenes = [
  { eyebrow: "序章 · 文海甦醒", title: "經典，是歷史留給我們的寶藏", copy: "千百年來，詩文、典籍與故事承載著先人的情感與智慧。那些文字並未沉睡，而是在遙遠海面上凝聚成光。", mark: "典" },
  { eyebrow: "第一章 · 五島之光", title: "五座島嶼，收藏五種文學力量", copy: "字詞、文意、語藝、國學與線索判讀，化作五座彼此相連的冒險島嶼。每座島都蘊藏不同的知識能量，等待旅人喚醒。", mark: "五" },
  { eyebrow: "第二章 · 旅人啟程", title: "而你，將寫下新的航海篇章", copy: "探索五島、解開任務，並邂逅守護島嶼的神祕生物。隨著知識與成就累積，你也會看見牠們逐漸展現不同樣貌。", mark: "旅" },
];
export default function Home() {
  const [screen, setScreen] = useState<Screen>("login");
  const [classCode, setClassCode] = useState("");
  const [seat, setSeat] = useState("");
  const [pin, setPin] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [studentToken, setStudentToken] = useState("");
  const [teacherToken, setTeacherToken] = useState("");
  const [teacherUsername, setTeacherUsername] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [currentTeacherPassword, setCurrentTeacherPassword] = useState("");
  const [newTeacherUsername, setNewTeacherUsername] = useState("");
  const [newTeacherPassword, setNewTeacherPassword] = useState("");
  const [confirmTeacherPassword, setConfirmTeacherPassword] = useState("");
  const [teacherData, setTeacherData] = useState<TeacherData>({});
  const [busy, setBusy] = useState(false);
  const [storyStep, setStoryStep] = useState(0);
  const [selectedIslandId, setSelectedIslandId] = useState<IslandId>("mist");
  const [outfitPreviewTier, setOutfitPreviewTier] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [challengeQuestions, setChallengeQuestions] = useState<Question[]>(islands[0].questions);
  const [questionVersionId, setQuestionVersionId] = useState("");
  const [scores, setScores] = useState<Partial<Record<IslandId, number>>>({});
  const [trophies, setTrophies] = useState<Partial<Record<IslandId, boolean>>>({});
  const [soundOn, setSoundOn] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [toast, setToast] = useState("");
  const [leaderboardIslandId, setLeaderboardIslandId] = useState<IslandId>("mist");
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [teacherTab, setTeacherTab] = useState<"overview" | "students" | "questions" | "import" | "security">("overview");
  const audioRef = useRef<AudioContext | null>(null);
  const musicTimerRef = useRef<number | null>(null);
  const selectedIsland = useMemo(() => islands.find((island) => island.id === selectedIslandId) ?? islands[0], [selectedIslandId]);
  const leaderboardIsland = useMemo(() => islands.find((island) => island.id === leaderboardIslandId) ?? islands[0], [leaderboardIslandId]);
  const question = challengeQuestions[questionIndex] ?? selectedIsland.questions[0];

  useEffect(() => {
    const saved = window.localStorage.getItem("literature-islands-preview");
    if (!saved) return;
    try { const data = JSON.parse(saved); if (typeof data.soundOn === "boolean") setSoundOn(data.soundOn); if (typeof data.reduceMotion === "boolean") setReduceMotion(data.reduceMotion); }
    catch { window.localStorage.removeItem("literature-islands-preview"); }
  }, []);
  useEffect(() => { window.localStorage.setItem("literature-islands-preview", JSON.stringify({ soundOn, reduceMotion })); }, [soundOn, reduceMotion]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (outfitPreviewTier === null) return;
    const closePreview = (event: KeyboardEvent) => { if (event.key === "Escape") setOutfitPreviewTier(null); };
    window.addEventListener("keydown", closePreview);
    return () => window.removeEventListener("keydown", closePreview);
  }, [outfitPreviewTier]);
  const getAudio = (force = false) => {
    if ((!soundOn && !force) || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = audioRef.current ?? new AudioCtx(); audioRef.current = context; void context.resume(); return context;
  };
  const soundNote = (context: AudioContext, frequency: number, start: number, duration: number, volume: number, type: OscillatorType = "sine") => {
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .025); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(context.destination); oscillator.start(start); oscillator.stop(start + duration + .04);
  };
  const playSound = (kind: "transition" | "select" | "correct" | "wrong" | "reward") => {
    const context = getAudio(); if (!context) return; const now = context.currentTime;
    const notes = kind === "transition" ? [523, 659] : kind === "select" ? [740] : kind === "correct" ? [659, 784, 988] : kind === "wrong" ? [294, 247] : [523, 659, 784, 1047];
    notes.forEach((frequency, index) => soundNote(context, frequency, now + index * .11, kind === "reward" ? .55 : .32, kind === "wrong" ? .045 : .065, kind === "wrong" ? "triangle" : "sine"));
    if (kind === "reward") [262, 330, 392].forEach((frequency) => soundNote(context, frequency, now, 1.8, .018, "triangle"));
  };
  const playMusicBar = () => {
    const context = getAudio(); if (!context) return; const start = context.currentTime + .08;
    [262, 330, 392].forEach((frequency) => soundNote(context, frequency, start, 6.2, .007, "triangle"));
    [523, 659, 784, 659, 587, 698, 880, 784, 659, 587].forEach((frequency, index) => soundNote(context, frequency, start + index * .58, .5, .014, index % 3 === 0 ? "triangle" : "sine"));
  };
  useEffect(() => {
    if (!soundOn) { if (musicTimerRef.current !== null) window.clearInterval(musicTimerRef.current); musicTimerRef.current = null; return; }
    playMusicBar();
    musicTimerRef.current = window.setInterval(playMusicBar, 6800);
    return () => { if (musicTimerRef.current !== null) window.clearInterval(musicTimerRef.current); musicTimerRef.current = null; };
    // The music loop intentionally restarts only when the sound switch changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundOn]);
  const enableSound = () => {
    if (soundOn) { setSoundOn(false); setToast("音效已關閉"); return; }
    getAudio(true);
    setSoundOn(true); setToast("魔幻輕音樂與遊戲音效已開啟");
  };
  const api = async <T,>(action: string, payload: Record<string, unknown> = {}, token = "") => {
    const response = await fetch("/api/platform", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action, ...payload }) });
    const data = await response.json() as T & { error?: string };
    if (!response.ok) {
      if (response.status === 401 && token && token === studentToken) {
        setStudentToken(""); setPin(""); setScores({}); setTrophies({}); setScreen("login"); window.scrollTo({ top: 0 });
      }
      throw new Error(data.error || "連線失敗，請稍後再試。");
    }
    return data;
  };
  const go = (next: Screen, cue: "transition" | "select" | "correct" | "wrong" | "reward" = "transition") => { playSound(cue); setScreen(next); window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); };
  const openSettings = () => { setNicknameDraft(nickname); go("settings"); };
  useEffect(() => {
    if (!studentToken) return;
    const verifySession = () => { void api("studentSessionStatus", {}, studentToken).catch((error) => setToast(error instanceof Error ? error.message : "登入階段已失效，請重新登入。")); };
    const timer = window.setInterval(verifySession, 30000);
    window.addEventListener("focus", verifySession);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", verifySession); };
    // Only a new student token should restart the session monitor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentToken]);
  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!classCode.trim() || !seat.trim() || !pin.trim()) return;
    setBusy(true);
    try {
      const data = await api<{ token: string; student: { nickname?: string | null }; progress: { island: IslandId; bestScore: number; trophy: number }[] }>("studentLogin", { classCode, seat, pin });
      setStudentToken(data.token); setNickname(data.student.nickname ?? "");
      setScores(Object.fromEntries(data.progress.map((item) => [item.island, item.bestScore])) as Partial<Record<IslandId, number>>);
      setTrophies(Object.fromEntries(data.progress.map((item) => [item.island, Boolean(item.trophy)])) as Partial<Record<IslandId, boolean>>);
      getAudio(true); setSoundOn(true); setStoryStep(0); setScreen(data.student.nickname ? "map" : "story"); window.scrollTo({ top: 0 });
    } catch (error) { setToast(error instanceof Error ? error.message : "登入失敗"); }
    finally { setBusy(false); }
  };
  const saveNickname = async () => {
    const nextNickname = nickname.trim();
    if (!studentToken || nextNickname.length < 2) return;
    setBusy(true); try { await api("setNickname", { nickname: nextNickname }, studentToken); setNickname(nextNickname); go("map"); } catch (error) { setToast(error instanceof Error ? error.message : "暱稱儲存失敗"); } finally { setBusy(false); }
  };
  const saveSettings = async () => {
    const nextNickname = nicknameDraft.trim();
    if (!studentToken || nextNickname.length < 2 || nextNickname.length > 10) { setToast("暱稱請輸入 2～10 個字。"); return; }
    setBusy(true);
    try {
      if (nextNickname !== nickname) await api("setNickname", { nickname: nextNickname }, studentToken);
      setNickname(nextNickname); setToast(nextNickname === nickname ? "設定已儲存" : "暱稱與設定已更新"); go("map");
    } catch (error) { setToast(error instanceof Error ? error.message : "設定儲存失敗"); }
    finally { setBusy(false); }
  };
  const logoutStudent = async () => {
    const token = studentToken;
    if (token) { try { await api("studentLogout", {}, token); } catch { /* Local logout must still complete. */ } }
    setStudentToken(""); setPin(""); setNickname(""); setNicknameDraft(""); setScores({}); setTrophies({}); go("login");
  };
  const selectIsland = (id: IslandId) => { setSelectedIslandId(id); setOutfitPreviewTier(null); go("island"); };
  const startChallenge = async () => {
    if (!studentToken) { setToast("請重新登入後再開始挑戰。"); go("login"); return; }
    setBusy(true);
    try {
      const data = await api<{ questions: Question[]; versionId: string }>("getQuestions", { island: selectedIsland.id }, studentToken);
      setChallengeQuestions(data.questions); setQuestionVersionId(data.versionId); setQuestionIndex(0); setSelectedOption(null); setUsedHint(false); setHintOpen(false); setAnswers([]); go("quiz");
    } catch (error) { setToast(error instanceof Error ? error.message : "題庫讀取失敗"); }
    finally { setBusy(false); }
  };
  const submitConfidence = (confidence: Confidence) => {
    if (selectedOption === null) { setToast("請先選擇一個答案"); return; }
    const correct = selectedOption === question.answer; setAnswers((current) => [...current, { question, selected: selectedOption, confidence, usedHint, correct }]); go("feedback", correct ? "correct" : "wrong");
  };
  const nextQuestion = async () => {
    if (questionIndex + 1 < challengeQuestions.length) { setQuestionIndex((current) => current + 1); setSelectedOption(null); setUsedHint(false); setHintOpen(false); go("quiz"); return; }
    setBusy(true);
    try {
      const result = await api<{ score: number; trophy: boolean }>("completeAttempt", { island: selectedIsland.id, versionId: questionVersionId, answers: answers.map((answer) => ({ questionId: answer.question.id, selected: answer.selected, confidence: answer.confidence, usedHint: answer.usedHint })) }, studentToken);
      setScores((current) => ({ ...current, [selectedIsland.id]: Math.max(current[selectedIsland.id] ?? 0, result.score) }));
      if (result.trophy) setTrophies((current) => ({ ...current, [selectedIsland.id]: true }));
      go("result", "reward");
    } catch (error) { setToast(error instanceof Error ? error.message : "成績儲存失敗"); }
    finally { setBusy(false); }
  };
  const currentScore = challengeQuestions.length ? Math.round((answers.filter((answer) => answer.correct).length / challengeQuestions.length) * 20) * 10 : 0;
  const loadTeacherData = async (token = teacherToken) => {
    if (!token) return;
    try { setTeacherData(await api<TeacherData>("teacherOverview", {}, token)); }
    catch (error) { setToast(error instanceof Error ? error.message : "後台資料讀取失敗"); }
  };
  const teacherLogin = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { const data = await api<{ token: string; username: string }>("teacherLogin", { username: teacherUsername, password: teacherPassword }); setTeacherToken(data.token); setTeacherUsername(data.username); setNewTeacherUsername(data.username); setTeacherPassword(""); setTeacherTab("security"); await loadTeacherData(data.token); go("teacher"); }
    catch (error) { setToast(error instanceof Error ? error.message : "教師登入失敗"); }
    finally { setBusy(false); }
  };
  const changeTeacherCredentials = async (event: FormEvent) => {
    event.preventDefault();
    if (newTeacherPassword !== confirmTeacherPassword) { setToast("兩次輸入的新密碼不一致。"); return; }
    setBusy(true);
    try {
      await api("changeTeacherCredentials", { currentPassword: currentTeacherPassword, newUsername: newTeacherUsername, newPassword: newTeacherPassword }, teacherToken);
      setTeacherToken(""); setTeacherUsername(newTeacherUsername); setTeacherPassword(""); setCurrentTeacherPassword(""); setNewTeacherPassword(""); setConfirmTeacherPassword(""); setTeacherTab("overview");
      setToast("帳號與密碼已更新，請使用新資料重新登入。"); go("teacher-login", "reward");
    } catch (error) { setToast(error instanceof Error ? error.message : "帳號資料更新失敗"); }
    finally { setBusy(false); }
  };
  const createClass = async () => {
    const code = window.prompt("請輸入班級代碼（例如 114A01）"); if (!code) return;
    const name = window.prompt("請輸入班級名稱（例如 114 機械一甲）"); if (!name) return;
    try { await api("createClass", { code, name }, teacherToken); setToast("班級已建立"); await loadTeacherData(); }
    catch (error) { setToast(error instanceof Error ? error.message : "班級建立失敗"); }
  };
  const setClassActive = async (code: string, active: boolean) => {
    setBusy(true);
    try { await api("setClassActive", { code, active }, teacherToken); setToast(active ? "班級已啟用" : "班級已停用，學生暫時無法登入"); await loadTeacherData(); }
    catch (error) { setToast(error instanceof Error ? error.message : "班級狀態更新失敗"); }
    finally { setBusy(false); }
  };
  const deleteClass = async (code: string, name: string) => {
    const confirmed = window.confirm(`確定永久刪除「${name}」（${code}）嗎？\n\n班級內的學生帳號、作答紀錄、成就與排行榜資料也會一併刪除，且無法復原。建議先從「作答總覽」匯出 Excel 備份。`);
    if (!confirmed) return;
    setBusy(true);
    try { await api("deleteClass", { code, confirmCode: code }, teacherToken); setToast("班級及其相關資料已刪除"); await loadTeacherData(); }
    catch (error) { setToast(error instanceof Error ? error.message : "班級刪除失敗"); }
    finally { setBusy(false); }
  };
  const spreadsheetRows = async (file: File) => {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  };
  const importStudentFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const code = window.prompt("這份名單要匯入哪一個班級代碼？"); if (!code) return;
    setBusy(true); try { const rows = await spreadsheetRows(file); const result = await api<{ count: number }>("importStudents", { classCode: code, rows }, teacherToken); setToast(`已匯入 ${result.count} 位學生`); await loadTeacherData(); }
    catch (error) { setToast(error instanceof Error ? error.message : "學生名單匯入失敗"); } finally { setBusy(false); }
  };
  const importQuestionFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setBusy(true); try { const rows = await spreadsheetRows(file); const result = await api<{ versionNumber: number; count: number }>("importQuestions", { rows }, teacherToken); setToast(`題庫 v${result.versionNumber} 已發布，共 ${result.count} 題`); await loadTeacherData(); }
    catch (error) { setToast(error instanceof Error ? error.message : "題庫匯入失敗"); } finally { setBusy(false); }
  };
  const exportAnswerWorkbook = async () => {
    setBusy(true);
    try {
      const report = await api<TeacherReport>("teacherReport", {}, teacherToken);
      const summarySheet = XLSX.utils.json_to_sheet(report.summaries.map((row) => ({
        班級: row.className,
        座號: row.seat,
        暱稱: row.nickname,
        島嶼: row.islandName,
        日期: new Date(row.completedAt),
        挑戰次數: row.challengeNumber,
        總分: row.score,
        徽章: row.badge,
        知己獎盃: row.trophy ? "已獲得" : "未獲得",
        提示使用次數: row.hintCount,
      })), { cellDates: true });
      const detailSheet = XLSX.utils.json_to_sheet(report.details.map((row) => ({
        挑戰編號: row.challengeId,
        題目ID: row.questionId,
        玩家答案: row.selectedAnswer,
        正確答案: row.correctAnswer,
        正誤: row.correct ? "正確" : "錯誤",
        自評: row.confidence,
        是否使用提示: row.usedHint ? "是" : "否",
      })));
      const statisticSheet = XLSX.utils.json_to_sheet(report.questionStats.map((row) => ({
        題目ID: row.questionId,
        島嶼: row.islandName,
        題幹: row.stem,
        首次作答人數: row.firstCount,
        正確率: row.accuracy,
        很確定人數: row.sureCount,
        有印象人數: row.familiarCount,
        我猜的人數: row.guessCount,
        陌生度: row.unfamiliarity,
        高自信錯誤率: row.confidentWrongRate,
      })));
      summarySheet["!cols"] = [{ wch: 18 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 16 }];
      detailSheet["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 16 }];
      statisticSheet["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 54 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 }];
      if (summarySheet["!ref"]) summarySheet["!autofilter"] = { ref: summarySheet["!ref"] };
      if (detailSheet["!ref"]) detailSheet["!autofilter"] = { ref: detailSheet["!ref"] };
      if (statisticSheet["!ref"]) statisticSheet["!autofilter"] = { ref: statisticSheet["!ref"] };
      for (let row = 2; row <= report.summaries.length + 1; row += 1) if (summarySheet[`E${row}`]) summarySheet[`E${row}`].z = "yyyy-mm-dd hh:mm";
      for (let row = 2; row <= report.questionStats.length + 1; row += 1) {
        if (statisticSheet[`E${row}`]) statisticSheet[`E${row}`].z = "0.0%";
        if (statisticSheet[`I${row}`]) statisticSheet[`I${row}`].z = "0.0%";
        if (statisticSheet[`J${row}`]) statisticSheet[`J${row}`].z = "0.0%";
      }
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, summarySheet, "學生作答摘要");
      XLSX.utils.book_append_sheet(workbook, detailSheet, "逐題作答明細");
      XLSX.utils.book_append_sheet(workbook, statisticSheet, "題目統計");
      XLSX.writeFile(workbook, `經典文學闖關島_作答紀錄_${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
      setToast(`已匯出 ${report.summaries.length} 次挑戰與 ${report.details.length} 筆逐題紀錄`);
    } catch (error) { setToast(error instanceof Error ? error.message : "作答紀錄匯出失敗"); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (screen !== "achievements" || !studentToken) return;
    void api<{ players: LeaderboardPlayer[] }>("leaderboard", { island: leaderboardIslandId }, studentToken).then((data) => setLiveLeaderboard(data.players)).catch(() => setLiveLeaderboard([]));
    // The selected island intentionally controls this single leaderboard request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, leaderboardIslandId, studentToken]);
  const completedCount = Object.values(scores).filter((score) => typeof score === "number").length;
  const totalBest = Object.values(scores).reduce<number>((sum, score) => sum + (score ?? 0), 0);
  const trophyCount = Object.values(trophies).filter(Boolean).length;

  const AppHeader = ({ backTo }: { backTo?: Screen }) => <header className="app-header">{backTo ? <button className="icon-button" aria-label="返回上一頁" onClick={() => go(backTo)}>←</button> : <span className="seal" aria-hidden="true">文</span>}<button className="brand-button" onClick={() => go("map")}><strong>經典文學闖關島</strong><span>高中統測篇</span></button><button className="icon-button" aria-label="開啟設定" onClick={openSettings}>⚙</button></header>;
  const OutfitArt = ({ island, score, className = "", tier: previewTier }: { island: Island; score: number; className?: string; tier?: number }) => { const tier = previewTier ?? unlockedCount(score); return <div className={`outfit-art ${className}`} role="img" aria-label={`${island.guardian}第 ${tier} 階穿搭，共包含 ${tier} 件配件`} style={{ backgroundImage: `url(${outfitSheets[island.id]})`, backgroundPosition: outfitPositions[tier - 1] }} />; };
  const GuardianPortrait = ({ island, compact = false, score }: { island: Island; compact?: boolean; score?: number }) => <div className={`guardian-frame ${island.className} ${compact ? "compact" : ""} ${typeof score === "number" ? "with-outfit" : ""}`}>{typeof score === "number" ? <OutfitArt island={island} score={score} /> : <img src={island.image} alt={`${island.name}守護生物${island.guardian}，${island.species}`} />}<span className="guardian-name"><b>{island.guardian}</b> · {island.species}</span></div>;

  return <main className={`site-root ${reduceMotion ? "reduce-motion" : ""}`}><div className="paper-noise" aria-hidden="true" />{toast && <div className="toast" role="status">{toast}</div>}
    {screen === "login" && <section className="auth-page page-enter"><div className="auth-art" aria-hidden="true"><img className="login-map-art" src="/islands/five-islands-map.jpg" alt="" /><div className="auth-mist" /><div className="login-title-block"><span>與守護生物一起啟程</span><h2>經典文學<br />闖關島</h2><p>高中統測篇</p></div><div className="login-guardians">{islands.map((island) => <span key={island.id} className={island.className}><img src={island.image} alt="" /><b>{island.guardian}</b></span>)}</div></div><form className="auth-card" onSubmit={login}><div className="eyebrow">學生登入</div><h1>準備好登島了嗎？</h1><p className="muted">輸入老師提供的資料，探索五座文學島嶼。</p><label>班級代碼<input value={classCode} onChange={(e) => setClassCode(e.target.value.toUpperCase())} autoComplete="organization" /></label><label>座號<input value={seat} onChange={(e) => setSeat(e.target.value)} inputMode="numeric" autoComplete="username" /></label><label>個人 PIN 碼<input value={pin} onChange={(e) => setPin(e.target.value)} type="password" inputMode="numeric" autoComplete="current-password" /></label><button className="primary-button" type="submit" disabled={busy}>{busy ? "登入中…" : <>進入闖關島 <span>→</span></>}</button><p className="form-help">班級代碼、座號與 PIN 由任課教師提供。</p><button className="text-button" type="button" onClick={() => go("teacher-login")}>教師管理端</button></form></section>}

    {screen === "story" && <section className="story-page page-enter" aria-live="polite"><img className="story-map" src="/islands/five-islands-map.jpg" alt="水墨風格的五座海上文學島嶼" /><div className="story-veil" aria-hidden="true" /><div className="story-stars" aria-hidden="true">✦　·　✦　·　✦</div><div className="story-voyage" aria-hidden="true"><span /><i /></div><article className="story-panel" key={storyStep}><span className="story-chapter">{storyScenes[storyStep].eyebrow}</span><div className="story-mark" aria-hidden="true">{storyScenes[storyStep].mark}</div><h1>{storyScenes[storyStep].title}</h1><p>{storyScenes[storyStep].copy}</p><div className="story-reading-hint"><span aria-hidden="true">☝</span>閱讀完畢後，點選「下一幕」繼續故事</div><div className="story-controls"><div className="story-progress" aria-label={`故事進度 ${storyStep + 1} / ${storyScenes.length}`}>{storyScenes.map((scene, index) => <button key={scene.eyebrow} className={index === storyStep ? "active" : ""} aria-label={`前往第 ${index + 1} 幕`} onClick={() => { playSound("select"); setStoryStep(index); }} />)}</div><button className="story-sound" type="button" aria-label={soundOn ? "關閉故事配樂" : "開啟故事配樂"} onClick={enableSound}>{soundOn ? "♫ 配樂播放中" : "♩ 開啟配樂"}</button><button className="story-next" type="button" onClick={() => { if (storyStep < storyScenes.length - 1) { playSound("transition"); setStoryStep((step) => step + 1); } else go("nickname"); }}>{storyStep < storyScenes.length - 1 ? <>下一幕 <span>→</span></> : <>為旅程命名 <span>→</span></>}</button></div></article></section>}

    {screen === "nickname" && <section className="center-page nickname-page page-enter"><img className="nickname-backdrop" src="/islands/five-islands-map.jpg" alt="五座文學島嶼與相連航線" /><div className="nickname-veil" aria-hidden="true" /><div className="nickname-card panel"><span className="step-pill">序章完成 · 最後一步</span><span className="nickname-compass" aria-hidden="true">✦</span><h1>旅人，你想叫什麼名字？</h1><p className="muted">把名字寫進航海圖，準備探索五座文學島嶼。暱稱之後仍可修改。</p><label className="nickname-input">我的暱稱<input value={nickname} maxLength={10} onChange={(e) => setNickname(e.target.value)} /></label><small>{nickname.length} / 10</small><button className="primary-button" disabled={!nickname.trim() || busy} onClick={saveNickname}>{busy ? "儲存中…" : "踏上旅程"}</button></div></section>}

    {screen === "map" && <section className="app-page map-page page-enter"><AppHeader /><div className="welcome-row"><div><div className="eyebrow">旅人檔案 · {classCode}-{seat.padStart(2, "0")}</div><h1>{nickname}，今天想去哪座島？</h1><p>沿著發光航線點選一座島，登島後才會遇見守護生物與任務說明。</p></div><button className="profile-chip" onClick={() => go("achievements")}><span>🏅</span><b>{totalBest}</b> 分</button></div><div className="map-summary"><span><b>{completedCount}</b> / 5 已探索</span><div className="summary-track"><span style={{ width: `${completedCount * 20}%` }} /></div><span>正式題庫 · 每島 20 題</span></div><div className="adventure-map" aria-label="五座海上冒險島嶼地圖"><img src="/islands/five-islands-map.jpg" alt="五座以墨線航路互相連結的水墨冒險島嶼" />{islands.map((island, index) => { const score = scores[island.id]; return <button key={island.id} className={`island-hotspot hotspot-${island.id} ${island.className}`} onClick={() => selectIsland(island.id)} aria-label={`前往${island.name}，${island.subtitle}`}><span className="hotspot-index">0{index + 1}</span><span className="hotspot-copy"><small>{island.subtitle}</small><strong>{island.name}</strong></span>{typeof score === "number" ? <span className="hotspot-score">最高 {score}</span> : <span className="hotspot-new">未探索</span>}</button>; })}<div className="map-legend"><span>✦</span> 點選島嶼開始冒險</div></div><nav className="bottom-nav" aria-label="主要功能"><button className="active" onClick={() => go("map")}><span>🗺️</span>五島地圖</button><button onClick={() => go("achievements")}><span>🏆</span>我的成就</button><button onClick={openSettings}><span>⚙️</span>設定</button></nav></section>}

    {screen === "island" && <section className={`app-page island-detail ${selectedIsland.className} page-enter`}><AppHeader backTo="map" /><div className="island-hero"><div className="island-hero-copy"><div className="eyebrow">已抵達 · {selectedIsland.subtitle}</div><h1>{selectedIsland.name}</h1><p className="guardian-quote">「{selectedIsland.quote}」</p><div className="guardian-personality"><span>{selectedIsland.guardian}</span>{selectedIsland.species} · {selectedIsland.personality}</div></div><GuardianPortrait island={selectedIsland} score={scores[selectedIsland.id] ?? 0} /></div><div className="island-info-grid"><div className="panel mission-card"><div><span className="info-icon">✦</span><p><b>本次任務</b><br />完成 20 題正式題庫</p></div><div><span className="info-icon">＋</span><p><b>計分方式</b><br />每題 10 分，滿分 200 分</p></div><div><span className="info-icon">?</span><p><b>遊玩方式</b><br />選答案、標記熟悉度，完成後查看解析</p></div></div><div className="panel reward-preview"><div className="panel-heading"><div><span className="eyebrow">守護生物造型之路</span><h2>最高 {scores[selectedIsland.id] ?? 0} 分</h2></div><span className="badge-pill">{badgeFor(scores[selectedIsland.id] ?? 0)}</span></div><p>每次提高最高分，{selectedIsland.guardian} 都會把新配件穿上；五階配件會依序累積。點選任一造型即可預覽，尚未解鎖也能先試穿。</p><ol className="outfit-roadmap">{selectedIsland.accessories.map((item, index) => { const unlocked = index < unlockedCount(scores[selectedIsland.id] ?? 0); return <li key={item} className={unlocked ? "unlocked" : ""}><button className="outfit-preview-button" onClick={() => { setOutfitPreviewTier(index + 1); playSound("select"); }} aria-label={`預覽${selectedIsland.guardian}第 ${index + 1} 階造型：${item}`}><span>{index + 1}</span><div><small>{accessoryMilestones[index]}</small><b>{item}</b></div><em>{unlocked ? "已穿上" : "待解鎖"}</em><i>點選預覽 ↗</i></button></li>; })}</ol></div></div><button className="primary-button wide-action" disabled={busy} onClick={startChallenge}>{busy ? "載入題庫中…" : <>開始正式挑戰 <span>→</span></>}</button></section>}

    {screen === "island" && outfitPreviewTier !== null && <div className="outfit-preview-layer" role="presentation"><button className="outfit-preview-backdrop" aria-label="關閉造型預覽" onClick={() => setOutfitPreviewTier(null)} /><section className={`outfit-preview-modal ${selectedIsland.className}`} role="dialog" aria-modal="true" aria-labelledby="outfit-preview-title"><button className="outfit-preview-close" aria-label="關閉造型預覽" onClick={() => setOutfitPreviewTier(null)}>×</button><div className="outfit-preview-visual"><span className="preview-sparkles" aria-hidden="true">✦　·　✦</span><OutfitArt island={selectedIsland} score={0} tier={outfitPreviewTier} className="outfit-preview-art" /><span className="preview-guardian-name">{selectedIsland.guardian} · {selectedIsland.species}</span></div><div className="outfit-preview-copy"><span className="eyebrow">造型預覽 · 第 {outfitPreviewTier} 階</span><h2 id="outfit-preview-title">{selectedIsland.accessories[outfitPreviewTier - 1]}</h2><p>{accessoryMilestones[outfitPreviewTier - 1]}，配件會依序累積穿戴，呈現守護生物此階段的完整模樣。</p>{outfitPreviewTier <= unlockedCount(scores[selectedIsland.id] ?? 0) ? <span className="preview-status collected">✓ 已收藏並穿上</span> : <span className="preview-status pending">◇ 尚未收藏，也可以先預覽</span>}<div className="outfit-preview-nav"><button className="secondary-button" disabled={outfitPreviewTier === 1} onClick={() => setOutfitPreviewTier((tier) => Math.max(1, (tier ?? 1) - 1))}>← 上一階</button><span>{outfitPreviewTier} / 5</span><button className="primary-button" disabled={outfitPreviewTier === 5} onClick={() => setOutfitPreviewTier((tier) => Math.min(5, (tier ?? 1) + 1))}>下一階 →</button></div></div></section></div>}

    {screen === "quiz" && <section className={`app-page quiz-page ${selectedIsland.className} page-enter`}><header className="quiz-header"><button className="icon-button" aria-label="離開挑戰" onClick={() => go("island")}>×</button><div><strong>{selectedIsland.name}</strong><span>{nickname} · 目前 {answers.filter((a) => a.correct).length * 10} 分</span></div><span className="question-count">{questionIndex + 1} / {challengeQuestions.length}</span></header><div className="progress-track" aria-label={`作答進度 ${questionIndex + 1} / ${challengeQuestions.length}`}><span style={{ width: `${((questionIndex + 1) / challengeQuestions.length) * 100}%` }} /></div><div className="quiz-layout"><aside className="guardian-aside"><GuardianPortrait island={selectedIsland} compact /><button className="hint-button" disabled={usedHint} onClick={() => { setUsedHint(true); setHintOpen(true); playSound("select"); }}><span>💡</span>{usedHint ? "提示已使用" : "給我提示"}</button>{hintOpen && <div className="hint-bubble rich-question-text" role="status"><RichText>{question.hint}</RichText></div>}</aside><article className="question-card panel"><div className="question-meta"><span>{question.id}</span><span>四選一 · 單選題</span></div>{question.passage && <blockquote className="rich-question-text"><RichText>{question.passage}</RichText></blockquote>}<h1 className="rich-question-text"><RichText>{question.stem}</RichText></h1><div className="option-list" role="radiogroup" aria-label="答案選項">{question.options.map((option, index) => <button key={`${index}-${option}`} className={selectedOption === index ? "selected" : ""} role="radio" aria-checked={selectedOption === index} onClick={() => { setSelectedOption(index); playSound("select"); }}><span className="option-letter">{String.fromCharCode(65 + index)}</span><span className="rich-question-text"><RichText>{option}</RichText></span></button>)}</div><div className="confidence-box"><strong>選好答案後，你有多確定？</strong><small>點選熟悉度即送出答案，送出後不能修改。</small><div className="confidence-row">{(Object.keys(confidenceMeta) as Confidence[]).map((key) => <button key={key} disabled={selectedOption === null} onClick={() => submitConfidence(key)}><span>{confidenceMeta[key].emoji}</span>{confidenceMeta[key].label}</button>)}</div></div></article></div></section>}

    {screen === "feedback" && answers.length > 0 && <section className={`center-page feedback-page ${selectedIsland.className} page-enter`}><div className={`feedback-card panel ${answers.at(-1)?.correct ? "is-correct" : "is-wrong"}`}><span className="result-symbol" aria-hidden="true">{answers.at(-1)?.correct ? "✓" : "!"}</span><div className="eyebrow">第 {questionIndex + 1} 題作答結果</div><h1>{answers.at(-1)?.correct ? "答對了，眼力不錯！" : "再看一次，就抓到線索了"}</h1><p className="answer-line rich-question-text"><b>正確答案 {String.fromCharCode(65 + question.answer)}</b>　<RichText>{question.options[question.answer]}</RichText></p><div className="guardian-feedback"><img src={selectedIsland.image} alt="" /><p>「{answers.at(-1)?.correct ? "這個線索你抓得很準，繼續保持！" : "先記下正確選項，完成關卡後再一起查看詳細解析。"}」<b>— {selectedIsland.guardian}</b></p></div><button className="primary-button" disabled={busy} onClick={nextQuestion}>{busy ? "儲存成績中…" : questionIndex + 1 < challengeQuestions.length ? "下一題" : "查看結算"} {!busy && <span>→</span>}</button></div></section>}

    {screen === "result" && <section className={`app-page result-page ${selectedIsland.className} page-enter`}><AppHeader /><div className="result-hero panel"><div className="confetti" aria-hidden="true">✦　·　✦</div><div className="result-outfit"><GuardianPortrait island={selectedIsland} score={currentScore} /><span>目前穿搭 · 五階中的第 {unlockedCount(currentScore)} 階</span></div><div className="result-copy"><span className="eyebrow">挑戰完成 · 新造型已穿上</span><h1>{badgeFor(currentScore)}</h1><p>你完成了 {selectedIsland.name} 的正式挑戰，{selectedIsland.guardian} 已換上目前累積的配件！</p><div className="score-ring"><b>{currentScore}</b><span>／200 分</span></div><div className="result-stats"><span><b>{answers.filter((a) => a.correct).length}</b> 答對</span><span><b>{answers.filter((a) => a.usedHint).length}</b> 次提示</span><span><b>{answers.filter((a) => a.confidence === "sure").length}</b> 題很確定</span></div></div></div><div className="reward-grid"><div className="panel"><span className="reward-icon">🏅</span><div><small>島嶼探索稱號</small><h2>{badgeFor(currentScore)}</h2><p>最高分會保留在地圖與排行榜。</p></div></div><div className="panel reward-unlocked"><span className="reward-icon">✨</span><div><small>目前穿搭的新配件</small><h2>{selectedIsland.accessories[unlockedCount(currentScore) - 1]}</h2><p>累積解鎖：{selectedIsland.accessories.slice(0, unlockedCount(currentScore)).join("、")}</p></div></div><div className="panel locked-reward"><span className="reward-icon">🏆</span><div><small>知己獎盃</small><h2>{trophies[selectedIsland.id] ? "已獲得知己獎盃" : "繼續挑戰"}</h2><p>完成 20 題且「很確定」至少 10 題、正確率達 90%。</p></div></div></div><div className="action-row"><button className="secondary-button" onClick={() => go("analysis")}>查看全題解析</button><button className="primary-button" onClick={() => go("map")}>回到五島地圖</button></div></section>}

    {screen === "analysis" && <section className="app-page page-enter"><AppHeader backTo="result" /><div className="page-title-row"><div><span className="eyebrow">完整作答紀錄</span><h1>{selectedIsland.name}｜全題解析</h1></div><span className="badge-pill">答錯題優先</span></div><div className="analysis-list">{[...answers].sort((a, b) => Number(a.correct) - Number(b.correct)).map((record, index) => <article className={`panel analysis-card ${record.correct ? "correct" : "wrong"}`} key={record.question.id}><header><span>{record.correct ? "✓ 答對" : "! 答錯"}</span><small>{record.question.id} · {confidenceMeta[record.confidence].emoji} {confidenceMeta[record.confidence].label}{record.usedHint ? " · 使用提示" : " · 未使用提示"}</small></header><h2 className="rich-question-text">{index + 1}. <RichText>{record.question.stem}</RichText></h2><p className="rich-question-text">你的答案：<b>{String.fromCharCode(65 + record.selected)}. <RichText>{record.question.options[record.selected]}</RichText></b></p>{!record.correct && <p className="rich-question-text">正確答案：<b>{String.fromCharCode(65 + record.question.answer)}. <RichText>{record.question.options[record.question.answer]}</RichText></b></p>}<div className="explanation-box rich-question-text"><b>解析</b><p><RichText>{record.question.explanation}</RichText></p></div></article>)}</div></section>}

    {screen === "achievements" && <section className="app-page achievement-page page-enter"><div className="achievement-atmosphere" aria-hidden="true"><span>✦</span><span>·</span><span>✦</span><span>·</span><span>✦</span></div><AppHeader backTo="map" /><div className="achievement-hero"><div><span className="eyebrow">旅人收藏冊</span><h1>{nickname} 的五島成就</h1><p>最高總分 {totalBest}／1000 · 已遇見 {completedCount} 位守護生物 · 知己獎盃 {trophyCount}／5</p><div className="achievement-summary"><span><b>{totalBest}</b><small>最高總分</small></span><span><b>{completedCount} / 5</b><small>守護生物</small></span><span><b>{trophyCount} / 5</b><small>知己獎盃</small></span></div></div><span className="achievement-seal" aria-hidden="true">藏</span></div><div className="achievement-grid">{islands.map((island, index) => { const score = scores[island.id] ?? 0; const hasTrophy = Boolean(trophies[island.id]); return <article className={`panel achievement-card ${island.className}`} key={island.id}><span className="achievement-index" aria-hidden="true">0{index + 1}</span><OutfitArt island={island} score={score} className="achievement-outfit" /><div className="achievement-card-copy"><small>{island.name}</small><h2>{island.guardian}</h2><span className="badge-pill">{badgeFor(score)}</span><p>最高 <b>{score}</b> 分 · {unlockedCount(score)} 件配件</p>{hasTrophy ? <span className="island-trophy" aria-label={`${island.name}已獲得知己獎盃`}>🏆 知己獎盃</span> : <span className="trophy-pending">尚未獲得知己獎盃</span>}</div><button className="secondary-button" onClick={() => selectIsland(island.id)}>前往島嶼 <span>→</span></button></article>; })}</div><section className={`panel leaderboard ${leaderboardIsland.className}`}><div className="leaderboard-heading"><div><span className="eyebrow">五島最高分</span><h2>{leaderboardIsland.name}排行榜</h2><p>依最高成績排序；榜單以班級與遊戲暱稱顯示。</p></div><span className="leaderboard-count">顯示前 20 名</span></div><div className="leaderboard-tabs" role="tablist" aria-label="切換島嶼排行榜">{islands.map((island, index) => <button key={island.id} role="tab" aria-selected={leaderboardIslandId === island.id} className={`${island.className} ${leaderboardIslandId === island.id ? "active" : ""}`} onClick={() => { setLeaderboardIslandId(island.id); playSound("select"); }}><span>0{index + 1}</span><b>{island.name}</b></button>)}</div><div className="leader-list" role="tabpanel" aria-label={`${leaderboardIsland.name}排行榜`}>{liveLeaderboard.length ? liveLeaderboard.map((player) => <div className="leader-row" key={`${player.className}-${player.nickname}`}><span className="rank">{player.rank}</span><div className="leader-identity"><small>{player.className}</small><b>{player.nickname}</b></div>{player.hint ? <small className="leader-honor">✦ 無提示完成</small> : <span className="leader-honor muted-honor">完成挑戰</span>}<strong>{player.score}<small>分</small></strong></div>) : <div className="empty-state">這座島還沒有完成挑戰的旅人，等你成為第一名！</div>}</div></section></section>}

    {screen === "settings" && <section className="center-page page-enter"><div className="settings-card panel"><button className="icon-button close-button" aria-label="關閉設定" onClick={() => go("map")}>×</button><span className="eyebrow">遊戲設定</span><h1>依你的方式探索</h1><div className="nickname-setting"><div><span className="nickname-setting-icon" aria-hidden="true">旅</span><span><b>旅人暱稱</b><small>修改後會同步顯示於地圖與排行榜，原有分數、配件及作答紀錄不受影響。</small></span></div><label htmlFor="settings-nickname">我的暱稱</label><div className="nickname-setting-input"><input id="settings-nickname" value={nicknameDraft} maxLength={10} onChange={(event) => setNicknameDraft(event.target.value)} autoComplete="nickname" /><small>{nicknameDraft.length} / 10</small></div></div><div className="setting-row"><span><b>魔幻輕音樂與遊戲音效</b><small>無歌詞背景旋律，並包含轉場、選答案、公布正解與結算提示音；預設關閉。</small></span><button role="switch" aria-label="切換背景音樂與遊戲音效" aria-checked={soundOn} className={`switch ${soundOn ? "on" : ""}`} onClick={enableSound}><span /></button></div><div className="sound-cues" aria-label="已包含的音效種類"><span>♫ 背景音樂</span><span>↝ 轉場</span><span>✦ 作答</span><span>✓ 公布答案</span><span>★ 結算</span></div><div className="setting-row"><span><b>減少動畫</b><small>關閉大部分轉場與守護生物漂浮動畫。</small></span><button role="switch" aria-checked={reduceMotion} className={`switch ${reduceMotion ? "on" : ""}`} onClick={() => setReduceMotion((v) => !v)}><span /></button></div><div className="setting-row"><span><b>帳號使用保護</b><small>同一帳號同時只能在一台裝置登入；改用新裝置登入時，舊裝置會自動登出。</small></span><span className="status-ok">✓</span></div><div className="setting-row"><span><b>文字與操作</b><small>大字體、44px 以上按鈕、鍵盤焦點與圖片替代文字已啟用。</small></span><span className="status-ok">✓</span></div><button className="primary-button" disabled={busy || nicknameDraft.trim().length < 2} onClick={() => void saveSettings()}>{busy ? "儲存中…" : "儲存設定並返回地圖"}</button><button className="text-button danger" onClick={() => void logoutStudent()}>登出學生帳號</button></div></section>}

    {screen === "teacher-login" && <section className="teacher-login page-enter"><div className="teacher-brand"><span className="seal">師</span><div><b>經典文學闖關島</b><span>教師管理端 · 正式環境</span></div></div><form className="auth-card" onSubmit={teacherLogin}><span className="eyebrow">教師登入</span><h1>歡迎回來，老師</h1><p className="muted">使用管理帳號維護班級、學生與正式題庫。</p><label>管理員帳號<input value={teacherUsername} onChange={(event) => setTeacherUsername(event.target.value)} autoComplete="username" /></label><label>密碼<input value={teacherPassword} onChange={(event) => setTeacherPassword(event.target.value)} type="password" autoComplete="current-password" /></label><button className="primary-button" type="submit" disabled={busy}>{busy ? "登入中…" : "進入管理端"}</button><button className="text-button" type="button" onClick={() => go("login")}>返回學生登入</button></form></section>}

    {screen === "teacher" && <section className="teacher-shell page-enter"><aside className="teacher-sidebar"><div className="teacher-brand"><span className="seal">師</span><div><b>闖關島管理端</b><span>正式教學環境</span></div></div><nav><button className={teacherTab === "overview" ? "active" : ""} onClick={() => setTeacherTab("overview")}><span>▦</span>作答總覽</button><button className={teacherTab === "students" ? "active" : ""} onClick={() => setTeacherTab("students")}><span>♙</span>班級與學生</button><button className={teacherTab === "questions" ? "active" : ""} onClick={() => setTeacherTab("questions")}><span>?</span>題目統計</button><button className={teacherTab === "import" ? "active" : ""} onClick={() => setTeacherTab("import")}><span>⇧</span>題庫匯入</button><button className={teacherTab === "security" ? "active" : ""} onClick={() => { setNewTeacherUsername(teacherUsername); setTeacherTab("security"); }}><span>⚿</span>帳號安全</button></nav><button className="sidebar-exit" onClick={() => { setTeacherToken(""); go("login"); }}>← 登出管理端</button></aside><div className="teacher-main"><header><div><span className="eyebrow">教師管理端</span><h1>{teacherTab === "overview" ? "學生作答總覽" : teacherTab === "students" ? "班級與學生" : teacherTab === "questions" ? "題目統計" : teacherTab === "import" ? "題庫匯入與版本" : "帳號安全"}</h1></div>{teacherTab !== "security" && <button className="secondary-button" onClick={() => void loadTeacherData()}>重新整理</button>}</header>
      {teacherTab === "overview" && <><div className="teacher-stats">{[{ label: "正式班級", value: teacherData.stats?.classCount ?? 0, note: "啟用中的班級" }, { label: "學生帳號", value: teacherData.stats?.studentCount ?? 0, note: "可獨立登入" }, { label: "完成挑戰", value: teacherData.stats?.attemptCount ?? 0, note: "雲端作答紀錄" }, { label: "平均正確率", value: `${teacherData.stats?.accuracy ?? 0}%`, note: "所有已完成關卡" }].map((stat) => <div className="panel" key={stat.label}><small>{stat.label}</small><b>{stat.value}</b><span>{stat.note}</span></div>)}</div><div className="panel teacher-table-wrap"><div className="panel-heading report-heading"><div><h2>學生作答紀錄</h2><p>每次完成挑戰都會獨立保留；可匯出完整摘要、逐題明細與題目統計。</p></div><button className="primary-button export-button" disabled={busy} onClick={() => void exportAnswerWorkbook()}>{busy ? "整理資料中…" : "匯出 Excel（.xlsx）"}</button></div><table className="attempt-table"><thead><tr><th>班級／學生</th><th>島嶼</th><th>日期</th><th>挑戰次數</th><th>總分／徽章</th><th>知己獎盃</th><th>提示</th></tr></thead><tbody>{teacherData.attempts?.length ? teacherData.attempts.map((row) => <tr key={row.attemptId}><td><b>{row.className} · {row.seat} 號</b><small>{row.nickname}</small></td><td>{row.islandName}</td><td>{new Date(row.completedAt).toLocaleString("zh-TW", { hour12: false })}</td><td>第 {row.challengeNumber} 次</td><td><strong>{row.score}</strong><small>{row.badge}</small></td><td>{row.trophy ? "🏆 已獲得" : "—"}</td><td>{row.hintCount} 次</td></tr>) : <tr><td colSpan={7}>尚無完成紀錄</td></tr>}</tbody></table></div></>}
      {teacherTab === "students" && <><div className="teacher-actions"><button className="primary-button" disabled={busy} onClick={createClass}>＋ 建立班級</button><label className="secondary-button file-button">匯入學生名單<input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={importStudentFile} /></label></div>{teacherData.classes?.map((row) => { const code = String(row.code ?? ""); const name = String(row.name ?? ""); const active = Number(row.active ?? 0) === 1; return <div className={`panel class-card ${active ? "" : "is-inactive"}`} key={code}><div><span className="eyebrow">班級代碼 {code}</span><h2>{name}</h2><p>{String(row.studentCount ?? 0)} 位學生 · {active ? "學生可登入" : "學生暫時無法登入"}</p></div><div className="class-card-actions"><button className={`class-status-button ${active ? "active" : "inactive"}`} disabled={busy} onClick={() => void setClassActive(code, !active)}>{active ? "啟用中 · 點選停用" : "已停用 · 點選啟用"}</button><button className="class-delete-button" disabled={busy} onClick={() => void deleteClass(code, name)}>刪除班級</button></div></div>; })}<div className="panel teacher-table-wrap"><table><thead><tr><th>班級</th><th>座號</th><th>姓名／暱稱</th><th>登入狀態</th></tr></thead><tbody>{teacherData.students?.length ? teacherData.students.map((row, index) => <tr key={index}><td>{String(row.className ?? "")}</td><td>{String(row.seat ?? "")}</td><td><b>{String(row.name ?? "")}</b><small>{String(row.nickname ?? "尚未設定")}</small></td><td>{row.lastLoginAt ? "已登入" : "尚未登入"}</td></tr>) : <tr><td colSpan={4}>請先建立班級並匯入學生名單</td></tr>}</tbody></table></div></>}
      {teacherTab === "questions" && <><div className="question-stat-banner panel"><div><span className="eyebrow">正式題庫 v{teacherData.stats?.versionNumber ?? 0}</span><h2>共 {teacherData.stats?.questionCount ?? 0} 題</h2><p>每個正式版本需讓五座島嶼各啟用 20 題；已發布版本不覆寫。</p></div><span className="badge-pill">{Number(teacherData.stats?.questionCount ?? 0) === 100 ? "已發布" : "等待題庫"}</span></div><div className="panel validation-list"><h2>正式題庫規則</h2><div><span>✓</span>五島各 20 題，共 100 題</div><div><span>✓</span>每題四個選項、唯一正解、解析與提示</div><div><span>✓</span>發布時建立新版本，保留學生歷史紀錄</div></div></>}
      {teacherTab === "import" && <><div className="import-grid"><div className="panel import-drop"><span className="upload-icon">⇧</span><h2>匯入題庫試算表</h2><p>欄位包含題目 ID、島嶼、題幹、選項 A～D、正確選項、解析、提示、出處與篇目標籤。</p><label className="secondary-button file-button">{busy ? "驗證與上傳中…" : "選擇 .xlsx 檔案"}<input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={importQuestionFile} /></label></div><div className="panel version-card"><span className="eyebrow">版本與文字格式</span><h2>安全發布並保留排版</h2><ul><li>修改題目時建立新版本，舊紀錄永久保留</li><li>Excel 儲存格內換行會原樣顯示</li><li><code>**重要文字**</code> 顯示為粗體</li><li><code>__關鍵文字__</code> 顯示為底線</li><li>兩種標記可以互相巢狀使用</li></ul><span className="status-live">題幹、題文、選項、提示與解析皆支援</span></div></div><div className="panel validation-list"><h2>匯入前自動驗證</h2><div><span>✓</span>每座島正式啟用題數必須為 20 題</div><div><span>✓</span>每題必須有四個選項與唯一正解</div><div><span>✓</span>題目 ID 不可重複，提示與解析不可空白</div><div><span>✓</span>儲存格換行、<b>**粗體**</b> 與 <u>__底線__</u> 會保留到遊戲畫面</div></div></>}
      {teacherTab === "security" && <div className="security-layout"><form className="panel security-card" onSubmit={changeTeacherCredentials}><div className="security-heading"><span className="security-lock" aria-hidden="true">⚿</span><div><span className="eyebrow">管理員登入資料</span><h2>修改帳號與密碼</h2><p>請先驗證目前密碼。更新完成後，所有教師端登入階段會登出，並需使用新帳密重新登入。</p></div></div><div className="security-form-grid"><label>新的管理員帳號<input value={newTeacherUsername} onChange={(event) => setNewTeacherUsername(event.target.value)} autoComplete="username" minLength={4} maxLength={50} required /><small>4～50 個字元，不可包含空白。</small></label><label>目前密碼<input value={currentTeacherPassword} onChange={(event) => setCurrentTeacherPassword(event.target.value)} type="password" autoComplete="current-password" required /><small>用來確認是帳號本人進行變更。</small></label><label>新密碼<input value={newTeacherPassword} onChange={(event) => setNewTeacherPassword(event.target.value)} type="password" inputMode="numeric" pattern="[0-9]{6,}" autoComplete="new-password" minLength={6} required /><small>請輸入至少 6 位數字。</small></label><label>再次輸入新密碼<input value={confirmTeacherPassword} onChange={(event) => setConfirmTeacherPassword(event.target.value)} type="password" inputMode="numeric" pattern="[0-9]{6,}" autoComplete="new-password" minLength={6} required /><small className={confirmTeacherPassword && newTeacherPassword !== confirmTeacherPassword ? "password-mismatch" : confirmTeacherPassword ? "password-match" : ""}>{confirmTeacherPassword ? newTeacherPassword === confirmTeacherPassword ? "✓ 兩次輸入一致" : "兩次輸入的新密碼不一致" : "請再輸入一次新密碼。"}</small></label></div><div className="security-submit"><p><b>安全提醒</b>：請勿使用班級代碼、生日或容易猜到的連續數字作為密碼。</p><button className="primary-button" type="submit" disabled={busy || !currentTeacherPassword || !newTeacherUsername || !newTeacherPassword || newTeacherPassword !== confirmTeacherPassword}>{busy ? "正在安全更新…" : "更新帳號與密碼"}</button></div></form><aside className="panel security-note"><span className="eyebrow">帳號保護</span><h2>這次變更會發生什麼？</h2><ol><li><span>1</span><div><b>加密保存</b><p>新密碼只會以不可還原的加密摘要儲存，不會顯示在後台頁面。</p></div></li><li><span>2</span><div><b>立即登出</b><p>更新成功後，其他已開啟的教師管理端也會失效。</p></div></li><li><span>3</span><div><b>重新登入</b><p>請妥善記下新帳密；下次進入教師端時改用新的資料。</p></div></li></ol><div className="security-status"><span>✓</span><div><b>雲端帳密已啟用</b><small>修改後會套用到所有裝置。</small></div></div></aside></div>}
    </div></section>}
  </main>;
}
