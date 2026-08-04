import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { lookupLocalFoods } from "./foodDB.js";

export const TYPES = {
  push:  { label: "PUSH",  sub: "가슴·어깨·삼두", color: "#FF6B3D" },
  pull:  { label: "PULL",  sub: "등·이두",       color: "#35C4D8" },
  legs:  { label: "LEGS",  sub: "하체·복근",     color: "#B6E34B" },
  upper: { label: "상체",  sub: "가슴·등·어깨",   color: "#A97BFF" },
  lower: { label: "하체+팔", sub: "하체·팔 보완", color: "#FF5C8A" },
  custom:{ label: "직접선택", sub: "",            color: "#EDE9E0" },
  rest:  { label: "휴식",  sub: "",              color: "#565963" },
};

export const PARTS = ["가슴", "가슴안쪽", "등", "어깨", "후면어깨", "하체", "둔근", "이두", "삼두", "복근"];
// 부위를 큰 갈래로 묶어 색으로 구분한다. 캘린더에서 "등·삼두" 같은 조합도 색으로 한눈에 보이게.

export const PART_GROUPS = [
  { key:"당기기", parts:["등","후면어깨","이두"],           color:"#35C4D8" },
  { key:"밀기",   parts:["가슴","가슴안쪽","어깨","삼두"], color:"#FF7A45" },
  { key:"하체",   parts:["하체","둔근"],                   color:"#B6E34B" },
  { key:"코어",   parts:["복근"],                          color:"#FFC24B" },
];

export const partBreakdown = (partSets) => {
  const entries = Object.entries(partSets||{}).map(([p,v])=>({ part:p, sets:num(v) })).filter(x=>x.sets>0);
  entries.sort((a,b)=> b.sets-a.sets);
  const total = entries.reduce((s,x)=>s+x.sets,0);
  // 그룹별로 합쳐 색 막대용 데이터 생성
  const groups = PART_GROUPS.map((g)=>({
    key:g.key, color:g.color,
    sets: entries.filter(x=>g.parts.includes(x.part)).reduce((s,x)=>s+x.sets,0),
  })).filter(g=>g.sets>0);
  return { entries, total, groups };
};

export const CARDIO = {
  treadmill: { label: "트레드밀", color: "#FFC24B" },
  stairs:    { label: "천국의 계단", color: "#FF8C42" },
  running:   { label: "런닝머신", color: "#5AD1A0" },
  etc:       { label: "기타", color: "#9AA3AF" },   // 사이클·수영·등산 등
};
// 저장된 기록의 유산소 종류가 위 목록에 없을 수도 있다(예전 데이터·백업 복원 등).
// 그때 CARDIO[없는키].color 를 읽으면 화면 전체가 죽으므로 항상 이 함수로 조회한다.
export const cardioInfo = (k)=> CARDIO[k] || CARDIO.etc;

export const WEEKDAYS = ["일","월","화","수","목","금","토"];

export const VOCAB_TYPES = [
  { k:"word",    label:"단어",  icon:"📝", color:"#5AA9FF" },
  { k:"idiom",   label:"숙어",  icon:"🔗", color:"#C9A6FF" },
  { k:"grammar", label:"문법",  icon:"📐", color:"#5AD1A0" },
];

export const vocabTypeInfo = (k)=> VOCAB_TYPES.find(t=>t.k===k) || VOCAB_TYPES[0];
// 품사 — 토익 Part 5에서 품사 구분이 자주 나오므로 단어마다 표시

export const POS_LIST = [
  { k:"n",    label:"명사",   short:"n.",    color:"#5AA9FF" },
  { k:"v",    label:"동사",   short:"v.",    color:"#FF8C42" },
  { k:"adj",  label:"형용사", short:"adj.",  color:"#5AD1A0" },
  { k:"adv",  label:"부사",   short:"adv.",  color:"#C9A6FF" },
  { k:"prep", label:"전치사", short:"prep.", color:"#FFB74B" },
  { k:"conj", label:"접속사", short:"conj.", color:"#FF8FB0" },
];

export const posInfo = (k)=> POS_LIST.find(p=>p.k===k) || null;
// 한 단어가 여러 품사를 가질 수 있다(예: prompt = 형용사·동사).
// pos는 "adj,v"처럼 쉼표로 이어 저장하고, 읽을 때 이 함수로 풀어 쓴다.
// 기존에 하나만 저장된 데이터도 그대로 동작한다.
export const posList = (pos)=> String(pos||"")
  .split(",").map(x=>x.trim()).filter(Boolean)
  .map(k=>posInfo(k)).filter(Boolean);
export const hasPos = (pos, k)=> String(pos||"").split(",").map(x=>x.trim()).includes(k);
export const togglePos = (pos, k)=> {
  const cur = String(pos||"").split(",").map(x=>x.trim()).filter(Boolean);
  const next = cur.includes(k) ? cur.filter(x=>x!==k) : [...cur, k];
  // POS_LIST 순서대로 정렬해 표시가 늘 일정하게
  return POS_LIST.filter(p=>next.includes(p.k)).map(p=>p.k).join(",");
};
// 여러 표기를 내부 코드로 정규화 (adj / a / 형용사 → adj)

export const MASTER_LEVEL = 4;   // 이 이상이면 외운 것으로 본다

export const isMastered = (v)=> num(v.level) >= MASTER_LEVEL;
// 몇 번 이상 틀리면 "자주 틀림"으로 자동 표시

export const OFTEN_WRONG = 3;

export const isOftenWrong = (v)=> num(v.wrong) >= OFTEN_WRONG;
// ===== 간격 반복 =====
// 숙련도가 오를수록 복습 간격을 늘린다. "오늘 볼 것"만 추려서 끝이 보이게 한다.

export const REVIEW_GAP = [1, 2, 4, 7, 14, 30];   // level 0~5 → 며칠 뒤 다시

export const daysSince = (dateStr) => dateStr
  ? Math.max(0, Math.floor((Date.now() - new Date(dateStr+"T00:00:00").getTime())/86400000))
  : null;
// 이 단어를 오늘 봐야 하나?

export const isDueToday = (v) => {
  if (isMastered(v) && num(v.level) >= 5) {
    const d = daysSince(v.lastReview);
    return d == null || d >= REVIEW_GAP[5];   // 다 외운 것도 한 달에 한 번은 확인
  }
  const d = daysSince(v.lastReview);
  if (d == null) return true;                 // 한 번도 안 본 새 단어
  return d >= REVIEW_GAP[Math.min(5, num(v.level))];
};
// 며칠 뒤에 다시 나오는지 (안내용)

export const dueList = (vocab, limit) => {
  const due = (vocab||[]).filter(isDueToday)
    .sort((a,b)=> reviewScore(b) - reviewScore(a));
  return limit > 0 ? due.slice(0, limit) : due;
};

// 발음 듣기 — 브라우저 내장 음성합성이라 API·비용이 필요 없다.
// 다만 그냥 speak()만 부르면 잘 안 들리는 경우가 많아 세 가지를 보정한다.
//  ① 음성 목록(getVoices)이 비동기로 채워져서, 앱을 켜자마자 부르면 목록이 비어 기본 음성(한국어)으로 읽어버린다
//  ② lang만 지정하면 브라우저가 무시하는 경우가 있어 영어 음성 객체를 직접 골라 넣는다
//  ③ iOS는 speak() 직후 paused 상태로 시작하는 버그가 있어 resume()으로 깨워야 한다
let _voices = [];
const loadVoices = () => { try { const v = window.speechSynthesis.getVoices() || []; if (v.length) _voices = v; } catch(e) { /* 무시 */ } };
if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}


// ================= 강조 표기 =================
// 문법은 "어디가 핵심인지"가 절반이다. 그래서 본문 안에 표시를 남길 수 있게 했다.
//   *텍스트*  → 강조색 + 굵게
//   _텍스트_  → 밑줄
//   !텍스트!  → 주의(빨강)
// 마크다운을 그대로 쓰지 않고 한 글자 기호만 쓴 이유: 폰에서 치기 쉽고,
// 문법 노트에 흔한 +, (), ~, / 와 겹치지 않기 때문이다.
// 실제 입력은 기호를 직접 치는 대신 글자를 선택하고 버튼을 누르면 감싸진다.

const MARK_RE = /(\*[^*\n]+\*|_[^_\n]+_|![^!\n]+!)/g;

// 표시 기호를 걷어낸 순수 텍스트. 퀴즈 보기·검색·읽어주기처럼
// 서식이 의미 없는 곳에서 기호가 그대로 노출되면 안 되므로 반드시 거쳐야 한다.
export function stripMarkup(str) {
  return String(str || "").replace(MARK_RE, (m) => m.slice(1, -1));
}

