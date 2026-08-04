import { useState, useRef, useEffect } from "react";
import { TYPES, VOCAB_TYPES, vocabTypeInfo, POS_LIST, posInfo, MASTER_LEVEL, isMastered, isOftenWrong, isDueToday, dueList, speakWord, speechReady, primeSpeech, ListenPlayer, stripMarkup, hasMarkup, Marked, wrapSelection, splitTermList, reviewScore, STUDY_ACCENT, C, todayKey, uid, tint, num, fmtMin, last7, LineChart, Bars7, Card, Row, SheetLayer, lbl, inp, primary, ghost, stepBtn, xBtn, chip, sheet, grip, callClaudeAPI, posList, hasPos, togglePos, keyOf } from "../shared.jsx";

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

// "단어 - 뜻 - 품사" 형태의 여러 줄을 한 번에 파싱한다.
// 구분자는 탭, |, ;, :, 하이픈, 쉼표를 지원하고, 없으면 첫 한글 위치에서 자른다.
//
// 슬래시(/)는 일부러 구분자에서 뺐다. 사용자가 "raise/rise", "allow/permit"처럼
// 동의어·혼동어를 한 항목으로 묶는 데 쓰기 때문이다. 구분자로 두면 슬래시 뒤가
// 뜻으로 넘어가 단어가 통째로 잘려나간다.

export const parseVocabLines = (text) => {
  const out = [];
  for (const rawLine of String(text||"").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let parts = null;
    // 쉼표만으로 나뉜 줄("address 주소, 다루다")은 앞쪽이 "단어+첫 뜻"으로 붙어 있을 수 있다.
    // 이때 쉼표로 먼저 자르면 단어가 "address 주소"가 되어버리므로,
    // 확실한 구분자(탭·/·|·;·:·하이픈)가 있을 때만 그것으로 나눈다.
    const hard = line.split(/\s*[\t|;:]\s*|\s+[-–—]\s+/).map(x=>x.trim()).filter(Boolean);
    const m = hard.length >= 2
      ? hard.flatMap(x=>x.split(/\s*,\s*/).map(y=>y.trim()).filter(Boolean))
      : line.split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean);
    if (m.length >= 2) {
      // 첫 조각이 "issue 문제"처럼 단어와 첫 뜻이 붙어 있으면 한글 기준으로 한 번 더 나눈다.
      const first = m[0];
      let idx = first.search(/[가-힣]/);
      if (idx > 0 && first[idx-1] === "~") idx -= 1;
      parts = idx > 0
        ? [first.slice(0,idx).trim(), first.slice(idx).trim(), ...m.slice(1)]
        : m;
    }
    else {
      // 구분자가 없으면 첫 한글 글자 기준으로 앞=단어, 뒤=뜻.
      // 단, "be subject to ~의 대상이 되다"처럼 물결(~)이 뜻의 시작을 나타내는 경우가 많아
      // 한글 바로 앞의 물결은 뜻 쪽으로 넘긴다.
      let idx = line.search(/[가-힣]/);
      if (idx > 0 && line[idx-1] === "~") idx -= 1;
      if (idx > 0) parts = [line.slice(0,idx).trim(), line.slice(idx).trim()];
      else parts = [line];
    }
    // 사전 표기처럼 "adhere v 지키다"로 쓰면 품사가 단어에 붙어버린다.
    // 단어 끝에 품사가 붙어 있으면 떼어내고 품사로 인정한다.
    const posSet = [];
    const addPos = (p)=>{ if (p && !posSet.includes(p)) posSet.push(p); };
    let term = parts[0];
    {
      const toks = term.split(/\s+/);
      if (toks.length >= 2) {
        const p = normPos(toks[toks.length-1]);
        if (p) { addPos(p); term = toks.slice(0,-1).join(" "); }
      }
    }
    if (!term) continue;

    // 뜻은 "어느 품사의 뜻인지"를 잃지 않도록 조각별로 품사를 함께 들고 간다
    // 뜻 부분을 낱말 단위로 훑는다.
    // 품사가 나오면 거기서부터 새 뜻이 시작된 것으로 보므로,
    // "n 명령하다 v 권한"처럼 한 덩어리로 적어도 뜻마다 품사가 제대로 붙는다.
    const segs = [];   // { pos, text }
    let cur = null;
    const flush = ()=>{ if (cur && cur.text.trim()) segs.push({ pos:cur.pos, text:cur.text.trim() }); cur = null; };
    for (const seg of parts.slice(1)) {
      for (const w of seg.split(/\s+/)) {
        if (!w) continue;
        const p = normPos(w);
        if (p) {                       // 품사를 만나면 새 뜻 시작
          addPos(p);
          flush();
          cur = { pos:p, text:"" };
          continue;
        }
        if (!cur) cur = { pos:"", text:"" };
        cur.text += (cur.text ? " " : "") + w;
      }
      flush();                          // 조각(구분자)이 끝나면 뜻도 끊는다
    }
    flush();
    // 단어 뒤에 붙어 있던 품사는 첫 번째 뜻의 것으로 본다 ("adhere v 지키다")
    if (segs.length && !segs[0].pos && posSet.length) segs[0].pos = posSet[0];

    // 괄호 표기 "(adj)"도 품사로 인정
    for (const sg of segs) {
      sg.text = sg.text.replace(/\(([^)]+)\)/g, (whole, inner) => {
        const p = normPos(inner);
        if (p) { addPos(p); if (!sg.pos) sg.pos = p; return ""; }
        return whole;
      }).replace(/\s{2,}/g, " ").trim();
    }

    // 품사가 붙은 뜻이 둘 이상이면 "v. 명령하다, n. 권한"처럼 짝을 보이게 적는다.
    // 하나뿐이면 배지로 충분하므로 뜻은 그대로 둔다.
    const tagged = segs.filter(x=>x.pos && x.text);
    const showPair = tagged.length >= 2 && new Set(tagged.map(x=>x.pos)).size >= 2;
    let meaning = segs
      .filter(x=>x.text)
      .map(x=> (showPair && x.pos) ? `${posInfo(x.pos)?.short || x.pos} ${x.text}` : x.text)
      .join(", ");

    meaning = meaning.replace(/^[,\s]+|[,\s]+$/g,"").replace(/,\s*,/g, ",");
    out.push({ term, meaning, pos: posSet.join(",") });
  }
  return out;
};
// 숙련도 0~5. 복습에서 "알아요"면 +1, "헷갈려요"면 -1(최소 0)

const STUDY_PALETTE = ["#7C9CFF", "#FF9F6B", "#5AD1A0", "#E08CFF", "#FFD24B", "#4FC0D0"];

const colorForSubject = (name) => { let h=0; for(const c of String(name)) h=(h*31+c.charCodeAt(0))>>>0; return STUDY_PALETTE[h % STUDY_PALETTE.length]; };

