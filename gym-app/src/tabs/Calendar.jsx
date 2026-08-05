import React, { useState, useEffect } from "react";
import { TYPES, PARTS, PART_GROUPS, partBreakdown, CARDIO, WEEKDAYS, STUDY_ACCENT, MOODS, C, keyOf, todayKey, uid, extraWater, tint, num, didWorkout, emptyDay, stepsToKcal, burnedKcal, planDate, QuickWorkoutBlock, SleepBlock, FoodSection, LineChart, SheetLayer, ConfirmX, inp, primary, ghost, stepBtn, chip, sheet, grip, cardioInfo } from "../shared.jsx";

const groupOfPart = (p)=> PART_GROUPS.find(g=>g.parts.includes(p)) || null;
// 좁은 캘린더 칸에서도 읽히도록 부위명을 줄인다

const PART_SHORT = { "가슴안쪽":"안쪽", "후면어깨":"후면", "삼두":"삼두", "이두":"이두", "둔근":"둔근", "복근":"복근" };

const shortPart = (p)=> PART_SHORT[p] || p;
// 부위별 마지막 운동일 — 2~3부위씩 조합해서 하면 "어디가 밀렸나"가 가장 중요한 정보

const lastPartDates = (schedule) => {
  const map = {};   // 부위 → { date, sets }
  for (const dk of Object.keys(schedule||{})) {
    const ps = schedule[dk]?.partSets || {};
    for (const [part, v] of Object.entries(ps)) {
      if (num(v) <= 0) continue;
      if (!map[part] || dk > map[part].date) map[part] = { date: dk, sets: num(v) };
    }
  }
  const t = new Date(); t.setHours(0,0,0,0);
  return PARTS.map((part)=>{
    const hit = map[part];
    if (!hit) return { part, date:null, daysAgo:null, sets:0, group:groupOfPart(part) };
    const d = new Date(hit.date+"T00:00:00");
    return { part, date:hit.date, daysAgo: Math.round((t-d)/86400000), sets:hit.sets, group:groupOfPart(part) };
  });
};

// 그 날 한 부위들을 세트수 많은 순으로 정리 (라벨·색막대 공용)

const PRESET = { 1:"legs", 2:"push", 3:"pull", 4:"upper", 5:"legs", 6:"rest", 0:"rest" };

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

const ALARM_OPTIONS = [
  { v:0,  label:"정시" }, { v:5, label:"5분 전" }, { v:10, label:"10분 전" },
  { v:30, label:"30분 전" }, { v:60, label:"1시간 전" }, { v:-1, label:"알림 없음" },
];
// "HH:MM" + 날짜키 → Date

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

