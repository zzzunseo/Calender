import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { TYPES, STUDY_ACCENT, C, keyOf, todayKey, uid, tint, num, normalize, MACRO_GOALS, rd1, LineChart, Card, Row, MiniCard, Collapsible, ConfirmX, lbl, inp, primary, ghost, stepBtn, chip } from "../shared.jsx";

const ACTIVITY = [
  { k: 1.2,   label: "거의 없음" },
  { k: 1.375, label: "가벼움" },
  { k: 1.55,  label: "보통" },
  { k: 1.725, label: "많음" },
];

const bodyComp = (m) => {
  if (!m || !num(m.weight)) return null;
  const w = num(m.weight);
  const bf = (m.fat!=null && num(m.fat)>0) ? num(m.fat) : null;
  const muscle = (m.muscle!=null && num(m.muscle)>0) ? num(m.muscle) : null;
  if (bf==null) return { date:m.date, weight:w, bf:null, fatKg:null, lbm:null, muscle };
  const fatKg = w*bf/100;
  return { date:m.date, weight:w, bf, fatKg:rd1(fatKg), lbm:rd1(w-fatKg), muscle };
};
// 제지방량을 유지한다고 볼 때, 목표 체지방률에서의 체중

const weightAtBF = (lbm, targetBF) => {
  const t = num(targetBF);
  if (!num(lbm) || t<=0 || t>=60) return null;
  return rd1(num(lbm) / (1 - t/100));
};
// 체지방률 구간 — 남성/여성 기준이 다르다

const BF_ZONES = {
  m: [
    { max:8,  key:"매우 낮음", color:"#6BA8FF", advice:"벌크에 아주 유리한 구간이에요. 잉여 칼로리를 조금 더 줘도 괜찮아요." },
    { max:15, key:"이상적",    color:"#B6E34B", advice:"린매스업에 가장 좋은 구간이에요. 지금 속도를 유지해보세요." },
    { max:20, key:"보통",      color:"#FFC24B", advice:"벌크를 이어가도 되지만, 여기서 더 오르면 컷이 길어져요. 잉여를 줄여보세요." },
    { max:25, key:"높음",      color:"#FF8C42", advice:"벌크보다 체지방을 먼저 줄이는 게 나아요. 유지 칼로리 근처로 낮춰보세요." },
    { max:99, key:"매우 높음", color:"#FF6B6B", advice:"먼저 감량 구간을 갖는 걸 권해요. 근육은 약간의 적자에서도 유지돼요." },
  ],
  f: [
    { max:16, key:"매우 낮음", color:"#6BA8FF", advice:"벌크에 유리하지만 너무 낮으면 호르몬·컨디션에 부담이 돼요." },
    { max:23, key:"이상적",    color:"#B6E34B", advice:"린매스업에 가장 좋은 구간이에요. 지금 속도를 유지해보세요." },
    { max:28, key:"보통",      color:"#FFC24B", advice:"벌크를 이어가도 되지만, 잉여를 조금 줄이면 더 깔끔해요." },
    { max:33, key:"높음",      color:"#FF8C42", advice:"체지방을 먼저 줄이는 편이 이후 벌크에 유리해요." },
    { max:99, key:"매우 높음", color:"#FF6B6B", advice:"먼저 감량 구간을 갖는 걸 권해요." },
  ],
};

const bfZone = (bf, sex) => {
  if (bf==null) return null;
  const table = BF_ZONES[sex==="f" ? "f" : "m"];
  return table.find(z => num(bf) <= z.max) || table[table.length-1];
};
// 린매스업 권장 증량 속도: 주당 체중의 0.25~0.5%

const leanGainRange = (weight) => {
  const w = num(weight);
  if (!w) return null;
  return { low: rd1(w*0.0025), high: rd1(w*0.005) };
};
// 두 측정 사이의 변화를 나눠 본다 — 늘어난 게 근육인지 지방인지

const compTrend = (first, last) => {
  const a = bodyComp(first), b = bodyComp(last);
  if (!a || !b) return null;
  const days = (new Date(b.date+"T00:00:00") - new Date(a.date+"T00:00:00")) / 86400000;
  if (days < 7) return { tooShort:true, days };
  const dW = rd1(b.weight - a.weight);
  const perWeek = rd1(dW / days * 7);
  if (a.lbm==null || b.lbm==null) return { days, dW, perWeek, partial:true };
  const dLbm = rd1(b.lbm - a.lbm);
  const dFat = rd1(b.fatKg - a.fatKg);
  // 늘어난 체중 중 제지방 비율 (근육으로 간 비율)
  const gain = dLbm + dFat;
  const lbmShare = Math.abs(gain) > 0.2 ? Math.round(dLbm/gain*100) : null;
  return { days, dW, perWeek, dLbm, dFat, lbmShare, dBf: rd1(b.bf - a.bf) };
};
// 추세를 보고 한 줄 방향 제시