export default function Study({ data, persist, mutate }) {
  const [view, setView] = useState("vocab"); // vocab | dash | log — 단어장을 가장 자주 써서 기본 화면으로 둔다
  const study = data.study||[];
  const tk = todayKey();
  const days = last7();
  const todayMin = study.filter(s=>s.date===tk).reduce((a,s)=>a+s.minutes,0);
  const weekMin = study.filter(s=>days.includes(s.date)).reduce((a,s)=>a+s.minutes,0);

  const tabs = (
    <div style={{ display:"flex", gap:6, marginTop:14 }}>
      {[["vocab","📖 단어장"],["dash","📊 현황"],["log","✍️ 기록"]].map(([k,label])=>(
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

// 한 단어에 뜻이 여러 개인지 판정.
// 뜻은 "주소, 다루다" 또는 "n. 명령, v. 명령하다"처럼 쉼표로 이어 저장되므로 조각 수를 센다.
// 품사가 둘 이상 붙은 경우도 다의어로 본다(mandate = 명사·동사).
const meaningCount = (v) => String(v?.meaning||"")
  .split(",").map(x=>x.trim()).filter(Boolean).length;
const isPolysemous = (v) => meaningCount(v) >= 2 || posList(v?.pos).length >= 2;

// ===== 빈칸 채우기 =====
// 예문에서 그 단어를 찾아 ____ 로 가린다. 토익 Part 5와 같은 형식이라 실전에 가깝다.
// 영어는 어형이 변하므로(allocate → allocated/allocating) 어간을 기준으로 찾는다.
const clozeStem = (term) => {
  const t = String(term||"").trim().toLowerCase();
  if (t.length <= 3) return t;
  // 흔한 어미를 떼어 어간만 남긴다
  return t.replace(/(ing|ed|es|s|ly|ment|tion|ness)$/,"");
};
// 예문에서 단어(어형 변화 포함)를 찾아 빈칸으로 바꾼다. 못 찾으면 null.
const makeCloze = (sentence, term) => {
  const text = String(sentence||"").trim();
  if (!text) return null;
  const t = String(term||"").trim();
  if (!t) return null;

  // 1) 원형이 그대로 있으면 그것부터 (숙어처럼 띄어쓰기가 있는 경우 포함)
  const escape = (x)=> x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const whole = new RegExp(`(^|[^A-Za-z])(${escape(t)})(?![A-Za-z])`, "i");
  if (whole.test(text)) return text.replace(whole, (m,a)=> a + "______");

  // 2) 어형이 바뀐 경우: 어간으로 시작하는 낱말을 찾는다
  const stem = clozeStem(t);
  if (stem.length >= 4) {
    const infl = new RegExp(`(^|[^A-Za-z])(${escape(stem)}[A-Za-z]{0,4})(?![A-Za-z])`, "i");
    if (infl.test(text)) return text.replace(infl, (m,a)=> a + "______");
  }
  return null;   // 예문에 단어가 없으면 문제로 못 쓴다
};
// 빈칸 문제로 쓸 수 있는 단어만 추린다
const clozeReady = (v) => !!(v && v.term && v.note && makeCloze(v.note, v.term));

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
  const [autoSpeak, setAutoSpeak] = useState(false);
  const canSpeak = speechReady();

  // 빈칸 모드는 예문에서 그 단어를 찾을 수 있어야 문제를 만들 수 있다
  const pool = dir==="cloze" ? vocab.filter(clozeReady)
    // 품사 맞히기는 품사가 하나만 입력된 단어로 낸다(둘 이상이면 정답이 여러 개가 되어 애매해짐)
    : dir==="pos" ? vocab.filter(v=>v.term && posList(v.pos).length===1)
    : vocab.filter(v=>v.term && v.meaning);
  const scoped = scope==="weak" ? pool.filter(v=>!isMastered(v))
    : scope==="star" ? pool.filter(v=>v.starred)
    : scope==="wrong" ? pool.filter(isOftenWrong)
    : scope==="poly" ? pool.filter(isPolysemous) : pool;
  const enough = pool.length >= 4;

  const build = () => {
    const base = (scoped.length>=4 ? scoped : pool).slice();
    // 미숙련·오래된 것 우선으로 섞되 완전 고정은 아니게
    const sorted = base.sort((a,b)=>reviewScore(b)-reviewScore(a)).slice(0, 30);
    const picks = sorted.sort(()=>Math.random()-0.5).slice(0, Math.min(10, sorted.length));
    // 오답 보기는 전체 단어에서 뽑는다 (빈칸 모드에서 예문 있는 단어가 적어도 보기가 채워지도록)
    const distractPool = vocab.filter(x=>x.term);
    const made = picks.map((v)=>{
      if (dir==="pos") {
        // 보기는 품사 목록에서 뽑는다. 정답 품사 + 다른 품사 3개
        const answer = posList(v.pos)[0];
        const wrong = POS_LIST.filter(p=>p.k!==answer.k).sort(()=>Math.random()-0.5).slice(0,3);
        const opts = [answer, ...wrong].sort(()=>Math.random()-0.5)
          .map(p=>({ id:`pos-${p.k}`, posKey:p.k, label:p.label, color:p.color }));
        return { v, opts, answerId:`pos-${answer.k}`, cloze:null };
      }
      const others = distractPool.filter(o=>o.id!==v.id)
        .sort(()=>Math.random()-0.5).slice(0,3);
      const opts = [v, ...others].sort(()=>Math.random()-0.5);
      return { v, opts, answerId: v.id, cloze: dir==="cloze" ? makeCloze(stripMarkup(v.note), stripMarkup(v.term)) : null };
    });
    if (autoSpeak) primeSpeech();   // 버튼을 누른 이 시점이 iOS가 허용하는 유일한 타이밍
    setQs(made); setQi(0); setPicked(null); setCorrect(0); setWrongList([]); setStarted(true);
  };

  const cur = qs[qi] || null;
  const done = started && qi >= qs.length;
  // 퀴즈에서는 품사를 숨긴다. 뜻 앞에 붙은 "n. / v." 표기도 답을 좁혀주는 힌트라 함께 지운다.
  // 퀴즈 보기에는 서식이 의미가 없다. 기호가 그대로 노출되지 않게 먼저 걷어낸다.
  const hidePos = (text)=> stripMarkup(String(text||"").replace(/\s*\n+\s*/g, " / "))
    .replace(/(^|,\s*)(n|v|adj|adv|prep|conj)\.\s*/g, "$1")
    .trim();
  // 보기에 뭘 적을지: 품사 모드는 품사 이름, 단어→뜻은 뜻, 나머지는 단어
  const label = (o)=> dir==="pos" ? o.label : (dir==="t2m" ? hidePos(o.meaning) : stripMarkup(o.term));
  const question = (v)=> dir==="t2m" ? stripMarkup(v.term) : hidePos(v.meaning);

  // 아직 못 맞힌 문제에서 영어를 읽어주면 답을 흘리는 방향이 있다.
  //  · 단어→뜻 / 품사 맞히기 : 영어 단어가 이미 화면에 있으므로 언제든 재생 가능
  //  · 뜻→단어 / 빈칸 채우기 : 답을 고른 뒤에만 재생
  const speakable = !cur ? null
    : (dir === "t2m" || dir === "pos") ? cur.v.term
    : !picked ? null
    : (dir === "cloze" ? (cur.v.note || cur.v.term) : cur.v.term);

  // 문제가 넘어갈 때 자동 재생 (답이 새는 방향은 제외)
  useEffect(() => {
    if (!autoSpeak || !started || done) return;
    if (dir !== "t2m" && dir !== "pos") return;
    const q = qs[qi];
    if (q) speakWord(stripMarkup(q.v.term));
  }, [qi, started, autoSpeak, dir, done, qs]);

  // 답을 고른 뒤 정답 발음 (뜻→단어 · 빈칸 모드)
  useEffect(() => {
    if (!autoSpeak || !picked || !cur) return;
    if (dir === "t2m" || dir === "pos") return;
    speakWord(stripMarkup(dir === "cloze" ? (cur.v.note || cur.v.term) : cur.v.term));
  }, [picked, autoSpeak, dir, cur]);

  const choose = (opt) => {
    if (picked) return;
    setPicked(opt);
    const ok = opt.id === (cur.answerId ?? cur.v.id);
    if (ok) setCorrect(c=>c+1); else setWrongList(w=>[...w, cur.v]);
    onAnswer(cur.v.id, ok ? 1 : -1);
  };
  const next = () => { setPicked(null); setQi(i=>i+1); };

  return (
    <SheetLayer onClose={onClose}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink:0 }}>
          <div style={grip} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontSize:16, fontWeight:800 }}>단어 퀴즈</span>
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              {canSpeak && (
                <button onClick={()=>{ const on = !autoSpeak; if (on) primeSpeech(); setAutoSpeak(on); }}
                  title="문제가 넘어갈 때 발음 자동 재생"
                  style={{ fontSize:10.5, fontWeight:800, cursor:"pointer", padding:"4px 9px", borderRadius:999,
                    background: autoSpeak ? tint(STUDY_ACCENT,0.18) : "transparent",
                    border:`1px solid ${autoSpeak ? STUDY_ACCENT : C.line}`,
                    color: autoSpeak ? STUDY_ACCENT : C.muted }}>
                  🔊 자동 {autoSpeak ? "켬" : "끔"}
                </button>
              )}
              {started && !done && <span style={{ fontSize:12, color:C.muted }}>{qi+1} / {qs.length}</span>}
            </div>
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
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {[["t2m","단어 → 뜻"],["m2t","뜻 → 단어"],["cloze","빈칸 채우기"],["pos","품사 맞히기"]].map(([k,l])=>{
                const n = k==="cloze" ? vocab.filter(clozeReady).length
                  : k==="pos" ? vocab.filter(v=>v.term && posList(v.pos).length===1).length
                  : vocab.filter(v=>v.term&&v.meaning).length;
                const off = (k==="cloze" || k==="pos") && n < 1;
                return (
                  <button key={k} onClick={()=>!off && setDir(k)} disabled={off}
                    style={{...chip(dir===k, STUDY_ACCENT), flex:1, textAlign:"center", padding:"9px 0",
                      fontSize:11.5, opacity: off?0.4:1}}>{l}</button>
                );
              })}
            </div>
            {dir==="pos" && (
              <div style={{ fontSize:10.5, color:C.muted, marginTop:6, lineHeight:1.55 }}>
                품사가 <b style={{color:C.text}}>하나만</b> 입력된 단어로 문제를 만들어요
                ({vocab.filter(v=>v.term && posList(v.pos).length===1).length}개).
                품사가 둘 이상이면 정답이 여러 개라 제외돼요.
              </div>
            )}
            {dir==="cloze" && (
              <div style={{ fontSize:10.5, color:C.muted, marginTop:6, lineHeight:1.55 }}>
                예문이 있는 단어로 문제를 만들어요 ({vocab.filter(clozeReady).length}개).
                예문은 단어 추가·수정할 때 <b style={{color:C.text}}>예문·메모</b> 칸에 적으면 돼요.
              </div>
            )}
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, margin:"14px 0 7px" }}>범위</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {[["weak","아직 못 외운 것", pool.filter(v=>!isMastered(v)).length, C.amber],
                ["star","⭐ 별표", pool.filter(v=>v.starred).length, "#FFD24B"],
                ["wrong","자주 틀림", pool.filter(isOftenWrong).length, C.danger],
                ["poly","🔀 여러 뜻", pool.filter(isPolysemous).length, "#C9A6FF"],
                ["all","전체", pool.length, STUDY_ACCENT]].map(([k,l,n,col])=>(
                <button key={k} onClick={()=>setScope(k)} disabled={n===0 && k!=="all"}
                  style={{...chip(scope===k, col), textAlign:"center", padding:"9px 0", fontSize:11.5,
                    opacity:(n===0&&k!=="all")?0.35:1,
                    // 5개라 2열 격자에서 마지막 하나가 혼자 남으므로 "전체"는 한 줄을 다 쓰게 한다
                    ...(k==="all" ? { gridColumn:"1 / -1" } : {})}}>{l} {n}</button>
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
                  const pl = posList(v.pos);
                  return (
                    <div key={v.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 0", borderBottom:`1px solid ${C.line}` }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                          <span style={{ fontSize:13, fontWeight:800 }}>{v.term}</span>
                          {pl.map(p=>(<span key={p.k} style={{ fontSize:9, fontWeight:800, color:p.color, background:tint(p.color,0.14), borderRadius:999, padding:"1px 6px", marginRight:3 }}>{p.short}</span>))}
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
              {dir==="pos" ? (
                <>
                  <div style={{ fontSize:21, fontWeight:800, lineHeight:1.3, wordBreak:"break-word" }}>{cur.v.term}</div>
                  {cur.v.meaning && (
                    <div style={{ fontSize:12.5, color:C.muted, marginTop:2 }}>{hidePos(cur.v.meaning)}</div>
                  )}
                  <div style={{ fontSize:10.5, color:STUDY_ACCENT, fontWeight:700, marginTop:4 }}>이 단어의 품사는?</div>
                </>
              ) : dir==="cloze" ? (
                <div style={{ fontSize:16, fontWeight:700, lineHeight:1.6, wordBreak:"break-word", textAlign:"left" }}>
                  {cur.cloze}
                </div>
              ) : (
                <div style={{ fontSize:20, fontWeight:800, lineHeight:1.35, wordBreak:"break-word" }}>{question(cur.v)}</div>
              )}
              {cur.v.tag && <div style={{ fontSize:10, color:C.muted }}>{cur.v.tag}</div>}

              {/* 발음 듣기 — 아직 답을 못 고른 상태에서 답이 새는 방향은 버튼을 숨긴다 */}
              {canSpeak && speakable && (
                <button onClick={()=>speakWord(stripMarkup(speakable))} title="발음 듣기"
                  style={{ marginTop:2, display:"flex", alignItems:"center", gap:5, cursor:"pointer",
                    background:tint(STUDY_ACCENT,0.12), border:`1px solid ${tint(STUDY_ACCENT,0.35)}`,
                    borderRadius:999, padding:"5px 12px", color:STUDY_ACCENT, fontSize:11, fontWeight:800 }}>
                  🔊 발음 듣기
                </button>
              )}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:7, marginTop:12 }}>
              {cur.opts.map((o)=>{
                const isAns = o.id===(cur.answerId ?? cur.v.id);
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

            {/* 답을 고른 뒤에는 원래 문장과 뜻을 보여줘 문맥째로 익히게 한다 */}
            {picked && dir==="cloze" && (
              <div style={{ marginTop:11, padding:"11px 12px", background:C.surface2, borderRadius:10 }}>
                <div style={{ fontSize:12.5, lineHeight:1.6, color:C.text }}>
                  {String(cur.v.note||"")}
                </div>
                <div style={{ fontSize:11.5, color:STUDY_ACCENT, fontWeight:700, marginTop:5 }}>
                  {cur.v.term} — {cur.v.meaning}
                </div>
              </div>
            )}
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

// 단어장을 다른 기기로 옮기기 위한 시트.
// 기록은 기기 안에만 저장되므로, 붙여넣기로 다시 넣을 수 있는 형태로 내보낸다.
// (전체 백업과 달리 단어장만 다루므로, 받는 쪽의 다른 기록은 건드리지 않는다)
// 저장한 단어를 나중에 고치는 폼.
// 뜻을 더 붙이거나 품사를 추가할 때 쓰며, 숙련도·별표 같은 학습 기록은 건드리지 않는다.



// 여러 줄 입력칸.
// <input>은 태그 구조상 줄바꿈이 아예 불가능해서 <textarea>로 바꿔야 한다.
// 다만 textarea는 기본 높이가 고정이라 내용이 늘어도 스크롤만 생기므로,
// 입력할 때마다 scrollHeight로 높이를 맞춰 준다(적어도 2줄, 최대 6줄).
function AutoArea({ inputRef, value, onChange, placeholder, minRows = 2, maxRows = 6, style }) {
  const own = useRef(null);
  const ref = inputRef || own;
  const fit = (el) => {
    if (!el) return;
    const cs = window.getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 19;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) * 2;
    el.style.height = "auto";
    el.style.height = Math.min(Math.max(el.scrollHeight, line * minRows + pad), line * maxRows + pad) + "px";
  };
  useEffect(() => { fit(ref.current); }, [value]);
  return (
    <textarea
      ref={ref} value={value} rows={minRows} placeholder={placeholder}
      onChange={(e) => { onChange(e.target.value); fit(e.target); }}
      style={{ ...inp, width:"100%", boxSizing:"border-box", resize:"none", lineHeight:1.55,
        fontFamily:"inherit", overflowY:"auto", ...style }} />
  );
}

// 강조 버튼 줄
function MarkBar({ inputRef, value, onChange }) {
  const apply = (mark) => {
    const el = inputRef.current;
    const r = wrapSelection(el, mark);
    if (!r) return;
    onChange(r.value);
    // 상태 반영 후 커서를 감싼 글자 위로 되돌려 놓는다 (안 하면 맨 뒤로 튄다)
    requestAnimationFrame(() => {
      try { el.focus(); el.setSelectionRange(r.start, r.end); } catch(e) { /* 무시 */ }
    });
  };
  const btn = (label, mark, style) => (
    <button onMouseDown={(e)=>e.preventDefault()} onClick={()=>apply(mark)}
      style={{ flex:1, padding:"6px 0", borderRadius:8, cursor:"pointer", fontSize:11, fontWeight:800,
        background:C.surface, border:`1px solid ${C.line}`, color:C.muted, ...style }}>{label}</button>
  );
  return (
    <div style={{ display:"flex", gap:5, marginTop:6 }}>
      {btn("강조", "*", { color:STUDY_ACCENT })}
      {btn("밑줄", "_", { textDecoration:"underline", textUnderlineOffset:2 })}
      {btn("주의", "!", { color:C.danger })}
      <div style={{ flex:1.4, fontSize:9.5, color:C.muted, display:"flex", alignItems:"center",
        justifyContent:"center", lineHeight:1.3, textAlign:"center" }}>
        {hasMarkup(value) ? "표시됨" : "글자 선택 후 누르기"}
      </div>
    </div>
  );
}

// ================= 문법 항목 표시 =================
// 문법은 단어와 성격이 다르다. 단어는 "term = meaning" 한 쌍이지만,
// 문법은 제목 + 패턴 여러 줄 + 해당 동사 목록이라 같은 틀에 넣으면 읽기 어렵다.
// (실제로 긴 동사 목록이 줄바꿈 없이 화면 밖으로 잘려 나가고 있었다.)

// 동사 목록처럼 구분자로 이어 붙인 문자열을 칩으로 끊어준다.
// 항목이 3개 미만이면 그냥 문장일 가능성이 높아 원문 그대로 둔다.
export function splitTokens(str) {
  const t = String(str || "").trim();
  if (!t) return [];
  if (/[.?!]\s|[가-힣]{6,}/.test(t) && !/[,/\n]/.test(t)) return [];   // 서술형 메모는 제외
  const items = t.split(/[,/·\n]/).map(x => x.trim()).filter(Boolean);
  return items.length >= 3 ? items : [];
}

// 패턴 줄: "+ 명 + 형(보어) / + 부사 + 형,p.p,v~ing" 처럼 슬래시로 이어 쓴 걸 줄로 나눈다
function patternLines(meaning) {
  const t = String(meaning || "").trim();
  if (!t) return [];
  // 줄바꿈은 사용자가 직접 나눈 것이므로 최우선 구분자로 본다.
  return t.split(/\n+/).flatMap(seg => seg.split(/\s*\/\s*(?=[+SVO가-힣(])/))
    .map(x => x.trim()).filter(Boolean);
}

function GrammarBody({ v }) {
  const { items } = splitTermList(v.term);   // 제목은 배지 줄에서 이미 렌더한다
  const pats = patternLines(v.meaning);
  const verbs = splitTokens(v.note);
  const G = vocabTypeInfo("grammar").color;
  // 동사가 열몇 개씩 되면 목록만으로 화면이 꽉 찬다. 처음엔 8개만 보여준다.
  const [openAll, setOpenAll] = useState(false);
  const shownVerbs = openAll ? verbs : verbs.slice(0, 8);

  return (
    <>
      {/* 제목 괄호 안에 있던 목록 */}
      {items.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
          {items.map((w,i)=>(
            <span key={i} style={{ fontSize:11, fontWeight:700, color:G, background:tint(G,0.12),
              border:`1px solid ${tint(G,0.28)}`, borderRadius:6, padding:"2px 7px" }}>{w}</span>
          ))}
        </div>
      )}

      {/* 패턴 — 가장 중요한 정보라 박스로 띄운다 */}
      {pats.length > 0 && (
        <div style={{ marginTop:8, background:C.surface2, borderRadius:9, padding:"8px 10px",
          borderLeft:`3px solid ${tint(G,0.55)}` }}>
          {pats.map((line,i)=>(
            <div key={i} style={{ fontSize:12.5, color:C.text, lineHeight:1.65, fontWeight:600,
              wordBreak:"break-word", overflowWrap:"anywhere", letterSpacing:-0.1 }}>
              <Marked text={line} color={G} />
            </div>
          ))}
        </div>
      )}

      {/* 해당 동사·표현 — 길게 이어 붙은 목록이 화면을 뚫고 나가던 부분 */}
      {verbs.length > 0 ? (
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:9.5, color:C.muted, fontWeight:700, marginBottom:4 }}>해당 표현 {verbs.length}개</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
            {shownVerbs.map((w,i)=>(
              <span key={i} style={{ fontSize:11, color: hasMarkup(w)?G:C.muted,
                background: hasMarkup(w)?tint(G,0.12):C.surface2,
                borderRadius:6, padding:"2px 7px", wordBreak:"break-word" }}><Marked text={w} color={G} /></span>
            ))}
            {verbs.length > 8 && (
              <button onClick={()=>setOpenAll(o=>!o)}
                style={{ fontSize:11, fontWeight:800, color:G, background:"none",
                  border:`1px dashed ${tint(G,0.4)}`, borderRadius:6, padding:"2px 8px", cursor:"pointer" }}>
                {openAll ? "접기" : `+${verbs.length-8}개`}
              </button>
            )}
          </div>
        </div>
      ) : (v.note && (
        <div style={{ fontSize:11.5, color:C.muted, marginTop:7, lineHeight:1.55, whiteSpace:"pre-wrap",
          wordBreak:"break-word", overflowWrap:"anywhere" }}><Marked text={v.note} color={G} /></div>
      ))}

      {/* 예문 */}
      {v.ex && (
        <div style={{ marginTop:8, fontSize:11.5, color:C.muted, lineHeight:1.6, fontStyle:"italic",
          paddingLeft:9, borderLeft:`2px solid ${C.line}`, whiteSpace:"pre-wrap",
          wordBreak:"break-word", overflowWrap:"anywhere" }}>
          <Marked text={v.ex} color={G} />
        </div>
      )}
    </>
  );
}


// ================= 하나씩 보기 =================
// 복습 카드는 뜻을 가렸다가 맞히는 흐름이라 "그냥 훑어보고 싶을 때" 쓸 수가 없다.
// 특히 숙어·문법은 외웠는지 시험하기 전에 내용을 차분히 읽는 단계가 먼저 필요하다.
// 그래서 아무것도 숨기지 않고 한 항목씩 전체를 보여주는 화면을 따로 뒀다.
// 목록에 걸린 필터(종류·별표·섹션·검색)를 그대로 물려받아 "지금 보고 있는 범위"를 넘긴다.

// 듣기 모드에 넘길 재생 순서와 화면.
// 문법은 영어 문장이 아니라 제목이 한글 위주라 한국어 음성으로 읽는다.
export const vocabSteps = (v, withMeaning) => {
  const isG = v.type === "grammar";
  const head = stripMarkup(isG ? splitTermList(v.term).head : v.term);
  const steps = [{ text: head, lang: isG ? "ko-KR" : "en-US" }];
  if (!isG) steps.push({ text: head, lang: "en-US" });   // 단어는 두 번 읽어 귀에 붙게
  if (withMeaning && v.meaning) {
    steps.push({ text: stripMarkup(v.meaning).replace(/\s*\n+\s*/g, ", "), lang: "ko-KR" });
  }
  return steps;
};

export const vocabListenView = (v) => {
  const isG = v.type === "grammar";
  const ti = vocabTypeInfo(v.type);
  return (
    <>
      <div style={{ fontSize:10.5, fontWeight:800, color:ti.color }}>
        {ti.icon} {ti.label}{v.tag ? ` · ${v.tag}` : ""}
      </div>
      <div style={{ fontSize:19, fontWeight:800, lineHeight:1.4, wordBreak:"break-word" }}>
        <Marked text={isG ? splitTermList(v.term).head : v.term} />
      </div>
      {v.meaning && (
        <div style={{ fontSize:13.5, color:STUDY_ACCENT, fontWeight:700, lineHeight:1.6,
          whiteSpace:"pre-wrap", wordBreak:"break-word" }}><Marked text={v.meaning} /></div>
      )}
    </>
  );
};

function BrowseCard({ rows, idx, setIdx, onClose, onStar, onBump }) {
  const v = rows[idx];
  if (!v) return null;
  const ti = vocabTypeInfo(v.type);
  const isG = v.type === "grammar";
  const canSpeak = speechReady() && !isG;
  const go = (d) => setIdx((i) => (i + d + rows.length) % rows.length);   // 끝에서 처음으로 돌아온다

  return (
    <div style={{ marginTop:11, padding:"13px 14px", borderRadius:13, background:C.surface2,
      border:`1px solid ${tint(ti.color,0.35)}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
        <span style={{ fontSize:10.5, fontWeight:800, color:ti.color }}>{ti.icon} {ti.label}</span>
        {v.tag && <span style={{ fontSize:10, color:C.muted, background:C.surface, borderRadius:999, padding:"2px 8px" }}>{v.tag}</span>}
        <div style={{ flex:1 }} />
        <span style={{ fontSize:11, color:C.muted, fontWeight:700 }}>{idx+1} / {rows.length}</span>
        <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted,
          fontSize:15, cursor:"pointer", padding:"0 2px", lineHeight:1 }}>×</button>
      </div>

      {/* 진행 막대 — 섹션을 어디까지 훑었는지 감이 잡힌다 */}
      <div style={{ height:3, background:C.surface, borderRadius:99, overflow:"hidden", marginBottom:11 }}>
        <div style={{ width:`${((idx+1)/rows.length)*100}%`, height:"100%", background:ti.color, transition:"width .2s" }} />
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:17, fontWeight:800, lineHeight:1.4, wordBreak:"break-word" }}>
          <Marked text={isG ? splitTermList(v.term).head : v.term} />
        </span>
        {posList(v.pos).map(pi=>(
          <span key={pi.k} style={{ fontSize:10, fontWeight:800, color:pi.color,
            background:tint(pi.color,0.14), borderRadius:999, padding:"2px 8px" }}>{pi.short}</span>
        ))}
        {canSpeak && (
          <button onClick={()=>speakWord(stripMarkup(v.term))} title="발음 듣기"
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, padding:2, opacity:0.7 }}>🔊</button>
        )}
      </div>

      <div style={{ marginTop:9 }}>
        {isG ? <GrammarBody v={v} /> : (<>
          {v.meaning && (
            <div style={{ fontSize:14.5, color:STUDY_ACCENT, fontWeight:700, lineHeight:1.65,
              whiteSpace:"pre-wrap", wordBreak:"break-word" }}><Marked text={v.meaning} /></div>
          )}
          {v.note && (
            <div style={{ fontSize:12, color:C.muted, marginTop:7, lineHeight:1.6,
              whiteSpace:"pre-wrap", wordBreak:"break-word" }}><Marked text={v.note} /></div>
          )}
          {v.ex && (
            <div style={{ fontSize:12, color:C.muted, marginTop:8, lineHeight:1.6, fontStyle:"italic",
              paddingLeft:10, borderLeft:`2px solid ${C.line}`, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
              <Marked text={v.ex} />
            </div>
          )}
        </>)}
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:13 }}>
        <button onClick={()=>go(-1)} style={{...ghost, flex:1, fontSize:13, padding:"11px 0"}}>← 이전</button>
        <button onClick={()=>onStar(v.id)} title="별표"
          style={{ background: v.starred?tint("#FFD24B",0.15):C.surface, flexShrink:0,
            border:`1px solid ${v.starred?"#FFD24B":C.line}`, borderRadius:10, padding:"0 12px",
            cursor:"pointer", fontSize:16, alignSelf:"stretch" }}>{v.starred ? "⭐" : "☆"}</button>
        <button onClick={()=>{ onBump(v.id, 1); go(1); }} title="외웠어요"
          style={{ background:tint(TYPES.legs.color,0.14), flexShrink:0, color:TYPES.legs.color,
            border:`1px solid ${tint(TYPES.legs.color,0.4)}`, borderRadius:10, padding:"0 13px",
            cursor:"pointer", fontSize:14, fontWeight:800, alignSelf:"stretch" }}>✓</button>
        <button onClick={()=>go(1)} style={{...primary(ti.color), flex:1, fontSize:13, padding:"11px 0"}}>다음 →</button>
      </div>
    </div>
  );
}

function VocabEditRow({ entry, onSave, onCancel }) {
  const [v, setV] = useState({
    term: entry.term || "",
    meaning: entry.meaning || "",
    pos: entry.pos || "",
    note: entry.note || "",
    ex: entry.ex || "",
    tag: entry.tag || "",
  });
  const eMeaning = useRef(null);
  const eNote = useRef(null);
  return (
    <div style={{ marginTop:9, padding:"12px", background:C.surface2, borderRadius:11 }}>
      <input value={v.term} onChange={(e)=>setV({...v, term:e.target.value})}
        placeholder="단어" style={{...inp, width:"100%", boxSizing:"border-box"}} />
      <AutoArea inputRef={eMeaning} value={v.meaning} onChange={(val)=>setV({...v, meaning:val})}
        placeholder={entry.type==="grammar"?"패턴 — 줄바꿈이나 / 로 여러 개":"뜻 (여러 개면 쉼표로: 주소, 다루다)"}
        style={{ marginTop:6 }} />
      <MarkBar inputRef={eMeaning} value={v.meaning} onChange={(val)=>setV({...v, meaning:val})} />
      {entry.type!=="grammar" && (<>
        <div style={{ fontSize:10, color:C.muted, margin:"9px 0 5px" }}>품사 (여러 개 선택 가능)</div>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {POS_LIST.map((pp)=>(
            <button key={pp.k} onClick={()=>setV({...v, pos: togglePos(v.pos, pp.k)})}
              style={{...chip(hasPos(v.pos, pp.k), pp.color), padding:"5px 10px", fontSize:11}}>{pp.label}</button>
          ))}
        </div>
      </>)}
      <AutoArea inputRef={eNote} value={v.note} onChange={(val)=>setV({...v, note:val})}
        placeholder={entry.type==="grammar"?"해당 동사·표현 (쉼표·/·줄바꿈으로 구분)":"메모 (선택)"}
        style={{ marginTop:8 }} />
      <MarkBar inputRef={eNote} value={v.note} onChange={(val)=>setV({...v, note:val})} />
      <AutoArea value={v.ex} onChange={(val)=>setV({...v, ex:val})}
        placeholder="예문 (선택)" style={{ marginTop:6 }} />
      <input value={v.tag} onChange={(e)=>setV({...v, tag:e.target.value})}
        placeholder="섹션·태그 (선택)" style={{...inp, width:"100%", boxSizing:"border-box", marginTop:6}} />
      <div style={{ display:"flex", gap:7, marginTop:10 }}>
        <button onClick={onCancel} style={{...ghost, flex:1}}>취소</button>
        <button onClick={()=>onSave({
            term: v.term.trim() || entry.term,
            meaning: v.meaning.trim(), pos: v.pos,
            note: v.note.trim(), ex: v.ex.trim(), tag: v.tag.trim(),
          })}
          style={{...primary(STUDY_ACCENT), flex:2}}>저장</button>
      </div>
    </div>
  );
}

function VocabShareSheet({ vocab, onClose }) {
  const [scope, setScope] = useState("all");   // all | weak | star
  const taRef = useRef(null);
  const [msg, setMsg] = useState("");

  const list = (vocab||[]).filter(v =>
    scope==="star" ? v.starred :
    scope==="weak" ? !isMastered(v) : true);

  // "📥 여러 개"가 그대로 읽을 수 있는 형식으로 만든다
  const text = list.map(v => {
    const parts = [v.term];
    if (v.meaning) parts.push(v.meaning);
    if (v.pos) parts.push(v.pos);
    return parts.join(" / ");
  }).join("\n");

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setMsg("복사됐어요. 다른 기기에 붙여넣으세요."); return; } catch(e){}
    try {
      const ta = taRef.current;
      if (ta) { ta.focus(); ta.select();
        setMsg(document.execCommand("copy") ? "복사됐어요. 다른 기기에 붙여넣으세요."
                                            : "아래 글을 길게 눌러 직접 복사해주세요."); }
    } catch(e) { setMsg("아래 글을 길게 눌러 직접 복사해주세요."); }
  };

  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title:"단어장", text }); setMsg("보냈어요."); return; }
    } catch(e) { if (e && e.name === "AbortError") return; }
    copy();
  };

  return (
    <SheetLayer onClose={onClose}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink:0 }}>
          <div style={grip} />
          <div style={{ fontSize:16, fontWeight:800 }}>단어장 옮기기</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:4, marginBottom:12, lineHeight:1.6 }}>
            컴퓨터에서 정리한 단어를 휴대폰으로(또는 반대로) 옮길 때 써요.
            받는 기기에서 <b style={{color:C.text}}>📥 여러 개</b>에 붙여넣으면 되고,
            이미 있는 단어는 알아서 걸러져요.
          </div>
        </div>

        <div style={{ flex:"1 1 auto", minHeight:0, overflowY:"auto", paddingRight:2, overscrollBehavior:"contain" }}>
          <div style={{ display:"flex", gap:5 }}>
            {[["all",`전체 ${(vocab||[]).length}`],
              ["weak",`미숙련 ${(vocab||[]).filter(v=>!isMastered(v)).length}`],
              ["star",`⭐ ${(vocab||[]).filter(v=>v.starred).length}`]].map(([k,label])=>(
              <button key={k} onClick={()=>setScope(k)}
                style={{...chip(scope===k, STUDY_ACCENT), flex:1, textAlign:"center", padding:"8px 0", fontSize:11.5}}>{label}</button>
            ))}
          </div>

          {list.length===0 ? (
            <div style={{ fontSize:12, color:C.muted, marginTop:12, lineHeight:1.6 }}>
              내보낼 단어가 없어요.
            </div>
          ) : (
            <>
              <div style={{ fontSize:11, color:C.muted, margin:"12px 0 6px" }}>{list.length}개</div>
              <textarea ref={taRef} readOnly value={text} rows={8}
                onFocus={(e)=>e.target.select()}
                style={{...inp, width:"100%", boxSizing:"border-box", resize:"none",
                  fontFamily:"monospace", fontSize:11.5, lineHeight:1.5}} />
              <div style={{ display:"flex", gap:7, marginTop:9 }}>
                <button onClick={copy} style={{...ghost, flex:1}}>복사</button>
                <button onClick={share} style={{...primary(STUDY_ACCENT), flex:1}}>보내기</button>
              </div>
              {msg && <div style={{ fontSize:11.5, color:STUDY_ACCENT, marginTop:9, lineHeight:1.55 }}>{msg}</div>}
              <div style={{ fontSize:10.5, color:C.muted, marginTop:10, lineHeight:1.6 }}>
                복사한 뒤 카카오톡 "나에게 보내기"나 메모 앱에 붙여넣어 옮기면 편해요.
                숙련도·별표 같은 학습 기록은 함께 넘어가지 않고, 단어·뜻·품사만 옮겨져요.
              </div>
            </>
          )}
          <div style={{ height:8 }} />
        </div>

        <div style={{ flexShrink:0, padding:"12px 0 calc(14px + env(safe-area-inset-bottom))",
          borderTop:`1px solid ${C.line}`, background:C.surface }}>
          <button onClick={onClose} style={{...ghost, width:"100%"}}>닫기</button>
        </div>
      </div>
    </SheetLayer>
  );
}

// normPos가 실제로 받아들이는 표기들 — 화면 안내와 코드가 어긋나지 않게 여기서 한 번에 관리한다
const POS_HINTS = [
  ["명사",   "n / noun / 명사",             "#5AA9FF"],
  ["동사",   "v / verb / 동사",             "#FF8C42"],
  ["형용사", "adj / a / adjective / 형용사", "#5AD1A0"],
  ["부사",   "adv / ad / adverb / 부사",    "#C9A6FF"],
  ["전치사", "prep / preposition / 전치사",  "#FFB74B"],
  ["접속사", "conj / conjunction / 접속사",  "#FF8FB0"],
];

function VocabBulkSheet({ apiKey, existingTerms, onAdd, onClose }) {
  const [text, setText] = useState("");
  const [type, setType] = useState("word");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState(null); // 미리보기
  const [helpOpen, setHelpOpen] = useState(false);

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
          // AI가 "adj,v"처럼 여러 품사를 줄 수도 있으므로 각각 정규화해 합친다
          pos: r.pos || String(hit.pos||"").split(/[,/]/).map(x=>normPos(x)).filter(Boolean).join(","),
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
            rows={7} placeholder={"comprehensive 포괄적인 adj\nallocate 할당하다 동사\nrevenue 수익 n\nprompt / adj 신속한 / v 재촉하다\naddress 주소, 다루다\nubiquitous"}
            style={{ ...inp, width:"100%", boxSizing:"border-box", marginTop:9, resize:"vertical",
              fontFamily:"inherit", lineHeight:1.6, fontSize:13 }} />

          <div style={{ fontSize:10.5, color:C.muted, marginTop:7, lineHeight:1.55 }}>
            구분자는 띄어쓰기 · 슬래시(/) · 쉼표 · 탭 다 돼요.
          </div>

          {/* 품사를 뭐라고 써야 하는지 몰라서 막히는 일이 많아 표로 보여준다 */}
          <button onClick={()=>setHelpOpen(v=>!v)}
            style={{ background:"none", border:"none", padding:0, marginTop:8, cursor:"pointer",
              color:STUDY_ACCENT, fontSize:11, fontWeight:800 }}>
            품사는 뭐라고 쓰나요? {helpOpen?"▴":"▾"}
          </button>
          {helpOpen && (
            <div style={{ marginTop:8, padding:"11px 12px", background:C.surface2, borderRadius:10 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {POS_HINTS.map(([label, codes, color])=>(
                  <div key={label} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:800, color, width:46, flexShrink:0 }}>{label}</span>
                    <span style={{ fontSize:11, color:C.muted }}>{codes}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:10.5, color:C.muted, marginTop:9, lineHeight:1.6, borderTop:`1px solid ${C.line}`, paddingTop:8 }}>
                한글로 <b style={{color:C.text}}>명사·동사·형용사</b>라고 써도 되고, 대소문자도 상관없어요.<br/>
                한 단어에 품사가 여럿이면 <b style={{color:C.text}}>prompt / adj 신속한 / v 재촉하다</b> 처럼 적으면 둘 다 들어가요.
              </div>
            </div>
          )}

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
                const pl = posList(r.pos);
                const dup = existingTerms.has(r.term.trim().toLowerCase());
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 0", borderBottom:`1px solid ${C.line}` }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                        <span style={{ fontSize:12.5, fontWeight:800 }}>{r.term}</span>
                        {pl.map(p=>(<span key={p.k} style={{ fontSize:9, fontWeight:800, color:p.color, background:tint(p.color,0.14), borderRadius:999, padding:"1px 6px", marginRight:3 }}>{p.short}</span>))}
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
  const [draft, setDraft] = useState({ type:"word", term:"", meaning:"", note:"", ex:"", tag:"", pos:"" });
  const meaningRef = useRef(null);
  const noteRef = useRef(null);
  const [filterMode, setFilterMode] = useState("all"); // all | star | weak | wrong
  const [tagFilter, setTagFilter] = useState("");      // 교재 섹션(태그)으로 좁혀 보기
  const [bulkOpen, setBulkOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [dupMsg, setDupMsg] = useState("");
  const [quizOpen, setQuizOpen] = useState(false);

  const save = (list, undoLabel)=> mutate((prev)=>({ ...prev, vocab:list }), undoLabel);
  const add = () => {
    const t = draft.term.trim();
    if (!t) return;
    // 이미 있는 단어면 넣지 않고 알려준다 (조용히 무시하면 왜 안 들어갔는지 알 수 없다)
    const dup = vocab.find(v=>String(v.term).trim().toLowerCase()===t.toLowerCase());
    if (dup) { setDupMsg(`"${dup.term}" 은 이미 있어요`); setTimeout(()=>setDupMsg(""), 2500); return; }
    setDupMsg("");
    save([...vocab, { id:uid(), type:draft.type, term:t, meaning:draft.meaning.trim(), ex:draft.ex.trim(),
      note:draft.note.trim(), tag:draft.tag.trim(), pos:draft.pos, level:0, reviewCount:0, wrong:0, starred:false, lastReview:null, created:todayKey() }]);
    setDraft({ type:draft.type, term:"", meaning:"", note:"", ex:"", tag:draft.tag, pos:"" });
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
  // 저장한 단어의 뜻·품사·메모를 나중에 고칠 수 있게 한다 (학습 기록은 그대로 유지)
  const saveEdit = (id, patch) => save(vocab.map(v=> v.id===id ? { ...v, ...patch } : v));

  const byTab = tab==="all" ? vocab : vocab.filter(v=>v.type===tab);
  const searched = q.trim()
    ? byTab.filter(v=> stripMarkup(v.term+v.meaning+(v.note||"")+(v.ex||"")+(v.tag||"")).toLowerCase().includes(q.trim().toLowerCase()))
    : byTab;
  const applyFilter = (list) =>
    filterMode==="star"  ? list.filter(v=>v.starred) :
    filterMode==="weak"  ? list.filter(v=>!isMastered(v)) :
    filterMode==="wrong" ? list.filter(isOftenWrong) :
    filterMode==="poly"  ? list.filter(isPolysemous) : list;
  const applyTag = (list)=> tagFilter ? list.filter(v=>String(v.tag||"").trim()===tagFilter) : list;
  const listed = applyTag(applyFilter(searched)).slice()
    .sort((a,b)=> (b.starred?1:0)-(a.starred?1:0) || reviewScore(b)-reviewScore(a));

  // 교재 섹션 단위로 공부하는 흐름에 맞춰, 태그별로 묶어 볼 수 있게 한다.
  // 섹션 이름 앞의 숫자를 뽑아 자연 순서로 정렬해야 Section 2가 Section 10보다 앞에 온다.
  // 기본으로 묶어서 보여준다. 눌러야만 섹션이 보이면 있는 줄도 모르고 지나친다.
  const [grouped, setGrouped] = useState(true);
  const [browseOn, setBrowseOn] = useState(false);
  const [listenOn, setListenOn] = useState(false);
  const [bi, setBi] = useState(0);
  const secNum = (t) => { const m = String(t||"").match(/\d+/); return m ? Number(m[0]) : 9999; };
  // 필터·검색이 바뀌면 보고 있던 위치가 범위를 벗어난다. 처음으로 되돌린다.
  useEffect(()=>{ setBi(0); }, [tab, filterMode, tagFilter, q]);
  const groupsOf = (rows) => {
    const map = new Map();
    rows.forEach((v)=>{ const k = (v.tag||"").trim(); if(!map.has(k)) map.set(k, []); map.get(k).push(v); });
    return [...map.entries()].sort((a,b)=> secNum(a[0])-secNum(b[0]) || String(a[0]).localeCompare(String(b[0])));
  };
  const starCount = vocab.filter(v=>v.starred).length;
  const wrongCount = vocab.filter(isOftenWrong).length;
  const polyCount = vocab.filter(isPolysemous).length;

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

  // ===== 동기부여 지표 (전부 기록에서 계산) =====
  // 복습한 날짜 집합으로 오늘부터 거꾸로 연속일수를 센다
  const reviewDays = new Set(vocab.map(v=>v.lastReview).filter(Boolean));
  const reviewStreak = (()=>{
    let n = 0;
    for (let i=0; i<400; i++) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const kk = keyOf(d.getFullYear(), d.getMonth(), d.getDate());
      if (reviewDays.has(kk)) n++;
      else if (i>0) break;      // 오늘 아직 안 했어도 어제까지의 연속은 인정
    }
    return n;
  })();
  // 이번 주 / 지난주에 복습한 단어 수 (주는 일요일 시작)
  const weekKeys = (offset)=>{
    const t = new Date(); t.setHours(0,0,0,0);
    const sun = new Date(t); sun.setDate(t.getDate() - t.getDay() - offset*7);
    return [...Array(7)].map((_,i)=>{ const d=new Date(sun); d.setDate(sun.getDate()+i);
      return keyOf(d.getFullYear(), d.getMonth(), d.getDate()); });
  };
  const thisWeekSet = new Set(weekKeys(0));
  const lastWeekSet = new Set(weekKeys(1));
  const thisWeekCnt = vocab.filter(v=>v.lastReview && thisWeekSet.has(v.lastReview)).length;
  const lastWeekCnt = vocab.filter(v=>v.lastReview && lastWeekSet.has(v.lastReview)).length;
  const weekDiff = thisWeekCnt - lastWeekCnt;
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

          {/* 동기부여 — 꾸준함과 지난주 대비 성과를 보여준다 */}
          {(reviewStreak>=2 || thisWeekCnt>0) && (
            <div style={{ display:"flex", gap:6, marginTop:11 }}>
              {reviewStreak>=2 && (
                <div style={{ flex:1, background:tint("#FF8C42",0.12), border:`1px solid ${tint("#FF8C42",0.4)}`,
                  borderRadius:10, padding:"9px 8px", textAlign:"center" }}>
                  <div style={{ fontSize:15, fontWeight:800, color:"#FF8C42" }}>🔥 {reviewStreak}일</div>
                  <div style={{ fontSize:9.5, color:C.muted, marginTop:1 }}>연속 복습</div>
                </div>
              )}
              <div style={{ flex:1, background:C.surface2, borderRadius:10, padding:"9px 8px", textAlign:"center" }}>
                <div style={{ fontSize:15, fontWeight:800, color:STUDY_ACCENT }}>{thisWeekCnt}개</div>
                <div style={{ fontSize:9.5, color:C.muted, marginTop:1 }}>이번 주 복습</div>
              </div>
              {lastWeekCnt>0 && (
                <div style={{ flex:1, background:C.surface2, borderRadius:10, padding:"9px 8px", textAlign:"center" }}>
                  <div style={{ fontSize:15, fontWeight:800,
                    color: weekDiff>0?TYPES.legs.color : weekDiff<0?C.danger:C.muted }}>
                    {weekDiff>0?"+":""}{weekDiff}
                  </div>
                  <div style={{ fontSize:9.5, color:C.muted, marginTop:1 }}>지난주 대비</div>
                </div>
              )}
            </div>
          )}
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
              {posList(cur.pos).length?` · ${posList(cur.pos).map(p=>p.short).join(" ")}`:""}{cur.tag?` · ${cur.tag}`:""}
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
              <div style={{ fontSize:15, color:STUDY_ACCENT, fontWeight:700, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                {cur.meaning ? <Marked text={cur.meaning} /> : "(뜻 없음)"}
              </div>
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
                <div key={t.tag} onClick={()=>{ setTagFilter(t.tag===tagFilter?"":t.tag); setTab("all"); setQ(""); }}
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
            <button onClick={()=>setShareOpen(true)} style={{ background:"none", border:"none", color:"#6BC5F0",
              fontSize:12, fontWeight:800, cursor:"pointer", padding:0 }}>📤 옮기기</button>
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
            <AutoArea inputRef={meaningRef} value={draft.meaning} onChange={(val)=>setDraft({...draft, meaning:val})}
              placeholder={draft.type==="grammar"?"패턴 — 줄바꿈이나 / 로 여러 개\n예) + 목 + 형\n     S + V + 명":"뜻"}
              style={{ marginTop:6 }} />
            <MarkBar inputRef={meaningRef} value={draft.meaning}
              onChange={(val)=>setDraft({...draft, meaning:val})} />
            {draft.type!=="grammar" && (
              <div style={{ display:"flex", gap:4, marginTop:7, flexWrap:"wrap" }}>
                {POS_LIST.map((pp)=>(
                  <button key={pp.k} onClick={()=>setDraft({...draft, pos: togglePos(draft.pos, pp.k)})}
                    style={{...chip(hasPos(draft.pos, pp.k), pp.color), padding:"5px 10px", fontSize:11}}>{pp.label}</button>
                ))}
              </div>
            )}
            <AutoArea inputRef={noteRef} value={draft.note} onChange={(val)=>setDraft({...draft, note:val})}
              placeholder={draft.type==="grammar"?"해당 동사·표현 (쉼표·/·줄바꿈으로 구분)":"메모 (선택)"}
              style={{ marginTop:8 }} />
            <MarkBar inputRef={noteRef} value={draft.note}
              onChange={(val)=>setDraft({...draft, note:val})} />
            <AutoArea value={draft.ex} onChange={(val)=>setDraft({...draft, ex:val})}
              placeholder="예문 (선택)" style={{ marginTop:6 }} />
            <input value={draft.tag} onChange={(e)=>setDraft({...draft, tag:e.target.value})}
              placeholder="섹션·태그 (선택 · 예: Section 10 도치)" style={{...inp, width:"100%", boxSizing:"border-box", marginTop:6}} />
            <div style={{ fontSize:10, color:C.muted, marginTop:8, lineHeight:1.65 }}>
              {draft.type==="grammar" && <>제목 끝 괄호에 목록을 적으면 따로 떼어 보여줘요 — 2형식 동사(be, become, seem)<br/></>}
              중요한 부분은 글자를 선택하고 <b style={{color:STUDY_ACCENT}}>강조</b>·<b style={{textDecoration:"underline"}}>밑줄</b>·<b style={{color:C.danger}}>주의</b> 버튼을 누르세요
            </div>
            <button onClick={add} disabled={!draft.term.trim()}
              style={{...primary(STUDY_ACCENT), width:"100%", marginTop:9, opacity:draft.term.trim()?1:0.45}}>추가</button>
            {dupMsg && (
              <div style={{ fontSize:11.5, color:C.amber, fontWeight:700, marginTop:7 }}>{dupMsg}</div>
            )}
          </div>
        )}

        {vocab.length>0 && (<>
          <div style={{ display:"flex", gap:5, marginTop:11, overflowX:"auto" }}>
            {[["all","전체"], ...VOCAB_TYPES.map(t=>[t.k, `${t.icon} ${t.label}`])].map(([k,label])=>(
              <button key={k} onClick={()=>setTab(k)}
                style={{...chip(tab===k, k==="all"?STUDY_ACCENT:vocabTypeInfo(k).color), padding:"5px 11px", fontSize:11.5, whiteSpace:"nowrap", flexShrink:0}}>{label}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:6, marginTop:8 }}>
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="검색"
              style={{...inp, flex:1, minWidth:0, boxSizing:"border-box"}} />
            {/* 교재 섹션 단위로 훑을 때를 위한 묶어보기 */}
            <button onClick={()=>setGrouped(g=>!g)} title="섹션별로 묶어 보기"
              style={{ flexShrink:0, padding:"0 12px", borderRadius:9, cursor:"pointer", fontSize:11.5, fontWeight:800,
                border:`1.5px solid ${grouped?STUDY_ACCENT:C.line}`,
                background: grouped?tint(STUDY_ACCENT,0.15):C.surface2,
                color: grouped?STUDY_ACCENT:C.muted }}>
              {grouped?"묶음 ✓":"섹션별"}
            </button>
          </div>
          <div style={{ display:"flex", gap:5, marginTop:8, overflowX:"auto" }}>
            {[["all","전체",STUDY_ACCENT,vocab.length],
              ["star","⭐ 별표","#FFD24B",starCount],
              ["wrong","자주 틀림",C.danger,wrongCount],
              ["weak","미숙련",C.amber,vocab.filter(v=>!isMastered(v)).length],
              ["poly","🔀 여러 뜻","#C9A6FF",polyCount]].map(([k,label,col,n])=>(
              <button key={k} onClick={()=>setFilterMode(k)}
                style={{...chip(filterMode===k, col), padding:"5px 11px", fontSize:11.5, whiteSpace:"nowrap", flexShrink:0}}>
                {label}{n>0?` ${n}`:""}
              </button>
            ))}
          </div>
          {/* 하나씩 넘겨 보기 · 듣기 — 지금 걸린 필터 범위를 그대로 물려받는다 */}
          {listed.length>0 && (browseOn ? (
            <BrowseCard rows={listed} idx={Math.min(bi, listed.length-1)} setIdx={setBi}
              onClose={()=>setBrowseOn(false)} onStar={toggleStar} onBump={bump} />
          ) : listenOn ? (
            <ListenPlayer rows={listed} accent={STUDY_ACCENT} onClose={()=>setListenOn(false)}
              getSteps={vocabSteps} renderItem={vocabListenView} />
          ) : (
            <div style={{ display:"flex", gap:7, marginTop:9 }}>
              <button onClick={()=>{ setBi(0); setBrowseOn(true); }}
                style={{ flex:1, padding:"11px 0", borderRadius:11, cursor:"pointer",
                  background:tint(STUDY_ACCENT,0.1), border:`1px solid ${tint(STUDY_ACCENT,0.35)}`,
                  color:STUDY_ACCENT, fontSize:12.5, fontWeight:800 }}>
                📖 하나씩 보기
                <span style={{ fontSize:10.5, fontWeight:600, opacity:0.75, marginLeft:6 }}>{listed.length}</span>
              </button>
              {speechReady() && (
                <button onClick={()=>{ primeSpeech(); setListenOn(true); }}
                  style={{ flex:1, padding:"11px 0", borderRadius:11, cursor:"pointer",
                    background:tint("#8FD3FF",0.1), border:`1px solid ${tint("#8FD3FF",0.35)}`,
                    color:"#8FD3FF", fontSize:12.5, fontWeight:800 }}>
                  🎧 듣기 모드
                </button>
              )}
            </div>
          ))}

          {/* 섹션(태그)으로 좁혀 본 상태를 눈에 보이게 — 왜 목록이 짧은지 알 수 있게 */}
          {tagFilter && (
            <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:8, padding:"8px 11px",
              background:tint(STUDY_ACCENT,0.1), border:`1px solid ${tint(STUDY_ACCENT,0.35)}`, borderRadius:10 }}>
              <span style={{ fontSize:11, color:C.muted, fontWeight:700, flexShrink:0 }}>섹션</span>
              <span style={{ flex:1, minWidth:0, fontSize:11.5, fontWeight:800, color:STUDY_ACCENT,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{tagFilter}</span>
              <button onClick={()=>setTagFilter("")} style={{ background:"none", border:"none",
                color:C.muted, fontSize:11, fontWeight:700, cursor:"pointer", padding:"0 2px", flexShrink:0 }}>해제</button>
            </div>
          )}

          <div style={{ marginTop:11 }}>
            {listed.length===0 ? (
              <div style={{ fontSize:12, color:C.muted, padding:"12px 0", textAlign:"center" }}>해당하는 항목이 없어요</div>
            ) : (grouped ? groupsOf(listed.slice(0,60)) : [["", listed.slice(0,60)]]).map(([sec, rows])=>(
              <div key={sec||"__all"}>
                {grouped && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, margin:"14px 0 2px",
                    paddingBottom:5, borderBottom:`2px solid ${tint(STUDY_ACCENT,0.3)}` }}>
                    <span style={{ fontSize:12, fontWeight:800, color:STUDY_ACCENT }}>{sec || "섹션 없음"}</span>
                    <span style={{ fontSize:10.5, color:C.muted }}>{rows.length}개</span>
                  </div>
                )}
                {rows.map((v)=>{
              const ti = vocabTypeInfo(v.type);
              const lv = num(v.level);
              const isG = v.type === "grammar";
              return (
                <div key={v.id} style={{ padding:"11px 0", borderBottom:`1px solid ${C.line}` }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize: isG?14:13.5, fontWeight:800, wordBreak:"break-word" }}>
                        <Marked text={isG ? splitTermList(v.term).head : v.term} />
                      </span>
                      <span style={{ fontSize:9.5, fontWeight:800, color:ti.color, background:tint(ti.color,0.14),
                        borderRadius:999, padding:"1px 7px" }}>{ti.label}</span>
                      {posList(v.pos).map(pi=>(
                        <span key={pi.k} style={{ fontSize:9.5, fontWeight:800, color:pi.color,
                          background:tint(pi.color,0.14), borderRadius:999, padding:"1px 7px" }}>{pi.short}</span>
                      ))}
                      {isMastered(v) && <span style={{ fontSize:9.5, fontWeight:800, color:TYPES.legs.color }}>✓ 외움</span>}
                      {isDueToday(v) && <span style={{ fontSize:9, fontWeight:800, color:STUDY_ACCENT,
                        background:tint(STUDY_ACCENT,0.14), borderRadius:999, padding:"1px 6px" }}>오늘</span>}
                      {v.type!=="grammar" && (
                        <button onClick={(e)=>{ e.stopPropagation(); speakWord(stripMarkup(v.term)); }} title="발음"
                          style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, padding:0, opacity:0.55 }}>🔊</button>
                      )}
                      {isPolysemous(v) && !isG && (
                        <span style={{ fontSize:9, fontWeight:800, color:"#C9A6FF",
                          background:tint("#C9A6FF",0.14), borderRadius:999, padding:"1px 6px" }}>
                          뜻 {Math.max(meaningCount(v), posList(v.pos).length)}개
                        </span>
                      )}
                      {isOftenWrong(v) && <span style={{ fontSize:9, fontWeight:800, color:C.danger,
                        background:tint(C.danger,0.13), borderRadius:999, padding:"1px 6px" }}>{num(v.wrong)}번 틀림</span>}
                    </div>
                    {isG ? <div style={{ marginTop:8 }}><GrammarBody v={v} /></div> : (<>
                      {v.meaning && <div style={{ fontSize:12, color:C.muted, marginTop:3, lineHeight:1.55,
                        whiteSpace:"pre-wrap", wordBreak:"break-word", overflowWrap:"anywhere" }}><Marked text={v.meaning} /></div>}
                      {v.note && <div style={{ fontSize:11, color:C.muted, marginTop:3, opacity:0.8, lineHeight:1.55,
                        whiteSpace:"pre-wrap", wordBreak:"break-word", overflowWrap:"anywhere" }}><Marked text={v.note} /></div>}
                      {v.ex && <div style={{ fontSize:11, color:C.muted, marginTop:5, lineHeight:1.55, fontStyle:"italic",
                        paddingLeft:9, borderLeft:`2px solid ${C.line}`, whiteSpace:"pre-wrap",
                        wordBreak:"break-word", overflowWrap:"anywhere" }}><Marked text={v.ex} /></div>}
                    </>)}
                    {/* 태그·숙련도와 버튼을 한 줄에 둔다. 세로로 쌓인 버튼 기둥이
                        본문 폭을 좁혀서 긴 문법 내용이 더 답답해 보였다. */}
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:9, flexWrap:"wrap" }}>
                      {v.tag && <span style={{ fontSize:9.5, color:C.muted, background:C.surface2, borderRadius:999, padding:"2px 8px" }}>{v.tag}</span>}
                      <div style={{ display:"flex", gap:2.5 }}>
                        {[0,1,2,3,4].map(i=>(
                          <span key={i} style={{ width:5, height:5, borderRadius:"50%",
                            background: i<lv ? STUDY_ACCENT : C.line }} />
                        ))}
                      </div>
                      <div style={{ flex:1 }} />
                      <button onClick={()=>toggleStar(v.id)} title={v.starred?"별표 해제":"별표"}
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:15, padding:"2px 3px",
                          opacity: v.starred?1:0.3, lineHeight:1 }}>
                        {v.starred ? "⭐" : "☆"}
                      </button>
                      <button onClick={()=>setEditId(editId===v.id?null:v.id)} title="수정"
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, padding:"2px 3px", opacity:0.7 }}>✏️</button>
                      <button onClick={()=>bump(v.id, 1)} title="외웠어요"
                        style={{ background:"none", border:`1px solid ${tint(TYPES.legs.color,0.4)}`, color:TYPES.legs.color,
                          borderRadius:7, padding:"3px 9px", cursor:"pointer", fontSize:11, lineHeight:1.4 }}>✓</button>
                      <button onClick={()=>remove(v.id)} style={xBtn}>×</button>
                    </div>
                  </div>
                  {editId===v.id && (
                    <VocabEditRow entry={v} onSave={(patch)=>{ saveEdit(v.id, patch); setEditId(null); }}
                      onCancel={()=>setEditId(null)} />
                  )}
                </div>
              );
                })}
              </div>
            ))}
          </div>
          {listed.length>60 && (
            <div style={{ fontSize:10.5, color:C.muted, marginTop:9, textAlign:"center" }}>
              60개까지 표시 중 · 검색으로 좁혀보세요
            </div>
          )}
        </>)}
      </Card>

      {shareOpen && <VocabShareSheet vocab={vocab} onClose={()=>setShareOpen(false)} />}
      {bulkOpen && <VocabBulkSheet apiKey={apiKey} existingTerms={existingTerms}
        onAdd={addMany} onClose={()=>setBulkOpen(false)} />}
      {quizOpen && <VocabQuiz vocab={vocab} onAnswer={bump} onStar={toggleStar} onClose={()=>setQuizOpen(false)} />}
    </div>
  );
}

// ================= 몸 =================
