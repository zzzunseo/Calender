// ================= 내 패턴 찾기 =================
// 코칭 카드는 내가 미리 정해둔 기준(수면 7시간, 단백질 1.6g/kg…)에 기록을 맞춰본다.
// 여기는 반대다. 기준을 들이대지 않고, 내 기록끼리 짝지어 "실제로 같이 움직이는지"만 본다.
//
// 상관계수 대신 "중앙값으로 두 그룹을 갈라 평균을 비교"하는 방식을 택했다.
// r = 0.34 보다 "잘 잔 다음날은 볼륨이 18% 높았다"가 훨씬 알아듣기 쉽고,
// 이상치 하나에 덜 흔들린다. r은 방향이 맞는지 교차 확인하는 용도로만 쓴다.
//
// 한계는 분명하다. 이건 상관이지 인과가 아니다. 표본이 적으면 우연이 패턴처럼 보이므로
// 그룹당 최소 일수와 최소 효과 크기를 넘긴 것만 내보낸다.

import { num, didWorkout } from "./shared.jsx";

const MIN_PER_GROUP = 6;     // 각 그룹 최소 일수 — 이보다 적으면 우연일 확률이 너무 높다
const MIN_EFFECT = 12;       // 최소 차이 12% — 그 아래는 노이즈로 본다
const MIN_TOTAL_DAYS = 21;   // 분석을 시작할 최소 기록 일수

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const rd = (v, digit = 0) => { const f = Math.pow(10, digit); return Math.round(v * f) / f; };

// 피어슨 상관계수 — 그룹 비교 결과와 방향이 일치하는지 확인하는 용도
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 기록을 날짜순으로 펴고 하루치 지표를 뽑는다.
// "어제 수면 → 오늘 볼륨"처럼 전날을 보는 항목이 있어서 빈 날도 자리를 남겨둔다.
export function buildDays(data, windowDays = 120) {
  const start = new Date();
  start.setDate(start.getDate() - windowDays + 1);
  const out = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dk = dayKey(d);
    const e = (data.schedule || {})[dk];
    if (!e) { out.push(null); continue; }

    const foods = e.foods || [];
    const ps = e.partSets || {};
    const habits = e.habitLog || {};
    const hk = Object.keys(habits);

    out.push({
      dk,
      dow: d.getDay(),
      sleep: num(e.sleep && e.sleep.hours),
      water: num(e.water),
      steps: num(e.steps),
      kcal: foods.reduce((s, f) => s + num(f.kcal), 0),
      protein: foods.reduce((s, f) => s + num(f.protein), 0),
      sets: Object.keys(ps).reduce((s, p) => s + num(ps[p]), 0),
      worked: didWorkout(e) ? 1 : 0,
      studyMin: (data.study || []).filter((s) => s.date === dk).reduce((a, s) => a + s.minutes, 0),
      mood: num(e.mood),
      habitRate: hk.length ? (hk.filter((k) => habits[k]).length / hk.length) * 100 : null,
      hasFood: foods.length > 0,
    });
  }
  return out;
}

