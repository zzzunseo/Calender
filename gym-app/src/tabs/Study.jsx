import { useState, useRef, useEffect } from "react";
import { TYPES, VOCAB_TYPES, vocabTypeInfo, POS_LIST, posInfo, MASTER_LEVEL, isMastered, isOftenWrong, isDueToday, dueList, speakWord, speechReady, primeSpeech, ListenPlayer, stripMarkup, hasMarkup, Marked, wrapSelection, splitTermList, reviewScore, STUDY_ACCENT, C, todayKey, uid, tint, num, fmtMin, last7, LineChart, Bars7, Card, Row, SheetLayer, lbl, inp, primary, ghost, stepBtn, xBtn, chip, sheet, grip, callClaudeAPI, posList, hasPos, togglePos, keyOf } from "../shared.jsx";
import { parseVocabLines, isPolysemous, meaningCount, splitTokens, patternLines,
  TOEIC_PARTS, partInfo, DEFAULT_SUBJECTS, colorForSubject } from "../study/vocabLogic.js";
import { StudyDash } from "../study/StudyDash.jsx";
import { StudyLog } from "../study/StudyLog.jsx";
import { VocabQuiz } from "../study/VocabQuiz.jsx";
import { AutoArea, MarkBar, GrammarBody, BrowseCard, VocabEditRow,
  vocabSteps, vocabListenView } from "../study/VocabUI.jsx";
import { VocabShareSheet, VocabBulkSheet } from "../study/VocabSheets.jsx";

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


