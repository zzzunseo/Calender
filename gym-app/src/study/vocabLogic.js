// ================= 단어장·공부 순수 로직 =================
// 화면과 무관한 계산만 모았다. Study.jsx가 2100줄까지 불어나면서
// 한 군데를 고칠 때마다 관계없는 코드를 스크롤로 지나쳐야 했다.
// 여기 있는 함수들은 DOM을 건드리지 않아 단위 테스트가 그대로 붙는다.

import { TYPES, VOCAB_TYPES, vocabTypeInfo, POS_LIST, posInfo, MASTER_LEVEL, isMastered, isOftenWrong, isDueToday, dueList, speakWord, speechReady, primeSpeech, ListenPlayer, stripMarkup, hasMarkup, Marked, wrapSelection, splitTermList, reviewScore, STUDY_ACCENT, C, todayKey, uid, tint, num, fmtMin, last7, LineChart, Bars7, Card, Row, SheetLayer, lbl, inp, primary, ghost, stepBtn, xBtn, chip, sheet, grip, callClaudeAPI, posList, hasPos, togglePos, keyOf } from "../shared.jsx";

export const DEFAULT_SUBJECTS = ["토익", "자격증"];
// 토익 학습 영역 — 기록·점수를 파트 단위로 쪼개서 약점을 보이게 한다

export const TOEIC_PARTS = [
  { k:"lc",  label:"LC",   desc:"Part 1~4", color:"#5AA9FF" },
  { k:"rc",  label:"RC",   desc:"Part 5~7", color:"#FFB74B" },
  { k:"voca",label:"어휘", desc:"단어·숙어", color:"#C9A6FF" },
  { k:"gram",label:"문법", desc:"교재 섹션", color:"#5AD1A0" },
];

export const partInfo = (k)=> TOEIC_PARTS.find(p=>p.k===k) || null;

// 단어장 항목 종류


export const normPos = (raw) => {
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
    // 확실한 구분자(탭·|·;·:·하이픈)가 있을 때만 그것으로 나눈다.
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


export const STUDY_PALETTE = ["#7C9CFF", "#FF9F6B", "#5AD1A0", "#E08CFF", "#FFD24B", "#4FC0D0"];

export const colorForSubject = (name) => { let h=0; for(const c of String(name)) h=(h*31+c.charCodeAt(0))>>>0; return STUDY_PALETTE[h % STUDY_PALETTE.length]; };


export const meaningCount = (v) => String(v?.meaning||"")
  .split(",").map(x=>x.trim()).filter(Boolean).length;
export const isPolysemous = (v) => meaningCount(v) >= 2 || posList(v?.pos).length >= 2;

// ===== 빈칸 채우기 =====
// 예문에서 그 단어를 찾아 ____ 로 가린다. 토익 Part 5와 같은 형식이라 실전에 가깝다.
// 영어는 어형이 변하므로(allocate → allocated/allocating) 어간을 기준으로 찾는다.
export const clozeStem = (term) => {
  const t = String(term||"").trim().toLowerCase();
  if (t.length <= 3) return t;
  // 흔한 어미를 떼어 어간만 남긴다
  return t.replace(/(ing|ed|es|s|ly|ment|tion|ness)$/,"");
};
// 예문에서 단어(어형 변화 포함)를 찾아 빈칸으로 바꾼다. 못 찾으면 null.
export const makeCloze = (sentence, term) => {
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
export const clozeReady = (v) => !!(v && v.term && v.note && makeCloze(v.note, v.term));


export function splitTokens(str) {
  const t = String(str || "").trim();
  if (!t) return [];
  if (/[.?!]\s|[가-힣]{6,}/.test(t) && !/[,·\n]/.test(t)) return [];   // 서술형 메모는 제외
  // 슬래시는 구분자로 쓰지 않는다. "provided(providing/assuming)that"처럼
  // 한 표현 안에 슬래시가 들어가는 경우가 많아 쪼개면 표현이 부서진다.
  const items = t.split(/[,·\n]/).map(x => x.trim()).filter(Boolean);
  return items.length >= 3 ? items : [];
}

// 패턴 줄 나누기 — 오직 줄바꿈만 기준으로 삼는다.
// 예전엔 슬래시로도 나눴는데, 사용자가 "had pp/ 과거", "*시간/조건의 부사절*"처럼
// 슬래시를 "또는"의 뜻으로 문장 안에서 쓰기 때문에 한 줄이 엉뚱하게 두 동강 났다.
// 특히 강조 표기 *…* 안쪽이 잘리면 짝이 깨져 별표가 그대로 화면에 노출됐다.
export function patternLines(meaning) {
  const t = String(meaning || "").trim();
  if (!t) return [];
  return t.split(/\n+/).map(x => x.trim()).filter(Boolean);
}

