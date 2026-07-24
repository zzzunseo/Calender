import React, { useState, useEffect, useCallback, useRef } from "react";
import { lookupLocalFoods, localBrandSearch, makeCustomEntry, searchAllFoods, allCategories, servingLabel, displayCat, CATEGORIES, gramsPerServing } from "./foodDB.js";

// ================= 상수 =================
const TYPES = {
  push:  { label: "PUSH",  sub: "가슴·어깨·삼두", color: "#FF6B3D" },
  pull:  { label: "PULL",  sub: "등·이두",       color: "#35C4D8" },
  legs:  { label: "LEGS",  sub: "하체·복근",     color: "#B6E34B" },
  upper: { label: "상체",  sub: "가슴·등·어깨",   color: "#A97BFF" },
  lower: { label: "하체+팔", sub: "하체·팔 보완", color: "#FF5C8A" },
  custom:{ label: "직접선택", sub: "",            color: "#EDE9E0" },
  rest:  { label: "휴식",  sub: "",              color: "#565963" },
};
const PARTS = ["가슴", "가슴안쪽", "등", "어깨", "후면어깨", "하체", "둔근", "이두", "삼두", "복근"];
const CARDIO = {
  treadmill: { label: "트레드밀", color: "#FFC24B" },
  stairs:    { label: "천국의 계단", color: "#FF8C42" },
  running:   { label: "런닝머신", color: "#5AD1A0" },
};
const PRESET = { 1:"legs", 2:"push", 3:"pull", 4:"upper", 5:"legs", 6:"rest", 0:"rest" };
const WEEKDAYS = ["일","월","화","수","목","금","토"];
const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DEFAULT_SUBJECTS = ["토익", "자격증"];
// 토익 학습 영역 — 기록·점수를 파트 단위로 쪼개서 약점을 보이게 한다
const TOEIC_PARTS = [
  { k:"lc",  label:"LC",   desc:"Part 1~4", color:"#5AA9FF" },
  { k:"rc",  label:"RC",   desc:"Part 5~7", color:"#FFB74B" },
  { k:"voca",label:"어휘", desc:"단어·숙어", color:"#C9A6FF" },
  { k:"gram",label:"문법", desc:"교재 섹션", color:"#5AD1A0" },
];
const partInfo = (k)=> TOEIC_PARTS.find(p=>p.k===k) || null;

// 단어장 항목 종류
const VOCAB_TYPES = [
  { k:"word",    label:"단어",  icon:"📝", color:"#5AA9FF" },
  { k:"idiom",   label:"숙어",  icon:"🔗", color:"#C9A6FF" },
  { k:"grammar", label:"문법",  icon:"📐", color:"#5AD1A0" },
];
const vocabTypeInfo = (k)=> VOCAB_TYPES.find(t=>t.k===k) || VOCAB_TYPES[0];
// 품사 — 토익 Part 5에서 품사 구분이 자주 나오므로 단어마다 표시
const POS_LIST = [
  { k:"n",    label:"명사",   short:"n.",    color:"#5AA9FF" },
  { k:"v",    label:"동사",   short:"v.",    color:"#FF8C42" },
  { k:"adj",  label:"형용사", short:"adj.",  color:"#5AD1A0" },
  { k:"adv",  label:"부사",   short:"adv.",  color:"#C9A6FF" },
  { k:"prep", label:"전치사", short:"prep.", color:"#FFB74B" },
  { k:"conj", label:"접속사", short:"conj.", color:"#FF8FB0" },
];
const posInfo = (k)=> POS_LIST.find(p=>p.k===k) || null;
// 여러 표기를 내부 코드로 정규화 (adj / a / 형용사 → adj)
const normPos = (raw) => {
  const t = String(raw||"").trim().toLowerCase().replace(/[.()[\]]/g,"");
  if (!t) return "";
  const map = {
    n:"n", noun:"n", "명사":"n",
    v:"v", verb:"v", "동사":"v",
    a:"adj", adj:"adj", adjective:"adj", "형용사":"adj",
    ad:"adv", adv:"adv", adverb:"adv", "부사":"adv",
    prep:"prep", preposition:"prep", "전치사":"prep",
    conj:"conj", conjunction:"conj", "접속사":"conj",
  };
  return map[t] || "";
};

// "단어 / 뜻 / 품사" 형태의 여러 줄을 한 번에 파싱한다.
// 구분자는 탭, /, |, ,, -, : 를 지원하고, 없으면 첫 한글 위치에서 자른다(폰에서 띄어쓰기만 하고 넘기는 경우).
const parseVocabLines = (text) => {
  const out = [];
  for (const rawLine of String(text||"").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let parts = null;
    const m = line.split(/\s*[\t/|;:]\s*|\s+[-–—]\s+|\s*,\s*/).map(x=>x.trim()).filter(Boolean);
    if (m.length >= 2) parts = m;
    else {
      // 구분자가 없으면 첫 한글 글자 기준으로 앞=단어, 뒤=뜻
      const idx = line.search(/[가-힣]/);
      if (idx > 0) parts = [line.slice(0,idx).trim(), line.slice(idx).trim()];
      else parts = [line];
    }
    const term = parts[0];
    if (!term) continue;
    // 품사 후보를 뒤쪽 조각들에서 찾아낸다
    let pos = "", meaningParts = [];
    for (const seg of parts.slice(1)) {
      const p = normPos(seg);
      if (p && !pos) { pos = p; continue; }
      meaningParts.push(seg);
    }
    // 뜻 안에 "(adj)" 같은 표기가 섞인 경우도 뽑아낸다
    let meaning = meaningParts.join(", ");
    const inline = meaning.match(/\(([^)]+)\)/);
    if (!pos && inline) { const p = normPos(inline[1]); if (p) { pos = p; meaning = meaning.replace(inline[0], "").trim(); } }
    // 띄어쓰기로만 쓴 경우 끝에 붙은 품사를 떼어낸다 ("할당하다 v", "신속한 형용사")
    if (!pos) {
      const toks = meaning.split(/\s+/);
      if (toks.length >= 2) {
        const p = normPos(toks[toks.length-1]);
        if (p) { pos = p; meaning = toks.slice(0,-1).join(" "); }
      }
    }
    out.push({ term, meaning: meaning.replace(/^[,\s]+|[,\s]+$/g,""), pos });
  }
  return out;
};
// 숙련도 0~5. 복습에서 "알아요"면 +1, "헷갈려요"면 -1(최소 0)
const MASTER_LEVEL = 4;   // 이 이상이면 외운 것으로 본다
const isMastered = (v)=> num(v.level) >= MASTER_LEVEL;
// 몇 번 이상 틀리면 "자주 틀림"으로 자동 표시
const OFTEN_WRONG = 3;
const isOftenWrong = (v)=> num(v.wrong) >= OFTEN_WRONG;
// 복습 우선순위: 숙련도 낮을수록, 마지막 복습이 오래됐을수록 먼저
const reviewScore = (v) => {
  const lvl = num(v.level);
  const days = v.lastReview ? Math.max(0, Math.floor((Date.now()-new Date(v.lastReview+"T00:00:00").getTime())/86400000)) : 999;
  return (5-lvl)*10 + Math.min(days, 60);
};
const STUDY_ACCENT = "#7C9CFF";
const SLEEP_ACCENT = "#8FD3FF";
const MOODS = [
  { v:1, emoji:"😞", label:"별로", color:"#FF7A7A" },
  { v:2, emoji:"😐", label:"그냥", color:"#FF9F5A" },
  { v:3, emoji:"🙂", label:"괜찮음", color:"#FFC24B" },
  { v:4, emoji:"😊", label:"좋음", color:"#8FD3FF" },
  { v:5, emoji:"🤩", label:"최고", color:"#7DDB8A" },
];
const STUDY_PALETTE = ["#7C9CFF", "#FF9F6B", "#5AD1A0", "#E08CFF", "#FFD24B", "#4FC0D0"];
const ACTIVITY = [
  { k: 1.2,   label: "거의 없음" },
  { k: 1.375, label: "가벼움" },
  { k: 1.55,  label: "보통" },
  { k: 1.725, label: "많음" },
];

const C = {
  bg:"#141519", surface:"#1E2027", surface2:"#262932",
  line:"#31343E", text:"#F5F3EF", muted:"#8A8D98", amber:"#FFC24B", danger:"#FF7A7A",
};

// ================= 유틸 =================
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y,m,d) => `${y}-${pad(m+1)}-${pad(d)}`;
const todayKey = () => { const t = new Date(); return keyOf(t.getFullYear(), t.getMonth(), t.getDate()); };
const uid = () => Math.random().toString(36).slice(2, 9);
// 음식 항목들 중 liquidMl(수분량)을 합산해 "잔"(250ml) 단위로 환산. 술은 liquidMl 자체가 없어서 자동 제외됨.
const extraWater = (items) => {
  const ml = (items||[]).reduce((s,it)=> s + num(it.liquidMl), 0);
  return Math.round((ml/250)*10)/10;
};
const tint = (hex,a) => { const n=parseInt(hex.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; };
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const extractJSON = (raw) => {
  let s = String(raw).replace(/```json|```/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
};

// API 원본 에러(JSON 덩어리)를 사람이 읽을 수 있는 문구로 변환. 사용량 한도 초과를 특별히 인식.
const friendlyApiError = (rawText, fallbackMsg) => {
  if (/exceeded_limit/i.test(rawText)) {
    const m = rawText.match(/"resets_?[Aa]t"\s*:\s*(\d+)/);
    let when = "";
    if (m) { const d = new Date(parseInt(m[1], 10) * 1000); when = ` 대략 ${d.getHours()}시 ${String(d.getMinutes()).padStart(2, "0")}분쯤 다시 가능해요.`; }
    return `Claude 사용량 한도에 도달했어요.${when} 잠시 후 다시 시도해주세요.`;
  }
  return fallbackMsg;
};
const colorForSubject = (name) => { let h=0; for(const c of String(name)) h=(h*31+c.charCodeAt(0))>>>0; return STUDY_PALETTE[h % STUDY_PALETTE.length]; };
const fmtMin = (m) => { m=Math.round(m); const h=Math.floor(m/60), mm=m%60; if(!m) return "0분"; return `${h?`${h}시간`:""}${h&&mm?" ":""}${mm?`${mm}분`:""}`; };
const dowOf = (dk) => { const [y,m,d]=dk.split("-").map(Number); return new Date(y,m-1,d).getDay(); };
const last7 = () => [...Array(7)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return keyOf(d.getFullYear(),d.getMonth(),d.getDate()); });
// 오늘 기준 최근 n일의 날짜키 배열 (과거→오늘 순)
const lastNDays = (n) => [...Array(n)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(n-1-i)); return keyOf(d.getFullYear(),d.getMonth(),d.getDate()); });
// 운동한 날 판정: 운동 타입(밀기/당기기 등)을 안 골라도, 부위 세트·종목·대표운동 중 하나라도 있으면 운동한 날로 본다
const didWorkout = (e) => {
  if (!e) return false;
  if (e.type && e.type !== "rest") return true;
  if (e.partSets && Object.keys(e.partSets).some((p)=>num(e.partSets[p])>0)) return true;
  if (e.lifts && e.lifts.some((l)=>(l.sets||[]).length>0)) return true;
  if (e.mainLift && e.mainLift.name) return true;
  return false;
};
// 조건을 만족하는 날의 연속 기록: 현재 진행 중 연속(current)과 역대 최고(best)
const streakInfo = (schedule, checkFn) => {
  let current = 0;
  const base = new Date();
  if (checkFn(todayKey())) current++;
  for (let i=1;i<400;i++){ const dd=new Date(); dd.setDate(base.getDate()-i); const kk=keyOf(dd.getFullYear(),dd.getMonth(),dd.getDate()); if(checkFn(kk)) current++; else break; }
  const keys = Object.keys(schedule||{});
  if (!keys.length) return { current, best: current };
  const start = new Date(keys.sort()[0]+"T00:00:00");
  const end = new Date();
  let best=0, run=0;
  for (let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) {
    const kk = keyOf(d.getFullYear(), d.getMonth(), d.getDate());
    if (checkFn(kk)) { run++; if(run>best) best=run; } else run=0;
  }
  return { current, best: Math.max(best, current) };
};
// 기간 프리셋: 일간=오늘, 주간=최근7일, 월간=최근30일
const rangeDays = (range) => range==="day" ? [todayKey()] : range==="week" ? lastNDays(7) : lastNDays(30);
const rangeLabel = (range) => range==="day" ? "오늘" : range==="week" ? "최근 7일" : "최근 30일";
// 직전 동일 길이 기간 (주간이면 그 전 7일, 월간이면 그 전 30일, 일간이면 어제)
const prevRangeDays = (range) => {
  const n = range==="day" ? 1 : range==="week" ? 7 : 30;
  return [...Array(n)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(2*n-1-i)); return keyOf(d.getFullYear(),d.getMonth(),d.getDate()); });
};
const compareLabel = (range) => range==="day" ? "어제 대비" : range==="week" ? "지난주 대비" : "지난달 대비";
const emptyDay = () => ({ type:null, parts:[], cardio:null, foods:[], lifts:[], note:"", sleep:null, water:0, partSets:{}, mainLift:null, creatine:false, mood:null, diary:"", habitLog:{}, steps:0 });

const normalize = (d) => ({
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
});

const NUTRI_PROMPT = `아래는 사용자가 먹은 음식/보충제(프로틴 쉐이크 등) 설명이야.
각 항목의 단백질(g)과 칼로리(kcal)를 한국 일반 식품 기준으로 대략 추정해줘.
반드시 순수 JSON만 출력하고, 마크다운·코드블록·설명은 절대 넣지 마.
형식: {"items":[{"name":"항목명","protein":숫자,"carbs":숫자,"sugar":숫자,"fat":숫자,"kcal":숫자}]}
규칙: protein/carbs/sugar/fat 단위는 g, 모두 정수. sugar(당류)는 carbs(총 탄수화물)에 포함되므로 carbs보다 클 수 없음. 항목은 말한 단위/개수대로 분리, 양이 없으면 1인분 기준.
중요: 브랜드·프랜차이즈·특정 제품명(예: 교촌 허니콤보, 맘스터치 싸이버거, 스타벅스 라떼)이면 web_search로 공식/실제 영양정보를 먼저 찾아 반영해. 검색해도 없으면 그때만 추정. 검색 후에도 최종 답변은 JSON만 출력.
설명:
`;
const MENU_PROMPT = `사용자는 린메스업(근육 늘리기) 중이라 단백질은 높고 칼로리는 과하지 않으며 비교적 건강한 메뉴를 선호해.
음식점 이름이나 고민 중인 메뉴를 주면 그 안에서 목표에 더 나은 선택을 추천해줘.
반드시 순수 JSON만 출력 (마크다운·설명 없이):
{"picks":[{"name":"메뉴명","protein":숫자,"carbs":숫자,"sugar":숫자,"fat":숫자,"kcal":숫자,"rating":"best|good|caution","reason":"25자 내외"}],"tip":"한 줄 총평"}
규칙: picks 3~5개 추천순 정렬(best 위), protein/carbs/sugar/fat는 g 정수, 음식점명만 주면 대표메뉴 중 선택.
중요: 프랜차이즈·브랜드 메뉴는 web_search로 공식/실제 영양정보를 먼저 찾아 반영해. 검색 후에도 최종 답변은 JSON만 출력.
입력:
`;

const computeTDEE = (profile, weight) => {
  const h = num(profile.height), a = num(profile.age);
  if (!weight || !h || !a || !profile.sex) return null;
  const bmr = 10*weight + 6.25*h - 5*a + (profile.sex === "m" ? 5 : -161);
  return Math.round(bmr * (profile.activity || 1.375));
};

