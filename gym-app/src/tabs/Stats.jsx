import { useState } from "react";
import { TYPES, PARTS, CARDIO, isMastered, isOftenWrong, STUDY_ACCENT, SLEEP_ACCENT, MOODS, C, keyOf, todayKey, tint, num, fmtMin, lastNDays, didWorkout, burnedKcal, rd1, macroTargets, LineChart, Card, GlassCard, useCountUp, Row, lbl, chip, cardioInfo } from "../shared.jsx";

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

const est1RM = (w, r) => {
  const W = num(w), R = num(r);
  if (W<=0 || R<=0) return null;
  if (R === 1) return rd1(W);
  return rd1(W * (1 + R/30));
};
// 종목별 기록 모음 — 최고 중량·최고 1RM·최근값·PR 날짜

const liftStats = (schedule) => {
  const byName = {};
  for (const kk of Object.keys(schedule||{})) {
    const ml = schedule[kk]?.mainLift;
    if (!ml || !ml.name || num(ml.w) <= 0) continue;
    const name = String(ml.name).trim();
    const w = num(ml.w), r = num(ml.r) || 1;
    const e1 = est1RM(w, r);
    byName[name] = byName[name] || { name, sessions: [] };
    byName[name].sessions.push({ date: kk, w, r, e1 });
  }
  const t = new Date(); t.setHours(0,0,0,0);
  return Object.values(byName).map((g)=>{
    g.sessions.sort((a,b)=> a.date.localeCompare(b.date));
    const last = g.sessions[g.sessions.length-1];
    const bestW  = g.sessions.reduce((m,x)=> x.w  > m.w  ? x : m, g.sessions[0]);
    const best1  = g.sessions.reduce((m,x)=> (x.e1||0) > (m.e1||0) ? x : m, g.sessions[0]);
    const first = g.sessions[0];
    const daysAgo = Math.round((t - new Date(last.date+"T00:00:00"))/86400000);
    // 최고 중량이 갱신된 순간만 뽑아 성장 이력을 만든다
    const prs = [];
    let peak = 0;
    for (const x of g.sessions) {
      if (x.w > peak) { prs.push({ date:x.date, w:x.w, r:x.r, e1:x.e1, gain: peak>0 ? rd1(x.w-peak) : null }); peak = x.w; }
    }
    return {
      name: g.name, count: g.sessions.length, sessions: g.sessions, prs,
      last, bestW, best1, first, daysAgo,
      gain: rd1(last.w - first.w),                  // 처음 대비 중량 변화
      isPR: last.w >= bestW.w && g.sessions.length >= 2,  // 최근이 최고 중량인가
    };
  }).sort((a,b)=> a.daysAgo - b.daysAgo || b.count - a.count);
};