function StudyVocab({ data, mutate, apiKey }) {
  const vocab = data.vocab || [];
  const [tab, setTab] = useState("all");        // all | word | idiom | grammar
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [reviewOn, setReviewOn] = useState(false);
  const [draft, setDraft] = useState({ type:"word", term:"", meaning:"", note:"", ex:"", tag:"", pos:"" });
  const meaningRef = useRef(null);
  const noteRef = useRef(null);
  const quickRef = useRef(null);
  const [quick, setQuick] = useState("");
  const [quickType, setQuickType] = useState("word");
  const [quickMsg, setQuickMsg] = useState("");
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
  // 한 줄 빠른 추가. 붙여넣기와 똑같은 파서를 쓰므로 "allocate 할당하다", "adhere v 지키다",
  // "in charge of - ~을 담당하는" 같은 형태가 전부 그대로 통한다.
  const addQuick = () => {
    const line = quick.trim();
    if (!line) return;
    const parsed = parseVocabLines(line)[0];
    if (!parsed || !parsed.term) return;
    const key = parsed.term.toLowerCase();
    if (vocab.some(v=>String(v.term).trim().toLowerCase()===key)) {
      setQuickMsg(`"${parsed.term}" 은 이미 있어요`);
      setTimeout(()=>setQuickMsg(""), 2500);
      return;
    }
    save([...vocab, { id:uid(), type:quickType, term:parsed.term, meaning:parsed.meaning || "",
      ex:"", note:"", tag:draft.tag.trim(), pos:parsed.pos || "", level:0, reviewCount:0, wrong:0,
      starred:false, lastReview:null, created:todayKey() }]);
    setQuick("");
    setQuickMsg(`"${parsed.term}" 추가됨`);
    setTimeout(()=>setQuickMsg(""), 1800);
    // 칸을 비우고 포커스를 유지해 다음 단어를 바로 이어 칠 수 있게 한다
    requestAnimationFrame(()=>{ try { quickRef.current && quickRef.current.focus(); } catch(e) { /* 무시 */ } });
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
  // 묶어 보는 기준. 기본은 섹션 — 눌러야만 보이면 있는 줄도 모르고 지나친다.
  const [groupBy, setGroupBy] = useState("tag");   // tag | pos | syn | none
  const [browseOn, setBrowseOn] = useState(false);
  const [listenOn, setListenOn] = useState(false);
  const [bi, setBi] = useState(0);
  const secNum = (t) => { const m = String(t||"").match(/\d+/); return m ? Number(m[0]) : 9999; };

  // 뜻을 쪼개 "같은 뜻을 가진 단어"를 찾는 데 쓴다.
  // 표시 기호를 걷어내고 쉼표·줄바꿈으로 나눈 뒤, 한 글자짜리는 잡음이라 버린다.
  const meaningTokens = (v) => stripMarkup(v.meaning || "")
    .split(/[,·\n]/).map(x=>x.trim()).filter(x=>x.length >= 2);

  // 한 항목이 여러 묶음에 들어갈 수 있다(품사 2개, 뜻 2개). 모아보기가 목적이라 중복을 허용한다.
  // 그룹은 {key, label, rows, color}로 다룬다.
  // 품사마다 고유 색이 있는데 예전엔 헤더가 전부 같은 색이라, 스크롤하면
  // 지금 보고 있는 게 명사 구간인지 동사 구간인지 구별이 안 됐다.
  const groupsOf = (rows) => {
    if (groupBy === "pos") {
      const multi = rows.filter(v => posList(v.pos).length >= 2);
      const byPos = POS_LIST
        .map(pi => ({ key:pi.k, label:`${pi.label} (${pi.short})`, color:pi.color,
                      rows: rows.filter(v => hasPos(v.pos, pi.k)) }))
        .filter(g => g.rows.length);
      const none = rows.filter(v => !posList(v.pos).length);
      return [
        ...(multi.length ? [{ key:"multi", label:"여러 품사", color:"#E08CFF", rows:multi }] : []),
        ...byPos,
        ...(none.length ? [{ key:"none", label:"품사 미지정", color:C.muted, rows:none }] : []),
      ];
    }

    if (groupBy === "syn") {
      const map = new Map();
      rows.forEach((v)=> meaningTokens(v).forEach((tk)=>{
        if (!map.has(tk)) map.set(tk, []);
        map.get(tk).push(v);
      }));
      // 혼자뿐인 뜻은 묶음이 아니다
      const groups = [...map.entries()].filter(([, r]) => r.length >= 2)
        .sort((a,b)=> b[1].length - a[1].length || a[0].localeCompare(b[0]));
      const grouped = new Set(groups.flatMap(([, r]) => r.map(v=>v.id)));
      const rest = rows.filter(v => !grouped.has(v.id));
      return [
        ...groups.map(([k, r])=> ({ key:`syn-${k}`, label:`"${k}"`, color:STUDY_ACCENT, rows:r })),
        ...(rest.length ? [{ key:"syn-rest", label:"같은 뜻 없음", color:C.muted, rows:rest }] : []),
      ];
    }

    // 섹션(태그) — 앞의 숫자를 뽑아 자연 순서로. 안 그러면 Section 10이 Section 2보다 앞에 온다.
    const map = new Map();
    rows.forEach((v)=>{ const k=(v.tag||"").trim(); if(!map.has(k)) map.set(k,[]); map.get(k).push(v); });
    return [...map.entries()]
      .sort((a,b)=> secNum(a[0])-secNum(b[0]) || String(a[0]).localeCompare(String(b[0])))
      .map(([k, r])=> ({ key:`tag-${k||"none"}`, label:k || "섹션 없음", color:STUDY_ACCENT, rows:r }));
  };
  // 필터·검색이 바뀌면 보고 있던 위치가 범위를 벗어난다. 처음으로 되돌린다.
  useEffect(()=>{ setBi(0); }, [tab, filterMode, tagFilter, q]);

  // 한 번에 그리는 개수. 예전엔 60개로 잘라놓고 "검색으로 좁혀보세요"가 끝이라,
  // 섹션별로 묶어 보면 뒤쪽 섹션은 아예 존재조차 안 보였다.
  const PAGE = 60;
  const [limit, setLimit] = useState(PAGE);
  useEffect(()=>{ setLimit(PAGE); }, [tab, filterMode, tagFilter, q, groupBy]);
  const shown = listed.slice(0, limit);

  // 그룹 접기 — "따로따로 보고 싶다"는 요구는 결국 지금 안 볼 그룹을 치우는 일이다.
  const [folded, setFolded] = useState([]);
  const toggleFold = (k) => setFolded((f)=> f.includes(k) ? f.filter(x=>x!==k) : [...f, k]);
  // 품사 하나만 골라 보기. null이면 전부.
  const [onlyPos, setOnlyPos] = useState(null);
  useEffect(()=>{ setFolded([]); setOnlyPos(null); }, [groupBy, tab, filterMode, tagFilter, q]);

  const allGroups = groupBy !== "none"
    ? groupsOf(shown)
    : [{ key:"__all", label:"", color:STUDY_ACCENT, rows:shown }];
  const visibleGroups = (groupBy === "pos" && onlyPos)
    ? allGroups.filter(g => g.key === onlyPos)
    : allGroups;
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


        {/* 한 줄 빠른 추가 —
            제대로 된 폼은 종류·품사·태그까지 고르느라 단어 하나 넣는 데도 손이 많이 간다.
            대부분은 "단어 뜻" 한 줄이면 끝이라, 붙여넣기 파서를 그대로 재사용해
            엔터만 치면 바로 들어가고 칸이 비워져 다음 단어를 이어 칠 수 있게 했다. */}
        {!addOpen && (
          <div style={{ marginTop:11 }}>
            <div style={{ display:"flex", gap:6 }}>
              <input ref={quickRef} value={quick} onChange={(e)=>setQuick(e.target.value)}
                onKeyDown={(e)=>{ if (e.key === "Enter") { e.preventDefault(); addQuick(); } }}
                placeholder="빠른 추가 — 예: allocate 할당하다"
                style={{...inp, flex:1, minWidth:0, boxSizing:"border-box"}} />
              <button onClick={addQuick} disabled={!quick.trim()}
                style={{...primary(STUDY_ACCENT), flexShrink:0, padding:"0 16px", opacity: quick.trim()?1:0.45}}>
                +
              </button>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:6, flexWrap:"wrap" }}>
              {VOCAB_TYPES.map((t)=>(
                <button key={t.k} onClick={()=>setQuickType(t.k)}
                  style={{...chip(quickType===t.k, t.color), padding:"4px 9px", fontSize:10.5}}>
                  {t.icon} {t.label}
                </button>
              ))}
              {draft.tag && (
                <span style={{ fontSize:10, color:C.muted }}>태그: {draft.tag}</span>
              )}
              {quickMsg && <span style={{ fontSize:10.5, color:TYPES.legs.color, fontWeight:700 }}>{quickMsg}</span>}
            </div>
          </div>
        )}

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
              placeholder={draft.type==="grammar"?"패턴 — 줄바꿈으로 여러 개\n예) + 목 + 형\n     S + V + 명":"뜻"}
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
              placeholder={draft.type==="grammar"?"해당 동사·표현 (쉼표나 줄바꿈으로 구분)":"메모 (선택)"}
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
          </div>

          {/* 무엇을 기준으로 묶어 볼지 — 같은 품사끼리, 같은 뜻끼리 모아 보면 헷갈리는 걸 잡기 쉽다 */}
          <div style={{ display:"flex", gap:5, marginTop:7 }}>
            {[["tag","📂 섹션"],["pos","🏷 품사"],["syn","🔗 같은 뜻"],["none","목록"]].map(([k,label])=>(
              <button key={k} onClick={()=>setGroupBy(k)}
                style={{ flex:1, padding:"7px 0", borderRadius:9, cursor:"pointer", fontSize:11, fontWeight:800,
                  border:`1.5px solid ${groupBy===k?STUDY_ACCENT:C.line}`,
                  background: groupBy===k?tint(STUDY_ACCENT,0.15):C.surface2,
                  color: groupBy===k?STUDY_ACCENT:C.muted }}>{label}</button>
            ))}
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
          {/* 품사 하나만 골라 보기 — 한꺼번에 보는 것과 따로 보는 것을 한 줄로 전환한다 */}
          {groupBy === "pos" && allGroups.length > 1 && (
            <div style={{ display:"flex", gap:5, marginTop:7, flexWrap:"wrap" }}>
              <button onClick={()=>setOnlyPos(null)}
                style={{ ...chip(!onlyPos, STUDY_ACCENT), padding:"5px 11px", fontSize:11 }}>
                전체
              </button>
              {allGroups.map((g)=>(
                <button key={g.key} onClick={()=>setOnlyPos(onlyPos===g.key ? null : g.key)}
                  style={{ ...chip(onlyPos===g.key, g.color), padding:"5px 11px", fontSize:11,
                    display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:g.color }} />
                  {g.label.replace(/\s*\(.*\)$/, "")}
                  <span style={{ opacity:0.65, fontWeight:600 }}>{g.rows.length}</span>
                </button>
              ))}
            </div>
          )}

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
            ) : visibleGroups.map((g)=>(
              <div key={g.key}>
                {groupBy !== "none" && (
                  <button onClick={()=>toggleFold(g.key)}
                    style={{ display:"flex", alignItems:"center", gap:8, width:"100%",
                      margin:"16px 0 2px", padding:"0 0 6px", cursor:"pointer",
                      background:"none", border:"none", borderBottom:`2px solid ${tint(g.color,0.45)}`,
                      textAlign:"left" }}>
                    {/* 품사마다 색 점을 찍어 스크롤 중에도 어느 구간인지 바로 보이게 한다 */}
                    <span style={{ width:9, height:9, borderRadius:"50%", background:g.color, flexShrink:0 }} />
                    <span style={{ fontSize:13, fontWeight:800, color:g.color }}>{g.label}</span>
                    <span style={{ fontSize:10.5, fontWeight:700, color:g.color, opacity:0.75,
                      background:tint(g.color,0.14), borderRadius:999, padding:"2px 8px" }}>{g.rows.length}</span>
                    <div style={{ flex:1 }} />
                    <span style={{ fontSize:11, color:C.muted }}>{folded.includes(g.key) ? "▸ 펼치기" : "▾"}</span>
                  </button>
                )}
                {(folded.includes(g.key) ? [] : g.rows).map((v)=>{
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
                      {/* 품사 배지 — 테두리를 넣어 다른 배지(종류·오늘)와 확실히 구분되게 한다.
                          품사가 2개 이상이면 앞에 표시를 붙여 한눈에 알아보게 한다. */}
                      {posList(v.pos).length >= 2 && (
                        <span style={{ fontSize:9, fontWeight:800, color:"#E08CFF",
                          background:tint("#E08CFF",0.16), border:`1px solid ${tint("#E08CFF",0.45)}`,
                          borderRadius:999, padding:"1px 6px" }}>다품사</span>
                      )}
                      {posList(v.pos).map(pi=>(
                        <span key={pi.k} style={{ fontSize:10, fontWeight:800, color:pi.color,
                          background:tint(pi.color,0.16), border:`1px solid ${tint(pi.color,0.4)}`,
                          borderRadius:6, padding:"1px 7px" }}>{pi.short}</span>
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
                      {/* 아이콘 버튼들이 13~15px로 작고 삭제 버튼과 붙어 있어 오작동이 나기 쉬웠다.
                          글리프 크기는 그대로 두고 누를 수 있는 면적만 34px로 넓힌다. */}
                      <button onClick={()=>toggleStar(v.id)} title={v.starred?"별표 해제":"별표"}
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:15,
                          width:34, height:34, display:"inline-flex", alignItems:"center", justifyContent:"center",
                          padding:0, opacity: v.starred?1:0.3, lineHeight:1 }}>
                        {v.starred ? "⭐" : "☆"}
                      </button>
                      <button onClick={()=>setEditId(editId===v.id?null:v.id)} title="수정"
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:14,
                          width:34, height:34, display:"inline-flex", alignItems:"center", justifyContent:"center",
                          padding:0, opacity:0.7 }}>✏️</button>
                      <button onClick={()=>bump(v.id, 1)} title="외웠어요"
                        style={{ background:"none", border:`1px solid ${tint(TYPES.legs.color,0.4)}`, color:TYPES.legs.color,
                          borderRadius:8, minWidth:38, height:34, cursor:"pointer", fontSize:12,
                          display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"0 8px" }}>✓</button>
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
          {listed.length>limit && (
            <div style={{ marginTop:11 }}>
              <button onClick={()=>setLimit(l=>l+PAGE)}
                style={{...ghost, width:"100%", fontSize:12.5, padding:"12px 0"}}>
                더 보기 <span style={{ opacity:0.7 }}>· {listed.length-limit}개 남음</span>
              </button>
              {listed.length-limit > PAGE && (
                <button onClick={()=>setLimit(listed.length)}
                  style={{ width:"100%", marginTop:7, background:"none", border:"none", color:C.muted,
                    fontSize:11, cursor:"pointer", textDecoration:"underline" }}>
                  전체 {listed.length}개 한 번에 보기
                </button>
              )}
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