// 독립 배포 버전: Claude.ai 아티팩트 안에서만 되던 "키 없이 호출"이 아니라,
// 사용자 본인의 Anthropic API 키로 브라우저에서 직접 호출한다 (bring-your-own-key 방식).
// 몸 탭 > API 키 설정에 키를 넣어야 이 함수가 동작함.
async function callClaudeAPI(apiKey, prompt, opts = {}) {
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
const stepsToKcal = (steps, weight) => {
  const st = num(steps), w = num(weight) || 70;
  if (st <= 0) return 0;
  return Math.round(st * w * 0.00057);
};
// 하루 총 소모(유산소 + 걸음수)
const burnedKcal = (entry, weight) => {
  if (!entry) return 0;
  return (entry.cardio ? num(entry.cardio.kcal) : 0) + stepsToKcal(entry.steps, weight);
};

// 목표별 권장 탄단지 비율 (칼로리 기준 %)
const MACRO_GOALS = {
  lean:  { key:"lean",  label:"린매스업", desc:"근육 위주로 천천히", carb:45, protein:30, fat:25, color:"#B6E34B" },
  bulk:  { key:"bulk",  label:"벌크업",   desc:"체중 증량 우선",     carb:50, protein:25, fat:25, color:"#FF8C42" },
  cut:   { key:"cut",   label:"다이어트", desc:"체지방 감량",        carb:35, protein:40, fat:25, color:"#35C4D8" },
};

const macroTargets = (tdee, surplus, weight, proteinG) => {
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
const ALARM_OPTIONS = [
  { v:0,  label:"정시" }, { v:5, label:"5분 전" }, { v:10, label:"10분 전" },
  { v:30, label:"30분 전" }, { v:60, label:"1시간 전" }, { v:-1, label:"알림 없음" },
];
// "HH:MM" + 날짜키 → Date
const planDate = (dateKey, hhmm) => {
  const [y,m,d] = dateKey.split("-").map(Number);
  const [hh,mi] = (hhmm||"09:00").split(":").map(Number);
  return new Date(y, m-1, d, hh||0, mi||0, 0, 0);
};
const pad2 = (n)=>String(n).padStart(2,"0");
// 로컬시간 기준 iCal/구글 형식: YYYYMMDDTHHMMSS
const fmtLocalStamp = (dt) =>
  `${dt.getFullYear()}${pad2(dt.getMonth()+1)}${pad2(dt.getDate())}T${pad2(dt.getHours())}${pad2(dt.getMinutes())}00`;
const fmtUtcStamp = (dt) =>
  `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth()+1)}${pad2(dt.getUTCDate())}T${pad2(dt.getUTCHours())}${pad2(dt.getUTCMinutes())}${pad2(dt.getUTCSeconds())}Z`;
const planEndDate = (dateKey, p) => {
  const st = planDate(dateKey, p.start);
  if (p.end && p.end > p.start) return planDate(dateKey, p.end);
  return new Date(st.getTime() + 60*60*1000); // 종료 없으면 1시간
};
const icsEscape = (t)=> String(t||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n");

// 여러 일정을 하나의 .ics 파일 텍스트로. VALARM으로 기기 알림 시각을 지정한다.
const buildICS = (items) => {
  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//린메스업 트래커//KO","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
  const stamp = fmtUtcStamp(new Date());
  for (const { dateKey, plan } of items) {
    const st = planDate(dateKey, plan.start);
    const en = planEndDate(dateKey, plan);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${plan.id}@linmassup`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${fmtLocalStamp(st)}`);
    lines.push(`DTEND:${fmtLocalStamp(en)}`);
    lines.push(`SUMMARY:${icsEscape(plan.title)}`);
    if (plan.note) lines.push(`DESCRIPTION:${icsEscape(plan.note)}`);
    const al = num(plan.alarm);
    if (plan.alarm != null && al >= 0) {
      lines.push("BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${icsEscape(plan.title)}`,
        `TRIGGER:-PT${al}M`,"END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
};
// 구글 캘린더 미리채움 링크 (탭 한 번으로 저장 → 구글이 알림 담당)
const googleCalUrl = (dateKey, plan) => {
  const st = planDate(dateKey, plan.start), en = planEndDate(dateKey, plan);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";
  // dates의 구분자 "/"는 인코딩하지 않아야 구글이 확실히 인식한다
  const parts = [
    "action=TEMPLATE",
    `text=${encodeURIComponent(plan.title || "계획")}`,
    `dates=${fmtLocalStamp(st)}/${fmtLocalStamp(en)}`,
    `ctz=${tz}`,
  ];
  if (plan.note) parts.push(`details=${encodeURIComponent(plan.note)}`);
  return `https://calendar.google.com/calendar/render?${parts.join("&")}`;
};
// .ics 내려받기 / 공유
const downloadICS = (items, filename) => {
  const text = buildICS(items);
  const blob = new Blob([text], { type:"text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename || "plan.ics"; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
};

// ================= 메인 =================
export default function App() {
  const [tab, setTab] = useState("today");
  const [data, setData] = useState(normalize({}));
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | pending | saving | saved | error
  const saveQueue = React.useRef(Promise.resolve());
  const debounceTimer = React.useRef(null);
  const pendingPayload = React.useRef(null);

  useEffect(() => {
    (async () => {
      try {
        let main = null, bak = null;
        try { const r = await window.storage.get("gymapp_v1", false); if (r && r.value) main = JSON.parse(r.value); } catch(e) {}
        try { const b = await window.storage.get("gymapp_v1_bak", false); if (b && b.value) bak = JSON.parse(b.value); } catch(e) {}
        // 기본/백업 둘 다 있으면 저장 시각(updatedAt)이 더 최신인 쪽을 채택 — 저장 순서가 꼬여도 항상 최신 데이터를 씀
        let chosen = null;
        if (main && bak) chosen = (num(bak.updatedAt) > num(main.updatedAt)) ? bak : main;
        else chosen = main || bak;
        if (chosen) setData(normalize(chosen));
        else {
          const old = await window.storage.get("schedule", false).catch(()=>null);
          if (old && old.value) {
            const sched = JSON.parse(old.value);
            Object.keys(sched).forEach((k)=>{ const e=sched[k];
              if (typeof e.cardio==="number") e.cardio = e.cardio>0?{type:"treadmill",min:e.cardio,kcal:0}:null;
              if (!e.foods) e.foods=[]; if(!e.lifts) e.lifts=[]; });
            setData((d)=>normalize({ ...d, schedule: sched }));
          }
        }
      } catch(e) {} finally { setLoading(false); }
    })();
  }, []);

  // 실제 저장 실행: 요청을 한 줄로 직렬화(순서 보장) + 오프라인이면 대기, 온라인이면 점점 늘어나는 간격으로 재시도
  const lastPayload = React.useRef(null);
  const autoRetryTimer = React.useRef(null);
  const retryDelay = React.useRef(4000);

  const flushWrite = () => {
    const s = pendingPayload.current || lastPayload.current;
    if (!s) return;
    if (autoRetryTimer.current) { clearTimeout(autoRetryTimer.current); autoRetryTimer.current = null; }
    // 오프라인이면 시도 자체를 하지 않고 대기 — 실패 처리를 반복하지 않음. 연결되면 'online' 이벤트로 즉시 재시도
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      pendingPayload.current = null;
      lastPayload.current = s;
      setSaveStatus("offline");
      return;
    }
    pendingPayload.current = null;
    lastPayload.current = s;
    setSaveStatus("saving");
    const attempt = () => window.storage.set("gymapp_v1", s, false)
      .then(() => window.storage.set("gymapp_v1_bak", s, false))
      .then(() => { if (lastPayload.current === s) lastPayload.current = null; retryDelay.current = 4000; setSaveStatus("saved"); })
      .catch((e) => {
        console.error("저장 실패", e);
        setSaveStatus("error");
        // 짧은 간격으로 몰아치지 않게, 실패할 때마다 대기 시간을 늘려가며 재시도 (최대 30초)
        autoRetryTimer.current = setTimeout(flushWrite, retryDelay.current);
        retryDelay.current = Math.min(30000, retryDelay.current * 1.7);
      });
    saveQueue.current = saveQueue.current.then(attempt);
  };

  // 저장을 짧게 묶어서(디바운스) 실행: 키 입력마다 매번 통째 저장이 나가는 걸 막아
  // 요청 폭주로 인한 유실 가능성을 줄임. 화면 전환/이탈 시엔 즉시 flush.
  const save = (next) => {
    setSaveStatus("pending");
    pendingPayload.current = JSON.stringify({ ...next, updatedAt: Date.now() });
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(flushWrite, 450);
  };

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") { if (debounceTimer.current) clearTimeout(debounceTimer.current); flushWrite(); } };
    const onOnline = () => { retryDelay.current = 4000; flushWrite(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onHide);
    window.addEventListener("online", onOnline);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("beforeunload", onHide); window.removeEventListener("online", onOnline); if (autoRetryTimer.current) clearTimeout(autoRetryTimer.current); };
  }, []);

  const persist = useCallback((next) => { setData(next); save(next); }, []);
  const mutate = useCallback((fn) => { setData((prev)=>{ const next = fn(prev); save(next); return next; }); }, []);

  const updateDay = useCallback((dateKey, patch) => {
    mutate((prev)=>{
      const cur = prev.schedule[dateKey] || emptyDay();
      const nd = { ...cur, ...patch };
      const clean = nd.type || nd.cardio || (nd.foods&&nd.foods.length) || (nd.lifts&&nd.lifts.length) || nd.note || nd.sleep || nd.water || (nd.partSets&&Object.keys(nd.partSets).length) || nd.mainLift || nd.creatine || nd.mood || nd.diary || (nd.habitLog&&Object.keys(nd.habitLog).length);
      const schedule = { ...prev.schedule };
      if (clean) schedule[dateKey]=nd; else delete schedule[dateKey];
      return { ...prev, schedule };
    });
  }, [mutate]);

  const addFoodsToday = useCallback((items)=> mutate((prev)=>{
    const k=todayKey(); const cur=prev.schedule[k]||emptyDay();
    return { ...prev, schedule:{ ...prev.schedule, [k]:{ ...cur, foods:[...cur.foods, ...items], water:(cur.water||0)+extraWater(items) } } };
  }), [mutate]);

  const addFavorite = useCallback((item)=> mutate((prev)=>{
    if (prev.favorites.some((f)=>f.name===item.name)) return prev;
    return { ...prev, favorites:[...prev.favorites, { id:uid(), name:item.name, protein:num(item.protein), carbs:num(item.carbs), sugar:num(item.sugar), fat:num(item.fat), kcal:num(item.kcal), liquidMl:num(item.liquidMl) }] };
  }), [mutate]);
  const removeFavorite = useCallback((id)=> mutate((prev)=>({ ...prev, favorites: prev.favorites.filter((f)=>f.id!==id) })), [mutate]);

  const latestWeight = () => data.measurements.length ? [...data.measurements].sort((a,b)=>b.date.localeCompare(a.date))[0].weight : null;
  const proteinTarget = () => { const w=latestWeight(); return w?{ low:Math.round(w*1.6), high:Math.round(w*2.0) }:null; };

  if (loading) return <div style={{ background:C.bg,color:C.muted,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui" }}>불러오는 중…</div>;

  const favProps = { favorites:data.favorites, addFavorite, removeFavorite };

  return (
    <div style={{ background:`linear-gradient(180deg, #17181e 0%, ${C.bg} 220px)`, color:C.text, minHeight:"100vh", maxWidth:460, margin:"0 auto",
      fontFamily:"system-ui, -apple-system, sans-serif", paddingBottom:84, paddingTop:"env(safe-area-inset-top)" }}>
      <div key={tab} className="tab-content">
        {tab==="today" && <Today data={data} updateDay={updateDay} addFoodsToday={addFoodsToday} target={proteinTarget()} tdee={computeTDEE(data.profile, latestWeight())} weight={latestWeight()} favProps={favProps} apiKey={data.profile.apiKey} customFoods={data.customFoods} mutate={mutate} />}
        {tab==="calendar" && <Calendar data={data} persist={persist} updateDay={updateDay} favProps={favProps} apiKey={data.profile.apiKey} customFoods={data.customFoods} routines={data.routines} mutate={mutate} />}
        {tab==="foods" && <Foods addFoodsToday={addFoodsToday} apiKey={data.profile.apiKey} customFoods={data.customFoods} mutate={mutate} schedule={data.schedule} />}
        {tab==="study" && <Study data={data} persist={persist} mutate={mutate} />}
        {tab==="stats" && <Stats data={data} target={proteinTarget()} tdee={computeTDEE(data.profile, latestWeight())} weight={latestWeight()} />}
        {tab==="body" && <Body data={data} persist={persist} mutate={mutate} target={proteinTarget()} latestWeight={latestWeight()} tdee={computeTDEE(data.profile, latestWeight())} />}
      </div>
      <SaveBadge status={saveStatus} onRetry={flushWrite} />
      <TabBar tab={tab} setTab={setTab} />
    </div>
  );
}

function SaveBadge({ status, onRetry }) {
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
function Today({ data, updateDay, addFoodsToday, target, tdee, weight, favProps, apiKey, customFoods, mutate }) {
  const k = todayKey();
  const day = data.schedule[k] || emptyDay();
  const proteinSum = day.foods.reduce((s,f)=>s+num(f.protein),0);
  const carbsSum = day.foods.reduce((s,f)=>s+num(f.carbs),0);
  const sugarSum = day.foods.reduce((s,f)=>s+num(f.sugar),0);
  const fatSum = day.foods.reduce((s,f)=>s+num(f.fat),0);
  const kcalIn = day.foods.reduce((s,f)=>s+num(f.kcal),0);
  // 오늘 계획 (계획 캘린더와 같은 데이터)
  const todayPlans = [...((data.plans||{})[k]||[])].sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  const planDoneCount = todayPlans.filter(p=>p.done).length;
  const togglePlanDone = (id) => mutate((prev)=>{
    const np = { ...(prev.plans||{}) };
    const list = (np[k]||[]).map(p=> p.id===id ? { ...p, done: !p.done } : p);
    np[k] = list;
    return { ...prev, plans: np };
  });

  const stepsKcal = stepsToKcal(day.steps, weight);
  const kcalOut = (day.cardio ? num(day.cardio.kcal) : 0) + stepsKcal;
  const t = day.type ? TYPES[day.type] : null;
  const dt = new Date();

  const net = tdee!=null ? kcalIn - tdee - kcalOut : null; // + 잉여 / - 적자
  const surplus = num(data.profile.surplus);
  const mt = macroTargets(tdee, surplus, weight, target?target.high:null);

  // 최근 7일 단백질
  const days = last7();
  const proteinByDay = days.map((dk)=> (data.schedule[dk]?.foods||[]).reduce((s,f)=>s+num(f.protein),0));
  const sleepByDay = days.map((dk)=> num(data.schedule[dk]?.sleep?.hours));

  const pct = target ? Math.min(100, Math.round(proteinSum/target.high*100)) : 0;
  const studyToday = (data.study||[]).filter((s)=>s.date===k).reduce((a,s)=>a+s.minutes,0);

  // 이번 주 리포트
  const workoutDays = days.filter((dk)=> didWorkout(data.schedule[dk])).length;
  const cardioSessions = days.filter((dk)=> data.schedule[dk]?.cardio).length;
  const avgProtein = Math.round(proteinByDay.reduce((a,b)=>a+b,0)/7);
  const weekNets = days.map((dk)=>{
    const e = data.schedule[dk]; if(!e || tdee==null) return null;
    const inK = (e.foods||[]).reduce((s,f)=>s+num(f.kcal),0);
    const outK = e.cardio?num(e.cardio.kcal):0;
    return inK - tdee - outK;
  }).filter((v)=>v!=null);
  const avgNet = weekNets.length ? Math.round(weekNets.reduce((a,b)=>a+b,0)/weekNets.length) : null;
  const weekStudyMin = (data.study||[]).filter((s)=>days.includes(s.date)).reduce((a,s)=>a+s.minutes,0);
  const weekMeasures = [...data.measurements].filter((m)=>days.includes(m.date)).sort((a,b)=>a.date.localeCompare(b.date));
  const weightDiff = weekMeasures.length>=2 ? weekMeasures[weekMeasures.length-1].weight - weekMeasures[0].weight : null;

  const todaySleep = day.sleep;
  const [reportOpen, setReportOpen] = useState(false);

  // 스트릭: 어제부터 거슬러 올라가며 연속 달성일 계산 (오늘 달성 시 오늘 포함)
  const calcStreak = (checkFn) => {
    let streak = 0;
    const d = new Date();
    if (checkFn(todayKey())) streak++;
    for (let i=1; i<365; i++) {
      const dd = new Date(); dd.setDate(d.getDate()-i);
      const kk = keyOf(dd.getFullYear(), dd.getMonth(), dd.getDate());
      if (checkFn(kk)) streak++;
      else break;
    }
    return streak;
  };
  const proteinStreak = target ? calcStreak((kk)=>{
    const p = (data.schedule[kk]?.foods||[]).reduce((s,f)=>s+num(f.protein),0);
    return p >= target.low;
  }) : 0;
  const workoutStreak = calcStreak((kk)=> didWorkout(data.schedule[kk]));
  const creatineStreak = calcStreak((kk)=> !!data.schedule[kk]?.creatine);

  // 오늘 달성 점수 (마스코트/게이지용): 판정 가능한 항목의 달성 비율
  const scoreParts = [];
  if (target) scoreParts.push(proteinSum >= target.low);
  if (tdee!=null && day.foods.length) scoreParts.push(Math.abs(net-surplus) <= 250);
  scoreParts.push(didWorkout(day));
  if (mt) scoreParts.push(sugarSum <= mt.sugar);
  if (data.habits.length) scoreParts.push(Object.values(day.habitLog||{}).filter(Boolean).length === data.habits.length);
  const dayScore = scoreParts.length ? Math.round(scoreParts.filter(Boolean).length/scoreParts.length*100) : 0;
  const proteinPct = target ? Math.min(100, Math.round(proteinSum/target.low*100)) : 0;

  // 컨페티: 단백질 목표 첫 달성 or 모든 습관 완료 순간
  const [confettiKey, setConfettiKey] = useState(0);
  const proteinMet = target && proteinSum >= target.low;
  const allHabits = data.habits.length>0 && Object.values(day.habitLog||{}).filter(Boolean).length === data.habits.length;
  const celebrate = proteinMet || allHabits;
  const prevCelebRef = useRef(celebrate);
  useEffect(()=>{
    if (celebrate && !prevCelebRef.current) setConfettiKey((n)=>n+1);
    prevCelebRef.current = celebrate;
  }, [celebrate]);

  return (
    <div style={{ padding:"22px 18px 8px" }}>
      <Confetti fire={confettiKey} />
      <div style={{ fontSize:11, letterSpacing:3, color:TYPES.push.color, fontWeight:800 }}>TODAY</div>
      <div style={{ fontSize:30, fontWeight:800, letterSpacing:-1, marginTop:4 }}>
        {dt.getMonth()+1}월 {dt.getDate()}일 <span style={{ fontSize:15, color:C.muted }}>{WEEKDAYS[dt.getDay()]}</span>
      </div>
      {(proteinStreak>=2 || workoutStreak>=2) && (
        <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
          {proteinStreak>=2 && <span style={{ fontSize:11.5, fontWeight:800, color:TYPES.legs.color, background:tint(TYPES.legs.color,0.13), border:`1px solid ${tint(TYPES.legs.color,0.4)}`, borderRadius:999, padding:"5px 11px" }}>🔥 단백질 목표 {proteinStreak}일 연속</span>}
          {workoutStreak>=2 && <span style={{ fontSize:11.5, fontWeight:800, color:TYPES.push.color, background:tint(TYPES.push.color,0.13), border:`1px solid ${tint(TYPES.push.color,0.4)}`, borderRadius:999, padding:"5px 11px" }}>💪 운동 {workoutStreak}일 연속</span>}
        </div>
      )}

      {/* 마스코트 */}
      <GlassCard glow={dayScore>=80?"#7DDB8A":dayScore>=50?"#8FD3FF":dayScore>=1?"#FFC24B":null}>
        <Mascot score={dayScore} proteinPct={proteinPct} workedOut={didWorkout(day)} />
      </GlassCard>

      {/* 오늘 계획 */}
      {todayPlans.length>0 && (
        <Card>
          <Row><span style={lbl}>오늘 계획</span>
            <span style={{ fontSize:11.5, color: planDoneCount===todayPlans.length?TYPES.legs.color:C.muted, fontWeight:700 }}>
              {planDoneCount}/{todayPlans.length} 완료{planDoneCount===todayPlans.length?" 🎉":""}
            </span>
          </Row>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:10 }}>
            {todayPlans.map((p)=>{
              const done = !!p.done;
              const now = new Date();
              const st = planDate(k, p.start);
              const soon = !done && st>now && (st-now) < 2*60*60*1000;
              const past = !done && st<now;
              return (
                <div key={p.id} onClick={()=>togglePlanDone(p.id)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:11, cursor:"pointer",
                    background: done?tint(TYPES.legs.color,0.1):C.surface2,
                    border:`1px solid ${done?tint(TYPES.legs.color,0.4):soon?tint(STUDY_ACCENT,0.45):C.line}`, transition:"all .2s" }}>
                  <div style={{ width:21, height:21, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                    background: done?TYPES.legs.color:"transparent", border:`2px solid ${done?TYPES.legs.color:C.muted}`,
                    color:"#141519", fontSize:12, fontWeight:900 }}>{done?"✓":""}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:800, color: done?C.muted:C.text,
                      textDecoration: done?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                    <div style={{ fontSize:10.5, color: soon?STUDY_ACCENT:C.muted, marginTop:2, fontWeight: soon?700:400 }}>
                      {p.start}{p.end?`~${p.end}`:""}{soon?" · 곧 시작":past?" · 지난 일정":""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 칼로리 판정 */}
      <Card>
        <Row><span style={lbl}>칼로리 밸런스</span>
          {tdee!=null && <span style={{ fontSize:12, color:C.muted }}>유지 {tdee}kcal</span>}
        </Row>
        {tdee==null ? (
          <div style={{ color:C.muted, fontSize:13, marginTop:6 }}>몸 탭에서 키·나이·성별을 입력하면 잉여/적자를 계산해줘요.</div>
        ) : (
          <>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:4 }}>
              <span style={{ fontSize:30, fontWeight:800, color: net>=0?TYPES.legs.color:C.danger }}>
                {net>=0?"+":""}<CountUp value={net} />
              </span>
              <span style={{ fontSize:15, color:C.muted }}>kcal · {net>=0?"잉여":"적자"}</span>
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>
              섭취 {kcalIn} · 소모 {kcalOut} · 목표 잉여 {surplus>=0?"+":""}{surplus}
              {" · "}
              <span style={{ color: net>=surplus?TYPES.legs.color:C.amber }}>
                {net>=surplus ? "목표 달성" : `목표까지 ${surplus-net}kcal`}
              </span>
            </div>
          </>
        )}

        {/* 걸음수 → 소모 칼로리 */}
        <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.line}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
            <span style={{ fontSize:12, fontWeight:800, color:C.muted }}>🚶 걸음수</span>
            {stepsKcal>0 && <span style={{ fontSize:12, fontWeight:800, color:"#5AD1A0" }}>≈ {stepsKcal}kcal 소모</span>}
          </div>
          <div style={{ display:"flex", gap:7, alignItems:"center" }}>
            <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"center", background:C.surface2, borderRadius:10, padding:"0 12px" }}>
              <input value={day.steps ? String(day.steps) : ""} onChange={(e)=>updateDay(k,{steps:Math.max(0,Math.min(100000,Math.round(num(e.target.value.replace(/[^0-9]/g,"")))))})}
                inputMode="numeric" placeholder="0"
                style={{ flex:1, minWidth:0, background:"none", border:"none", outline:"none", color:C.text, fontSize:19, fontWeight:800, padding:"11px 0" }} />
              <span style={{ fontSize:12, color:C.muted, fontWeight:700 }}>보</span>
            </div>
            <div style={{ display:"flex", gap:5 }}>
              {[1000,3000,5000].map((n)=>(
                <button key={n} onClick={()=>updateDay(k,{steps:(num(day.steps)||0)+n})}
                  style={{...chip(false,"#5AD1A0"), padding:"9px 9px", fontSize:11.5}}>+{n/1000}천</button>
              ))}
            </div>
          </div>
          {day.steps>0 ? (
            <div style={{ fontSize:10.5, color:C.muted, marginTop:7, lineHeight:1.5 }}>
              {weight?`체중 ${weight}kg`:"체중 70kg 가정"} 기준 걷기 소모량이에요. 위 칼로리 밸런스에 이미 반영돼 있어요.
              <button onClick={()=>updateDay(k,{steps:0})} style={{ background:"none", border:"none", color:C.danger, fontSize:10.5, fontWeight:700, cursor:"pointer", padding:"0 0 0 6px" }}>지우기</button>
            </div>
          ) : (
            <div style={{ fontSize:10.5, color:C.muted, marginTop:7, lineHeight:1.5 }}>
              휴대폰 건강앱의 걸음수를 입력하면 소모 칼로리로 자동 계산돼요.
            </div>
          )}
        </div>
      </Card>

      {/* 영양 */}
      <Card>
        <Row><span style={lbl}>영양</span>
          <span style={{ fontSize:13, color:C.muted }}>{target?`단백질 목표 ${target.low}~${target.high}g`:"몸무게 입력 필요"}</span>
        </Row>
        <div style={{ fontSize:30, fontWeight:800, marginTop:2 }}><CountUp value={proteinSum} /><span style={{ fontSize:15, color:C.muted }}>g 단백질</span></div>
        <div style={{ height:8, background:C.surface2, borderRadius:99, marginTop:8, overflow:"hidden" }}>
          <div style={{ width:`${pct}%`, height:"100%", background:TYPES.legs.color, borderRadius:99, transition:"width .3s" }} />
        </div>
        <NutriRow label="탄수화물" value={carbsSum} target={mt?mt.carb:null} color="#5AA9FF" overType="soft" />
        <NutriRow label="지방" value={fatSum} target={mt?mt.fat:null} color="#FFB74B" overType="soft" />
        <NutriRow label="당류" value={sugarSum} target={mt?mt.sugar:null} color="#FF8FB0" overType="hard" capLabel="상한" />

        {/* 탄단지 비율 */}
        <MacroRatio carbs={carbsSum} protein={proteinSum} fat={fatSum}
          goal={MACRO_GOALS[data.profile.macroGoal] || MACRO_GOALS.lean} />

        <div style={{ fontSize:11, color:C.muted, margin:"16px 0 4px" }}>최근 7일 단백질</div>
        <Bars7 values={proteinByDay} color={TYPES.legs.color} target={target?target.low:null} suffix="g" />
      </Card>

      {/* 식단 */}
      <Card>
        <Row><span style={lbl}>먹은 음식</span></Row>
        <FoodSection foods={day.foods}
          addFoods={(items)=>updateDay(k,{foods:[...day.foods, ...items], water:(day.water||0)+extraWater(items)})}
          removeFood={(id)=>updateDay(k,{foods:day.foods.filter(f=>f.id!==id)})}
          updateFood={(id,patch)=>updateDay(k,{foods:day.foods.map(f=>f.id===id?{...f,...patch}:f)})}
          apiKey={apiKey} customFoods={customFoods}
          {...favProps} />
      </Card>

      {/* 물 섭취 */}
      <Card>
        <Row><span style={lbl}>물</span>
          <span style={{ fontSize:12, color:C.muted }}>1잔 = 250ml</span>
        </Row>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:8 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontSize:26, fontWeight:800, color:"#6BC5F0" }}>{((day.water||0)*0.25).toFixed(2).replace(/\.?0+$/,"")}L</span>
            <span style={{ fontSize:13, color:C.muted }}>{day.water||0}잔</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>updateDay(k,{water:Math.max(0,(day.water||0)-1)})} style={{...stepBtn, width:38, height:38, fontSize:18}}>–</button>
            <button onClick={()=>updateDay(k,{water:(day.water||0)+1})} style={{...primary("#6BC5F0"), width:64, padding:"0"}}>+1잔</button>
          </div>
        </div>
        <div style={{ display:"flex", gap:4, marginTop:10 }}>
          {[...Array(8)].map((_,i)=>(
            <div key={i} style={{ flex:1, height:6, borderRadius:99, background:(day.water||0)>i?"#6BC5F0":C.surface2, transition:"background .25s" }} />
          ))}
        </div>
        {/* 크레아틴 체크 */}
        <div onClick={()=>updateDay(k,{creatine:!day.creatine})} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          marginTop:12, padding:"11px 13px", borderRadius:12, cursor:"pointer", transition:"all .25s",
          background: day.creatine ? tint("#C9A6FF",0.13) : C.surface2,
          border:`1.5px solid ${day.creatine ? "#C9A6FF" : C.line}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <span style={{ fontSize:17 }}>💊</span>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color: day.creatine ? "#C9A6FF" : C.text }}>크레아틴</div>
              {creatineStreak>=2 && <div style={{ fontSize:10.5, color:C.muted, marginTop:1 }}>{creatineStreak}일 연속 복용 중</div>}
            </div>
          </div>
          <div style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
            background: day.creatine ? "#C9A6FF" : "transparent", border:`2px solid ${day.creatine ? "#C9A6FF" : C.muted}`,
            color:"#141519", fontSize:14, fontWeight:900, transition:"all .25s" }}>{day.creatine ? "✓" : ""}</div>
        </div>
      </Card>

      {/* 오늘 운동 / 공부 */}
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <MiniCard label="오늘 운동"
            value={ t ? (day.type==="custom"&&day.parts.length?day.parts.join("·"):t.label)
                  : Object.keys(day.partSets||{}).length>0 ? `${Object.values(day.partSets).reduce((s,v)=>s+num(v),0)}세트`
                  : day.mainLift?.name ? day.mainLift.name : "미설정" }
            unit="" color={ t ? t.color : didWorkout(day) ? TYPES.push.color : C.muted } />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <MiniCard label="오늘 공부" value={studyToday?fmtMin(studyToday):"0분"} unit="" color={STUDY_ACCENT} />
        </div>
      </div>
      {(day.cardio || day.lifts.length>0 || Object.keys(day.partSets||{}).length>0) && (
        <Card>
          {day.cardio && <div style={{ fontSize:13, color:CARDIO[day.cardio.type].color, fontWeight:700 }}>
            유산소 · {CARDIO[day.cardio.type].label} {day.cardio.min}분 {num(day.cardio.kcal)>0?`· ${num(day.cardio.kcal)}kcal`:""}</div>}
          {Object.keys(day.partSets||{}).length>0 && (
            <div style={{ fontSize:13, marginTop:day.cardio?6:0 }}>
              <b style={{ color:TYPES.push.color }}>부위</b>{" "}
              <span style={{ color:C.muted }}>{Object.entries(day.partSets).map(([p,s])=>`${p} ${s}세트`).join(" · ")}</span>
            </div>
          )}
          {day.lifts.map((l)=>(
            <div key={l.id} style={{ fontSize:13, marginTop:6 }}>
              <b>{l.name}</b> <span style={{ color:C.muted }}>{l.sets.map((s)=>`${s.w}×${s.r}`).join(", ")}</span>
            </div>
          ))}
        </Card>
      )}

      {/* 퀵 운동 기록 */}
      <Card>
        <Row><span style={lbl}>퀵 운동 기록</span>
          {day.mainLift?.name && <span style={{ fontSize:12, color:TYPES.push.color, fontWeight:700 }}>{day.mainLift.name} {day.mainLift.w}kg×{day.mainLift.r}</span>}
        </Row>
        <div style={{ marginTop:10 }}>
          <QuickWorkoutBlock partSets={day.partSets} mainLift={day.mainLift}
            onChangePartSets={(v)=>updateDay(k,{partSets:v})}
            onChangeMainLift={(v)=>updateDay(k,{mainLift:v})} />
        </div>
        {day.mainLift?.name && (()=>{
          const hist = mainLiftHistory(data.schedule, day.mainLift.name);
          return hist.length>=2 ? (<>
            <div style={{ fontSize:11, color:C.muted, margin:"14px 0 2px" }}>{day.mainLift.name} 추이</div>
            <LineChart points={hist} color={TYPES.push.color} unit="kg" />
          </>) : null;
        })()}
      </Card>

      {/* 수면 · 컨디션 */}
      <Card>
        <Row><span style={lbl}>수면 · 컨디션</span>
          {todaySleep?.condition && <span style={{ fontSize:12, color:SLEEP_ACCENT, fontWeight:700 }}>{CONDITION_LABELS[todaySleep.condition]}</span>}
        </Row>
        <SleepBlock value={todaySleep} onChange={(v)=>updateDay(k,{sleep:v})} />
        <div style={{ fontSize:11, color:C.muted, margin:"14px 0 4px" }}>최근 7일 수면</div>
        <Bars7 values={sleepByDay} color={SLEEP_ACCENT} />
      </Card>

      {/* 기분 */}
      <Card>
        <Row><span style={lbl}>오늘 기분</span>
          {day.mood && <span style={{ fontSize:12, color:C.muted }}>{MOODS.find(m=>m.v===day.mood)?.label}</span>}
        </Row>
        <div style={{ display:"flex", gap:6, marginTop:10 }}>
          {MOODS.map((m)=>(
            <button key={m.v} onClick={()=>updateDay(k,{mood: day.mood===m.v?null:m.v})} style={{
              flex:1, padding:"10px 0", borderRadius:12, cursor:"pointer", transition:"all .2s",
              border:`1.5px solid ${day.mood===m.v?m.color:C.line}`,
              background: day.mood===m.v?tint(m.color,0.15):C.surface2,
              display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <span style={{ fontSize:22, filter:day.mood===m.v?"none":"grayscale(0.4)" }}>{m.emoji}</span>
              <span style={{ fontSize:9.5, color:day.mood===m.v?m.color:C.muted, fontWeight:700 }}>{m.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* 습관 트래커 */}
      <Card>
        <Row><span style={lbl}>습관</span>
          {data.habits.length>0 && <span style={{ fontSize:12, color:C.muted }}>{Object.values(day.habitLog||{}).filter(Boolean).length}/{data.habits.length} 완료</span>}
        </Row>
        <HabitTracker habits={data.habits} log={day.habitLog||{}}
          onToggle={(id)=>updateDay(k,{ habitLog:{ ...(day.habitLog||{}), [id]: !(day.habitLog||{})[id] } })}
          onAddHabit={(name,emoji)=>mutate((prev)=>({ ...prev, habits:[...prev.habits, { id:uid(), name, emoji }] }))}
          onRemoveHabit={(id)=>mutate((prev)=>({ ...prev, habits:prev.habits.filter(h=>h.id!==id) }))} />
      </Card>

      {/* 한 줄 일기 */}
      <Card>
        <Row><span style={lbl}>한 줄 일기</span></Row>
        <textarea value={day.diary||""} onChange={(e)=>updateDay(k,{diary:e.target.value})} rows={2}
          placeholder="오늘 하루 어땠나요? 기록해두면 나중에 돌아보기 좋아요."
          style={{...inp, width:"100%", boxSizing:"border-box", resize:"none", lineHeight:1.5, marginTop:10, fontFamily:"inherit"}} />
      </Card>

      {/* 이번 주 리포트 (접이식) */}
      <Card>
        <div onClick={()=>setReportOpen((v)=>!v)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
          <span style={lbl}>이번 주 리포트</span>
          <span style={{ fontSize:14, color:C.muted, transform:reportOpen?"rotate(180deg)":"none", transition:"transform .2s" }}>▾</span>
        </div>
        {reportOpen && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginTop:12 }}>
            <ReportItem label="운동일" value={`${workoutDays}/7`} color={TYPES.legs.color} />
            <ReportItem label="유산소" value={`${cardioSessions}회`} color={C.amber} />
            <ReportItem label="평균 단백질" value={`${avgProtein}g`} color={TYPES.legs.color} />
            <ReportItem label="평균 칼로리" value={avgNet!=null?`${avgNet>=0?"+":""}${avgNet}`:"—"} color={avgNet!=null&&avgNet>=0?TYPES.legs.color:C.danger} />
            <ReportItem label="공부시간" value={fmtMin(weekStudyMin)} color={STUDY_ACCENT} />
            <ReportItem label="체중 변화" value={weightDiff!=null?`${weightDiff>=0?"+":""}${weightDiff.toFixed(1)}kg`:"—"} color={weightDiff!=null&&weightDiff>=0?TYPES.push.color:TYPES.pull.color} />
          </div>
        )}
      </Card>
    </div>
  );
}

// ================= 캘린더 =================
// 캘린더 셀에 겹쳐 보여줄 지표
const METRICS = {
  none:   { label:"표시 안 함", color:C.muted },
  kcalIn: { label:"먹은 kcal",  color:"#FF8FB0" },
  burn:   { label:"소모 kcal",  color:"#5AD1A0" },
  water:  { label:"물",         color:"#6BC5F0" },
};
const cellMetric = (e, metric, weight) => {
  if (!e || metric==="none") return null;
  if (metric==="kcalIn") { const v=(e.foods||[]).reduce((s,f)=>s+num(f.kcal),0); return v>0?`${v}`:null; }
  if (metric==="burn")   { const v=burnedKcal(e, weight); return v>0?`${v}`:null; }
  if (metric==="water")  { const v=num(e.water); return v>0?`${(v*0.25).toFixed(2).replace(/\.?0+$/,"")}L`:null; }
  return null;
};

// 월 이동 헤더 (제목 탭 → 연·월 선택, 오늘 버튼) — 기록/계획 모드 공용
function MonthNav({ view, setView, accent, right }) {
  const [pickOpen, setPickOpen] = useState(false);
  const today = new Date();
  const isThisMonth = view.y===today.getFullYear() && view.m===today.getMonth();
  const move = (d)=>{ let m=view.m+d, y=view.y; if(m<0){m=11;y--;} else if(m>11){m=0;y++;} setView({y,m}); };
  return (
    <div style={{ padding:"14px 18px 10px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <button onClick={()=>setPickOpen(true)} style={{ background:"none", border:"none", padding:0, cursor:"pointer",
          display:"flex", alignItems:"baseline", gap:8, minWidth:0 }}>
          <span style={{ fontSize:27, fontWeight:800, letterSpacing:-1, color:C.text }}>{MONTHS[view.m]}</span>
          <span style={{ fontSize:14, color:C.muted, fontWeight:600 }}>{view.y}</span>
          <span style={{ fontSize:11, color:accent }}>▾</span>
        </button>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
          {!isThisMonth && (
            <button onClick={()=>setView({ y:today.getFullYear(), m:today.getMonth() })}
              style={{ background:tint(accent,0.14), border:`1px solid ${tint(accent,0.45)}`, color:accent,
                borderRadius:999, padding:"6px 12px", fontSize:11.5, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap" }}>오늘</button>
          )}
          <button onClick={()=>move(-1)} style={navBtn}>‹</button>
          <button onClick={()=>move(1)} style={navBtn}>›</button>
          {right}
        </div>
      </div>

      {pickOpen && (
        <div onClick={()=>setPickOpen(false)} style={sheetBg}>
          <div onClick={(e)=>e.stopPropagation()} style={{...sheet, maxHeight:"none", paddingBottom:"calc(18px + env(safe-area-inset-bottom))"}}>
            <div style={grip} />
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <button onClick={()=>setView({ ...view, y:view.y-1 })} style={navBtn}>‹</button>
              <span style={{ fontSize:19, fontWeight:800 }}>{view.y}년</span>
              <button onClick={()=>setView({ ...view, y:view.y+1 })} style={navBtn}>›</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:7 }}>
              {MONTHS.map((mm,i)=>{
                const on = view.m===i;
                const cur = view.y===today.getFullYear() && i===today.getMonth();
                return (
                  <button key={mm} onClick={()=>{ setView({ ...view, m:i }); setPickOpen(false); }}
                    style={{ padding:"12px 0", borderRadius:10, cursor:"pointer", fontSize:13, fontWeight:800,
                      border:`1.5px solid ${on?accent:cur?tint(accent,0.5):C.line}`,
                      background: on?tint(accent,0.16):C.surface2, color: on?accent:C.text }}>{mm}</button>
                );
              })}
            </div>
            <button onClick={()=>{ setView({ y:today.getFullYear(), m:today.getMonth() }); setPickOpen(false); }}
              style={{...primary(accent), width:"100%", marginTop:14}}>이번 달로 이동</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 계획 편집 시트
function PlanEditor({ dateKey, list, onSave, onClose, onShare }) {
  const [items, setItems] = useState(()=>list.map(p=>({...p})));
  const [draft, setDraft] = useState({ title:"", start:"09:00", end:"10:00", alarm:10, note:"" });
  const add = () => {
    if (!draft.title.trim()) return;
    setItems((l)=>[...l, { ...draft, id:uid(), title:draft.title.trim() }]
      .sort((a,b)=>String(a.start).localeCompare(String(b.start))));
    setDraft({ title:"", start:draft.start, end:draft.end, alarm:draft.alarm, note:"" });
  };
  const remove = (id)=> setItems((l)=>l.filter(x=>x.id!==id));
  const save = ()=>{ onSave(items); onClose(); };
  const dow = WEEKDAYS[new Date(dateKey+"T00:00:00").getDay()];

  return (
    <div onClick={save} style={sheetBg}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink:0 }}>
          <div style={grip} />
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontSize:15, fontWeight:800 }}>{dateKey.replace(/-/g,".")} ({dow})</span>
            <span style={{ fontSize:11, color:C.muted }}>계획 {items.length}개</span>
          </div>
        </div>

        <div style={{ flex:1, minHeight:0, overflowY:"auto", paddingRight:2, overscrollBehavior:"contain" }}>
          {/* 등록된 계획 */}
          {items.length>0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:16 }}>
              {items.map((p)=>(
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:9, background:C.surface2, borderRadius:11, padding:"10px 12px" }}>
                  <div style={{ width:3, alignSelf:"stretch", borderRadius:99, background:STUDY_ACCENT }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                    <div style={{ fontSize:10.5, color:C.muted, marginTop:2 }}>
                      {p.start}{p.end?` ~ ${p.end}`:""}
                      {p.alarm!=null && num(p.alarm)>=0 ? ` · 🔔 ${ALARM_OPTIONS.find(a=>a.v===num(p.alarm))?.label||""}` : " · 알림 없음"}
                    </div>
                    {p.note && <div style={{ fontSize:10.5, color:C.muted, marginTop:3 }}>{p.note}</div>}
                  </div>
                  <button onClick={()=>onShare([{dateKey, plan:p}], p.title)} title="휴대폰 캘린더에 추가"
                    style={{ background:"none", border:`1px solid ${tint(STUDY_ACCENT,0.45)}`, color:STUDY_ACCENT,
                      borderRadius:8, padding:"6px 8px", cursor:"pointer", fontSize:12, flexShrink:0 }}>📲</button>
                  <button onClick={()=>remove(p.id)} style={{ background:"none", border:"none", color:C.muted, fontSize:17, cursor:"pointer", padding:"0 2px", flexShrink:0 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* 새 계획 */}
          <div style={{ fontSize:11.5, color:C.muted, fontWeight:800, marginBottom:8 }}>새 계획 추가</div>
          <input value={draft.title} onChange={(e)=>setDraft({...draft, title:e.target.value})}
            placeholder="무엇을 할 건가요? (예: 헬스장 등·이두)" style={{...inp, width:"100%", boxSizing:"border-box"}} />
          <div style={{ display:"flex", gap:7, marginTop:8, alignItems:"center" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>시작</div>
              <input type="time" value={draft.start} onChange={(e)=>setDraft({...draft, start:e.target.value})}
                style={{...inp, width:"100%", boxSizing:"border-box", padding:"10px"}} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>종료</div>
              <input type="time" value={draft.end} onChange={(e)=>setDraft({...draft, end:e.target.value})}
                style={{...inp, width:"100%", boxSizing:"border-box", padding:"10px"}} />
            </div>
          </div>
          <div style={{ fontSize:10, color:C.muted, margin:"12px 0 6px" }}>알림</div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {ALARM_OPTIONS.map((a)=>(
              <button key={a.v} onClick={()=>setDraft({...draft, alarm:a.v})}
                style={{...chip(num(draft.alarm)===a.v, STUDY_ACCENT), padding:"6px 10px", fontSize:11.5}}>{a.label}</button>
            ))}
          </div>
          <input value={draft.note} onChange={(e)=>setDraft({...draft, note:e.target.value})}
            placeholder="메모 (선택)" style={{...inp, width:"100%", boxSizing:"border-box", marginTop:10}} />
          <button onClick={add} disabled={!draft.title.trim()}
            style={{...primary(STUDY_ACCENT), width:"100%", marginTop:10, opacity:draft.title.trim()?1:0.45}}>+ 계획 추가</button>

          {items.length>0 && (
            <button onClick={()=>onShare(items.map(p=>({dateKey, plan:p})), `${dateKey.slice(5).replace("-",".")} 계획 ${items.length}개`)}
              style={{...ghost, width:"100%", marginTop:8}}>📲 이 날 계획 휴대폰 캘린더에 넣기</button>
          )}
          <div style={{ height:8 }} />
        </div>

        <div style={{ flexShrink:0, display:"flex", gap:8, padding:"12px 0 calc(14px + env(safe-area-inset-bottom))",
          borderTop:`1px solid ${C.line}`, background:C.surface }}>
          <button onClick={save} style={{...primary(TYPES.legs.color), flex:1}}>저장</button>
        </div>
      </div>
    </div>
  );
}

// 휴대폰 캘린더로 넘기기 시트
function PlanShareSheet({ target, onClose }) {
  const { items, label } = target;
  const single = items.length===1 ? items[0] : null;
  const [msg, setMsg] = useState("");
  const doDownload = () => {
    try { downloadICS(items, `linmassup-plan.ics`); setMsg("파일을 내려받았어요. 알림 창이나 '파일' 앱에서 열면 캘린더 앱으로 들어가요."); }
    catch(e){ setMsg("내려받기가 막혔어요. 아래 구글 캘린더 방법을 써보세요."); }
  };
  const doShare = async () => {
    try {
      const file = new File([buildICS(items)], "linmassup-plan.ics", { type:"text/calendar" });
      if (navigator.canShare && navigator.canShare({ files:[file] })) {
        await navigator.share({ files:[file], title:label });
        setMsg("공유 창에서 캘린더 앱을 고르면 등록돼요."); return;
      }
    } catch(e){}
    doDownload();
  };
  return (
    <div onClick={onClose} style={sheetBg}>
      <div onClick={(e)=>e.stopPropagation()} style={{...sheet, maxHeight:"none", paddingBottom:"calc(18px + env(safe-area-inset-bottom))"}}>
        <div style={grip} />
        <div style={{ fontSize:16, fontWeight:800 }}>휴대폰 캘린더에 넣기</div>
        <div style={{ fontSize:11.5, color:C.muted, marginTop:5 }}>{label}</div>

        <div style={{ marginTop:12, padding:"11px 12px", borderRadius:10, background:tint(STUDY_ACCENT,0.1), border:`1px solid ${tint(STUDY_ACCENT,0.35)}` }}>
          <div style={{ fontSize:11.5, color:C.muted, lineHeight:1.6 }}>
            웹앱은 직접 알람을 울릴 수 없어서, <b style={{color:C.text}}>휴대폰 기본 캘린더</b>에 일정을 넘겨요.
            그러면 앱을 꺼놔도 설정한 시간에 <b style={{color:C.text}}>휴대폰 알림</b>이 울려요.
          </div>
        </div>

        <button onClick={doShare} style={{...primary(STUDY_ACCENT), width:"100%", marginTop:12}}>
          캘린더 파일로 보내기 (알림 포함)
        </button>
        <div style={{ fontSize:10.5, color:C.muted, marginTop:6, lineHeight:1.5 }}>
          여러 일정을 한 번에 등록할 수 있고, 설정한 알림 시각도 같이 들어가요.
        </div>

        {single && (<>
          <a href={googleCalUrl(single.dateKey, single.plan)} target="_blank" rel="noreferrer"
            style={{...ghost, width:"100%", marginTop:10, display:"block", textAlign:"center", textDecoration:"none", boxSizing:"border-box"}}>
            구글 캘린더로 열기
          </a>
          <div style={{ fontSize:10.5, color:C.muted, marginTop:6, lineHeight:1.5 }}>
            구글 캘린더가 열리면서 내용이 채워져요. 저장만 누르면 되고, 알림은 구글 캘린더 기본 설정을 따라요.
          </div>
        </>)}

        {msg && <div style={{ fontSize:11.5, color:STUDY_ACCENT, marginTop:12, lineHeight:1.55, fontWeight:600 }}>{msg}</div>}
        <button onClick={onClose} style={{...ghost, width:"100%", marginTop:14}}>닫기</button>
      </div>
    </div>
  );
}

// 주간 시간표 — 하루 일정이 시간대에 어떻게 놓이는지 한눈에
function PlanWeek({ weekAnchor, setWeekAnchor, dayPlans, onOpen }) {
  const HOUR_H = 34;           // 1시간 높이(px)
  const toMin = (hhmm)=>{ const [h,m]=(hhmm||"0:00").split(":").map(Number); return (h||0)*60+(m||0); };
  // 기준일이 속한 주(일요일 시작)
  const base = new Date(weekAnchor); base.setHours(0,0,0,0);
  const sun = new Date(base); sun.setDate(base.getDate()-base.getDay());
  const days = [...Array(7)].map((_,i)=>{ const d=new Date(sun); d.setDate(sun.getDate()+i); return d; });
  const keys = days.map(d=>keyOf(d.getFullYear(),d.getMonth(),d.getDate()));
  const all = keys.flatMap((kk)=>dayPlans(kk).map(p=>({ kk, p })));

  // 계획이 있는 시간대만 보여줘서 세로 길이를 줄인다 (없으면 8~22시)
  const mins = all.flatMap(({p})=>[toMin(p.start), Math.max(toMin(p.end||p.start), toMin(p.start)+60)]);
  const startH = all.length ? Math.max(0, Math.floor(Math.min(...mins)/60)-1) : 8;
  const endH   = all.length ? Math.min(24, Math.ceil(Math.max(...mins)/60)+1) : 22;
  const hours = [...Array(Math.max(1,endH-startH))].map((_,i)=>startH+i);
  const todayK = todayKey();

  const moveWeek = (d)=>{ const n=new Date(sun); n.setDate(sun.getDate()+d*7); setWeekAnchor(n); };
  const label = `${sun.getMonth()+1}.${sun.getDate()} ~ ${days[6].getMonth()+1}.${days[6].getDate()}`;
  const isThisWeek = keys.includes(todayK);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 18px 10px", gap:8 }}>
        <span style={{ fontSize:17, fontWeight:800, letterSpacing:-0.3 }}>{label}</span>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {!isThisWeek && (
            <button onClick={()=>setWeekAnchor(new Date())}
              style={{ background:tint(STUDY_ACCENT,0.14), border:`1px solid ${tint(STUDY_ACCENT,0.45)}`, color:STUDY_ACCENT,
                borderRadius:999, padding:"6px 12px", fontSize:11.5, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap" }}>이번 주</button>
          )}
          <button onClick={()=>moveWeek(-1)} style={navBtn}>‹</button>
          <button onClick={()=>moveWeek(1)} style={navBtn}>›</button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display:"flex", padding:"0 12px", gap:3 }}>
        <div style={{ width:28, flexShrink:0 }} />
        {days.map((d,i)=>{
          const kk=keys[i], isT=kk===todayK;
          return (
            <button key={kk} onClick={()=>onOpen(kk)} style={{ flex:1, minWidth:0, background:"none", border:"none", cursor:"pointer",
              padding:"3px 0 6px", display:"flex", flexDirection:"column", alignItems:"center", gap:1 }}>
              <span style={{ fontSize:9.5, fontWeight:700, color:i===0?"#FF6B6B":i===6?"#6BA8FF":C.muted }}>{WEEKDAYS[i]}</span>
              <span style={{ fontSize:12, fontWeight:800, color:isT?"#141519":C.text,
                background:isT?STUDY_ACCENT:"transparent", borderRadius:"50%", width:21, height:21,
                display:"flex", alignItems:"center", justifyContent:"center" }}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* 시간 격자 */}
      <div style={{ display:"flex", padding:"0 12px", gap:3 }}>
        {/* 시간 눈금 */}
        <div style={{ width:28, flexShrink:0, position:"relative", height:hours.length*HOUR_H }}>
          {hours.map((h,i)=>(
            <div key={h} style={{ position:"absolute", top:i*HOUR_H-5, right:4, fontSize:8.5, color:C.muted, fontWeight:600 }}>{h}시</div>
          ))}
        </div>
        {/* 요일 열 */}
        {days.map((d,i)=>{
          const kk=keys[i]; const list=dayPlans(kk); const isT=kk===todayK;
          return (
            <div key={kk} onClick={()=>onOpen(kk)} style={{ flex:1, minWidth:0, position:"relative", height:hours.length*HOUR_H,
              background: isT?tint(STUDY_ACCENT,0.07):C.surface, borderRadius:8, cursor:"pointer", overflow:"hidden" }}>
              {/* 시간선 */}
              {hours.map((h,hi)=>(
                <div key={h} style={{ position:"absolute", top:hi*HOUR_H, left:0, right:0, height:1, background:C.line, opacity:0.5 }} />
              ))}
              {/* 일정 블록 */}
              {list.map((p)=>{
                const st=toMin(p.start), en=Math.max(toMin(p.end||p.start), st+30);
                const top=(st-startH*60)/60*HOUR_H;
                const h=Math.max(15,(en-st)/60*HOUR_H-2);
                if (top+h < 0 || top > hours.length*HOUR_H) return null;
                return (
                  <div key={p.id} title={`${p.start} ${p.title}`}
                    style={{ position:"absolute", top:Math.max(0,top), left:2, right:2, height:h, borderRadius:5,
                      background: p.done?tint(TYPES.legs.color,0.35):tint(STUDY_ACCENT,0.4),
                      borderLeft:`2px solid ${p.done?TYPES.legs.color:STUDY_ACCENT}`, padding:"2px 3px", overflow:"hidden" }}>
                    <div style={{ fontSize:8, fontWeight:800, color:C.text, lineHeight:1.15,
                      textDecoration:p.done?"line-through":"none",
                      overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{p.title}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {all.length===0 && (
        <div style={{ padding:"18px", textAlign:"center", color:C.muted, fontSize:12.5, lineHeight:1.6 }}>
          이번 주 계획이 없어요. 날짜를 탭해서 추가해보세요.
        </div>
      )}
      <div style={{ fontSize:10.5, color:C.muted, padding:"10px 18px 0", textAlign:"center" }}>
        날짜나 시간표를 탭하면 그날 계획을 편집할 수 있어요
      </div>
    </div>
  );
}

// ================= 계획 캘린더 =================
function PlanCalendar({ data, mutate }) {
  const today = new Date();
  const [view, setView] = useState({ y:today.getFullYear(), m:today.getMonth() });
  const [planView, setPlanView] = useState("month"); // month | week
  const [weekAnchor, setWeekAnchor] = useState(()=>new Date()); // 주간 보기 기준일
  const [openKey, setOpenKey] = useState(null);   // 계획 편집 시트를 연 날짜
  const [shareTarget, setShareTarget] = useState(null); // {dateKey, plans[]}
  const plans = data.plans || {};

  const firstDow = new Date(view.y,view.m,1).getDay();
  const dim = new Date(view.y,view.m+1,0).getDate();
  const cells=[]; for(let i=0;i<firstDow;i++) cells.push(null); for(let d=1;d<=dim;d++) cells.push(d);
  const isToday = (d)=> d && view.y===today.getFullYear() && view.m===today.getMonth() && d===today.getDate();
  const dayPlans = (kk)=> [...(plans[kk]||[])].sort((a,b)=>String(a.start).localeCompare(String(b.start)));

  const savePlans = (kk, list) => mutate((prev)=>{
    const np = { ...(prev.plans||{}) };
    if (list && list.length) np[kk] = list; else delete np[kk];
    return { ...prev, plans: np };
  });

  // 이번 달 계획 전부 + 다가오는 계획
  const monthKeys = [...Array(dim)].map((_,i)=>keyOf(view.y,view.m,i+1));
  const monthPlanCount = monthKeys.reduce((s,kk)=>s+(plans[kk]||[]).length,0);
  const todayK = todayKey();
  const upcoming = Object.keys(plans).filter(kk=>kk>=todayK).sort()
    .flatMap(kk=> dayPlans(kk).map(p=>({ dateKey:kk, plan:p }))).slice(0,3);

  return (
    <div>
      {/* 월간 / 주간 보기 전환 */}
      <div style={{ display:"flex", gap:6, padding:"12px 18px 0" }}>
        {[["month","월간"],["week","주간 시간표"]].map(([k2,label])=>(
          <button key={k2} onClick={()=>setPlanView(k2)}
            style={{...chip(planView===k2, STUDY_ACCENT), padding:"7px 13px", fontSize:12}}>{label}</button>
        ))}
      </div>

      {planView==="month" && <MonthNav view={view} setView={setView} accent={STUDY_ACCENT} />}

      {/* 다가오는 계획 */}
      {upcoming.length>0 && (
        <div style={{ padding:"0 18px 12px" }}>
          <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:7 }}>다가오는 계획</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {upcoming.map(({dateKey,plan})=>(
              <div key={plan.id} onClick={()=>setOpenKey(dateKey)}
                style={{ display:"flex", alignItems:"center", gap:10, background:C.surface, border:`1px solid ${C.line}`,
                  borderRadius:11, padding:"10px 12px", cursor:"pointer" }}>
                <div style={{ width:3, alignSelf:"stretch", borderRadius:99, background:STUDY_ACCENT }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{plan.title}</div>
                  <div style={{ fontSize:10.5, color:C.muted, marginTop:2 }}>
                    {dateKey.slice(5).replace("-",".")} · {plan.start}{plan.end?`~${plan.end}`:""}
                    {num(plan.alarm)>=0 && plan.alarm!=null ? ` · 🔔 ${ALARM_OPTIONS.find(a=>a.v===num(plan.alarm))?.label||""}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {planView==="week" ? (
        <PlanWeek weekAnchor={weekAnchor} setWeekAnchor={setWeekAnchor} dayPlans={dayPlans} onOpen={setOpenKey} />
      ) : (<>
      {/* 요일 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"0 12px", gap:4 }}>
        {WEEKDAYS.map((w,i)=>(<div key={w} style={{ textAlign:"center", fontSize:11, fontWeight:700, padding:"4px 0",
          color:i===0?"#FF6B6B":i===6?"#6BA8FF":C.muted }}>{w}</div>))}
      </div>
      {/* 날짜 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"4px 12px", gap:4 }}>
        {cells.map((d,i)=>{
          if(!d) return <div key={i} />;
          const kk = keyOf(view.y,view.m,d);
          const list = dayPlans(kk);
          return (
            <button key={i} onClick={()=>setOpenKey(kk)} style={{
              aspectRatio:"1 / 1.15", borderRadius:12, cursor:"pointer",
              border: isToday(d)?`2px solid ${STUDY_ACCENT}`:`1px solid ${C.line}`,
              background: list.length?tint(STUDY_ACCENT,0.13):C.surface,
              display:"flex", flexDirection:"column", alignItems:"flex-start", justifyContent:"flex-start",
              padding:"5px 5px", overflow:"hidden", textAlign:"left", gap:2 }}>
              <span style={{ fontSize:12, fontWeight:700, color:isToday(d)?C.text:C.muted }}>{d}</span>
              {list.slice(0,2).map((p)=>(
                <span key={p.id} style={{ fontSize:8, fontWeight:700, color:STUDY_ACCENT, lineHeight:1.15,
                  width:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {p.start} {p.title}
                </span>
              ))}
              {list.length>2 && <span style={{ fontSize:8, color:C.muted, fontWeight:700 }}>+{list.length-2}</span>}
            </button>
          );
        })}
      </div>

      </>)}

      {/* 이번 달 전체 내보내기 */}
      {planView==="month" && monthPlanCount>0 && (
        <div style={{ padding:"14px 18px 0" }}>
          <button onClick={()=>setShareTarget({ label:`${MONTHS[view.m]} 계획 ${monthPlanCount}개`,
            items: monthKeys.flatMap(kk=>dayPlans(kk).map(p=>({dateKey:kk, plan:p}))) })}
            style={{...primary(STUDY_ACCENT), width:"100%"}}>📲 이번 달 계획 휴대폰 캘린더에 넣기</button>
          <div style={{ fontSize:10.5, color:C.muted, marginTop:7, lineHeight:1.5, textAlign:"center" }}>
            휴대폰 기본 캘린더로 넘기면 설정한 시간에 알림이 울려요
          </div>
        </div>
      )}

      {openKey && <PlanEditor dateKey={openKey} list={dayPlans(openKey)}
        onSave={(l)=>savePlans(openKey,l)} onClose={()=>setOpenKey(null)}
        onShare={(items,label)=>setShareTarget({items,label})} />}
      {shareTarget && <PlanShareSheet target={shareTarget} onClose={()=>setShareTarget(null)} />}
    </div>
  );
}

function Calendar({ data, persist, updateDay, favProps, apiKey, customFoods, routines, mutate }) {
  const [mode, setMode] = useState("log"); // log = 운동·식단 기록 / plan = 시간 계획
  const [toolsOpen, setToolsOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [calMetric, setCalMetric] = useState("kcalIn"); // 셀에 겹쳐 볼 지표
  const [resetOpen, setResetOpen] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState(null); // 되돌리기용 직전 상태
  // 걸음수 칼로리 계산용 최신 체중
  const calWeight = (()=>{ const ms=[...(data.measurements||[])].sort((a,b)=>b.date.localeCompare(a.date)); return ms.length?ms[0].weight:null; })();
  const today = new Date();
  const [view, setView] = useState({ y:today.getFullYear(), m:today.getMonth() });
  const [editKey, setEditKey] = useState(null);
  const schedule = data.schedule;
  const studyDates = new Set((data.study||[]).map((s)=>s.date));

  const applyPreset = () => {
    const next = { ...data, schedule:{ ...schedule } };
    const dim = new Date(view.y, view.m+1, 0).getDate();
    for (let d=1; d<=dim; d++){ const dow=new Date(view.y,view.m,d).getDay(); const kk=keyOf(view.y,view.m,d);
      const ex = next.schedule[kk]||emptyDay(); next.schedule[kk]={ ...ex, type:PRESET[dow], parts:[] }; }
    persist(next);
  };

  // ⚠️ 예전엔 이 버튼이 그 달 기록 전체(음식·물·수면·기분·일기까지)를 지웠음.
  // 이제는 '이번 달 5분할 채우기'로 넣은 운동 배정(type/parts)만 되돌리고, 기록한 데이터는 모두 보존한다.
  const monthKeys = (()=>{ const dimN=new Date(view.y,view.m+1,0).getDate();
    return [...Array(dimN)].map((_,i)=>keyOf(view.y,view.m,i+1)); })();
  const assignedCount = monthKeys.filter((kk)=> schedule[kk]?.type).length;
  const clearAssignments = () => {
    setUndoSnapshot({ schedule: JSON.parse(JSON.stringify(schedule)), label:`${MONTHS[view.m]} 운동 배정` });
    const next = { ...data, schedule:{ ...schedule } };
    for (const kk of monthKeys) {
      const ex = next.schedule[kk];
      if (!ex || !ex.type) continue;
      const cleaned = { ...ex, type:null, parts:[] };
      // 배정만 있고 실제 기록이 하나도 없던 날은 통째로 비움
      const stillHas = (cleaned.foods&&cleaned.foods.length) || (cleaned.lifts&&cleaned.lifts.length) || cleaned.cardio
        || cleaned.note || cleaned.sleep || cleaned.water || (cleaned.partSets&&Object.keys(cleaned.partSets).length)
        || cleaned.mainLift || cleaned.creatine || cleaned.mood || cleaned.diary || cleaned.steps
        || (cleaned.habitLog&&Object.keys(cleaned.habitLog).length);
      if (stillHas) next.schedule[kk] = cleaned; else delete next.schedule[kk];
    }
    persist(next); setResetOpen(false);
  };
  const undoReset = () => {
    if (!undoSnapshot) return;
    persist({ ...data, schedule: undoSnapshot.schedule });
    setUndoSnapshot(null);
  };

  // 이번 달 요약 (기록한 날 기준 평균)
  const monthSummary = (()=>{
    const ds = monthKeys.map((kk)=>schedule[kk]).filter(Boolean);
    const withFood = ds.filter(e=>(e.foods||[]).length>0);
    const withBurn = ds.filter(e=>burnedKcal(e, calWeight)>0);
    const withWater = ds.filter(e=>num(e.water)>0);
    const avg=(arr,sel)=> arr.length?Math.round(arr.reduce((s,x)=>s+sel(x),0)/arr.length):0;
    return {
      days: ds.length,
      avgIn: avg(withFood, e=>(e.foods||[]).reduce((s,f)=>s+num(f.kcal),0)) || "—",
      avgBurn: avg(withBurn, e=>burnedKcal(e, calWeight)) || "—",
      avgWater: avg(withWater, e=>num(e.water)) || "—",
    };
  })();

  const firstDow = new Date(view.y,view.m,1).getDay();
  const dim = new Date(view.y,view.m+1,0).getDate();
  const cells=[]; for(let i=0;i<firstDow;i++) cells.push(null); for(let d=1;d<=dim;d++) cells.push(d);
  const isToday = (d)=> d && view.y===today.getFullYear() && view.m===today.getMonth() && d===today.getDate();

  const modeTabs = (
    <div style={{ display:"flex", gap:6, padding:"18px 18px 0" }}>
      {[["log","🏋️ 기록"],["plan","🗓️ 계획"]].map(([k,label])=>(
        <button key={k} onClick={()=>setMode(k)} style={{ flex:1, padding:"10px 0", borderRadius:11, cursor:"pointer",
          border:`1.5px solid ${mode===k?(k==="plan"?STUDY_ACCENT:TYPES.push.color):C.line}`,
          background: mode===k ? tint(k==="plan"?STUDY_ACCENT:TYPES.push.color, 0.15) : C.surface,
          color: mode===k ? (k==="plan"?STUDY_ACCENT:TYPES.push.color) : C.muted,
          fontSize:13, fontWeight:800 }}>{label}</button>
      ))}
    </div>
  );

  if (mode==="plan") return (<div>{modeTabs}<PlanCalendar data={data} mutate={mutate} /></div>);

  return (
    <div>
      {modeTabs}

      <MonthNav view={view} setView={setView} accent={TYPES.push.color}
        right={<button onClick={()=>setToolsOpen(v=>!v)} title="도구"
          style={{...navBtn, color: toolsOpen?TYPES.push.color:C.muted, borderColor: toolsOpen?tint(TYPES.push.color,0.5):C.line}}>⋯</button>} />

      {/* 도구 (접이식) — 자주 안 쓰는 동작은 숨겨둔다 */}
      {toolsOpen && (
        <div style={{ margin:"0 18px 12px", padding:"12px", background:C.surface, border:`1px solid ${C.line}`, borderRadius:12 }}>
          <button onClick={()=>{ applyPreset(); setToolsOpen(false); }} style={{...primary(TYPES.push.color), width:"100%"}}>이번 달 5분할 채우기</button>
          <button onClick={()=>{ setResetOpen(true); setToolsOpen(false); }} style={{...ghost, width:"100%", marginTop:7}}>운동 배정 지우기</button>
          <div style={{ fontSize:10.5, color:C.muted, marginTop:9, lineHeight:1.5 }}>
            배정 지우기는 운동 종류만 지우고 먹은 음식·물·기록은 그대로 둬요.
          </div>
        </div>
      )}

      {/* 되돌리기 */}
      {undoSnapshot && (
        <div style={{ margin:"0 18px 12px", padding:"11px 13px", borderRadius:11, background:tint(C.amber,0.12),
          border:`1px solid ${tint(C.amber,0.45)}`, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ flex:1, fontSize:11.5, color:C.amber, fontWeight:700 }}>{undoSnapshot.label}을 지웠어요</span>
          <button onClick={undoReset} style={{...primary(C.amber), padding:"7px 14px", fontSize:12, color:"#141519"}}>되돌리기</button>
          <button onClick={()=>setUndoSnapshot(null)} style={{ background:"none", border:"none", color:C.muted, fontSize:16, cursor:"pointer", padding:"0 2px" }}>×</button>
        </div>
      )}

      {/* 운동 배정 지우기 확인 */}
      {resetOpen && (
        <div onClick={()=>setResetOpen(false)} style={sheetBg}>
          <div onClick={(e)=>e.stopPropagation()} style={{...sheet, maxHeight:"none", paddingBottom:"calc(18px + env(safe-area-inset-bottom))"}}>
            <div style={grip} />
            <div style={{ fontSize:16, fontWeight:800, marginBottom:8 }}>{MONTHS[view.m]} 운동 배정을 지울까요?</div>
            <div style={{ fontSize:12.5, color:C.muted, lineHeight:1.65 }}>
              5분할로 배정된 <b style={{color:C.text}}>운동 종류만</b> 지워요{assignedCount>0?` (${assignedCount}일)`:""}.
            </div>
            <div style={{ marginTop:12, padding:"11px 13px", borderRadius:10, background:tint(TYPES.legs.color,0.1), border:`1px solid ${tint(TYPES.legs.color,0.35)}` }}>
              <div style={{ fontSize:11.5, fontWeight:800, color:TYPES.legs.color, marginBottom:4 }}>✓ 이건 그대로 남아요</div>
              <div style={{ fontSize:11, color:C.muted, lineHeight:1.6 }}>
                먹은 음식 · 물 · 걸음수 · 부위 세트수 · 유산소 · 수면 · 기분 · 습관 · 일기 · 메모
              </div>
            </div>
            <div style={{ fontSize:10.5, color:C.muted, marginTop:9, lineHeight:1.5 }}>
              지운 뒤에도 <b style={{color:C.text}}>되돌리기</b> 버튼이 떠서 바로 복구할 수 있어요.
            </div>
            <div style={{ display:"flex", gap:8, marginTop:16 }}>
              <button onClick={()=>setResetOpen(false)} style={{...ghost, flex:1}}>취소</button>
              <button onClick={clearAssignments} style={{...primary(C.amber), flex:2, color:"#141519"}}>운동 배정만 지우기</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"0 12px", gap:4 }}>
        {WEEKDAYS.map((w,i)=>(<div key={w} style={{ textAlign:"center", fontSize:11, fontWeight:700, padding:"4px 0",
          color:i===0?"#FF6B6B":i===6?"#6BA8FF":C.muted }}>{w}</div>))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"4px 12px", gap:4 }}>
        {cells.map((d,i)=>{
          if(!d) return <div key={i} />;
          const kk=keyOf(view.y,view.m,d); const e=schedule[kk]; const t=e&&e.type?TYPES[e.type]:null;
          // 부위 세트수(퀵기록)나 대표운동만 있는 날 처리
          const partKeys = e?.partSets ? Object.keys(e.partSets) : [];
          const totalSets = partKeys.reduce((s,p)=>s+num(e.partSets[p]),0);
          const hasQuick = partKeys.length>0 || !!e?.mainLift?.name;
          // 셀에 보여줄 라벨/색 결정 (타입 우선, 없으면 퀵기록)
          const showColor = t ? t.color : (hasQuick ? TYPES.push.color : null);
          let label = null;
          if (t) label = e.type==="custom"&&e.parts?.length ? e.parts.join("·") : t.label;
          else if (partKeys.length>0) label = partKeys.join("·");
          else if (e?.mainLift?.name) label = e.mainLift.name;
          return (
            <button key={i} onClick={()=>setEditKey(kk)} style={{
              aspectRatio:"1 / 1.15", borderRadius:12, cursor:"pointer",
              border:isToday(d)?`2px solid ${TYPES.push.color}`:`1px solid ${C.line}`,
              background:showColor?tint(showColor,0.14):C.surface, display:"flex", flexDirection:"column",
              alignItems:"flex-start", justifyContent:"space-between", padding:"6px 6px 5px", position:"relative", overflow:"hidden", textAlign:"left" }}>
              <span style={{ fontSize:12, fontWeight:700, color:isToday(d)?C.text:C.muted }}>{d}</span>
              <div style={{ display:"flex", flexDirection:"column", gap:1, width:"100%" }}>
                {label && <span style={{ fontSize:9.5, fontWeight:800, lineHeight:1.05, color:showColor, wordBreak:"keep-all",
                  overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{label}</span>}
                {!t && totalSets>0 && <span style={{ fontSize:8.5, fontWeight:700, color:C.muted }}>{totalSets}세트</span>}
                {calMetric!=="none" && (()=>{
                  const mv = cellMetric(e, calMetric, calWeight);
                  return mv ? <span style={{ fontSize:9, fontWeight:800, color:METRICS[calMetric].color, lineHeight:1.1 }}>{mv}</span> : null;
                })()}
              </div>
              {e?.cardio && <span style={{ position:"absolute", top:6, right:6, width:7, height:7, borderRadius:"50%", background:CARDIO[e.cardio.type].color }} />}
              {e?.foods?.length>0 && <span style={{ position:"absolute", bottom:6, right:6, width:6, height:6, borderRadius:"50%", background:TYPES.legs.color }} />}
              {studyDates.has(kk) && <span style={{ position:"absolute", bottom:6, left:6, width:6, height:6, borderRadius:"50%", background:STUDY_ACCENT }} />}
            </button>
          );
        })}
      </div>
      {/* 날짜에 겹쳐 볼 지표 */}
      <div style={{ display:"flex", gap:6, padding:"14px 18px 0", overflowX:"auto" }}>
        {Object.entries(METRICS).map(([mk,m])=>(
          <button key={mk} onClick={()=>setCalMetric(mk)}
            style={{...chip(calMetric===mk, m.color), padding:"6px 11px", fontSize:11.5, whiteSpace:"nowrap", flexShrink:0}}>{m.label}</button>
        ))}
      </div>

      {/* 이번 달 요약 */}
      {monthSummary.days>0 && (
        <div style={{ display:"flex", gap:6, padding:"12px 18px 0" }}>
          {[["기록", `${monthSummary.days}일`, C.text],
            ["먹은 kcal", `${monthSummary.avgIn}`, "#FF8FB0"],
            ["소모 kcal", `${monthSummary.avgBurn}`, "#5AD1A0"],
            ["물", `${monthSummary.avgWater}잔`, "#6BC5F0"]].map(([label,val,col])=>(
            <div key={label} style={{ flex:1, minWidth:0, background:C.surface, border:`1px solid ${C.line}`, borderRadius:10, padding:"8px 6px", textAlign:"center" }}>
              <div style={{ fontSize:9.5, color:C.muted, fontWeight:600 }}>{label}</div>
              <div style={{ fontSize:14, fontWeight:800, color:col, marginTop:2 }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* 색상 안내 (접이식) */}
      <div style={{ padding:"14px 18px 0" }}>
        <button onClick={()=>setLegendOpen(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer",
          color:C.muted, fontSize:11, fontWeight:700, padding:0 }}>색상 안내 {legendOpen?"▴":"▾"}</button>
        {legendOpen && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:9 }}>
            {Object.values(TYPES).map((t,i)=>(<Legend key={i} color={t.color} label={t.label} />))}
            <Legend dot color={C.amber} label="유산소" />
            <Legend dot color={TYPES.legs.color} label="식단" />
            <Legend dot color={STUDY_ACCENT} label="공부" />
          </div>
        )}
      </div>
      {editKey && <DayEditor dateKey={editKey} day={data.schedule[editKey]||emptyDay()} schedule={data.schedule}
        onClose={()=>setEditKey(null)} updateDay={updateDay} favProps={favProps} apiKey={apiKey} customFoods={customFoods} routines={routines} mutate={mutate} habits={data.habits} editorWeight={calWeight} />}
    </div>
  );
}

// 지난 동일 종목 최고 세트 찾기
const lastLiftSummary = (schedule, dateKey, name) => {
  const keys = Object.keys(schedule).filter((kk)=> kk<dateKey && (schedule[kk].lifts||[]).some((l)=>l.name===name)).sort().reverse();
  if (!keys.length) return null;
  const lift = schedule[keys[0]].lifts.find((l)=>l.name===name);
  if (!lift || !lift.sets.length) return null;
  const top = lift.sets.reduce((a,s)=> num(s.w)>num(a.w)?s:a, lift.sets[0]);
  return { date: keys[0], text: `${top.w}kg × ${top.r}` };
};

// 특정 종목의 날짜별 최고 무게 추이 (그래프용, 최근 10개)
const liftHistoryPoints = (schedule, name, beforeKey) => {
  const keys = Object.keys(schedule).filter((kk)=> kk<beforeKey && (schedule[kk].lifts||[]).some((l)=>l.name===name && l.sets.length)).sort();
  return keys.slice(-10).map((kk)=>{
    const lift = schedule[kk].lifts.find((l)=>l.name===name);
    const top = lift.sets.reduce((a,s)=> num(s.w)>num(a.w)?s:a, lift.sets[0]);
    return { label: kk.slice(5).replace("-","."), value: num(top.w) };
  });
};

// 특정 종목의 역대 최고 무게 (해당 날짜 이전 기준). 없으면 0.
const allTimeMaxW = (schedule, name, beforeKey) => {
  let max = 0;
  for (const kk of Object.keys(schedule)) {
    if (kk >= beforeKey) continue;
    for (const l of (schedule[kk].lifts||[])) {
      if (l.name !== name) continue;
      for (const s of l.sets) max = Math.max(max, num(s.w));
    }
  }
  return max;
};

// 대표운동(mainLift) 이름별 날짜순 무게 추이 (최근 10개)
const mainLiftHistory = (schedule, name) => {
  const keys = Object.keys(schedule).filter((kk)=> schedule[kk].mainLift?.name===name && num(schedule[kk].mainLift.w)>0).sort();
  return keys.slice(-10).map((kk)=>({ label: kk.slice(5).replace("-","."), value: num(schedule[kk].mainLift.w) }));
};

// ================= 날짜 편집 =================
function DayEditor({ dateKey, day, schedule, onClose, updateDay, favProps, apiKey, customFoods, routines, mutate, habits, editorWeight }) {
  const [draft, setDraft] = useState({ ...day, parts:[...(day.parts||[])], foods:[...(day.foods||[])],
    lifts:(day.lifts||[]).map((l)=>({ ...l, sets:[...l.sets] })), cardio: day.cardio?{...day.cardio}:null,
    partSets: { ...(day.partSets||{}) }, mainLift: day.mainLift?{...day.mainLift}:null,
    habitLog: { ...(day.habitLog||{}) }, mood: day.mood||null, diary: day.diary||"" });
  const [exName, setExName] = useState("");
  const [setInput, setSetInput] = useState({});
  const [chartOpen, setChartOpen] = useState({});
  const [routineName, setRoutineName] = useState("");
  const [routineSaveOpen, setRoutineSaveOpen] = useState(false);

  // 현재 종목 구성(이름만)을 루틴으로 저장
  const saveRoutine = () => {
    const name = routineName.trim();
    if (!name || !draft.lifts.length) return;
    const exercises = draft.lifts.map((l)=>l.name);
    mutate((prev)=>({ ...prev, routines:[...prev.routines.filter(r=>r.name!==name), { id:uid(), name, exercises }] }));
    setRoutineName(""); setRoutineSaveOpen(false);
  };
  // 루틴 불러오기: 종목들을 빈 세트로 추가 (이미 있는 종목은 건너뜀)
  const loadRoutine = (r) => {
    setDraft((d)=>{
      const existing = new Set(d.lifts.map((l)=>l.name));
      const added = r.exercises.filter((n)=>!existing.has(n)).map((n)=>({ id:uid(), name:n, sets:[] }));
      return { ...d, lifts:[...d.lifts, ...added] };
    });
  };
  const removeRoutine = (id) => mutate((prev)=>({ ...prev, routines:prev.routines.filter(r=>r.id!==id) }));

  const setCardioType = (tp)=> setDraft((d)=> d.cardio&&d.cardio.type===tp?{...d,cardio:null}:{ ...d, cardio:{ type:tp, min:d.cardio?.min||20, kcal:d.cardio?.kcal||0 } });
  const setCardioField = (f,v)=> setDraft((d)=>({ ...d, cardio:{ ...d.cardio, [f]:v } }));

  const addExercise = () => { if(!exName.trim()) return;
    setDraft((d)=>({ ...d, lifts:[...d.lifts, { id:uid(), name:exName.trim(), sets:[] }] })); setExName(""); };
  const rmExercise = (id)=> setDraft((d)=>({ ...d, lifts:d.lifts.filter(l=>l.id!==id) }));
  const addSet = (id) => { const v=setInput[id]||{}; if(!v.w||!v.r) return;
    setDraft((d)=>({ ...d, lifts:d.lifts.map(l=> l.id===id?{ ...l, sets:[...l.sets, { w:num(v.w), r:num(v.r) }] }:l) }));
    setSetInput((s)=>({ ...s, [id]:{ w:v.w, r:"" } })); };
  const rmSet = (id,idx)=> setDraft((d)=>({ ...d, lifts:d.lifts.map(l=> l.id===id?{ ...l, sets:l.sets.filter((_,i)=>i!==idx) }:l) }));

  const save = () => { const d={ ...draft }; if(d.type!=="custom") d.parts=[]; updateDay(dateKey,d); onClose(); };
  const [confirmClear, setConfirmClear] = useState(false);
  const clearAll = () => { updateDay(dateKey, emptyDay()); onClose(); };

  return (
    <div onClick={save} style={sheetBg}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink:0 }}>
          <div style={grip} />
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontSize:15, fontWeight:800 }}>{dateKey.replace(/-/g,".")}</span>
            <span style={{ fontSize:11, color:C.muted }}>아래로 스크롤해서 더 기록</span>
          </div>
        </div>
        <div style={{ flex:1, minHeight:0, overflowY:"auto", WebkitOverflowScrolling:"touch", paddingRight:2, overscrollBehavior:"contain" }}>

          <SecLabel>운동 <span style={{ fontWeight:600, color:C.muted, opacity:0.8 }}>(선택 — 안 골라도 아래 부위 세트만으로 운동 기록돼요)</span></SecLabel>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {Object.entries(TYPES).map(([k,t])=>{ const on=draft.type===k;
              return (<button key={k} onClick={()=>setDraft({...draft, type:on?null:k})} style={{ padding:"10px 6px", borderRadius:12, cursor:"pointer", textAlign:"left",
                border:`1.5px solid ${on?t.color:C.line}`, background:on?tint(t.color,0.16):C.surface2, color:on?t.color:C.text }}>
                <div style={{ fontSize:13, fontWeight:800 }}>{t.label}</div>
                {t.sub && <div style={{ fontSize:9.5, color:C.muted, marginTop:2 }}>{t.sub}</div>}
              </button>); })}
          </div>
          {draft.type==="custom" && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:12 }}>
              {PARTS.map((p)=>{ const on=draft.parts.includes(p);
                return <button key={p} onClick={()=>setDraft({...draft, parts:on?draft.parts.filter(x=>x!==p):[...draft.parts,p]})} style={chip(on,TYPES.custom.color)}>{p}</button>; })}
            </div>
          )}

          <SecLabel>퀵 기록 · 부위 세트수 & 대표운동</SecLabel>
          <QuickWorkoutBlock partSets={draft.partSets} mainLift={draft.mainLift}
            onChangePartSets={(v)=>setDraft({ ...draft, partSets:v })}
            onChangeMainLift={(v)=>setDraft({ ...draft, mainLift:v })} />

          <SecLabel>세트 · 무게</SecLabel>
          {(routines.length>0 || draft.lifts.length>0) && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:10, alignItems:"center" }}>
              {routines.map((r)=>(
                <span key={r.id} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 8px 7px 12px", borderRadius:999,
                  border:`1px solid ${tint(TYPES.push.color,0.5)}`, background:tint(TYPES.push.color,0.1), fontSize:12.5, fontWeight:700 }}>
                  <span onClick={()=>loadRoutine(r)} style={{ cursor:"pointer", color:TYPES.push.color }}>▶ {r.name}</span>
                  <span onClick={()=>removeRoutine(r.id)} style={{ cursor:"pointer", color:C.muted }}>×</span>
                </span>
              ))}
              {draft.lifts.length>0 && (
                <button onClick={()=>setRoutineSaveOpen((v)=>!v)} style={{ ...chip(routineSaveOpen, TYPES.push.color), padding:"7px 12px" }}>
                  + 지금 구성을 루틴으로
                </button>
              )}
            </div>
          )}
          {routineSaveOpen && (
            <div style={{ display:"flex", gap:6, marginBottom:10 }}>
              <input value={routineName} onChange={(e)=>setRoutineName(e.target.value)} placeholder="루틴 이름 (예: 내 Push 루틴)" style={{...inp, flex:1, minWidth:0}} />
              <button onClick={saveRoutine} style={{ ...primary(TYPES.push.color), padding:"11px 14px" }}>저장</button>
            </div>
          )}
          <RestTimer />
          {draft.lifts.map((l)=>{ const last=lastLiftSummary(schedule,dateKey,l.name); const si=setInput[l.id]||{};
            const hist = liftHistoryPoints(schedule, l.name, dateKey);
            const prevMax = allTimeMaxW(schedule, l.name, dateKey);
            const isPR = prevMax>0 && l.sets.some((s)=>num(s.w)>prevMax);
            return (
              <div key={l.id} style={{ background:C.surface2, borderRadius:12, padding:"10px 12px", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:14, fontWeight:800 }}>{l.name}{isPR && " 🏆"}</span>
                  <button onClick={()=>rmExercise(l.id)} style={xBtn}>×</button>
                </div>
                {isPR && <div style={{ fontSize:11, color:C.amber, fontWeight:700, marginTop:2 }}>신기록! 이전 최고 {prevMax}kg 돌파</div>}
                {last && (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:3 }}>
                    <span style={{ fontSize:11, color:C.muted }}>지난 기록 {last.date.slice(5).replace("-",".")} · {last.text}</span>
                    {hist.length>=2 && (
                      <span onClick={()=>setChartOpen((c)=>({ ...c, [l.id]:!c[l.id] }))} style={{ fontSize:10.5, color:TYPES.push.color, fontWeight:700, cursor:"pointer" }}>
                        {chartOpen[l.id]?"추이 닫기":"추이 보기"}
                      </span>
                    )}
                  </div>
                )}
                {chartOpen[l.id] && hist.length>=2 && <LineChart points={hist} color={TYPES.push.color} unit="kg" />}
                {l.sets.length>0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                    {l.sets.map((s,idx)=>{
                      const setPR = prevMax>0 && num(s.w)>prevMax;
                      return (
                        <span key={idx} onClick={()=>rmSet(l.id,idx)} style={{ fontSize:12, fontWeight:700, padding:"5px 9px", borderRadius:8,
                          background:setPR?tint(C.amber,0.2):tint(TYPES.push.color,0.16), color:setPR?C.amber:TYPES.push.color, cursor:"pointer" }}>
                          {setPR&&"🏆 "}{s.w}kg × {s.r} ×</span>
                      );
                    })}
                  </div>
                )}
                <div style={{ display:"flex", gap:6, marginTop:8 }}>
                  <input value={si.w||""} onChange={(e)=>setSetInput((st)=>({ ...st, [l.id]:{ ...si, w:e.target.value } }))} placeholder="kg" inputMode="decimal" style={{...inp, flex:1, minWidth:0}} />
                  <input value={si.r||""} onChange={(e)=>setSetInput((st)=>({ ...st, [l.id]:{ ...si, r:e.target.value } }))} placeholder="회" inputMode="numeric" style={{...inp, flex:1, minWidth:0}} />
                  <button onClick={()=>addSet(l.id)} style={{ ...primary(TYPES.push.color), padding:"11px 14px" }}>세트</button>
                </div>
              </div>
            ); })}
          <div style={{ display:"flex", gap:6 }}>
            <input value={exName} onChange={(e)=>setExName(e.target.value)} placeholder="종목 추가 (예: 벤치프레스)" style={{...inp, flex:1, minWidth:0}} />
            <button onClick={addExercise} style={ghost}>추가</button>
          </div>

          <SecLabel>유산소</SecLabel>
          <div style={{ display:"flex", gap:7 }}>
            {Object.entries(CARDIO).map(([k,c])=>{ const on=draft.cardio?.type===k;
              return <button key={k} onClick={()=>setCardioType(k)} style={{...chip(on,c.color), flex:1, textAlign:"center"}}>{c.label}</button>; })}
          </div>
          {draft.cardio && (
            <div style={{ display:"flex", gap:10, marginTop:10 }}>
              <div style={{ flex:1 }}><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>시간(분)</div>
                <div style={{ display:"flex", alignItems:"center", gap:8, background:C.surface2, borderRadius:10, padding:"6px 8px" }}>
                  <button onClick={()=>setCardioField("min",Math.max(0,(draft.cardio.min||0)-5))} style={stepBtn}>–</button>
                  <span style={{ flex:1, textAlign:"center", fontWeight:800 }}>{draft.cardio.min}</span>
                  <button onClick={()=>setCardioField("min",(draft.cardio.min||0)+5)} style={stepBtn}>+</button>
                </div></div>
              <div style={{ flex:1 }}><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>소모 kcal</div>
                <input value={draft.cardio.kcal||""} onChange={(e)=>setCardioField("kcal",num(e.target.value))} inputMode="numeric" placeholder="예: 120" style={{...inp, width:"100%", boxSizing:"border-box", padding:"11px 10px"}} /></div>
            </div>
          )}

          <SecLabel>먹은 음식</SecLabel>
          <FoodSection foods={draft.foods}
            addFoods={(items)=>setDraft((d)=>({ ...d, foods:[...d.foods, ...items], water:(d.water||0)+extraWater(items) }))}
            removeFood={(id)=>setDraft((d)=>({ ...d, foods:d.foods.filter(f=>f.id!==id) }))}
            updateFood={(id,patch)=>setDraft((d)=>({ ...d, foods:d.foods.map(f=>f.id===id?{...f,...patch}:f) }))}
            compact apiKey={apiKey} customFoods={customFoods} {...favProps} />

          <SecLabel>수분</SecLabel>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:C.surface2, borderRadius:10, padding:"8px 10px" }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
              <span style={{ fontSize:20, fontWeight:800, color:"#6BC5F0" }}>{((draft.water||0)*0.25).toFixed(2).replace(/\.?0+$/,"")}L</span>
              <span style={{ fontSize:12, color:C.muted }}>{draft.water||0}잔</span>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setDraft((d)=>({ ...d, water:Math.max(0,(d.water||0)-1) }))} style={stepBtn}>–</button>
              <button onClick={()=>setDraft((d)=>({ ...d, water:(d.water||0)+1 }))} style={{...primary("#6BC5F0"), padding:"0 16px"}}>+1잔</button>
            </div>
          </div>

          <SecLabel>걸음수</SecLabel>
          <div style={{ display:"flex", gap:7, alignItems:"center" }}>
            <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"center", background:C.surface2, borderRadius:10, padding:"0 12px" }}>
              <input value={draft.steps ? String(draft.steps) : ""} onChange={(e)=>setDraft((d)=>({ ...d, steps:Math.max(0,Math.min(100000,Math.round(num(e.target.value.replace(/[^0-9]/g,""))))) }))}
                inputMode="numeric" placeholder="0"
                style={{ flex:1, minWidth:0, background:"none", border:"none", outline:"none", color:C.text, fontSize:17, fontWeight:800, padding:"10px 0" }} />
              <span style={{ fontSize:12, color:C.muted, fontWeight:700 }}>보</span>
            </div>
            {num(draft.steps)>0 && <span style={{ fontSize:12, fontWeight:800, color:"#5AD1A0", flexShrink:0 }}>≈{stepsToKcal(draft.steps, editorWeight)}kcal</span>}
          </div>

          <SecLabel>수면 · 컨디션</SecLabel>
          <SleepBlock value={draft.sleep} onChange={(v)=>setDraft({ ...draft, sleep:v })} />
          <div onClick={()=>setDraft({ ...draft, creatine:!draft.creatine })} style={{ display:"flex", alignItems:"center", gap:8,
            marginTop:12, padding:"10px 12px", borderRadius:10, cursor:"pointer",
            background: draft.creatine ? tint("#C9A6FF",0.13) : C.surface2,
            border:`1.5px solid ${draft.creatine ? "#C9A6FF" : C.line}` }}>
            <span style={{ fontSize:15 }}>💊</span>
            <span style={{ fontSize:12.5, fontWeight:800, color: draft.creatine ? "#C9A6FF" : C.muted }}>크레아틴 복용 {draft.creatine?"✓":""}</span>
          </div>

          <SecLabel>기분</SecLabel>
          <div style={{ display:"flex", gap:6 }}>
            {MOODS.map((m)=>(
              <button key={m.v} onClick={()=>setDraft({ ...draft, mood: draft.mood===m.v?null:m.v })} style={{
                flex:1, padding:"9px 0", borderRadius:10, cursor:"pointer",
                border:`1.5px solid ${draft.mood===m.v?m.color:C.line}`,
                background: draft.mood===m.v?tint(m.color,0.15):C.surface2,
                display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                <span style={{ fontSize:19, filter:draft.mood===m.v?"none":"grayscale(0.4)" }}>{m.emoji}</span>
                <span style={{ fontSize:9, color:draft.mood===m.v?m.color:C.muted, fontWeight:700 }}>{m.label}</span>
              </button>
            ))}
          </div>

          {habits.length>0 && (<>
            <SecLabel>습관</SecLabel>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {habits.map((h)=>{
                const done=!!(draft.habitLog||{})[h.id];
                return (
                  <div key={h.id} onClick={()=>setDraft({ ...draft, habitLog:{ ...(draft.habitLog||{}), [h.id]:!done } })}
                    style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 11px", borderRadius:10, cursor:"pointer",
                    background:done?tint(TYPES.legs.color,0.13):C.surface2, border:`1.5px solid ${done?TYPES.legs.color:C.line}` }}>
                    <span style={{ fontSize:16 }}>{h.emoji}</span>
                    <span style={{ flex:1, fontSize:13, fontWeight:700, color:done?TYPES.legs.color:C.text }}>{h.name}</span>
                    <span style={{ fontSize:13, fontWeight:900, color:done?TYPES.legs.color:C.muted }}>{done?"✓":""}</span>
                  </div>
                );
              })}
            </div>
          </>)}

          <SecLabel>한 줄 일기</SecLabel>
          <textarea value={draft.diary||""} onChange={(e)=>setDraft({...draft, diary:e.target.value})} rows={2}
            placeholder="이 날 하루는 어땠나요?" style={{...inp, width:"100%", boxSizing:"border-box", resize:"none", lineHeight:1.5, fontFamily:"inherit"}} />

          <SecLabel>메모</SecLabel>
          <input value={draft.note||""} onChange={(e)=>setDraft({...draft, note:e.target.value})} placeholder="예: 컨디션 좋음" style={{...inp, width:"100%", boxSizing:"border-box"}} />
          <div style={{ height:8 }} />
        </div>
        <div style={{ flexShrink:0, display:"flex", gap:8, padding:"12px 0 calc(14px + env(safe-area-inset-bottom))",
          borderTop:`1px solid ${C.line}`, background:C.surface }}>
          {confirmClear ? (
            <button onClick={clearAll} style={{...ghost, color:C.danger, borderColor:tint(C.danger,0.5), whiteSpace:"nowrap"}}>정말 비울까요?</button>
          ) : (
            <button onClick={()=>setConfirmClear(true)} style={ghost}>비우기</button>
          )}
          <button onClick={save} style={{...primary(TYPES.legs.color), flex:1}}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ================= 세트 휴식 타이머 =================