function LiftProgressCard({ schedule }) {
  const stats = liftStats(schedule);
  const [pick, setPick] = useState(null);
  if (stats.length === 0) {
    return (
      <Card>
        <Row><span style={lbl}>중량 성장</span></Row>
        <div style={{ fontSize:12.5, color:C.muted, marginTop:10, lineHeight:1.7 }}>
          오늘 탭 <b style={{color:C.text}}>퀵 운동 기록</b>의 "오늘의 대표운동"에 종목·무게·횟수를 남기면
          여기서 <b style={{color:C.text}}>중량 추이와 최고 기록</b>을 볼 수 있어요.
          <div style={{ fontSize:11, marginTop:6 }}>체중이 늘 때 근육이 늘고 있는지 판단하는 가장 확실한 근거예요.</div>
        </div>
      </Card>
    );
  }
  const sel = stats.find(x=>x.name===pick) || stats[0];
  const hist = sel.sessions.slice(-10).map(x=>({ label:x.date.slice(5).replace("-","."), value:x.w }));
  const prs = stats.filter(x=>x.isPR && x.daysAgo<=14);

  return (
    <Card>
      <Row><span style={lbl}>중량 성장</span>
        <span style={{ fontSize:11, color:C.muted }}>{stats.length}개 종목</span>
      </Row>

      {/* 최근 최고 기록 갱신 */}
      {prs.length>0 && (
        <div style={{ marginTop:11, padding:"11px 12px", borderRadius:10,
          background:tint(TYPES.legs.color,0.1), border:`1px solid ${tint(TYPES.legs.color,0.4)}` }}>
          <div style={{ fontSize:12, fontWeight:800, color:TYPES.legs.color }}>🏆 최근 최고 기록</div>
          <div style={{ fontSize:11.5, color:C.muted, marginTop:4, lineHeight:1.6 }}>
            {prs.slice(0,3).map(x=>`${x.name} ${x.bestW.w}kg`).join(" · ")}
            {prs.length>3?` 외 ${prs.length-3}개`:""}
          </div>
        </div>
      )}

      {/* 종목 선택 */}
      {stats.length>1 && (
        <div style={{ display:"flex", gap:5, marginTop:11, overflowX:"auto" }}>
          {stats.map((x)=>(
            <button key={x.name} onClick={()=>setPick(x.name)}
              style={{...chip(sel.name===x.name, TYPES.push.color), padding:"5px 11px", fontSize:11.5, whiteSpace:"nowrap", flexShrink:0}}>
              {x.name}
            </button>
          ))}
        </div>
      )}

      {/* 선택 종목 요약 */}
      <div style={{ display:"flex", gap:6, marginTop:12 }}>
        {[["최근", `${sel.last.w}`, `kg×${sel.last.r||1}`, C.text],
          ["최고 중량", `${sel.bestW.w}`, "kg", TYPES.push.color],
          ["추정 1RM", sel.best1.e1!=null?`${sel.best1.e1}`:"—", "kg", TYPES.pull.color]].map(([label,v,unit,col])=>(
          <div key={label} style={{ flex:1, minWidth:0, background:C.surface2, borderRadius:10, padding:"9px 6px", textAlign:"center" }}>
            <div style={{ fontSize:9.5, color:C.muted, fontWeight:600 }}>{label}</div>
            <div style={{ fontSize:16, fontWeight:800, color:col, marginTop:2 }}>{v}<span style={{ fontSize:9, color:C.muted }}>{unit}</span></div>
          </div>
        ))}
      </div>

      {sel.count>=2 && (
        <div style={{ fontSize:11, color:C.muted, marginTop:8, lineHeight:1.55 }}>
          처음 기록({sel.first.date.slice(5).replace("-",".")} {sel.first.w}kg) 대비{" "}
          <b style={{ color: sel.gain>0?TYPES.legs.color : sel.gain<0?C.danger:C.muted }}>
            {sel.gain>0?"+":""}{sel.gain}kg
          </b>
          {" · "}{sel.count}회 기록 · 마지막 {sel.daysAgo===0?"오늘":`${sel.daysAgo}일 전`}
        </div>
      )}

      {hist.length>=2 ? (
        <div style={{ marginTop:10 }}>
          <LineChart points={hist} color={TYPES.push.color} unit="kg" />
        </div>
      ) : (
        <div style={{ fontSize:11.5, color:C.muted, marginTop:10 }}>
          같은 종목을 2회 이상 기록하면 추이 그래프가 나와요.
        </div>
      )}

      {/* 최고 기록 갱신 이력 (7번) */}
      {sel.prs.length>1 && (
        <div style={{ marginTop:14 }}>
          <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>
            최고 기록 갱신 {sel.prs.length}회
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {[...sel.prs].reverse().slice(0,6).map((pr,i,arr)=>{
              const newest = i===0;
              return (
                <div key={pr.date} style={{ display:"flex", alignItems:"center", gap:9 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", flexShrink:0,
                    background: newest?TYPES.push.color:C.line }} />
                  <span style={{ fontSize:10.5, color:C.muted, width:48, flexShrink:0 }}>
                    {pr.date.slice(2).replace(/-/g,".")}
                  </span>
                  <span style={{ fontSize:12.5, fontWeight:800, color: newest?TYPES.push.color:C.text }}>
                    {pr.w}kg<span style={{ fontSize:9.5, color:C.muted, fontWeight:600 }}>×{pr.r}</span>
                  </span>
                  {pr.gain!=null && (
                    <span style={{ fontSize:10.5, fontWeight:800, color:TYPES.legs.color }}>+{pr.gain}kg</span>
                  )}
                  {newest && <span style={{ fontSize:9.5, color:TYPES.push.color, fontWeight:800, marginLeft:"auto" }}>최고</span>}
                </div>
              );
            })}
          </div>
          {sel.prs.length>1 && (
            <div style={{ fontSize:10.5, color:C.muted, marginTop:8, lineHeight:1.5 }}>
              {sel.prs[0].date.slice(5).replace("-",".")} {sel.prs[0].w}kg에서 시작해
              <b style={{ color:TYPES.legs.color }}> +{rd1(sel.bestW.w - sel.prs[0].w)}kg</b> 늘었어요.
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize:10, color:C.muted, marginTop:10, lineHeight:1.5, opacity:0.8 }}>
        추정 1RM은 Epley 공식(무게×(1+횟수÷30))이에요. 8회 이하에서 비교적 정확해요.
      </div>
    </Card>
  );
}

// ================= 체성분 분석 =================
// 체중만 보면 근육이 늘었는지 알 수 없어서, 체지방률과 함께 분해해 방향을 제시한다.

export default function Stats({ data, target, tdee, weight }) {
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
    return { k, ...cardioInfo(k), sessions:ds.length, min:ds.reduce((s,d)=>s+d.cardioMin,0), kcal:ds.reduce((s,d)=>s+d.kcalOut,0) };
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

      {/* 단어장 진도 — 공부 탭에만 있으면 성과가 안 보여서 (13번) */}
      {(data.vocab||[]).length>0 && (()=>{
        const v = data.vocab;
        const mastered = v.filter(isMastered).length;
        const pct = Math.round(mastered/v.length*100);
        const starred = v.filter(x=>x.starred).length;
        const wrongN = v.filter(isOftenWrong).length;
        const reviewedToday = v.filter(x=>x.lastReview===todayKey()).length;
        // 기간 안에 복습한 단어 수
        const reviewedInRange = v.filter(x=>x.lastReview && days.includes(x.lastReview)).length;
        return (
          <Card>
            <Row><span style={lbl}>단어장 진도</span>
              <span style={{ fontSize:11.5, color:C.muted }}>{v.length}개 등록</span>
            </Row>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:12 }}>
              <span style={{ fontSize:30, fontWeight:800, color:STUDY_ACCENT, letterSpacing:-1 }}>{mastered}</span>
              <span style={{ fontSize:13, color:C.muted }}>개 외움 ({pct}%)</span>
            </div>
            <div style={{ height:8, background:C.surface2, borderRadius:99, overflow:"hidden", marginTop:9 }}>
              <div style={{ width:`${pct}%`, height:"100%", borderRadius:99,
                background:`linear-gradient(90deg, ${tint(STUDY_ACCENT,0.5)}, ${STUDY_ACCENT})` }} />
            </div>
            <div style={{ display:"flex", gap:6, marginTop:11 }}>
              {[["기간 내 복습", `${reviewedInRange}개`, STUDY_ACCENT],
                ["오늘 복습", `${reviewedToday}개`, reviewedToday>0?TYPES.legs.color:C.muted],
                ["⭐ 별표", `${starred}개`, "#FFD24B"],
                ["자주 틀림", `${wrongN}개`, wrongN>0?C.danger:C.muted]].map(([label,val,col])=>(
                <div key={label} style={{ flex:1, minWidth:0, background:C.surface2, borderRadius:10, padding:"9px 5px", textAlign:"center" }}>
                  <div style={{ fontSize:9, color:C.muted, fontWeight:600 }}>{label}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:col, marginTop:2 }}>{val}</div>
                </div>
              ))}
            </div>
            {reviewedInRange===0 && (
              <div style={{ fontSize:11, color:C.amber, marginTop:9, fontWeight:600 }}>
                {rangeLabel(range)} 동안 복습한 단어가 없어요. 공부 탭에서 퀴즈를 풀어보세요.
              </div>
            )}
          </Card>
        );
      })()}

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

      {/* 중량 성장 */}
      <LiftProgressCard schedule={data.schedule} />

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
                        background: d.cardioType?cardioInfo(d.cardioType).color:C.line, borderRadius:"4px 4px 2px 2px", transition:"height .3s" }} />
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
