// ================= 단어장 표시 부품 =================
// 입력칸(AutoArea·MarkBar), 문법 전용 표시(GrammarBody),
// 하나씩 보기(BrowseCard), 인라인 수정(VocabEditRow), 듣기 재생 순서.

import { useState, useRef, useEffect } from "react";
import { TYPES, VOCAB_TYPES, vocabTypeInfo, POS_LIST, posInfo, MASTER_LEVEL, isMastered, isOftenWrong, isDueToday, dueList, speakWord, speechReady, primeSpeech, ListenPlayer, stripMarkup, hasMarkup, Marked, wrapSelection, splitTermList, reviewScore, STUDY_ACCENT, C, todayKey, uid, tint, num, fmtMin, last7, LineChart, Bars7, Card, Row, SheetLayer, lbl, inp, primary, ghost, stepBtn, xBtn, chip, sheet, grip, callClaudeAPI, posList, hasPos, togglePos, keyOf } from "../shared.jsx";
import { splitTokens, patternLines } from "./vocabLogic.js";

export function AutoArea({ inputRef, value, onChange, placeholder, minRows = 2, maxRows = 6, style }) {
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
export function MarkBar({ inputRef, value, onChange }) {
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

export function GrammarBody({ v }) {
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


export function BrowseCard({ rows, idx, setIdx, onClose, onStar, onBump }) {
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


export function VocabEditRow({ entry, onSave, onCancel }) {
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
        placeholder={entry.type==="grammar"?"패턴 — 줄바꿈으로 여러 개":"뜻 (여러 개면 쉼표로: 주소, 다루다)"}
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
        placeholder={entry.type==="grammar"?"해당 동사·표현 (쉼표나 줄바꿈으로 구분)":"메모 (선택)"}
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