function RestTimer() {
  const [secs, setSecs] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running, setRunning] = useState(false);
  const intervalRef = React.useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            try { navigator.vibrate && navigator.vibrate(200); } catch (e) {}
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const start = (s) => { setSecs(s); setRemaining(s); setRunning(true); };
  const reset = () => { setRunning(false); clearInterval(intervalRef.current); setRemaining(secs); };
  const mm = Math.floor(remaining / 60), ss = String(remaining % 60).padStart(2, "0");
  const done = remaining === 0 && !running;

  return (
    <div style={{ background: C.surface2, borderRadius: 12, padding: "10px 12px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>세트 휴식 타이머</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: done ? TYPES.legs.color : C.text, marginTop: 2 }}>{mm}:{ss}</div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {[60, 90, 120].map((s) => (
          <button key={s} onClick={() => start(s)} style={{ ...chip(running && secs === s, TYPES.push.color), padding: "7px 10px" }}>{s}s</button>
        ))}
        <button onClick={reset} style={stepBtn}>↺</button>
      </div>
    </div>
  );
}

// ================= 퀵 운동 기록 (부위별 세트수 + 대표운동) =================
function QuickWorkoutBlock({ partSets, mainLift, onChangePartSets, onChangeMainLift }) {
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
    </div>
  );
}