export function hasMarkup(str) {
  MARK_RE.lastIndex = 0;
  return MARK_RE.test(String(str || ""));
}

// 표기를 실제 스타일로 바꿔 그린다
export function Marked({ text, color }) {
  const t = String(text || "");
  if (!t) return null;
  const acc = color || STUDY_ACCENT;
  const parts = t.split(MARK_RE).filter((x) => x !== "" && x != null);
  return (
    <>
      {parts.map((seg, i) => {
        if (/^\*[^*\n]+\*$/.test(seg))
          return <b key={i} style={{ color:acc, fontWeight:800 }}>{seg.slice(1,-1)}</b>;
        if (/^_[^_\n]+_$/.test(seg))
          return <u key={i} style={{ textDecorationColor:acc, textUnderlineOffset:3,
            textDecorationThickness:2 }}>{seg.slice(1,-1)}</u>;
        if (/^![^!\n]+!$/.test(seg))
          return <b key={i} style={{ color:C.danger, fontWeight:800 }}>{seg.slice(1,-1)}</b>;
        return <span key={i}>{seg}</span>;
      })}
    </>
  );
}

// 선택 영역을 기호로 감싼다. 선택이 없으면 커서 자리에 기호만 넣고 그 사이로 커서를 옮긴다.
export function wrapSelection(el, mark) {
  if (!el) return null;
  const v = el.value || "";
  const a = el.selectionStart ?? v.length;
  const b = el.selectionEnd ?? v.length;
  const picked = v.slice(a, b);
  // 이미 같은 기호로 감싸져 있으면 해제 (토글)
  if (picked.length >= 2 && picked[0] === mark && picked[picked.length-1] === mark) {
    const inner = picked.slice(1, -1);
    return { value: v.slice(0,a) + inner + v.slice(b), start: a, end: a + inner.length };
  }
  const body = picked || "";
  return {
    value: v.slice(0,a) + mark + body + mark + v.slice(b),
    start: a + 1,
    end: a + 1 + body.length,
  };
}


// "2형식 동사(be,become,seem,remain,stay,appear)" 처럼
// 제목 끝 괄호에 목록을 함께 적는 입력 습관을 살려, 제목과 목록을 분리해 보여준다.
// 다만 "허(락)기(대)장(려)" 같은 암기용 표기까지 쪼개면 안 되므로
// "끝에 붙은 괄호 하나 + 안에 구분자로 나뉜 항목 2개 이상"일 때만 분리한다.
export function splitTermList(term) {
  const t = String(term || "").trim();
  const m = t.match(/^([^()]+)\(([^()]+)\)$/);
  if (!m) return { head: t, items: [] };
  const items = m[2].split(/[,/·]/).map(x => x.trim()).filter(Boolean);
  if (items.length < 2) return { head: t, items: [] };
  return { head: m[1].trim(), items };
}


// ================= 순서대로 읽어주기 =================
// 화면을 안 보고 듣기만 하려면 "영어 → 한글 뜻 → 다음 단어"로 이어서 재생돼야 한다.
// speakWord는 한 번에 하나만 읽고 끝을 알려주지 않아서, 끝나는 시점을 받아 다음으로
// 넘기는 재생기를 따로 뒀다.
//
// 언어를 항목마다 지정하는 게 핵심이다. 한글 뜻을 영어 음성으로 읽히면 못 알아들으므로
// 영어는 en-US, 뜻은 ko-KR 음성을 각각 골라 쓴다.

export function makeSpeaker() {
  let stopped = false;
  let timer = null;
  let wake = null;   // 대기 중인 promise를 깨우는 함수

  // 항목 사이 간격을 기다리는 도중에 멈추면, 타이머만 지워서는 대기가 영영 안 풀린다.
  // 재생 루프가 그 자리에 매달려 끝나지 않으므로 대기도 함께 깨워 줘야 한다.
  const clear = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (wake) { const w = wake; wake = null; w(); }
  };

  const say = (text, lang, rate) => new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const str = String(text || "").trim();
    if (!synth || !str) { resolve(); return; }
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    try {
      const u = new SpeechSynthesisUtterance(str);
      u.lang = lang; u.rate = rate;
      const v = pickVoice(lang);
      if (v) u.voice = v;
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
      setTimeout(()=>{ try { if (synth.paused) synth.resume(); } catch(e) { /* 무시 */ } }, 60);
      // 안전장치: onend가 안 오는 브라우저가 있어 글자 수 기준으로 최대 대기시간을 둔다.
      // 이게 없으면 재생이 한 항목에서 영영 멈춰버린다.
      setTimeout(finish, Math.min(20000, 1800 + str.length * 130 / Math.max(0.5, rate)));
    } catch(e) { finish(); }
  });

  const wait = (ms) => new Promise((r)=>{
    wake = r;
    timer = setTimeout(()=>{ wake = null; timer = null; r(); }, ms);
  });

  return {
    // steps: [{ text, lang }] — 한 항목이 여러 단계(단어→뜻)로 이뤄진다
    async play(steps, { rate = 0.95, gap = 350 } = {}) {
      for (const st of steps) {
        if (stopped) return false;
        await say(st.text, st.lang || "en-US", rate);
        if (stopped) return false;
        await wait(gap);
      }
      return !stopped;
    },
    stop() {
      stopped = true;
      clear();
      try { window.speechSynthesis.cancel(); } catch(e) { /* 무시 */ }
    },
    get dead() { return stopped; },
  };
}

// 언어에 맞는 음성 고르기 (speakWord와 같은 규칙)
function pickVoice(lang) {
  loadVoicesPublic();
  const want = String(lang || "en-US").slice(0,2).toLowerCase();
  return _voices.find(v=>v.lang && v.lang.toLowerCase().replace("_","-") === String(lang).toLowerCase())
    || _voices.find(v=>v.lang && v.lang.toLowerCase().replace("_","-").startsWith(want))
    || null;
}
function loadVoicesPublic() {
  try { const v = window.speechSynthesis.getVoices() || []; if (v.length) _voices = v; } catch(e) { /* 무시 */ }
}

// 한국어 음성이 아예 없는 기기도 있어서, 뜻 읽어주기를 켤지 판단할 때 쓴다
export const hasKoreanVoice = () => { loadVoicesPublic(); return _voices.some(v=>/^ko/i.test(v.lang||"")); };

export const speechReady = () => {
  try { return !!(window.speechSynthesis && window.SpeechSynthesisUtterance); } catch(e) { return false; }
};

// iOS는 "사용자가 누른 직후"에만 첫 소리를 허용한다.
// 퀴즈 시작 버튼처럼 확실한 터치 시점에 무음으로 한 번 깨워두면 이후 자동 재생이 막히지 않는다.
export const primeSpeech = () => {
  try {
    const s = window.speechSynthesis; if (!s) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0; s.speak(u);
  } catch(e) { /* 지원 안 하는 브라우저는 그냥 넘어간다 */ }
};

export const speakWord = (text, lang="en-US") => {
  try {
    const s = window.speechSynthesis;
    if (!s) return false;
    const str = String(text||"").trim();
    if (!str) return false;
    s.cancel();
    const u = new SpeechSynthesisUtterance(str);
    u.lang = lang; u.rate = 0.9;
    loadVoices();   // 음성 목록은 늦게 채워지기도 하고 중간에 바뀌기도 해서 매번 갱신
    const want = lang.slice(0,2).toLowerCase();
    const pick = _voices.find(v=>v.lang && v.lang.toLowerCase().replace("_","-") === lang.toLowerCase())
      || _voices.find(v=>v.lang && v.lang.toLowerCase().replace("_","-").startsWith(want));
    if (pick) u.voice = pick;
    s.speak(u);
    setTimeout(()=>{ try { if (s.paused) s.resume(); } catch(e) { /* 무시 */ } }, 60);
    return true;
  } catch(e) { return false; }
};

// 복습 우선순위: 숙련도 낮을수록, 마지막 복습이 오래됐을수록 먼저

export const reviewScore = (v) => {
  const lvl = num(v.level);
  const days = v.lastReview ? Math.max(0, Math.floor((Date.now()-new Date(v.lastReview+"T00:00:00").getTime())/86400000)) : 999;
  return (5-lvl)*10 + Math.min(days, 60);
};

export const STUDY_ACCENT = "#7C9CFF";

export const SLEEP_ACCENT = "#8FD3FF";

export const MOODS = [
  { v:1, emoji:"😞", label:"별로", color:"#FF7A7A" },
  { v:2, emoji:"😐", label:"그냥", color:"#FF9F5A" },
  { v:3, emoji:"🙂", label:"괜찮음", color:"#FFC24B" },
  { v:4, emoji:"😊", label:"좋음", color:"#8FD3FF" },
  { v:5, emoji:"🤩", label:"최고", color:"#7DDB8A" },
];

