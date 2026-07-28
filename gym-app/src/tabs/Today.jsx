import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { TYPES, partBreakdown, CARDIO, WEEKDAYS, vocabTypeInfo, posInfo, REVIEW_GAP, dueList, speakWord, STUDY_ACCENT, SLEEP_ACCENT, MOODS, C, keyOf, todayKey, uid, extraWater, tint, num, show1, fmtMin, last7, lastNDays, didWorkout, emptyDay, stepsToKcal, burnedKcal, MACRO_GOALS, rd1, macroTargets, planDate, QuickWorkoutBlock, CONDITION_LABELS, SleepBlock, FoodSection, LineChart, Bars7, Card, GlassCard, useCountUp, Row, MiniCard, Collapsible, ConfirmX, lbl, inp, primary, ghost, stepBtn, chip } from "../shared.jsx";

export default function Today({ data, updateDay, addFoodsToday, target, tdee, weight, favProps, apiKey, customFoods, mutate }) {
  const k = todayKey();
  const day = data.schedule[k] || emptyDay();
  const proteinSum = day.foods.reduce((s,f)=>s+num(f.protein),0);
  const carbsSum = day.foods.reduce((s,f)=>s+num(f.carbs),0);
  const sugarSum = day.foods.reduce((s,f)=>s+num(f.sugar),0);
  const fatSum = day.foods.reduce((s,f)=>s+num(f.fat),0);
  const kcalIn = day.foods.reduce((s,f)=>s+num(f.kcal),0);
  // 아무 기록도 없고 프로필도 비어 있으면 첫 실행으로 본다
  const isFirstRun = Object.keys(data.schedule).length===0
    && (data.measurements||[]).length===0
    && !data.profile.height;

  // 오늘 계획 (계획 캘린더와 같은 데이터)
  const todayPlans = [...((data.plans||{})[k]||[])].sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  const planDoneCount = todayPlans.filter(p=>p.done).length;
  const togglePlanDone = (id) => mutate((prev)=>{
    const np = { ...(prev.plans||{}) };
    const list = (np[k]||[]).map(p=> p.id===id ? { ...p, done: !p.done } : p);
    np[k] = list;
    return { ...prev, plans: np };
  });

  const stepsKcal = stepsToKcal(day.steps, weight);
  const kcalOut = (day.cardio ? num(day.cardio.kcal) : 0) + stepsKcal;
  const t = day.type ? TYPES[day.type] : null;
  const dt = new Date();

  const net = tdee!=null ? kcalIn - tdee - kcalOut : null; // + 잉여 / - 적자
  const surplus = num(data.profile.surplus);
  const mt = macroTargets(tdee, surplus, weight, target?target.high:null);

  // 최근 7일 단백질
  const days = last7();
  const proteinByDay = days.map((dk)=> (data.schedule[dk]?.foods||[]).reduce((s,f)=>s+num(f.protein),0));
  const sleepByDay = days.map((dk)=> num(data.schedule[dk]?.sleep?.hours));

  const pct = target ? Math.min(100, Math.round(proteinSum/target.high*100)) : 0;
  const studyToday = (data.study||[]).filter((s)=>s.date===k).reduce((a,s)=>a+s.minutes,0);

  // 이번 주 리포트
  const workoutDays = days.filter((dk)=> didWorkout(data.schedule[dk])).length;
  const cardioSessions = days.filter((dk)=> data.schedule[dk]?.cardio).length;
  const avgProtein = Math.round(proteinByDay.reduce((a,b)=>a+b,0)/7);
  const weekNets = days.map((dk)=>{
    const e = data.schedule[dk]; if(!e || tdee==null) return null;
    const inK = (e.foods||[]).reduce((s,f)=>s+num(f.kcal),0);
    const outK = e.cardio?num(e.cardio.kcal):0;
    return inK - tdee - outK;
  }).filter((v)=>v!=null);
  const avgNet = weekNets.length ? Math.round(weekNets.reduce((a,b)=>a+b,0)/weekNets.length) : null;
  const weekStudyMin = (data.study||[]).filter((s)=>days.includes(s.date)).reduce((a,s)=>a+s.minutes,0);
  const weekMeasures = [...data.measurements].filter((m)=>days.includes(m.date)).sort((a,b)=>a.date.localeCompare(b.date));
  const weightDiff = weekMeasures.length>=2 ? weekMeasures[weekMeasures.length-1].weight - weekMeasures[0].weight : null;

  const todaySleep = day.sleep;
  const [sleepOpen, setSleepOpen] = useState(0);   // 값이 바뀔 때 컨디션 묶음을 펼치는 신호
  const [reportOpen, setReportOpen] = useState(false);

  // 스트릭: 어제부터 거슬러 올라가며 연속 달성일 계산 (오늘 달성 시 오늘 포함)
  const calcStreak = (checkFn) => {
    let streak = 0;
    const d = new Date();
    if (checkFn(todayKey())) streak++;
    for (let i=1; i<365; i++) {
      const dd = new Date(); dd.setDate(d.getDate()-i);
      const kk = keyOf(dd.getFullYear(), dd.getMonth(), dd.getDate());
      if (checkFn(kk)) streak++;
      else break;
    }
    return streak;
  };
  const proteinStreak = target ? calcStreak((kk)=>{
    const p = (data.schedule[kk]?.foods||[]).reduce((s,f)=>s+num(f.protein),0);
    return p >= target.low;
  }) : 0;
  const workoutStreak = calcStreak((kk)=> didWorkout(data.schedule[kk]));
  const creatineStreak = calcStreak((kk)=> !!data.schedule[kk]?.creatine);

  // 오늘 달성 점수 (마스코트/게이지용): 판정 가능한 항목의 달성 비율
  const scoreParts = [];
  if (target) scoreParts.push(proteinSum >= target.low);
  if (tdee!=null && day.foods.length) scoreParts.push(Math.abs(net-surplus) <= 250);
  scoreParts.push(didWorkout(day));
  if (mt) scoreParts.push(sugarSum <= mt.sugar);
  if (data.habits.length) scoreParts.push(Object.values(day.habitLog||{}).filter(Boolean).length === data.habits.length);
  const dayScore = scoreParts.length ? Math.round(scoreParts.filter(Boolean).length/scoreParts.length*100) : 0;
  const proteinPct = target ? Math.min(100, Math.round(proteinSum/target.low*100)) : 0;

  // 컨페티: 단백질 목표 첫 달성 or 모든 습관 완료 순간
  const [confettiKey, setConfettiKey] = useState(0);
  const proteinMet = target && proteinSum >= target.low;
  const allHabits = data.habits.length>0 && Object.values(day.habitLog||{}).filter(Boolean).length === data.habits.length;
  const celebrate = proteinMet || allHabits;
  const prevCelebRef = useRef(celebrate);
  useEffect(()=>{
    if (celebrate && !prevCelebRef.current) setConfettiKey((n)=>n+1);
    prevCelebRef.current = celebrate;
  }, [celebrate]);

  return (
    <div style={{ padding:"22px 18px 8px" }}>
      <Confetti fire={confettiKey} />
      <div style={{ fontSize:11, letterSpacing:3, color:TYPES.push.color, fontWeight:800 }}>TODAY</div>
      <div style={{ fontSize:30, fontWeight:800, letterSpacing:-1, marginTop:4 }}>
        {dt.getMonth()+1}월 {dt.getDate()}일 <span style={{ fontSize:15, color:C.muted }}>{WEEKDAYS[dt.getDay()]}</span>
      </div>
      {(proteinStreak>=2 || workoutStreak>=2 || !todaySleep) && (
        <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
          {proteinStreak>=2 && <span style={{ fontSize:11.5, fontWeight:800, color:TYPES.legs.color, background:tint(TYPES.legs.color,0.13), border:`1px solid ${tint(TYPES.legs.color,0.4)}`, borderRadius:999, padding:"5px 11px" }}>🔥 단백질 목표 {proteinStreak}일 연속</span>}
          {workoutStreak>=2 && <span style={{ fontSize:11.5, fontWeight:800, color:TYPES.push.color, background:tint(TYPES.push.color,0.13), border:`1px solid ${tint(TYPES.push.color,0.4)}`, borderRadius:999, padding:"5px 11px" }}>💪 운동 {workoutStreak}일 연속</span>}
          {/* 수면을 안 적었을 때만 뜨는 칩. 적으면 todaySleep이 채워져 자동으로 사라진다. */}
          {!todaySleep && (
            <button onClick={()=>setSleepOpen(n=>n+1)}
              style={{ fontSize:11.5, fontWeight:800, color:SLEEP_ACCENT, background:tint(SLEEP_ACCENT,0.13),
                border:`1px solid ${tint(SLEEP_ACCENT,0.4)}`, borderRadius:999, padding:"5px 11px", cursor:"pointer" }}>
              😴 수면 미기입
            </button>
          )}
        </div>
      )}

      {/* 첫 실행 안내 — 아직 아무것도 없을 때만 */}
      {isFirstRun && (
        <Card>
          <div style={{ fontSize:15, fontWeight:800, marginBottom:6 }}>👋 처음이시죠?</div>
          <div style={{ fontSize:12.5, color:C.muted, lineHeight:1.7 }}>
            세 가지만 해두면 나머지가 알아서 계산돼요.
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:12 }}>
            {[
              ["1", "몸 탭에서 키·나이·체중 넣기", "단백질 목표와 칼로리가 자동으로 잡혀요", TYPES.pull.color],
              ["2", "아래 식단에서 먹은 것 기록", "검색하거나 AI로 한 번에 넣을 수 있어요", TYPES.legs.color],
              ["3", "운동한 부위와 세트수 남기기", "통계·캘린더가 저절로 채워져요", TYPES.push.color],
            ].map(([n,title,desc,col])=>(
              <div key={n} style={{ display:"flex", gap:10, alignItems:"flex-start", background:C.surface2,
                borderRadius:11, padding:"11px 12px" }}>
                <span style={{ width:20, height:20, borderRadius:"50%", background:tint(col,0.2), color:col,
                  fontSize:11, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{n}</span>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:700 }}>{title}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2, lineHeight:1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:10.5, color:C.muted, marginTop:11, lineHeight:1.55 }}>
            기록은 이 휴대폰에 저장돼요. 몸 탭에서 <b style={{color:C.text}}>백업 파일</b>을 한 번 저장해두면 폰이 바뀌어도 안전해요.
          </div>
        </Card>
      )}

      {/* 마스코트 */}
      <GlassCard glow={dayScore>=80?"#7DDB8A":dayScore>=50?"#8FD3FF":dayScore>=1?"#FFC24B":null}>
        <Mascot score={dayScore} proteinPct={proteinPct} workedOut={didWorkout(day)} />
      </GlassCard>

      {/* 오늘 계획 */}
      {todayPlans.length>0 && (
        <Card>
          <Row><span style={lbl}>오늘 계획</span>
            <span style={{ fontSize:11.5, color: planDoneCount===todayPlans.length?TYPES.legs.color:C.muted, fontWeight:700 }}>
              {planDoneCount}/{todayPlans.length} 완료{planDoneCount===todayPlans.length?" 🎉":""}
            </span>
          </Row>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:10 }}>
            {todayPlans.map((p)=>{
              const done = !!p.done;
              const now = new Date();
              const st = planDate(k, p.start);
              const soon = !done && st>now && (st-now) < 2*60*60*1000;
              const past = !done && st<now;
              return (
                <div key={p.id} onClick={()=>togglePlanDone(p.id)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:11, cursor:"pointer",
                    background: done?tint(TYPES.legs.color,0.1):C.surface2,
                    border:`1px solid ${done?tint(TYPES.legs.color,0.4):soon?tint(STUDY_ACCENT,0.45):C.line}`, transition:"all .2s" }}>
                  <div style={{ width:21, height:21, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                    background: done?TYPES.legs.color:"transparent", border:`2px solid ${done?TYPES.legs.color:C.muted}`,
                    color:"#141519", fontSize:12, fontWeight:900 }}>{done?"✓":""}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:800, color: done?C.muted:C.text,
                      textDecoration: done?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                    <div style={{ fontSize:10.5, color: soon?STUDY_ACCENT:C.muted, marginTop:2, fontWeight: soon?700:400 }}>
                      {p.start}{p.end?`~${p.end}`:""}{soon?" · 곧 시작":past?" · 지난 일정":""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 오늘 단어 복습 — 공부 탭까지 안 들어가도 여기서 바로 (번거로움 제거) */}
      <VocabTodayCard vocab={data.vocab||[]} goal={num(data.vocabGoal)||20} mutate={mutate} />

      {/* 칼로리 판정 */}
      <Card>
        <Row><span style={lbl}>칼로리 밸런스</span>
          {tdee!=null && <span style={{ fontSize:12, color:C.muted }}>유지 {tdee}kcal</span>}
        </Row>
        {tdee==null ? (
          <div style={{ color:C.muted, fontSize:13, marginTop:6 }}>몸 탭에서 키·나이·성별을 입력하면 잉여/적자를 계산해줘요.</div>
        ) : (
          <>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:4 }}>
              <span style={{ fontSize:30, fontWeight:800, color: net>=0?TYPES.legs.color:C.danger }}>
                {net>=0?"+":""}<CountUp value={net} />
              </span>
              <span style={{ fontSize:15, color:C.muted }}>kcal · {net>=0?"잉여":"적자"}</span>
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>
              섭취 {Math.round(kcalIn)} · 소모 {Math.round(kcalOut)} · 목표 잉여 {surplus>=0?"+":""}{surplus}
              {" · "}
              <span style={{ color: net>=surplus?TYPES.legs.color:C.amber }}>
                {net>=surplus ? "목표 달성" : `목표까지 ${surplus-net}kcal`}
              </span>
            </div>
          </>
        )}

        {/* 주간 칼로리 뱅킹 — 하루 넘겨도 주 단위로 보면 만회 가능 */}
        {(()=>{
          const bank = calorieBank(data.schedule, weight, tdee, surplus);
          if (!bank || bank.logged < 2) return null;
          const over = bank.diff > 0;
          const col = bank.onTrack ? TYPES.legs.color : over ? C.amber : "#6BA8FF";
          return (
            <div style={{ marginTop:12, padding:"10px 12px", borderRadius:10,
              background:tint(col,0.09), border:`1px solid ${tint(col,0.3)}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                <span style={{ fontSize:11, color:C.muted, fontWeight:700 }}>이번 주 누적</span>
                <span style={{ fontSize:12.5, fontWeight:800, color:col }}>
                  {over?"+":""}{bank.diff}kcal
                </span>
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:5, lineHeight:1.6 }}>
                {bank.onTrack
                  ? "주간 평균이 목표에 잘 맞고 있어요 👍"
                  : bank.remain > 0
                    ? `남은 ${bank.remain}일 동안 하루 ${bank.perRemain}kcal씩 먹으면 주간 목표에 맞아요.`
                    : over ? "이번 주는 목표보다 많이 먹었어요. 다음 주에 조절해봐요."
                           : "이번 주는 목표보다 적게 먹었어요. 벌크 중이면 조금 더 채워보세요."}
              </div>
            </div>
          );
        })()}

        {/* 걸음수 → 소모 칼로리 */}
        <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.line}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
            <span style={{ fontSize:12, fontWeight:800, color:C.muted }}>🚶 걸음수</span>
            {stepsKcal>0 && <span style={{ fontSize:12, fontWeight:800, color:"#5AD1A0" }}>≈ {stepsKcal}kcal 소모</span>}
          </div>
          <div style={{ display:"flex", gap:7, alignItems:"center" }}>
            <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"center", background:C.surface2, borderRadius:10, padding:"0 12px" }}>
              <input value={day.steps ? String(day.steps) : ""} onChange={(e)=>updateDay(k,{steps:Math.max(0,Math.min(100000,Math.round(num(e.target.value.replace(/[^0-9]/g,"")))))})}
                inputMode="numeric" placeholder="0"
                style={{ flex:1, minWidth:0, background:"none", border:"none", outline:"none", color:C.text, fontSize:19, fontWeight:800, padding:"11px 0" }} />
              <span style={{ fontSize:12, color:C.muted, fontWeight:700 }}>보</span>
            </div>
            <div style={{ display:"flex", gap:5 }}>
              {[1000,3000,5000].map((n)=>(
                <button key={n} onClick={()=>updateDay(k,{steps:(num(day.steps)||0)+n})}
                  style={{...chip(false,"#5AD1A0"), padding:"9px 9px", fontSize:11.5}}>+{n/1000}천</button>
              ))}
            </div>
          </div>
          {day.steps>0 ? (
            <div style={{ fontSize:10.5, color:C.muted, marginTop:7, lineHeight:1.5 }}>
              {weight?`체중 ${weight}kg`:"체중 70kg 가정"} 기준 걷기 소모량이에요. 위 칼로리 밸런스에 이미 반영돼 있어요.
              <button onClick={()=>updateDay(k,{steps:0})} style={{ background:"none", border:"none", color:C.danger, fontSize:10.5, fontWeight:700, cursor:"pointer", padding:"0 0 0 6px" }}>지우기</button>
            </div>
          ) : (
            <div style={{ fontSize:10.5, color:C.muted, marginTop:7, lineHeight:1.5 }}>
              휴대폰 건강앱의 걸음수를 입력하면 소모 칼로리로 자동 계산돼요.
            </div>
          )}
        </div>
      </Card>

      {/* 영양 */}
      <Card>
        <Row><span style={lbl}>영양</span>
          <span style={{ fontSize:13, color:C.muted }}>{target?`단백질 목표 ${target.low}~${target.high}g`:"몸무게 입력 필요"}</span>
        </Row>
        <div style={{ fontSize:30, fontWeight:800, marginTop:2 }}><CountUp value={proteinSum} /><span style={{ fontSize:15, color:C.muted }}>g 단백질</span></div>
        <div style={{ height:8, background:C.surface2, borderRadius:99, marginTop:8, overflow:"hidden" }}>
          <div style={{ width:`${pct}%`, height:"100%", background:TYPES.legs.color, borderRadius:99, transition:"width .3s" }} />
        </div>
        <NutriRow label="탄수화물" value={carbsSum} target={mt?mt.carb:null} color="#5AA9FF" overType="soft" />
        <NutriRow label="지방" value={fatSum} target={mt?mt.fat:null} color="#FFB74B" overType="soft" />
        <NutriRow label="당류" value={sugarSum} target={mt?mt.sugar:null} color="#FF8FB0" overType="hard" capLabel="상한" />

        {/* 탄단지 비율 */}
        <MacroRatio carbs={carbsSum} protein={proteinSum} fat={fatSum}
          goal={MACRO_GOALS[data.profile.macroGoal] || MACRO_GOALS.lean} />

        <div style={{ fontSize:11, color:C.muted, margin:"16px 0 4px" }}>최근 7일 단백질</div>
        <Bars7 values={proteinByDay} color={TYPES.legs.color} target={target?target.low:null} suffix="g" />
      </Card>

      {/* 식단 */}
      <Card>
        <Row><span style={lbl}>먹은 음식</span></Row>
        <FoodSection foods={day.foods}
          addFoods={(items)=>updateDay(k,{foods:[...day.foods, ...items], water:(day.water||0)+extraWater(items)})}
          removeFood={(id)=>{ const f=day.foods.find(x=>x.id===id);
            updateDay(k,{foods:day.foods.filter(x=>x.id!==id)}, f?`"${f.name}"`:"음식"); }}
          updateFood={(id,patch)=>updateDay(k,{foods:day.foods.map(f=>f.id===id?{...f,...patch}:f)})}
          apiKey={apiKey} customFoods={customFoods}
          {...favProps} />
      </Card>

      {/* 물 섭취 */}
      <Card>
        <Row><span style={lbl}>물</span>
          <span style={{ fontSize:12, color:C.muted }}>1잔 = 250ml</span>
        </Row>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:8 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontSize:26, fontWeight:800, color:"#6BC5F0" }}>{((day.water||0)*0.25).toFixed(2).replace(/\.?0+$/,"")}L</span>
            <span style={{ fontSize:13, color:C.muted }}>{day.water||0}잔</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>updateDay(k,{water:Math.max(0,(day.water||0)-1)})} style={{...stepBtn, width:38, height:38, fontSize:18}}>–</button>
            <button onClick={()=>updateDay(k,{water:(day.water||0)+1})} style={{...primary("#6BC5F0"), width:64, padding:"0"}}>+1잔</button>
          </div>
        </div>
        <div style={{ display:"flex", gap:4, marginTop:10 }}>
          {[...Array(8)].map((_,i)=>(
            <div key={i} style={{ flex:1, height:6, borderRadius:99, background:(day.water||0)>i?"#6BC5F0":C.surface2, transition:"background .25s" }} />
          ))}
        </div>
        {/* 크레아틴 체크 */}
        <div onClick={()=>updateDay(k,{creatine:!day.creatine})} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          marginTop:12, padding:"11px 13px", borderRadius:12, cursor:"pointer", transition:"all .25s",
          background: day.creatine ? tint("#C9A6FF",0.13) : C.surface2,
          border:`1.5px solid ${day.creatine ? "#C9A6FF" : C.line}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <span style={{ fontSize:17 }}>💊</span>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color: day.creatine ? "#C9A6FF" : C.text }}>크레아틴</div>
              {creatineStreak>=2 && <div style={{ fontSize:10.5, color:C.muted, marginTop:1 }}>{creatineStreak}일 연속 복용 중</div>}
            </div>
          </div>
          <div style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
            background: day.creatine ? "#C9A6FF" : "transparent", border:`2px solid ${day.creatine ? "#C9A6FF" : C.muted}`,
            color:"#141519", fontSize:14, fontWeight:900, transition:"all .25s" }}>{day.creatine ? "✓" : ""}</div>
        </div>
      </Card>

      {/* 오늘 운동 / 공부 */}
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <MiniCard label="오늘 운동"
            value={ t ? (day.type==="custom"&&day.parts.length?day.parts.join("·"):t.label)
                  : Object.keys(day.partSets||{}).length>0 ? `${Object.values(day.partSets).reduce((s,v)=>s+num(v),0)}세트`
                  : day.mainLift?.name ? day.mainLift.name : "미설정" }
            unit="" color={ t ? t.color : didWorkout(day) ? TYPES.push.color : C.muted } />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <MiniCard label="오늘 공부" value={studyToday?fmtMin(studyToday):"0분"} unit="" color={STUDY_ACCENT} />
        </div>
      </div>
      {(day.cardio || day.lifts.length>0 || Object.keys(day.partSets||{}).length>0) && (
        <Card>
          {day.cardio && <div style={{ fontSize:13, color:CARDIO[day.cardio.type].color, fontWeight:700 }}>
            유산소 · {CARDIO[day.cardio.type].label} {day.cardio.min}분 {num(day.cardio.kcal)>0?`· ${num(day.cardio.kcal)}kcal`:""}</div>}
          {Object.keys(day.partSets||{}).length>0 && (
            <div style={{ fontSize:13, marginTop:day.cardio?6:0 }}>
              <b style={{ color:TYPES.push.color }}>부위</b>{" "}
              <span style={{ color:C.muted }}>{Object.entries(day.partSets).map(([p,s])=>`${p} ${s}세트`).join(" · ")}</span>
            </div>
          )}
          {day.lifts.map((l)=>(
            <div key={l.id} style={{ fontSize:13, marginTop:6 }}>
              <b>{l.name}</b> <span style={{ color:C.muted }}>{l.sets.map((s)=>`${s.w}×${s.r}`).join(", ")}</span>
            </div>
          ))}
        </Card>
      )}

      {/* 퀵 운동 기록 */}
      <Card>
        <Row><span style={lbl}>퀵 운동 기록</span>
          {day.mainLift?.name && <span style={{ fontSize:12, color:TYPES.push.color, fontWeight:700 }}>{day.mainLift.name} {day.mainLift.w}kg×{day.mainLift.r}</span>}
        </Row>
        <div style={{ marginTop:10 }}>
          <QuickWorkoutBlock partSets={day.partSets} mainLift={day.mainLift}
            onChangePartSets={(v)=>updateDay(k,{partSets:v})}
            onChangeMainLift={(v)=>updateDay(k,{mainLift:v})} />
        </div>
        {day.mainLift?.name && (()=>{
          const hist = mainLiftHistory(data.schedule, day.mainLift.name);
          return hist.length>=2 ? (<>
            <div style={{ fontSize:11, color:C.muted, margin:"14px 0 2px" }}>{day.mainLift.name} 추이</div>
            <LineChart points={hist} color={TYPES.push.color} unit="kg" />
          </>) : null;
        })()}
      </Card>

      {/* 회복 상태 + 주간 운동 목표 */}
      <RecoveryCard schedule={data.schedule} weekGoals={data.weekGoals} mutate={mutate} days={days} measurements={data.measurements} />

      {/* 컨디션 · 습관 · 일기 (접이식 묶음) — 하루 한 번만 쓰는 것들 */}
      <Collapsible title="컨디션 · 습관 · 일기" accent={SLEEP_ACCENT} openSignal={sleepOpen}
        summary={[
          todaySleep?.hours ? `수면 ${todaySleep.hours}h` : null,
          day.mood ? MOODS.find(m=>m.v===day.mood)?.emoji : null,
          data.habits.length>0 ? `습관 ${Object.values(day.habitLog||{}).filter(Boolean).length}/${data.habits.length}` : null,
          day.diary ? "일기 ✓" : null,
        ].filter(Boolean).join(" · ") || "아직 기록 없음"}>

      {/* 수면 · 컨디션 */}
      <Card>
        <Row><span style={lbl}>수면 · 컨디션</span>
          {todaySleep?.condition && <span style={{ fontSize:12, color:SLEEP_ACCENT, fontWeight:700 }}>{CONDITION_LABELS[todaySleep.condition]}</span>}
        </Row>
        <SleepBlock value={todaySleep} onChange={(v)=>updateDay(k,{sleep:v})} />
        <div style={{ fontSize:11, color:C.muted, margin:"14px 0 4px" }}>최근 7일 수면</div>
        <Bars7 values={sleepByDay} color={SLEEP_ACCENT} />
      </Card>

      {/* 기분 */}
      <Card>
        <Row><span style={lbl}>오늘 기분</span>
          {day.mood && <span style={{ fontSize:12, color:C.muted }}>{MOODS.find(m=>m.v===day.mood)?.label}</span>}
        </Row>
        <div style={{ display:"flex", gap:6, marginTop:10 }}>
          {MOODS.map((m)=>(
            <button key={m.v} onClick={()=>updateDay(k,{mood: day.mood===m.v?null:m.v})} style={{
              flex:1, padding:"10px 0", borderRadius:12, cursor:"pointer", transition:"all .2s",
              border:`1.5px solid ${day.mood===m.v?m.color:C.line}`,
              background: day.mood===m.v?tint(m.color,0.15):C.surface2,
              display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <span style={{ fontSize:22, filter:day.mood===m.v?"none":"grayscale(0.4)" }}>{m.emoji}</span>
              <span style={{ fontSize:9.5, color:day.mood===m.v?m.color:C.muted, fontWeight:700 }}>{m.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* 습관 트래커 */}
      <Card>
        <Row><span style={lbl}>습관</span>
          {data.habits.length>0 && <span style={{ fontSize:12, color:C.muted }}>{Object.values(day.habitLog||{}).filter(Boolean).length}/{data.habits.length} 완료</span>}
        </Row>
        <HabitTracker habits={data.habits} log={day.habitLog||{}}
          onToggle={(id)=>updateDay(k,{ habitLog:{ ...(day.habitLog||{}), [id]: !(day.habitLog||{})[id] } })}
          onAddHabit={(name,emoji)=>mutate((prev)=>({ ...prev, habits:[...prev.habits, { id:uid(), name, emoji }] }))}
          onRemoveHabit={(id)=>{ const h=(data.habits||[]).find(x=>x.id===id);
            mutate((prev)=>({ ...prev, habits:prev.habits.filter(x=>x.id!==id) }), h?`습관 "${h.name}"`:"습관"); }} />
      </Card>

      {/* 한 줄 일기 */}
      <Card>
        <Row><span style={lbl}>한 줄 일기</span></Row>
        <textarea value={day.diary||""} onChange={(e)=>updateDay(k,{diary:e.target.value})} rows={2}
          placeholder="오늘 하루 어땠나요? 기록해두면 나중에 돌아보기 좋아요."
          style={{...inp, width:"100%", boxSizing:"border-box", resize:"none", lineHeight:1.5, marginTop:10, fontFamily:"inherit"}} />
      </Card>
      </Collapsible>

      {/* 이번 주 리포트 (접이식) */}
      <Card>
        <div onClick={()=>setReportOpen((v)=>!v)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
          <span style={lbl}>이번 주 리포트</span>
          <span style={{ fontSize:14, color:C.muted, transform:reportOpen?"rotate(180deg)":"none", transition:"transform .2s" }}>▾</span>
        </div>
        {reportOpen && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginTop:12 }}>
            <ReportItem label="운동일" value={`${workoutDays}/7`} color={TYPES.legs.color} />
            <ReportItem label="유산소" value={`${cardioSessions}회`} color={C.amber} />
            <ReportItem label="평균 단백질" value={`${avgProtein}g`} color={TYPES.legs.color} />
            <ReportItem label="평균 칼로리" value={avgNet!=null?`${avgNet>=0?"+":""}${avgNet}`:"—"} color={avgNet!=null&&avgNet>=0?TYPES.legs.color:C.danger} />
            <ReportItem label="공부시간" value={fmtMin(weekStudyMin)} color={STUDY_ACCENT} />
            <ReportItem label="체중 변화" value={weightDiff!=null?`${weightDiff>=0?"+":""}${weightDiff.toFixed(1)}kg`:"—"} color={weightDiff!=null&&weightDiff>=0?TYPES.push.color:TYPES.pull.color} />
          </div>
        )}
      </Card>
    </div>
  );
}

// ================= 캘린더 =================
// 히트맵 — 최근 26주 운동 강도를 잔디처럼. 1년치 패턴이 한 화면에 들어온다

const deloadState = (schedule) => {
  const weeks = [];
  for (let w = 0; w < 10; w++) {
    let sets = 0, days = 0;
    for (let d = 0; d < 7; d++) {
      const dt = new Date(); dt.setDate(dt.getDate() - (w*7 + d));
      const kk = keyOf(dt.getFullYear(), dt.getMonth(), dt.getDate());
      const t = partBreakdown(schedule[kk]?.partSets).total;
      sets += t; if (didWorkout(schedule[kk])) days++;
    }
    weeks.push({ sets, days });
  }
  // 주 3회 이상 + 30세트 이상이면 "고강도 주"로 본다
  const isHard = (w)=> w.days >= 3 && w.sets >= 30;
  let streak = 0;
  for (const w of weeks) { if (isHard(w)) streak++; else break; }
  // 최근 주 볼륨이 직전 대비 크게 낮으면 이미 디로드 중
  const recentlyDeloaded = weeks.length>1 && weeks[0].sets>0 && weeks[1].sets>0
    && weeks[0].sets < weeks[1].sets * 0.6;
  return {
    hardWeeks: streak,
    recentlyDeloaded,
    due: streak >= 6 && !recentlyDeloaded,
    soon: streak === 5 && !recentlyDeloaded,
    avgSets: Math.round(weeks.slice(0,4).reduce((a,w)=>a+w.sets,0)/4),
  };
};

// 체성분 분석이 쓸모 있으려면 정기 측정이 필요하다. 주 1회 기준으로 알린다.

const measureReminder = (measurements) => {
  const list = [...(measurements||[])].sort((a,b)=>a.date.localeCompare(b.date));
  if (list.length === 0) return { never:true, daysAgo:null, due:true };
  const last = list[list.length-1];
  const t = new Date(); t.setHours(0,0,0,0);
  const daysAgo = Math.round((t - new Date(last.date+"T00:00:00")) / 86400000);
  return { never:false, daysAgo, lastDate:last.date, due: daysAgo >= 7, soon: daysAgo === 6 };
};

// 칼로리 뱅킹 — 하루 초과해도 주간 평균으로 보면 괜찮은 경우가 많다.
// 하루 망쳤다고 포기하지 않게, 남은 날에 얼마씩 먹으면 되는지 알려준다.

const calorieBank = (schedule, weight, tdee, surplus) => {
  if (tdee == null) return null;
  const goalPerDay = tdee + num(surplus);
  const t = new Date(); t.setHours(0,0,0,0);
  const dow = t.getDay();                 // 0=일
  const elapsed = dow + 1;                // 오늘 포함 지난 일수
  const remain = 7 - elapsed;             // 이번 주 남은 날
  let net = 0, logged = 0;
  for (let i = 0; i < elapsed; i++) {
    const d = new Date(t); d.setDate(t.getDate() - (elapsed-1-i));
    const kk = keyOf(d.getFullYear(), d.getMonth(), d.getDate());
    const e = schedule[kk];
    const foods = e?.foods || [];
    if (foods.length === 0) continue;
    logged++;
    const inK = foods.reduce((sm,f)=>sm+num(f.kcal),0);
    const out = burnedKcal(e, weight);
    net += (inK - out) - goalPerDay;      // 목표 대비 초과(+)/부족(-)
  }
  if (logged === 0) return null;
  const perRemain = remain > 0 ? Math.round(goalPerDay - net/remain) : null;
  return {
    diff: Math.round(net), logged, remain, goalPerDay,
    perRemain,                            // 남은 날 하루 권장 섭취
    onTrack: Math.abs(net) <= goalPerDay * 0.15,
  };
};

// ===== 회복 상태 (로컬 판단) =====
// 벌크 중엔 과훈련이 쉬워서, 연속 운동일·수면·볼륨을 함께 본다.

const recoveryState = (schedule, weightAvgSleep) => {
  const t = new Date(); t.setHours(0,0,0,0);
  // 오늘부터 거꾸로 연속 운동일
  let streak = 0;
  for (let i=0; i<21; i++) {
    const d = new Date(t); d.setDate(t.getDate()-i);
    const kk = keyOf(d.getFullYear(), d.getMonth(), d.getDate());
    if (didWorkout(schedule[kk])) streak++;
    else break;
  }
  // 최근 7일 볼륨·수면
  const days = lastNDays(7);
  const sets = days.reduce((sm,kk)=> sm + partBreakdown(schedule[kk]?.partSets).total, 0);
  const sleeps = days.map(kk=>num(schedule[kk]?.sleep?.hours)).filter(v=>v>0);
  const avgSleep = sleeps.length ? rd1(sleeps.reduce((a,b)=>a+b,0)/sleeps.length) : null;
  const restDays = days.filter(kk=> !didWorkout(schedule[kk])).length;

  const flags = [];
  if (streak >= 6) flags.push({ tone:"bad", msg:`${streak}일 연속 운동했어요. 하루 쉬면 오히려 더 크게 성장해요.` });
  else if (streak === 5) flags.push({ tone:"warn", msg:"5일 연속이에요. 곧 하루 쉬어주는 게 좋아요." });
  if (avgSleep!=null && avgSleep < 6.5) flags.push({ tone:"bad", msg:`최근 수면이 평균 ${avgSleep}시간이에요. 근성장은 잘 때 일어나요.` });
  else if (avgSleep!=null && avgSleep < 7) flags.push({ tone:"warn", msg:`수면 평균 ${avgSleep}시간 — 7시간 이상이면 회복이 확실히 좋아져요.` });
  if (restDays === 0) flags.push({ tone:"warn", msg:"최근 7일 동안 쉬는 날이 없었어요." });
  if (sets > 0 && sets < 30 && restDays >= 5) flags.push({ tone:"warn", msg:"이번 주 볼륨이 적어요. 주 10~20세트/부위가 성장 구간이에요." });

  const level = flags.some(f=>f.tone==="bad") ? "bad" : flags.length ? "warn" : "good";
  return { streak, sets, avgSleep, restDays, flags, level };
};

// ===== 중량 성장 추적 (로컬 계산) =====
// 1RM 추정 — Epley 공식. 8회 이하에서 비교적 정확하다.

const mainLiftHistory = (schedule, name) => {
  const keys = Object.keys(schedule).filter((kk)=> schedule[kk].mainLift?.name===name && num(schedule[kk].mainLift.w)>0).sort();
  return keys.slice(-10).map((kk)=>({ label: kk.slice(5).replace("-","."), value: num(schedule[kk].mainLift.w) }));
};

// ================= 날짜 편집 =================

const HABIT_EMOJIS = ["✅","💊","🧘","📖","💧","🚭","🍺","🌙","🏃","🧴","🦷","☀️","💤","🥗"];

function HabitTracker({ habits, log, onToggle, onAddHabit, onRemoveHabit }) {
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✅");
  const [manage, setManage] = useState(false);
  const submit = () => { if(!name.trim()) return; onAddHabit(name.trim(), emoji); setName(""); setEmoji("✅"); setAddOpen(false); };
  return (
    <div style={{ marginTop:10 }}>
      {habits.length===0 ? (
        <div style={{ fontSize:12.5, color:C.muted, lineHeight:1.6, marginBottom:4 }}>
          매일 체크할 습관을 추가해보세요. 영양제, 스트레칭, 금주, 독서 등 뭐든지요.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {habits.map((h)=>{
            const done = !!log[h.id];
            return (
              <div key={h.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:12, transition:"all .2s",
                background: done?tint(TYPES.legs.color,0.13):C.surface2, border:`1.5px solid ${done?TYPES.legs.color:C.line}`, cursor:"pointer" }}
                onClick={()=>!manage && onToggle(h.id)}>
                <span style={{ fontSize:18 }}>{h.emoji}</span>
                <span style={{ flex:1, fontSize:13.5, fontWeight:700, color:done?TYPES.legs.color:C.text, textDecoration:done&&!manage?"none":"none" }}>{h.name}</span>
                {manage ? (
                  <ConfirmX onConfirm={()=>onRemoveHabit(h.id)} label="습관 삭제" />
                ) : (
                  <div style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                    background:done?TYPES.legs.color:"transparent", border:`2px solid ${done?TYPES.legs.color:C.muted}`,
                    color:"#141519", fontSize:14, fontWeight:900, transition:"all .2s" }}>{done?"✓":""}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginTop:10 }}>
        <button onClick={()=>{ setAddOpen(v=>!v); setManage(false); }} style={{ ...ghost, flex:1, fontSize:12.5, padding:"9px 0" }}>+ 습관 추가</button>
        {habits.length>0 && <button onClick={()=>{ setManage(v=>!v); setAddOpen(false); }} style={{ ...ghost, flex:1, fontSize:12.5, padding:"9px 0", color:manage?C.amber:C.muted, borderColor:manage?C.amber:C.line }}>{manage?"완료":"편집"}</button>}
      </div>

      {addOpen && (
        <div style={{ marginTop:8, background:C.surface2, borderRadius:12, padding:"12px" }}>
          <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:6 }}>아이콘</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {HABIT_EMOJIS.map((em)=>(
              <button key={em} onClick={()=>setEmoji(em)} style={{ fontSize:17, padding:"5px 7px", borderRadius:8, cursor:"pointer",
                border:`1.5px solid ${emoji===em?TYPES.legs.color:C.line}`, background:emoji===em?tint(TYPES.legs.color,0.15):"transparent" }}>{em}</button>
            ))}
          </div>
          <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="습관 이름 (예: 아침 스트레칭)"
            style={{...inp, width:"100%", boxSizing:"border-box", marginTop:10}} />
          <button onClick={submit} disabled={!name.trim()} style={{...primary(TYPES.legs.color), width:"100%", marginTop:8, opacity:name.trim()?1:0.45}}>추가</button>
        </div>
      )}
    </div>
  );
}

// ================= 수면 · 컨디션 =================

function RecoveryCard({ schedule, weekGoals, mutate, days, measurements }) {
  const rec = recoveryState(schedule);
  const dl = deloadState(schedule);
  const mr = measureReminder(measurements);
  const goalW = num(weekGoals?.workouts);
  const goalS = num(weekGoals?.sets);
  const doneW = days.filter(kk=>didWorkout(schedule[kk])).length;
  const doneS = days.reduce((sm,kk)=> sm + partBreakdown(schedule[kk]?.partSets).total, 0);
  const setGoal = (patch)=> mutate((prev)=>({ ...prev, weekGoals:{ ...(prev.weekGoals||{}), ...patch } }));
  const toneColor = { good:TYPES.legs.color, warn:C.amber, bad:C.danger };

  const bars = [
    { key:"workouts", label:"운동 횟수", done:doneW, goal:goalW, unit:"회", color:TYPES.push.color,
      onSet:(v)=>setGoal({ workouts: Math.max(0, Math.min(7, Math.round(num(v)))) }) },
    { key:"sets", label:"총 세트", done:doneS, goal:goalS, unit:"세트", color:TYPES.pull.color,
      onSet:(v)=>setGoal({ sets: Math.max(0, Math.min(500, Math.round(num(v)))) }) },
  ];

  return (
    <Card>
      <Row><span style={lbl}>회복 · 주간 목표</span>
        <span style={{ fontSize:11, fontWeight:800, color:toneColor[rec.level] }}>
          {rec.level==="good" ? "회복 양호" : rec.level==="warn" ? "주의" : "휴식 필요"}
        </span>
      </Row>

      {/* 주간 목표 진행 */}
      <div style={{ marginTop:12 }}>
        {bars.map((b)=>{
          const pct = b.goal>0 ? Math.min(100, Math.round(b.done/b.goal*100)) : 0;
          const hit = b.goal>0 && b.done>=b.goal;
          return (
            <div key={b.key} style={{ marginBottom:11 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:12, fontWeight:700 }}>{b.label}</span>
                <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11.5, color:C.muted }}>
                  <b style={{ color: hit?TYPES.legs.color:b.color, fontSize:14 }}>{b.done}</b>
                  <span>/</span>
                  <input value={b.goal||""} onChange={(e)=>b.onSet(e.target.value.replace(/[^0-9]/g,""))}
                    inputMode="numeric" placeholder="목표"
                    style={{...inp, width:44, padding:"4px 5px", textAlign:"center", fontSize:12}} />
                  <span>{b.unit}</span>
                </div>
              </div>
              {b.goal>0 && (
                <div style={{ height:6, background:C.surface2, borderRadius:99, overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", borderRadius:99,
                    background: hit?TYPES.legs.color:b.color, transition:"width .3s" }} />
                </div>
              )}
            </div>
          );
        })}
        {(!goalW && !goalS) && (
          <div style={{ fontSize:10.5, color:C.muted, lineHeight:1.5, marginTop:-4 }}>
            목표 칸에 숫자를 넣으면 이번 주 진행률이 보여요. 린매스업이면 주 4회 · 부위당 10~20세트가 기준이에요.
          </div>
        )}
      </div>

      <div style={{ height:1, background:C.line, margin:"12px 0" }} />

      {/* 회복 지표 */}
      <div style={{ display:"flex", gap:6 }}>
        {[["연속 운동", `${rec.streak}일`, rec.streak>=6?C.danger:rec.streak>=5?C.amber:C.text],
          ["7일 휴식", `${rec.restDays}일`, rec.restDays===0?C.amber:C.text],
          ["평균 수면", rec.avgSleep!=null?`${rec.avgSleep}h`:"—", rec.avgSleep!=null&&rec.avgSleep<6.5?C.danger:rec.avgSleep!=null&&rec.avgSleep<7?C.amber:C.text]].map(([label,v,col])=>(
          <div key={label} style={{ flex:1, background:C.surface2, borderRadius:10, padding:"9px 6px", textAlign:"center" }}>
            <div style={{ fontSize:9.5, color:C.muted, fontWeight:600 }}>{label}</div>
            <div style={{ fontSize:15, fontWeight:800, color:col, marginTop:2 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* 경고 (회복 + 디로드 + 측정) */}
      {(()=>{
        const extra = [];
        if (dl.due) extra.push({ tone:"bad",
          msg:`${dl.hardWeeks}주째 고강도예요. 이번 주는 볼륨을 절반 정도로 낮추면 다음 주에 더 강해져요.` });
        else if (dl.soon) extra.push({ tone:"warn",
          msg:`${dl.hardWeeks}주 연속 고강도 — 다음 주쯤 가볍게 가는 주를 넣어보세요.` });
        if (mr.never) extra.push({ tone:"warn", msg:"체중·체지방을 한 번 재두면 몸 탭에서 방향을 잡아드려요." });
        else if (mr.due) extra.push({ tone:"warn",
          msg:`${mr.daysAgo}일째 측정을 안 했어요. 주 1회는 재야 추세가 정확해져요.` });
        const all = [...rec.flags, ...extra];
        if (all.length === 0) {
          return (
            <div style={{ fontSize:11.5, color:TYPES.legs.color, fontWeight:600, marginTop:11 }}>
              ✓ 회복·훈련 주기·측정 모두 괜찮아요. 지금 페이스를 유지하세요.
            </div>
          );
        }
        return (
          <div style={{ marginTop:11, display:"flex", flexDirection:"column", gap:7 }}>
            {all.map((f,i)=>(
              <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"10px 12px", borderRadius:10,
                background:tint(toneColor[f.tone],0.09), border:`1px solid ${tint(toneColor[f.tone],0.32)}` }}>
                <span style={{ fontSize:13, lineHeight:1.35, flexShrink:0 }}>{f.tone==="bad"?"⚠️":"⚡"}</span>
                <span style={{ fontSize:11.5, color:toneColor[f.tone], fontWeight:700, lineHeight:1.6 }}>{f.msg}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </Card>
  );
}

// ================= 중량 성장 =================
// 체중이 늘 때 그게 근육인지 판단하려면 "같은 종목을 더 무겁게 드는가"가 근거가 된다.

function MacroRatio({ carbs, protein, fat, goal }) {
  const cCal = num(carbs)*4, pCal = num(protein)*4, fCal = num(fat)*9;
  const total = cCal + pCal + fCal;
  const has = total > 0;
  const pctOf = (v)=> has ? Math.round(v/total*100) : 0;
  const items = [
    { key:"carb",    label:"탄수", short:"탄", g:num(carbs),   pct:pctOf(cCal), goal:goal.carb,    color:"#5AA9FF" },
    { key:"protein", label:"단백", short:"단", g:num(protein), pct:pctOf(pCal), goal:goal.protein, color:TYPES.legs.color },
    { key:"fat",     label:"지방", short:"지", g:num(fat),     pct:pctOf(fCal), goal:goal.fat,     color:"#FFB74B" },
  ];
  // 권장 대비 편차가 가장 큰 항목으로 한 줄 코멘트
  const worst = has ? [...items].sort((a,b)=>Math.abs(b.pct-b.goal)-Math.abs(a.pct-a.goal))[0] : null;
  const gap = worst ? worst.pct - worst.goal : 0;
  const comment = !has ? "음식을 기록하면 비율이 표시돼요"
    : Math.abs(gap) <= 5 ? `${goal.label} 권장 비율에 잘 맞아요 👍`
    : `${worst.label}이 권장보다 ${Math.abs(gap)}%p ${gap>0?"많아요":"적어요"}`;

  return (
    <div style={{ marginTop:18 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
        <span style={{ fontSize:12, fontWeight:800, color:C.muted }}>탄단지 비율</span>
        <span style={{ fontSize:10.5, fontWeight:700, color:goal.color, background:tint(goal.color,0.13),
          border:`1px solid ${tint(goal.color,0.4)}`, borderRadius:999, padding:"3px 9px" }}>{goal.label} 기준</span>
      </div>

      {/* 실제 비율 통짜 바 */}
      <div style={{ display:"flex", height:22, borderRadius:8, overflow:"hidden", background:C.surface2 }}>
        {has ? items.map((it)=> it.pct>0 && (
          <div key={it.key} style={{ width:`${it.pct}%`, background:it.color, display:"flex", alignItems:"center",
            justifyContent:"center", transition:"width .35s" }}>
            {it.pct>=12 && <span style={{ fontSize:10.5, fontWeight:800, color:"#141519" }}>{it.pct}%</span>}
          </div>
        )) : <div style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:10.5, color:C.muted }}>기록 없음</span></div>}
      </div>

      {/* 항목별 실제 vs 권장 */}
      <div style={{ display:"flex", gap:6, marginTop:9 }}>
        {items.map((it)=>{
          const d = it.pct - it.goal;
          const ok = Math.abs(d) <= 5;
          return (
            <div key={it.key} style={{ flex:1, minWidth:0, background:C.surface2, borderRadius:9, padding:"8px 7px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ width:7, height:7, borderRadius:"50%", background:it.color, flexShrink:0 }} />
                <span style={{ fontSize:10.5, color:C.muted, fontWeight:600 }}>{it.label}</span>
              </div>
              <div style={{ fontSize:15, fontWeight:800, color:it.color, marginTop:3 }}>{it.pct}<span style={{ fontSize:10 }}>%</span></div>
              <div style={{ fontSize:9.5, color:C.muted, marginTop:1 }}>{Math.round(it.g)}g · 권장 {it.goal}%</div>
              {has && (
                <div style={{ fontSize:9.5, fontWeight:800, marginTop:2, color: ok?TYPES.legs.color:C.amber }}>
                  {ok ? "적정" : `${d>0?"▲":"▼"}${Math.abs(d)}%p`}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:11, color: has&&Math.abs(gap)<=5?TYPES.legs.color:C.muted, marginTop:8, fontWeight:600 }}>{comment}</div>
    </div>
  );
}

function NutriRow({ label, value, target, color, overType, capLabel }) {
  const over = target != null && value > target;
  const pct = target ? Math.min(100, Math.round(value / target * 100)) : 0;
  const overColor = overType === "hard" ? C.danger : C.amber;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{label}{" "}
          <span style={{ color: C.muted, fontWeight: 500 }}>{show1(value)}g{target != null ? ` / ${capLabel || "목표"} ${show1(target)}g` : ""}</span>
        </span>
        {over && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#141519", background: overColor, borderRadius: 6, padding: "2px 7px" }}>초과</span>}
      </div>
      {target != null && (
        <div style={{ height: 6, background: C.surface2, borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: over ? overColor : color, borderRadius: 99 }} />
        </div>
      )}
    </div>
  );
}

// 음식 필터 시트 — 검색 화면을 짧게 유지하려고 필터를 여기로 모았다

function VocabTodayCard({ vocab, goal, mutate }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [session, setSession] = useState([]);   // 이번에 넘길 목록 (시작할 때 고정)

  const doneToday = vocab.filter(v=>v.lastReview===todayKey()).length;
  const due = dueList(vocab, 0);
  const left = Math.max(0, Math.min(goal, doneToday + due.length) - doneToday);
  const goalHit = doneToday >= goal || due.length === 0;

  if (vocab.length === 0) return null;

  const start = () => {
    setSession(dueList(vocab, Math.max(1, goal - doneToday)));
    setIdx(0); setRevealed(false); setOpen(true);
  };
  const answer = (d) => {
    const v = session[idx];
    if (v) mutate((prev)=>({ ...prev, vocab:(prev.vocab||[]).map(x=> x.id===v.id
      ? { ...x, level:Math.max(0,Math.min(5,num(x.level)+d)), reviewCount:num(x.reviewCount)+1,
          wrong: d<0 ? num(x.wrong)+1 : num(x.wrong), lastReview:todayKey() }
      : x) }));
    setRevealed(false);
    setIdx(i=>i+1);
  };
  const cur = session[idx] || null;
  const finished = open && idx >= session.length;

  // 접힌 상태 — 오늘 할 게 있으면 권하고, 끝냈으면 축하만
  if (!open) {
    return (
      <Card>
        <Row><span style={lbl}>오늘 단어</span>
          <span style={{ fontSize:11.5, fontWeight:700, color: goalHit?TYPES.legs.color:C.muted }}>
            {doneToday}/{goal}{goalHit?" 완료 🎉":""}
          </span>
        </Row>
        <div style={{ height:7, background:C.surface2, borderRadius:99, overflow:"hidden", marginTop:10 }}>
          <div style={{ width:`${Math.min(100, Math.round(doneToday/goal*100))}%`, height:"100%", borderRadius:99,
            background: goalHit?TYPES.legs.color:`linear-gradient(90deg, ${tint(STUDY_ACCENT,0.5)}, ${STUDY_ACCENT})`,
            transition:"width .4s" }} />
        </div>
        {due.length > 0 ? (
          <>
            <div style={{ fontSize:11.5, color:C.muted, marginTop:9, lineHeight:1.55 }}>
              오늘 볼 단어 <b style={{ color:STUDY_ACCENT }}>{Math.min(due.length, Math.max(1, goal-doneToday))}개</b>
              {due.length > goal-doneToday ? ` (대기 ${due.length}개 중)` : ""}
            </div>
            <button onClick={start} style={{...primary(STUDY_ACCENT), width:"100%", marginTop:10}}>
              바로 복습하기
            </button>
          </>
        ) : (
          <div style={{ fontSize:11.5, color:TYPES.legs.color, fontWeight:600, marginTop:9, lineHeight:1.6 }}>
            ✓ 오늘 볼 단어를 다 봤어요. 다음 복습은 간격에 맞춰 자동으로 올라와요.
          </div>
        )}
      </Card>
    );
  }

  // 복습 진행
  return (
    <Card>
      <Row><span style={lbl}>오늘 단어</span>
        <span style={{ fontSize:11.5, color:C.muted }}>
          {finished ? `${session.length}개 완료` : `${idx+1} / ${session.length}`}
        </span>
      </Row>

      {finished ? (
        <>
          <div style={{ textAlign:"center", padding:"20px 0 14px" }}>
            <div style={{ fontSize:30, fontWeight:800, color:TYPES.legs.color, letterSpacing:-1 }}>
              {session.length}개 완료
            </div>
            <div style={{ fontSize:12.5, color:C.muted, marginTop:6 }}>
              오늘 누적 {doneToday}개 · 목표 {goal}개
            </div>
          </div>
          <div style={{ display:"flex", gap:7 }}>
            {dueList(vocab, 0).length > 0 && (
              <button onClick={start} style={{...ghost, flex:1}}>더 하기</button>
            )}
            <button onClick={()=>setOpen(false)} style={{...primary(TYPES.legs.color), flex:1}}>마치기</button>
          </div>
        </>
      ) : cur ? (
        <>
          <div style={{ height:5, background:C.surface2, borderRadius:99, overflow:"hidden", margin:"10px 0 12px" }}>
            <div style={{ width:`${Math.round(idx/session.length*100)}%`, height:"100%",
              background:STUDY_ACCENT, borderRadius:99, transition:"width .3s" }} />
          </div>

          <div onClick={()=>setRevealed(true)}
            style={{ padding:"24px 14px", borderRadius:13, background:C.surface2, cursor:"pointer",
              border:`1px solid ${C.line}`, textAlign:"center", minHeight:92, display:"flex",
              flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
            <div style={{ fontSize:10, fontWeight:800, color:vocabTypeInfo(cur.type).color }}>
              {vocabTypeInfo(cur.type).icon} {vocabTypeInfo(cur.type).label}
              {posInfo(cur.pos)?` · ${posInfo(cur.pos).short}`:""}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:21, fontWeight:800, lineHeight:1.3, wordBreak:"break-word" }}>{cur.term}</span>
              {cur.type!=="grammar" && (
                <button onClick={(e)=>{ e.stopPropagation(); speakWord(cur.term); }} title="발음 듣기"
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, padding:2, opacity:0.7 }}>🔊</button>
              )}
            </div>
            {revealed ? (
              <>
                <div style={{ height:1, width:40, background:C.line }} />
                <div style={{ fontSize:14.5, color:STUDY_ACCENT, fontWeight:700, lineHeight:1.5 }}>{cur.meaning||"(뜻 없음)"}</div>
                {cur.note && <div style={{ fontSize:11, color:C.muted, lineHeight:1.55 }}>{cur.note}</div>}
              </>
            ) : (
              <div style={{ fontSize:11, color:C.muted }}>탭해서 뜻 보기</div>
            )}
          </div>

          <div style={{ display:"flex", gap:7, marginTop:11 }}>
            <button onClick={()=>answer(-1)} style={{...ghost, flex:1, color:C.amber, borderColor:tint(C.amber,0.45)}}>헷갈려요</button>
            <button onClick={()=>answer(1)} style={{...primary(TYPES.legs.color), flex:1}}>알아요</button>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
            <span style={{ fontSize:10, color:C.muted }}>
              숙련도 {num(cur.level)}/5 · 맞히면 {REVIEW_GAP[Math.min(5,num(cur.level)+1)]}일 뒤 다시
            </span>
            <button onClick={()=>setOpen(false)} style={{ background:"none", border:"none", color:C.muted,
              fontSize:10.5, fontWeight:700, cursor:"pointer", padding:0 }}>나중에</button>
          </div>
        </>
      ) : null}
    </Card>
  );
}

// ================= 계량 기준 가이드 =================
// "얼마나 먹었지?"가 가장 막히는 지점이라, 손·그릇 기준을 한 곳에 모아둔다.

const CountUp = ({value, decimals=0, suffix=""}) => {
  const v = useCountUp(num(value));
  return <>{v.toFixed(decimals)}{suffix}</>;
};

// 컨페티

function Confetti({ fire }) {
  const [parts, setParts] = useState([]);
  useEffect(()=>{
    if (!fire) return;
    const colors = ["#FF6B3D","#35C4D8","#7DDB8A","#FFC24B","#C9A6FF","#FF8FB0"];
    const arr = [...Array(40)].map((_,i)=>({
      id:i+"-"+fire, left: Math.random()*100, delay: Math.random()*0.25,
      dur: 1.4+Math.random()*0.9, color: colors[i%colors.length],
      size: 6+Math.random()*6, drift:(Math.random()-0.5)*120,
    }));
    setParts(arr);
    const t = setTimeout(()=>setParts([]), 2600);
    return ()=>clearTimeout(t);
  }, [fire]);
  if (!parts.length) return null;
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:200, overflow:"hidden" }}>
      {parts.map((p)=>(
        <div key={p.id} style={{ position:"absolute", top:-20, left:`${p.left}%`, width:p.size, height:p.size*0.6,
          background:p.color, borderRadius:2, animation:`confettiFall ${p.dur}s cubic-bezier(0.3,0.6,0.5,1) ${p.delay}s forwards`,
          "--drift":`${p.drift}px` }} />
      ))}
    </div>
  );
}

// 고급 원형 게이지

function Mascot({ score, proteinPct, workedOut }) {
  const mood = score>=80 ? "great" : score>=50 ? "ok" : score>=1 ? "meh" : "sleep";
  const cfg = {
    great: { body:"#7DDB8A", cheek:"#FF9BB0", msg:"오늘 완벽해요! 🔥" },
    ok:    { body:"#8FD3FF", cheek:"#FFB3C1", msg:"잘 하고 있어요 💪" },
    meh:   { body:"#FFC24B", cheek:"#FFB3C1", msg:"조금만 더 채워봐요" },
    sleep: { body:"#8A8D98", cheek:"transparent", msg:"오늘 기록을 시작해요" },
  }[mood];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:16 }}>
      <div className="mascot-float" style={{ position:"relative", width:74, height:74, flexShrink:0 }}>
        <svg width="74" height="74" viewBox="0 0 74 74">
          <ellipse cx="37" cy="68" rx="20" ry="4" fill="rgba(0,0,0,0.25)" />
          <circle cx="37" cy="36" r="26" fill={cfg.body} style={{ transition:"fill .5s" }} />
          <circle cx="37" cy="36" r="26" fill="url(#mascotShine)" />
          <circle cx="24" cy="42" r="5" fill={cfg.cheek} opacity="0.6" style={{ transition:"fill .5s" }} />
          <circle cx="50" cy="42" r="5" fill={cfg.cheek} opacity="0.6" style={{ transition:"fill .5s" }} />
          {mood==="sleep" ? (
            <>
              <path d="M26 34 q4 3 8 0" stroke="#141519" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M40 34 q4 3 8 0" stroke="#141519" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <text x="53" y="25" fontSize="12" fill="#141519" fontWeight="800">z</text>
            </>
          ) : mood==="great" ? (
            <>
              <path d="M25 34 q5 -6 10 0" stroke="#141519" strokeWidth="2.8" fill="none" strokeLinecap="round" />
              <path d="M39 34 q5 -6 10 0" stroke="#141519" strokeWidth="2.8" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle className="mascot-eye" cx="30" cy="34" r="3.2" fill="#141519" />
              <circle className="mascot-eye" cx="44" cy="34" r="3.2" fill="#141519" />
            </>
          )}
          {mood==="great" && <path d="M28 44 q9 9 18 0" stroke="#141519" strokeWidth="2.8" fill="none" strokeLinecap="round" />}
          {mood==="ok" && <path d="M31 45 q6 5 12 0" stroke="#141519" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
          {mood==="meh" && <path d="M32 46 h10" stroke="#141519" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
          {mood==="sleep" && <circle cx="37" cy="46" r="2" fill="#141519" />}
          <defs>
            <radialGradient id="mascotShine" cx="0.35" cy="0.3" r="0.7">
              <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
              <stop offset="45%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
        </svg>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:15, fontWeight:800, color:cfg.body, transition:"color .5s" }}>{cfg.msg}</div>
        <div style={{ fontSize:11.5, color:C.muted, marginTop:4, lineHeight:1.5 }}>
          {mood==="sleep" ? "단백질·운동·습관을 기록하면 캐릭터가 깨어나요" :
           `오늘 달성도 ${Math.round(score)}%${workedOut?" · 운동 완료 💪":""}`}
        </div>
      </div>
    </div>
  );
}

const ReportItem = ({label,value,color}) => (  <div style={{ minWidth:0 }}>
    <div style={{ fontSize:10, color:C.muted, fontWeight:600 }}>{label}</div>
    <div style={{ fontSize:15.5, fontWeight:800, color, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</div>
  </div>
);