// ================= 습관 트래커 =================
const HABIT_EMOJIS = ["✅","💊","🧘","📖","💧","🚭","🍺","🌙","🏃","🧴","🦷","☀️","💤","🥗"];
function HabitTracker({ habits, log, onToggle, onAddHabit, onRemoveHabit }) {
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✅");
  const [manage, setManage] = useState(false);
  const submit = () => { if(!name.trim()) return; onAddHabit(name.trim(), emoji); setName(""); setEmoji("✅"); setAddOpen(false); };
  return (
    <div style={{ marginTop:10 }}>
      {habits.length===0 ? (
        <div style={{ fontSize:12.5, color:C.muted, lineHeight:1.6, marginBottom:4 }}>
          매일 체크할 습관을 추가해보세요. 영양제, 스트레칭, 금주, 독서 등 뭐든지요.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {habits.map((h)=>{
            const done = !!log[h.id];
            return (
              <div key={h.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:12, transition:"all .2s",
                background: done?tint(TYPES.legs.color,0.13):C.surface2, border:`1.5px solid ${done?TYPES.legs.color:C.line}`, cursor:"pointer" }}
                onClick={()=>!manage && onToggle(h.id)}>
                <span style={{ fontSize:18 }}>{h.emoji}</span>
                <span style={{ flex:1, fontSize:13.5, fontWeight:700, color:done?TYPES.legs.color:C.text, textDecoration:done&&!manage?"none":"none" }}>{h.name}</span>
                {manage ? (
                  <button onClick={(e)=>{ e.stopPropagation(); onRemoveHabit(h.id); }} style={xBtn}>×</button>
                ) : (
                  <div style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                    background:done?TYPES.legs.color:"transparent", border:`2px solid ${done?TYPES.legs.color:C.muted}`,
                    color:"#141519", fontSize:14, fontWeight:900, transition:"all .2s" }}>{done?"✓":""}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginTop:10 }}>
        <button onClick={()=>{ setAddOpen(v=>!v); setManage(false); }} style={{ ...ghost, flex:1, fontSize:12.5, padding:"9px 0" }}>+ 습관 추가</button>
        {habits.length>0 && <button onClick={()=>{ setManage(v=>!v); setAddOpen(false); }} style={{ ...ghost, flex:1, fontSize:12.5, padding:"9px 0", color:manage?C.amber:C.muted, borderColor:manage?C.amber:C.line }}>{manage?"완료":"편집"}</button>}
      </div>

      {addOpen && (
        <div style={{ marginTop:8, background:C.surface2, borderRadius:12, padding:"12px" }}>
          <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:6 }}>아이콘</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {HABIT_EMOJIS.map((em)=>(
              <button key={em} onClick={()=>setEmoji(em)} style={{ fontSize:17, padding:"5px 7px", borderRadius:8, cursor:"pointer",
                border:`1.5px solid ${emoji===em?TYPES.legs.color:C.line}`, background:emoji===em?tint(TYPES.legs.color,0.15):"transparent" }}>{em}</button>
            ))}
          </div>
          <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="습관 이름 (예: 아침 스트레칭)"
            style={{...inp, width:"100%", boxSizing:"border-box", marginTop:10}} />
          <button onClick={submit} disabled={!name.trim()} style={{...primary(TYPES.legs.color), width:"100%", marginTop:8, opacity:name.trim()?1:0.45}}>추가</button>
        </div>
      )}
    </div>
  );
}

// ================= 수면 · 컨디션 =================
const CONDITION_LABELS = { 1:"최악", 2:"나쁨", 3:"보통", 4:"좋음", 5:"최고" };
function SleepBlock({ value, onChange }) {
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
function Foods({ addFoodsToday, apiKey, customFoods, mutate, schedule }) {
  const [mode, setMode] = useState("search");
  return (
    <div style={{ padding:"22px 18px 8px" }}>
      <div style={{ fontSize:11, letterSpacing:3, color:TYPES.push.color, fontWeight:800 }}>FOODS</div>
      <div style={{ fontSize:30, fontWeight:800, letterSpacing:-1, marginTop:4 }}>음식</div>

      <div style={{ display:"flex", gap:6, marginTop:14, background:C.surface2, padding:4, borderRadius:12 }}>
        {[["search","음식 검색"],["dining","외식 추천"]].map(([k,label])=>(
          <button key={k} onClick={()=>setMode(k)} style={{
            flex:1, padding:"10px 0", borderRadius:9, border:"none", cursor:"pointer", fontSize:13, fontWeight:800,
            background: mode===k ? C.surface : "transparent",
            color: mode===k ? TYPES.push.color : C.muted,
          }}>{label}</button>
        ))}
      </div>

      {mode==="search"
        ? <FoodSearch addFoodsToday={addFoodsToday} customFoods={customFoods} mutate={mutate} schedule={schedule} />
        : <Dining addFoodsToday={addFoodsToday} apiKey={apiKey} customFoods={customFoods} embedded />}
    </div>
  );
}

function FoodSearch({ addFoodsToday, customFoods, mutate, schedule }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [added, setAdded] = useState({});
  const [quickSort, setQuickSort] = useState("recent"); // recent | frequent
  const [quickAdded, setQuickAdded] = useState({});

  // 지금까지 기록한 식단에서 최근·자주 먹은 음식 뽑기 (이름+영양 그대로 원탭 재등록용)
  const quickFoods = React.useMemo(()=>{
    const map = new Map(); // name -> { item, count, order }
    const dates = Object.keys(schedule||{}).sort().reverse(); // 최근 날짜 우선
    let order = 0;
    for (const dk of dates) {
      const foods = schedule[dk]?.foods || [];
      for (let i=foods.length-1; i>=0; i--) {
        const f = foods[i];
        if (!f || !f.name) continue;
        if (map.has(f.name)) { map.get(f.name).count++; }
        else { map.set(f.name, { item:f, count:1, order:order++ }); } // order=최초 등장(=가장 최근) 순
      }
    }
    return [...map.values()];
  }, [schedule]);
  const quickList = React.useMemo(()=>{
    const arr = [...quickFoods];
    if (quickSort==="frequent") arr.sort((a,b)=> b.count-a.count || a.order-b.order);
    else arr.sort((a,b)=> a.order-b.order);
    return arr.slice(0, 12);
  }, [quickFoods, quickSort]);
  const quickAdd = (item) => {
    addFoodsToday([{ id:uid(), name:item.name, protein:num(item.protein), carbs:num(item.carbs), sugar:num(item.sugar), fat:num(item.fat), kcal:num(item.kcal), liquidMl:num(item.liquidMl)||0 }]);
    setQuickAdded((a)=>({ ...a, [item.name]:true }));
    setTimeout(()=>setQuickAdded((a)=>({ ...a, [item.name]:false })), 1200);
  };
  const [cf, setCf] = useState({ name:"", cat:"기타", protein:"", carbs:"", sugar:"", fat:"", kcal:"", liquidMl:"", fixedLiquid:false, gramsPerServing:"" });

  const cats = allCategories(customFoods);
  const results = searchAllFoods(q, customFoods, cat);

  const [qty, setQty] = useState({}); // 항목별 선택 수량 (기본 1인분)
  const [gramMode, setGramMode] = useState({}); // 항목별 g 직접입력값 (있으면 g 기준)
  const multOf = (e) => {
    const g = gramMode[e.key];
    if (g!=null && g!=="") { const gv=num(g); return gv>0 ? gv/gramsPerServing(e) : 1; }
    return qty[e.key] || 1;
  };
  const addToToday = (e) => {
    const mult = multOf(e);
    const g = gramMode[e.key];
    const usingGram = g!=null && g!=="" && num(g)>0;
    const r1 = (v)=>Math.round(v*mult*10)/10;
    const label = usingGram ? `${e.key} ${num(g)}g` : (Math.abs(mult-1)<0.001 ? e.key : `${e.key} ${Math.round(mult*100)/100}인분`);
    addFoodsToday([{ id:uid(), name: label,
      protein:r1(e.protein), carbs:r1(e.carbs), sugar:r1(e.sugar), fat:r1(e.fat), kcal:Math.round(e.kcal*mult),
      liquidMl: e.liquidMl ? (e.fixedLiquid ? e.liquidMl : Math.round(e.liquidMl*mult)) : 0 }]);
    setAdded((a)=>({ ...a, [e.key]:true }));
    setTimeout(()=>setAdded((a)=>({ ...a, [e.key]:false })), 1500);
  };

  const addCustomFood = () => {
    if (!cf.name.trim()) return;
    const entry = makeCustomEntry({ name:cf.name.trim(), cat:cf.cat, protein:num(cf.protein), carbs:num(cf.carbs), sugar:num(cf.sugar), fat:num(cf.fat), kcal:num(cf.kcal), liquidMl:num(cf.liquidMl), fixedLiquid:cf.fixedLiquid, gramsPerServing:num(cf.gramsPerServing) });
    mutate((prev)=>({ ...prev, customFoods:[...prev.customFoods.filter(e=>e.key!==entry.key), entry] }));
    setCf({ name:"", cat:"기타", protein:"", carbs:"", sugar:"", fat:"", kcal:"", liquidMl:"", fixedLiquid:false, gramsPerServing:"" });
    setAddOpen(false);
  };
  const removeCustomFood = (key) => mutate((prev)=>({ ...prev, customFoods:prev.customFoods.filter(e=>e.key!==key) }));
  const [editKey, setEditKey] = useState(null);
  const saveEdit = (orig, patch) => {
    const entry = { ...orig, ...patch, custom:true, cat: patch.cat||orig.cat,
      aliases: Array.from(new Set([patch.key||orig.key, ...(orig.aliases||[])])) };
    if (!(patch.liquidMl>0)) delete entry.liquidMl;
    if (!(patch.liquidMl>0) || !patch.fixedLiquid) delete entry.fixedLiquid; else entry.fixedLiquid = true;
    if (patch.gramsPerServing>0) entry.gramsPerServing = patch.gramsPerServing; else delete entry.gramsPerServing;
    mutate((prev)=>({ ...prev, customFoods:[...prev.customFoods.filter(e=>e.key!==orig.key && e.key!==entry.key), entry] }));
    setEditKey(null);
  };

  // 검색 결과 설명 문구
  const contextLabel = () => {
    if (cat && q) return `${cat} 안에서 "${q}"`;
    if (cat) return cat;
    if (q) return `"${q}" 검색결과`;
    return "전체 음식";
  };

  return (
    <div>
      {/* 검색창 */}
      <div style={{ position:"relative", marginTop:14 }}>
        <input value={q} onChange={(e)=>setQ(e.target.value)}
          placeholder={cat ? `${cat} 안에서 검색` : "음식 검색 (예: 치킨, 교촌, 닭가슴살)"}
          style={{...inp, width:"100%", boxSizing:"border-box", paddingLeft:38, paddingRight:36, fontSize:14.5}} />
        <span style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", fontSize:14, color:C.muted }}>🔍</span>
        {q && <span onClick={()=>setQ("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", fontSize:18, color:C.muted, cursor:"pointer", lineHeight:1 }}>×</span>}
      </div>

      {/* 카테고리 필터 */}
      <div style={{ display:"flex", gap:6, marginTop:10, overflowX:"auto", paddingBottom:4, scrollbarWidth:"none" }}>
        <button onClick={()=>setCat(null)} style={{...chip(cat===null, TYPES.push.color), flexShrink:0}}>전체</button>
        {cats.map((c)=>(
          <button key={c} onClick={()=>setCat(cat===c?null:c)} style={{...chip(cat===c, c==="내 음식"?TYPES.legs.color:TYPES.push.color), flexShrink:0}}>{c}</button>
        ))}
      </div>

      {/* 빠른 추가 — 최근·자주 먹은 음식 */}
      {quickList.length>0 && !q && !cat && (
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={lbl}>빠른 추가</span>
            <div style={{ display:"flex", gap:5 }}>
              {[["recent","최근"],["frequent","자주"]].map(([k,label])=>(
                <button key={k} onClick={()=>setQuickSort(k)} style={{...chip(quickSort===k, TYPES.push.color), padding:"5px 11px", fontSize:11.5}}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize:10.5, color:C.muted, marginTop:6 }}>
            {quickSort==="recent" ? "최근 먹은 순서대로. 탭하면 오늘 식단에 그대로 추가돼요." : "자주 먹은 순서대로. 탭 한 번이면 끝."}
          </div>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginTop:10 }}>
            {quickList.map((qf)=>{
              const done = quickAdded[qf.item.name];
              return (
                <button key={qf.item.name} onClick={()=>quickAdd(qf.item)}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px", borderRadius:999, cursor:"pointer",
                    border:`1px solid ${done?TYPES.legs.color:C.line}`, background: done?tint(TYPES.legs.color,0.14):C.surface2,
                    color: done?TYPES.legs.color:C.text, fontSize:12.5, fontWeight:700, transition:"all .15s" }}>
                  <span>{done ? "추가됨 ✓" : qf.item.name}</span>
                  {!done && <span style={{ fontSize:10.5, color:C.muted, fontWeight:600 }}>{Math.round(num(qf.item.kcal))}kcal{quickSort==="frequent"&&qf.count>1?` · ${qf.count}회`:""}</span>}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* 내 음식 등록 */}
      <Card>
        <div onClick={()=>setAddOpen((v)=>!v)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
          <span style={lbl}>+ 내 음식 등록</span>
          <span style={{ fontSize:14, color:C.muted, transform:addOpen?"rotate(180deg)":"none", transition:"transform .2s" }}>▾</span>
        </div>
        {addOpen && (
          <>
            <div style={{ fontSize:11.5, color:C.muted, marginTop:8, lineHeight:1.55 }}>
              <b style={{color:C.text}}>1인분</b> 기준 영양성분을 넣어주세요. 이름엔 수량을 빼고요 —
              "엄마표 닭갈비"로 저장하면 나중에 "엄마표 닭갈비 2인분"도 자동 계산돼요.
            </div>

            <div style={{ fontSize:11, color:C.muted, fontWeight:700, margin:"14px 0 6px" }}>음식 이름</div>
            <input value={cf.name} onChange={(e)=>setCf({...cf,name:e.target.value})} placeholder="예: 엄마표 닭갈비"
              style={{...inp, width:"100%", boxSizing:"border-box"}} />

            <div style={{ fontSize:11, color:C.muted, fontWeight:700, margin:"14px 0 6px" }}>카테고리</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {CATEGORIES.map((c)=>(
                <button key={c} onClick={()=>setCf({...cf, cat:c})} style={{...chip(cf.cat===c, TYPES.legs.color), padding:"7px 11px", fontSize:12}}>{c}</button>
              ))}
            </div>

            <div style={{ fontSize:11, color:C.muted, fontWeight:700, margin:"14px 0 6px" }}>영양성분 (1인분)</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <LabeledInput label="단백질 g" v={cf.protein} on={(v)=>setCf({...cf,protein:v})} />
              <LabeledInput label="탄수 g" v={cf.carbs} on={(v)=>setCf({...cf,carbs:v})} />
              <LabeledInput label="당류 g" v={cf.sugar} on={(v)=>setCf({...cf,sugar:v})} />
            </div>
            <div style={{ display:"flex", gap:6, marginTop:8 }}>
              <LabeledInput label="지방 g" v={cf.fat} on={(v)=>setCf({...cf,fat:v})} />
              <LabeledInput label="칼로리 kcal" v={cf.kcal} on={(v)=>setCf({...cf,kcal:v})} />
            </div>

            <div style={{ fontSize:11, color:C.muted, fontWeight:700, margin:"14px 0 6px" }}>1인분 무게 <span style={{ opacity:0.7 }}>(선택 · g 단위로 먹은 양 계산할 때 사용)</span></div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <LabeledInput label="1인분 = ?g" v={cf.gramsPerServing} on={(v)=>setCf({...cf,gramsPerServing:v})} />
              <div style={{ display:"flex", gap:5 }}>
                {[30,100,200,350].map((g)=>(
                  <button key={g} onClick={()=>setCf({...cf, gramsPerServing:String(g)})} style={{...chip(String(g)===String(cf.gramsPerServing), TYPES.legs.color), padding:"7px 9px", fontSize:11.5}}>{g}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize:10.5, color:C.muted, marginTop:6, lineHeight:1.5 }}>
              위에 적은 영양성분이 <b style={{color:C.text}}>몇 g 기준</b>인지예요. 비워두면 카테고리 평균으로 어림잡아서 "≈300g" 같이 부정확하게 표시돼요.
            </div>

            <div style={{ fontSize:11, color:C.muted, fontWeight:700, margin:"14px 0 6px" }}>수분량 <span style={{ opacity:0.7 }}>(음료일 때만 · 물 자동 반영)</span></div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <LabeledInput label="수분 ml" v={cf.liquidMl} on={(v)=>setCf({...cf,liquidMl:v})} />
              <div style={{ display:"flex", gap:5 }}>
                {[250,355,500].map((ml)=>(
                  <button key={ml} onClick={()=>setCf({...cf, liquidMl:String(ml)})} style={{...chip(String(ml)===String(cf.liquidMl), "#6BC5F0"), padding:"7px 9px", fontSize:11.5}}>{ml}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize:10.5, color:C.muted, marginTop:6, lineHeight:1.5 }}>
              단백질 음료·주스 등 마시는 거면 ml를 넣어주세요. 추가할 때 물 트래커에 자동으로 더해져요. (음식이면 비워두세요.)
            </div>
            {num(cf.liquidMl)>0 && (
              <div onClick={()=>setCf({...cf, fixedLiquid:!cf.fixedLiquid})}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginTop:8, padding:"10px 12px", borderRadius:10, cursor:"pointer",
                  background: cf.fixedLiquid?tint("#6BC5F0",0.13):C.surface2, border:`1.5px solid ${cf.fixedLiquid?"#6BC5F0":C.line}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:800, color: cf.fixedLiquid?"#6BC5F0":C.text }}>💧 수분 고정</div>
                  <div style={{ fontSize:10.5, color:C.muted, marginTop:2, lineHeight:1.45 }}>보충제처럼 양(인분)이 늘어도 물은 그대로일 때. 켜면 몇 인분을 먹든 {num(cf.liquidMl)}ml만 반영돼요.</div>
                </div>
                <div style={{ width:40, height:23, borderRadius:99, flexShrink:0, background: cf.fixedLiquid?"#6BC5F0":C.line, position:"relative", transition:"background .2s" }}>
                  <div style={{ width:19, height:19, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left: cf.fixedLiquid?18:2, transition:"left .2s" }} />
                </div>
              </div>
            )}

            <button onClick={addCustomFood} disabled={!cf.name.trim()}
              style={{...primary(TYPES.legs.color), width:"100%", marginTop:12, opacity:cf.name.trim()?1:0.45}}>
              내 음식으로 저장
            </button>
          </>
        )}
      </Card>

      {/* 결과 헤더 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", margin:"18px 2px 8px" }}>
        <span style={{ fontSize:12.5, color:C.text, fontWeight:700 }}>{contextLabel()}</span>
        <span style={{ fontSize:11.5, color:C.muted }}>{results.length}개</span>
      </div>

      {/* 결과 목록 */}
      {results.length===0 ? (
        <Card>
          <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:"18px 0", lineHeight:1.7 }}>
            찾는 음식이 없어요.<br/>
            <span style={{ color:TYPES.legs.color, fontWeight:700 }}>+ 내 음식 등록</span>으로 직접 추가해보세요.
          </div>
        </Card>
      ) : results.map((e)=>(
        <div key={(e.custom?"c:":"")+e.key} style={{ background:C.surface,
          border:`1px solid ${e.custom?tint(TYPES.legs.color,0.45):C.line}`,
          borderRadius:14, padding:"14px", marginTop:8 }}>

          {/* 이름 + 뱃지 */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                <span style={{ fontSize:15, fontWeight:800, letterSpacing:-0.2 }}>{e.key}</span>
                {e.custom && <span style={{ fontSize:9.5, fontWeight:800, color:"#141519", background:TYPES.legs.color, borderRadius:5, padding:"2px 6px" }}>{e.aliases?.length>1?"수정됨":"내 음식"}</span>}
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{displayCat(e)} · {servingLabel(e)}</div>
            </div>
            <button onClick={()=>setEditKey(editKey===e.key?null:e.key)} title="수정" style={{ ...xBtn, fontSize:14 }}>✏️</button>
            {e.custom && <button onClick={()=>removeCustomFood(e.key)} style={xBtn}>×</button>}
          </div>

          {editKey===e.key && (
            <DBFoodEdit entry={e} onSave={(patch)=>saveEdit(e, patch)} onCancel={()=>setEditKey(null)} />
          )}

          {/* 영양성분 표 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:4, marginTop:12,
            background:C.surface2, borderRadius:10, padding:"10px 6px" }}>
            <NutriCell label="단백질" value={`${e.protein}g`} color={TYPES.legs.color} />
            <NutriCell label="탄수" value={`${e.carbs}g`} />
            <NutriCell label="당류" value={`${e.sugar}g`} />
            <NutriCell label="지방" value={`${e.fat}g`} />
            <NutriCell label="칼로리" value={`${e.kcal}`} color={C.text} bold />
          </div>

          {e.liquidMl>0 && (
            <div style={{ fontSize:11, color:"#6BC5F0", fontWeight:700, marginTop:8 }}>💧 수분 {e.liquidMl}ml{e.fixedLiquid?" 고정":""} · {e.fixedLiquid?`양과 무관하게 물 ${Math.round(e.liquidMl/250*10)/10}잔 반영`:`추가 시 물 ${Math.round(e.liquidMl/250*10)/10}잔 자동 반영`}</div>
          )}

          {/* 수량 선택 (인분 칩) */}
          <div style={{ display:"flex", gap:5, marginTop:10, alignItems:"center" }}>
            {[0.5,1,1.5,2].map((m)=>{
              const active = (gramMode[e.key]==null||gramMode[e.key]==="") && (qty[e.key]||1)===m;
              return (
                <button key={m} onClick={()=>{ setQty((s)=>({ ...s, [e.key]:m })); setGramMode((s)=>({ ...s, [e.key]:"" })); }}
                  style={{ ...chip(active, TYPES.push.color), flex:1, textAlign:"center", padding:"8px 0", fontSize:12 }}>
                  {m===0.5?"½":m}인분
                </button>
              );
            })}
          </div>
          {/* g 직접 입력 */}
          <div style={{ display:"flex", gap:6, marginTop:6, alignItems:"center" }}>
            <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>또는 직접</span>
            <div style={{ position:"relative", flex:1 }}>
              <input value={gramMode[e.key]||""} onChange={(ev)=>setGramMode((s)=>({ ...s, [e.key]:ev.target.value }))}
                inputMode="decimal" placeholder={`${gramsPerServing(e)} = 1인분`}
                style={{...inp, width:"100%", boxSizing:"border-box", padding:"7px 26px 7px 10px", fontSize:12.5,
                  borderColor: (gramMode[e.key]&&num(gramMode[e.key])>0)?TYPES.push.color:C.line}} />
              <span style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)", fontSize:11, color:C.muted }}>g</span>
            </div>
          </div>
          <button onClick={()=>addToToday(e)} style={{...ghost, width:"100%", marginTop:8,
            color:added[e.key]?TYPES.legs.color:C.muted, borderColor:added[e.key]?TYPES.legs.color:C.line }}>
            {added[e.key]?"오늘 식단에 추가됨 ✓":(()=>{ const mult=multOf(e); const isNon=Math.abs(mult-1)>0.001; const g=gramMode[e.key]; const usingG=g&&num(g)>0;
              return `오늘 식단에 추가${isNon?` (${usingG?`${num(g)}g`:`${Math.round(mult*100)/100}인분`} · ${Math.round(e.kcal*mult)}kcal)`:""}`; })()}
          </button>
        </div>
      ))}
    </div>
  );
}

// 음식 DB 항목 편집 폼 (이름·영양·수분 수정 → override 저장)
function DBFoodEdit({ entry, onSave, onCancel }) {
  const [v, setV] = useState({
    key: entry.key, protein:String(num(entry.protein)), carbs:String(num(entry.carbs)),
    sugar:String(num(entry.sugar)), fat:String(num(entry.fat)), kcal:String(num(entry.kcal)),
    liquidMl:String(num(entry.liquidMl)), fixedLiquid: !!entry.fixedLiquid,
    gramsPerServing: entry.gramsPerServing ? String(entry.gramsPerServing) : "",
  });
  const F = (label, key, wide) => (
    <div style={{ flex:wide?"1 1 100%":1, minWidth:60 }}>
      <div style={{ fontSize:9.5, color:C.muted, marginBottom:3 }}>{label}</div>
      <input value={v[key]} onChange={(ev)=>setV({...v,[key]:ev.target.value})} inputMode={key==="key"?"text":"decimal"}
        style={{...inp, width:"100%", boxSizing:"border-box", padding:"8px", fontSize:13}} />
    </div>
  );
  return (
    <div style={{ background:C.surface2, borderRadius:12, padding:"12px", marginTop:12 }}>
      <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:7 }}>음식 정보 수정 <span style={{opacity:0.7}}>(1인분 기준)</span></div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>{F("이름","key",true)}</div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:7 }}>
        {F("단백질 g","protein")}{F("탄수 g","carbs")}{F("당류 g","sugar")}
      </div>
      <div style={{ display:"flex", gap:6, marginTop:7 }}>
        {F("지방 g","fat")}{F("칼로리","kcal")}{F("수분 ml","liquidMl")}
      </div>
      <div style={{ marginTop:9, padding:"9px 11px", borderRadius:9, background:C.surface, border:`1px solid ${num(v.gramsPerServing)>0?tint(TYPES.legs.color,0.4):C.line}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:800, color: num(v.gramsPerServing)>0?TYPES.legs.color:C.text }}>⚖️ 1인분 무게</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2, lineHeight:1.45 }}>
              {num(v.gramsPerServing)>0
                ? `위 영양성분이 ${num(v.gramsPerServing)}g 기준이에요`
                : `미지정 — 지금은 ≈${gramsPerServing(entry)}g로 어림잡는 중`}
            </div>
          </div>
          <div style={{ width:76, flexShrink:0 }}>
            <input value={v.gramsPerServing} onChange={(ev)=>setV({...v, gramsPerServing:ev.target.value.replace(/[^0-9.]/g,"")})}
              inputMode="decimal" placeholder="예: 25"
              style={{...inp, width:"100%", boxSizing:"border-box", padding:"8px", fontSize:13, textAlign:"center"}} />
          </div>
        </div>
      </div>
      {num(v.liquidMl)>0 && (
        <div onClick={()=>setV({...v, fixedLiquid:!v.fixedLiquid})}
          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginTop:8, padding:"9px 11px", borderRadius:9, cursor:"pointer",
            background: v.fixedLiquid?tint("#6BC5F0",0.13):C.surface, border:`1.5px solid ${v.fixedLiquid?"#6BC5F0":C.line}` }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:800, color: v.fixedLiquid?"#6BC5F0":C.text }}>💧 수분 고정</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2, lineHeight:1.45 }}>보충제처럼 인분이 늘어도 물은 {num(v.liquidMl)}ml 그대로 반영</div>
          </div>
          <div style={{ width:38, height:22, borderRadius:99, flexShrink:0, background: v.fixedLiquid?"#6BC5F0":C.line, position:"relative", transition:"background .2s" }}>
            <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left: v.fixedLiquid?18:2, transition:"left .2s" }} />
          </div>
        </div>
      )}
      <div style={{ fontSize:10.5, color:C.muted, marginTop:8, lineHeight:1.5 }}>
        수정하면 내 음식으로 저장돼서, 다음부터 검색·기록할 때 이 값이 쓰여요.
      </div>
      <div style={{ display:"flex", gap:8, marginTop:10 }}>
        <button onClick={onCancel} style={{...ghost, flex:1}}>취소</button>
        <button onClick={()=>onSave({ key:v.key.trim()||entry.key, protein:num(v.protein), carbs:num(v.carbs), sugar:num(v.sugar), fat:num(v.fat), kcal:num(v.kcal), liquidMl:num(v.liquidMl), fixedLiquid:v.fixedLiquid, gramsPerServing:num(v.gramsPerServing) })}
          style={{...primary(TYPES.legs.color), flex:2}}>저장</button>
      </div>
    </div>
  );
}

