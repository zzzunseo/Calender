// ================= 단어 퀴즈 =================
// 4지선다 · 빈칸 채우기 · 품사 맞히기 · 방향 전환(단어→뜻 / 뜻→단어)

import { useState, useRef, useEffect } from "react";
import { TYPES, VOCAB_TYPES, vocabTypeInfo, POS_LIST, posInfo, MASTER_LEVEL, isMastered, isOftenWrong, isDueToday, dueList, speakWord, speechReady, primeSpeech, ListenPlayer, stripMarkup, hasMarkup, Marked, wrapSelection, splitTermList, reviewScore, STUDY_ACCENT, C, todayKey, uid, tint, num, fmtMin, last7, LineChart, Bars7, Card, Row, SheetLayer, lbl, inp, primary, ghost, stepBtn, xBtn, chip, sheet, grip, callClaudeAPI, posList, hasPos, togglePos, keyOf } from "../shared.jsx";
import { isPolysemous, makeCloze, clozeReady } from "./vocabLogic.js";

export function VocabQuiz({ vocab, onAnswer, onStar, onClose }) {
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
