// ================= 통합 검색 =================
// 지금까지 검색은 탭마다 따로였다. "닭가슴살"을 치면 음식 탭에서는 DB가 나오지만
// "그걸 언제 먹었는지"는 캘린더를 손으로 넘겨야 했고, "벤치프레스"를 언제 몇 kg 들었는지도
// 통계 탭 운동명 목록을 뒤져야 했다. 기록은 쌓이는데 되찾을 방법이 없던 셈이다.
//
// 여기서는 한 번의 입력으로 기록·음식·단어·운동·일기를 한꺼번에 훑는다.
// 전부 로컬 계산이라 네트워크가 필요 없다.

import { num, didWorkout, stripMarkup, vocabTypeInfo } from "./shared.jsx";

// 검색어와 대상 문자열의 일치 정도. 높을수록 위로 올라간다.
// 완전 일치 > 앞부분 일치 > 포함 순으로 두는 이유는, 사람이 찾는 건 대개
// 자기가 기억하는 이름의 앞글자이기 때문이다.
function scoreOf(text, q) {
  const t = String(text || "").toLowerCase();
  if (!t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 70;
  const at = t.indexOf(q);
  if (at < 0) return 0;
  // 뒤쪽에서 걸릴수록 조금씩 낮춘다
  return Math.max(30, 55 - at);
}

const fmtDate = (dk) => String(dk || "").slice(5).replace("-", ".");

// 며칠 전인지 — 최근 기록을 위로 올리는 데 쓴다
function daysAgo(dk) {
  const d = new Date(dk + "T00:00:00");
  if (isNaN(d)) return 9999;
  return Math.round((Date.now() - d.getTime()) / 86400000);
}

export function searchAll(data, query, { limit = 40 } = {}) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 1) return { ok: false, groups: [], total: 0 };

  const hits = { food: [], workout: [], vocab: [], diary: [], study: [] };
  const schedule = data.schedule || {};

  Object.keys(schedule).forEach((dk) => {
    const e = schedule[dk] || {};
    const ago = daysAgo(dk);
    // 오래된 기록일수록 살짝 뒤로 — 같은 점수면 최근 것이 먼저 보이는 게 자연스럽다
    const recency = Math.max(0, 12 - ago / 30);

    (e.foods || []).forEach((f) => {
      const s = scoreOf(f.name, q);
      if (s) hits.food.push({
        score: s + recency, date: dk,
        title: f.name,
        sub: `${num(f.kcal)}kcal · 단백질 ${num(f.protein)}g · 당류 ${num(f.sugar)}g`,
      });
    });

    // 운동은 이름이 여러 군데 흩어져 있다 — 메인 리프트, 개별 종목, 부위
    const lifts = e.lifts || [];
    lifts.forEach((l) => {
      const s = scoreOf(l.name, q);
      if (s) hits.workout.push({
        score: s + recency, date: dk,
        title: l.name,
        sub: (l.sets || []).map((x) => `${x.w}kg×${x.r}`).join(", ") || "기록",
      });
    });
    if (e.mainLift && e.mainLift.name) {
      const s = scoreOf(e.mainLift.name, q);
      if (s) hits.workout.push({
        score: s + recency, date: dk,
        title: e.mainLift.name,
        sub: `${num(e.mainLift.w)}kg × ${num(e.mainLift.r)}회`,
      });
    }
    Object.keys(e.partSets || {}).forEach((p) => {
      const s = scoreOf(p, q);
      if (s && num(e.partSets[p]) > 0) hits.workout.push({
        score: s - 5 + recency, date: dk,
        title: p, sub: `${num(e.partSets[p])}세트`,
      });
    });

    // 일기·메모는 하루를 되짚을 때 제일 쓸모 있는 단서다
    [["diary", e.diary], ["note", e.note]].forEach(([kind, text]) => {
      const s = scoreOf(text, q);
      if (s) hits.diary.push({
        score: s + recency, date: dk,
        title: kind === "diary" ? "일기" : "메모",
        sub: String(text).length > 60 ? String(text).slice(0, 60) + "…" : String(text),
      });
    });
  });

  (data.vocab || []).forEach((v) => {
    const s = Math.max(
      scoreOf(stripMarkup(v.term), q),
      scoreOf(stripMarkup(v.meaning), q) - 8,
      scoreOf(stripMarkup(v.note), q) - 15,
      scoreOf(v.tag, q) - 20,
    );
    if (s > 0) hits.vocab.push({
      score: s, id: v.id,
      title: stripMarkup(v.term),
      sub: `${vocabTypeInfo(v.type).label} · ${stripMarkup(v.meaning) || "뜻 없음"}`.slice(0, 70),
      tag: v.tag || "",
    });
  });

  (data.study || []).forEach((st) => {
    const s = Math.max(scoreOf(st.subject, q), scoreOf(st.memo, q) - 10);
    if (s > 0) hits.study.push({
      score: s + Math.max(0, 12 - daysAgo(st.date) / 30), date: st.date,
      title: st.subject, sub: `${st.minutes}분${st.memo ? ` · ${st.memo}` : ""}`,
    });
  });

  // 같은 이름이 여러 날 나오면 묶어서 "몇 번, 마지막 언제"로 보여준다.
  // 안 묶으면 자주 먹는 음식 하나가 결과를 다 차지해버린다.
  const fold = (arr) => {
    const map = new Map();
    arr.forEach((it) => {
      const k = it.title;
      const cur = map.get(k);
      if (!cur) { map.set(k, { ...it, count: 1, last: it.date }); return; }
      cur.count += 1;
      cur.score = Math.max(cur.score, it.score);
      if (!cur.last || (it.date && it.date > cur.last)) { cur.last = it.date; cur.sub = it.sub; }
    });
    return [...map.values()].sort((a, b) => b.score - a.score);
  };

  const groups = [
    { key: "vocab",   label: "단어장",   icon: "📖", items: hits.vocab.sort((a,b)=>b.score-a.score) },
    { key: "food",    label: "먹은 것",   icon: "🍚", items: fold(hits.food) },
    { key: "workout", label: "운동",     icon: "💪", items: fold(hits.workout) },
    { key: "study",   label: "공부 기록", icon: "📝", items: fold(hits.study) },
    { key: "diary",   label: "일기·메모", icon: "✍️", items: hits.diary.sort((a,b)=>b.score-a.score) },
  ].filter((g) => g.items.length);

  const total = groups.reduce((s, g) => s + g.items.length, 0);
  groups.forEach((g) => { g.shown = g.items.slice(0, limit); });
  return { ok: true, groups, total, query: q };
}

export { fmtDate as searchFmtDate };
