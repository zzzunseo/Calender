// ================= 주간 자동 코칭 =================
// 통계 탭은 "무슨 일이 있었는지"까지만 보여준다. 여기서는 한 걸음 더 나가서
// "그래서 다음 주에 뭘 바꿔야 하는지"를 숫자로 뽑는다.
// 전부 로컬 공식 계산이라 API 키가 없어도 동작한다.

import { num, lastNDays, didWorkout, burnedKcal, PARTS, PART_GROUPS, MACRO_GOALS } from "./shared.jsx";

// 체지방 1kg ≈ 7700kcal. 주간 목표와 실제의 차이를 하루 섭취량으로 환산할 때 쓴다.
const KCAL_PER_KG = 7700;

// 목표별 권장 주간 체중 변화 (체중 대비 %)
// 린매스업은 지방 증가를 억제하려고 좁게, 벌크업은 넉넉하게, 감량은 근손실을 피하는 선까지.
export const RATE_BANDS = {
  lean: { lo: 0.10, hi: 0.30, text: "체중의 0.1~0.3%" },
  bulk: { lo: 0.30, hi: 0.70, text: "체중의 0.3~0.7%" },
  cut:  { lo: -1.00, hi: -0.40, text: "체중의 -0.4~-1.0%" },
};

// 목표별 권장 단백질 (체중 1kg당 g)
const PROTEIN_BANDS = { lean: [1.6, 2.2], bulk: [1.6, 2.0], cut: [2.0, 2.4] };

const round50 = (v) => Math.round(v / 50) * 50;
const avgOf = (arr, sel) => (arr.length ? arr.reduce((s, x) => s + sel(x), 0) / arr.length : 0);

