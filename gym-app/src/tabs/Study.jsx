import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { TYPES, VOCAB_TYPES, vocabTypeInfo, POS_LIST, posInfo, MASTER_LEVEL, isMastered, isOftenWrong, isDueToday, dueList, speakWord, reviewScore, STUDY_ACCENT, C, todayKey, uid, tint, num, fmtMin, last7, LineChart, Bars7, Card, Row, SheetLayer, lbl, inp, primary, ghost, stepBtn, xBtn, chip, sheet, grip, callClaudeAPI } from "../shared.jsx";

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

const STUDY_PALETTE = ["#7C9CFF", "#FF9F6B", "#5AD1A0", "#E08CFF", "#FFD24B", "#4FC0D0"];

const colorForSubject = (name) => { let h=0; for(const c of String(name)) h=(h*31+c.charCodeAt(0))>>>0; return STUDY_PALETTE[h % STUDY_PALETTE.length]; };

export default function Study({ data, persist, mutate }) {
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
    <SheetLayer onClose={onClose}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink:0 }}>
          <div style={grip} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontSize:16, fontWeight:800 }}>단어 퀴즈</span>
            {started && !done && <span style={{ fontSize:12, color:C.muted }}>{qi+1} / {qs.length}</span>}
          </div>
        </div>

        <div style={{ flex:"1 1 auto", minHeight:0, overflowY:"auto", paddingRight:2, overscrollBehavior:"contain" }}>
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
    </SheetLayer>
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
    <SheetLayer onClose={onClose}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink:0 }}>
          <div style={grip} />
          <div style={{ fontSize:16, fontWeight:800, marginBottom:4 }}>여러 개 한 번에 추가</div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:12 }}>한 줄에 하나씩 · 뜻은 비워도 AI가 채워줘요</div>
        </div>

        <div style={{ flex:"1 1 auto", minHeight:0, overflowY:"auto", paddingRight:2, overscrollBehavior:"contain" }}>
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
    </SheetLayer>
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

  const save = (list, undoLabel)=> mutate((prev)=>({ ...prev, vocab:list }), undoLabel);
  const add = () => {
    if (!draft.term.trim()) return;
    save([...vocab, { id:uid(), type:draft.type, term:draft.term.trim(), meaning:draft.meaning.trim(),
      note:draft.note.trim(), tag:draft.tag.trim(), pos:draft.pos, level:0, reviewCount:0, wrong:0, starred:false, lastReview:null, created:todayKey() }]);
    setDraft({ type:draft.type, term:"", meaning:"", note:"", tag:draft.tag, pos:"" });
  };
  const remove = (id)=> { const v=vocab.find(x=>x.id===id); save(vocab.filter(x=>x.id!==id), v?`"${v.term}"`:"단어"); }
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

  // 복습 대기열 — 오늘 볼 것만 (간격 반복). 전체를 다 넘기지 않아 끝이 보인다.
  const goal = num(data.vocabGoal) || 20;
  const doneToday = vocab.filter(v=>v.lastReview===todayKey()).length;
  const queue = dueList(vocab, Math.max(1, goal - doneToday));
  const dueAll = dueList(vocab, 0).length;
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
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:9 }}>
            <span style={{ fontSize:11, color:C.muted }}>
              오늘 <b style={{ color: todayReviewed>=goal?TYPES.legs.color:STUDY_ACCENT }}>{todayReviewed}</b>
              {" / "}
              <input value={goal} onChange={(e)=>{
                  const n = Math.round(num(e.target.value.replace(/[^0-9]/g,""))) || 1;
                  mutate((prev)=>({ ...prev, vocabGoal: Math.max(1, Math.min(200, n)) }));
                }}
                inputMode="numeric"
                style={{...inp, width:40, padding:"3px 4px", textAlign:"center", fontSize:11.5}} />
              {" 개"}
            </span>
            <span style={{ fontSize:10.5, color: dueAll>0?C.amber:TYPES.legs.color, fontWeight:700 }}>
              {dueAll>0 ? `오늘 볼 것 ${dueAll}개` : "오늘 몫 완료 ✓"}
            </span>
          </div>
          <div style={{ fontSize:10.5, color:C.muted, marginTop:5, lineHeight:1.5 }}>
            숙련도가 오를수록 복습 간격이 늘어나요 (1→2→4→7→14→30일)
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
                style={{...ghost, flex:1}}>{reviewOn ? "복습 끝내기" : `🔁 오늘 복습 ${queue.length}개`}</button>
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
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:20, fontWeight:800, lineHeight:1.35, wordBreak:"break-word" }}>{cur.term}</span>
              {cur.type!=="grammar" && (
                <button onClick={(e)=>{ e.stopPropagation(); speakWord(cur.term); }} title="발음 듣기"
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, padding:2, opacity:0.7 }}>🔊</button>
              )}
            </div>
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
                      {isDueToday(v) && <span style={{ fontSize:9, fontWeight:800, color:STUDY_ACCENT,
                        background:tint(STUDY_ACCENT,0.14), borderRadius:999, padding:"1px 6px" }}>오늘</span>}
                      {v.type!=="grammar" && (
                        <button onClick={(e)=>{ e.stopPropagation(); speakWord(v.term); }} title="발음"
                          style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, padding:0, opacity:0.55 }}>🔊</button>
                      )}
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