// 가설 하나를 검정한다.
//   pick(day, prevDay) → 원인 값 (null이면 그날 제외)
//   out(day, prevDay)  → 결과 값
function test(days, h) {
  const pairs = [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (!d) continue;
    const prev = i > 0 ? days[i - 1] : null;
    const x = h.pick(d, prev), y = h.out(d, prev);
    if (x == null || y == null || !isFinite(x) || !isFinite(y)) continue;
    pairs.push({ x, y });
  }
  if (pairs.length < MIN_TOTAL_DAYS) return null;

  // 경계를 중앙값으로 잡으면 값이 몇 종류뿐인 지표에서 무너진다.
  // 예: 수면이 8시간과 5.5시간 두 값뿐이면 중앙값이 5.5로 잡혀 전부 "이상" 그룹에 들어가고
  // "미만" 그룹이 비어버린다. 컨디션(1~5)·물(잔) 같은 이산 지표에서 흔한 상황이라,
  // 실제로 존재하는 값들 중 두 그룹이 가장 고르게 갈리는 지점을 경계로 삼는다.
  const xs = pairs.map((p) => p.x);
  let cut = h.split;
  if (cut == null) {
    const uniq = [...new Set(xs)].sort((a, b) => a - b);
    if (uniq.length < 2) return null;
    let best = null;
    for (const c of uniq.slice(1)) {
      const hiN = xs.filter((v) => v >= c).length;
      const bal = Math.min(hiN, xs.length - hiN);
      if (!best || bal > best.bal) best = { c, bal };
    }
    if (!best || best.bal < MIN_PER_GROUP) return null;
    cut = best.c;
  }
  const hi = pairs.filter((p) => p.x >= cut).map((p) => p.y);
  const lo = pairs.filter((p) => p.x < cut).map((p) => p.y);
  if (hi.length < MIN_PER_GROUP || lo.length < MIN_PER_GROUP) return null;

  const mHi = mean(hi), mLo = mean(lo);
  // 기준선이 0에 가까우면 퍼센트가 폭발하므로 두 평균의 평균을 분모로 쓴다
  const base = (Math.abs(mHi) + Math.abs(mLo)) / 2;
  if (base === 0) return null;
  const diffPct = ((mHi - mLo) / base) * 100;
  if (Math.abs(diffPct) < MIN_EFFECT) return null;

  const r = pearson(pairs.map((p) => p.x), pairs.map((p) => p.y));
  // 그룹 비교와 상관계수의 방향이 어긋나면 이상치에 끌려간 것으로 보고 버린다
  if (Math.abs(r) > 0.05 && Math.sign(r) !== Math.sign(diffPct)) return null;

  return {
    key: h.key, cause: h.cause, effect: h.effect, unit: h.unit,
    cut, binary: h.split != null,
    hiMean: mHi, loMean: mLo, hiN: hi.length, loN: lo.length,
    diffPct: Math.round(diffPct),
    r: Math.round(r * 100) / 100,
    // 효과가 커도 표본이 적으면 순위를 낮춘다
    strength: Math.abs(diffPct) * Math.min(1, pairs.length / 40),
    good: (h.higherIsBetter !== false) ? diffPct > 0 : diffPct < 0,
  };
}

// 검정할 가설. 모든 조합을 무작정 돌리면 우연히 걸리는 게 많아지므로
// "알면 행동을 바꿀 수 있는" 것만 골랐다.
function hypotheses() {
  return [
    { key:"sleep-volume", cause:"잘 잔 다음날", effect:"운동 볼륨", unit:"세트",
      pick:(d,p)=> p ? (p.sleep || null) : null, out:(d)=> d.worked ? d.sets : null },
    { key:"sleep-mood", cause:"잘 잔 다음날", effect:"컨디션", unit:"점",
      pick:(d,p)=> p ? (p.sleep || null) : null, out:(d)=> d.mood || null },
    { key:"sleep-study", cause:"잘 잔 다음날", effect:"공부 시간", unit:"분",
      pick:(d,p)=> p ? (p.sleep || null) : null, out:(d)=> d.studyMin || null },
    { key:"protein-mood", cause:"단백질을 많이 먹은 다음날", effect:"컨디션", unit:"점",
      pick:(d,p)=> (p && p.hasFood) ? (p.protein || null) : null, out:(d)=> d.mood || null },
    { key:"kcal-volume", cause:"많이 먹은 다음날", effect:"운동 볼륨", unit:"세트",
      pick:(d,p)=> (p && p.hasFood) ? (p.kcal || null) : null, out:(d)=> d.worked ? d.sets : null },
    { key:"volume-sleep", cause:"운동을 많이 한 날", effect:"그날 수면", unit:"시간",
      pick:(d)=> d.worked ? d.sets : null, out:(d)=> d.sleep || null },
    { key:"volume-mood-next", cause:"운동을 많이 한 다음날", effect:"컨디션", unit:"점",
      pick:(d,p)=> (p && p.worked) ? p.sets : null, out:(d)=> d.mood || null },
    { key:"workout-study", cause:"운동한 날", effect:"공부 시간", unit:"분", split:1,
      pick:(d)=> d.worked, out:(d)=> d.studyMin || null },
    { key:"mood-study", cause:"컨디션이 좋은 날", effect:"공부 시간", unit:"분",
      pick:(d)=> d.mood || null, out:(d)=> d.studyMin || null },
    { key:"water-mood", cause:"물을 많이 마신 날", effect:"컨디션", unit:"점",
      pick:(d)=> d.water || null, out:(d)=> d.mood || null },
    { key:"steps-sleep", cause:"많이 걸은 날", effect:"그날 수면", unit:"시간",
      pick:(d)=> d.steps || null, out:(d)=> d.sleep || null },
    { key:"habit-mood", cause:"습관을 잘 지킨 날", effect:"컨디션", unit:"점",
      pick:(d)=> d.habitRate, out:(d)=> d.mood || null },
    { key:"sleep-kcal", cause:"잘 잔 다음날", effect:"섭취 칼로리", unit:"kcal", higherIsBetter:false,
      pick:(d,p)=> p ? (p.sleep || null) : null, out:(d)=> d.hasFood ? d.kcal : null },
  ];
}