// ================= 외식 =================
const RATING = { best:{label:"추천",color:"#B6E34B"}, good:{label:"무난",color:"#35C4D8"}, caution:{label:"주의",color:"#FF7A7A"} };
function Dining({ addFoodsToday, apiKey, customFoods, embedded }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [added, setAdded] = useState({});

  const ask = async () => {
    if(!text.trim()||loading) return;
    setLoading(true); setErr(""); setResult(null); setAdded({});
    try {
      if (!apiKey || !apiKey.trim()) {
        const local = localBrandSearch(text.trim(), customFoods);
        if (!local.length) throw new Error("API 키가 없어서 로컬 목록에서만 찾을 수 있어요. 이 메뉴/브랜드는 목록에 없어요. 키를 넣거나 다른 이름으로 검색해보세요.");
        const ranked = [...local].sort((a,b)=> (b.protein/Math.max(b.kcal,1)) - (a.protein/Math.max(a.kcal,1))).slice(0,5)
          .map((e,i)=>({ name:e.key, protein:e.protein, carbs:e.carbs, sugar:e.sugar, fat:e.fat, kcal:e.kcal, liquidMl:e.liquidMl||0, rating: i===0?"best":"good", reason:"로컬 추정치 · 단백질/칼로리 비율 기준" }));
        setResult({ picks: ranked, tip: "API 키가 없어서 로컬 목록 기준으로 정렬했어요. 더 폭넓은 추천은 API 키를 등록하면 볼 수 있어요." });
        return;
      }
      const raw = await callClaudeAPI(apiKey, MENU_PROMPT+text.trim());
      const parsed = extractJSON(raw);
      if(!parsed.picks||!parsed.picks.length) throw new Error("추천을 못 읽었어요");
      setResult(parsed);
    } catch(e){ setErr(`추천 실패: ${e.message}`); } finally { setLoading(false); }
  };
  const add = (p,idx)=>{ addFoodsToday([{ id:uid(), name:p.name, protein:num(p.protein), carbs:num(p.carbs), sugar:num(p.sugar), fat:num(p.fat), kcal:num(p.kcal), liquidMl:num(p.liquidMl) }]); setAdded((a)=>({ ...a, [idx]:true })); };

  return (
    <div style={{ padding: embedded ? "0" : "22px 18px 8px" }}>
      {!embedded && <>
        <div style={{ fontSize:11, letterSpacing:3, color:TYPES.push.color, fontWeight:800 }}>DINING</div>
        <div style={{ fontSize:30, fontWeight:800, letterSpacing:-1, marginTop:4 }}>외식 메뉴 고르기</div>
      </>}
      <div style={{ fontSize:13, color:C.muted, marginTop:embedded?14:6, lineHeight:1.5 }}>음식점이나 고민 중인 메뉴를 적으면 단백질·건강 기준으로 추천해줘요. 유명 프랜차이즈는 API 키 없이도 무료로 바로 찾아져요.</div>
      <Card>
        <textarea value={text} onChange={(e)=>setText(e.target.value)} rows={3}
          placeholder={"예: 맥도날드\n예: 빅맥이랑 맥치킨 중 뭐가 나아?\n예: 롯데리아 불고기버거, 새우버거"}
          style={{...inp, width:"100%", boxSizing:"border-box", resize:"none", lineHeight:1.4, fontFamily:"inherit"}} />
        <button onClick={ask} disabled={loading} style={{...primary(TYPES.push.color), width:"100%", marginTop:8, opacity:loading?0.6:1}}>{loading?"고르는 중…":"추천 받기"}</button>
        {err && <div style={{ fontSize:12, color:C.danger, marginTop:8 }}>{err}</div>}
      </Card>
      {result && (<>
        {result.tip && <div style={{ background:tint(TYPES.push.color,0.12), border:`1px solid ${tint(TYPES.push.color,0.4)}`, borderRadius:14, padding:"12px 14px", marginTop:12, fontSize:13, lineHeight:1.5 }}>{result.tip}</div>}
        {result.picks.map((p,idx)=>{ const r=RATING[p.rating]||RATING.good;
          return (<Card key={idx}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:15, fontWeight:800 }}>{p.name}</span>
              <span style={{ fontSize:10.5, fontWeight:800, color:"#141519", background:r.color, borderRadius:6, padding:"2px 7px" }}>{r.label}</span>
            </div>
            <div style={{ fontSize:13, color:C.muted, marginTop:5 }}>단백질 <span style={{ color:TYPES.legs.color, fontWeight:700 }}>{num(p.protein)}g</span> · 탄수 {num(p.carbs)}g · 당 {num(p.sugar)}g · 지방 {num(p.fat)}g · {num(p.kcal)}kcal</div>
            {p.reason && <div style={{ fontSize:12.5, color:C.muted, marginTop:5, lineHeight:1.45 }}>{p.reason}</div>}
            <button onClick={()=>add(p,idx)} disabled={added[idx]} style={{...ghost, width:"100%", marginTop:10, color:added[idx]?TYPES.legs.color:C.muted, borderColor:added[idx]?TYPES.legs.color:C.line }}>{added[idx]?"오늘 식단에 추가됨 ✓":"오늘 식단에 추가"}</button>
          </Card>); })}
      </>)}
    </div>
  );
}

// ================= 공부 =================
function Study({ data, persist, mutate }) {
  const [view, setView] = useState("dash"); // dash | log | vocab
  const study = data.study||[];
  const tk = todayKey();
  const days = last7();
  const todayMin = study.filter(s=>s.date===tk).reduce((a,s)=>a+s.minutes,0);
  const weekMin = study.filter(s=>days.includes(s.date)).reduce((a,s)=>a+s.minutes,0);

  const tabs = (
    <div style={{ display:"flex", gap:6, marginTop:14 }}>
      {[["dash","📊 현황"],["log","✍️ 기록"],["vocab","📖 단어장"]].map(([k,label])=>(
        <button key={k} onClick={()=>setView(k)} style={{ flex:1, padding:"10px 0", borderRadius:11, cursor:"pointer",
          border:`1.5px solid ${view===k?STUDY_ACCENT:C.line}`,
          background: view===k?tint(STUDY_ACCENT,0.15):C.surface,
          color: view===k?STUDY_ACCENT:C.muted, fontSize:12.5, fontWeight:800 }}>{label}</button>
      ))}
    </div>
  );

  return (
    <div style={{ padding:"22px 18px 8px" }}>
      <div style={{ fontSize:11, letterSpacing:3, color:STUDY_ACCENT, fontWeight:800 }}>STUDY</div>
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginTop:4 }}>
        <span style={{ fontSize:29, fontWeight:800, letterSpacing:-1 }}>공부</span>
        <span style={{ fontSize:12, color:C.muted }}>오늘 <b style={{color:STUDY_ACCENT}}>{fmtMin(todayMin)}</b> · 주 {fmtMin(weekMin)}</span>
      </div>
      {tabs}

      {view==="dash"  && <StudyDash data={data} persist={persist} mutate={mutate} days={days} />}
      {view==="log"   && <StudyLog data={data} persist={persist} mutate={mutate} days={days} />}
      {view==="vocab" && <StudyVocab data={data} mutate={mutate} apiKey={data.profile.apiKey} />}
    </div>
  );
}

// ---------- 현황: D-day·목표점수·점수추이·주간목표 ----------
function StudyDash({ data, persist, mutate, days }) {
  const study = data.study||[];
  const [scoreType, setScoreType] = useState("토익");
  const [scoreLine, setScoreLine] = useState("total"); // total | lc | rc
  const [examOpen, setExamOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [exam, setExam] = useState({ name:"", date:"" });
  const [score, setScore] = useState({ date:todayKey(), type:"토익", val:"", lc:"", rc:"" });

  const dayTotals = days.map(dk=>study.filter(s=>s.date===dk).reduce((a,s)=>a+s.minutes,0));
  const dday = (dstr)=>{ const [y,m,d]=dstr.split("-").map(Number); const t=new Date(); t.setHours(0,0,0,0);
    return Math.round((new Date(y,m-1,d)-t)/86400000); };
  const examsSorted = [...data.exams].sort((a,b)=>a.date.localeCompare(b.date));

  const addExam = () => { if(!exam.name.trim()||!exam.date) return;
    persist({ ...data, exams:[...data.exams, { id:uid(), name:exam.name.trim(), date:exam.date }] });
    setExam({ name:"", date:"" }); setExamOpen(false); };
  const rmExam = (id)=> persist({ ...data, exams:data.exams.filter(e=>e.id!==id) });

  const addScore = () => { if(!score.val && !score.lc && !score.rc) return;
    const lc=num(score.lc), rc=num(score.rc);
    const total = num(score.val) || (lc+rc);
    persist({ ...data, scores:[...data.scores, { id:uid(), date:score.date, type:score.type, score:total,
      ...(lc>0?{lc}:{}), ...(rc>0?{rc}:{}) }] });
    setScore({ date:todayKey(), type:score.type, val:"", lc:"", rc:"" }); setScoreOpen(false); };
  const rmScore = (id)=> persist({ ...data, scores:data.scores.filter(s=>s.id!==id) });

  const scoreTypes = Array.from(new Set(["토익", ...data.scores.map(s=>s.type)]));
  const typeScores = data.scores.filter(s=>s.type===scoreType).sort((a,b)=>a.date.localeCompare(b.date));
  const pick = (s)=> scoreLine==="lc" ? s.lc : scoreLine==="rc" ? s.rc : s.score;
  const scorePts = typeScores.filter(s=>pick(s)!=null).map(s=>({ label:s.date.slice(5).replace("-","."), value:num(pick(s)) }));
  const latest = typeScores.length ? typeScores[typeScores.length-1] : null;
  const hasLcRc = typeScores.some(s=>s.lc!=null||s.rc!=null);

  // 목표 점수
  const target = num((data.targetScore||{})[scoreType]) || 0;
  const setTarget = (v)=> mutate((prev)=>({ ...prev, targetScore:{ ...(prev.targetScore||{}), [scoreType]: Math.round(num(v)) } }));
  const gap = (target && latest) ? target - num(latest.score) : null;
  // 해당 시험의 가장 가까운 D-day
  const relExam = examsSorted.find(e=> e.name.includes(scoreType) && dday(e.date)>=0 );

  const usedSubjects = Array.from(new Set([...DEFAULT_SUBJECTS, ...study.map((s)=>s.subject)]));
  const weekBySubject = (subj)=> study.filter(s=>days.includes(s.date)&&s.subject===subj).reduce((a,s)=>a+s.minutes,0);
  const setGoal = (subj, hours) => mutate((prev)=>({ ...prev, studyGoals:{ ...prev.studyGoals, [subj]: Math.round(num(hours)*60) } }));
  // 목표가 있거나 이번 주 공부한 과목만 — 안 쓰는 과목으로 화면이 길어지지 않게
  const shownSubjects = usedSubjects.filter(s=> (data.studyGoals[s]||0)>0 || weekBySubject(s)>0 );

  return (
    <div>
      {/* 목표 점수 + D-day */}
      <Card>
        <Row><span style={lbl}>{scoreType} 목표</span>
          {relExam && <span style={{ fontSize:12, fontWeight:800, color: dday(relExam.date)<=7?C.danger:STUDY_ACCENT }}>
            D-{dday(relExam.date)}</span>}
        </Row>
        <div style={{ display:"flex", alignItems:"flex-end", gap:10, marginTop:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10.5, color:C.muted, marginBottom:4 }}>목표 점수</div>
            <input value={target||""} onChange={(e)=>setTarget(e.target.value.replace(/[^0-9]/g,""))}
              inputMode="numeric" placeholder="예: 800"
              style={{...inp, width:"100%", boxSizing:"border-box", fontSize:19, fontWeight:800, textAlign:"center", padding:"9px"}} />
          </div>
          <div style={{ flex:1, minWidth:0, textAlign:"center" }}>
            <div style={{ fontSize:10.5, color:C.muted, marginBottom:4 }}>최근 점수</div>
            <div style={{ fontSize:22, fontWeight:800, color: latest?C.text:C.muted, padding:"6px 0" }}>
              {latest ? latest.score : "—"}
            </div>
          </div>
        </div>
        {target>0 && latest && (
          <div style={{ marginTop:12 }}>
            <div style={{ height:8, background:C.surface2, borderRadius:99, overflow:"hidden" }}>
              <div style={{ width:`${Math.min(100,Math.round(num(latest.score)/target*100))}%`, height:"100%",
                background:`linear-gradient(90deg, ${tint(STUDY_ACCENT,0.5)}, ${STUDY_ACCENT})`, borderRadius:99, transition:"width .4s" }} />
            </div>
            <div style={{ fontSize:11.5, marginTop:7, fontWeight:700, color: gap<=0?TYPES.legs.color:C.muted }}>
              {gap<=0 ? "🎉 목표 달성!" : `목표까지 ${gap}점`}
              {relExam && dday(relExam.date)>0 && gap>0 ? ` · ${relExam.name}까지 ${dday(relExam.date)}일` : ""}
            </div>
          </div>
        )}
        {target>0 && !latest && (
          <div style={{ fontSize:11, color:C.muted, marginTop:10 }}>점수를 기록하면 목표까지 얼마나 남았는지 보여줘요</div>
        )}
      </Card>

      {/* 점수 추이 */}
      <Card>
        <Row><span style={lbl}>점수 추이</span>
          <button onClick={()=>setScoreOpen(v=>!v)} style={{ background:"none", border:"none", color:STUDY_ACCENT,
            fontSize:12, fontWeight:800, cursor:"pointer", padding:0 }}>{scoreOpen?"닫기":"+ 점수"}</button>
        </Row>
        {scoreTypes.length>1 && (
          <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
            {scoreTypes.map((tp)=>(<button key={tp} onClick={()=>setScoreType(tp)} style={{...chip(scoreType===tp,STUDY_ACCENT), padding:"5px 11px", fontSize:11.5}}>{tp}</button>))}
          </div>
        )}
        {hasLcRc && (
          <div style={{ display:"flex", gap:5, marginTop:9 }}>
            {[["total","총점"],["lc","LC"],["rc","RC"]].map(([k,label])=>(
              <button key={k} onClick={()=>setScoreLine(k)}
                style={{...chip(scoreLine===k, k==="lc"?"#5AA9FF":k==="rc"?"#FFB74B":STUDY_ACCENT), padding:"5px 12px", fontSize:11.5}}>{label}</button>
            ))}
          </div>
        )}
        <LineChart points={scorePts} color={scoreLine==="lc"?"#5AA9FF":scoreLine==="rc"?"#FFB74B":STUDY_ACCENT}
          empty="점수를 2회 이상 기록하면 그래프가 나와요." />

        {/* LC/RC 균형 */}
        {latest && latest.lc!=null && latest.rc!=null && (
          <div style={{ marginTop:12, padding:"11px 12px", background:C.surface2, borderRadius:10 }}>
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>최근 회차 LC · RC 균형</div>
            {[["LC",num(latest.lc),"#5AA9FF"],["RC",num(latest.rc),"#FFB74B"]].map(([label,v,col])=>(
              <div key={label} style={{ display:"flex", alignItems:"center", gap:9, marginBottom:6 }}>
                <span style={{ fontSize:11.5, fontWeight:800, color:col, width:24 }}>{label}</span>
                <div style={{ flex:1, height:12, background:C.line, borderRadius:99, overflow:"hidden" }}>
                  <div style={{ width:`${Math.min(100,Math.round(v/495*100))}%`, height:"100%", background:col, borderRadius:99 }} />
                </div>
                <span style={{ fontSize:11.5, fontWeight:800, color:col, width:52, textAlign:"right" }}>{v}<span style={{fontSize:9,color:C.muted}}>/495</span></span>
              </div>
            ))}
            <div style={{ fontSize:10.5, color:C.muted, marginTop:4, lineHeight:1.5 }}>
              {Math.abs(num(latest.lc)-num(latest.rc))>=60
                ? `${num(latest.lc)<num(latest.rc)?"LC":"RC"}가 ${Math.abs(num(latest.lc)-num(latest.rc))}점 낮아요 — 여기에 시간을 더 써보세요`
                : "두 영역이 고르게 나오고 있어요 👍"}
            </div>
          </div>
        )}

        {scoreOpen && (
          <div style={{ marginTop:12, padding:"12px", background:C.surface2, borderRadius:11 }}>
            <div style={{ display:"flex", gap:6 }}>
              <input value={score.type} onChange={(e)=>setScore({...score,type:e.target.value})} placeholder="시험명" style={{...inp, flex:1, minWidth:0}} />
              <input value={score.val} onChange={(e)=>setScore({...score,val:e.target.value.replace(/[^0-9]/g,"")})} placeholder="총점" inputMode="numeric" style={{...inp, width:74, minWidth:0}} />
            </div>
            {score.type.includes("토익") && (
              <div style={{ display:"flex", gap:6, marginTop:6 }}>
                <input value={score.lc} onChange={(e)=>setScore({...score,lc:e.target.value.replace(/[^0-9]/g,"")})} placeholder="LC (선택)" inputMode="numeric" style={{...inp, flex:1, minWidth:0}} />
                <input value={score.rc} onChange={(e)=>setScore({...score,rc:e.target.value.replace(/[^0-9]/g,"")})} placeholder="RC (선택)" inputMode="numeric" style={{...inp, flex:1, minWidth:0}} />
              </div>
            )}
            <div style={{ display:"flex", gap:6, marginTop:6 }}>
              <input type="date" value={score.date} onChange={(e)=>setScore({...score,date:e.target.value})} style={{...inp, flex:1, minWidth:0, colorScheme:"dark"}} />
              <button onClick={addScore} style={primary(STUDY_ACCENT)}>추가</button>
            </div>
            <div style={{ fontSize:10, color:C.muted, marginTop:7 }}>LC·RC만 넣으면 총점은 자동으로 더해져요</div>
          </div>
        )}

        {data.scores.length>0 && (
          <div style={{ marginTop:10 }}>
            {[...data.scores].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4).map((s)=>(
              <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${C.line}`, fontSize:12.5 }}>
                <span style={{ color:C.muted }}>{s.date.slice(2).replace(/-/g,".")} · {s.type}
                  {s.lc!=null&&s.rc!=null ? <span style={{ fontSize:10.5, marginLeft:5 }}>(LC {s.lc}·RC {s.rc})</span> : ""}
                </span>
                <span style={{ display:"flex", alignItems:"center", gap:8 }}><b>{s.score}</b><button onClick={()=>rmScore(s.id)} style={xBtn}>×</button></span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* D-day */}
      <Card>
        <Row><span style={lbl}>시험 D-day</span>
          <button onClick={()=>setExamOpen(v=>!v)} style={{ background:"none", border:"none", color:STUDY_ACCENT,
            fontSize:12, fontWeight:800, cursor:"pointer", padding:0 }}>{examOpen?"닫기":"+ 시험"}</button>
        </Row>
        {examsSorted.length===0 && !examOpen && (
          <div style={{ fontSize:12, color:C.muted, marginTop:10 }}>시험 날짜를 등록하면 D-day가 표시돼요</div>
        )}
        {examsSorted.map((e)=>{ const d=dday(e.date);
          return (<div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${C.line}` }}>
            <div><div style={{ fontSize:13.5, fontWeight:700 }}>{e.name}</div><div style={{ fontSize:11.5, color:C.muted }}>{e.date.replace(/-/g,".")}</div></div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:16, fontWeight:800, color:d<0?C.muted:d<=7?C.danger:STUDY_ACCENT }}>{d===0?"D-DAY":d>0?`D-${d}`:`D+${-d}`}</span>
              <button onClick={()=>rmExam(e.id)} style={xBtn}>×</button>
            </div>
          </div>); })}
        {examOpen && (
          <div style={{ marginTop:10, padding:"12px", background:C.surface2, borderRadius:11 }}>
            <input value={exam.name} onChange={(e)=>setExam({...exam,name:e.target.value})} placeholder="시험명 (예: 토익 정기시험)" style={{...inp, width:"100%", boxSizing:"border-box"}} />
            <div style={{ display:"flex", gap:6, marginTop:6 }}>
              <input type="date" value={exam.date} onChange={(e)=>setExam({...exam,date:e.target.value})} style={{...inp, flex:1, minWidth:0, colorScheme:"dark"}} />
              <button onClick={addExam} style={primary(STUDY_ACCENT)}>추가</button>
            </div>
          </div>
        )}
      </Card>

      {/* 최근 7일 */}
      <Card>
        <Row><span style={lbl}>최근 7일</span></Row>
        <div style={{ marginTop:12 }}><Bars7 values={dayTotals} color={STUDY_ACCENT} hoursLabel /></div>
      </Card>

      {/* 주간 목표 */}
      <Card>
        <Row><span style={lbl}>과목별 주간 목표</span></Row>
        {shownSubjects.length===0 ? (
          <div style={{ fontSize:12, color:C.muted, marginTop:10, lineHeight:1.6 }}>
            기록을 남기거나 목표 시간을 넣으면 여기에 진행률이 표시돼요.
          </div>
        ) : shownSubjects.map((subj)=>{ const goal=data.studyGoals[subj]||0; const done=weekBySubject(subj); const pct=goal?Math.min(100,Math.round(done/goal*100)):0;
          return (<div key={subj} style={{ marginTop:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <span style={{ width:8, height:8, borderRadius:3, background:colorForSubject(subj) }} />
                <span style={{ fontSize:13, fontWeight:700 }}>{subj}</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.muted }}>
                <span>{fmtMin(done)} /</span>
                <input value={goal?goal/60:""} onChange={(e)=>setGoal(subj,e.target.value)} inputMode="decimal" placeholder="0"
                  style={{ ...inp, width:46, padding:"5px 6px", textAlign:"center", fontSize:12 }} /><span>시간</span>
              </div>
            </div>
            {goal>0 && <div style={{ height:6, background:C.surface2, borderRadius:99, marginTop:6, overflow:"hidden" }}>
              <div style={{ width:`${pct}%`, height:"100%", background:colorForSubject(subj), borderRadius:99 }} /></div>}
          </div>); })}
      </Card>
    </div>
  );
}

// ---------- 기록: 공부 기록 추가 + 이력 ----------
function StudyLog({ data, persist, mutate, days }) {
  const study = data.study||[];
  const [subject, setSubject] = useState("토익");
  const [customOn, setCustomOn] = useState(false);
  const [custom, setCustom] = useState("");
  const [part, setPart] = useState("lc");
  const [minutes, setMinutes] = useState(60);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayKey());
  const [showAll, setShowAll] = useState(false);
  const [histSubject, setHistSubject] = useState("전체");

  const usedSubjects = Array.from(new Set([...DEFAULT_SUBJECTS, ...study.map((s)=>s.subject)]));
  const finalSubject = customOn?custom.trim():subject;
  const isToeic = finalSubject.includes("토익");

  const add = () => { if(!finalSubject||minutes<=0) return;
    persist({ ...data, study:[...study, { id:uid(), date, subject:finalSubject, minutes:num(minutes),
      note:note.trim(), ...(isToeic?{part}:{}) }] });
    setNote(""); setMinutes(60); setCustom(""); setCustomOn(false); };
  const rm = (id)=> persist({ ...data, study:study.filter(s=>s.id!==id) });

  // 토익 파트별 이번 주 시간
  const weekToeic = study.filter(s=>days.includes(s.date) && s.subject.includes("토익"));
  const partTotals = TOEIC_PARTS.map(p=>({ ...p, min: weekToeic.filter(s=>s.part===p.k).reduce((a,s)=>a+s.minutes,0) }));
  const partMax = Math.max(1, ...partTotals.map(p=>p.min));
  const hasPartData = partTotals.some(p=>p.min>0);

  const sortedDesc = [...study].sort((a,b)=>b.date.localeCompare(a.date));
  const histSubjects = ["전체", ...Array.from(new Set(study.map(s=>s.subject)))];
  const filtered = histSubject==="전체" ? sortedDesc : sortedDesc.filter(s=>s.subject===histSubject);
  const shown = showAll ? filtered.slice(0,200) : filtered.slice(0,6);
  const QUICK = [30,60,90,120];

  return (
    <div>
      {/* 기록 추가 */}
      <Card>
        <Row><span style={lbl}>공부 기록 추가</span></Row>
        <div style={{ fontSize:11, color:C.muted, margin:"12px 0 6px" }}>과목</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
          {usedSubjects.map((s)=>{ const on=!customOn&&subject===s;
            return <button key={s} onClick={()=>{setCustomOn(false);setSubject(s);}} style={chip(on,colorForSubject(s))}>{s}</button>; })}
          <button onClick={()=>setCustomOn(true)} style={chip(customOn,STUDY_ACCENT)}>+ 직접</button>
        </div>
        {customOn && <input value={custom} onChange={(e)=>setCustom(e.target.value)} placeholder="과목명 (예: SQLD)" style={{...inp, width:"100%", boxSizing:"border-box", marginTop:8}} />}

        {/* 토익이면 파트 선택 */}
        {isToeic && (<>
          <div style={{ fontSize:11, color:C.muted, margin:"16px 0 6px" }}>영역</div>
          <div style={{ display:"flex", gap:6 }}>
            {TOEIC_PARTS.map((p)=>(
              <button key={p.k} onClick={()=>setPart(p.k)} style={{ flex:1, minWidth:0, padding:"9px 3px", borderRadius:10, cursor:"pointer",
                border:`1.5px solid ${part===p.k?p.color:C.line}`, background: part===p.k?tint(p.color,0.15):C.surface2,
                color: part===p.k?p.color:C.muted }}>
                <div style={{ fontSize:12.5, fontWeight:800 }}>{p.label}</div>
                <div style={{ fontSize:8.5, color:C.muted, marginTop:1 }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </>)}

        <div style={{ fontSize:11, color:C.muted, margin:"16px 0 6px" }}>시간 · <b style={{ color:STUDY_ACCENT }}>{fmtMin(minutes)}</b></div>
        <div style={{ display:"flex", gap:6 }}>
          {QUICK.map((q)=>(<button key={q} onClick={()=>setMinutes(q)} style={{...chip(minutes===q,STUDY_ACCENT), flex:1, textAlign:"center"}}>{fmtMin(q)}</button>))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:C.surface2, borderRadius:10, padding:"6px 10px", marginTop:8 }}>
          <button onClick={()=>setMinutes(m=>Math.max(0,m-10))} style={stepBtn}>–</button>
          <span style={{ flex:1, textAlign:"center", fontWeight:800 }}>{minutes}분</span>
          <button onClick={()=>setMinutes(m=>m+10)} style={stepBtn}>+</button>
        </div>
        <input value={note} onChange={(e)=>setNote(e.target.value)}
          placeholder={isToeic?"예: Part 3 기출 2회분, Section 10 도치":"뭘 공부했는지"}
          style={{...inp, width:"100%", boxSizing:"border-box", marginTop:12}} />
        <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} style={{...inp, width:"100%", boxSizing:"border-box", marginTop:8, colorScheme:"dark"}} />
        <button onClick={add} style={{...primary(STUDY_ACCENT), width:"100%", marginTop:10}}>기록 저장</button>
      </Card>

      {/* 토익 영역별 이번 주 */}
      {hasPartData && (
        <Card>
          <Row><span style={lbl}>토익 영역별 · 이번 주</span>
            <span style={{ fontSize:11.5, color:C.muted }}>{fmtMin(partTotals.reduce((a,p)=>a+p.min,0))}</span>
          </Row>
          <div style={{ marginTop:12 }}>
            {partTotals.map((p)=>(
              <div key={p.k} style={{ display:"flex", alignItems:"center", gap:9, marginBottom:8 }}>
                <span style={{ fontSize:11.5, fontWeight:800, color:p.color, width:30, flexShrink:0 }}>{p.label}</span>
                <div style={{ flex:1, height:13, background:C.surface2, borderRadius:99, overflow:"hidden" }}>
                  <div style={{ width:`${Math.round(p.min/partMax*100)}%`, height:"100%", borderRadius:99,
                    background:`linear-gradient(90deg, ${tint(p.color,0.55)}, ${p.color})`, transition:"width .3s" }} />
                </div>
                <span style={{ fontSize:11, fontWeight:800, color: p.min>0?p.color:C.muted, width:46, textAlign:"right", flexShrink:0 }}>{p.min>0?fmtMin(p.min):"—"}</span>
              </div>
            ))}
          </div>
          {partTotals.some(p=>p.min===0) && (
            <div style={{ fontSize:10.5, color:C.amber, marginTop:6, fontWeight:600 }}>
              이번 주 안 한 영역: {partTotals.filter(p=>p.min===0).map(p=>p.label).join(" · ")}
            </div>
          )}
        </Card>
      )}

      {/* 이력 */}
      {sortedDesc.length>0 && (
        <Card>
          <Row><span style={lbl}>공부 이력</span>
            <span style={{ fontSize:11.5, color:C.muted }}>총 {filtered.length}건</span>
          </Row>
          {histSubjects.length>2 && (
            <div style={{ display:"flex", gap:5, marginTop:10, overflowX:"auto" }}>
              {histSubjects.map((s)=>(
                <button key={s} onClick={()=>setHistSubject(s)}
                  style={{...chip(histSubject===s, s==="전체"?STUDY_ACCENT:colorForSubject(s)), padding:"5px 11px", fontSize:11.5, whiteSpace:"nowrap", flexShrink:0}}>{s}</button>
              ))}
            </div>
          )}
          {shown.map((s)=>{
            const pi = s.part ? partInfo(s.part) : null;
            return (
              <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.line}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <span style={{ width:8, height:8, borderRadius:3, background:colorForSubject(s.subject), flexShrink:0 }} />
                    <span style={{ fontSize:13.5, fontWeight:700 }}>{s.subject}</span>
                    {pi && <span style={{ fontSize:10, fontWeight:800, color:pi.color, background:tint(pi.color,0.14),
                      border:`1px solid ${tint(pi.color,0.35)}`, borderRadius:999, padding:"1px 7px" }}>{pi.label}</span>}
                    <span style={{ fontSize:12, color:STUDY_ACCENT, fontWeight:700 }}>{fmtMin(s.minutes)}</span>
                  </div>
                  <div style={{ fontSize:11.5, color:C.muted, marginTop:3 }}>{s.date.replace(/-/g,".")}{s.note?` · ${s.note}`:""}</div>
                </div>
                <button onClick={()=>rm(s.id)} style={xBtn}>×</button>
              </div>
            );
          })}
          {filtered.length>6 && (
            <button onClick={()=>setShowAll(v=>!v)} style={{...ghost, width:"100%", marginTop:10}}>
              {showAll ? "접기" : `${filtered.length-6}건 더 보기`}
            </button>
          )}
        </Card>
      )}
    </div>
  );
}