const bulkVerdict = (trend, weight) => {
  if (!trend || trend.tooShort || trend.partial) return null;
  const range = leanGainRange(weight);
  const hi = range ? range.high : 0.4, lo = range ? range.low : 0.2;
  const { dLbm, dFat, perWeek } = trend;

  // 판정 순서가 결과를 좌우하므로, 좁은 조건부터 확인한다
  // 1) 근육 늘고 지방 줄었다 — 가장 좋은 경우 (리컴프)
  if (dLbm > 0.2 && dFat < -0.2)
    return { tone:"good", title:"근육은 늘고 체지방은 줄었어요",
      msg:"가장 좋은 흐름이에요. 지금 칼로리·단백질·훈련을 그대로 유지하세요." };
  // 2) 거의 변화 없음 = 정체
  if (Math.abs(perWeek) < 0.05 && Math.abs(dLbm) < 0.3 && Math.abs(dFat) < 0.3)
    return { tone:"warn", title:"체중이 정체 중이에요",
      msg:`린매스업이라면 주 ${lo}~${hi}kg 증량이 목표예요. 잉여 칼로리를 100~200kcal 올려보세요.` };
  // 3) 지방만 늘었다
  if (dFat > 0.3 && dLbm <= 0.1)
    return { tone:"bad", title:"체지방만 늘고 있어요",
      msg:"잉여 칼로리를 200kcal 정도 줄이고, 단백질 섭취와 훈련 볼륨을 먼저 점검해보세요." };
  // 4) 제지방이 줄었다
  if (dLbm < -0.3)
    return { tone:"warn", title:"제지방(근육)이 줄었어요",
      msg:"칼로리나 단백질이 모자랄 수 있어요. 잉여를 조금 올리고 단백질을 체중×2g까지 맞춰보세요." };
  // 5) 늘긴 했지만 지방이 더 많이
  if (dLbm > 0 && dFat > dLbm)
    return { tone:"warn", title:"증량이 조금 빨라요",
      msg:`근육보다 체지방이 더 늘었어요. 주 증량을 ${hi}kg 이하로 낮추면 더 깔끔해져요.` };
  // 6) 근육 위주로 늘었다
  if (dLbm > 0.2 && dFat <= 0.2)
    return { tone:"good", title:"이상적인 린매스업이에요",
      msg:"근육은 늘고 체지방은 거의 그대로예요. 지금 페이스를 유지하세요." };
  // 7) 근육 위주로 늘되 지방도 조금 (린매스업에서 가장 흔한 정상 흐름)
  if (dLbm > 0.2 && dFat > 0.2 && dLbm > dFat) {
    const share = trend.lbmShare;
    return { tone:"good", title:"근육 위주로 늘고 있어요",
      msg: (share!=null ? `늘어난 체중의 약 ${Math.min(100,share)}%가 제지방이에요. ` : "")
        + (perWeek > hi ? `다만 주 ${perWeek}kg는 조금 빨라요 — ${hi}kg 이하로 낮추면 체지방을 덜 붙일 수 있어요.`
                        : "지금 칼로리·훈련을 그대로 유지하세요.") };
  }
  // 8) 증량 속도가 권장보다 빠름
  if (perWeek > hi)
    return { tone:"warn", title:"증량 속도가 권장보다 빨라요",
      msg:`주 ${perWeek}kg 늘고 있어요. ${lo}~${hi}kg 사이가 체지방을 덜 붙이면서 늘리는 구간이에요.` };
  return { tone:"good", title:"방향은 괜찮아요", msg:"측정을 몇 번 더 쌓으면 더 정확하게 볼 수 있어요." };
};