export const C = {
  bg:"#141519", surface:"#1E2027", surface2:"#262932",
  line:"#31343E", text:"#F5F3EF", muted:"#8A8D98", amber:"#FFC24B", danger:"#FF7A7A",
};

// ================= 유틸 =================

export const pad = (n) => String(n).padStart(2, "0");

export const keyOf = (y,m,d) => `${y}-${pad(m+1)}-${pad(d)}`;

export const todayKey = () => { const t = new Date(); return keyOf(t.getFullYear(), t.getMonth(), t.getDate()); };

export const uid = () => Math.random().toString(36).slice(2, 9);
// 음식 항목들 중 liquidMl(수분량)을 합산해 "잔"(250ml) 단위로 환산. 술은 liquidMl 자체가 없어서 자동 제외됨.

export const extraWater = (items) => {
  const ml = (items||[]).reduce((s,it)=> s + num(it.liquidMl), 0);
  return Math.round((ml/250)*10)/10;
};

export const tint = (hex,a) => { const n=parseInt(hex.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; };

export const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
// 화면에 숫자를 찍을 때 쓰는 반올림. 0.1+0.2=0.30000000000000004 같은 부동소수점 잔재를 없앤다.

export const show1 = (v) => { const n = Math.round(num(v)*10)/10; return Number.isInteger(n) ? String(n) : n.toFixed(1); };

export const extractJSON = (raw) => {
  let s = String(raw).replace(/```json|```/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
};

// API 원본 에러(JSON 덩어리)를 사람이 읽을 수 있는 문구로 변환. 사용량 한도 초과를 특별히 인식.

export const friendlyApiError = (rawText, fallbackMsg) => {
  if (/exceeded_limit/i.test(rawText)) {
    const m = rawText.match(/"resets_?[Aa]t"\s*:\s*(\d+)/);
    let when = "";
    if (m) { const d = new Date(parseInt(m[1], 10) * 1000); when = ` 대략 ${d.getHours()}시 ${String(d.getMinutes()).padStart(2, "0")}분쯤 다시 가능해요.`; }
    return `Claude 사용량 한도에 도달했어요.${when} 잠시 후 다시 시도해주세요.`;
  }
  return fallbackMsg;
};

export const fmtMin = (m) => { m=Math.round(m); const h=Math.floor(m/60), mm=m%60; if(!m) return "0분"; return `${h?`${h}시간`:""}${h&&mm?" ":""}${mm?`${mm}분`:""}`; };

export const dowOf = (dk) => { const [y,m,d]=dk.split("-").map(Number); return new Date(y,m-1,d).getDay(); };

export const last7 = () => [...Array(7)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return keyOf(d.getFullYear(),d.getMonth(),d.getDate()); });
// 오늘 기준 최근 n일의 날짜키 배열 (과거→오늘 순)

export const lastNDays = (n) => [...Array(n)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(n-1-i)); return keyOf(d.getFullYear(),d.getMonth(),d.getDate()); });
// 운동한 날 판정: 운동 타입(밀기/당기기 등)을 안 골라도, 부위 세트·종목·대표운동 중 하나라도 있으면 운동한 날로 본다

export const didWorkout = (e) => {
  if (!e) return false;
  if (e.type && e.type !== "rest") return true;
  if (e.partSets && Object.keys(e.partSets).some((p)=>num(e.partSets[p])>0)) return true;
  if (e.lifts && e.lifts.some((l)=>(l.sets||[]).length>0)) return true;
  if (e.mainLift && e.mainLift.name) return true;
  return false;
};
// 조건을 만족하는 날의 연속 기록: 현재 진행 중 연속(current)과 역대 최고(best)

export const emptyDay = () => ({ type:null, parts:[], cardio:null, foods:[], lifts:[], note:"", sleep:null, water:0, partSets:{}, mainLift:null, creatine:false, mood:null, diary:"", habitLog:{}, steps:0 });


// 크레아틴 전용 기능을 걷어내면서, 그동안 체크해둔 기록이 사라지지 않게
// 일반 습관 항목으로 옮긴다. 한 번만 실행되고(migratedCreatine 플래그) 원본 필드는 건드리지 않는다.
// 습관 자체가 필요 없으면 오늘 탭 습관 → 편집에서 지우면 되고, 그때 과거 기록도 같이 정리된다.
export const migrateCreatine = (d) => {
  if (!d || d.migratedCreatine) return d;
  const days = Object.keys(d.schedule || {}).filter((k) => d.schedule[k] && d.schedule[k].creatine);
  if (!days.length) return { ...d, migratedCreatine: true };   // 복용 기록이 없으면 습관도 만들지 않는다

  const habits = d.habits || [];
  let habit = habits.find((h) => h && h.name === "크레아틴");
  const nextHabits = habit ? habits : [...habits, (habit = { id: uid(), name: "크레아틴", emoji: "💊" })];

  const schedule = { ...d.schedule };
  days.forEach((k) => {
    const e = schedule[k];
    const log = e.habitLog || {};
    if (log[habit.id]) return;   // 이미 옮겨둔 날은 건드리지 않는다
    schedule[k] = { ...e, habitLog: { ...log, [habit.id]: true } };
  });

  return { ...d, habits: nextHabits, schedule, migratedCreatine: true };
};

export const normalize = (d) => ({
  // 모르는 필드도 그대로 넘긴다. 캐시된 구버전 코드가 돌더라도
  // 자기가 모르는 새 데이터(계획·단어장 등)를 지워버리지 않게 하는 안전장치.
  ...d,
  schedule: d.schedule || {},
  profile: { height:"", age:"", sex:"", activity:1.375, surplus:0, goalWeight:"", goalFat:"", apiKey:"", macroGoal:"lean", ...(d.profile||{}) },
  measurements: d.measurements || [],
  study: d.study || [],
  scores: d.scores || [],
  exams: d.exams || [],
  favorites: d.favorites || [],
  studyGoals: d.studyGoals || {},
  customFoods: d.customFoods || [],
  routines: d.routines || [],
  habits: d.habits || [],
  updatedAt: d.updatedAt || 0,
  lastBackupAt: d.lastBackupAt || 0,
  plans: d.plans || {},   // { "YYYY-MM-DD": [{id,title,start,end,alarm,note}] }
  vocab: d.vocab || [],   // 단어장: [{id,type,term,meaning,note,tag,level,lastReview,reviewCount,created}]
  targetScore: d.targetScore || {},  // { "토익": 800 }
  weekGoals: d.weekGoals || {},      // { workouts: 4, sets: 80 }
  mealSets: d.mealSets || [],        // 식단 세트: [{id,name,icon,items:[{name,protein,...}]}]
  vocabGoal: d.vocabGoal || 20,      // 하루 복습 목표 개수
  migratedCreatine: !!d.migratedCreatine,   // 크레아틴 → 습관 이관 완료 여부 (1회성)
  barcodes: d.barcodes || {},        // 내 바코드 사전: { "8801234567890": {name,protein,carbs,sugar,fat,kcal,liquidMl,count,lastUsed} }
});

export const NUTRI_PROMPT = `아래는 사용자가 먹은 음식/보충제(프로틴 쉐이크 등) 설명이야.
각 항목의 단백질(g)과 칼로리(kcal)를 한국 일반 식품 기준으로 대략 추정해줘.
반드시 순수 JSON만 출력하고, 마크다운·코드블록·설명은 절대 넣지 마.
형식: {"items":[{"name":"항목명","protein":숫자,"carbs":숫자,"sugar":숫자,"fat":숫자,"kcal":숫자}]}
규칙: protein/carbs/sugar/fat 단위는 g, 모두 정수. sugar(당류)는 carbs(총 탄수화물)에 포함되므로 carbs보다 클 수 없음. 항목은 말한 단위/개수대로 분리, 양이 없으면 1인분 기준.
중요: 브랜드·프랜차이즈·특정 제품명(예: 교촌 허니콤보, 맘스터치 싸이버거, 스타벅스 라떼)이면 web_search로 공식/실제 영양정보를 먼저 찾아 반영해. 검색해도 없으면 그때만 추정. 검색 후에도 최종 답변은 JSON만 출력.
설명:
`;

export const computeTDEE = (profile, weight) => {
  const h = num(profile.height), a = num(profile.age);
  if (!weight || !h || !a || !profile.sex) return null;
  const bmr = 10*weight + 6.25*h - 5*a + (profile.sex === "m" ? 5 : -161);
  return Math.round(bmr * (profile.activity || 1.375));
};