// 단어 퀴즈 — 4지선다. 틀리면 숙련도가 내려가서 복습 대기열로 돌아온다
function VocabQuiz({ vocab, onAnswer, onStar, onClose }) {
  const [dir, setDir] = useState("t2m");   // t2m: 단어→뜻 / m2t: 뜻→단어
  const [scope, setScope] = useState("weak"); // weak: 미숙련만 / all: 전체
  const [started, setStarted] = useState(false);
  const [qs, setQs] = useState([]);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [wrongList, setWrongList] = useState([]);
  const [starredMap, setStarred] = useState({}); // 결과 화면에서 누른 별표를 즉시 반영

  const pool = vocab.filter(v=>v.term && v.meaning);
  const scoped = scope==="weak" ? pool.filter(v=>!isMastered(v))
    : scope==="star" ? pool.filter(v=>v.starred)
    : scope==="wrong" ? pool.filter(isOftenWrong) : pool;
  const enough = pool.length >= 4;

  const build = () => {
    const base = (scoped.length>=4 ? scoped : pool).slice();
    // 미숙련·오래된 것 우선으로 섞되 완전 고정은 아니게
    const sorted = base.sort((a,b)=>reviewScore(b)-reviewScore(a)).slice(0, 30);
    const picks = sorted.sort(()=>Math.random()-0.5).slice(0, Math.min(10, sorted.length));
    const made = picks.map((v)=>{
      const others = pool.filter(o=>o.id!==v.id)
        .sort(()=>Math.random()-0.5).slice(0,3);
      const opts = [v, ...others].sort(()=>Math.random()-0.5);
      return { v, opts };
    });
    setQs(made); setQi(0); setPicked(null); setCorrect(0); setWrongList([]); setStarted(true);
  };

  const cur = qs[qi] || null;
  const label = (v)=> dir==="t2m" ? v.meaning : v.term;
  const question = (v)=> dir==="t2m" ? v.term : v.meaning;

  const choose = (opt) => {
    if (picked) return;
    setPicked(opt);
    const ok = opt.id === cur.v.id;
    if (ok) setCorrect(c=>c+1); else setWrongList(w=>[...w, cur.v]);
    onAnswer(cur.v.id, ok ? 1 : -1);
  };
  const next = () => { setPicked(null); setQi(i=>i+1); };
  const done = started && qi >= qs.length;

  return (
    <div onClick={onClose} style={sheetBg}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink:0 }}>
          <div style={grip} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontSize:16, fontWeight:800 }}>단어 퀴즈</span>
            {started && !done && <span style={{ fontSize:12, color:C.muted }}>{qi+1} / {qs.length}</span>}
          </div>
        </div>

        <div style={{ flex:1, minHeight:0, overflowY:"auto", paddingRight:2, overscrollBehavior:"contain" }}>
          {!enough ? (
            <div style={{ fontSize:12.5, color:C.muted, lineHeight:1.7, padding:"14px 0" }}>
              퀴즈를 내려면 뜻이 있는 단어가 <b style={{color:C.text}}>4개 이상</b> 필요해요.
              지금은 {pool.length}개예요 — 단어를 조금 더 추가해보세요.
            </div>
          ) : !started ? (<>
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:7 }}>문제 방향</div>
            <div style={{ display:"flex", gap:6 }}>
              {[["t2m","단어 → 뜻"],["m2t","뜻 → 단어"]].map(([k,l])=>(
                <button key={k} onClick={()=>setDir(k)} style={{...chip(dir===k, STUDY_ACCENT), flex:1, textAlign:"center", padding:"9px 0"}}>{l}</button>
              ))}
            </div>
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, margin:"14px 0 7px" }}>범위</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {[["weak","아직 못 외운 것", pool.filter(v=>!isMastered(v)).length, C.amber],
                ["star","⭐ 별표", pool.filter(v=>v.starred).length, "#FFD24B"],
                ["wrong","자주 틀림", pool.filter(isOftenWrong).length, C.danger],
                ["all","전체", pool.length, STUDY_ACCENT]].map(([k,l,n,col])=>(
                <button key={k} onClick={()=>setScope(k)} disabled={n===0 && k!=="all"}
                  style={{...chip(scope===k, col), textAlign:"center", padding:"9px 0", fontSize:11.5,
                    opacity:(n===0&&k!=="all")?0.35:1}}>{l} {n}</button>
              ))}
            </div>
            {scoped.length>0 && scoped.length<4 && (
              <div style={{ fontSize:10.5, color:C.muted, marginTop:7, lineHeight:1.5 }}>
                이 범위는 {scoped.length}개뿐이라 보기를 채우려고 다른 단어도 섞여요.
              </div>
            )}
            <button onClick={build} style={{...primary(STUDY_ACCENT), width:"100%", marginTop:16}}>퀴즈 시작 (최대 10문제)</button>
            <div style={{ fontSize:10.5, color:C.muted, marginTop:9, lineHeight:1.55 }}>
              맞히면 숙련도가 오르고, 틀리면 내려가서 복습 대기열로 다시 들어와요.
            </div>
          </>) : done ? (<>
            <div style={{ textAlign:"center", padding:"18px 0" }}>
              <div style={{ fontSize:34, fontWeight:800, color: correct===qs.length?TYPES.legs.color:STUDY_ACCENT, letterSpacing:-1 }}>
                {correct} / {qs.length}
              </div>
              <div style={{ fontSize:13, color:C.muted, marginTop:6 }}>
                {correct===qs.length ? "전부 맞혔어요! 🎉" : `정답률 ${Math.round(correct/qs.length*100)}%`}
              </div>
            </div>
            {wrongList.length>0 && (
              <div style={{ marginTop:6 }}>
                <div style={{ fontSize:11.5, color:C.amber, fontWeight:800, marginBottom:8 }}>틀린 단어 {wrongList.length}개 — 다시 볼까요?</div>
                {wrongList.map((v)=>{
                  const pi = posInfo(v.pos);
                  return (
                    <div key={v.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 0", borderBottom:`1px solid ${C.line}` }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                          <span style={{ fontSize:13, fontWeight:800 }}>{v.term}</span>
                          {pi && <span style={{ fontSize:9, fontWeight:800, color:pi.color, background:tint(pi.color,0.14), borderRadius:999, padding:"1px 6px" }}>{pi.short}</span>}
                        </div>
                        <div style={{ fontSize:12, color:STUDY_ACCENT, marginTop:3 }}>{v.meaning}</div>
                      </div>
                      <button onClick={()=>{ onStar(v.id); setStarred(x=>({...x,[v.id]:!x[v.id]})); }}
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, padding:"0 2px",
                          opacity: (starredMap[v.id] ?? v.starred) ? 1 : 0.3, flexShrink:0 }}>
                        {(starredMap[v.id] ?? v.starred) ? "⭐" : "☆"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display:"flex", gap:7, marginTop:16 }}>
              <button onClick={()=>setStarted(false)} style={{...ghost, flex:1}}>설정 바꾸기</button>
              <button onClick={build} style={{...primary(STUDY_ACCENT), flex:1}}>한 번 더</button>
            </div>
          </>) : cur ? (<>
            {/* 진행바 */}
            <div style={{ height:5, background:C.surface2, borderRadius:99, overflow:"hidden", marginBottom:14 }}>
              <div style={{ width:`${Math.round(qi/qs.length*100)}%`, height:"100%", background:STUDY_ACCENT, borderRadius:99, transition:"width .3s" }} />
            </div>

            <div style={{ padding:"22px 14px", borderRadius:13, background:C.surface2, textAlign:"center",
              border:`1px solid ${C.line}`, minHeight:74, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", gap:7 }}>
              {dir==="t2m" && posInfo(cur.v.pos) && (
                <span style={{ fontSize:10, fontWeight:800, color:posInfo(cur.v.pos).color }}>{posInfo(cur.v.pos).short}</span>
              )}
              <div style={{ fontSize:20, fontWeight:800, lineHeight:1.35, wordBreak:"break-word" }}>{question(cur.v)}</div>
              {cur.v.tag && <div style={{ fontSize:10, color:C.muted }}>{cur.v.tag}</div>}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:7, marginTop:12 }}>
              {cur.opts.map((o)=>{
                const isAns = o.id===cur.v.id;
                const isPicked = picked && picked.id===o.id;
                const show = !!picked;
                const bg = show && isAns ? tint(TYPES.legs.color,0.16)
                  : show && isPicked ? tint(C.danger,0.14) : C.surface2;
                const bd = show && isAns ? TYPES.legs.color
                  : show && isPicked ? C.danger : C.line;
                return (
                  <button key={o.id} onClick={()=>choose(o)} disabled={!!picked}
                    style={{ textAlign:"left", padding:"13px 14px", borderRadius:11, cursor:picked?"default":"pointer",
                      background:bg, border:`1.5px solid ${bd}`, color:C.text, fontSize:13.5, fontWeight:700,
                      display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, transition:"all .15s" }}>
                    <span style={{ flex:1, minWidth:0, wordBreak:"break-word" }}>{label(o)}</span>
                    {show && isAns && <span style={{ color:TYPES.legs.color, fontWeight:900, flexShrink:0 }}>✓</span>}
                    {show && isPicked && !isAns && <span style={{ color:C.danger, fontWeight:900, flexShrink:0 }}>✕</span>}
                  </button>
                );
              })}
            </div>

            {picked && (
              <button onClick={next} style={{...primary(STUDY_ACCENT), width:"100%", marginTop:13}}>
                {qi+1 >= qs.length ? "결과 보기" : "다음 문제"}
              </button>
            )}
          </>) : null}
          <div style={{ height:8 }} />
        </div>

        <div style={{ flexShrink:0, padding:"12px 0 calc(14px + env(safe-area-inset-bottom))",
          borderTop:`1px solid ${C.line}`, background:C.surface }}>
          <button onClick={onClose} style={{...ghost, width:"100%"}}>{done?"닫기":"그만하기"}</button>
        </div>
      </div>
    </div>
  );
}

// 단어 일괄 추가 — 여러 줄 붙여넣기 + AI 자동 채우기 (폰 입력 부담 줄이기)
function VocabBulkSheet({ apiKey, existingTerms, onAdd, onClose }) {
  const [text, setText] = useState("");
  const [type, setType] = useState("word");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState(null); // 미리보기

  const preview = () => {
    const parsed = parseVocabLines(text);
    if (!parsed.length) { setErr("인식된 줄이 없어요. 한 줄에 하나씩 적어주세요."); setRows(null); return; }
    setErr(""); setRows(parsed);
  };

  // 뜻이 비었거나 품사가 없는 항목을 AI가 채워준다
  const aiFill = async () => {
    const parsed = rows || parseVocabLines(text);
    if (!parsed.length) { setErr("먼저 단어를 입력해주세요."); return; }
    setBusy(true); setErr("");
    try {
      const terms = parsed.map(r=>r.term).slice(0, 40);
      const prompt = `다음은 토익 학습자가 정리하는 영어 ${type==="idiom"?"숙어":"단어"} 목록이야.
각 항목에 대해 토익에서 쓰이는 대표 뜻(한국어, 짧게), 품사, 짧은 예문을 채워줘.

품사는 반드시 다음 중 하나의 코드로만: n, v, adj, adv, prep, conj
숙어처럼 품사를 정하기 어려우면 빈 문자열 ""로 둬.

목록:
${terms.map((t,i)=>`${i+1}. ${t}`).join("\n")}

아래 JSON 배열 형식으로만 답해. 설명, 마크다운 코드펜스 없이 JSON만:
[{"term":"원래 단어 그대로","meaning":"한국어 뜻","pos":"품사코드","example":"짧은 예문"}]`;
      const raw = await callClaudeAPI(apiKey, prompt, { noTools:true, maxTokens:4000 });
      const clean = raw.replace(/```json|```/g, "").trim();
      const jstart = clean.indexOf("["), jend = clean.lastIndexOf("]");
      if (jstart < 0 || jend < 0) throw new Error("AI 응답을 읽지 못했어요. 다시 시도해주세요.");
      const arr = JSON.parse(clean.slice(jstart, jend+1));
      const byTerm = new Map(arr.map(o=>[String(o.term||"").trim().toLowerCase(), o]));
      setRows(parsed.map((r)=>{
        const hit = byTerm.get(r.term.trim().toLowerCase());
        if (!hit) return r;
        return {
          term: r.term,
          meaning: r.meaning || String(hit.meaning||"").trim(),
          pos: r.pos || normPos(hit.pos),
          note: String(hit.example||"").trim(),
        };
      }));
    } catch(e) { setErr(e.message || "AI 채우기에 실패했어요."); }
    setBusy(false);
  };

  const commit = () => {
    const list = rows || parseVocabLines(text);
    if (!list.length) { setErr("추가할 항목이 없어요."); return; }
    onAdd(list.map(r=>({ ...r, type, tag: tag.trim() })));
    onClose();
  };

  const dupCount = (rows||[]).filter(r=>existingTerms.has(r.term.trim().toLowerCase())).length;

  return (
    <div onClick={onClose} style={sheetBg}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink:0 }}>
          <div style={grip} />
          <div style={{ fontSize:16, fontWeight:800, marginBottom:4 }}>여러 개 한 번에 추가</div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:12 }}>한 줄에 하나씩 · 뜻은 비워도 AI가 채워줘요</div>
        </div>

        <div style={{ flex:1, minHeight:0, overflowY:"auto", paddingRight:2, overscrollBehavior:"contain" }}>
          <div style={{ display:"flex", gap:6 }}>
            {VOCAB_TYPES.map((t)=>(
              <button key={t.k} onClick={()=>setType(t.k)}
                style={{ flex:1, padding:"8px 0", borderRadius:9, cursor:"pointer", fontSize:11.5, fontWeight:800,
                  border:`1.5px solid ${type===t.k?t.color:C.line}`,
                  background: type===t.k?tint(t.color,0.15):C.surface2,
                  color: type===t.k?t.color:C.muted }}>{t.icon} {t.label}</button>
            ))}
          </div>

          <textarea value={text} onChange={(e)=>{ setText(e.target.value); setRows(null); }}
            rows={7} placeholder={"comprehensive 포괄적인 adj\nallocate 할당하다 v\nrevenue 수익\n\n또는 단어만 적고 AI 채우기를 눌러도 돼요"}
            style={{ ...inp, width:"100%", boxSizing:"border-box", marginTop:9, resize:"vertical",
              fontFamily:"inherit", lineHeight:1.6, fontSize:13 }} />

          <div style={{ fontSize:10.5, color:C.muted, marginTop:7, lineHeight:1.55 }}>
            구분자는 띄어쓰기 · 슬래시(/) · 쉼표 · 탭 다 돼요. 품사는 v, adj, 형용사 처럼 끝에 붙이면 인식돼요.
          </div>

          <input value={tag} onChange={(e)=>setTag(e.target.value)}
            placeholder="섹션·태그 (선택 · 전체에 함께 적용)" style={{...inp, width:"100%", boxSizing:"border-box", marginTop:9}} />

          <div style={{ display:"flex", gap:7, marginTop:10 }}>
            <button onClick={preview} style={{...ghost, flex:1}}>미리보기</button>
            <button onClick={aiFill} disabled={busy || !text.trim()}
              style={{...primary("#C9A6FF"), flex:1, opacity:(busy||!text.trim())?0.5:1}}>
              {busy ? "채우는 중…" : "✨ AI 채우기"}
            </button>
          </div>
          {!apiKey && <div style={{ fontSize:10.5, color:C.muted, marginTop:7, lineHeight:1.5 }}>
            AI 채우기는 몸 탭에서 API 키를 넣어야 써요. 직접 뜻을 적어도 돼요.
          </div>}
          {err && <div style={{ fontSize:11.5, color:C.danger, marginTop:9, lineHeight:1.55 }}>{err}</div>}

          {rows && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11.5, color:C.muted, fontWeight:700, marginBottom:7 }}>
                {rows.length}개 인식됨{dupCount>0?` · 이미 있는 단어 ${dupCount}개`:""}
              </div>
              {rows.slice(0,25).map((r,i)=>{
                const pi = posInfo(r.pos);
                const dup = existingTerms.has(r.term.trim().toLowerCase());
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 0", borderBottom:`1px solid ${C.line}` }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                        <span style={{ fontSize:12.5, fontWeight:800 }}>{r.term}</span>
                        {pi && <span style={{ fontSize:9, fontWeight:800, color:pi.color, background:tint(pi.color,0.14), borderRadius:999, padding:"1px 6px" }}>{pi.short}</span>}
                        {dup && <span style={{ fontSize:9, color:C.amber, fontWeight:700 }}>중복</span>}
                      </div>
                      <div style={{ fontSize:11, color: r.meaning?C.muted:C.danger, marginTop:2 }}>
                        {r.meaning || "뜻 없음 — AI 채우기를 눌러보세요"}
                      </div>
                      {r.note && <div style={{ fontSize:10, color:C.muted, opacity:0.75, marginTop:2 }}>{r.note}</div>}
                    </div>
                  </div>
                );
              })}
              {rows.length>25 && <div style={{ fontSize:10.5, color:C.muted, marginTop:7 }}>외 {rows.length-25}개…</div>}
            </div>
          )}
          <div style={{ height:8 }} />
        </div>

        <div style={{ flexShrink:0, display:"flex", gap:8, padding:"12px 0 calc(14px + env(safe-area-inset-bottom))",
          borderTop:`1px solid ${C.line}`, background:C.surface }}>
          <button onClick={onClose} style={{...ghost, flex:1}}>취소</button>
          <button onClick={commit} disabled={!text.trim()}
            style={{...primary(STUDY_ACCENT), flex:2, opacity:text.trim()?1:0.45}}>
            {rows ? `${rows.length}개 추가` : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 단어장: 단어·숙어·문법 + 복습 ----------
function StudyVocab({ data, mutate, apiKey }) {
  const vocab = data.vocab || [];
  const [tab, setTab] = useState("all");        // all | word | idiom | grammar
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [reviewOn, setReviewOn] = useState(false);
  const [draft, setDraft] = useState({ type:"word", term:"", meaning:"", note:"", tag:"", pos:"" });
  const [filterMode, setFilterMode] = useState("all"); // all | star | weak | wrong
  const [bulkOpen, setBulkOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);

  const save = (list)=> mutate((prev)=>({ ...prev, vocab:list }));
  const add = () => {
    if (!draft.term.trim()) return;
    save([...vocab, { id:uid(), type:draft.type, term:draft.term.trim(), meaning:draft.meaning.trim(),
      note:draft.note.trim(), tag:draft.tag.trim(), pos:draft.pos, level:0, reviewCount:0, wrong:0, starred:false, lastReview:null, created:todayKey() }]);
    setDraft({ type:draft.type, term:"", meaning:"", note:"", tag:draft.tag, pos:"" });
  };
  const remove = (id)=> save(vocab.filter(v=>v.id!==id));
  const existingTerms = new Set(vocab.map(v=>String(v.term).trim().toLowerCase()));
  const addMany = (items) => {
    const seen = new Set(existingTerms);
    const fresh = [];
    for (const it of items) {
      const key = String(it.term).trim().toLowerCase();
      if (!key || seen.has(key)) continue;   // 중복은 건너뛴다
      seen.add(key);
      fresh.push({ id:uid(), type:it.type||"word", term:String(it.term).trim(),
        meaning:String(it.meaning||"").trim(), note:String(it.note||"").trim(),
        tag:String(it.tag||"").trim(), pos:it.pos||"", level:0, reviewCount:0, wrong:0, starred:false, lastReview:null, created:todayKey() });
    }
    if (fresh.length) save([...vocab, ...fresh]);
  };
  const bump = (id, d) => save(vocab.map(v=> v.id===id
    ? { ...v, level: Math.max(0, Math.min(5, num(v.level)+d)), reviewCount:num(v.reviewCount)+1,
        wrong: d<0 ? num(v.wrong)+1 : num(v.wrong), lastReview:todayKey() }
    : v));
  const toggleStar = (id) => save(vocab.map(v=> v.id===id ? { ...v, starred: !v.starred } : v));

  const byTab = tab==="all" ? vocab : vocab.filter(v=>v.type===tab);
  const searched = q.trim()
    ? byTab.filter(v=> (v.term+v.meaning+(v.note||"")+(v.tag||"")).toLowerCase().includes(q.trim().toLowerCase()))
    : byTab;
  const applyFilter = (list) =>
    filterMode==="star"  ? list.filter(v=>v.starred) :
    filterMode==="weak"  ? list.filter(v=>!isMastered(v)) :
    filterMode==="wrong" ? list.filter(isOftenWrong) : list;
  const listed = applyFilter(searched).slice()
    .sort((a,b)=> (b.starred?1:0)-(a.starred?1:0) || reviewScore(b)-reviewScore(a));
  const starCount = vocab.filter(v=>v.starred).length;
  const wrongCount = vocab.filter(isOftenWrong).length;

  const mastered = vocab.filter(isMastered).length;
  const todayReviewed = vocab.filter(v=>v.lastReview===todayKey()).length;
  const pct = vocab.length ? Math.round(mastered/vocab.length*100) : 0;
  // 태그(교재 섹션)별 약점 — 미숙련 항목이 많은 순
  const tagStats = Object.values(vocab.reduce((acc,v)=>{
    const t=(v.tag||"").trim(); if(!t) return acc;
    acc[t] = acc[t] || { tag:t, total:0, weak:0 };
    acc[t].total++; if(!isMastered(v)) acc[t].weak++;
    return acc;
  },{})).sort((a,b)=> b.weak-a.weak || b.total-a.total).slice(0,6);

  // 복습 대기열
  const queue = vocab.filter(v=>!isMastered(v)).slice().sort((a,b)=>reviewScore(b)-reviewScore(a));
  const [qi, setQi] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const cur = queue[qi] || null;
  const answer = (d) => { if(!cur) return; bump(cur.id, d); setRevealed(false);
    setQi((i)=> i+1 >= queue.length ? 0 : i+1); };

  return (
    <div>
      {/* 요약 */}
      <Card>
        <Row><span style={lbl}>단어장</span>
          <span style={{ fontSize:11.5, color:C.muted }}>{vocab.length}개 등록</span>
        </Row>
        {vocab.length===0 ? (
          <div style={{ fontSize:12.5, color:C.muted, marginTop:10, lineHeight:1.65 }}>
            헷갈리는 단어·숙어·문법을 모아두는 곳이에요. 아래 <b style={{color:C.text}}>+ 추가</b>로 하나씩 쌓아보세요.
          </div>
        ) : (<>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:12 }}>
            <span style={{ fontSize:32, fontWeight:800, color:STUDY_ACCENT, letterSpacing:-1 }}>{mastered}</span>
            <span style={{ fontSize:14, color:C.muted }}>/ {vocab.length}개 외움 ({pct}%)</span>
          </div>
          <div style={{ height:8, background:C.surface2, borderRadius:99, overflow:"hidden", marginTop:9 }}>
            <div style={{ width:`${pct}%`, height:"100%", borderRadius:99,
              background:`linear-gradient(90deg, ${tint(STUDY_ACCENT,0.5)}, ${STUDY_ACCENT})`, transition:"width .4s" }} />
          </div>
          <div style={{ fontSize:11, color:C.muted, marginTop:7 }}>
            오늘 복습 {todayReviewed}개 · 아직 {vocab.length-mastered}개 남음
          </div>
          {(starCount>0 || wrongCount>0) && (
            <div style={{ display:"flex", gap:6, marginTop:10 }}>
              {starCount>0 && (
                <button onClick={()=>setFilterMode("star")} style={{ flex:1, background:tint("#FFD24B",0.12),
                  border:`1px solid ${tint("#FFD24B",0.4)}`, borderRadius:10, padding:"8px 6px", cursor:"pointer", textAlign:"center" }}>
                  <div style={{ fontSize:15, fontWeight:800, color:"#FFD24B" }}>⭐ {starCount}</div>
                  <div style={{ fontSize:9.5, color:C.muted, marginTop:1 }}>별표</div>
                </button>
              )}
              {wrongCount>0 && (
                <button onClick={()=>setFilterMode("wrong")} style={{ flex:1, background:tint(C.danger,0.1),
                  border:`1px solid ${tint(C.danger,0.35)}`, borderRadius:10, padding:"8px 6px", cursor:"pointer", textAlign:"center" }}>
                  <div style={{ fontSize:15, fontWeight:800, color:C.danger }}>{wrongCount}</div>
                  <div style={{ fontSize:9.5, color:C.muted, marginTop:1 }}>자주 틀림</div>
                </button>
              )}
            </div>
          )}
          <div style={{ display:"flex", gap:7, marginTop:12 }}>
            {queue.length>0 && (
              <button onClick={()=>{ setReviewOn(v=>!v); setQi(0); setRevealed(false); }}
                style={{...ghost, flex:1}}>{reviewOn ? "복습 끝내기" : `🔁 복습 (${queue.length})`}</button>
            )}
            <button onClick={()=>setQuizOpen(true)} style={{...primary(STUDY_ACCENT), flex:1}}>🎯 단어 퀴즈</button>
          </div>
        </>)}
      </Card>

      {/* 복습 카드 */}
      {reviewOn && cur && (
        <Card>
          <Row><span style={lbl}>복습</span>
            <span style={{ fontSize:11.5, color:C.muted }}>{qi+1} / {queue.length}</span>
          </Row>
          <div onClick={()=>setRevealed(true)}
            style={{ marginTop:12, padding:"26px 16px", borderRadius:13, background:C.surface2, cursor:"pointer",
              border:`1px solid ${C.line}`, textAlign:"center", minHeight:96, display:"flex",
              flexDirection:"column", alignItems:"center", justifyContent:"center", gap:9 }}>
            <div style={{ fontSize:10.5, color:vocabTypeInfo(cur.type).color, fontWeight:800 }}>
              {vocabTypeInfo(cur.type).icon} {vocabTypeInfo(cur.type).label}
              {posInfo(cur.pos)?` · ${posInfo(cur.pos).short}`:""}{cur.tag?` · ${cur.tag}`:""}
            </div>
            <div style={{ fontSize:20, fontWeight:800, lineHeight:1.35, wordBreak:"break-word" }}>{cur.term}</div>
            {revealed ? (<>
              <div style={{ height:1, width:44, background:C.line }} />
              <div style={{ fontSize:15, color:STUDY_ACCENT, fontWeight:700, lineHeight:1.5 }}>{cur.meaning||"(뜻 없음)"}</div>
              {cur.note && <div style={{ fontSize:11.5, color:C.muted, lineHeight:1.55 }}>{cur.note}</div>}
            </>) : (
              <div style={{ fontSize:11.5, color:C.muted }}>탭해서 뜻 보기</div>
            )}
          </div>
          <div style={{ display:"flex", gap:7, marginTop:11, alignItems:"stretch" }}>
            <button onClick={()=>toggleStar(cur.id)} title="별표"
              style={{ background: cur.starred?tint("#FFD24B",0.15):C.surface2, border:`1px solid ${cur.starred?"#FFD24B":C.line}`,
                borderRadius:10, padding:"0 13px", cursor:"pointer", fontSize:17, flexShrink:0 }}>
              {cur.starred ? "⭐" : "☆"}
            </button>
            <button onClick={()=>answer(-1)} style={{...ghost, flex:1, color:C.amber, borderColor:tint(C.amber,0.45)}}>헷갈려요</button>
            <button onClick={()=>answer(1)} style={{...primary(TYPES.legs.color), flex:1}}>알아요</button>
          </div>
          <div style={{ fontSize:10.5, color:C.muted, marginTop:8, textAlign:"center", lineHeight:1.5 }}>
            숙련도 {num(cur.level)}/5 · "알아요"를 {MASTER_LEVEL-num(cur.level)}번 더 하면 외운 것으로 넘어가요
          </div>
        </Card>
      )}

      {/* 약점 섹션 */}
      {tagStats.length>0 && (
        <Card>
          <Row><span style={lbl}>약점 섹션</span>
            <span style={{ fontSize:11, color:C.muted }}>미숙련 많은 순</span>
          </Row>
          <div style={{ display:"flex", flexDirection:"column", gap:7, marginTop:11 }}>
            {tagStats.map((t)=>{
              const p = t.total ? Math.round((t.total-t.weak)/t.total*100) : 0;
              return (
                <div key={t.tag} onClick={()=>{ setQ(t.tag); setTab("all"); }}
                  style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer" }}>
                  <span style={{ fontSize:11.5, fontWeight:700, width:96, flexShrink:0, overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.tag}</span>
                  <div style={{ flex:1, height:11, background:C.surface2, borderRadius:99, overflow:"hidden" }}>
                    <div style={{ width:`${p}%`, height:"100%", borderRadius:99,
                      background: p>=80?TYPES.legs.color:p>=50?C.amber:C.danger }} />
                  </div>
                  <span style={{ fontSize:10.5, fontWeight:800, color: t.weak>0?C.amber:TYPES.legs.color, width:52, textAlign:"right", flexShrink:0 }}>
                    {t.weak>0?`${t.weak}개 남음`:"완료"}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize:10.5, color:C.muted, marginTop:9, lineHeight:1.5 }}>
            추가할 때 "섹션·태그"에 교재 섹션(예: Section 10 도치)을 적으면 여기에 모여요
          </div>
        </Card>
      )}

      {/* 목록 */}
      <Card>
        <Row><span style={lbl}>목록</span>
          <span style={{ display:"flex", gap:12 }}>
            <button onClick={()=>setBulkOpen(true)} style={{ background:"none", border:"none", color:"#C9A6FF",
              fontSize:12, fontWeight:800, cursor:"pointer", padding:0 }}>📥 여러 개</button>
            <button onClick={()=>setAddOpen(v=>!v)} style={{ background:"none", border:"none", color:STUDY_ACCENT,
              fontSize:12, fontWeight:800, cursor:"pointer", padding:0 }}>{addOpen?"닫기":"+ 추가"}</button>
          </span>
        </Row>

        {addOpen && (
          <div style={{ marginTop:11, padding:"12px", background:C.surface2, borderRadius:11 }}>
            <div style={{ display:"flex", gap:6 }}>
              {VOCAB_TYPES.map((t)=>(
                <button key={t.k} onClick={()=>setDraft({...draft, type:t.k})}
                  style={{ flex:1, padding:"8px 0", borderRadius:9, cursor:"pointer", fontSize:11.5, fontWeight:800,
                    border:`1.5px solid ${draft.type===t.k?t.color:C.line}`,
                    background: draft.type===t.k?tint(t.color,0.15):C.surface,
                    color: draft.type===t.k?t.color:C.muted }}>{t.icon} {t.label}</button>
              ))}
            </div>
            <input value={draft.term} onChange={(e)=>setDraft({...draft, term:e.target.value})}
              placeholder={draft.type==="word"?"단어 (예: comprehensive)":draft.type==="idiom"?"숙어 (예: in charge of)":"문법 포인트 (예: Only + 부사 도치)"}
              style={{...inp, width:"100%", boxSizing:"border-box", marginTop:8}} />
            <input value={draft.meaning} onChange={(e)=>setDraft({...draft, meaning:e.target.value})}
              placeholder={draft.type==="grammar"?"핵심 규칙 한 줄":"뜻"}
              style={{...inp, width:"100%", boxSizing:"border-box", marginTop:6}} />
            {draft.type!=="grammar" && (
              <div style={{ display:"flex", gap:4, marginTop:7, flexWrap:"wrap" }}>
                {POS_LIST.map((pp)=>(
                  <button key={pp.k} onClick={()=>setDraft({...draft, pos: draft.pos===pp.k?"":pp.k})}
                    style={{...chip(draft.pos===pp.k, pp.color), padding:"5px 10px", fontSize:11}}>{pp.label}</button>
                ))}
              </div>
            )}
            <input value={draft.note} onChange={(e)=>setDraft({...draft, note:e.target.value})}
              placeholder="예문·메모 (선택)" style={{...inp, width:"100%", boxSizing:"border-box", marginTop:6}} />
            <input value={draft.tag} onChange={(e)=>setDraft({...draft, tag:e.target.value})}
              placeholder="섹션·태그 (선택 · 예: Section 10 도치)" style={{...inp, width:"100%", boxSizing:"border-box", marginTop:6}} />
            <button onClick={add} disabled={!draft.term.trim()}
              style={{...primary(STUDY_ACCENT), width:"100%", marginTop:9, opacity:draft.term.trim()?1:0.45}}>추가</button>
          </div>
        )}

        {vocab.length>0 && (<>
          <div style={{ display:"flex", gap:5, marginTop:11, overflowX:"auto" }}>
            {[["all","전체"], ...VOCAB_TYPES.map(t=>[t.k, `${t.icon} ${t.label}`])].map(([k,label])=>(
              <button key={k} onClick={()=>setTab(k)}
                style={{...chip(tab===k, k==="all"?STUDY_ACCENT:vocabTypeInfo(k).color), padding:"5px 11px", fontSize:11.5, whiteSpace:"nowrap", flexShrink:0}}>{label}</button>
            ))}
          </div>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="검색"
            style={{...inp, width:"100%", boxSizing:"border-box", marginTop:8}} />
          <div style={{ display:"flex", gap:5, marginTop:8, overflowX:"auto" }}>
            {[["all","전체",STUDY_ACCENT,vocab.length],
              ["star","⭐ 별표","#FFD24B",starCount],
              ["wrong","자주 틀림",C.danger,wrongCount],
              ["weak","미숙련",C.amber,vocab.filter(v=>!isMastered(v)).length]].map(([k,label,col,n])=>(
              <button key={k} onClick={()=>setFilterMode(k)}
                style={{...chip(filterMode===k, col), padding:"5px 11px", fontSize:11.5, whiteSpace:"nowrap", flexShrink:0}}>
                {label}{n>0?` ${n}`:""}
              </button>
            ))}
          </div>

          <div style={{ marginTop:11 }}>
            {listed.length===0 ? (
              <div style={{ fontSize:12, color:C.muted, padding:"12px 0", textAlign:"center" }}>해당하는 항목이 없어요</div>
            ) : listed.slice(0,60).map((v)=>{
              const ti = vocabTypeInfo(v.type);
              const lv = num(v.level);
              return (
                <div key={v.id} style={{ display:"flex", alignItems:"flex-start", gap:9, padding:"10px 0", borderBottom:`1px solid ${C.line}` }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:13.5, fontWeight:800, wordBreak:"break-word" }}>{v.term}</span>
                      <span style={{ fontSize:9.5, fontWeight:800, color:ti.color, background:tint(ti.color,0.14),
                        borderRadius:999, padding:"1px 7px" }}>{ti.label}</span>
                      {posInfo(v.pos) && <span style={{ fontSize:9.5, fontWeight:800, color:posInfo(v.pos).color,
                        background:tint(posInfo(v.pos).color,0.14), borderRadius:999, padding:"1px 7px" }}>{posInfo(v.pos).short}</span>}
                      {isMastered(v) && <span style={{ fontSize:9.5, fontWeight:800, color:TYPES.legs.color }}>✓ 외움</span>}
                      {isOftenWrong(v) && <span style={{ fontSize:9, fontWeight:800, color:C.danger,
                        background:tint(C.danger,0.13), borderRadius:999, padding:"1px 6px" }}>{num(v.wrong)}번 틀림</span>}
                    </div>
                    {v.meaning && <div style={{ fontSize:12, color:C.muted, marginTop:3, lineHeight:1.5 }}>{v.meaning}</div>}
                    {v.note && <div style={{ fontSize:11, color:C.muted, marginTop:2, opacity:0.8, lineHeight:1.5 }}>{v.note}</div>}
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                      {v.tag && <span style={{ fontSize:9.5, color:C.muted, background:C.surface2, borderRadius:999, padding:"2px 7px" }}>{v.tag}</span>}
                      <div style={{ display:"flex", gap:2 }}>
                        {[0,1,2,3,4].map(i=>(
                          <span key={i} style={{ width:5, height:5, borderRadius:"50%",
                            background: i<lv ? STUDY_ACCENT : C.line }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0, alignItems:"center" }}>
                    <button onClick={()=>toggleStar(v.id)} title={v.starred?"별표 해제":"별표"}
                      style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, padding:"0 2px",
                        opacity: v.starred?1:0.3, lineHeight:1, transition:"opacity .15s" }}>
                      {v.starred ? "⭐" : "☆"}
                    </button>
                    <button onClick={()=>bump(v.id, 1)} title="외웠어요"
                      style={{ background:"none", border:`1px solid ${tint(TYPES.legs.color,0.4)}`, color:TYPES.legs.color,
                        borderRadius:7, padding:"4px 7px", cursor:"pointer", fontSize:11 }}>✓</button>
                    <button onClick={()=>remove(v.id)} style={xBtn}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
          {listed.length>60 && (
            <div style={{ fontSize:10.5, color:C.muted, marginTop:9, textAlign:"center" }}>
              60개까지 표시 중 · 검색으로 좁혀보세요
            </div>
          )}
        </>)}
      </Card>

      {bulkOpen && <VocabBulkSheet apiKey={apiKey} existingTerms={existingTerms}
        onAdd={addMany} onClose={()=>setBulkOpen(false)} />}
      {quizOpen && <VocabQuiz vocab={vocab} onAnswer={bump} onStar={toggleStar} onClose={()=>setQuizOpen(false)} />}
    </div>
  );
}

// ================= 몸 =================
function Body({ data, persist, mutate, target, latestWeight, tdee }) {
  const [m, setM] = useState({ date:todayKey(), weight:"", fat:"", muscle:"", note:"" });
  const [metric, setMetric] = useState("weight");
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const exportTaRef = React.useRef(null);
  const profile = data.profile;

  const setProfile = (patch) => mutate((prev)=>({ ...prev, profile:{ ...prev.profile, ...patch } }));

  const addMeasure = () => { if(!m.weight) return;
    const entry={ id:uid(), date:m.date, weight:num(m.weight), fat:m.fat?num(m.fat):null, muscle:m.muscle?num(m.muscle):null, note:m.note };
    persist({ ...data, measurements:[...data.measurements.filter(x=>x.date!==m.date), entry] });
    setM({ date:todayKey(), weight:"", fat:"", muscle:"", note:"" }); };
  const rmMeasure = (id)=> persist({ ...data, measurements:data.measurements.filter(x=>x.id!==id) });

  const sorted = [...data.measurements].sort((a,b)=>a.date.localeCompare(b.date));
  const sortedDesc = [...sorted].reverse();
  const h = num(profile.height);
  const bmi = (h>0&&latestWeight)?(latestWeight/((h/100)**2)).toFixed(1):null;
  const latestFat = sortedDesc.find(x=>x.fat!=null)?.fat ?? null;

  const metricPts = sorted.filter(x=> metric==="weight"?true: metric==="fat"?x.fat!=null: x.muscle!=null)
    .map(x=>({ label:x.date.slice(5).replace("-","."), value: metric==="weight"?x.weight: metric==="fat"?x.fat: x.muscle }));
  const metricColor = metric==="weight"?TYPES.legs.color: metric==="fat"?C.amber: TYPES.pull.color;

  // 목표 진행률
  const goalW = num(profile.goalWeight);
  const startW = sorted.length?sorted[0].weight:null;
  const goalPct = (goalW&&startW&&latestWeight&&goalW!==startW)? Math.max(0,Math.min(100, Math.round((latestWeight-startW)/(goalW-startW)*100))):null;

  // 목표 도달 예상 (최근 42일 측정 추세 기반)
  const goalETA = (()=>{
    if (!goalW || !latestWeight || sorted.length<2) return null;
    const remaining = goalW - latestWeight;
    if (Math.abs(remaining) < 0.1) return { reached:true };
    const lastDate = new Date(sorted[sorted.length-1].date+"T00:00:00");
    const wStart = new Date(lastDate); wStart.setDate(wStart.getDate()-42);
    let pts = sorted.filter(x=> new Date(x.date+"T00:00:00") >= wStart);
    if (pts.length<2) pts = sorted.slice(-4);
    const first = pts[0], last = pts[pts.length-1];
    const days = (new Date(last.date+"T00:00:00") - new Date(first.date+"T00:00:00"))/86400000;
    if (days < 3) return { tooSoon:true };
    const ratePerWeek = (last.weight - first.weight)/days*7;
    if (Math.abs(ratePerWeek) < 0.05) return { flat:true };
    if (Math.sign(ratePerWeek) !== Math.sign(remaining)) return { diverging:true, ratePerWeek };
    const weeks = remaining / ratePerWeek;
    const eta = new Date(); eta.setDate(eta.getDate()+Math.round(weeks*7));
    return { weeks, eta, ratePerWeek };
  })();
  const fmtRate = (r)=> `주 ${r>=0?"+":""}${Math.round(r*100)/100}kg`;

  const markBackedUp = () => mutate((prev)=>({ ...prev, lastBackupAt: Date.now() }));
  const exportData = () => {
    // 모바일 웹뷰에서는 파일 다운로드가 막히는 경우가 많아서, 화면에 텍스트를 띄워 복사하는 방식을 기본으로 씀
    setExportOpen(true);
    setCopyMsg("");
    try { // 가능하면 다운로드도 같이 시도 (안 되면 무시)
      const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url; a.download=`gym-backup-${todayKey()}.json`; a.click(); URL.revokeObjectURL(url);
    } catch(e){}
  };
  const copyBackup = async () => {
    const text = JSON.stringify(data, null, 2);
    const done = () => { setCopyMsg("복사됐어요! 메모장·메시지 등에 붙여넣어 보관하세요."); markBackedUp(); };
    try { await navigator.clipboard.writeText(text); done(); return; } catch(e){}
    try {
      const ta = exportTaRef.current;
      if (ta) { ta.focus(); ta.select(); const ok = document.execCommand("copy"); if(ok){ done(); } else { setCopyMsg("자동 복사가 안 돼요. 아래 텍스트를 길게 눌러 직접 선택 후 복사해주세요."); } return; }
    } catch(e){}
    setCopyMsg("자동 복사가 안 돼요. 아래 텍스트를 길게 눌러 직접 선택 후 복사해주세요.");
  };
  // 마지막 백업 경과일 + 백업할 만한 데이터가 쌓였는지
  const daysSinceBackup = data.lastBackupAt ? Math.floor((Date.now()-data.lastBackupAt)/86400000) : null;
  const hasMeaningfulData = Object.keys(data.schedule).length >= 3 || data.measurements.length >= 2;
  const backupStale = hasMeaningfulData && (daysSinceBackup===null || daysSinceBackup>=7);
  const doImport = () => { try { const parsed=normalize(JSON.parse(importText)); persist(parsed); setImportText(""); setImportMsg("가져오기 완료!"); }
    catch(e){ setImportMsg("JSON 형식이 올바르지 않아요."); } };

  return (
    <div style={{ padding:"22px 18px 8px" }}>
      <div style={{ fontSize:11, letterSpacing:3, color:TYPES.push.color, fontWeight:800 }}>BODY LOG</div>
      <div style={{ fontSize:30, fontWeight:800, letterSpacing:-1, marginTop:4 }}>내 몸 기록</div>

      <div style={{ display:"flex", gap:10 }}>
        <MiniCard label="현재 체중" value={latestWeight?`${latestWeight}`:"—"} unit="kg" color={TYPES.legs.color} />
        <MiniCard label="체지방" value={latestFat!=null?`${latestFat}`:"—"} unit="%" color={C.amber} />
        <MiniCard label="BMI" value={bmi||"—"} unit="" color={C.text} />
      </div>

      {/* 프로필 (TDEE용) */}
      <Card>
        <Row><span style={lbl}>프로필</span>{tdee!=null && <span style={{ fontSize:12, color:C.muted }}>유지 칼로리 ≈ {tdee}kcal</span>}</Row>
        <div style={{ display:"flex", gap:6, marginTop:10 }}>
          <Field label="키 cm" v={profile.height} on={(v)=>setProfile({height:v})} />
          <Field label="나이" v={profile.age} on={(v)=>setProfile({age:v})} />
        </div>
        <div style={{ fontSize:11, color:C.muted, margin:"12px 0 6px" }}>성별</div>
        <div style={{ display:"flex", gap:7 }}>
          <button onClick={()=>setProfile({sex:"m"})} style={{...chip(profile.sex==="m",TYPES.pull.color), flex:1, textAlign:"center"}}>남성</button>
          <button onClick={()=>setProfile({sex:"f"})} style={{...chip(profile.sex==="f",TYPES.lower.color), flex:1, textAlign:"center"}}>여성</button>
        </div>
        <div style={{ fontSize:11, color:C.muted, margin:"12px 0 6px" }}>활동량</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {ACTIVITY.map((a)=>(<button key={a.k} onClick={()=>setProfile({activity:a.k})} style={{...chip(profile.activity===a.k,STUDY_ACCENT), flex:1, textAlign:"center", minWidth:0}}>{a.label}</button>))}
        </div>
        <div style={{ fontSize:11, color:C.muted, margin:"12px 0 6px" }}>목표 <span style={{ opacity:0.7 }}>(탄단지 권장 비율이 이에 맞춰 바뀌어요)</span></div>
        <div style={{ display:"flex", gap:6 }}>
          {Object.values(MACRO_GOALS).map((g)=>{
            const on = (profile.macroGoal||"lean")===g.key;
            return (
              <button key={g.key} onClick={()=>setProfile({macroGoal:g.key})} style={{ flex:1, minWidth:0, padding:"9px 4px", borderRadius:10, cursor:"pointer",
                border:`1.5px solid ${on?g.color:C.line}`, background:on?tint(g.color,0.14):C.surface2, textAlign:"center" }}>
                <div style={{ fontSize:12, fontWeight:800, color:on?g.color:C.text }}>{g.label}</div>
                <div style={{ fontSize:9, color:C.muted, marginTop:2 }}>탄{g.carb}·단{g.protein}·지{g.fat}</div>
              </button>
            );
          })}
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:14, padding:"10px 12px", background:C.surface2, borderRadius:10 }}>
          <div><div style={{ fontSize:13, fontWeight:700 }}>목표 잉여/적자</div><div style={{ fontSize:11, color:C.muted }}>recomp 0 · 벌크 +250 · 컷 −300</div></div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={()=>setProfile({surplus:num(profile.surplus)-50})} style={stepBtn}>–</button>
            <span style={{ fontSize:14, fontWeight:800, minWidth:56, textAlign:"center", color: num(profile.surplus)>=0?TYPES.legs.color:C.danger }}>{num(profile.surplus)>=0?"+":""}{num(profile.surplus)}</span>
            <button onClick={()=>setProfile({surplus:num(profile.surplus)+50})} style={stepBtn}>+</button>
          </div>
        </div>
      </Card>

      {/* API 키 설정 (AI 계산·추천 기능용) */}
      <Card>
        <Row><span style={lbl}>API 키 설정</span></Row>
        <div style={{ fontSize:11.5, color:C.muted, marginTop:6, lineHeight:1.5 }}>
          자주 먹는 음식·유명 프랜차이즈는 <b style={{color:C.text}}>API 키 없이도 무료로 즉시</b> 계산돼요(음식 탭에서 검색·등록 가능).
          목록에 없는 음식이나 더 정교한 외식 추천을 원하면 본인의 Anthropic API 키를 넣으면 돼요.
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color:TYPES.push.color, marginLeft:4 }}>여기서 발급</a>
        </div>
        <ApiKeyInput value={profile.apiKey} onSave={(v)=>setProfile({apiKey:v})} />
        <div style={{ fontSize:10.5, color:C.muted, marginTop:8, lineHeight:1.5 }}>
          이 키는 이 브라우저에만 저장되고, 입력하면 사용한 만큼만 요금이 나가요. 키가 없어도 로컬 목록 + 직접 입력으로 대부분의 기록이 가능해요.
        </div>
      </Card>

      {/* 목표 */}
      <Card>
        <Row><span style={lbl}>목표</span></Row>
        <div style={{ display:"flex", gap:6, marginTop:10 }}>
          <Field label="목표 체중 kg" v={profile.goalWeight} on={(v)=>setProfile({goalWeight:v})} />
          <Field label="목표 체지방 %" v={profile.goalFat} on={(v)=>setProfile({goalFat:v})} />
        </div>
        {goalPct!=null && (<>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted, margin:"14px 0 6px" }}>
            <span>{startW}kg</span><span style={{ color:TYPES.legs.color, fontWeight:700 }}>{latestWeight}kg</span><span>{goalW}kg</span>
          </div>
          <div style={{ height:8, background:C.surface2, borderRadius:99, overflow:"hidden" }}>
            <div style={{ width:`${goalPct}%`, height:"100%", background:TYPES.legs.color, borderRadius:99 }} /></div>
          <div style={{ fontSize:11, color:C.muted, marginTop:6, textAlign:"right" }}>목표까지 {(goalW-latestWeight).toFixed(1)}kg</div>
          {goalETA && (
            <div style={{ marginTop:10, padding:"11px 12px", borderRadius:10, background:C.surface2,
              border:`1px solid ${goalETA.eta?tint(TYPES.legs.color,0.4):goalETA.diverging?tint(C.danger,0.4):C.line}` }}>
              {goalETA.reached ? (
                <span style={{ fontSize:12.5, fontWeight:800, color:TYPES.legs.color }}>🎉 목표 도달! 새 목표를 세워볼까요?</span>
              ) : goalETA.eta ? (
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:TYPES.legs.color }}>🎯 약 {Math.max(1,Math.round(goalETA.weeks))}주 후 도달 예상</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{goalETA.eta.getFullYear()}.{goalETA.eta.getMonth()+1}.{goalETA.eta.getDate()} 즈음 · 최근 페이스 {fmtRate(goalETA.ratePerWeek)}</div>
                </div>
              ) : goalETA.diverging ? (
                <span style={{ fontSize:12, fontWeight:700, color:C.danger }}>⚠️ 최근 추세({fmtRate(goalETA.ratePerWeek)})로는 목표에서 멀어지고 있어요</span>
              ) : goalETA.flat ? (
                <span style={{ fontSize:12, fontWeight:700, color:C.muted }}>최근 체중 변화가 거의 없어 도달 시점을 예측하기 어려워요</span>
              ) : (
                <span style={{ fontSize:12, fontWeight:700, color:C.muted }}>추세를 계산하려면 체중 기록이 조금 더 필요해요</span>
              )}
            </div>
          )}
        </>)}
      </Card>

      {/* 추이 그래프 */}
      <Card>
        <Row><span style={lbl}>변화 추이</span></Row>
        <div style={{ display:"flex", gap:7, marginTop:10 }}>
          {[["weight","체중"],["fat","체지방"],["muscle","골격근"]].map(([k,label])=>(
            <button key={k} onClick={()=>setMetric(k)} style={{...chip(metric===k, k==="weight"?TYPES.legs.color:k==="fat"?C.amber:TYPES.pull.color), flex:1, textAlign:"center"}}>{label}</button>
          ))}
        </div>
        <LineChart points={metricPts} color={metricColor} unit={metric==="fat"?"%":"kg"} empty={`${metric==="weight"?"체중":metric==="fat"?"체지방":"골격근"} 측정을 2회 이상 기록하면 그래프가 나와요.`} />
      </Card>

      {/* 측정 추가 */}
      <Card>
        <Row><span style={lbl}>측정 기록 추가</span><span style={{ fontSize:11, color:C.muted }}>인바디 측정일에 입력</span></Row>
        <input type="date" value={m.date} onChange={(e)=>setM({...m,date:e.target.value})} style={{...inp, width:"100%", boxSizing:"border-box", marginTop:8, colorScheme:"dark"}} />
        <div style={{ display:"flex", gap:6, marginTop:8 }}>
          <Field label="체중kg" v={m.weight} on={(v)=>setM({...m,weight:v})} />
          <Field label="체지방%" v={m.fat} on={(v)=>setM({...m,fat:v})} />
          <Field label="골격근kg" v={m.muscle} on={(v)=>setM({...m,muscle:v})} />
        </div>
        <input value={m.note} onChange={(e)=>setM({...m,note:e.target.value})} placeholder="메모 (선택)" style={{...inp, width:"100%", boxSizing:"border-box", marginTop:8}} />
        <button onClick={addMeasure} style={{...primary(TYPES.legs.color), width:"100%", marginTop:8}}>기록 저장</button>
      </Card>

      {sortedDesc.length>0 && (
        <Card>
          <Row><span style={lbl}>측정 이력</span></Row>
          {sortedDesc.map((x)=>(
            <div key={x.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.line}` }}>
              <div><div style={{ fontSize:13, fontWeight:700 }}>{x.date.replace(/-/g,".")}</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{x.weight}kg{x.fat!=null?` · 체지방 ${x.fat}%`:""}{x.muscle!=null?` · 골격근 ${x.muscle}kg`:""}</div>
                {x.note && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{x.note}</div>}</div>
              <button onClick={()=>rmMeasure(x.id)} style={xBtn}>×</button>
            </div>
          ))}
        </Card>
      )}

      {/* 백업 */}
      <Card>
        <Row><span style={lbl}>데이터 백업</span>
          <span style={{ fontSize:11.5, color: backupStale?C.amber:C.muted, fontWeight:backupStale?800:600 }}>
            {daysSinceBackup===null ? "백업 기록 없음" : daysSinceBackup===0 ? "오늘 백업함 ✓" : `${daysSinceBackup}일 전 백업`}
          </span>
        </Row>
        {backupStale && (
          <div style={{ marginTop:10, padding:"11px 12px", background:tint(C.amber,0.1), border:`1px solid ${tint(C.amber,0.4)}`, borderRadius:10, display:"flex", gap:9, alignItems:"flex-start" }}>
            <span style={{ fontSize:15, lineHeight:1.3 }}>⚠️</span>
            <span style={{ fontSize:11.5, color:C.amber, fontWeight:700, lineHeight:1.55 }}>
              {daysSinceBackup===null ? "아직 백업한 적이 없어요. 기기·브라우저 데이터가 지워지면 기록이 사라질 수 있으니 지금 한 번 백업해두세요." : "백업한 지 오래됐어요. 최근 기록을 잃지 않으려면 다시 백업해두는 게 좋아요."}
            </span>
          </div>
        )}
        <button onClick={exportData} style={{...primary(backupStale?C.amber:C.text), width:"100%", marginTop:10, color:"#141519"}}>백업 텍스트 만들기</button>
        {exportOpen && (
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:11.5, color:C.muted, marginBottom:6 }}>
              아래 내용을 복사해서 메모장·나에게 보내기 메시지 등에 저장해두세요.
            </div>
            <textarea ref={exportTaRef} readOnly value={JSON.stringify(data,null,2)} rows={4}
              onFocus={(e)=>e.target.select()}
              style={{...inp, width:"100%", boxSizing:"border-box", resize:"none", fontFamily:"monospace", fontSize:11, lineHeight:1.4}} />
            <button onClick={copyBackup} style={{...primary(TYPES.legs.color), width:"100%", marginTop:8}}>복사하기</button>
            {copyMsg && <div style={{ fontSize:12, color: copyMsg.includes("복사됐어요")?TYPES.legs.color:C.amber, marginTop:8 }}>{copyMsg}</div>}
          </div>
        )}
        <div style={{ fontSize:11, color:C.muted, margin:"14px 0 6px" }}>가져오기 (백업 텍스트 붙여넣기)</div>
        <textarea value={importText} onChange={(e)=>setImportText(e.target.value)} rows={2} placeholder='{"schedule":...}'
          style={{...inp, width:"100%", boxSizing:"border-box", resize:"none", fontFamily:"monospace", fontSize:12}} />
        <button onClick={doImport} style={{...ghost, width:"100%", marginTop:8}}>가져오기 적용</button>
        {importMsg && <div style={{ fontSize:12, color: importMsg.includes("완료")?TYPES.legs.color:C.danger, marginTop:8 }}>{importMsg}</div>}
      </Card>
    </div>
  );
}

// ================= 탄단지 비율 =================
// 실제 섭취 비율(칼로리 기준)을 권장 비율과 나란히 비교
function MacroRatio({ carbs, protein, fat, goal }) {
  const cCal = num(carbs)*4, pCal = num(protein)*4, fCal = num(fat)*9;
  const total = cCal + pCal + fCal;
  const has = total > 0;
  const pctOf = (v)=> has ? Math.round(v/total*100) : 0;
  const items = [
    { key:"carb",    label:"탄수", short:"탄", g:num(carbs),   pct:pctOf(cCal), goal:goal.carb,    color:"#5AA9FF" },
    { key:"protein", label:"단백", short:"단", g:num(protein), pct:pctOf(pCal), goal:goal.protein, color:TYPES.legs.color },
    { key:"fat",     label:"지방", short:"지", g:num(fat),     pct:pctOf(fCal), goal:goal.fat,     color:"#FFB74B" },
  ];
  // 권장 대비 편차가 가장 큰 항목으로 한 줄 코멘트
  const worst = has ? [...items].sort((a,b)=>Math.abs(b.pct-b.goal)-Math.abs(a.pct-a.goal))[0] : null;
  const gap = worst ? worst.pct - worst.goal : 0;
  const comment = !has ? "음식을 기록하면 비율이 표시돼요"
    : Math.abs(gap) <= 5 ? `${goal.label} 권장 비율에 잘 맞아요 👍`
    : `${worst.label}이 권장보다 ${Math.abs(gap)}%p ${gap>0?"많아요":"적어요"}`;

  return (
    <div style={{ marginTop:18 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
        <span style={{ fontSize:12, fontWeight:800, color:C.muted }}>탄단지 비율</span>
        <span style={{ fontSize:10.5, fontWeight:700, color:goal.color, background:tint(goal.color,0.13),
          border:`1px solid ${tint(goal.color,0.4)}`, borderRadius:999, padding:"3px 9px" }}>{goal.label} 기준</span>
      </div>

      {/* 실제 비율 통짜 바 */}
      <div style={{ display:"flex", height:22, borderRadius:8, overflow:"hidden", background:C.surface2 }}>
        {has ? items.map((it)=> it.pct>0 && (
          <div key={it.key} style={{ width:`${it.pct}%`, background:it.color, display:"flex", alignItems:"center",
            justifyContent:"center", transition:"width .35s" }}>
            {it.pct>=12 && <span style={{ fontSize:10.5, fontWeight:800, color:"#141519" }}>{it.pct}%</span>}
          </div>
        )) : <div style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:10.5, color:C.muted }}>기록 없음</span></div>}
      </div>

      {/* 항목별 실제 vs 권장 */}
      <div style={{ display:"flex", gap:6, marginTop:9 }}>
        {items.map((it)=>{
          const d = it.pct - it.goal;
          const ok = Math.abs(d) <= 5;
          return (
            <div key={it.key} style={{ flex:1, minWidth:0, background:C.surface2, borderRadius:9, padding:"8px 7px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ width:7, height:7, borderRadius:"50%", background:it.color, flexShrink:0 }} />
                <span style={{ fontSize:10.5, color:C.muted, fontWeight:600 }}>{it.label}</span>
              </div>
              <div style={{ fontSize:15, fontWeight:800, color:it.color, marginTop:3 }}>{it.pct}<span style={{ fontSize:10 }}>%</span></div>
              <div style={{ fontSize:9.5, color:C.muted, marginTop:1 }}>{Math.round(it.g)}g · 권장 {it.goal}%</div>
              {has && (
                <div style={{ fontSize:9.5, fontWeight:800, marginTop:2, color: ok?TYPES.legs.color:C.amber }}>
                  {ok ? "적정" : `${d>0?"▲":"▼"}${Math.abs(d)}%p`}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:11, color: has&&Math.abs(gap)<=5?TYPES.legs.color:C.muted, marginTop:8, fontWeight:600 }}>{comment}</div>
    </div>
  );
}

function NutriRow({ label, value, target, color, overType, capLabel }) {
  const over = target != null && value > target;
  const pct = target ? Math.min(100, Math.round(value / target * 100)) : 0;
  const overColor = overType === "hard" ? C.danger : C.amber;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{label}{" "}
          <span style={{ color: C.muted, fontWeight: 500 }}>{value}g{target != null ? ` / ${capLabel || "목표"} ${target}g` : ""}</span>
        </span>
        {over && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#141519", background: overColor, borderRadius: 6, padding: "2px 7px" }}>초과</span>}
      </div>
      {target != null && (
        <div style={{ height: 6, background: C.surface2, borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: over ? overColor : color, borderRadius: 99 }} />
        </div>
      )}
    </div>
  );
}

// ================= 공용: 식단 섹션 =================
function FoodSection({ foods, addFoods, removeFood, updateFood, favorites, addFavorite, removeFavorite, compact, apiKey, customFoods }) {
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
              <div style={{ fontSize:12, color:C.muted }}>단백질 {num(f.protein)}g · 탄수 {num(f.carbs)}g · 당 {num(f.sugar)}g · 지방 {num(f.fat)}g{num(f.kcal)>0?` · ${f.kcal}kcal`:""}{num(f.liquidMl)>0?` · 💧${f.liquidMl}ml`:""}</div>
            </div>
            <button onClick={()=>addFavorite(f)} title="즐겨찾기" style={{ ...xBtn, color:C.amber, marginRight:6 }}>★</button>
            <button onClick={()=>removeFood(f.id)} style={xBtn}>×</button>
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
const OIL_PRESETS = [
  { label:"식용유 1작은술", kcal:40, fat:4.5 },
  { label:"식용유 1큰술", kcal:120, fat:14 },
  { label:"올리브유 1큰술", kcal:120, fat:14 },
  { label:"버터 10g", kcal:72, fat:8 },
  { label:"참기름 1큰술", kcal:120, fat:14 },
];

function FoodEditRow({ food, onSave, onCancel }) {
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

function FoodAI({ onAdd, compact, apiKey, customFoods }) {
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
function LineChart({ points, color, unit, empty }) {
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

function Bars7({ values, color, target, suffix, hoursLabel }) {
  const days = last7();
  const max = Math.max(target||0, 1, ...values);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:92, position:"relative" }}>
      {values.map((v,i)=>{ const hgt=Math.max(3,(v/max)*74); const isToday=i===6;
        return (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
            <div style={{ fontSize:9, color:C.muted, height:11 }}>{v?(hoursLabel?Math.round(v/6)/10+"h":v):""}</div>
            <div style={{ width:"72%", height:hgt, borderRadius:5, background:v?color:C.surface2, opacity:isToday?1:0.7 }} />
            <div style={{ fontSize:10, fontWeight:700, color:isToday?C.text:C.muted }}>{WEEKDAYS[dowOf(days[i])]}</div>
          </div>
        ); })}
    </div>
  );
}

// ================= 통계 =================
function Stats({ data, target, tdee, weight }) {
  const [range, setRange] = useState("week");
  const [expanded, setExpanded] = useState(null);
  const days = rangeDays(range);
  const nDays = days.length;
  const surplus = num(data.profile.surplus);
  const mt = macroTargets(tdee, surplus, weight, target?target.high:null);

  // 하루별 지표 뽑기
  const perDay = days.map((dk) => {
    const e = data.schedule[dk] || {};
    const foods = e.foods || [];
    const protein = foods.reduce((s,f)=>s+num(f.protein),0);
    const carbs = foods.reduce((s,f)=>s+num(f.carbs),0);
    const sugar = foods.reduce((s,f)=>s+num(f.sugar),0);
    const fat = foods.reduce((s,f)=>s+num(f.fat),0);
    const kcalIn = foods.reduce((s,f)=>s+num(f.kcal),0);
    const kcalOut = burnedKcal(e, weight);
    const net = tdee!=null ? kcalIn - tdee - kcalOut : null;
    const studyMin = (data.study||[]).filter((s)=>s.date===dk).reduce((a,s)=>a+s.minutes,0);
    const sleep = num(e.sleep?.hours);
    const water = num(e.water);
    const hasFood = foods.length>0;
    const worked = didWorkout(e);
    const partSets = e.partSets || {};
    const mood = num(e.mood);
    const cardioMin = e.cardio ? num(e.cardio.min) : 0;
    const cardioType = e.cardio ? e.cardio.type : null;
    return { dk, protein, carbs, sugar, fat, kcalIn, kcalOut, net, studyMin, sleep, water, hasFood, worked, partSets, mood, cardioMin, cardioType, steps:num(e.steps) };
  });

  // 평균/합계 (식단 기록이 있는 날 기준 평균이 공정함)
  const foodDays = perDay.filter((d)=>d.hasFood);
  const avg = (arr, sel) => arr.length ? arr.reduce((s,x)=>s+sel(x),0)/arr.length : 0;
  const sum = (sel) => perDay.reduce((s,x)=>s+sel(x),0);

  const avgProtein = Math.round(avg(foodDays, d=>d.protein));
  const avgCarbs = Math.round(avg(foodDays, d=>d.carbs));
  const avgSugar = Math.round(avg(foodDays, d=>d.sugar));
  const avgFat = Math.round(avg(foodDays, d=>d.fat));
  const netDays = perDay.filter(d=>d.net!=null && d.hasFood);
  const avgNet = netDays.length ? Math.round(avg(netDays, d=>d.net)) : null;
  const sleepDays = perDay.filter(d=>d.sleep>0);
  const avgSleep = sleepDays.length ? (avg(sleepDays, d=>d.sleep)).toFixed(1) : null;
  const totalStudy = sum(d=>d.studyMin);
  const avgStudy = Math.round(totalStudy/nDays);
  const avgWater = (avg(perDay, d=>d.water)).toFixed(1);
  const workoutCount = perDay.filter(d=>d.worked).length;

  // 직전 동일 기간 요약 — "지난주/지난달 대비" 비교용
  const summarize = (dayKeys) => {
    const pd = dayKeys.map((dk)=>{
      const e = data.schedule[dk] || {};
      const foods = e.foods || [];
      const kcalIn = foods.reduce((s,f)=>s+num(f.kcal),0);
      const kcalOut = burnedKcal(e, weight);
      return {
        protein: foods.reduce((s,f)=>s+num(f.protein),0),
        net: tdee!=null ? kcalIn - tdee - kcalOut : null,
        studyMin: (data.study||[]).filter((s)=>s.date===dk).reduce((a,s)=>a+s.minutes,0),
        sleep: num(e.sleep?.hours), water: num(e.water),
        hasFood: foods.length>0, worked: didWorkout(e),
      };
    });
    const fd = pd.filter(d=>d.hasFood);
    const sd = pd.filter(d=>d.sleep>0);
    const nd = pd.filter(d=>d.net!=null && d.hasFood);
    const a = (arr,sel)=> arr.length ? arr.reduce((s,x)=>s+sel(x),0)/arr.length : 0;
    return {
      avgProtein: Math.round(a(fd,d=>d.protein)),
      avgNet: nd.length ? Math.round(a(nd,d=>d.net)) : null,
      avgSleep: sd.length ? a(sd,d=>d.sleep) : null,
      avgWater: a(pd,d=>d.water),
      totalStudy: pd.reduce((s,d)=>s+d.studyMin,0),
      workoutCount: pd.filter(d=>d.worked).length,
      hasData: fd.length>0 || pd.some(d=>d.worked||d.sleep>0||d.studyMin>0),
    };
  };
  const prevDays = prevRangeDays(range);
  const prev = summarize(prevDays);

  // 체중 변화: 각 기간 끝 시점 기준 가장 최근 측정값 비교
  const measuresAsc = [...data.measurements].sort((a,b)=>a.date.localeCompare(b.date));
  const weightAt = (dateKey) => { let w=null; for(const x of measuresAsc){ if(x.date<=dateKey) w=x.weight; else break; } return w; };
  const curW = weightAt(days[days.length-1]);
  const prevW = weightAt(prevDays[prevDays.length-1]);
  const weightDelta = (curW!=null && prevW!=null) ? Math.round((curW-prevW)*10)/10 : null;

  // 비교 항목 (현재값, 증감, 좋아지는 방향)
  const cmpItems = [
    { icon:"🥩", label:"평균 단백질", cur:`${avgProtein}g`, delta: avgProtein - prev.avgProtein, unit:"g", better:"up" },
    { icon:"💪", label:"운동 횟수", cur:`${workoutCount}회`, delta: workoutCount - prev.workoutCount, unit:"회", better:"up" },
    (avgNet!=null && prev.avgNet!=null) ? { icon:"🔥", label:"칼로리 밸런스", cur:`${avgNet>=0?"+":""}${avgNet}`, delta: avgNet - prev.avgNet, unit:"", better:"near", curV:avgNet, prevV:prev.avgNet } : null,
    (avgSleep!=null && prev.avgSleep!=null) ? { icon:"😴", label:"평균 수면", cur:`${avgSleep}h`, delta: Math.round((num(avgSleep)-prev.avgSleep)*10)/10, unit:"h", better:"up" } : null,
    { icon:"💧", label:"평균 물", cur:`${avgWater}잔`, delta: Math.round((num(avgWater)-prev.avgWater)*10)/10, unit:"잔", better:"up" },
    (totalStudy>0 || prev.totalStudy>0) ? { icon:"📚", label:"총 공부", cur:fmtMin(totalStudy), delta: totalStudy - prev.totalStudy, unit:"분", better:"up", isTime:true } : null,
    weightDelta!=null ? { icon:"⚖️", label:"체중", cur:`${curW}kg`, delta: weightDelta, unit:"kg", better:"neutral" } : null,
  ].filter(Boolean);
  const deltaView = (it) => {
    const d = it.delta;
    if (d===0 || d==null) return { text:"변화 없음", color:C.muted };
    const up = d>0;
    let good = null;
    if (it.better==="up") good = up;
    else if (it.better==="down") good = !up;
    else if (it.better==="near") good = Math.abs(it.curV-surplus) < Math.abs(it.prevV-surplus);
    // neutral(체중 등)은 좋고 나쁨 판정 없이 회색 화살표만
    const color = good===null ? C.text : good ? TYPES.legs.color : C.danger;
    const mag = it.isTime ? fmtMin(Math.abs(d)) : `${Math.abs(d)}${it.unit}`;
    return { text:`${up?"▲":"▼"} ${mag}`, color };
  };

  // 부위별 볼륨 (기간 내 총 세트수) — 퀵 기록(partSets) 기준
  const volumeByPart = {};
  perDay.forEach((d)=>{ for (const [p,s] of Object.entries(d.partSets)) volumeByPart[p]=(volumeByPart[p]||0)+num(s); });
  const volumeEntries = PARTS.map((p)=>[p, volumeByPart[p]||0]);
  const maxVol = Math.max(1, ...volumeEntries.map(([,v])=>v));
  const hasAnyVolume = volumeEntries.some(([,v])=>v>0);
  const missedParts = hasAnyVolume ? volumeEntries.filter(([,v])=>v===0).map(([p])=>p) : [];

  // 밀기·당기기·하체 밸런스
  const GROUPS = [
    { key:"밀기", color:TYPES.push.color, parts:["가슴","가슴안쪽","어깨","삼두"] },
    { key:"당기기", color:TYPES.pull.color, parts:["등","후면어깨","이두"] },
    { key:"하체", color:TYPES.legs.color, parts:["하체","둔근"] },
    { key:"코어", color:C.amber, parts:["복근"] },
  ];
  const groupVol = GROUPS.map(g=>({ ...g, sets: g.parts.reduce((s,p)=>s+(volumeByPart[p]||0),0) }));
  const maxGroup = Math.max(1, ...groupVol.map(g=>g.sets));
  const pushV = groupVol[0].sets, pullV = groupVol[1].sets;
  const balanceWarn = (pushV>0 && pullV>0 && (pushV/pullV>1.5 || pullV/pushV>1.5))
    ? (pushV>pullV ? `밀기가 당기기보다 많아요 (${pushV}:${pullV}). 자세·어깨 균형을 위해 당기기(등·이두)를 늘려보세요.`
                   : `당기기가 밀기보다 많아요 (${pushV}:${pullV}). 밀기(가슴·어깨·삼두)를 조금 더 채워보세요.`)
    : null;

  // 연속 기록 (현재 + 역대 최고)
  const hasLog = (e)=> !!(e && ((e.foods&&e.foods.length)||didWorkout(e)||e.sleep||e.water||e.creatine||e.mood||e.diary));
  const streaks = [
    { key:"기록", icon:"📝", color:TYPES.push.color, ...streakInfo(data.schedule, (kk)=>hasLog(data.schedule[kk])) },
    { key:"단백질 목표", icon:"🥩", color:TYPES.legs.color, ...(target ? streakInfo(data.schedule, (kk)=>(data.schedule[kk]?.foods||[]).reduce((s,f)=>s+num(f.protein),0) >= target.low) : {current:0,best:0}) },
    { key:"운동", icon:"💪", color:TYPES.pull.color, ...streakInfo(data.schedule, (kk)=>didWorkout(data.schedule[kk])) },
    { key:"크레아틴", icon:"💊", color:"#C9A6FF", ...streakInfo(data.schedule, (kk)=>!!data.schedule[kk]?.creatine) },
  ];
  const anyStreak = streaks.some(s=>s.best>0);

  // 유산소 집계 (기간 내 세션·시간·소모 kcal + 종류별)
  const cardioDays = perDay.filter(d=>d.cardioMin>0 || d.kcalOut>0);
  const cardioSessions = cardioDays.length;
  const cardioMinTotal = perDay.reduce((s,d)=>s+d.cardioMin,0);
  const cardioKcalTotal = perDay.reduce((s,d)=>s+d.kcalOut,0);
  const cardioAvgMin = cardioSessions ? Math.round(cardioMinTotal/cardioSessions) : 0;
  const cardioByType = Object.keys(CARDIO).map((k)=>{
    const ds = perDay.filter(d=>d.cardioType===k);
    return { k, ...CARDIO[k], sessions:ds.length, min:ds.reduce((s,d)=>s+d.cardioMin,0), kcal:ds.reduce((s,d)=>s+d.kcalOut,0) };
  }).filter(t=>t.sessions>0).sort((a,b)=>b.min-a.min);
  const maxCardioType = Math.max(1, ...cardioByType.map(t=>t.min));
  const cardioMaxDay = Math.max(1, ...perDay.map(d=>d.cardioMin));
  // 주당 유산소 시간 (WHO 권장 주 150분 대비)
  const cardioPerWeek = nDays>0 ? Math.round(cardioMinTotal/nDays*7) : 0;

  // 상태 판정: good(초록)/warn(노랑)/bad(빨강)/none(회색)
  const S = { good:TYPES.legs.color, warn:C.amber, bad:C.danger, none:C.muted };
  // 목표 대비 달성 여부 → 상태 + 코멘트
  const proteinStat = () => {
    if (!target) return { s:"none", msg:"몸무게 입력 필요" };
    if (avgProtein >= target.low) return { s:"good", msg:`목표 ${target.low}g 이상 달성` };
    if (avgProtein >= target.low*0.8) return { s:"warn", msg:`목표보다 ${target.low-avgProtein}g 부족` };
    return { s:"bad", msg:`목표보다 ${target.low-avgProtein}g 많이 부족` };
  };
  const netStat = () => {
    if (avgNet==null) return { s:"none", msg:"프로필 입력 필요" };
    const diff = avgNet - surplus;
    if (Math.abs(diff) <= 150) return { s:"good", msg:`목표(${surplus>=0?"+":""}${surplus}) 근처 유지` };
    if (avgNet > surplus) return { s:"warn", msg:`목표보다 +${diff}kcal 초과 섭취` };
    return { s:"warn", msg:`목표보다 ${diff}kcal 적게 섭취` };
  };
  const sugarStat = () => {
    if (!mt) return { s:"none", msg:"프로필 입력 필요" };
    if (avgSugar <= mt.sugar) return { s:"good", msg:`상한 ${mt.sugar}g 이내` };
    return { s:"bad", msg:`상한보다 ${avgSugar-mt.sugar}g 초과` };
  };
  const sleepStat = () => {
    if (avgSleep==null) return { s:"none", msg:"기록 없음" };
    if (avgSleep >= 7) return { s:"good", msg:"충분한 수면" };
    if (avgSleep >= 6) return { s:"warn", msg:"조금 부족" };
    return { s:"bad", msg:"수면 부족" };
  };
  const workoutStat = () => {
    const perWeek = workoutCount / (nDays/7);
    if (perWeek >= 4.5) return { s:"good", msg:`주 ${(perWeek).toFixed(1)}회 페이스` };
    if (perWeek >= 3) return { s:"warn", msg:`주 ${(perWeek).toFixed(1)}회 페이스` };
    return { s:"bad", msg:`주 ${(perWeek).toFixed(1)}회 페이스` };
  };
  const cardioStat = () => {
    if (cardioSessions===0) return { s:"none", msg:"기록 없음" };
    if (cardioPerWeek >= 150) return { s:"good", msg:`주 ${cardioPerWeek}분 · 권장량 달성` };
    if (cardioPerWeek >= 75) return { s:"warn", msg:`주 ${cardioPerWeek}분 · 권장 150분` };
    return { s:"bad", msg:`주 ${cardioPerWeek}분 · 조금 더 늘려보세요` };
  };
  const studyStat = () => {
    if (totalStudy===0) return { s:"none", msg:"기록 없음" };
    return { s:"good", msg:`총 ${fmtMin(totalStudy)}` };
  };
  const waterStat = () => {
    if (num(avgWater)===0) return { s:"none", msg:"기록 없음" };
    if (num(avgWater) >= 6) return { s:"good", msg:"충분" };
    return { s:"warn", msg:"조금 더 마셔요" };
  };

  // 크레아틴 복용
  const creatineDays = days.filter((dk)=> data.schedule[dk]?.creatine).length;
  const creatineStat = () => {
    if (creatineDays===0) return { s:"none", msg:"기록 없음" };
    const rate = creatineDays/nDays;
    if (rate >= 0.85) return { s:"good", msg:"꾸준히 복용 중" };
    if (rate >= 0.5) return { s:"warn", msg:`${nDays-creatineDays}일 빠뜨림` };
    return { s:"bad", msg:"자주 빠뜨려요 — 매일 일정 시간에!" };
  };

  const dayLabels = perDay.map((d)=> range==="month" ? d.dk.slice(8) : d.dk.slice(5).replace("-","/"));
  const rows = [
    { key:"protein", icon:"🥩", label:"단백질", value:`${avgProtein}g`, sub: range==="day"?"오늘":"하루 평균", stat:proteinStat(),
      series: perDay.map(d=>d.protein), goal: target?target.low:null, goalType:"min", unit:"g", color:TYPES.legs.color },
    { key:"net", icon:"🔥", label:"칼로리 밸런스", value: avgNet!=null?`${avgNet>=0?"+":""}${avgNet}`:"—", sub:"하루 평균 (소모 반영)", stat:netStat(),
      series: perDay.map(d=> d.hasFood&&d.net!=null ? d.kcalIn : 0), goal: tdee!=null?tdee+surplus:null, goalType:"cap", unit:"kcal 섭취", color:C.amber },
    { key:"sugar", icon:"🍬", label:"당류", value:`${avgSugar}g`, sub:"하루 평균", stat:sugarStat(),
      series: perDay.map(d=>d.sugar), goal: mt?mt.sugar:null, goalType:"cap", unit:"g", color:"#FF8FB0" },
    { key:"workout", icon:"💪", label:"운동", value:`${workoutCount}회`, sub: range==="day"?"오늘":`${nDays}일 중`, stat:workoutStat(),
      series: perDay.map(d=>d.worked?1:0), goal:null, unit:"", color:TYPES.push.color },
    { key:"cardio", icon:"🏃", label:"유산소", value: fmtMin(cardioMinTotal), sub: range==="day"?"오늘":`${cardioSessions}회 · ${nDays}일 중`, stat:cardioStat(),
      series: perDay.map(d=>d.cardioMin), goal:null, unit:"분", color:C.amber },
    { key:"creatine", icon:"💊", label:"크레아틴", value:`${creatineDays}/${nDays}일`, sub:"복용일", stat:creatineStat(),
      series: perDay.map(d=> data.schedule[d.dk]?.creatine?1:0), goal:null, unit:"", color:"#C9A6FF" },
    { key:"sleep", icon:"😴", label:"수면", value: avgSleep!=null?`${avgSleep}h`:"—", sub:"하루 평균", stat:sleepStat(),
      series: perDay.map(d=>d.sleep), goal:7, goalType:"min", unit:"시간", color:SLEEP_ACCENT },
    { key:"study", icon:"📚", label:"공부", value: fmtMin(avgStudy), sub:"하루 평균", stat:studyStat(),
      series: perDay.map(d=>d.studyMin), goal:null, unit:"분", color:STUDY_ACCENT },
    { key:"water", icon:"💧", label:"물", value:`${avgWater}잔`, sub:"하루 평균", stat:waterStat(),
      series: perDay.map(d=>d.water), goal:6, goalType:"min", unit:"잔", color:"#6BC5F0" },
  ];

  // 기분 평균 (기록된 날만)
  const moodDays = perDay.filter(d=>d.mood>0);
  const avgMood = moodDays.length ? (moodDays.reduce((s,d)=>s+d.mood,0)/moodDays.length) : null;
  if (avgMood!=null) {
    rows.push({ key:"mood", icon:"🙂", label:"기분", value: MOODS.find(m=>m.v===Math.round(avgMood))?.emoji||`${avgMood.toFixed(1)}`, sub:"평균",
      stat: avgMood>=3.5?{s:"good",msg:"대체로 좋은 편"}:avgMood>=2.5?{s:"warn",msg:"보통"}:{s:"bad",msg:"가라앉은 날이 많아요"},
      series: perDay.map(d=>d.mood), goal:null, unit:"", color:"#FFC24B" });
  }

  // 습관 이행률
  if (data.habits.length>0) {
    const habitTotals = days.map((dk)=>{
      const lg = data.schedule[dk]?.habitLog||{};
      return data.habits.filter(h=>lg[h.id]).length;
    });
    const totalDone = habitTotals.reduce((a,b)=>a+b,0);
    const totalPossible = data.habits.length * nDays;
    const rate = totalPossible ? Math.round(totalDone/totalPossible*100) : 0;
    rows.push({ key:"habits", icon:"✅", label:"습관 이행률", value:`${rate}%`, sub:`${data.habits.length}개 습관`,
      stat: rate>=80?{s:"good",msg:"잘 지키고 있어요"}:rate>=50?{s:"warn",msg:"절반 정도"}:{s:"bad",msg:"더 챙겨봐요"},
      series: habitTotals, goal:null, unit:"개", color:TYPES.legs.color });
  }

  // 종합 점수: 판정 가능한 지표 중 good 비율
  const judged = rows.filter(r=>r.stat.s!=="none");
  const goodCount = judged.filter(r=>r.stat.s==="good").length;
  const scorePct = judged.length ? Math.round(goodCount/judged.length*100) : 0;
  const scoreColor = scorePct>=70 ? S.good : scorePct>=40 ? S.warn : S.bad;
  const badItems = judged.filter(r=>r.stat.s==="bad" || r.stat.s==="warn").map(r=>r.label);

  return (
    <div style={{ padding:"22px 18px 8px" }}>
      <div style={{ fontSize:11, letterSpacing:3, color:TYPES.push.color, fontWeight:800 }}>STATS</div>
      <div style={{ fontSize:30, fontWeight:800, letterSpacing:-1, marginTop:4 }}>통계</div>

      {/* 기간 전환 */}
      <div style={{ display:"flex", gap:6, marginTop:14, background:C.surface2, padding:4, borderRadius:12 }}>
        {[["day","일간"],["week","주간"],["month","월간"]].map(([k,label])=>(
          <button key={k} onClick={()=>setRange(k)} style={{
            flex:1, padding:"10px 0", borderRadius:9, border:"none", cursor:"pointer", fontSize:13, fontWeight:800,
            background: range===k ? C.surface : "transparent",
            color: range===k ? TYPES.push.color : C.muted,
          }}>{label}</button>
        ))}
      </div>

      {/* 종합 카드 */}
      <GlassCard glow={scoreColor}>
        <Row><span style={lbl}>종합 · {rangeLabel(range)}</span></Row>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginTop:12 }}>
          <GaugeRing pct={scorePct} color={scoreColor} size={92} stroke={10} label="점" />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:800, color:scoreColor }}>
              {scorePct>=70?"아주 잘 지켰어요":scorePct>=40?"무난했어요":"조금 아쉬워요"}
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4, lineHeight:1.5 }}>
              {judged.length===0 ? "기록을 쌓으면 분석이 나와요" :
                badItems.length===0 ? "모든 지표가 목표를 잘 지켰어요 👍" :
                `보완하면 좋을 것: ${badItems.join(", ")}`}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 연속 기록 (스트릭) */}
      {anyStreak && (
        <Card>
          <Row><span style={lbl}>연속 기록</span><span style={{ fontSize:11, color:C.muted }}>현재 · 최고</span></Row>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
            {streaks.map((s)=>{
              const active = s.current>0;
              return (
                <div key={s.key} style={{ background:C.surface2, borderRadius:11, padding:"11px 12px",
                  border:`1px solid ${active?tint(s.color,0.4):C.line}` }}>
                  <div style={{ fontSize:11, color:C.muted, fontWeight:600 }}>{s.icon} {s.key}</div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:5, marginTop:4 }}>
                    <span style={{ fontSize:20, fontWeight:800, color: active?s.color:C.muted }}>{s.current}</span>
                    <span style={{ fontSize:11, color:C.muted }}>일{active&&s.current>=2?" 🔥":""}</span>
                  </div>
                  <div style={{ fontSize:10.5, color:C.muted, marginTop:2 }}>최고 {s.best}일</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 지난 기간 대비 */}
      <Card>
        <Row><span style={lbl}>{compareLabel(range)}</span></Row>
        {!prev.hasData ? (
          <div style={{ color:C.muted, fontSize:12.5, marginTop:10, lineHeight:1.6 }}>
            비교할 이전 {range==="day"?"날":"기간"} 기록이 아직 없어요. 꾸준히 기록하면 {compareLabel(range)} 변화가 여기 나타나요.
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
            {cmpItems.map((it)=>{
              const dv = deltaView(it);
              return (
                <div key={it.label} style={{ background:C.surface2, borderRadius:11, padding:"11px 12px" }}>
                  <div style={{ fontSize:11, color:C.muted, fontWeight:600 }}>{it.icon} {it.label}</div>
                  <div style={{ fontSize:17, fontWeight:800, marginTop:4 }}>{it.cur}</div>
                  <div style={{ fontSize:11.5, fontWeight:800, color:dv.color, marginTop:3 }}>{dv.text}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 부위별 볼륨 */}
      <Card>
        <Row><span style={lbl}>부위별 볼륨 · {rangeLabel(range)}</span>
          {hasAnyVolume && <span style={{ fontSize:11.5, color:C.muted }}>총 {volumeEntries.reduce((s,[,v])=>s+v,0)}세트</span>}
        </Row>
        {!hasAnyVolume ? (
          <div style={{ color:C.muted, fontSize:12.5, marginTop:10, lineHeight:1.6 }}>
            아직 부위 기록이 없어요. 오늘 탭의 <b style={{color:C.text}}>퀵 운동 기록</b>에서 부위별 세트수를 남기면 여기에 분석이 떠요.
          </div>
        ) : (
          <>
            <div style={{ display:"flex", gap:6, marginTop:12 }}>
              {groupVol.filter(g=>g.sets>0).map((g)=>(
                <div key={g.key} style={{ flex:1, minWidth:0, background:C.surface2, borderRadius:10, padding:"9px 8px", textAlign:"center" }}>
                  <div style={{ fontSize:10.5, color:C.muted, fontWeight:600 }}>{g.key}</div>
                  <div style={{ fontSize:17, fontWeight:800, color:g.color, marginTop:2 }}>{g.sets}</div>
                  <div style={{ height:4, background:C.line, borderRadius:99, marginTop:6, overflow:"hidden" }}>
                    <div style={{ width:`${Math.round(g.sets/maxGroup*100)}%`, height:"100%", background:g.color, borderRadius:99 }} />
                  </div>
                </div>
              ))}
            </div>
            {balanceWarn && (
              <div style={{ marginTop:9, padding:"9px 12px", background:tint(C.amber,0.1), border:`1px solid ${tint(C.amber,0.35)}`, borderRadius:10 }}>
                <span style={{ fontSize:11.5, color:C.amber, fontWeight:700 }}>⚖️ {balanceWarn}</span>
              </div>
            )}
            <div style={{ height:1, background:C.line, margin:"14px 0 2px" }} />
            <div style={{ marginTop:12 }}>
              {volumeEntries.filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([p,v])=>(
                <div key={p} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:12, fontWeight:700, width:58, flexShrink:0 }}>{p}</span>
                  <div style={{ flex:1, height:16, background:C.surface2, borderRadius:99, overflow:"hidden" }}>
                    <div style={{ width:`${Math.round(v/maxVol*100)}%`, height:"100%", borderRadius:99,
                      background:`linear-gradient(90deg, ${tint(TYPES.push.color,0.55)}, ${TYPES.push.color})`, transition:"width .3s" }} />
                  </div>
                  <span style={{ fontSize:12, fontWeight:800, color:TYPES.push.color, width:48, textAlign:"right", flexShrink:0 }}>{v}세트</span>
                </div>
              ))}
            </div>
            {missedParts.length>0 && (
              <div style={{ marginTop:10, padding:"9px 12px", background:tint(C.amber,0.1), border:`1px solid ${tint(C.amber,0.35)}`, borderRadius:10 }}>
                <span style={{ fontSize:11.5, color:C.amber, fontWeight:700 }}>⚠️ {rangeLabel(range)} 안 한 부위: {missedParts.join(" · ")}</span>
              </div>
            )}
          </>
        )}
      </Card>

      {/* 유산소 */}
      <Card>
        <Row><span style={lbl}>유산소 · {rangeLabel(range)}</span>
          {cardioSessions>0 && <span style={{ fontSize:11.5, color:C.muted }}>{cardioSessions}회 · {fmtMin(cardioMinTotal)}</span>}
        </Row>
        {cardioSessions===0 ? (
          <div style={{ color:C.muted, fontSize:12.5, marginTop:10, lineHeight:1.6 }}>
            아직 유산소 기록이 없어요. 캘린더에서 날짜를 열고 <b style={{color:C.text}}>유산소</b>에 종류·시간을 남기면 여기에 분석이 떠요.
          </div>
        ) : (
          <>
            <div style={{ display:"flex", gap:6, marginTop:12 }}>
              {[["총 시간", fmtMin(cardioMinTotal), C.amber],
                ["소모 kcal", cardioKcalTotal>0?`${cardioKcalTotal}`:"—", "#FF8C42"],
                ["회당 평균", `${cardioAvgMin}분`, "#5AD1A0"]].map(([label,val,col])=>(
                <div key={label} style={{ flex:1, minWidth:0, background:C.surface2, borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                  <div style={{ fontSize:10.5, color:C.muted, fontWeight:600 }}>{label}</div>
                  <div style={{ fontSize:17, fontWeight:800, color:col, marginTop:3 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* 일별 시간 그래프 */}
            {range!=="day" && (<>
              <div style={{ fontSize:11, color:C.muted, margin:"16px 0 6px" }}>일별 유산소 시간</div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:80 }}>
                {perDay.map((d,i)=>(
                  <div key={d.dk} style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
                      <div title={`${d.cardioMin}분`} style={{ width:"100%", height:`${d.cardioMin>0?Math.max(6,Math.round(d.cardioMin/cardioMaxDay*100)):0}%`,
                        background: d.cardioType?CARDIO[d.cardioType].color:C.line, borderRadius:"4px 4px 2px 2px", transition:"height .3s" }} />
                    </div>
                    {range==="week" && <span style={{ fontSize:8.5, color:C.muted, whiteSpace:"nowrap" }}>{d.dk.slice(8)}</span>}
                  </div>
                ))}
              </div>
            </>)}

            {/* 종류별 */}
            <div style={{ fontSize:11, color:C.muted, margin:"16px 0 8px" }}>종류별</div>
            {cardioByType.map((t)=>(
              <div key={t.k} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <span style={{ fontSize:11.5, fontWeight:700, width:66, flexShrink:0, color:t.color }}>{t.label}</span>
                <div style={{ flex:1, height:14, background:C.surface2, borderRadius:99, overflow:"hidden" }}>
                  <div style={{ width:`${Math.round(t.min/maxCardioType*100)}%`, height:"100%", borderRadius:99,
                    background:`linear-gradient(90deg, ${tint(t.color,0.55)}, ${t.color})`, transition:"width .3s" }} />
                </div>
                <span style={{ fontSize:11, fontWeight:800, color:t.color, width:70, textAlign:"right", flexShrink:0 }}>
                  {fmtMin(t.min)} · {t.sessions}회
                </span>
              </div>
            ))}

            {/* 주당 페이스 */}
            {range!=="day" && (
              <div style={{ marginTop:12, padding:"10px 12px", borderRadius:10,
                background: cardioPerWeek>=150?tint(TYPES.legs.color,0.1):C.surface2,
                border:`1px solid ${cardioPerWeek>=150?tint(TYPES.legs.color,0.4):C.line}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:11.5, fontWeight:700, color: cardioPerWeek>=150?TYPES.legs.color:C.text }}>
                    주당 {cardioPerWeek}분 페이스
                  </span>
                  <span style={{ fontSize:10.5, color:C.muted }}>권장 150분</span>
                </div>
                <div style={{ height:6, background:C.line, borderRadius:99, overflow:"hidden" }}>
                  <div style={{ width:`${Math.min(100,Math.round(cardioPerWeek/150*100))}%`, height:"100%", borderRadius:99,
                    background: cardioPerWeek>=150?TYPES.legs.color:C.amber }} />
                </div>
                <div style={{ fontSize:10.5, color:C.muted, marginTop:6, lineHeight:1.5 }}>
                  {cardioPerWeek>=150 ? "유산소 권장량을 채우고 있어요 👍"
                    : `권장까지 주 ${150-cardioPerWeek}분 더 — 벌크 중이면 이 정도가 심폐·체지방 관리에 적당해요`}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* 지표별 카드 */}
      {rows.map((r)=>{
        const open = expanded===r.key && range!=="day";
        return (
        <div key={r.key} onClick={()=> range!=="day" && setExpanded(open?null:r.key)}
          style={{ background:C.surface, border:`1px solid ${open?tint(r.color||"#fff",0.5):C.line}`, borderRadius:14, padding:"13px 14px", marginTop:8,
          cursor: range!=="day"?"pointer":"default", transition:"border-color .25s", boxShadow:"0 2px 10px rgba(0,0,0,0.18)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:4, alignSelf:"stretch", borderRadius:99, background:S[r.stat.s] }} />
            <span style={{ fontSize:20 }}>{r.icon}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13.5, fontWeight:800 }}>{r.label}</div>
              <div style={{ fontSize:11.5, color: r.stat.s==="none"?C.muted:S[r.stat.s], marginTop:2, fontWeight:600 }}>{r.stat.msg}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontSize:18, fontWeight:800, color: r.stat.s==="none"?C.muted:C.text }}>{r.value}</div>
              <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{r.sub}</div>
            </div>
            {range!=="day" && <span style={{ fontSize:11, color:C.muted, transform:open?"rotate(180deg)":"none", transition:"transform .25s" }}>▾</span>}
          </div>
          {open && (
            <div className="fade-up">
              <TrendBars values={r.series} labels={dayLabels} color={r.color||TYPES.push.color} goal={r.goal} goalType={r.goalType} unit={r.unit} />
            </div>
          )}
        </div>
        );
      })}

      <div style={{ fontSize:10.5, color:C.muted, textAlign:"center", margin:"16px 0 4px", lineHeight:1.5 }}>
        {range!=="day" && <>카드를 탭하면 일별 추이 그래프가 펼쳐져요.<br/></>}
        평균은 식단·수면 등 기록이 있는 날 기준이에요.<br/>
        <span style={{ color:S.good }}>초록</span> 달성 · <span style={{ color:S.warn }}>노랑</span> 주의 · <span style={{ color:S.bad }}>빨강</span> 부족
      </div>
    </div>
  );
}