function LogHeatmap({ schedule, onOpen }) {
  const WEEKS = 26;
  const CELL = 13, GAP = 3;
  const today = new Date(); today.setHours(0,0,0,0);
  // 이번 주 토요일까지 채워서 열이 깔끔하게 끝나도록
  const end = new Date(today); end.setDate(today.getDate() + (6-today.getDay()));
  const start = new Date(end); start.setDate(end.getDate() - (WEEKS*7 - 1));

  // 주 단위 열 구성 (열=주, 행=요일)
  const cols = [];
  for (let w=0; w<WEEKS; w++) {
    const col = [];
    for (let dow=0; dow<7; dow++) {
      const d = new Date(start); d.setDate(start.getDate() + w*7 + dow);
      col.push({ d, kk: keyOf(d.getFullYear(), d.getMonth(), d.getDate()) });
    }
    cols.push(col);
  }

  const setsOf = (kk)=> partBreakdown(schedule[kk]?.partSets).total;
  const allSets = cols.flat().map(c=>setsOf(c.kk)).filter(v=>v>0);
  const maxSets = allSets.length ? Math.max(...allSets) : 1;
  // 4단계 강도
  const levelOf = (v)=> v<=0 ? 0 : v <= maxSets*0.25 ? 1 : v <= maxSets*0.5 ? 2 : v <= maxSets*0.75 ? 3 : 4;
  const shade = (lv)=> lv===0 ? C.surface2 : tint(TYPES.push.color, 0.2 + lv*0.2);

  // 통계
  const totalSets = cols.flat().reduce((s,c)=>s+setsOf(c.kk),0);
  const activeDays = cols.flat().filter(c=> c.d<=today && didWorkout(schedule[c.kk])).length;
  const elapsedDays = cols.flat().filter(c=>c.d<=today).length;
  const avgPerWeek = elapsedDays>0 ? (activeDays/elapsedDays*7).toFixed(1) : "0";

  // 월 라벨: 각 열의 1일이 포함된 주에 표시
  const monthLabel = (w)=>{
    const col = cols[w];
    const first = col.find(c=>c.d.getDate()<=7);
    if (!first) return null;
    if (w>0) {
      const prev = cols[w-1].find(c=>c.d.getDate()<=7);
      if (prev && prev.d.getMonth()===first.d.getMonth()) return null;
    }
    return `${first.d.getMonth()+1}월`;
  };

  return (
    <div>
      <div style={{ padding:"12px 18px 10px" }}>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
          <span style={{ fontSize:17, fontWeight:800, letterSpacing:-0.3 }}>최근 6개월</span>
          <span style={{ fontSize:11.5, color:C.muted }}>주 {avgPerWeek}회 · 총 {totalSets}세트</span>
        </div>
      </div>

      {/* 잔디 */}
      <div style={{ padding:"0 18px", overflowX:"auto" }}>
        <div style={{ display:"inline-block", minWidth:"100%" }}>
          {/* 월 라벨 */}
          <div style={{ display:"flex", gap:GAP, marginLeft:16, marginBottom:3, height:11 }}>
            {cols.map((_,w)=>(
              <div key={w} style={{ width:CELL, fontSize:8.5, color:C.muted, fontWeight:700, whiteSpace:"nowrap" }}>
                {monthLabel(w)}
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:GAP }}>
            {/* 요일 라벨 */}
            <div style={{ display:"flex", flexDirection:"column", gap:GAP, width:13, flexShrink:0 }}>
              {WEEKDAYS.map((w,i)=>(
                <div key={i} style={{ height:CELL, fontSize:7.5, color:C.muted, lineHeight:`${CELL}px`,
                  opacity: i%2===1?1:0 }}>{w}</div>
              ))}
            </div>
            {/* 열 */}
            {cols.map((col,w)=>(
              <div key={w} style={{ display:"flex", flexDirection:"column", gap:GAP }}>
                {col.map((c)=>{
                  const future = c.d > today;
                  const v = setsOf(c.kk);
                  const lv = levelOf(v);
                  const isT = c.kk===todayKey();
                  return (
                    <button key={c.kk} onClick={()=> !future && onOpen(c.kk)} disabled={future}
                      title={`${c.kk} · ${v}세트`}
                      style={{ width:CELL, height:CELL, borderRadius:3, padding:0, cursor:future?"default":"pointer",
                        background: future ? "transparent" : shade(lv),
                        border: isT ? `1.5px solid ${TYPES.push.color}` : future ? "none" : `1px solid ${C.line}`,
                        opacity: future?0.25:1 }} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 강도 안내 */}
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"12px 18px 0", justifyContent:"flex-end" }}>
        <span style={{ fontSize:10, color:C.muted }}>적음</span>
        {[0,1,2,3,4].map(lv=>(
          <div key={lv} style={{ width:11, height:11, borderRadius:3, background:shade(lv), border:`1px solid ${C.line}` }} />
        ))}
        <span style={{ fontSize:10, color:C.muted }}>많음</span>
      </div>
      <div style={{ fontSize:10.5, color:C.muted, padding:"8px 18px 0", textAlign:"center", lineHeight:1.5 }}>
        칸을 탭하면 그날 기록을 볼 수 있어요 · 색이 진할수록 세트수가 많아요
      </div>
    </div>
  );
}

// 주간 보기 — 한 주를 세로로 크게. 칸이 넓어 부위·세트를 다 적을 수 있다

function LogWeek({ weekAnchor, setWeekAnchor, schedule, studyDates, calWeight, onOpen }) {
  const base = new Date(weekAnchor); base.setHours(0,0,0,0);
  const sun = new Date(base); sun.setDate(base.getDate()-base.getDay());
  const days = [...Array(7)].map((_,i)=>{ const d=new Date(sun); d.setDate(sun.getDate()+i); return d; });
  const keys = days.map(d=>keyOf(d.getFullYear(),d.getMonth(),d.getDate()));
  const todayK = todayKey();
  const isThisWeek = keys.includes(todayK);
  const moveWeek = (d)=>{ const n=new Date(sun); n.setDate(sun.getDate()+d*7); setWeekAnchor(n); };

  // 주간 합계
  const totalSets = keys.reduce((s,kk)=>s+partBreakdown(schedule[kk]?.partSets).total,0);
  const workoutDays = keys.filter(kk=>didWorkout(schedule[kk])).length;
  const weekGroups = PART_GROUPS.map((g)=>({
    key:g.key, color:g.color,
    sets: keys.reduce((s,kk)=>{
      const ps = schedule[kk]?.partSets || {};
      return s + g.parts.reduce((a,p)=>a+num(ps[p]),0);
    },0),
  })).filter(g=>g.sets>0);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 18px 10px", gap:8 }}>
        <span style={{ fontSize:17, fontWeight:800, letterSpacing:-0.3 }}>
          {sun.getMonth()+1}.{sun.getDate()} ~ {days[6].getMonth()+1}.{days[6].getDate()}
        </span>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {!isThisWeek && (
            <button onClick={()=>setWeekAnchor(new Date())}
              style={{ background:tint(TYPES.push.color,0.14), border:`1px solid ${tint(TYPES.push.color,0.45)}`, color:TYPES.push.color,
                borderRadius:999, padding:"6px 12px", fontSize:11.5, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap" }}>이번 주</button>
          )}
          <button onClick={()=>moveWeek(-1)} style={navBtn}>‹</button>
          <button onClick={()=>moveWeek(1)} style={navBtn}>›</button>
        </div>
      </div>

      {/* 주간 요약 */}
      {totalSets>0 && (
        <div style={{ margin:"0 18px 12px", padding:"12px", background:C.surface, border:`1px solid ${C.line}`, borderRadius:12 }}>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:9 }}>
            <span style={{ fontSize:11.5, color:C.muted, fontWeight:700 }}>이번 주 볼륨</span>
            <span style={{ fontSize:12, color:C.muted }}><b style={{color:C.text, fontSize:15}}>{totalSets}</b>세트 · 운동 {workoutDays}일</span>
          </div>
          <div style={{ display:"flex", gap:2, height:8, borderRadius:99, overflow:"hidden" }}>
            {weekGroups.map((g)=>(<div key={g.key} style={{ flex:g.sets, background:g.color }} />))}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:8, flexWrap:"wrap" }}>
            {weekGroups.map((g)=>(
              <span key={g.key} style={{ fontSize:10.5, fontWeight:700, color:g.color }}>{g.key} {g.sets}</span>
            ))}
          </div>
        </div>
      )}

      {/* 날짜별 카드 */}
      <div style={{ display:"flex", flexDirection:"column", gap:7, padding:"0 18px" }}>
        {days.map((d,i)=>{
          const kk = keys[i]; const e = schedule[kk]; const isT = kk===todayK;
          const bd = partBreakdown(e?.partSets);
          const t = e?.type ? TYPES[e.type] : null;
          const kcalIn = (e?.foods||[]).reduce((s,f)=>s+num(f.kcal),0);
          const burn = burnedKcal(e, calWeight);
          const water = num(e?.water);
          const hasAny = bd.total>0 || t || kcalIn>0 || water>0 || e?.cardio || studyDates.has(kk);
          return (
            <button key={kk} onClick={()=>onOpen(kk)} style={{
              display:"flex", gap:11, padding:"11px 13px", borderRadius:12, cursor:"pointer", textAlign:"left",
              background: isT?tint(TYPES.push.color,0.08):C.surface,
              border:`1px solid ${isT?tint(TYPES.push.color,0.5):C.line}`, alignItems:"flex-start" }}>
              {/* 날짜 */}
              <div style={{ width:34, flexShrink:0, textAlign:"center" }}>
                <div style={{ fontSize:9.5, fontWeight:700, color:i===0?"#FF6B6B":i===6?"#6BA8FF":C.muted }}>{WEEKDAYS[i]}</div>
                <div style={{ fontSize:18, fontWeight:800, color:isT?TYPES.push.color:C.text, lineHeight:1.15 }}>{d.getDate()}</div>
              </div>
              {/* 내용 */}
              <div style={{ flex:1, minWidth:0 }}>
                {!hasAny ? (
                  <div style={{ fontSize:11.5, color:C.muted, paddingTop:5 }}>기록 없음</div>
                ) : (<>
                  {bd.total>0 && (<>
                    <div style={{ display:"flex", gap:2, height:4, borderRadius:99, overflow:"hidden", marginBottom:6 }}>
                      {bd.groups.map((g)=>(<div key={g.key} style={{ flex:g.sets, background:g.color }} />))}
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {bd.entries.map((x)=>{
                        const g = groupOfPart(x.part);
                        const col = g ? g.color : C.muted;
                        return (
                          <span key={x.part} style={{ fontSize:10.5, fontWeight:800, color:col,
                            background:tint(col,0.13), borderRadius:999, padding:"2px 8px" }}>
                            {shortPart(x.part)} {x.sets}
                          </span>
                        );
                      })}
                    </div>
                  </>)}
                  {t && bd.total===0 && <div style={{ fontSize:12, fontWeight:800, color:t.color }}>{t.label}</div>}
                  {e?.mainLift?.name && (
                    <div style={{ fontSize:10.5, color:C.muted, marginTop:5 }}>
                      🏋️ {e.mainLift.name} {e.mainLift.w?`${e.mainLift.w}kg`:""} {e.mainLift.r?`× ${e.mainLift.r}`:""}
                    </div>
                  )}
                  {/* 그 외 지표 */}
                  <div style={{ display:"flex", gap:9, marginTop:6, flexWrap:"wrap", fontSize:10 }}>
                    {kcalIn>0 && <span style={{ color:"#FF8FB0", fontWeight:700 }}>🍽 {Math.round(kcalIn)}</span>}
                    {burn>0 && <span style={{ color:"#5AD1A0", fontWeight:700 }}>🔥 {burn}</span>}
                    {water>0 && <span style={{ color:"#6BC5F0", fontWeight:700 }}>💧 {water}잔</span>}
                    {e?.cardio && <span style={{ color:cardioInfo(e.cardio.type).color, fontWeight:700 }}>🏃 {e.cardio.min}분</span>}
                    {studyDates.has(kk) && <span style={{ color:STUDY_ACCENT, fontWeight:700 }}>📚</span>}
                  </div>
                </>)}
              </div>
              {bd.total>0 && (
                <div style={{ flexShrink:0, textAlign:"right", paddingTop:2 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:TYPES.push.color, lineHeight:1 }}>{bd.total}</div>
                  <div style={{ fontSize:9, color:C.muted }}>세트</div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 부위별 마지막 운동일 — 오래 방치된 부위가 위로 오게

function PartRecency({ schedule }) {
  const [open, setOpen] = useState(true);
  const rows = lastPartDates(schedule);
  const done = rows.filter(r=>r.date).sort((a,b)=> b.daysAgo-a.daysAgo);
  const never = rows.filter(r=>!r.date);
  if (done.length===0) return null;

  // 4일 이상 지났으면 주의, 7일 이상이면 경고
  const tone = (d)=> d>=7 ? C.danger : d>=4 ? C.amber : TYPES.legs.color;
  const text = (d)=> d===0 ? "오늘" : d===1 ? "어제" : `${d}일 전`;
  const stale = done.filter(r=>r.daysAgo>=7);

  return (
    <div style={{ padding:"16px 18px 0" }}>
      <div onClick={()=>setOpen(v=>!v)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
        <span style={{ fontSize:12, fontWeight:800, color:C.muted }}>부위별 마지막 운동 {open?"▴":"▾"}</span>
        {stale.length>0 && (
          <span style={{ fontSize:10.5, fontWeight:800, color:C.danger }}>
            {stale.slice(0,2).map(r=>shortPart(r.part)).join("·")}{stale.length>2?` +${stale.length-2}`:""} 밀림
          </span>
        )}
      </div>
      {open && (<>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:10 }}>
          {done.map((r)=>{
            const col = tone(r.daysAgo);
            const gc = r.group ? r.group.color : C.muted;
            return (
              <div key={r.part} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 10px", borderRadius:999,
                background:C.surface, border:`1px solid ${r.daysAgo>=7?tint(C.danger,0.4):C.line}` }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:gc, flexShrink:0 }} />
                <span style={{ fontSize:11.5, fontWeight:700 }}>{shortPart(r.part)}</span>
                <span style={{ fontSize:11, fontWeight:800, color:col }}>{text(r.daysAgo)}</span>
              </div>
            );
          })}
          {never.map((r)=>(
            <div key={r.part} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 10px", borderRadius:999,
              background:C.surface, border:`1px dashed ${C.line}`, opacity:0.6 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:C.muted, flexShrink:0 }} />
              <span style={{ fontSize:11.5, fontWeight:700, color:C.muted }}>{shortPart(r.part)}</span>
              <span style={{ fontSize:10.5, color:C.muted }}>기록 없음</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize:10.5, color:C.muted, marginTop:8, lineHeight:1.5 }}>
          초록 3일 이내 · 노랑 4~6일 · 빨강 7일 이상
        </div>
      </>)}
    </div>
  );
}

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
        <SheetLayer onClose={()=>setPickOpen(false)}>
          <div onClick={(e)=>e.stopPropagation()} style={{...sheet, minHeight:"auto", maxHeight:"none", paddingBottom:"calc(18px + env(safe-area-inset-bottom))"}}>
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
        </SheetLayer>
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
    <SheetLayer onClose={save}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink:0 }}>
          <div style={grip} />
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontSize:15, fontWeight:800 }}>{dateKey.replace(/-/g,".")} ({dow})</span>
            <span style={{ fontSize:11, color:C.muted }}>계획 {items.length}개</span>
          </div>
        </div>

        <div style={{ flex:"1 1 auto", minHeight:0, overflowY:"auto", paddingRight:2, overscrollBehavior:"contain" }}>
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
                  <ConfirmX onConfirm={()=>remove(p.id)} label="계획 삭제" size={17} />
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
                style={{...inp, width:"100%", boxSizing:"border-box", padding:"10px", colorScheme:"dark"}} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>종료</div>
              <input type="time" value={draft.end} onChange={(e)=>setDraft({...draft, end:e.target.value})}
                style={{...inp, width:"100%", boxSizing:"border-box", padding:"10px", colorScheme:"dark"}} />
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
    </SheetLayer>
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
    <SheetLayer onClose={onClose}>
      <div onClick={(e)=>e.stopPropagation()} style={{...sheet, minHeight:"auto", maxHeight:"none", paddingBottom:"calc(18px + env(safe-area-inset-bottom))"}}>
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
    </SheetLayer>
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

export default function Calendar({ data, persist, updateDay, favProps, apiKey, customFoods, routines, mutate }) {
  const [mode, setMode] = useState("log"); // log = 운동·식단 기록 / plan = 시간 계획
  const [toolsOpen, setToolsOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [logView, setLogView] = useState("month"); // month | week | year(히트맵)
  const [weekAnchor, setWeekAnchor] = useState(()=>new Date());
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

      {/* 보기 전환 */}
      <div style={{ display:"flex", gap:6, padding:"12px 18px 0" }}>
        {[["month","월간"],["week","주간"],["year","히트맵"]].map(([k,label])=>(
          <button key={k} onClick={()=>setLogView(k)}
            style={{...chip(logView===k, TYPES.push.color), padding:"6px 13px", fontSize:12}}>{label}</button>
        ))}
      </div>

      {logView==="month" && (<>
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
      </>)}

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
        <SheetLayer onClose={()=>setResetOpen(false)}>
          <div onClick={(e)=>e.stopPropagation()} style={{...sheet, minHeight:"auto", maxHeight:"none", paddingBottom:"calc(18px + env(safe-area-inset-bottom))"}}>
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
        </SheetLayer>
      )}

      {logView==="month" && (<>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"0 12px", gap:4 }}>
        {WEEKDAYS.map((w,i)=>(<div key={w} style={{ textAlign:"center", fontSize:11, fontWeight:700, padding:"4px 0",
          color:i===0?"#FF6B6B":i===6?"#6BA8FF":C.muted }}>{w}</div>))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"4px 12px", gap:4 }}>
        {cells.map((d,i)=>{
          if(!d) return <div key={i} />;
          const kk=keyOf(view.y,view.m,d); const e=schedule[kk]; const t=e&&e.type?TYPES[e.type]:null;
          // 부위 세트수(퀵기록) 정리 — 여러 부위를 해도 색으로 구분되게
          const bd = partBreakdown(e?.partSets);
          const totalSets = bd.total;
          const hasQuick = bd.entries.length>0 || !!e?.mainLift?.name;
          // 셀 배경색: 지표를 볼 때는 그 지표 색으로, 아니면 운동 타입/부위 그룹색
          const metricVal = calMetric!=="none" ? cellMetric(e, calMetric, calWeight) : null;
          const mainGroup = bd.groups.length ? [...bd.groups].sort((a,b)=>b.sets-a.sets)[0] : null;
          const partColor = t ? t.color : (mainGroup ? mainGroup.color : (hasQuick ? TYPES.push.color : null));
          const showColor = calMetric!=="none"
            ? (metricVal ? METRICS[calMetric].color : null)
            : partColor;
          // 라벨: 세트 많은 부위 2개까지 약칭으로, 나머지는 +N
          let label = null;
          if (t) label = e.type==="custom"&&e.parts?.length ? e.parts.map(shortPart).join("·") : t.label;
          else if (bd.entries.length>0) {
            const head = bd.entries.slice(0,2).map(x=>shortPart(x.part)).join("·");
            label = bd.entries.length>2 ? `${head}+${bd.entries.length-2}` : head;
          }
          else if (e?.mainLift?.name) label = e.mainLift.name;
          return (
            <button key={i} onClick={()=>setEditKey(kk)} style={{
              aspectRatio:"1 / 1.15", borderRadius:12, cursor:"pointer",
              border:isToday(d)?`2px solid ${TYPES.push.color}`:`1px solid ${C.line}`,
              background:showColor?tint(showColor,0.14):C.surface, display:"flex", flexDirection:"column",
              alignItems:"flex-start", justifyContent:"space-between", padding:"6px 6px 5px", position:"relative", overflow:"hidden", textAlign:"left" }}>
              <span style={{ fontSize:12, fontWeight:700, color:isToday(d)?C.text:C.muted }}>{d}</span>
              <div style={{ display:"flex", flexDirection:"column", gap:2, width:"100%" }}>
                {/* 지표(먹은/소모 kcal·물)를 볼 때는 부위 표시를 숨긴다 — 작은 칸에서 글자가 겹쳐 보이는 문제 방지 */}
                {calMetric==="none" && (<>
                  {bd.groups.length>0 && (
                    <div style={{ display:"flex", gap:1.5, width:"100%", height:3.5 }}>
                      {bd.groups.map((g)=>(
                        <div key={g.key} style={{ flex:g.sets, background:g.color, borderRadius:99 }} />
                      ))}
                    </div>
                  )}
                  {label && <span style={{ fontSize:9.5, fontWeight:800, lineHeight:1.1, color:partColor, wordBreak:"keep-all",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{label}</span>}
                  {!t && totalSets>0 && <span style={{ fontSize:8.5, fontWeight:700, color:C.muted }}>{totalSets}세트</span>}
                </>)}

                {/* 지표를 볼 때는 부위 자리가 비므로 숫자를 크게 — 한눈에 읽히도록 */}
                {metricVal && (
                  <span style={{ fontSize:13, fontWeight:800, color:METRICS[calMetric].color,
                    lineHeight:1.15, letterSpacing:-0.3, whiteSpace:"nowrap" }}>{metricVal}</span>
                )}
              </div>
              {e?.cardio && <span style={{ position:"absolute", top:6, right:6, width:7, height:7, borderRadius:"50%", background:cardioInfo(e.cardio.type).color }} />}
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

      </>)}

      {logView==="week" && (
        <LogWeek weekAnchor={weekAnchor} setWeekAnchor={setWeekAnchor} schedule={schedule}
          studyDates={studyDates} calWeight={calWeight} onOpen={setEditKey} />
      )}
      {logView==="year" && (
        <LogHeatmap schedule={schedule} onOpen={setEditKey} />
      )}

      {/* 부위별 마지막 운동일 */}
      <PartRecency schedule={schedule} />

      {/* 색상 안내 (접이식) */}
      <div style={{ padding:"14px 18px 0" }}>
        <button onClick={()=>setLegendOpen(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer",
          color:C.muted, fontSize:11, fontWeight:700, padding:0 }}>색상 안내 {legendOpen?"▴":"▾"}</button>
        {legendOpen && (
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:10, color:C.muted, fontWeight:700, marginBottom:6 }}>운동 부위 (막대 색)</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {PART_GROUPS.map((g)=>(
                <Legend key={g.key} color={g.color} label={`${g.key} · ${g.parts.map(shortPart).join("·")}`} />
              ))}
            </div>
            <div style={{ fontSize:10, color:C.muted, fontWeight:700, margin:"12px 0 6px" }}>그 외 표시 (점)</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <Legend dot color={C.amber} label="유산소" />
              <Legend dot color={TYPES.legs.color} label="식단" />
              <Legend dot color={STUDY_ACCENT} label="공부" />
            </div>
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
// ===== 디로드 · 측정 리마인더 · 칼로리 뱅킹 (전부 로컬 계산) =====
// 고강도를 몇 주 이어왔는지 — 6~8주 넘으면 볼륨을 낮추는 주(디로드)를 권한다

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
  const removeRoutine = (id) => { const r=(routines||[]).find(x=>x.id===id);
    mutate((prev)=>({ ...prev, routines:prev.routines.filter(x=>x.id!==id) }), r?`루틴 "${r.name}"`:"루틴"); };

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
  // 하루 기록을 통째로 지우는 동작이라 되돌리기 라벨을 반드시 넘긴다.
  // 이게 빠져 있어서 식단·운동·수면·일기가 한 번에 사라져도 복구할 방법이 없었다.
  const clearAll = () => {
    updateDay(dateKey, emptyDay(), `${dateKey.slice(5).replace("-", ".")} 하루 기록`);
    onClose();
  };

  return (
    <SheetLayer onClose={save}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink:0 }}>
          <div style={grip} />
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontSize:15, fontWeight:800 }}>{dateKey.replace(/-/g,".")}</span>
            <span style={{ fontSize:11, color:C.muted }}>아래로 스크롤해서 더 기록</span>
          </div>
        </div>
        <div style={{ flex:"1 1 auto", minHeight:0, overflowY:"auto", WebkitOverflowScrolling:"touch", paddingRight:2, overscrollBehavior:"contain" }}>

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
            onChangeMainLift={(v)=>setDraft({ ...draft, mainLift:v })} schedule={schedule} />

          <SecLabel>세트 · 무게</SecLabel>
          {(routines.length>0 || draft.lifts.length>0) && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:10, alignItems:"center" }}>
              {routines.map((r)=>(
                <span key={r.id} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 8px 7px 12px", borderRadius:999,
                  border:`1px solid ${tint(TYPES.push.color,0.5)}`, background:tint(TYPES.push.color,0.1), fontSize:12.5, fontWeight:700 }}>
                  <span onClick={()=>loadRoutine(r)} style={{ cursor:"pointer", color:TYPES.push.color }}>▶ {r.name}</span>
                  <ConfirmX onConfirm={()=>removeRoutine(r.id)} label="루틴 삭제" />
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
                  <ConfirmX onConfirm={()=>rmExercise(l.id)} label="종목 삭제" />
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
    </SheetLayer>
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

const Legend = ({color,label,dot}) => <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.muted }}><span style={{ width:9, height:9, borderRadius:dot?"50%":3, background:color }} />{label}</div>;
// 접이식 묶음 — 매일 안 쓰는 카드들을 접어 오늘 탭을 짧게 유지한다

const SecLabel = ({children}) => <div style={{ fontSize:12, fontWeight:800, color:C.muted, margin:"18px 0 8px" }}>{children}</div>;

const navBtn = { width:34, height:34, borderRadius:10, cursor:"pointer", background:C.surface, border:`1px solid ${C.line}`, color:C.text, fontSize:18, fontWeight:700, lineHeight:1 };
