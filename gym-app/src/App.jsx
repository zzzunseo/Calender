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
const emptyDay = () => ({ type:null, parts:[], cardio:null, foods:[], lifts:[], note:"", sleep:null, water:0, partSets:{}, mainLift:null, creatine:false, mood:null, diary:"", habitLog:{} });

const normalize = (d) => ({
  schedule: d.schedule || {},
  profile: { height:"", age:"", sex:"", activity:1.375, surplus:0, goalWeight:"", goalFat:"", apiKey:"", ...(d.profile||{}) },
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
async function callClaudeAPI(apiKey, prompt) {
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
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
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
const macroTargets = (tdee, surplus, weight, proteinG) => {
  if (!tdee || !weight) return null;
  const cal = tdee + num(surplus);
  const pCal = (proteinG || weight * 2) * 4;
  const fCal = cal * 0.25;
  const cCal = Math.max(0, cal - pCal - fCal);
  return { carb: Math.round(cCal / 4), sugar: Math.round(cal * 0.10 / 4), fat: Math.round(fCal / 9) };
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
        {tab==="today" && <Today data={data} updateDay={updateDay} addFoodsToday={addFoodsToday} target={proteinTarget()} tdee={computeTDEE(data.profile, latestWeight())} weight={latestWeight()} favProps={favProps} apiKey={data.profile.apiKey} customFoods={data.customFoods} />}
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
function Today({ data, updateDay, addFoodsToday, target, tdee, weight, favProps, apiKey, customFoods }) {
  const k = todayKey();
  const day = data.schedule[k] || emptyDay();
  const proteinSum = day.foods.reduce((s,f)=>s+num(f.protein),0);
  const carbsSum = day.foods.reduce((s,f)=>s+num(f.carbs),0);
  const sugarSum = day.foods.reduce((s,f)=>s+num(f.sugar),0);
  const fatSum = day.foods.reduce((s,f)=>s+num(f.fat),0);
  const kcalIn = day.foods.reduce((s,f)=>s+num(f.kcal),0);
  const kcalOut = day.cardio ? num(day.cardio.kcal) : 0;
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
  const workoutDays = days.filter((dk)=> data.schedule[dk]?.type && data.schedule[dk].type!=="rest").length;
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
  const workoutStreak = calcStreak((kk)=>{
    const t2 = data.schedule[kk]?.type;
    return t2 && t2!=="rest";
  });
  const creatineStreak = calcStreak((kk)=> !!data.schedule[kk]?.creatine);

  // 오늘 달성 점수 (마스코트/게이지용): 판정 가능한 항목의 달성 비율
  const scoreParts = [];
  if (target) scoreParts.push(proteinSum >= target.low);
  if (tdee!=null && day.foods.length) scoreParts.push(Math.abs(net-surplus) <= 250);
  scoreParts.push(!!(day.type && day.type!=="rest") || (day.partSets && Object.keys(day.partSets).length>0) || !!day.mainLift?.name);
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
        <Mascot score={dayScore} proteinPct={proteinPct} workedOut={!!(day.type&&day.type!=="rest")} />
      </GlassCard>

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
              섭취 {kcalIn} · 유산소 소모 {kcalOut} · 목표 잉여 {surplus>=0?"+":""}{surplus}
              {" · "}
              <span style={{ color: net>=surplus?TYPES.legs.color:C.amber }}>
                {net>=surplus ? "목표 달성" : `목표까지 ${surplus-net}kcal`}
              </span>
            </div>
          </>
        )}
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
          <MiniCard label="오늘 운동" value={t?(day.type==="custom"&&day.parts.length?day.parts.join("·"):t.label):"미설정"} unit="" color={t?t.color:C.muted} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <MiniCard label="오늘 공부" value={studyToday?fmtMin(studyToday):"0분"} unit="" color={STUDY_ACCENT} />
        </div>
      </div>
      {(day.cardio || day.lifts.length>0 || Object.keys(day.partSets||{}).length>0) && (
        <Card>
          {day.cardio && <div style={{ fontSize:13, color:CARDIO[day.cardio.type].color, fontWeight:700 }}>
            유산소 · {CARDIO[day.cardio.type].label} {day.cardio.min}분 {kcalOut>0?`· ${kcalOut}kcal`:""}</div>}
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
function Calendar({ data, persist, updateDay, favProps, apiKey, customFoods, routines, mutate }) {
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
  const clearMonth = () => { const next={ ...data, schedule:{ ...schedule } };
    const dim=new Date(view.y,view.m+1,0).getDate();
    for(let d=1;d<=dim;d++) delete next.schedule[keyOf(view.y,view.m,d)]; persist(next); };
  const move = (delta) => { let m=view.m+delta,y=view.y; if(m<0){m=11;y--;}else if(m>11){m=0;y++;} setView({y,m}); };

  const firstDow = new Date(view.y,view.m,1).getDay();
  const dim = new Date(view.y,view.m+1,0).getDate();
  const cells=[]; for(let i=0;i<firstDow;i++) cells.push(null); for(let d=1;d<=dim;d++) cells.push(d);
  const isToday = (d)=> d && view.y===today.getFullYear() && view.m===today.getMonth() && d===today.getDate();

  return (
    <div>
      <div style={{ padding:"22px 18px 10px" }}>
        <div style={{ fontSize:11, letterSpacing:3, color:TYPES.push.color, fontWeight:800 }}>5-DAY SPLIT</div>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginTop:6 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
            <span style={{ fontSize:32, fontWeight:800, letterSpacing:-1 }}>{MONTHS[view.m]}</span>
            <span style={{ fontSize:15, color:C.muted, fontWeight:600 }}>{view.y}</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>move(-1)} style={navBtn}>‹</button>
            <button onClick={()=>move(1)} style={navBtn}>›</button>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, padding:"0 18px 12px" }}>
        <button onClick={applyPreset} style={{...primary(TYPES.push.color), flex:1}}>이번 달 5분할 채우기</button>
        <button onClick={clearMonth} style={ghost}>초기화</button>
      </div>
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
              </div>
              {e?.cardio && <span style={{ position:"absolute", top:6, right:6, width:7, height:7, borderRadius:"50%", background:CARDIO[e.cardio.type].color }} />}
              {e?.foods?.length>0 && <span style={{ position:"absolute", bottom:6, right:6, width:6, height:6, borderRadius:"50%", background:TYPES.legs.color }} />}
              {studyDates.has(kk) && <span style={{ position:"absolute", bottom:6, left:6, width:6, height:6, borderRadius:"50%", background:STUDY_ACCENT }} />}
            </button>
          );
        })}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, padding:"16px 18px 0" }}>
        {Object.values(TYPES).map((t,i)=>(<Legend key={i} color={t.color} label={t.label} />))}
        <Legend dot color={C.amber} label="유산소" />
        <Legend dot color={TYPES.legs.color} label="식단" />
        <Legend dot color={STUDY_ACCENT} label="공부" />
      </div>
      {editKey && <DayEditor dateKey={editKey} day={data.schedule[editKey]||emptyDay()} schedule={data.schedule}
        onClose={()=>setEditKey(null)} updateDay={updateDay} favProps={favProps} apiKey={apiKey} customFoods={customFoods} routines={routines} mutate={mutate} habits={data.habits} />}
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
function DayEditor({ dateKey, day, schedule, onClose, updateDay, favProps, apiKey, customFoods, routines, mutate, habits }) {
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
  const clearAll = () => { updateDay(dateKey, emptyDay()); onClose(); };

  return (
    <div onClick={save} style={sheetBg}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={grip} />
        <div style={{ fontSize:15, fontWeight:800, marginBottom:14 }}>{dateKey.replace(/-/g,".")}</div>
        <div style={{ maxHeight:"70vh", overflowY:"auto", paddingRight:2 }}>

          <SecLabel>운동</SecLabel>
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
        </div>
        <div style={{ display:"flex", gap:8, marginTop:16 }}>
          <button onClick={clearAll} style={ghost}>비우기</button>
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
  const [cf, setCf] = useState({ name:"", cat:"기타", protein:"", carbs:"", sugar:"", fat:"", kcal:"", liquidMl:"", fixedLiquid:false });

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
    const entry = makeCustomEntry({ name:cf.name.trim(), cat:cf.cat, protein:num(cf.protein), carbs:num(cf.carbs), sugar:num(cf.sugar), fat:num(cf.fat), kcal:num(cf.kcal), liquidMl:num(cf.liquidMl), fixedLiquid:cf.fixedLiquid });
    mutate((prev)=>({ ...prev, customFoods:[...prev.customFoods.filter(e=>e.key!==entry.key), entry] }));
    setCf({ name:"", cat:"기타", protein:"", carbs:"", sugar:"", fat:"", kcal:"", liquidMl:"", fixedLiquid:false });
    setAddOpen(false);
  };
  const removeCustomFood = (key) => mutate((prev)=>({ ...prev, customFoods:prev.customFoods.filter(e=>e.key!==key) }));
  const [editKey, setEditKey] = useState(null);
  const saveEdit = (orig, patch) => {
    const entry = { ...orig, ...patch, custom:true, cat: patch.cat||orig.cat,
      aliases: Array.from(new Set([patch.key||orig.key, ...(orig.aliases||[])])) };
    if (!(patch.liquidMl>0)) delete entry.liquidMl;
    if (!(patch.liquidMl>0) || !patch.fixedLiquid) delete entry.fixedLiquid; else entry.fixedLiquid = true;
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
        <button onClick={()=>onSave({ key:v.key.trim()||entry.key, protein:num(v.protein), carbs:num(v.carbs), sugar:num(v.sugar), fat:num(v.fat), kcal:num(v.kcal), liquidMl:num(v.liquidMl), fixedLiquid:v.fixedLiquid })}
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
  const study = data.study||[];
  const [subject, setSubject] = useState("토익");
  const [customOn, setCustomOn] = useState(false);
  const [custom, setCustom] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayKey());
  const [score, setScore] = useState({ date:todayKey(), type:"토익", val:"" });
  const [scoreType, setScoreType] = useState("토익");
  const [exam, setExam] = useState({ name:"", date:"" });

  const usedSubjects = Array.from(new Set([...DEFAULT_SUBJECTS, ...study.map((s)=>s.subject)]));
  const finalSubject = customOn?custom.trim():subject;

  const add = () => { if(!finalSubject||minutes<=0) return;
    persist({ ...data, study:[...study, { id:uid(), date, subject:finalSubject, minutes:num(minutes), note:note.trim() }] });
    setNote(""); setMinutes(60); setCustom(""); setCustomOn(false); };
  const rm = (id)=> persist({ ...data, study:study.filter(s=>s.id!==id) });

  const tk = todayKey();
  const todayMin = study.filter(s=>s.date===tk).reduce((a,s)=>a+s.minutes,0);
  const days = last7();
  const weekMin = study.filter(s=>days.includes(s.date)).reduce((a,s)=>a+s.minutes,0);
  const dayTotals = days.map(dk=>study.filter(s=>s.date===dk).reduce((a,s)=>a+s.minutes,0));

  // 주간 목표
  const setGoal = (subj, hours) => mutate((prev)=>({ ...prev, studyGoals:{ ...prev.studyGoals, [subj]: Math.round(num(hours)*60) } }));
  const weekBySubject = (subj)=> study.filter(s=>days.includes(s.date)&&s.subject===subj).reduce((a,s)=>a+s.minutes,0);

  // 점수
  const addScore = () => { if(!score.val) return;
    persist({ ...data, scores:[...data.scores, { id:uid(), date:score.date, type:score.type, score:num(score.val) }] });
    setScore({ date:todayKey(), type:score.type, val:"" }); };
  const rmScore = (id)=> persist({ ...data, scores:data.scores.filter(s=>s.id!==id) });
  const scoreTypes = Array.from(new Set(["토익", ...data.scores.map(s=>s.type)]));
  const scorePts = data.scores.filter(s=>s.type===scoreType).sort((a,b)=>a.date.localeCompare(b.date)).map(s=>({ label:s.date.slice(5).replace("-","."), value:s.score }));

  // D-day
  const addExam = () => { if(!exam.name.trim()||!exam.date) return;
    persist({ ...data, exams:[...data.exams, { id:uid(), name:exam.name.trim(), date:exam.date }] }); setExam({ name:"", date:"" }); };
  const rmExam = (id)=> persist({ ...data, exams:data.exams.filter(e=>e.id!==id) });
  const dday = (dstr)=>{ const [y,m,d]=dstr.split("-").map(Number); const t=new Date(); t.setHours(0,0,0,0); const diff=Math.round((new Date(y,m-1,d)-t)/86400000); return diff; };
  const examsSorted = [...data.exams].sort((a,b)=>a.date.localeCompare(b.date));

  const sortedDesc = [...study].sort((a,b)=>b.date.localeCompare(a.date));
  const QUICK = [30,60,90,120];

  return (
    <div style={{ padding:"22px 18px 8px" }}>
      <div style={{ fontSize:11, letterSpacing:3, color:STUDY_ACCENT, fontWeight:800 }}>STUDY</div>
      <div style={{ fontSize:30, fontWeight:800, letterSpacing:-1, marginTop:4 }}>공부 기록</div>

      <div style={{ display:"flex", gap:10 }}>
        <MiniCard label="오늘 공부" value={fmtMin(todayMin)} unit="" color={STUDY_ACCENT} />
        <MiniCard label="이번 주" value={fmtMin(weekMin)} unit="" color={C.text} />
      </div>

      <Card>
        <Row><span style={lbl}>최근 7일</span></Row>
        <div style={{ marginTop:12 }}><Bars7 values={dayTotals} color={STUDY_ACCENT} hoursLabel /></div>
      </Card>

      {/* D-day */}
      <Card>
        <Row><span style={lbl}>시험 D-day</span></Row>
        {examsSorted.map((e)=>{ const d=dday(e.date);
          return (<div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${C.line}` }}>
            <div><div style={{ fontSize:14, fontWeight:700 }}>{e.name}</div><div style={{ fontSize:12, color:C.muted }}>{e.date.replace(/-/g,".")}</div></div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:16, fontWeight:800, color:d<0?C.muted:d<=7?C.danger:STUDY_ACCENT }}>{d===0?"D-DAY":d>0?`D-${d}`:`D+${-d}`}</span>
              <button onClick={()=>rmExam(e.id)} style={xBtn}>×</button>
            </div>
          </div>); })}
        <div style={{ display:"flex", gap:6, marginTop:10 }}>
          <input value={exam.name} onChange={(e)=>setExam({...exam,name:e.target.value})} placeholder="시험명 (예: 정보처리기사 필기)" style={{...inp, flex:1, minWidth:0}} />
        </div>
        <div style={{ display:"flex", gap:6, marginTop:6 }}>
          <input type="date" value={exam.date} onChange={(e)=>setExam({...exam,date:e.target.value})} style={{...inp, flex:1, minWidth:0, colorScheme:"dark"}} />
          <button onClick={addExam} style={ghost}>추가</button>
        </div>
      </Card>

      {/* 주간 목표 */}
      <Card>
        <Row><span style={lbl}>과목별 주간 목표</span></Row>
        {usedSubjects.map((subj)=>{ const goal=data.studyGoals[subj]||0; const done=weekBySubject(subj); const pct=goal?Math.min(100,Math.round(done/goal*100)):0;
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
        <div style={{ fontSize:11, color:C.muted, margin:"16px 0 6px" }}>시간 · <b style={{ color:STUDY_ACCENT }}>{fmtMin(minutes)}</b></div>
        <div style={{ display:"flex", gap:6 }}>
          {QUICK.map((q)=>(<button key={q} onClick={()=>setMinutes(q)} style={{...chip(minutes===q,STUDY_ACCENT), flex:1, textAlign:"center"}}>{fmtMin(q)}</button>))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:C.surface2, borderRadius:10, padding:"6px 10px", marginTop:8 }}>
          <button onClick={()=>setMinutes(m=>Math.max(0,m-10))} style={stepBtn}>–</button>
          <span style={{ flex:1, textAlign:"center", fontWeight:800 }}>{minutes}분</span>
          <button onClick={()=>setMinutes(m=>m+10)} style={stepBtn}>+</button>
        </div>
        <div style={{ fontSize:11, color:C.muted, margin:"16px 0 6px" }}>뭘 공부했는지</div>
        <input value={note} onChange={(e)=>setNote(e.target.value)} placeholder="예: LC Part 3, 기출 2회분" style={{...inp, width:"100%", boxSizing:"border-box"}} />
        <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} style={{...inp, width:"100%", boxSizing:"border-box", marginTop:8, colorScheme:"dark"}} />
        <button onClick={add} style={{...primary(STUDY_ACCENT), width:"100%", marginTop:10}}>기록 저장</button>
      </Card>

      {/* 점수 추이 */}
      <Card>
        <Row><span style={lbl}>시험 점수 추이</span></Row>
        <div style={{ display:"flex", gap:7, marginTop:10, flexWrap:"wrap" }}>
          {scoreTypes.map((tp)=>(<button key={tp} onClick={()=>setScoreType(tp)} style={chip(scoreType===tp,STUDY_ACCENT)}>{tp}</button>))}
        </div>
        <LineChart points={scorePts} color={STUDY_ACCENT} empty="점수를 2회 이상 기록하면 그래프가 나와요." />
        <div style={{ display:"flex", gap:6, marginTop:10 }}>
          <input value={score.type} onChange={(e)=>setScore({...score,type:e.target.value})} placeholder="시험명" style={{...inp, flex:1, minWidth:0}} />
          <input value={score.val} onChange={(e)=>setScore({...score,val:e.target.value})} placeholder="점수" inputMode="numeric" style={{...inp, width:70, minWidth:0}} />
        </div>
        <div style={{ display:"flex", gap:6, marginTop:6 }}>
          <input type="date" value={score.date} onChange={(e)=>setScore({...score,date:e.target.value})} style={{...inp, flex:1, minWidth:0, colorScheme:"dark"}} />
          <button onClick={addScore} style={ghost}>추가</button>
        </div>
        {data.scores.length>0 && (
          <div style={{ marginTop:10 }}>
            {[...data.scores].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map((s)=>(
              <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${C.line}`, fontSize:13 }}>
                <span style={{ color:C.muted }}>{s.date.replace(/-/g,".")} · {s.type}</span>
                <span style={{ display:"flex", alignItems:"center", gap:8 }}><b>{s.score}</b><button onClick={()=>rmScore(s.id)} style={xBtn}>×</button></span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 이력 */}
      {sortedDesc.length>0 && (
        <Card>
          <Row><span style={lbl}>공부 이력</span></Row>
          {sortedDesc.map((s)=>(
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.line}` }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <span style={{ width:8, height:8, borderRadius:3, background:colorForSubject(s.subject) }} />
                  <span style={{ fontSize:14, fontWeight:700 }}>{s.subject}</span>
                  <span style={{ fontSize:12, color:STUDY_ACCENT, fontWeight:700 }}>{fmtMin(s.minutes)}</span>
                </div>
                <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>{s.date.replace(/-/g,".")}{s.note?` · ${s.note}`:""}</div>
              </div>
              <button onClick={()=>rm(s.id)} style={xBtn}>×</button>
            </div>
          ))}
        </Card>
      )}
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
    const kcalOut = e.cardio ? num(e.cardio.kcal) : 0;
    const net = tdee!=null ? kcalIn - tdee - kcalOut : null;
    const studyMin = (data.study||[]).filter((s)=>s.date===dk).reduce((a,s)=>a+s.minutes,0);
    const sleep = num(e.sleep?.hours);
    const water = num(e.water);
    const hasFood = foods.length>0;
    const worked = e.type && e.type!=="rest";
    const partSets = e.partSets || {};
    const mood = num(e.mood);
    return { dk, protein, carbs, sugar, fat, kcalIn, kcalOut, net, studyMin, sleep, water, hasFood, worked, partSets, mood };
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
      const kcalOut = e.cardio ? num(e.cardio.kcal) : 0;
      return {
        protein: foods.reduce((s,f)=>s+num(f.protein),0),
        net: tdee!=null ? kcalIn - tdee - kcalOut : null,
        studyMin: (data.study||[]).filter((s)=>s.date===dk).reduce((a,s)=>a+s.minutes,0),
        sleep: num(e.sleep?.hours), water: num(e.water),
        hasFood: foods.length>0, worked: !!(e.type && e.type!=="rest"),
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
  const hasLog = (e)=> !!(e && ((e.foods&&e.foods.length)||(e.type&&e.type!=="rest")||e.sleep||e.water||(e.partSets&&Object.keys(e.partSets).length)||e.mainLift||e.creatine||e.mood||e.diary));
  const streaks = [
    { key:"기록", icon:"📝", color:TYPES.push.color, ...streakInfo(data.schedule, (kk)=>hasLog(data.schedule[kk])) },
    { key:"단백질 목표", icon:"🥩", color:TYPES.legs.color, ...(target ? streakInfo(data.schedule, (kk)=>(data.schedule[kk]?.foods||[]).reduce((s,f)=>s+num(f.protein),0) >= target.low) : {current:0,best:0}) },
    { key:"운동", icon:"💪", color:TYPES.pull.color, ...streakInfo(data.schedule, (kk)=>{ const t2=data.schedule[kk]?.type; return t2 && t2!=="rest"; }) },
    { key:"크레아틴", icon:"💊", color:"#C9A6FF", ...streakInfo(data.schedule, (kk)=>!!data.schedule[kk]?.creatine) },
  ];
  const anyStreak = streaks.some(s=>s.best>0);

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
const sheet = { background:C.surface, width:"100%", maxWidth:460, borderTopLeftRadius:22, borderTopRightRadius:22, padding:"18px 18px 26px", border:`1px solid ${C.line}`, borderBottom:"none" };
const grip = { width:38, height:4, borderRadius:2, background:C.line, margin:"0 auto 16px" };