// 기간 추이 막대 그래프 (목표선/상한선 표시 지원)
function TrendBars({ values, labels, color, goal, goalType, unit }) {
  const max = Math.max(1, ...values, goal||0);
  const goalPct = goal!=null ? Math.min(100, goal/max*100) : null;
  const many = values.length > 10; // 월간이면 라벨 간소화
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ position:"relative", display:"flex", alignItems:"flex-end", gap:many?1.5:3, height:64 }}>
        {goalPct!=null && (
          <div style={{ position:"absolute", left:0, right:0, bottom:`${goalPct}%`, borderTop:`1.5px dashed ${goalType==="cap"?C.danger:tint(color,0.7)}`, zIndex:1 }} />
        )}
        {values.map((v,i)=>{
          const met = goal==null ? v>0 : (goalType==="cap" ? v<=goal : v>=goal);
          const h = Math.max(v>0?4:0, Math.round(v/max*100));
          return (
            <div key={i} style={{ flex:1, height:"100%", display:"flex", alignItems:"flex-end" }}>
              <div className="grow-bar" style={{ width:"100%", height:`${h}%`, borderRadius:many?2:4,
                background: v===0 ? C.surface2 : met ? color : tint(color,0.35),
                minHeight: v>0?4:2 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:many?1.5:3, marginTop:4 }}>
        {values.map((_,i)=>(
          <div key={i} style={{ flex:1, textAlign:"center", fontSize:8.5, color:C.muted }}>
            {many ? (i%5===0 ? labels[i] : "") : labels[i]}
          </div>
        ))}
      </div>
      {goal!=null && (
        <div style={{ fontSize:10, color:C.muted, marginTop:6 }}>
          점선 = {goalType==="cap"?"상한":"목표"} {goal}{unit||""} · 진한 막대 = 달성일
        </div>
      )}
    </div>
  );
}

// 원형 점수 링 (SVG)
function ScoreRing({ pct, color }) {
  const r = 30, c = 2*Math.PI*r, off = c*(1-pct/100);
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" style={{ flexShrink:0 }}>
      <circle cx="38" cy="38" r={r} fill="none" stroke={C.surface2} strokeWidth="7" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 38 38)" style={{ transition:"stroke-dashoffset .5s" }} />
      <text x="38" y="38" textAnchor="middle" dominantBaseline="central" fill={color} fontSize="19" fontWeight="800">{pct}</text>
      <text x="38" y="53" textAnchor="middle" fill={C.muted} fontSize="8">점</text>
    </svg>
  );
}

