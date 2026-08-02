import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { C, todayKey, uid, extraWater, num, emptyDay, normalize, computeTDEE, UndoToast, QuickAdd, SaveBadge, TabBar } from "./shared.jsx";

// 탭 화면은 실제로 들어갈 때만 불러온다(코드 분할).
// 덕분에 첫 로딩이 가벼워지고, 안 쓰는 탭 코드는 내려받지 않는다.
const Today = lazy(() => import("./tabs/Today.jsx"));
const Calendar = lazy(() => import("./tabs/Calendar.jsx"));
const Foods = lazy(() => import("./tabs/Foods.jsx"));
const Study = lazy(() => import("./tabs/Study.jsx"));
const Stats = lazy(() => import("./tabs/Stats.jsx"));
const Body = lazy(() => import("./tabs/Body.jsx"));

// 탭을 불러오는 잠깐 동안 보여줄 자리표시
function TabFallback() {
  return (
    <div style={{ padding:"48px 18px", textAlign:"center", color:C.muted, fontSize:12.5 }}>
      불러오는 중…
    </div>
  );
}

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
    // 저장은 이 휴대폰 안(localStorage)에 하므로 인터넷과 무관하다.
    // 예전엔 오프라인이면 저장을 건너뛰었는데, 그 사이 기록이 메모리에만 남아 사라질 수 있었다 → 항상 저장한다.
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

  // 삭제 되돌리기 — persist/mutate에 두 번째 인자로 라벨을 넘기면 직전 상태를 잠시 보관한다.
  // (새 prop을 안 만들어도 되므로 기존 화면들에 그대로 적용 가능)
  const dataRef = useRef(data);
  useEffect(()=>{ dataRef.current = data; }, [data]);
  const [undoState, setUndoState] = useState(null);
  const undoTimer = useRef(null);
  const armUndo = (label) => {
    setUndoState({ label, snapshot: dataRef.current });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(()=>setUndoState(null), 9000);
  };
  const runUndo = () => {
    if (!undoState) return;
    setData(undoState.snapshot); save(undoState.snapshot);
    setUndoState(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  };

  const persist = useCallback((next, undoLabel) => {
    if (undoLabel) armUndo(undoLabel);
    setData(next); save(next);
  }, []);
  const mutate = useCallback((fn, undoLabel) => {
    if (undoLabel) armUndo(undoLabel);
    setData((prev)=>{ const next = fn(prev); save(next); return next; });
  }, []);

  const updateDay = useCallback((dateKey, patch, undoLabel) => {
    mutate((prev)=>{
      const cur = prev.schedule[dateKey] || emptyDay();
      const nd = { ...cur, ...patch };
      // 하나라도 기록이 있으면 남긴다. 여기서 빠진 항목은 "빈 날"로 간주돼 통째로 지워지므로 반드시 전부 포함해야 한다.
      const clean = nd.type || nd.cardio || (nd.foods&&nd.foods.length) || (nd.lifts&&nd.lifts.length)
        || nd.note || nd.sleep || nd.water || (nd.partSets&&Object.keys(nd.partSets).length)
        || nd.mainLift || nd.creatine || nd.mood || nd.diary || num(nd.steps) > 0
        || (nd.habitLog&&Object.keys(nd.habitLog).length);
      const schedule = { ...prev.schedule };
      if (clean) schedule[dateKey]=nd; else delete schedule[dateKey];
      return { ...prev, schedule };
    }, undoLabel);
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
        {/* 탭 코드를 불러오는 동안 자리표시를 보여준다 */}
        <Suspense fallback={<TabFallback />}>
          {tab==="today" && <Today data={data} updateDay={updateDay} addFoodsToday={addFoodsToday} target={proteinTarget()} tdee={computeTDEE(data.profile, latestWeight())} weight={latestWeight()} favProps={favProps} apiKey={data.profile.apiKey} customFoods={data.customFoods} mutate={mutate} goToTab={setTab} />}
          {tab==="calendar" && <Calendar data={data} persist={persist} updateDay={updateDay} favProps={favProps} apiKey={data.profile.apiKey} customFoods={data.customFoods} routines={data.routines} mutate={mutate} />}
          {tab==="foods" && <Foods addFoodsToday={addFoodsToday} apiKey={data.profile.apiKey} customFoods={data.customFoods} mutate={mutate} schedule={data.schedule} favorites={data.favorites} mealSets={data.mealSets} target={proteinTarget()} tdee={computeTDEE(data.profile, latestWeight())} surplus={num(data.profile.surplus)} addFavorite={addFavorite} removeFavorite={removeFavorite} />}
          {tab==="study" && <Study data={data} persist={persist} mutate={mutate} />}
          {tab==="stats" && <Stats data={data} target={proteinTarget()} tdee={computeTDEE(data.profile, latestWeight())} weight={latestWeight()} mutate={mutate} />}
          {tab==="body" && <Body data={data} persist={persist} mutate={mutate} target={proteinTarget()} latestWeight={latestWeight()} tdee={computeTDEE(data.profile, latestWeight())} />}
        </Suspense>
      </div>
      <SaveBadge status={saveStatus} onRetry={flushWrite} />
      <UndoToast state={undoState} onUndo={runUndo} onClose={()=>setUndoState(null)} />
      <QuickAdd day={data.schedule[todayKey()] || emptyDay()} updateToday={(patch)=>updateDay(todayKey(), patch)}
        weight={latestWeight()} onGoToday={()=>setTab("today")}
        onAddVocab={({term, meaning})=>mutate((prev)=>{
          const exists = (prev.vocab||[]).some(v=>String(v.term).trim().toLowerCase()===term.toLowerCase());
          if (exists) return prev;
          return { ...prev, vocab:[...(prev.vocab||[]), { id:uid(), type:"word", term, meaning,
            note:"", tag:"", pos:"", level:0, reviewCount:0, wrong:0, starred:false, lastReview:null, created:todayKey() }] };
        })} />
      <TabBar tab={tab} setTab={setTab} />
    </div>
  );
}

// 삭제 되돌리기 알림 — 실수로 지웠을 때 바로 복구