// 요일 습관은 상관이 아니라 빈도라 따로 계산한다.
// 무슨 요일에 자꾸 빠지는지는 스스로 잘 모르면서, 알면 고치기는 쉬운 부분이다.
const DOW = ["일","월","화","수","목","금","토"];

function weekdayFindings(days) {
  const rec = days.filter(Boolean);
  if (rec.length < MIN_TOTAL_DAYS) return [];
  const out = [];
  const byDow = (sel) => {
    const g = Array.from({ length: 7 }, () => []);
    rec.forEach((d) => { const v = sel(d); if (v != null) g[d.dow].push(v); });
    return g;
  };

  const wg = byDow((d) => d.worked);
  if (wg.every((g) => g.length >= 3)) {
    const rates = wg.map((g) => mean(g) * 100);
    const avg = mean(rates);
    let lo = 0;
    rates.forEach((r, i) => { if (r < rates[lo]) lo = i; });
    if (avg - rates[lo] >= 25) {
      out.push({ key:"dow-skip", kind:"weekday", good:false,
        title:`${DOW[lo]}요일에 운동을 가장 많이 건너뛰어요`,
        detail:`${DOW[lo]}요일 운동 비율 ${Math.round(rates[lo])}% · 다른 요일 평균 ${Math.round(avg)}%`,
        note:`${wg[lo].length}번의 ${DOW[lo]}요일 기준`,
        strength: avg - rates[lo] });
    }
  }

  const sg = byDow((d) => d.studyMin);
  if (sg.every((g) => g.length >= 3)) {
    const avgs = sg.map((g) => mean(g));
    const overall = mean(avgs);
    let hi = 0;
    avgs.forEach((v, i) => { if (v > avgs[hi]) hi = i; });
    if (overall > 0 && (avgs[hi] - overall) / overall >= 0.5) {
      out.push({ key:"dow-study", kind:"weekday", good:true,
        title:`${DOW[hi]}요일에 가장 오래 공부해요`,
        detail:`${DOW[hi]}요일 평균 ${Math.round(avgs[hi])}분 · 전체 평균 ${Math.round(overall)}분`,
        note:`${sg[hi].length}번의 ${DOW[hi]}요일 기준`,
        strength: ((avgs[hi] - overall) / overall) * 100 });
    }
  }
  return out;
}

// 계산 결과를 사람 말로 옮긴다
const CUT_UNIT = {
  "sleep-volume":"시간", "sleep-mood":"시간", "sleep-study":"시간", "sleep-kcal":"시간",
  "protein-mood":"g", "kcal-volume":"kcal", "volume-sleep":"세트",
  "volume-mood-next":"세트", "mood-study":"점", "water-mood":"잔",
  "steps-sleep":"걸음", "habit-mood":"%",
};

function phrase(f) {
  const dig = f.unit === "시간" ? 1 : 0;
  const cu = CUT_UNIT[f.key];
  // 기준선을 밝히지 않으면 "잘 잤다"가 몇 시간인지 알 수 없다
  const basis = f.binary || !cu ? "" : ` (${rd(f.cut, cu === "시간" ? 1 : 0)}${cu} 이상)`;
  return {
    title: `${f.cause} ${f.effect}이 ${Math.abs(f.diffPct)}% ${f.diffPct > 0 ? "높았어요" : "낮았어요"}`,
    detail: `${rd(f.hiMean, dig)}${f.unit} vs ${rd(f.loMean, dig)}${f.unit}${basis}`,
    note: `${f.hiN}일 vs ${f.loN}일 비교 · 상관 ${f.r >= 0 ? "+" : ""}${f.r}`,
  };
}

export function findPatterns(data) {
  const days = buildDays(data);
  const recorded = days.filter(Boolean).length;
  if (recorded < MIN_TOTAL_DAYS) {
    return { ok:false, recorded, need: MIN_TOTAL_DAYS - recorded, findings:[] };
  }
  const corr = hypotheses().map((h) => test(days, h)).filter(Boolean)
    .map((f) => ({ ...f, ...phrase(f), kind:"corr" }));
  const all = [...corr, ...weekdayFindings(days)].sort((a, b) => b.strength - a.strength);
  return { ok:true, recorded, findings: all, tested: hypotheses().length + 2 };
}