// ================= 탭바 =================
function TabBar({ tab, setTab }) {
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
const Card = ({children}) => <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:16, padding:"15px 16px", marginTop:12, boxShadow:"0 2px 10px rgba(0,0,0,0.18)" }}>{children}</div>;

// 유리질감 카드
const GlassCard = ({children, glow}) => (
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
function useCountUp(target, dur=650) {
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
const CountUp = ({value, decimals=0, suffix=""}) => {
  const v = useCountUp(num(value));
  return <>{v.toFixed(decimals)}{suffix}</>;
};

// 컨페티
function Confetti({ fire }) {
  const [parts, setParts] = useState([]);
  useEffect(()=>{
    if (!fire) return;
    const colors = ["#FF6B3D","#35C4D8","#7DDB8A","#FFC24B","#C9A6FF","#FF8FB0"];
    const arr = [...Array(40)].map((_,i)=>({
      id:i+"-"+fire, left: Math.random()*100, delay: Math.random()*0.25,
      dur: 1.4+Math.random()*0.9, color: colors[i%colors.length],
      size: 6+Math.random()*6, drift:(Math.random()-0.5)*120,
    }));
    setParts(arr);
    const t = setTimeout(()=>setParts([]), 2600);
    return ()=>clearTimeout(t);
  }, [fire]);
  if (!parts.length) return null;
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:200, overflow:"hidden" }}>
      {parts.map((p)=>(
        <div key={p.id} style={{ position:"absolute", top:-20, left:`${p.left}%`, width:p.size, height:p.size*0.6,
          background:p.color, borderRadius:2, animation:`confettiFall ${p.dur}s cubic-bezier(0.3,0.6,0.5,1) ${p.delay}s forwards`,
          "--drift":`${p.drift}px` }} />
      ))}
    </div>
  );
}

// 고급 원형 게이지
function GaugeRing({ pct, color, size=88, stroke=9, label, value }) {
  const animPct = useCountUp(pct, 800);
  const r = (size-stroke)/2, c = 2*Math.PI*r, off = c*(1-Math.min(100,animPct)/100);
  const gid = "grad"+color.replace("#","");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink:0 }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tint(color,0.6)} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.surface2} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ filter:`drop-shadow(0 0 5px ${tint(color,0.5)})` }} />
      <text x={size/2} y={size/2-3} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size*0.24} fontWeight="800">{value!=null?value:Math.round(animPct)}</text>
      {label && <text x={size/2} y={size/2+size*0.18} textAnchor="middle" fill={C.muted} fontSize={size*0.1}>{label}</text>}
    </svg>
  );
}

// 캐릭터 마스코트
function Mascot({ score, proteinPct, workedOut }) {
  const mood = score>=80 ? "great" : score>=50 ? "ok" : score>=1 ? "meh" : "sleep";
  const cfg = {
    great: { body:"#7DDB8A", cheek:"#FF9BB0", msg:"오늘 완벽해요! 🔥" },
    ok:    { body:"#8FD3FF", cheek:"#FFB3C1", msg:"잘 하고 있어요 💪" },
    meh:   { body:"#FFC24B", cheek:"#FFB3C1", msg:"조금만 더 채워봐요" },
    sleep: { body:"#8A8D98", cheek:"transparent", msg:"오늘 기록을 시작해요" },
  }[mood];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:16 }}>
      <div className="mascot-float" style={{ position:"relative", width:74, height:74, flexShrink:0 }}>
        <svg width="74" height="74" viewBox="0 0 74 74">
          <ellipse cx="37" cy="68" rx="20" ry="4" fill="rgba(0,0,0,0.25)" />
          <circle cx="37" cy="36" r="26" fill={cfg.body} style={{ transition:"fill .5s" }} />
          <circle cx="37" cy="36" r="26" fill="url(#mascotShine)" />
          <circle cx="24" cy="42" r="5" fill={cfg.cheek} opacity="0.6" style={{ transition:"fill .5s" }} />
          <circle cx="50" cy="42" r="5" fill={cfg.cheek} opacity="0.6" style={{ transition:"fill .5s" }} />
          {mood==="sleep" ? (
            <>
              <path d="M26 34 q4 3 8 0" stroke="#141519" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M40 34 q4 3 8 0" stroke="#141519" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <text x="53" y="25" fontSize="12" fill="#141519" fontWeight="800">z</text>
            </>
          ) : mood==="great" ? (
            <>
              <path d="M25 34 q5 -6 10 0" stroke="#141519" strokeWidth="2.8" fill="none" strokeLinecap="round" />
              <path d="M39 34 q5 -6 10 0" stroke="#141519" strokeWidth="2.8" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle className="mascot-eye" cx="30" cy="34" r="3.2" fill="#141519" />
              <circle className="mascot-eye" cx="44" cy="34" r="3.2" fill="#141519" />
            </>
          )}
          {mood==="great" && <path d="M28 44 q9 9 18 0" stroke="#141519" strokeWidth="2.8" fill="none" strokeLinecap="round" />}
          {mood==="ok" && <path d="M31 45 q6 5 12 0" stroke="#141519" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
          {mood==="meh" && <path d="M32 46 h10" stroke="#141519" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
          {mood==="sleep" && <circle cx="37" cy="46" r="2" fill="#141519" />}
          <defs>
            <radialGradient id="mascotShine" cx="0.35" cy="0.3" r="0.7">
              <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
              <stop offset="45%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
        </svg>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:15, fontWeight:800, color:cfg.body, transition:"color .5s" }}>{cfg.msg}</div>
        <div style={{ fontSize:11.5, color:C.muted, marginTop:4, lineHeight:1.5 }}>
          {mood==="sleep" ? "단백질·운동·습관을 기록하면 캐릭터가 깨어나요" :
           `오늘 달성도 ${Math.round(score)}%${workedOut?" · 운동 완료 💪":""}`}
        </div>
      </div>
    </div>
  );
}
const Row = ({children}) => <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>{children}</div>;
const MiniCard = ({label,value,unit,color}) => (
  <div style={{ flex:1, minWidth:0, background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, padding:"12px", marginTop:12 }}>
    <div style={{ fontSize:10.5, color:C.muted, fontWeight:600 }}>{label}</div>
    <div style={{ fontSize:20, fontWeight:800, color, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}<span style={{ fontSize:12, color:C.muted, marginLeft:2 }}>{unit}</span></div>
  </div>
);
// 음식 카드의 영양성분 셀 (라벨 위 / 값 아래)
const NutriCell = ({label,value,color,bold}) => (
  <div style={{ minWidth:0, textAlign:"center" }}>
    <div style={{ fontSize:9.5, color:C.muted, fontWeight:600 }}>{label}</div>
    <div style={{ fontSize:13, fontWeight:bold?800:700, color:color||C.text, marginTop:3,
      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</div>
  </div>
);

// 라벨이 위에 붙은 숫자 입력칸
const LabeledInput = ({label,v,on}) => (
  <div style={{ flex:1, minWidth:70 }}>
    <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{label}</div>
    <input value={v} onChange={(e)=>on(e.target.value)} inputMode="decimal" placeholder="0"
      style={{...inp, width:"100%", boxSizing:"border-box"}} />
  </div>
);

const ReportItem = ({label,value,color}) => (  <div style={{ minWidth:0 }}>
    <div style={{ fontSize:10, color:C.muted, fontWeight:600 }}>{label}</div>
    <div style={{ fontSize:15.5, fontWeight:800, color, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</div>
  </div>
);
const Legend = ({color,label,dot}) => <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.muted }}><span style={{ width:9, height:9, borderRadius:dot?"50%":3, background:color }} />{label}</div>;
const SecLabel = ({children}) => <div style={{ fontSize:12, fontWeight:800, color:C.muted, margin:"18px 0 8px" }}>{children}</div>;
const Field = ({label,v,on}) => (
  <div style={{ flex:1, minWidth:0 }}>
    <div style={{ fontSize:10.5, color:C.muted, marginBottom:4 }}>{label}</div>
    <input value={v} onChange={(e)=>on(e.target.value)} inputMode="decimal" style={{...inp, width:"100%", boxSizing:"border-box"}} />
  </div>
);
function ApiKeyInput({ value, onSave }) {
  const [draft, setDraft] = useState(value || "");
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(()=>{ setDraft(value||""); }, [value]);
  const save = () => { onSave(draft.trim()); setSaved(true); setTimeout(()=>setSaved(false), 1500); };
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ display:"flex", gap:6 }}>
        <input value={draft} onChange={(e)=>setDraft(e.target.value)} type={show?"text":"password"}
          placeholder="sk-ant-..." style={{...inp, flex:1, minWidth:0, fontFamily:"monospace", fontSize:12.5}} />
        <button onClick={()=>setShow((s)=>!s)} style={{...stepBtn, width:44}}>{show?"숨김":"보기"}</button>
      </div>
      <button onClick={save} style={{...primary(TYPES.push.color), width:"100%", marginTop:8}}>{saved?"저장됨 ✓":"키 저장"}</button>
    </div>
  );
}
const lbl = { fontSize:13, fontWeight:800, color:C.muted };
const inp = { padding:"11px 12px", background:C.surface2, border:`1px solid ${C.line}`, borderRadius:10, color:C.text, fontSize:14, outline:"none" };
const primary = (color) => ({ padding:"12px", borderRadius:12, cursor:"pointer", border:"none", background:color, color:"#141519", fontSize:13.5, fontWeight:800 });
const ghost = { padding:"12px 18px", borderRadius:12, cursor:"pointer", background:"transparent", border:`1px solid ${C.line}`, color:C.muted, fontSize:13.5, fontWeight:700 };
const navBtn = { width:34, height:34, borderRadius:10, cursor:"pointer", background:C.surface, border:`1px solid ${C.line}`, color:C.text, fontSize:18, fontWeight:700, lineHeight:1 };
const stepBtn = { width:28, height:28, borderRadius:8, cursor:"pointer", background:C.surface, border:`1px solid ${C.line}`, color:C.text, fontSize:16, fontWeight:700, lineHeight:1 };
const xBtn = { width:26, height:26, borderRadius:8, cursor:"pointer", background:C.surface2, border:`1px solid ${C.line}`, color:C.muted, fontSize:15, lineHeight:1, flexShrink:0 };
const chip = (on,color) => ({ padding:"8px 12px", borderRadius:999, cursor:"pointer", fontSize:12.5, fontWeight:700, border:`1.5px solid ${on?color:C.line}`, background:on?tint(color,0.18):C.surface2, color:C.text });
const sheetBg = { position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:50 };
// 모바일 주소창을 감안해 dvh 사용. 헤더/푸터는 고정하고 가운데만 스크롤되도록 flex 컬럼 구성
const sheet = { background:C.surface, width:"100%", maxWidth:460, borderTopLeftRadius:22, borderTopRightRadius:22,
  padding:"14px 18px 0", border:`1px solid ${C.line}`, borderBottom:"none",
  maxHeight:"92dvh", display:"flex", flexDirection:"column", boxSizing:"border-box" };
const grip = { width:38, height:4, borderRadius:2, background:C.line, margin:"0 auto 16px" };