// 독립 배포 버전: Claude.ai 아티팩트 안에서만 되던 "키 없이 호출"이 아니라,
// 사용자 본인의 Anthropic API 키로 브라우저에서 직접 호출한다 (bring-your-own-key 방식).
// 몸 탭 > API 키 설정에 키를 넣어야 이 함수가 동작함.
export async function callClaudeAPI(apiKey, prompt, opts = {}) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("API 키가 설정되지 않았어요. 몸 탭 > API 키 설정에서 Anthropic API 키를 입력해주세요.");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey.trim(),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: opts.maxTokens || 1000,
      messages: [{ role: "user", content: prompt }],
      // 단어 뜻 채우기처럼 검색이 필요 없는 작업은 도구를 빼서 더 빠르게
      ...(opts.noTools ? {} : { tools: [{ type: "web_search_20250305", name: "web_search" }] }),
    }),
  });
  const rawText = await res.text();
  let data = null; try { data = JSON.parse(rawText); } catch(e) {}
  if (!res.ok || (data && data.error) || /exceeded_limit/i.test(rawText)) {
    throw new Error(friendlyApiError(rawText, data?.error?.message || `요청 실패 (${res.status})`));
  }
  return (data?.content||[]).map((i)=>i.type==="text"?i.text:"").join("");
}

// 목표 칼로리 기준 탄수 적정량 + 당류 상한(자유당 10% 에너지)
// 걸음수 → 소모 칼로리. 체중 1kg·1걸음당 약 0.00057kcal (70kg 기준 1만보 ≈ 400kcal)

export const stepsToKcal = (steps, weight) => {
  const st = num(steps), w = num(weight) || 70;
  if (st <= 0) return 0;
  return Math.round(st * w * 0.00057);
};
// 하루 총 소모(유산소 + 걸음수)

export const burnedKcal = (entry, weight) => {
  if (!entry) return 0;
  return (entry.cardio ? num(entry.cardio.kcal) : 0) + stepsToKcal(entry.steps, weight);
};

// 목표별 권장 탄단지 비율 (칼로리 기준 %)

export const MACRO_GOALS = {
  lean:  { key:"lean",  label:"린매스업", desc:"근육 위주로 천천히", carb:45, protein:30, fat:25, color:"#B6E34B" },
  bulk:  { key:"bulk",  label:"벌크업",   desc:"체중 증량 우선",     carb:50, protein:25, fat:25, color:"#FF8C42" },
  cut:   { key:"cut",   label:"다이어트", desc:"체지방 감량",        carb:35, protein:40, fat:25, color:"#35C4D8" },
};

// ===== 체성분 분석 (전부 로컬 공식 — API 불필요) =====

export const rd1 = (v)=> Math.round(num(v)*10)/10;
// 측정 한 건에서 체지방량·제지방량 계산

export const macroTargets = (tdee, surplus, weight, proteinG) => {
  if (!tdee || !weight) return null;
  const cal = tdee + num(surplus);
  const pCal = (proteinG || weight * 2) * 4;
  const fCal = cal * 0.25;
  const cCal = Math.max(0, cal - pCal - fCal);
  return { carb: Math.round(cCal / 4), sugar: Math.round(cal * 0.10 / 4), fat: Math.round(fCal / 9) };
};

// ================= 계획 → 휴대폰 캘린더 연동 =================
// 웹앱은 스스로 예약 알림을 띄울 수 없다(Notification Triggers API는 개발 중단, Push는 서버 필요).
// 대신 휴대폰의 기본 캘린더에 일정을 넘겨서 OS가 알람을 울리게 한다.

export const planDate = (dateKey, hhmm) => {
  const [y,m,d] = dateKey.split("-").map(Number);
  const [hh,mi] = (hhmm||"09:00").split(":").map(Number);
  return new Date(y, m-1, d, hh||0, mi||0, 0, 0);
};

export function UndoToast({ state, onUndo, onClose }) {
  if (!state) return null;
  return (
    <div style={{ position:"fixed", bottom:"calc(78px + env(safe-area-inset-bottom))", left:16, right:80, zIndex:65,
      background:C.surface, border:`1px solid ${tint(C.amber,0.5)}`, borderRadius:12, padding:"11px 13px",
      display:"flex", alignItems:"center", gap:10, boxShadow:"0 6px 20px rgba(0,0,0,0.45)" }}>
      <span style={{ flex:1, minWidth:0, fontSize:12, color:C.text, fontWeight:600, overflow:"hidden",
        textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{state.label} 삭제됨</span>
      <button onClick={onUndo} style={{ background:tint(C.amber,0.16), border:`1px solid ${C.amber}`, color:C.amber,
        borderRadius:999, padding:"6px 13px", fontSize:11.5, fontWeight:800, cursor:"pointer", flexShrink:0 }}>되돌리기</button>
      <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, fontSize:15,
        cursor:"pointer", padding:"0 2px", flexShrink:0 }}>×</button>
    </div>
  );
}

// 어느 탭에서나 자주 쓰는 기록을 바로 남기는 버튼 (오늘 날짜에 반영)

