// ================= 공부 기록 =================

import { useState, useRef, useEffect } from "react";
import { TYPES, VOCAB_TYPES, vocabTypeInfo, POS_LIST, posInfo, MASTER_LEVEL, isMastered, isOftenWrong, isDueToday, dueList, speakWord, speechReady, primeSpeech, ListenPlayer, stripMarkup, hasMarkup, Marked, wrapSelection, splitTermList, reviewScore, STUDY_ACCENT, C, todayKey, uid, tint, num, fmtMin, last7, LineChart, Bars7, Card, Row, SheetLayer, lbl, inp, primary, ghost, stepBtn, xBtn, chip, sheet, grip, callClaudeAPI, posList, hasPos, togglePos, keyOf } from "../shared.jsx";
import { TOEIC_PARTS, partInfo, DEFAULT_SUBJECTS, colorForSubject, STUDY_PALETTE } from "./vocabLogic.js";

export function StudyLog({ data, persist, mutate, days }) {
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
  const rm = (id)=> { const it=study.find(x=>x.id===id); persist({ ...data, study:study.filter(x=>x.id!==id) }, it?`${it.subject} 기록`:"공부 기록"); }

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

// 한 단어에 뜻이 여러 개인지 판정.
// 뜻은 "주소, 다루다" 또는 "n. 명령, v. 명령하다"처럼 쉼표로 이어 저장되므로 조각 수를 센다.
// 품사가 둘 이상 붙은 경우도 다의어로 본다(mandate = 명사·동사).