// 최근 측정값들로 주간 체중 변화율을 낸다.
// 하루하루 체중은 수분·식사로 크게 흔들려서 첫값·끝값만 비교하면 널뛴다.
// 그래서 최소제곱 회귀로 추세선의 기울기를 쓴다.
export function weightTrend(measurements, windowDays = 28) {
  const asc = [...(measurements || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (asc.length < 2) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  let pts = asc.filter((x) => new Date(x.date + "T00:00:00") >= cutoff);
  if (pts.length < 2) pts = asc.slice(-3);
  if (pts.length < 2) return null;

  const t0 = new Date(pts[0].date + "T00:00:00").getTime();
  const xs = pts.map((p) => (new Date(p.date + "T00:00:00").getTime() - t0) / 86400000);
  const ys = pts.map((p) => num(p.weight));
  const spanDays = xs[xs.length - 1];
  if (spanDays < 5) return { tooShort: true, spanDays, n: pts.length };

  const mx = avgOf(xs, (v) => v), my = avgOf(ys, (v) => v);
  let numr = 0, den = 0;
  xs.forEach((x, i) => { numr += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  if (den === 0) return { tooShort: true, spanDays, n: pts.length };

  const perDay = numr / den;
  return { perWeek: perDay * 7, spanDays, n: pts.length, latest: ys[ys.length - 1] };
}

export function coachReport(data, { tdee, weight, target }) {
  const goalKey = (data.profile && data.profile.macroGoal) || "lean";
  const goal = MACRO_GOALS[goalKey] || MACRO_GOALS.lean;
  const band = RATE_BANDS[goalKey] || RATE_BANDS.lean;
  const surplus = num(data.profile && data.profile.surplus);

  const thisWeek = lastNDays(7);
  const prevWeek = lastNDays(14).slice(0, 7);

  const scan = (keys) => {
    const pd = keys.map((dk) => {
      const e = data.schedule[dk] || {};
      const foods = e.foods || [];
      const kcalIn = foods.reduce((s, f) => s + num(f.kcal), 0);
      const burned = burnedKcal(e, weight);
      return {
        dk,
        kcalIn, burned,
        net: tdee != null ? kcalIn - tdee - burned : null,
        protein: foods.reduce((s, f) => s + num(f.protein), 0),
        hasFood: foods.length > 0,
        worked: didWorkout(e),
        sleep: num(e.sleep && e.sleep.hours),
        water: num(e.water),
        partSets: e.partSets || {},
        studyMin: (data.study || []).filter((s) => s.date === dk).reduce((a, s) => a + s.minutes, 0),
      };
    });
    const foodDays = pd.filter((d) => d.hasFood);
    const sleepDays = pd.filter((d) => d.sleep > 0);
    const netDays = pd.filter((d) => d.net != null && d.hasFood);
    const setsByPart = {};
    pd.forEach((d) => Object.keys(d.partSets).forEach((p) => { setsByPart[p] = (setsByPart[p] || 0) + num(d.partSets[p]); }));
    return {
      pd, foodDays: foodDays.length,
      avgKcal: Math.round(avgOf(foodDays, (d) => d.kcalIn)),
      avgNet: netDays.length ? Math.round(avgOf(netDays, (d) => d.net)) : null,
      avgProtein: Math.round(avgOf(foodDays, (d) => d.protein)),
      avgSleep: sleepDays.length ? avgOf(sleepDays, (d) => d.sleep) : null,
      avgWater: avgOf(pd, (d) => d.water),
      workouts: pd.filter((d) => d.worked).length,
      setsByPart,
      totalSets: Object.values(setsByPart).reduce((s, v) => s + v, 0),
      studyMin: pd.reduce((s, d) => s + d.studyMin, 0),
    };
  };

  const cur = scan(thisWeek);
  const prev = scan(prevWeek);
  const trend = weightTrend(data.measurements);

  // 분석할 재료 자체가 없으면 조언 대신 무엇을 채워야 하는지 알려준다
  const anyLog = cur.foodDays > 0 || cur.workouts > 0 || cur.avgSleep != null;
  if (!anyLog) {
    return { ok: false, goal, reason: "이번 주 기록이 아직 없어요. 식단이나 운동을 며칠 기록하면 코칭이 나와요.", cur, prev };
  }

  const items = [];
  const add = (o) => items.push(o);

  // ---------- 1. 체중 추세 (가장 중요한 신호) ----------
  const w = weight || (trend && trend.latest);
  if (!trend) {
    add({ key: "weight", pri: 1, icon: "⚖️", level: "info", title: "체중 측정이 필요해요",
      detail: "측정값이 2회 미만이라 방향을 판단할 수 없어요.",
      action: "일주일에 2~3번, 아침 공복에 재서 몸 탭에 남겨주세요." });
  } else if (trend.tooShort) {
    add({ key: "weight", pri: 1, icon: "⚖️", level: "info", title: "측정 기간이 짧아요",
      detail: `측정이 ${trend.n}회뿐이고 기간도 ${Math.round(trend.spanDays)}일이라 추세가 흔들려요.`,
      action: "최소 1~2주는 모여야 조정 폭을 계산할 수 있어요." });
  } else if (w) {
    const pct = (trend.perWeek / w) * 100;
    const loKg = (band.lo / 100) * w, hiKg = (band.hi / 100) * w;
    const inBand = trend.perWeek >= loKg - 0.02 && trend.perWeek <= hiKg + 0.02;
    const fmt = `주 ${trend.perWeek >= 0 ? "+" : ""}${Math.round(trend.perWeek * 100) / 100}kg (${pct >= 0 ? "+" : ""}${Math.round(pct * 100) / 100}%)`;
    if (inBand) {
      add({ key: "weight", pri: 1, icon: "⚖️", level: "good", title: `체중 추세가 ${goal.label} 구간 안이에요`,
        detail: `${fmt} — 권장 ${band.text}`, action: "지금 섭취량을 그대로 유지하세요." });
    } else {
      // 밴드보다 "위"라는 건 목표에 따라 뜻이 반대다.
      // 증량 목표에선 위 = 너무 빠름이지만, 감량 목표에선 위 = 덜 빠졌다는 뜻이다.
      const above = trend.perWeek > hiKg;
      const targetKg = above ? hiKg : loKg;
      const deltaKcal = Math.max(-350, Math.min(350, round50(((targetKg - trend.perWeek) * KCAL_PER_KG) / 7)));
      const stalled = Math.abs(trend.perWeek) < 0.05;
      add({
        key: "weight", pri: 0, icon: "⚖️",
        level: Math.abs(deltaKcal) >= 250 ? "bad" : "warn",
        title: goalKey === "cut"
          ? (above ? (stalled ? "감량이 거의 멈췄어요" : "감량 속도가 느려요") : "감량이 너무 빨라요")
          : (above ? "증량이 너무 빨라요" : (stalled ? "체중이 거의 안 늘고 있어요" : "증량이 너무 느려요")),
        detail: `${fmt} — 권장은 ${band.text} (주 ${Math.round(loKg * 100) / 100}~${Math.round(hiKg * 100) / 100}kg)`,
        action: `하루 섭취를 ${deltaKcal > 0 ? "약 " : "약 "}${Math.abs(deltaKcal)}kcal ${deltaKcal > 0 ? "늘려" : "줄여"} 2주 더 보세요.`,
        kcalDelta: deltaKcal,
        newSurplus: Math.round(surplus + deltaKcal),
      });
    }
  }

  // ---------- 2. 식단 기록 커버리지 ----------
  // 기록이 듬성듬성하면 아래 칼로리·단백질 분석 자체가 못 믿을 값이 된다
  if (cur.foodDays < 4) {
    add({ key: "logging", pri: 2, icon: "📝", level: cur.foodDays <= 1 ? "bad" : "warn",
      title: "식단 기록이 부족해요",
      detail: `7일 중 ${cur.foodDays}일만 기록됐어요. 칼로리·단백질 분석의 정확도가 떨어져요.`,
      action: "최소 5일은 채워야 평균이 의미가 있어요." });
  }

  // ---------- 3. 칼로리 밸런스 ----------
  if (cur.avgNet != null && cur.foodDays >= 3) {
    const diff = cur.avgNet - surplus;
    if (Math.abs(diff) <= 150) {
      add({ key: "kcal", pri: 5, icon: "🔥", level: "good", title: "칼로리 밸런스가 목표에 맞아요",
        detail: `평균 ${cur.avgNet >= 0 ? "+" : ""}${cur.avgNet}kcal · 목표 ${surplus >= 0 ? "+" : ""}${surplus}kcal`, action: "" });
    } else {
      add({ key: "kcal", pri: 3, icon: "🔥", level: Math.abs(diff) > 400 ? "bad" : "warn",
        title: diff > 0 ? "목표보다 많이 먹고 있어요" : "목표보다 적게 먹고 있어요",
        detail: `평균 ${cur.avgNet >= 0 ? "+" : ""}${cur.avgNet}kcal로 목표(${surplus >= 0 ? "+" : ""}${surplus})보다 ${Math.abs(Math.round(diff))}kcal ${diff > 0 ? "많아요" : "적어요"}.`,
        action: `하루 ${round50(Math.abs(diff))}kcal씩 ${diff > 0 ? "덜어내면" : "더하면"} 목표에 맞아요.` });
    }
  }

  // ---------- 4. 단백질 ----------
  if (w && cur.foodDays >= 3) {
    const [pLo, pHi] = PROTEIN_BANDS[goalKey] || PROTEIN_BANDS.lean;
    const perKg = cur.avgProtein / w;
    if (perKg < pLo) {
      const needG = Math.round(pLo * w - cur.avgProtein);
      add({ key: "protein", pri: 2, icon: "🥩", level: perKg < pLo * 0.8 ? "bad" : "warn",
        title: "단백질이 모자라요",
        detail: `하루 평균 ${cur.avgProtein}g (체중 1kg당 ${Math.round(perKg * 100) / 100}g) · 권장 ${pLo}~${pHi}g/kg`,
        action: `하루 ${needG}g만 더 — 닭가슴살 100g(약 23g)이나 쉐이크 한 잔이면 채워져요.` });
    } else {
      add({ key: "protein", pri: 6, icon: "🥩", level: "good", title: "단백질은 충분해요",
        detail: `하루 평균 ${cur.avgProtein}g (1kg당 ${Math.round(perKg * 100) / 100}g)`, action: "" });
    }
  }

  // ---------- 5. 운동 빈도 ----------
  if (cur.workouts < 3) {
    add({ key: "freq", pri: 2, icon: "💪", level: cur.workouts <= 1 ? "bad" : "warn",
      title: "운동 횟수가 적었어요",
      detail: `이번 주 ${cur.workouts}회 (지난주 ${prev.workouts}회)`,
      action: "주 4회 이상이면 부위별 볼륨을 채우기 훨씬 수월해요." });
  } else if (cur.workouts >= 4) {
    add({ key: "freq", pri: 7, icon: "💪", level: "good", title: `운동 ${cur.workouts}회 — 좋아요`,
      detail: `지난주 ${prev.workouts}회`, action: "" });
  }

  // ---------- 6. 부위별 볼륨 ----------
  // "한 번이라도 한 적 있는 부위"만 본다. 아예 안 하는 부위까지 잔소리하면 소음이 된다.
  const everTrained = new Set();
  Object.keys(data.schedule || {}).forEach((dk) => {
    const ps = (data.schedule[dk] || {}).partSets || {};
    Object.keys(ps).forEach((p) => { if (num(ps[p]) > 0) everTrained.add(p); });
  });
  const neglected = PARTS.filter((p) => everTrained.has(p) && num(cur.setsByPart[p]) < 5)
    .sort((a, b) => num(cur.setsByPart[a]) - num(cur.setsByPart[b]));
  if (neglected.length && cur.totalSets > 0) {
    add({ key: "volume", pri: 4, icon: "🎯", level: neglected.length >= 3 ? "warn" : "info",
      title: `${neglected.slice(0, 3).join("·")} 볼륨이 낮아요`,
      detail: neglected.slice(0, 4).map((p) => `${p} ${num(cur.setsByPart[p])}세트`).join(" · "),
      action: "부위당 주 10세트는 넘겨야 성장 자극이 확실해요." });
  }

  // 볼륨 급증 — 부상·정체의 흔한 원인이라 따로 본다
  if (prev.totalSets >= 20 && cur.totalSets > prev.totalSets * 1.4) {
    add({ key: "spike", pri: 3, icon: "⚠️", level: "warn", title: "볼륨이 갑자기 늘었어요",
      detail: `${prev.totalSets}세트 → ${cur.totalSets}세트 (+${Math.round((cur.totalSets / prev.totalSets - 1) * 100)}%)`,
      action: "회복이 따라가는지 보고, 다음 주는 비슷한 수준으로 유지해보세요." });
  }

  // 밀기 : 당기기 균형
  const groupSum = {};
  PART_GROUPS.forEach((g) => { groupSum[g.key] = (g.parts || []).reduce((s, p) => s + num(cur.setsByPart[p]), 0); });
  const push = groupSum["밀기"] || 0, pull = groupSum["당기기"] || 0;
  if (push + pull >= 12) {
    const hi = Math.max(push, pull), lo = Math.min(push, pull);
    if (lo > 0 && hi / lo >= 1.6) {
      add({ key: "balance", pri: 4, icon: "⚖️", level: "warn", title: "밀기·당기기가 치우쳤어요",
        detail: `밀기 ${push}세트 · 당기기 ${pull}세트`,
        action: `${push > pull ? "당기기" : "밀기"}를 ${Math.round(hi / 1.2 - lo)}세트쯤 더하면 균형이 맞아요.` });
    }
  }

  // ---------- 7. 수면 ----------
  if (cur.avgSleep != null) {
    if (cur.avgSleep < 7) {
      add({ key: "sleep", pri: cur.avgSleep < 6 ? 1 : 3, icon: "😴", level: cur.avgSleep < 6 ? "bad" : "warn",
        title: "수면이 부족해요",
        detail: `평균 ${Math.round(cur.avgSleep * 10) / 10}시간` + (prev.avgSleep != null ? ` (지난주 ${Math.round(prev.avgSleep * 10) / 10}시간)` : ""),
        action: "회복·식욕 조절 모두 수면에 걸려 있어요. 7시간을 먼저 확보해보세요." });
    } else {
      add({ key: "sleep", pri: 7, icon: "😴", level: "good", title: `수면 평균 ${Math.round(cur.avgSleep * 10) / 10}시간`,
        detail: "회복에 충분한 수준이에요", action: "" });
    }
  } else {
    add({ key: "sleep", pri: 6, icon: "😴", level: "info", title: "수면 기록이 없어요",
      detail: "이번 주 수면을 남긴 날이 없어요.", action: "회복이 정체 원인인지 보려면 며칠만 기록해보세요." });
  }

  // ---------- 8. 물 ----------
  if (cur.avgWater > 0 && cur.avgWater < 6) {
    add({ key: "water", pri: 5, icon: "💧", level: "info", title: "수분이 조금 모자라요",
      detail: `평균 ${Math.round(cur.avgWater * 10) / 10}잔 (약 ${Math.round(cur.avgWater * 250)}ml)`,
      action: "하루 8잔(2L)을 기준으로 잡아보세요." });
  }

  // ---------- 9. 공부 ----------
  if (cur.studyMin > 0 || prev.studyMin > 0) {
    const d = cur.studyMin - prev.studyMin;
    add({ key: "study", pri: 8, icon: "📚", level: d >= 0 ? "good" : "info",
      title: `공부 ${Math.round(cur.studyMin / 60 * 10) / 10}시간`,
      detail: `지난주 대비 ${d >= 0 ? "+" : ""}${Math.round(d / 60 * 10) / 10}시간`, action: "" });
  }

  const actions = items.filter((i) => i.level === "bad" || i.level === "warn").sort((a, b) => a.pri - b.pri);
  const goods = items.filter((i) => i.level === "good").sort((a, b) => a.pri - b.pri);
  const infos = items.filter((i) => i.level === "info").sort((a, b) => a.pri - b.pri);

  const headline = actions.length === 0
    ? "이번 주는 조정할 게 없어요. 그대로 밀고 가세요."
    : actions[0].level === "bad"
      ? `가장 급한 건 "${actions[0].title}"이에요.`
      : `대체로 괜찮아요. ${actions.length}가지만 손보면 돼요.`;

  return { ok: true, goal, band, headline, actions, goods, infos, cur, prev, trend, weight: w };
}