export function QuickAdd({ day, updateToday, weight, onGoToday, onAddVocab }) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState("");
  const [wordOpen, setWordOpen] = useState(false);
  const [w, setW] = useState({ term:"", meaning:"" });
  const show = (msg)=>{ setFlash(msg); setTimeout(()=>setFlash(""), 1400); };

  const water = num(day.water);
  const steps = num(day.steps);
  const actions = [
    { key:"water", icon:"💧", label:"물 +1잔", color:"#6BC5F0",
      sub:`${water}잔`, run:()=>{ updateToday({ water: water+1 }); show(`물 ${water+1}잔`); } },
    { key:"steps", icon:"🚶", label:"걸음 +1천", color:"#5AD1A0",
      sub: steps>0 ? `${(steps/1000).toFixed(1)}천보` : "미기록",
      run:()=>{ const n=steps+1000; updateToday({ steps:n }); show(`${(n/1000).toFixed(1)}천보 · ≈${stepsToKcal(n,weight)}kcal`); } },
    { key:"word", icon:"📖", label:"단어 추가", color:STUDY_ACCENT,
      sub:"떠오를 때", run:()=>{ setWordOpen(true); setOpen(false); } },
    { key:"go", icon:"📝", label:"오늘 탭에서 기록", color:TYPES.push.color,
      sub:"음식 · 세트", run:()=>{ onGoToday(); setOpen(false); } },
  ];
  const saveWord = () => {
    if (!w.term.trim()) return;
    onAddVocab({ term:w.term.trim(), meaning:w.meaning.trim() });
    show(`"${w.term.trim()}"`);
    setW({ term:"", meaning:"" }); setWordOpen(false);
  };

  return (
    <>
      {/* 방금 기록한 내용 알림 */}
      {flash && (
        <div style={{ position:"fixed", bottom:150, left:"50%", transform:"translateX(-50%)", zIndex:70,
          background:C.surface, color:C.text, fontSize:12.5, fontWeight:700, padding:"9px 16px",
          borderRadius:999, border:`1px solid ${tint(TYPES.legs.color,0.5)}`, whiteSpace:"nowrap",
          boxShadow:"0 6px 20px rgba(0,0,0,0.45)" }}>{flash} 기록됐어요</div>
      )}

      {/* 펼친 목록 */}
      {open && (
        <>
          <div onClick={()=>setOpen(false)} style={{ position:"fixed", inset:0, zIndex:55, background:"rgba(0,0,0,0.4)" }} />
          <div style={{ position:"fixed", right:16, bottom:"calc(140px + env(safe-area-inset-bottom))", zIndex:58,
            display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>
            {actions.map((a)=>(
              <button key={a.key} onClick={a.run} style={{ display:"flex", alignItems:"center", gap:9,
                background:C.surface, border:`1px solid ${tint(a.color,0.45)}`, borderRadius:999,
                padding:"10px 15px", cursor:"pointer", boxShadow:"0 4px 16px rgba(0,0,0,0.4)" }}>
                <span style={{ fontSize:10.5, color:C.muted }}>{a.sub}</span>
                <span style={{ fontSize:12.5, fontWeight:800, color:a.color, whiteSpace:"nowrap" }}>{a.label}</span>
                <span style={{ fontSize:15 }}>{a.icon}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* 단어 빠른 입력 */}
      {wordOpen && (
        <SheetLayer onClose={()=>setWordOpen(false)}>
          <div onClick={(e)=>e.stopPropagation()} style={{...sheet, minHeight:"auto", maxHeight:"none",
            paddingBottom:"calc(18px + env(safe-area-inset-bottom))"}}>
            <div style={grip} />
            <div style={{ fontSize:16, fontWeight:800 }}>단어 추가</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:4, marginBottom:12 }}>
              떠오를 때 바로 넣어두고, 뜻은 나중에 채워도 돼요.
            </div>
            <input value={w.term} onChange={(e)=>setW({...w, term:e.target.value})} autoFocus
              placeholder="단어 또는 숙어" style={{...inp, width:"100%", boxSizing:"border-box"}} />
            <input value={w.meaning} onChange={(e)=>setW({...w, meaning:e.target.value})}
              placeholder="뜻 (선택)" style={{...inp, width:"100%", boxSizing:"border-box", marginTop:7}} />
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <button onClick={()=>setWordOpen(false)} style={{...ghost, flex:1}}>취소</button>
              <button onClick={saveWord} disabled={!w.term.trim()}
                style={{...primary(STUDY_ACCENT), flex:2, opacity:w.term.trim()?1:0.45}}>단어장에 넣기</button>
            </div>
          </div>
        </SheetLayer>
      )}

      {/* 버튼 */}
      <button onClick={()=>setOpen(v=>!v)} aria-label="빠른 기록"
        style={{ position:"fixed", right:16, bottom:"calc(78px + env(safe-area-inset-bottom))", zIndex:59,
          width:52, height:52, borderRadius:"50%", cursor:"pointer",
          background: open ? C.surface : TYPES.legs.color,
          border: open ? `1px solid ${C.line}` : "none",
          color: open ? C.muted : "#141519", fontSize:open?20:26, fontWeight:800,
          boxShadow:"0 6px 20px rgba(0,0,0,0.45)", transition:"transform .18s",
          transform: open?"rotate(45deg)":"none", display:"flex", alignItems:"center", justifyContent:"center" }}>
        +
      </button>
    </>
  );
}

export function SaveBadge({ status, onRetry }) {
  if (status === "idle" || status === "saved") return null;
  const map = {
    pending: { text: "저장 대기…", color: C.muted, bg: C.surface2 },
    saving:  { text: "저장 중…", color: C.amber, bg: tint(C.amber, 0.15) },
    error:   { text: "저장 실패 · 자동 재시도 중 (탭하면 즉시 재시도)", color: C.danger, bg: tint(C.danger, 0.15) },
    offline: { text: "오프라인 · 연결되면 자동 저장돼요", color: C.muted, bg: C.surface2 },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <div onClick={(status==="error"||status==="offline")?onRetry:undefined} style={{
      position:"fixed", top:14, left:"50%", transform:"translateX(-50%)", zIndex:60,
      background:s.bg, color:s.color, fontSize:11.5, fontWeight:700, padding:"6px 14px",
      borderRadius:999, border:`1px solid ${s.color}`, cursor: (status==="error"||status==="offline")?"pointer":"default",
    }}>{s.text}</div>
  );
}

// ================= 오늘 (대시보드) =================

// 지금까지 기록한 대표운동 이름 목록 (최근에 한 순서로).
// 같은 운동을 매번 다르게 적어 종목이 흩어지는 걸 막기 위해 입력할 때 제안한다.
export const pastLifts = (schedule) => {
  const map = new Map();   // 이름 → { name, date, w, r }
  for (const kk of Object.keys(schedule||{})) {
    const ml = schedule[kk]?.mainLift;
    if (!ml || !String(ml.name||"").trim()) continue;
    const name = String(ml.name).trim();
    const cur = map.get(name);
    if (!cur || kk > cur.date) map.set(name, { name, date:kk, w:ml.w, r:ml.r });
  }
  return [...map.values()].sort((a,b)=> b.date.localeCompare(a.date));
};

export function QuickWorkoutBlock({ partSets, mainLift, onChangePartSets, onChangeMainLift, schedule }) {
  const ps = partSets || {};
  const ml = mainLift || { name:"", w:"", r:"" };
  const [editSet, setEditSet] = useState({}); // 직접입력 중인 임시 문자열
  const clearEdit = (p) => setEditSet((s)=>{ const c={...s}; delete c[p]; return c; });
  const togglePart = (p) => {
    const next = { ...ps };
    if (next[p] != null) delete next[p];
    else next[p] = 3; // 기본 3세트로 시작
    clearEdit(p);
    onChangePartSets(next);
  };
  const bump = (p, d) => {
    clearEdit(p);
    onChangePartSets({ ...ps, [p]: Math.max(1, Math.min(99, (ps[p]||0) + d)) });
  };
  const typeSet = (p, raw) => {
    setEditSet((s)=>({ ...s, [p]: raw }));
    if (raw !== "") onChangePartSets({ ...ps, [p]: Math.max(1, Math.min(99, Math.round(num(raw)))) });
  };
  const blurSet = (p) => { clearEdit(p); if (!(ps[p]>=1)) onChangePartSets({ ...ps, [p]: 1 }); };
  const setMl = (patch) => {
    const next = { ...ml, ...patch };
    onChangeMainLift(next.name || next.w || next.r ? next : null);
  };
  return (
    <div>
      <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>부위 탭해서 선택 → 세트수는 직접 입력하거나 ± 로 조절</div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {PARTS.map((p)=>{
          const on = ps[p] != null;
          return (
            <span key={p} style={{ display:"inline-flex", alignItems:"center", gap:0, borderRadius:999, overflow:"hidden",
              border:`1px solid ${on?TYPES.push.color:C.line}`, background:on?tint(TYPES.push.color,0.12):"transparent" }}>
              <button onClick={()=>togglePart(p)} style={{ background:"none", border:"none", cursor:"pointer", padding:"8px 10px",
                fontSize:12, fontWeight:800, color:on?TYPES.push.color:C.muted }}>{p}</button>
              {on && <>
                <button onClick={()=>bump(p,-1)} style={{ background:"none", border:"none", borderLeft:`1px solid ${tint(TYPES.push.color,0.35)}`, color:TYPES.push.color, fontWeight:800, padding:"8px 10px", cursor:"pointer", fontSize:13 }}>–</button>
                <input value={editSet[p] ?? String(ps[p])} onChange={(e)=>typeSet(p, e.target.value.replace(/[^0-9]/g,""))} onFocus={(e)=>e.target.select()} onBlur={()=>blurSet(p)}
                  inputMode="numeric" style={{ width:26, textAlign:"center", background:"none", border:"none", borderLeft:`1px solid ${tint(TYPES.push.color,0.35)}`,
                  color:TYPES.push.color, fontWeight:800, fontSize:13, padding:"8px 0", outline:"none" }} />
                <span style={{ fontSize:11, color:TYPES.push.color, fontWeight:700, paddingRight:2 }}>세트</span>
                <button onClick={()=>bump(p,1)} style={{ background:"none", border:"none", borderLeft:`1px solid ${tint(TYPES.push.color,0.35)}`, color:TYPES.push.color, fontWeight:800, padding:"8px 10px", cursor:"pointer", fontSize:13 }}>+</button>
              </>}
            </span>
          );
        })}
      </div>
      <div style={{ fontSize:11, color:C.muted, margin:"14px 0 6px" }}>오늘의 대표운동 <span style={{ opacity:0.7 }}>(하나만, 최고 세트 기준)</span></div>
      <div style={{ display:"flex", gap:6 }}>
        <input value={ml.name} onChange={(e)=>setMl({name:e.target.value})} placeholder="운동명" style={{...inp, flex:2, minWidth:0}} />
        <input value={ml.w} onChange={(e)=>setMl({w:e.target.value})} placeholder="kg" inputMode="decimal" style={{...inp, flex:1, minWidth:0}} />
        <input value={ml.r} onChange={(e)=>setMl({r:e.target.value})} placeholder="회" inputMode="numeric" style={{...inp, flex:1, minWidth:0}} />
      </div>

      {/* 예전에 쓴 종목 제안 — 눌러서 넣으면 이름이 흔들리지 않아 기록이 한 종목으로 모인다.
          지난번 무게·횟수도 같이 채워 넣기를 줄인다. */}
      {(()=>{
        const typed = String(ml.name||"").trim().toLowerCase();
        const all = pastLifts(schedule);
        const list = (typed
          ? all.filter(x=> x.name.toLowerCase().includes(typed) && x.name.toLowerCase()!==typed)
          : all).slice(0, 6);
        if (list.length===0) return null;
        return (
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:7 }}>
            {list.map((x)=>(
              <button key={x.name}
                onClick={()=>onChangeMainLift({ name:x.name, w:x.w||"", r:x.r||"" })}
                style={{ background:C.surface2, border:`1px solid ${C.line}`, borderRadius:999,
                  padding:"6px 11px", cursor:"pointer", color:C.text, fontSize:11.5, fontWeight:700,
                  display:"flex", alignItems:"center", gap:5 }}>
                {x.name}
                {num(x.w)>0 && <span style={{ fontSize:10, color:C.muted, fontWeight:600 }}>{num(x.w)}kg</span>}
              </button>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ================= 습관 트래커 =================

export const CONDITION_LABELS = { 1:"최악", 2:"나쁨", 3:"보통", 4:"좋음", 5:"최고" };

export function SleepBlock({ value, onChange }) {
  const v = value || { hours: 7, condition: null };
  const setHours = (h) => onChange({ ...v, hours: Math.max(0, Math.round(h * 2) / 2) });
  const setCondition = (c) => onChange({ ...v, condition: v.condition === c ? null : c });
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>수면시간 · <b style={{ color: SLEEP_ACCENT }}>{v.hours}시간</b></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface2, borderRadius: 10, padding: "6px 10px" }}>
        <button onClick={() => setHours(v.hours - 0.5)} style={stepBtn}>–</button>
        <span style={{ flex: 1, textAlign: "center", fontWeight: 800 }}>{v.hours}시간</span>
        <button onClick={() => setHours(v.hours + 0.5)} style={stepBtn}>+</button>
      </div>
      <div style={{ fontSize: 11, color: C.muted, margin: "12px 0 6px" }}>컨디션</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1,2,3,4,5].map((c) => (
          <button key={c} onClick={() => setCondition(c)} style={{ ...chip(v.condition===c, SLEEP_ACCENT), flex:1, textAlign:"center", padding:"9px 4px" }}>
            <div style={{ fontSize:13, fontWeight:800 }}>{c}</div>
            <div style={{ fontSize:9, color:C.muted, marginTop:1 }}>{CONDITION_LABELS[c]}</div>
          </button>
        ))}
      </div>
      {value && (
        <button onClick={()=>onChange(null)} style={{ background:"none", border:"none", color:C.muted, fontSize:11, marginTop:8, cursor:"pointer", padding:0, textDecoration:"underline" }}>지우기</button>
      )}
    </div>
  );
}

// ================= 음식 (검색 · 내 음식 · 외식추천) =================

export function FoodSection({ foods, addFoods, removeFood, updateFood, favorites, addFavorite, removeFavorite, compact, apiKey, customFoods }) {
  const [editId, setEditId] = useState(null);
  return (
    <div>
      {favorites.length>0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:10 }}>
          {favorites.map((f)=>(
            <span key={f.id} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 8px 7px 12px", borderRadius:999,
              border:`1px solid ${C.line}`, background:C.surface2, fontSize:12.5, fontWeight:700 }}>
              <span onClick={()=>addFoods([{ id:uid(), name:f.name, protein:f.protein, carbs:num(f.carbs), sugar:num(f.sugar), fat:num(f.fat), kcal:f.kcal, liquidMl:num(f.liquidMl) }])} style={{ cursor:"pointer" }}>+ {f.name}</span>
              <span onClick={()=>removeFavorite(f.id)} style={{ cursor:"pointer", color:C.muted }}>×</span>
            </span>
          ))}
        </div>
      )}
      {foods.map((f)=>(
        <div key={f.id} style={{ borderBottom:`1px solid ${C.line}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0" }}>
            <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={()=>updateFood && setEditId(editId===f.id?null:f.id)}>
              <div style={{ fontSize:14, fontWeight:600 }}>{f.name} {updateFood && <span style={{ fontSize:10, color:C.muted }}>{editId===f.id?"▲":"✏️"}</span>}</div>
              <div style={{ fontSize:12, color:C.muted }}>단백질 {show1(f.protein)}g · 탄수 {show1(f.carbs)}g · 당 {show1(f.sugar)}g · 지방 {show1(f.fat)}g{num(f.kcal)>0?` · ${Math.round(num(f.kcal))}kcal`:""}{num(f.liquidMl)>0?` · 💧${Math.round(num(f.liquidMl))}ml`:""}</div>
            </div>
            <button onClick={()=>addFavorite(f)} title="즐겨찾기" style={{ ...xBtn, color:C.amber, marginRight:6 }}>★</button>
            <ConfirmX onConfirm={()=>removeFood(f.id)} label="삭제" />
          </div>
          {updateFood && editId===f.id && (
            <FoodEditRow food={f} onSave={(patch)=>{ updateFood(f.id, patch); setEditId(null); }} onCancel={()=>setEditId(null)} />
          )}
        </div>
      ))}
      <FoodAI onAdd={addFoods} compact={compact} apiKey={apiKey} customFoods={customFoods} />
    </div>
  );
}

// 기름 프리셋 (구이·볶음 조리유 추가) — 티스푼/큰술 기준

export const OIL_PRESETS = [
  { label:"식용유 1작은술", kcal:40, fat:4.5 },
  { label:"식용유 1큰술", kcal:120, fat:14 },
  { label:"올리브유 1큰술", kcal:120, fat:14 },
  { label:"버터 10g", kcal:72, fat:8 },
  { label:"참기름 1큰술", kcal:120, fat:14 },
];

export function FoodEditRow({ food, onSave, onCancel }) {
  const [v, setV] = useState({
    protein:String(num(food.protein)), carbs:String(num(food.carbs)), sugar:String(num(food.sugar)),
    fat:String(num(food.fat)), kcal:String(num(food.kcal)), liquidMl:String(num(food.liquidMl)),
  });
  const addOil = (o) => setV((s)=>({ ...s, kcal:String(num(s.kcal)+o.kcal), fat:String(Math.round((num(s.fat)+o.fat)*10)/10) }));
  const F = (label, key, unit) => (
    <div style={{ flex:1, minWidth:60 }}>
      <div style={{ fontSize:9.5, color:C.muted, marginBottom:3 }}>{label}</div>
      <input value={v[key]} onChange={(e)=>setV({...v,[key]:e.target.value})} inputMode="decimal"
        style={{...inp, width:"100%", boxSizing:"border-box", padding:"7px 8px", fontSize:13}} />
    </div>
  );
  return (
    <div style={{ background:C.surface2, borderRadius:12, padding:"12px", marginBottom:10 }}>
      <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:7 }}>영양성분 수정</div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {F("단백질 g","protein")}{F("탄수 g","carbs")}{F("당류 g","sugar")}
      </div>
      <div style={{ display:"flex", gap:6, marginTop:7 }}>
        {F("지방 g","fat")}{F("칼로리","kcal")}{F("수분 ml","liquidMl")}
      </div>

      <div style={{ fontSize:11, color:C.muted, fontWeight:700, margin:"12px 0 6px" }}>🛢️ 구이·조리 기름 추가 <span style={{opacity:0.7}}>(탭하면 칼로리·지방 더해짐)</span></div>
      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
        {OIL_PRESETS.map((o)=>(
          <button key={o.label} onClick={()=>addOil(o)} style={{ ...chip(false, C.amber), padding:"6px 9px", fontSize:11 }}>+ {o.label}</button>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, marginTop:12 }}>
        <button onClick={onCancel} style={{...ghost, flex:1}}>취소</button>
        <button onClick={()=>onSave({ protein:num(v.protein), carbs:num(v.carbs), sugar:num(v.sugar), fat:num(v.fat), kcal:num(v.kcal), liquidMl:num(v.liquidMl) })}
          style={{...primary(TYPES.legs.color), flex:2}}>저장</button>
      </div>
    </div>
  );
}

export function FoodAI({ onAdd, compact, apiKey, customFoods }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [manualOn, setManualOn] = useState(false);
  const [man, setMan] = useState({ name:"", protein:"", carbs:"", sugar:"", fat:"", kcal:"" });

  const calc = async () => {
    if(!text.trim()||loading) return; setLoading(true); setErr("");
    try {
      const { matched, unmatched } = lookupLocalFoods(text.trim(), customFoods);
      let items = matched.map((m)=>({ id:uid(), ...m }));
      if (unmatched.length) {
        if (apiKey && apiKey.trim()) {
          const raw = await callClaudeAPI(apiKey, NUTRI_PROMPT + unmatched.join(", "));
          const parsed = extractJSON(raw);
          const aiItems = (parsed.items||[]).map((it)=>({ id:uid(), name:String(it.name), protein:num(it.protein), carbs:num(it.carbs), sugar:num(it.sugar), fat:num(it.fat), kcal:num(it.kcal) }));
          items = [...items, ...aiItems];
        } else if (!items.length) {
          throw new Error(`"${unmatched.join(", ")}"는 로컬 목록에 없어요. API 키를 넣거나 직접 입력해주세요.`);
        }
      }
      if(!items.length) throw new Error("항목을 못 읽었어요");
      onAdd(items); setText("");
      if (unmatched.length && !(apiKey&&apiKey.trim())) {
        setErr(`나머지는 추가했어요. "${unmatched.join(", ")}"는 로컬 목록에 없어 직접 입력이 필요해요.`);
      }
    } catch(e){ setErr(`계산 실패: ${e.message}`); } finally { setLoading(false); }
  };

  const addManual = () => {
    if (!man.name.trim()) return;
    onAdd([{ id:uid(), name:man.name.trim(), protein:num(man.protein), carbs:num(man.carbs), sugar:num(man.sugar), fat:num(man.fat), kcal:num(man.kcal) }]);
    setMan({ name:"", protein:"", carbs:"", sugar:"", fat:"", kcal:"" });
  };

  return (
    <div style={{ marginTop: compact?6:10 }}>
      <textarea value={text} onChange={(e)=>setText(e.target.value)} rows={2}
        placeholder={"먹은 걸 편하게 적어요\n예: 닭가슴살 200g, 밥 한 공기, 프로틴 1스쿱"}
        style={{...inp, width:"100%", boxSizing:"border-box", resize:"none", lineHeight:1.4, fontFamily:"inherit"}} />
      <button onClick={calc} disabled={loading} style={{...primary(TYPES.legs.color), width:"100%", marginTop:8, opacity:loading?0.6:1}}>{loading?"계산 중…":"단백질·칼로리 계산"}</button>
      {err && <div style={{ fontSize:12, color:C.danger, marginTop:8, lineHeight:1.5 }}>{err}</div>}
      <button onClick={()=>setManualOn(v=>!v)} style={{ background:"none", border:"none", color:C.muted, fontSize:11.5, fontWeight:700, marginTop:10, cursor:"pointer", padding:0, textDecoration:"underline" }}>
        {manualOn?"직접 입력 닫기":"직접 숫자로 입력할래요"}
      </button>
      {manualOn && (
        <div style={{ marginTop:8, background:C.surface2, borderRadius:12, padding:"10px 12px" }}>
          <input value={man.name} onChange={(e)=>setMan({...man,name:e.target.value})} placeholder="음식 이름" style={{...inp, width:"100%", boxSizing:"border-box"}} />
          <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
            <input value={man.protein} onChange={(e)=>setMan({...man,protein:e.target.value})} placeholder="단백질g" inputMode="decimal" style={{...inp, flex:1, minWidth:70}} />
            <input value={man.carbs} onChange={(e)=>setMan({...man,carbs:e.target.value})} placeholder="탄수g" inputMode="decimal" style={{...inp, flex:1, minWidth:70}} />
            <input value={man.sugar} onChange={(e)=>setMan({...man,sugar:e.target.value})} placeholder="당류g" inputMode="decimal" style={{...inp, flex:1, minWidth:70}} />
          </div>
          <div style={{ display:"flex", gap:6, marginTop:6 }}>
            <input value={man.fat} onChange={(e)=>setMan({...man,fat:e.target.value})} placeholder="지방g" inputMode="decimal" style={{...inp, flex:1, minWidth:0}} />
            <input value={man.kcal} onChange={(e)=>setMan({...man,kcal:e.target.value})} placeholder="kcal" inputMode="numeric" style={{...inp, flex:1, minWidth:0}} />
          </div>
          <button onClick={addManual} style={{...primary(TYPES.legs.color), width:"100%", marginTop:8}}>직접 입력으로 추가</button>
        </div>
      )}
    </div>
  );
}

// ================= 공용: 차트 =================

export function LineChart({ points, color, unit, empty }) {
  if (!points || points.length<2) return <div style={{ color:C.muted, fontSize:13, padding:"14px 0" }}>{empty||"데이터를 2개 이상 기록하면 그래프가 나와요."}</div>;
  const W=320,H=120,pT=14,pB=22,pL=6,pR=6;
  const vs=points.map(p=>p.value); let min=Math.min(...vs),max=Math.max(...vs); if(min===max){min-=1;max+=1;}
  const x=(i)=>pL+(i/(points.length-1))*(W-pL-pR);
  const y=(v)=>pT+(1-(v-min)/(max-min))*(H-pT-pB);
  const path=points.map((p,i)=>`${x(i)},${y(p.value)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", marginTop:8 }}>
      <polyline points={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p,i)=>(
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r="3.5" fill={C.bg} stroke={color} strokeWidth="2" />
          {(i===0||i===points.length-1) && <text x={x(i)} y={y(p.value)-8} fill={C.text} fontSize="11" fontWeight="700" textAnchor={i===0?"start":"end"}>{p.value}{unit||""}</text>}
          <text x={x(i)} y={H-6} fill={C.muted} fontSize="9" textAnchor="middle">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function Bars7({ values, color, target, suffix, hoursLabel }) {
  const days = last7();
  const max = Math.max(target||0, 1, ...values);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:92, position:"relative" }}>
      {values.map((v,i)=>{ const hgt=Math.max(3,(v/max)*74); const isToday=i===6;
        return (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
            <div style={{ fontSize:9, color:C.muted, height:11 }}>{v?(hoursLabel?Math.round(v/6)/10+"h":show1(v)):""}</div>
            <div style={{ width:"72%", height:hgt, borderRadius:5, background:v?color:C.surface2, opacity:isToday?1:0.7 }} />
            <div style={{ fontSize:10, fontWeight:700, color:isToday?C.text:C.muted }}>{WEEKDAYS[dowOf(days[i])]}</div>
          </div>
        ); })}
    </div>
  );
}

// ================= 통계 =================

export function TabBar({ tab, setTab }) {
  const items = [["today","오늘","☀️"],["calendar","캘린더","📅"],["foods","음식","🍽️"],["study","공부","📚"],["stats","통계","📊"],["body","몸","💪"]];
  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, maxWidth:460, margin:"0 auto", display:"flex", background:C.surface, borderTop:`1px solid ${C.line}`, height:64, paddingBottom:"env(safe-area-inset-bottom)" }}>
      {items.map(([k,label,icon])=>(
        <button key={k} onClick={()=>setTab(k)} style={{ flex:1, background:"transparent", border:"none", cursor:"pointer",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, padding:0,
          color:tab===k?TYPES.push.color:C.muted, fontSize:10, fontWeight:800,
          borderTop:tab===k?`2px solid ${TYPES.push.color}`:"2px solid transparent" }}>
          <span style={{ fontSize:16, filter:tab===k?"none":"grayscale(1) opacity(0.55)" }}>{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

// ================= 재사용 UI =================

export const Card = ({children}) => <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:16, padding:"15px 16px", marginTop:12, boxShadow:"0 2px 10px rgba(0,0,0,0.18)" }}>{children}</div>;

// 유리질감 카드

export const GlassCard = ({children, glow}) => (
  <div style={{ position:"relative", borderRadius:20, padding:"18px", marginTop:12, overflow:"hidden",
    background:"linear-gradient(155deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))",
    border:"1px solid rgba(255,255,255,0.1)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
    boxShadow: glow ? `0 8px 32px ${tint(glow,0.22)}, inset 0 1px 0 rgba(255,255,255,0.12)` : "0 8px 30px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.1)" }}>
    {glow && <div style={{ position:"absolute", top:-60, right:-40, width:160, height:160, borderRadius:"50%",
      background:`radial-gradient(circle, ${tint(glow,0.35)}, transparent 70%)`, pointerEvents:"none" }} />}
    <div style={{ position:"relative" }}>{children}</div>
  </div>
);

// 숫자 카운트업

export function useCountUp(target, dur=650) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(null);
  useEffect(()=>{
    const from = fromRef.current, to = target, start = performance.now();
    if (from === to) return;
    const tick = (now)=>{
      const t = Math.min(1, (now-start)/dur);
      const eased = 1-Math.pow(1-t, 3);
      setVal(from + (to-from)*eased);
      if (t<1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return ()=> cancelAnimationFrame(rafRef.current);
  }, [target, dur]);
  return val;
}

export const Row = ({children}) => <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>{children}</div>;

export const MiniCard = ({label,value,unit,color}) => (
  <div style={{ flex:1, minWidth:0, background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, padding:"12px", marginTop:12 }}>
    <div style={{ fontSize:10.5, color:C.muted, fontWeight:600 }}>{label}</div>
    <div style={{ fontSize:20, fontWeight:800, color, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}<span style={{ fontSize:12, color:C.muted, marginLeft:2 }}>{unit}</span></div>
  </div>
);
// 음식 카드의 영양성분 셀 (라벨 위 / 값 아래)

export function Collapsible({ title, summary, accent, defaultOpen=false, openSignal=0, children }) {
  const [open, setOpen] = useState(defaultOpen);
  // 밖에서 "열어줘" 신호를 보내면 펼친다 (예: 수면 미기입 알림 탭)
  useEffect(()=>{ if (openSignal) setOpen(true); }, [openSignal]);
  return (
    <div style={{ marginBottom:12 }}>
      <button onClick={()=>setOpen(v=>!v)} style={{ width:"100%", display:"flex", alignItems:"center",
        justifyContent:"space-between", gap:10, padding:"13px 15px", borderRadius:14, cursor:"pointer",
        background:C.surface, border:`1px solid ${open?tint(accent||C.text,0.35):C.line}`, textAlign:"left" }}>
        <span style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
          <span style={{ fontSize:13, fontWeight:800, color:open?(accent||C.text):C.text }}>{title}</span>
          {!open && summary && <span style={{ fontSize:11, color:C.muted, overflow:"hidden",
            textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{summary}</span>}
        </span>
        <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>{open?"▴":"▾"}</span>
      </button>
      {open && <div style={{ marginTop:10 }}>{children}</div>}
    </div>
  );
}

// 지금 적용된 필터를 보여주는 태그 (탭하면 해제)

export function SheetLayer({ onClose, children }) {
  if (typeof document === "undefined" || !document.body) return null;
  return createPortal(
    <div onClick={onClose} style={sheetBg}>{children}</div>,
    document.body
  );
}

// 실수로 지우는 걸 막는 2단계 삭제 버튼 — 한 번 누르면 확인 상태, 3초 뒤 자동 취소

export function ConfirmX({ onConfirm, label="삭제", size=15 }) {
  const [armed, setArmed] = useState(false);
  useEffect(()=>{
    if (!armed) return;
    const t = setTimeout(()=>setArmed(false), 3000);
    return ()=>clearTimeout(t);
  }, [armed]);
  if (armed) {
    return (
      <button onClick={(e)=>{ e.stopPropagation(); setArmed(false); onConfirm(); }}
        style={{ background:tint(C.danger,0.16), border:`1px solid ${C.danger}`, color:C.danger,
          borderRadius:8, padding:"4px 9px", cursor:"pointer", fontSize:10.5, fontWeight:800,
          whiteSpace:"nowrap", flexShrink:0 }}>
        {label}?
      </button>
    );
  }
  return (
    <button onClick={(e)=>{ e.stopPropagation(); setArmed(true); }} title={label}
      style={{ background:"none", border:"none", color:C.muted, fontSize:size, cursor:"pointer",
        padding:"0 3px", flexShrink:0, lineHeight:1 }}>×</button>
  );
}

export const lbl = { fontSize:13, fontWeight:800, color:C.muted };

export const inp = { padding:"11px 12px", background:C.surface2, border:`1px solid ${C.line}`, borderRadius:10, color:C.text, fontSize:14, outline:"none" };

export const primary = (color) => ({ padding:"12px", borderRadius:12, cursor:"pointer", border:"none", background:color, color:"#141519", fontSize:13.5, fontWeight:800 });

export const ghost = { padding:"12px 18px", borderRadius:12, cursor:"pointer", background:"transparent", border:`1px solid ${C.line}`, color:C.muted, fontSize:13.5, fontWeight:700 };

export const stepBtn = { width:28, height:28, borderRadius:8, cursor:"pointer", background:C.surface, border:`1px solid ${C.line}`, color:C.text, fontSize:16, fontWeight:700, lineHeight:1 };

export const xBtn = { width:26, height:26, borderRadius:8, cursor:"pointer", background:C.surface2, border:`1px solid ${C.line}`, color:C.muted, fontSize:15, lineHeight:1, flexShrink:0 };

export const chip = (on,color) => ({ padding:"8px 12px", borderRadius:999, cursor:"pointer", fontSize:12.5, fontWeight:700, border:`1.5px solid ${on?color:C.line}`, background:on?tint(color,0.18):C.surface2, color:C.text });

export const sheetBg = { position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:50 };
// 모바일 주소창을 감안해 dvh 사용. 헤더/푸터는 고정하고 가운데만 스크롤되도록 flex 컬럼 구성

export const sheet = { background:C.surface, width:"100%", maxWidth:460, borderTopLeftRadius:22, borderTopRightRadius:22,
  padding:"14px 18px 0", border:`1px solid ${C.line}`, borderBottom:"none",
  // 높이를 내용에 맡기면 안쪽 스크롤 영역이 0으로 찌그러져 내용이 안 보이는 일이 생긴다.
  // 최소 높이를 정해 두면 어떤 브라우저에서도 시트가 확실히 펼쳐진다.
  minHeight:"55dvh", maxHeight:"92dvh", display:"flex", flexDirection:"column", boxSizing:"border-box" };

export const grip = { width:38, height:4, borderRadius:2, background:C.line, margin:"0 auto 16px" };

// ================= 듣기 모드 화면 =================
// 걷거나 이동할 때 화면을 안 보고 듣기만 하는 용도.
// 항목마다 "영어(en-US) → 뜻(ko-KR)"을 순서대로 읽고 자동으로 다음으로 넘어간다.
export function ListenPlayer({ rows, accent, onClose, getSteps, renderItem }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.95);
  const [withMeaning, setWithMeaning] = useState(true);
  const [loop, setLoop] = useState(true);
  const spk = useRef(null);
  const idxRef = useRef(0);
  const acc = accent || "#8FD3FF";

  useEffect(()=>{ idxRef.current = idx; }, [idx]);

  const stop = () => {
    if (spk.current) { spk.current.stop(); spk.current = null; }
    setPlaying(false);
  };
  // 화면을 벗어나면 반드시 멈춘다. 안 그러면 다른 탭으로 가도 계속 읽는다.
  useEffect(()=>()=>stop(), []);

  const run = async (from) => {
    stop();
    const me = makeSpeaker();
    spk.current = me;
    setPlaying(true);
    let i = from;
    while (!me.dead) {
      if (i >= rows.length) {
        if (!loop) break;
        i = 0;
      }
      setIdx(i);
      const ok = await me.play(getSteps(rows[i], withMeaning), { rate });
      if (!ok) return;
      i += 1;
    }
    if (spk.current === me) { spk.current = null; setPlaying(false); }
  };

  const jump = (d) => {
    const n = ((idxRef.current + d) % rows.length + rows.length) % rows.length;
    setIdx(n);
    if (playing) run(n); else setIdx(n);
  };

  const cur = rows[Math.min(idx, rows.length-1)];
  if (!cur) return null;

  return (
    <div style={{ marginTop:11, padding:"14px", borderRadius:13, background:C.surface2,
      border:`1px solid ${tint(acc,0.4)}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <span style={{ fontSize:11.5, fontWeight:800, color:acc }}>🎧 듣기 모드</span>
        <div style={{ flex:1 }} />
        <span style={{ fontSize:11, color:C.muted, fontWeight:700 }}>{idx+1} / {rows.length}</span>
        <button onClick={()=>{ stop(); onClose(); }} style={{ background:"none", border:"none",
          color:C.muted, fontSize:15, cursor:"pointer", padding:"0 2px", lineHeight:1 }}>×</button>
      </div>

      <div style={{ height:3, background:C.surface, borderRadius:99, overflow:"hidden", marginBottom:12 }}>
        <div style={{ width:`${((idx+1)/rows.length)*100}%`, height:"100%", background:acc, transition:"width .25s" }} />
      </div>

      <div style={{ minHeight:64, display:"flex", flexDirection:"column", justifyContent:"center", gap:6 }}>
        {renderItem(cur)}
      </div>

      <div style={{ display:"flex", gap:7, marginTop:13 }}>
        <button onClick={()=>jump(-1)} style={{...ghost, flex:1, fontSize:16, padding:"11px 0"}}>⏮</button>
        <button onClick={()=> playing ? stop() : run(idx)}
          style={{...primary(acc), flex:2, fontSize:14, padding:"11px 0"}}>
          {playing ? "⏸ 일시정지" : "▶ 재생"}
        </button>
        <button onClick={()=>jump(1)} style={{...ghost, flex:1, fontSize:16, padding:"11px 0"}}>⏭</button>
      </div>

      <div style={{ display:"flex", gap:6, marginTop:9, flexWrap:"wrap" }}>
        <button onClick={()=>setWithMeaning(v=>!v)}
          style={{...chip(withMeaning, acc), padding:"5px 10px", fontSize:11}}>
          뜻도 읽기 {withMeaning?"✓":""}
        </button>
        <button onClick={()=>setLoop(v=>!v)}
          style={{...chip(loop, acc), padding:"5px 10px", fontSize:11}}>
          반복 {loop?"✓":""}
        </button>
        {[0.75, 0.95, 1.2].map(r=>(
          <button key={r} onClick={()=>{ setRate(r); if (playing) { setTimeout(()=>run(idxRef.current), 0); } }}
            style={{...chip(Math.abs(rate-r)<0.01, acc), padding:"5px 10px", fontSize:11}}>
            {r}x
          </button>
        ))}
      </div>

      <div style={{ fontSize:10, color:C.muted, marginTop:9, lineHeight:1.5 }}>
        화면을 꺼도 소리는 이어지지만, 브라우저가 절전으로 들어가면 멈출 수 있어요.
        {!hasKoreanVoice() && " 이 기기에 한국어 음성이 없어 뜻이 어색하게 읽힐 수 있어요."}
      </div>
    </div>
  );
}