export default function Body({ data, persist, mutate, target, latestWeight, tdee }) {
  const [m, setM] = useState({ date:todayKey(), weight:"", fat:"", muscle:"", note:"" });
  const [metric, setMetric] = useState("weight");
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const exportTaRef = React.useRef(null);
  const profile = data.profile;

  const setProfile = (patch) => mutate((prev)=>({ ...prev, profile:{ ...prev.profile, ...patch } }));

  const addMeasure = () => { if(!m.weight) return;
    const entry={ id:uid(), date:m.date, weight:num(m.weight), fat:m.fat?num(m.fat):null, muscle:m.muscle?num(m.muscle):null, note:m.note };
    persist({ ...data, measurements:[...data.measurements.filter(x=>x.date!==m.date), entry] });
    setM({ date:todayKey(), weight:"", fat:"", muscle:"", note:"" }); };
  const rmMeasure = (id)=> { const it=data.measurements.find(x=>x.id===id);
    persist({ ...data, measurements:data.measurements.filter(x=>x.id!==id) }, it?`${it.date.slice(5).replace("-",".")} 측정`:"측정 기록"); };

  const sorted = [...data.measurements].sort((a,b)=>a.date.localeCompare(b.date));
  const sortedDesc = [...sorted].reverse();
  const h = num(profile.height);
  const bmi = (h>0&&latestWeight)?(latestWeight/((h/100)**2)).toFixed(1):null;
  const latestFat = sortedDesc.find(x=>x.fat!=null)?.fat ?? null;

  const metricPts = sorted.filter(x=> metric==="weight"?true: metric==="fat"?x.fat!=null: x.muscle!=null)
    .map(x=>({ label:x.date.slice(5).replace("-","."), value: metric==="weight"?x.weight: metric==="fat"?x.fat: x.muscle }));
  const metricColor = metric==="weight"?TYPES.legs.color: metric==="fat"?C.amber: TYPES.pull.color;

  // 목표 진행률
  const goalW = num(profile.goalWeight);
  const startW = sorted.length?sorted[0].weight:null;
  const goalPct = (goalW&&startW&&latestWeight&&goalW!==startW)? Math.max(0,Math.min(100, Math.round((latestWeight-startW)/(goalW-startW)*100))):null;

  // 목표 도달 예상 (최근 42일 측정 추세 기반)
  const goalETA = (()=>{
    if (!goalW || !latestWeight || sorted.length<2) return null;
    const remaining = goalW - latestWeight;
    if (Math.abs(remaining) < 0.1) return { reached:true };
    const lastDate = new Date(sorted[sorted.length-1].date+"T00:00:00");
    const wStart = new Date(lastDate); wStart.setDate(wStart.getDate()-42);
    let pts = sorted.filter(x=> new Date(x.date+"T00:00:00") >= wStart);
    if (pts.length<2) pts = sorted.slice(-4);
    const first = pts[0], last = pts[pts.length-1];
    const days = (new Date(last.date+"T00:00:00") - new Date(first.date+"T00:00:00"))/86400000;
    if (days < 3) return { tooSoon:true };
    const ratePerWeek = (last.weight - first.weight)/days*7;
    if (Math.abs(ratePerWeek) < 0.05) return { flat:true };
    if (Math.sign(ratePerWeek) !== Math.sign(remaining)) return { diverging:true, ratePerWeek };
    const weeks = remaining / ratePerWeek;
    const eta = new Date(); eta.setDate(eta.getDate()+Math.round(weeks*7));
    return { weeks, eta, ratePerWeek };
  })();
  const fmtRate = (r)=> `주 ${r>=0?"+":""}${Math.round(r*100)/100}kg`;

  const markBackedUp = () => mutate((prev)=>({ ...prev, lastBackupAt: Date.now() }));
  const exportData = () => {
    // 모바일 웹뷰에서는 파일 다운로드가 막히는 경우가 많아서, 화면에 텍스트를 띄워 복사하는 방식을 기본으로 씀
    setExportOpen(true);
    setCopyMsg("");
    try { // 가능하면 다운로드도 같이 시도 (안 되면 무시)
      const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url; a.download=`gym-backup-${todayKey()}.json`; a.click(); URL.revokeObjectURL(url);
    } catch(e){}
  };
  // 파일로 공유 — 드라이브·파일앱·카톡 등에 그대로 저장할 수 있어 텍스트 복사보다 안전하다
  const shareBackupFile = async () => {
    const text = JSON.stringify(data, null, 2);
    const name = `린메스업-백업-${todayKey()}.json`;
    try {
      const file = new File([text], name, { type:"application/json" });
      if (navigator.canShare && navigator.canShare({ files:[file] })) {
        await navigator.share({ files:[file], title:"린메스업 백업" });
        markBackedUp(); setCopyMsg("공유한 곳에 파일이 저장됐어요. 드라이브나 파일 앱에 두면 안전해요.");
        return;
      }
    } catch(e) {
      if (e && e.name === "AbortError") return;   // 사용자가 공유를 취소한 경우
    }
    // 공유를 못 쓰면 다운로드로
    try {
      const blob = new Blob([text], { type:"application/json" });
      const url = URL.createObjectURL(blob);
      const a2 = document.createElement("a");
      a2.href = url; a2.download = name; a2.click();
      setTimeout(()=>URL.revokeObjectURL(url), 1000);
      markBackedUp(); setCopyMsg("파일을 내려받았어요. '파일' 앱이나 다운로드 폴더에서 확인하세요.");
    } catch(e2) {
      setCopyMsg("파일 저장이 막혔어요. 아래 텍스트를 복사해서 보관해주세요.");
    }
  };
  // 백업 파일을 골라서 그대로 복원
  const loadBackupFile = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { setImportText(String(r.result||"")); setImportMsg("파일을 읽었어요. 아래 '가져오기 적용'을 눌러주세요."); };
    r.onerror = () => setImportMsg("파일을 읽지 못했어요.");
    r.readAsText(f);
    ev.target.value = "";   // 같은 파일을 다시 고를 수 있게
  };
  const copyBackup = async () => {
    const text = JSON.stringify(data, null, 2);
    const done = () => { setCopyMsg("복사됐어요! 메모장·메시지 등에 붙여넣어 보관하세요."); markBackedUp(); };
    try { await navigator.clipboard.writeText(text); done(); return; } catch(e){}
    try {
      const ta = exportTaRef.current;
      if (ta) { ta.focus(); ta.select(); const ok = document.execCommand("copy"); if(ok){ done(); } else { setCopyMsg("자동 복사가 안 돼요. 아래 텍스트를 길게 눌러 직접 선택 후 복사해주세요."); } return; }
    } catch(e){}
    setCopyMsg("자동 복사가 안 돼요. 아래 텍스트를 길게 눌러 직접 선택 후 복사해주세요.");
  };
  // 마지막 백업 경과일 + 백업할 만한 데이터가 쌓였는지
  const daysSinceBackup = data.lastBackupAt ? Math.floor((Date.now()-data.lastBackupAt)/86400000) : null;
  const hasMeaningfulData = Object.keys(data.schedule).length >= 3 || data.measurements.length >= 2;
  const backupStale = hasMeaningfulData && (daysSinceBackup===null || daysSinceBackup>=7);
  const doImport = () => { try { const parsed=normalize(JSON.parse(importText)); persist(parsed); setImportText(""); setImportMsg("가져오기 완료!"); }
    catch(e){ setImportMsg("JSON 형식이 올바르지 않아요."); } };

  return (
    <div style={{ padding:"22px 18px 8px" }}>
      <div style={{ fontSize:11, letterSpacing:3, color:TYPES.push.color, fontWeight:800 }}>BODY LOG</div>
      <div style={{ fontSize:30, fontWeight:800, letterSpacing:-1, marginTop:4 }}>내 몸 기록</div>

      <div style={{ display:"flex", gap:10 }}>
        <MiniCard label="현재 체중" value={latestWeight?`${latestWeight}`:"—"} unit="kg" color={TYPES.legs.color} />
        <MiniCard label="체지방" value={latestFat!=null?`${latestFat}`:"—"} unit="%" color={C.amber} />
        <MiniCard label="BMI" value={bmi||"—"} unit="" color={C.text} />
      </div>

      {/* 프로필 (TDEE용) */}
      <Card>
        <Row><span style={lbl}>프로필</span>{tdee!=null && <span style={{ fontSize:12, color:C.muted }}>유지 칼로리 ≈ {tdee}kcal</span>}</Row>
        <div style={{ display:"flex", gap:6, marginTop:10 }}>
          <Field label="키 cm" v={profile.height} on={(v)=>setProfile({height:v})} />
          <Field label="나이" v={profile.age} on={(v)=>setProfile({age:v})} />
        </div>
        <div style={{ fontSize:11, color:C.muted, margin:"12px 0 6px" }}>성별</div>
        <div style={{ display:"flex", gap:7 }}>
          <button onClick={()=>setProfile({sex:"m"})} style={{...chip(profile.sex==="m",TYPES.pull.color), flex:1, textAlign:"center"}}>남성</button>
          <button onClick={()=>setProfile({sex:"f"})} style={{...chip(profile.sex==="f",TYPES.lower.color), flex:1, textAlign:"center"}}>여성</button>
        </div>
        <div style={{ fontSize:11, color:C.muted, margin:"12px 0 6px" }}>활동량</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {ACTIVITY.map((a)=>(<button key={a.k} onClick={()=>setProfile({activity:a.k})} style={{...chip(profile.activity===a.k,STUDY_ACCENT), flex:1, textAlign:"center", minWidth:0}}>{a.label}</button>))}
        </div>
        <div style={{ fontSize:11, color:C.muted, margin:"12px 0 6px" }}>목표 <span style={{ opacity:0.7 }}>(탄단지 권장 비율이 이에 맞춰 바뀌어요)</span></div>
        <div style={{ display:"flex", gap:6 }}>
          {Object.values(MACRO_GOALS).map((g)=>{
            const on = (profile.macroGoal||"lean")===g.key;
            return (
              <button key={g.key} onClick={()=>setProfile({macroGoal:g.key})} style={{ flex:1, minWidth:0, padding:"9px 4px", borderRadius:10, cursor:"pointer",
                border:`1.5px solid ${on?g.color:C.line}`, background:on?tint(g.color,0.14):C.surface2, textAlign:"center" }}>
                <div style={{ fontSize:12, fontWeight:800, color:on?g.color:C.text }}>{g.label}</div>
                <div style={{ fontSize:9, color:C.muted, marginTop:2 }}>탄{g.carb}·단{g.protein}·지{g.fat}</div>
              </button>
            );
          })}
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:14, padding:"10px 12px", background:C.surface2, borderRadius:10 }}>
          <div><div style={{ fontSize:13, fontWeight:700 }}>목표 잉여/적자</div><div style={{ fontSize:11, color:C.muted }}>recomp 0 · 벌크 +250 · 컷 −300</div></div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={()=>setProfile({surplus:num(profile.surplus)-50})} style={stepBtn}>–</button>
            <span style={{ fontSize:14, fontWeight:800, minWidth:56, textAlign:"center", color: num(profile.surplus)>=0?TYPES.legs.color:C.danger }}>{num(profile.surplus)>=0?"+":""}{num(profile.surplus)}</span>
            <button onClick={()=>setProfile({surplus:num(profile.surplus)+50})} style={stepBtn}>+</button>
          </div>
        </div>
      </Card>

      {/* 체성분 분석 + 방향 제시 */}
      <BodyCompCard sorted={sorted} profile={profile} />

      {/* 목표 */}
      <Card>
        <Row><span style={lbl}>목표</span></Row>
        <div style={{ display:"flex", gap:6, marginTop:10 }}>
          <Field label="목표 체중 kg" v={profile.goalWeight} on={(v)=>setProfile({goalWeight:v})} />
          <Field label="목표 체지방 %" v={profile.goalFat} on={(v)=>setProfile({goalFat:v})} />
        </div>
        {goalPct!=null && (<>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted, margin:"14px 0 6px" }}>
            <span>{startW}kg</span><span style={{ color:TYPES.legs.color, fontWeight:700 }}>{latestWeight}kg</span><span>{goalW}kg</span>
          </div>
          <div style={{ height:8, background:C.surface2, borderRadius:99, overflow:"hidden" }}>
            <div style={{ width:`${goalPct}%`, height:"100%", background:TYPES.legs.color, borderRadius:99 }} /></div>
          <div style={{ fontSize:11, color:C.muted, marginTop:6, textAlign:"right" }}>목표까지 {(goalW-latestWeight).toFixed(1)}kg</div>
          {goalETA && (
            <div style={{ marginTop:10, padding:"11px 12px", borderRadius:10, background:C.surface2,
              border:`1px solid ${goalETA.eta?tint(TYPES.legs.color,0.4):goalETA.diverging?tint(C.danger,0.4):C.line}` }}>
              {goalETA.reached ? (
                <span style={{ fontSize:12.5, fontWeight:800, color:TYPES.legs.color }}>🎉 목표 도달! 새 목표를 세워볼까요?</span>
              ) : goalETA.eta ? (
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:TYPES.legs.color }}>🎯 약 {Math.max(1,Math.round(goalETA.weeks))}주 후 도달 예상</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{goalETA.eta.getFullYear()}.{goalETA.eta.getMonth()+1}.{goalETA.eta.getDate()} 즈음 · 최근 페이스 {fmtRate(goalETA.ratePerWeek)}</div>
                </div>
              ) : goalETA.diverging ? (
                <span style={{ fontSize:12, fontWeight:700, color:C.danger }}>⚠️ 최근 추세({fmtRate(goalETA.ratePerWeek)})로는 목표에서 멀어지고 있어요</span>
              ) : goalETA.flat ? (
                <span style={{ fontSize:12, fontWeight:700, color:C.muted }}>최근 체중 변화가 거의 없어 도달 시점을 예측하기 어려워요</span>
              ) : (
                <span style={{ fontSize:12, fontWeight:700, color:C.muted }}>추세를 계산하려면 체중 기록이 조금 더 필요해요</span>
              )}
            </div>
          )}
        </>)}
      </Card>

      {/* 추이 그래프 */}
      <Card>
        <Row><span style={lbl}>변화 추이</span></Row>
        <div style={{ display:"flex", gap:7, marginTop:10 }}>
          {[["weight","체중"],["fat","체지방"],["muscle","골격근"]].map(([k,label])=>(
            <button key={k} onClick={()=>setMetric(k)} style={{...chip(metric===k, k==="weight"?TYPES.legs.color:k==="fat"?C.amber:TYPES.pull.color), flex:1, textAlign:"center"}}>{label}</button>
          ))}
        </div>
        <LineChart points={metricPts} color={metricColor} unit={metric==="fat"?"%":"kg"} empty={`${metric==="weight"?"체중":metric==="fat"?"체지방":"골격근"} 측정을 2회 이상 기록하면 그래프가 나와요.`} />
      </Card>

      {/* 측정 추가 */}
      <Card>
        <Row><span style={lbl}>측정 기록 추가</span><span style={{ fontSize:11, color:C.muted }}>인바디 측정일에 입력</span></Row>
        <input type="date" value={m.date} onChange={(e)=>setM({...m,date:e.target.value})} style={{...inp, width:"100%", boxSizing:"border-box", marginTop:8, colorScheme:"dark"}} />
        <div style={{ display:"flex", gap:6, marginTop:8 }}>
          <Field label="체중kg" v={m.weight} on={(v)=>setM({...m,weight:v})} />
          <Field label="체지방%" v={m.fat} on={(v)=>setM({...m,fat:v})} />
          <Field label="골격근kg" v={m.muscle} on={(v)=>setM({...m,muscle:v})} />
        </div>
        <input value={m.note} onChange={(e)=>setM({...m,note:e.target.value})} placeholder="메모 (선택)" style={{...inp, width:"100%", boxSizing:"border-box", marginTop:8}} />
        <button onClick={addMeasure} style={{...primary(TYPES.legs.color), width:"100%", marginTop:8}}>기록 저장</button>
      </Card>

      {sortedDesc.length>0 && (
        <Card>
          <Row><span style={lbl}>측정 이력</span></Row>
          {sortedDesc.map((x)=>(
            <div key={x.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.line}` }}>
              <div><div style={{ fontSize:13, fontWeight:700 }}>{x.date.replace(/-/g,".")}</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{x.weight}kg{x.fat!=null?` · 체지방 ${x.fat}%`:""}{x.muscle!=null?` · 골격근 ${x.muscle}kg`:""}</div>
                {x.note && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{x.note}</div>}</div>
              <ConfirmX onConfirm={()=>rmMeasure(x.id)} label="측정 삭제" />
            </div>
          ))}
        </Card>
      )}

      {/* 백업 */}
      <Card>
        <Row><span style={lbl}>데이터 백업</span>
          <span style={{ fontSize:11.5, color: backupStale?C.amber:C.muted, fontWeight:backupStale?800:600 }}>
            {daysSinceBackup===null ? "백업 기록 없음" : daysSinceBackup===0 ? "오늘 백업함 ✓" : `${daysSinceBackup}일 전 백업`}
          </span>
        </Row>
        {backupStale && (
          <div style={{ marginTop:10, padding:"11px 12px", background:tint(C.amber,0.1), border:`1px solid ${tint(C.amber,0.4)}`, borderRadius:10, display:"flex", gap:9, alignItems:"flex-start" }}>
            <span style={{ fontSize:15, lineHeight:1.3 }}>⚠️</span>
            <span style={{ fontSize:11.5, color:C.amber, fontWeight:700, lineHeight:1.55 }}>
              {daysSinceBackup===null ? "아직 백업한 적이 없어요. 기기·브라우저 데이터가 지워지면 기록이 사라질 수 있으니 지금 한 번 백업해두세요." : "백업한 지 오래됐어요. 최근 기록을 잃지 않으려면 다시 백업해두는 게 좋아요."}
            </span>
          </div>
        )}
        {/* 파일로 저장이 가장 안전 — 드라이브·파일앱에 두면 폰이 바뀌어도 살아남는다 */}
        <button onClick={shareBackupFile} style={{...primary(backupStale?C.amber:TYPES.legs.color), width:"100%", marginTop:10, color:"#141519"}}>
          📁 백업 파일 저장 · 공유
        </button>
        <div style={{ fontSize:10.5, color:C.muted, marginTop:7, lineHeight:1.5 }}>
          드라이브·파일 앱·나에게 보내기 등에 저장하면 폰이 바뀌어도 기록을 되살릴 수 있어요.
        </div>
        {copyMsg && <div style={{ fontSize:11.5, color: copyMsg.includes("막혔")?C.amber:TYPES.legs.color, marginTop:8, lineHeight:1.55 }}>{copyMsg}</div>}

        <button onClick={exportData} style={{...ghost, width:"100%", marginTop:9, fontSize:12}}>텍스트로 복사하기</button>
        {exportOpen && (
          <div style={{ marginTop:10 }}>
            <textarea ref={exportTaRef} readOnly value={JSON.stringify(data,null,2)} rows={4}
              onFocus={(e)=>e.target.select()}
              style={{...inp, width:"100%", boxSizing:"border-box", resize:"none", fontFamily:"monospace", fontSize:11, lineHeight:1.4}} />
            <button onClick={copyBackup} style={{...primary(TYPES.legs.color), width:"100%", marginTop:8}}>복사하기</button>
          </div>
        )}

        <div style={{ height:1, background:C.line, margin:"16px 0 14px" }} />

        <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>복원하기</div>
        <label style={{...ghost, width:"100%", marginBottom:8, display:"block", textAlign:"center",
          boxSizing:"border-box", cursor:"pointer"}}>
          📂 백업 파일 불러오기
          <input type="file" accept=".json,application/json,text/plain" onChange={loadBackupFile}
            style={{ display:"none" }} />
        </label>
        <textarea value={importText} onChange={(e)=>setImportText(e.target.value)} rows={2} placeholder='또는 백업 텍스트를 붙여넣기'
          style={{...inp, width:"100%", boxSizing:"border-box", resize:"none", fontFamily:"monospace", fontSize:12}} />
        <button onClick={doImport} style={{...ghost, width:"100%", marginTop:8}}>가져오기 적용</button>
        {importMsg && <div style={{ fontSize:12, color: importMsg.includes("완료")?TYPES.legs.color:C.danger, marginTop:8, lineHeight:1.55 }}>{importMsg}</div>}
      </Card>

      {/* API 키 — 없어도 대부분 쓸 수 있으니 맨 아래에 접어둔다 */}
      <Collapsible title="AI 기능 · API 키" accent={TYPES.push.color}
        summary={profile.apiKey ? "연결됨" : "선택 사항"}>
        <Card>
          <div style={{ fontSize:11.5, color:C.muted, lineHeight:1.6 }}>
            자주 먹는 음식·유명 프랜차이즈는 <b style={{color:C.text}}>키 없이도 무료로 즉시</b> 계산돼요.
            목록에 없는 음식을 자동으로 채우거나, 단어장 AI 채우기를 쓰려면 본인의 Anthropic API 키를 넣으면 돼요.
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color:TYPES.push.color, marginLeft:4 }}>여기서 발급</a>
          </div>
          <ApiKeyInput value={profile.apiKey} onSave={(v)=>setProfile({apiKey:v})} />
          <div style={{ fontSize:10.5, color:C.muted, marginTop:8, lineHeight:1.5 }}>
            키는 이 브라우저에만 저장되고, 쓴 만큼만 요금이 나가요.
          </div>
        </Card>
      </Collapsible>
    </div>
  );
}

// ================= 회복 · 주간 운동 목표 =================
// 벌크 중엔 "더 많이"보다 "회복되는 만큼"이 중요해서, 경고와 목표를 함께 둔다.

function BodyCompCard({ sorted, profile }) {
  const [range, setRange] = useState(8); // 비교 기간(주)
  const withBf = sorted.filter(m => num(m.fat) > 0);
  const latest = sorted.length ? sorted[sorted.length-1] : null;
  const cur = bodyComp(latest);

  if (!cur) return null;
  const zone = bfZone(cur.bf, profile.sex);
  const goalBF = num(profile.goalFat);
  const targetW = (cur.lbm!=null && goalBF>0) ? weightAtBF(cur.lbm, goalBF) : null;
  const toLose = targetW!=null ? rd1(cur.weight - targetW) : null;
  const gainRange = leanGainRange(cur.weight);

  // 선택한 기간 안에서 가장 오래된 체지방 측정과 최신을 비교
  const cutoff = (()=>{ const d=new Date(); d.setDate(d.getDate()-range*7); return keyOf(d.getFullYear(),d.getMonth(),d.getDate()); })();
  const inRange = withBf.filter(m => m.date >= cutoff);
  const base = inRange.length>=2 ? inRange[0] : (withBf.length>=2 ? withBf[withBf.length-2] : null);
  const trend = (base && withBf.length>=2) ? compTrend(base, withBf[withBf.length-1]) : null;
  const verdict = bulkVerdict(trend, cur.weight);
  const toneColor = { good:TYPES.legs.color, warn:C.amber, bad:C.danger };

  return (
    <Card>
      <Row><span style={lbl}>체성분 분석</span>
        {cur.bf!=null && zone && (
          <span style={{ fontSize:11, fontWeight:800, color:zone.color, background:tint(zone.color,0.14),
            border:`1px solid ${tint(zone.color,0.4)}`, borderRadius:999, padding:"3px 10px" }}>{zone.key}</span>
        )}
      </Row>

      {cur.bf==null ? (
        <div style={{ fontSize:12.5, color:C.muted, marginTop:10, lineHeight:1.7 }}>
          체중만 있으면 늘어난 게 <b style={{color:C.text}}>근육인지 체지방인지</b> 알 수 없어요.
          아래 측정 추가에서 <b style={{color:C.text}}>체지방률</b>을 같이 넣으면 방향까지 알려드려요.
          <div style={{ fontSize:11, marginTop:7 }}>인바디·가정용 체성분계 값이면 충분해요.</div>
        </div>
      ) : (<>
        {/* 현재 구성 */}
        <div style={{ display:"flex", gap:6, marginTop:12 }}>
          {[["체중", `${cur.weight}`, "kg", C.text],
            ["체지방", `${cur.bf}`, "%", zone?zone.color:C.muted],
            ["체지방량", `${cur.fatKg}`, "kg", "#FF8C42"],
            ["제지방량", `${cur.lbm}`, "kg", TYPES.legs.color]].map(([label,v,unit,col])=>(
            <div key={label} style={{ flex:1, minWidth:0, background:C.surface2, borderRadius:10, padding:"9px 6px", textAlign:"center" }}>
              <div style={{ fontSize:9.5, color:C.muted, fontWeight:600 }}>{label}</div>
              <div style={{ fontSize:15, fontWeight:800, color:col, marginTop:2 }}>{v}<span style={{ fontSize:9, color:C.muted }}>{unit}</span></div>
            </div>
          ))}
        </div>
        {/* 체지방 : 제지방 비율 막대 */}
        <div style={{ display:"flex", height:9, borderRadius:99, overflow:"hidden", marginTop:9 }}>
          <div style={{ width:`${100-cur.bf}%`, background:TYPES.legs.color }} />
          <div style={{ width:`${cur.bf}%`, background:"#FF8C42" }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
          <span style={{ fontSize:9.5, color:TYPES.legs.color, fontWeight:700 }}>제지방 {100-cur.bf}%</span>
          <span style={{ fontSize:9.5, color:"#FF8C42", fontWeight:700 }}>체지방 {cur.bf}%</span>
        </div>
        {cur.muscle!=null && (
          <div style={{ fontSize:10.5, color:C.muted, marginTop:7 }}>입력한 골격근량 {cur.muscle}kg · 제지방량에는 뼈·수분도 포함돼요</div>
        )}

        {/* 구간 조언 */}
        {zone && (
          <div style={{ marginTop:12, padding:"11px 12px", borderRadius:10,
            background:tint(zone.color,0.09), border:`1px solid ${tint(zone.color,0.32)}` }}>
            <div style={{ fontSize:12, fontWeight:800, color:zone.color }}>
              체지방 {cur.bf}% · {zone.key} 구간
            </div>
            <div style={{ fontSize:11.5, color:C.muted, marginTop:4, lineHeight:1.6 }}>{zone.advice}</div>
          </div>
        )}

        {/* 목표 체지방률까지 */}
        {targetW!=null ? (
          <div style={{ marginTop:10, padding:"11px 12px", borderRadius:10, background:C.surface2 }}>
            <div style={{ fontSize:11.5, color:C.muted, fontWeight:700, marginBottom:6 }}>목표 체지방 {goalBF}%까지</div>
            {toLose > 0.2 ? (
              <div style={{ fontSize:12.5, lineHeight:1.7 }}>
                지금 근육을 <b style={{color:C.text}}>그대로 유지</b>하면서 체지방만 줄이면
                <b style={{color:"#FF8C42"}}> {Math.abs(toLose)}kg 감량</b> → 약 <b style={{color:C.text}}>{targetW}kg</b>에서 목표에 닿아요.
                <div style={{ fontSize:11, color:C.muted, marginTop:5 }}>
                  주 0.5kg씩 빼면 약 {Math.ceil(Math.abs(toLose)/0.5)}주 걸려요. 이 속도가 근육을 지키는 선이에요.
                </div>
              </div>
            ) : toLose < -0.2 ? (
              <div style={{ fontSize:12.5, lineHeight:1.7 }}>
                목표보다 이미 <b style={{color:TYPES.legs.color}}>{Math.abs(toLose)}kg 여유</b>가 있어요.
                제지방을 유지하며 <b style={{color:C.text}}>{targetW}kg</b>까지는 늘려도 목표 체지방률 안이에요.
              </div>
            ) : (
              <div style={{ fontSize:12.5, color:TYPES.legs.color, fontWeight:700 }}>🎉 목표 체지방률에 도달했어요</div>
            )}
          </div>
        ) : (
          <div style={{ fontSize:11, color:C.muted, marginTop:10, lineHeight:1.55 }}>
            위 목표 칸에 <b style={{color:C.text}}>목표 체지방 %</b>를 넣으면, 근육을 지키면서 몇 kg까지 빼면 되는지 계산해드려요.
          </div>
        )}

        {/* 추세 + 방향 */}
        <div style={{ height:1, background:C.line, margin:"14px 0 12px" }} />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
          <span style={{ fontSize:11.5, color:C.muted, fontWeight:700 }}>변화 추세</span>
          <div style={{ display:"flex", gap:5 }}>
            {[[4,"4주"],[8,"8주"],[12,"12주"]].map(([v,label])=>(
              <button key={v} onClick={()=>setRange(v)} style={{...chip(range===v, TYPES.push.color), padding:"4px 10px", fontSize:11}}>{label}</button>
            ))}
          </div>
        </div>

        {!trend ? (
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
            체지방률을 포함한 측정이 <b style={{color:C.text}}>2회 이상</b> 있어야 근육·지방 변화를 나눠 볼 수 있어요.
          </div>
        ) : trend.tooShort ? (
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>측정 간격이 {trend.days}일이라 아직 추세로 보기 어려워요. 1~2주 뒤에 다시 재보세요.</div>
        ) : (<>
          <div style={{ display:"flex", gap:6 }}>
            {[["체중", trend.dW, "kg", C.text],
              ["제지방", trend.dLbm, "kg", TYPES.legs.color],
              ["체지방", trend.dFat, "kg", "#FF8C42"]].map(([label,v,unit,col])=>(
              <div key={label} style={{ flex:1, background:C.surface2, borderRadius:10, padding:"9px 6px", textAlign:"center" }}>
                <div style={{ fontSize:9.5, color:C.muted, fontWeight:600 }}>{label}</div>
                <div style={{ fontSize:15, fontWeight:800, marginTop:2,
                  color: label==="체지방" ? (v>0?C.danger:TYPES.legs.color) : (v>0?col:C.danger) }}>
                  {v>0?"+":""}{v}<span style={{ fontSize:9, color:C.muted }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:10.5, color:C.muted, marginTop:7, lineHeight:1.55 }}>
            {trend.days}일 동안 · 주 평균 {trend.perWeek>0?"+":""}{trend.perWeek}kg
            {gainRange ? ` (린매스업 권장 주 ${gainRange.low}~${gainRange.high}kg)` : ""}
          </div>

          {verdict && (
            <div style={{ marginTop:11, padding:"12px 13px", borderRadius:11,
              background:tint(toneColor[verdict.tone],0.1), border:`1px solid ${tint(toneColor[verdict.tone],0.38)}` }}>
              <div style={{ fontSize:12.5, fontWeight:800, color:toneColor[verdict.tone] }}>
                {verdict.tone==="good"?"✓ ":verdict.tone==="bad"?"⚠️ ":"⚡ "}{verdict.title}
              </div>
              <div style={{ fontSize:11.5, color:C.muted, marginTop:5, lineHeight:1.65 }}>{verdict.msg}</div>
            </div>
          )}
        </>)}

        <div style={{ fontSize:10, color:C.muted, marginTop:11, lineHeight:1.5, opacity:0.8 }}>
          체성분계 값은 측정마다 오차가 있어요. 같은 시간·같은 조건에서 재고, 하루 값보다 몇 주 흐름을 보세요.
        </div>
      </>)}
    </Card>
  );
}

// ================= 탄단지 비율 =================
// 실제 섭취 비율(칼로리 기준)을 권장 비율과 나란히 비교

const Field = ({label,v,on}) => (
  <div style={{ flex:1, minWidth:0 }}>
    <div style={{ fontSize:10.5, color:C.muted, marginBottom:4 }}>{label}</div>
    <input value={v} onChange={(e)=>on(e.target.value)} inputMode="decimal" style={{...inp, width:"100%", boxSizing:"border-box"}} />
  </div>
);

function ApiKeyInput({ value, onSave }) {
  const [draft, setDraft] = useState(value || "");
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(()=>{ setDraft(value||""); }, [value]);
  const save = () => { onSave(draft.trim()); setSaved(true); setTimeout(()=>setSaved(false), 1500); };
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ display:"flex", gap:6 }}>
        <input value={draft} onChange={(e)=>setDraft(e.target.value)} type={show?"text":"password"}
          placeholder="sk-ant-..." style={{...inp, flex:1, minWidth:0, fontFamily:"monospace", fontSize:12.5}} />
        <button onClick={()=>setShow((s)=>!s)} style={{...stepBtn, width:44}}>{show?"숨김":"보기"}</button>
      </div>
      <button onClick={save} style={{...primary(TYPES.push.color), width:"100%", marginTop:8}}>{saved?"저장됨 ✓":"키 저장"}</button>
    </div>
  );
}
