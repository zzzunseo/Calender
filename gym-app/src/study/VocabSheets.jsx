// ================= 단어장 시트 =================
// 내보내기/가져오기(VocabShareSheet), 일괄 붙여넣기(VocabBulkSheet)

import { useState, useRef, useEffect } from "react";
import { TYPES, VOCAB_TYPES, vocabTypeInfo, POS_LIST, posInfo, MASTER_LEVEL, isMastered, isOftenWrong, isDueToday, dueList, speakWord, speechReady, primeSpeech, ListenPlayer, stripMarkup, hasMarkup, Marked, wrapSelection, splitTermList, reviewScore, STUDY_ACCENT, C, todayKey, uid, tint, num, fmtMin, last7, LineChart, Bars7, Card, Row, SheetLayer, lbl, inp, primary, ghost, stepBtn, xBtn, chip, sheet, grip, callClaudeAPI, posList, hasPos, togglePos, keyOf } from "../shared.jsx";
import { parseVocabLines, normPos } from "./vocabLogic.js";
import { AutoArea } from "./VocabUI.jsx";

export function VocabShareSheet({ vocab, onClose }) {
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

export const POS_HINTS = [
  ["명사",   "n / noun / 명사",             "#5AA9FF"],
  ["동사",   "v / verb / 동사",             "#FF8C42"],
  ["형용사", "adj / a / adjective / 형용사", "#5AD1A0"],
  ["부사",   "adv / ad / adverb / 부사",    "#C9A6FF"],
  ["전치사", "prep / preposition / 전치사",  "#FFB74B"],
  ["접속사", "conj / conjunction / 접속사",  "#FF8FB0"],
];

export function VocabBulkSheet({ apiKey, existingTerms, onAdd, onClose }) {
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
            구분자는 띄어쓰기 · 쉼표 · 탭 · 하이픈이 돼요. 슬래시(/)는 raise/rise처럼 단어에 그대로 남아요.
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

