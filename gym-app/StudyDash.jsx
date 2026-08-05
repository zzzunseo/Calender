// ================= 공부 현황 =================
// D-day · 목표 점수 · 점수 추이 · 주간 목표 · 토익 영역별 시간

import { useState, useRef, useEffect } from "react";
import { TYPES, VOCAB_TYPES, vocabTypeInfo, POS_LIST, posInfo, MASTER_LEVEL, isMastered, isOftenWrong, isDueToday, dueList, speakWord, speechReady, primeSpeech, ListenPlayer, stripMarkup, hasMarkup, Marked, wrapSelection, splitTermList, reviewScore, STUDY_ACCENT, C, todayKey, uid, tint, num, fmtMin, last7, LineChart, Bars7, Card, Row, SheetLayer, lbl, inp, primary, ghost, stepBtn, xBtn, chip, sheet, grip, callClaudeAPI, posList, hasPos, togglePos, keyOf } from "./shared.jsx";
import { TOEIC_PARTS, partInfo, DEFAULT_SUBJECTS, colorForSubject } from "./vocabLogic.js";

export function StudyDash({ data, persist, mutate, days }) {
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
  const rmExam = (id)=> { const it=data.exams.find(x=>x.id===id); persist({ ...data, exams:data.exams.filter(x=>x.id!==id) }, it?it.name:"시험"); }

  const addScore = () => { if(!score.val && !score.lc && !score.rc) return;
    const lc=num(score.lc), rc=num(score.rc);
    const total = num(score.val) || (lc+rc);
    persist({ ...data, scores:[...data.scores, { id:uid(), date:score.date, type:score.type, score:total,
      ...(lc>0?{lc}:{}), ...(rc>0?{rc}:{}) }] });
    setScore({ date:todayKey(), type:score.type, val:"", lc:"", rc:"" }); setScoreOpen(false); };
  const rmScore = (id)=> { const it=data.scores.find(x=>x.id===id); persist({ ...data, scores:data.scores.filter(x=>x.id!==id) }, it?`${it.type} ${it.score}점`:"점수"); }

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

