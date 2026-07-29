import React, { useState, useEffect } from "react";
import { TYPES, C, todayKey, uid, tint, num, extractJSON, Card, Row, SheetLayer, ConfirmX, lbl, inp, primary, ghost, xBtn, chip, sheet, grip, callClaudeAPI } from "../shared.jsx";
import { localBrandSearch, makeCustomEntry, searchAllFoods, servingLabel, displayCat, CATEGORIES, gramsPerServing, portionHint, HAND_GUIDE, CONTAINER_GUIDE, CAT_PORTION_HINT, CATEGORY_GROUPS, catIcon, categoryCounts, NUTRI_FILTERS, proteinPer100kcal, categoryUsage } from "../foodDB.js";

const MENU_PROMPT = `사용자는 린메스업(근육 늘리기) 중이라 단백질은 높고 칼로리는 과하지 않으며 비교적 건강한 메뉴를 선호해.
음식점 이름이나 고민 중인 메뉴를 주면 그 안에서 목표에 더 나은 선택을 추천해줘.
반드시 순수 JSON만 출력 (마크다운·설명 없이):
{"picks":[{"name":"메뉴명","protein":숫자,"carbs":숫자,"sugar":숫자,"fat":숫자,"kcal":숫자,"rating":"best|good|caution","reason":"25자 내외"}],"tip":"한 줄 총평"}
규칙: picks 3~5개 추천순 정렬(best 위), protein/carbs/sugar/fat는 g 정수, 음식점명만 주면 대표메뉴 중 선택.
중요: 프랜차이즈·브랜드 메뉴는 web_search로 공식/실제 영양정보를 먼저 찾아 반영해. 검색 후에도 최종 답변은 JSON만 출력.
입력:
`;

export default function Foods({ addFoodsToday, apiKey, customFoods, mutate, schedule, favorites, mealSets, target, tdee, surplus, addFavorite, removeFavorite }) {
  const [mode, setMode] = useState("search");
  return (
    <div style={{ padding:"22px 18px 8px" }}>
      <div style={{ fontSize:11, letterSpacing:3, color:TYPES.push.color, fontWeight:800 }}>FOODS</div>
      <div style={{ fontSize:30, fontWeight:800, letterSpacing:-1, marginTop:4 }}>음식</div>

      <div style={{ display:"flex", gap:6, marginTop:14, background:C.surface2, padding:4, borderRadius:12 }}>
        {[["search","음식 검색"],["dining","외식 추천"]].map(([k,label])=>(
          <button key={k} onClick={()=>setMode(k)} style={{
            flex:1, padding:"10px 0", borderRadius:9, border:"none", cursor:"pointer", fontSize:13, fontWeight:800,
            background: mode===k ? C.surface : "transparent",
            color: mode===k ? TYPES.push.color : C.muted,
          }}>{label}</button>
        ))}
      </div>

      {mode==="search"
        ? <FoodSearch addFoodsToday={addFoodsToday} customFoods={customFoods} mutate={mutate} schedule={schedule} favorites={favorites||[]} mealSets={mealSets||[]} target={target} tdee={tdee} surplus={surplus} addFavorite={addFavorite} removeFavorite={removeFavorite} />
        : <Dining addFoodsToday={addFoodsToday} apiKey={apiKey} customFoods={customFoods} embedded />}
    </div>
  );
}

// 자주 쓰는 음식을 한 줄로 모아두고, 누르면 양을 정해 넣는다.
// 화면이 길어지지 않게 기본 6개만 보여주고 나머지는 "더" 로 펼친다.
function QuickPick({ favorites, recent, onAdd, onStar, onUnstar }) {
  const [tab, setTab] = useState("fav");     // fav | recent
  const [expanded, setExpanded] = useState(false);
  const [picked, setPicked] = useState(null); // 양을 정하는 중인 항목
  const [amt, setAmt] = useState("1");
  const [flash, setFlash] = useState("");

  const favList = (favorites||[]).map(f=>({ item:f, fav:true }));
  const recList = (recent||[]).map(r=>({ item:r.item, count:r.count, fav:false }));
  const list = tab==="fav" ? favList : recList;
  const LIMIT = 6;
  const shown = expanded ? list : list.slice(0, LIMIT);

  // 즐겨찾기가 하나도 없으면 최근부터 보여준다
  useEffect(()=>{ if (favList.length===0 && tab==="fav") setTab("recent"); }, [favList.length]);

  const open = (it)=>{ setPicked(it); setAmt("1"); };
  // 빈칸이면 1인분, 숫자를 넣었으면 그 값(최소 0.1)을 쓴다.
  // num("0")은 0이라 `|| 1`로 처리하면 0을 1로 착각하므로 문자열로 판단한다.
  const mult = (v)=> String(v).trim()==="" ? 1 : Math.max(0.1, num(v));
  const commit = () => {
    if (!picked) return;
    const m = mult(amt);
    const f = picked.item;
    onAdd([{ id:uid(),
      name: m===1 ? f.name : `${f.name} ${m}인분`,
      protein: Math.round(num(f.protein)*m*10)/10,
      carbs:   Math.round(num(f.carbs)*m*10)/10,
      sugar:   Math.round(num(f.sugar)*m*10)/10,
      fat:     Math.round(num(f.fat)*m*10)/10,
      kcal:    Math.round(num(f.kcal)*m),
      liquidMl:Math.round(num(f.liquidMl)*m)||0 }]);
    setFlash(f.name);
    setTimeout(()=>setFlash(""), 1300);
    setPicked(null);
  };

  if (favList.length===0 && recList.length===0) return null;

  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={lbl}>빠른 추가</span>
        <div style={{ display:"flex", gap:5 }}>
          {[["fav",`⭐ ${favList.length}`],["recent",`최근 ${recList.length}`]].map(([k,label])=>(
            <button key={k} onClick={()=>{ setTab(k); setExpanded(false); }}
              style={{...chip(tab===k, k==="fav"?"#FFD24B":TYPES.push.color), padding:"5px 11px", fontSize:11.5}}>{label}</button>
          ))}
        </div>
      </div>

      {flash && (
        <div style={{ fontSize:11.5, color:TYPES.legs.color, fontWeight:700, marginTop:8 }}>
          "{flash}" 추가됐어요
        </div>
      )}

      {list.length===0 ? (
        <div style={{ fontSize:11.5, color:C.muted, marginTop:9, lineHeight:1.6 }}>
          {tab==="fav"
            ? "아직 별표한 음식이 없어요. 검색 결과나 식단 목록에서 ★을 누르면 여기 모여요."
            : "기록한 음식이 아직 없어요."}
        </div>
      ) : (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:10 }}>
          {shown.map(({item, count, fav})=>(
            <span key={item.name} style={{ display:"inline-flex", alignItems:"center", borderRadius:999,
              border:`1px solid ${C.line}`, background:C.surface2, overflow:"hidden" }}>
              <button onClick={()=>open({item})}
                style={{ background:"none", border:"none", cursor:"pointer", padding:"7px 10px",
                  color:C.text, fontSize:12.5, fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
                {item.name}
                <span style={{ fontSize:10, color:C.muted, fontWeight:600 }}>
                  {Math.round(num(item.kcal))}{tab==="recent"&&count>1?` · ${count}회`:""}
                </span>
              </button>
              {/* 별표 켜고 끄기 — 목록을 직접 정리할 수 있게 */}
              <button onClick={()=> fav ? onUnstar(item.id) : onStar(item)}
                title={fav?"별표 해제":"별표"}
                style={{ background:"none", border:"none", borderLeft:`1px solid ${C.line}`,
                  cursor:"pointer", padding:"7px 9px", fontSize:11,
                  color: fav ? "#FFD24B" : C.muted }}>{fav ? "★" : "☆"}</button>
            </span>
          ))}
          {list.length>LIMIT && (
            <button onClick={()=>setExpanded(v=>!v)}
              style={{ background:"none", border:`1px dashed ${C.line}`, borderRadius:999,
                padding:"7px 12px", cursor:"pointer", color:C.muted, fontSize:11.5, fontWeight:700 }}>
              {expanded ? "접기" : `+${list.length-LIMIT}`}
            </button>
          )}
        </div>
      )}

      {/* 양 입력 — 매번 달라지므로 직접 넣게 한다 */}
      {picked && (
        <div style={{ marginTop:11, padding:"12px", background:C.surface2, borderRadius:11 }}>
          <div style={{ fontSize:12.5, fontWeight:800, marginBottom:8 }}>{picked.item.name}</div>
          <div style={{ display:"flex", gap:5, marginBottom:8 }}>
            {["0.5","1","1.5","2"].map(v=>(
              <button key={v} onClick={()=>setAmt(v)}
                style={{...chip(amt===v, TYPES.push.color), flex:1, textAlign:"center", padding:"7px 0", fontSize:11.5}}>
                {v==="0.5"?"½":v}인분
              </button>
            ))}
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <input value={amt} onChange={(e)=>setAmt(e.target.value.replace(/[^0-9.]/g,""))}
              inputMode="decimal" placeholder="예: 1.3"
              style={{...inp, flex:1, minWidth:0, textAlign:"center", fontSize:15, fontWeight:800}} />
            <span style={{ fontSize:11.5, color:C.muted, flexShrink:0 }}>인분</span>
          </div>
          <div style={{ fontSize:10.5, color:C.muted, marginTop:7 }}>
            {(()=>{ const m=mult(amt);
              return `단백질 ${Math.round(num(picked.item.protein)*m*10)/10}g · ${Math.round(num(picked.item.kcal)*m)}kcal`; })()}
          </div>
          <div style={{ display:"flex", gap:7, marginTop:10 }}>
            <button onClick={()=>setPicked(null)} style={{...ghost, flex:1}}>취소</button>
            <button onClick={commit} style={{...primary(TYPES.legs.color), flex:2}}>오늘 식단에 추가</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function FoodSearch({ addFoodsToday, customFoods, mutate, schedule, favorites, mealSets, target, tdee, surplus, addFavorite, removeFavorite }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [added, setAdded] = useState({});
  const [quickSort, setQuickSort] = useState("recent"); // recent | frequent
  const [quickAdded, setQuickAdded] = useState({});
  const [guideOpen, setGuideOpen] = useState(false);
  const [group, setGroup] = useState(null);   // 선택한 큰 갈래
  const [nutri, setNutri] = useState(null);   // 영양 기준 필터
  const [favOnly, setFavOnly] = useState(false);
  const [sortBy, setSortBy] = useState("default");
  const [filterOpen, setFilterOpen] = useState(false);
  const [shown, setShown] = useState(30);   // 한 번에 그리는 개수 (전부 그리면 느려짐)
  useEffect(()=>{ setShown(30); }, [q, cat, group, nutri, favOnly, sortBy]);
  // 오늘 얼마나 먹었는지 — "이거 먹으면 목표 몇 %" 를 미리 보여주기 위함
  const todayFoodsNow = (schedule?.[todayKey()]?.foods) || [];
  const eaten = {
    protein: todayFoodsNow.reduce((s2,f)=>s2+num(f.protein),0),
    kcal: todayFoodsNow.reduce((s2,f)=>s2+num(f.kcal),0),
  };
  const kcalGoal = tdee!=null ? tdee + num(surplus) : null;
  const activeCount = (cat?1:0) + (!cat&&group?1:0) + (nutri?1:0) + (favOnly?1:0);
  const clearFilters = ()=>{ setCat(null); setGroup(null); setNutri(null); setFavOnly(false); };

  // 지금까지 기록한 식단에서 최근·자주 먹은 음식 뽑기 (이름+영양 그대로 원탭 재등록용)
  const quickFoods = React.useMemo(()=>{
    const map = new Map(); // name -> { item, count, order }
    const dates = Object.keys(schedule||{}).sort().reverse(); // 최근 날짜 우선
    let order = 0;
    for (const dk of dates) {
      const foods = schedule[dk]?.foods || [];
      for (let i=foods.length-1; i>=0; i--) {
        const f = foods[i];
        if (!f || !f.name) continue;
        if (map.has(f.name)) { map.get(f.name).count++; }
        else { map.set(f.name, { item:f, count:1, order:order++ }); } // order=최초 등장(=가장 최근) 순
      }
    }
    return [...map.values()];
  }, [schedule]);
  const quickList = React.useMemo(()=>{
    const arr = [...quickFoods];
    if (quickSort==="frequent") arr.sort((a,b)=> b.count-a.count || a.order-b.order);
    else arr.sort((a,b)=> a.order-b.order);
    return arr.slice(0, 12);
  }, [quickFoods, quickSort]);
  const quickAdd = (item) => {
    addFoodsToday([{ id:uid(), name:item.name, protein:num(item.protein), carbs:num(item.carbs), sugar:num(item.sugar), fat:num(item.fat), kcal:num(item.kcal), liquidMl:num(item.liquidMl)||0 }]);
    setQuickAdded((a)=>({ ...a, [item.name]:true }));
    setTimeout(()=>setQuickAdded((a)=>({ ...a, [item.name]:false })), 1200);
  };
  const [cf, setCf] = useState({ name:"", cat:"기타", protein:"", carbs:"", sugar:"", fat:"", kcal:"", liquidMl:"", fixedLiquid:false, gramsPerServing:"" });

  const catCounts = React.useMemo(()=>categoryCounts(customFoods), [customFoods]);
  // 내가 실제로 많이 쓴 분류를 앞으로 (4번)
  const catUse = React.useMemo(()=>categoryUsage(schedule, customFoods), [schedule, customFoods]);
  const groupUse = (g)=> g.cats.reduce((n,c)=>n+(catUse[c]||0), 0);
  const sortedGroups = React.useMemo(()=>{
    const arr = CATEGORY_GROUPS.filter(g=> g.cats.reduce((n,c)=>n+(catCounts[c]||0),0) > 0);
    return [...arr].sort((a,b)=> groupUse(b)-groupUse(a));
  }, [catCounts, catUse]);
  const sortedCatsOf = (gk)=>{
    const gc = CATEGORY_GROUPS.find(g=>g.key===gk)?.cats || [];
    return gc.filter(c=>(catCounts[c]||0)>0).sort((a,b)=> (catUse[b]||0)-(catUse[a]||0));
  };
  // 카테고리(그룹/개별) + 영양 기준 + 즐겨찾기를 겹쳐서 적용
  const results = React.useMemo(()=>{
    let list = searchAllFoods(q, customFoods, cat==="내 음식" ? "내 음식" : cat);
    if (!cat && group) {
      const gc = CATEGORY_GROUPS.find(g=>g.key===group)?.cats || [];
      list = list.filter(e=> gc.includes(displayCat(e)));
    }
    if (nutri) {
      const f = NUTRI_FILTERS.find(x=>x.key===nutri);
      if (f) list = list.filter(f.test);
    }
    if (favOnly) {
      const favSet = new Set(favorites.map(f=>String(f.name||f.key||"").trim()));
      list = list.filter(e=> favSet.has(String(e.key).trim()));
    }
    if (sortBy==="protein") list = [...list].sort((a,b)=> proteinPer100kcal(b)-proteinPer100kcal(a) || b.protein-a.protein);
    else if (sortBy==="kcal") list = [...list].sort((a,b)=> a.kcal-b.kcal);
    return list;
  }, [q, customFoods, cat, group, nutri, favOnly, favorites, sortBy]);

  const [qty, setQty] = useState({}); // 항목별 선택 수량 (기본 1인분)
  const [gramMode, setGramMode] = useState({}); // 항목별 g 직접입력값 (있으면 g 기준)
  const multOf = (e) => {
    const g = gramMode[e.key];
    if (g!=null && g!=="") { const gv=num(g); return gv>0 ? gv/gramsPerServing(e) : 1; }
    return qty[e.key] || 1;
  };
  const addToToday = (e) => {
    const mult = multOf(e);
    const g = gramMode[e.key];
    const usingGram = g!=null && g!=="" && num(g)>0;
    const r1 = (v)=>Math.round(v*mult*10)/10;
    const label = usingGram ? `${e.key} ${num(g)}g` : (Math.abs(mult-1)<0.001 ? e.key : `${e.key} ${Math.round(mult*100)/100}인분`);
    addFoodsToday([{ id:uid(), name: label,
      protein:r1(e.protein), carbs:r1(e.carbs), sugar:r1(e.sugar), fat:r1(e.fat), kcal:Math.round(e.kcal*mult),
      liquidMl: e.liquidMl ? (e.fixedLiquid ? e.liquidMl : Math.round(e.liquidMl*mult)) : 0 }]);
    setAdded((a)=>({ ...a, [e.key]:true }));
    setTimeout(()=>setAdded((a)=>({ ...a, [e.key]:false })), 1500);
  };

  const addCustomFood = () => {
    if (!cf.name.trim()) return;
    const entry = makeCustomEntry({ name:cf.name.trim(), cat:cf.cat, protein:num(cf.protein), carbs:num(cf.carbs), sugar:num(cf.sugar), fat:num(cf.fat), kcal:num(cf.kcal), liquidMl:num(cf.liquidMl), fixedLiquid:cf.fixedLiquid, gramsPerServing:num(cf.gramsPerServing) });
    mutate((prev)=>({ ...prev, customFoods:[...prev.customFoods.filter(e=>e.key!==entry.key), entry] }));
    setCf({ name:"", cat:"기타", protein:"", carbs:"", sugar:"", fat:"", kcal:"", liquidMl:"", fixedLiquid:false, gramsPerServing:"" });
    setAddOpen(false);
  };
  const removeCustomFood = (key) => mutate((prev)=>({ ...prev, customFoods:prev.customFoods.filter(e=>e.key!==key) }), `"${key}"`);
  const [editKey, setEditKey] = useState(null);
  const saveEdit = (orig, patch) => {
    const entry = { ...orig, ...patch, custom:true, cat: patch.cat||orig.cat,
      aliases: Array.from(new Set([patch.key||orig.key, ...(orig.aliases||[])])) };
    if (!(patch.liquidMl>0)) delete entry.liquidMl;
    if (!(patch.liquidMl>0) || !patch.fixedLiquid) delete entry.fixedLiquid; else entry.fixedLiquid = true;
    if (patch.gramsPerServing>0) entry.gramsPerServing = patch.gramsPerServing; else delete entry.gramsPerServing;
    mutate((prev)=>({ ...prev, customFoods:[...prev.customFoods.filter(e=>e.key!==orig.key && e.key!==entry.key), entry] }));
    setEditKey(null);
  };

  // 검색 결과 설명 문구
  const contextLabel = () => {
    if (cat && q) return `${cat} 안에서 "${q}"`;
    if (cat) return cat;
    if (q) return `"${q}" 검색결과`;
    return "전체 음식";
  };

  return (
    <div>
      {/* 검색창 */}
      <div style={{ position:"relative", marginTop:14 }}>
        <input value={q} onChange={(e)=>setQ(e.target.value)}
          placeholder={cat ? `${cat} 안에서 검색` : "음식 검색 (예: 치킨, 교촌, 닭가슴살)"}
          style={{...inp, width:"100%", boxSizing:"border-box", paddingLeft:38, paddingRight:36, fontSize:14.5}} />
        <span style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", fontSize:14, color:C.muted }}>🔍</span>
        {q && <span onClick={()=>setQ("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", fontSize:18, color:C.muted, cursor:"pointer", lineHeight:1 }}>×</span>}
      </div>

      {/* 필터 한 줄 — 자세한 건 시트에서 (화면을 짧게 유지) */}
      <div style={{ display:"flex", gap:6, marginTop:10 }}>
        <button onClick={()=>setFilterOpen(true)}
          style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            padding:"9px 0", borderRadius:10, cursor:"pointer", fontSize:12, fontWeight:800,
            border:`1.5px solid ${activeCount>0?TYPES.push.color:C.line}`,
            background: activeCount>0?tint(TYPES.push.color,0.13):C.surface,
            color: activeCount>0?TYPES.push.color:C.muted }}>
          ⚙️ 필터{activeCount>0?` ${activeCount}`:""}
        </button>
        <button onClick={()=>setGuideOpen(true)}
          style={{ flex:1, padding:"9px 0", borderRadius:10, cursor:"pointer", fontSize:12, fontWeight:700,
            border:`1px solid ${C.line}`, background:C.surface, color:C.muted }}>
          📏 얼마나 먹었지?
        </button>
      </div>

      {guideOpen && <PortionGuideSheet onClose={()=>setGuideOpen(false)} />}

      {filterOpen && (
        <FoodFilterSheet
          catCounts={catCounts} sortedGroups={sortedGroups} sortedCatsOf={sortedCatsOf}
          group={group} setGroup={setGroup} cat={cat} setCat={setCat}
          nutri={nutri} setNutri={setNutri} favOnly={favOnly} setFavOnly={setFavOnly}
          favCount={favorites.length} customCount={customFoods.length}
          resultCount={results.length} onClose={()=>setFilterOpen(false)}
          onClear={clearFilters} />
      )}

      {/* 빠른 추가 — 별표·최근. 항목을 누르면 양을 정해서 넣는다 */}
      {!q && !cat && (
        <QuickPick favorites={favorites} recent={quickList} onAdd={addFoodsToday}
          onUnstar={removeFavorite} onStar={addFavorite} />
      )}


      {/* 식단 세트 — 검색 중엔 숨겨서 결과에 집중 */}
      {!q.trim() && (
        <MealSets sets={mealSets} mutate={mutate} addFoodsToday={addFoodsToday} schedule={schedule} />
      )}

      {/* 내 음식 등록 */}
      <Card>
        <div onClick={()=>setAddOpen((v)=>!v)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
          <span style={lbl}>+ 내 음식 등록</span>
          <span style={{ fontSize:14, color:C.muted, transform:addOpen?"rotate(180deg)":"none", transition:"transform .2s" }}>▾</span>
        </div>
        {addOpen && (
          <>
            <div style={{ fontSize:11.5, color:C.muted, marginTop:8, lineHeight:1.55 }}>
              <b style={{color:C.text}}>1인분</b> 기준 영양성분을 넣어주세요. 이름엔 수량을 빼고요 —
              "엄마표 닭갈비"로 저장하면 나중에 "엄마표 닭갈비 2인분"도 자동 계산돼요.
            </div>

            <div style={{ fontSize:11, color:C.muted, fontWeight:700, margin:"14px 0 6px" }}>음식 이름</div>
            <input value={cf.name} onChange={(e)=>setCf({...cf,name:e.target.value})} placeholder="예: 엄마표 닭갈비"
              style={{...inp, width:"100%", boxSizing:"border-box"}} />

            <div style={{ fontSize:11, color:C.muted, fontWeight:700, margin:"14px 0 6px" }}>카테고리</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {CATEGORIES.map((c)=>(
                <button key={c} onClick={()=>setCf({...cf, cat:c})} style={{...chip(cf.cat===c, TYPES.legs.color), padding:"7px 11px", fontSize:12}}>{c}</button>
              ))}
            </div>

            <div style={{ fontSize:11, color:C.muted, fontWeight:700, margin:"14px 0 6px" }}>영양성분 (1인분)</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <LabeledInput label="단백질 g" v={cf.protein} on={(v)=>setCf({...cf,protein:v})} />
              <LabeledInput label="탄수 g" v={cf.carbs} on={(v)=>setCf({...cf,carbs:v})} />
              <LabeledInput label="당류 g" v={cf.sugar} on={(v)=>setCf({...cf,sugar:v})} />
            </div>
            <div style={{ display:"flex", gap:6, marginTop:8 }}>
              <LabeledInput label="지방 g" v={cf.fat} on={(v)=>setCf({...cf,fat:v})} />
              <LabeledInput label="칼로리 kcal" v={cf.kcal} on={(v)=>setCf({...cf,kcal:v})} />
            </div>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", margin:"14px 0 6px" }}>
              <span style={{ fontSize:11, color:C.muted, fontWeight:700 }}>1인분 무게 <span style={{ opacity:0.7 }}>(선택)</span></span>
              <button onClick={()=>setGuideOpen(true)} style={{ background:"none", border:"none", cursor:"pointer",
                color:TYPES.push.color, fontSize:11, fontWeight:800, padding:0 }}>📏 얼마나인지 모르겠어요</button>
            </div>
            {CAT_PORTION_HINT[cf.cat] && (
              <div style={{ fontSize:10.5, color:TYPES.push.color, background:tint(TYPES.push.color,0.1),
                borderRadius:8, padding:"7px 10px", marginBottom:7, lineHeight:1.45 }}>
                {cf.cat} 기준: {CAT_PORTION_HINT[cf.cat]}
              </div>
            )}
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <LabeledInput label="1인분 = ?g" v={cf.gramsPerServing} on={(v)=>setCf({...cf,gramsPerServing:v})} />
              <div style={{ display:"flex", gap:5 }}>
                {[30,100,200,350].map((g)=>(
                  <button key={g} onClick={()=>setCf({...cf, gramsPerServing:String(g)})} style={{...chip(String(g)===String(cf.gramsPerServing), TYPES.legs.color), padding:"7px 9px", fontSize:11.5}}>{g}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize:10.5, color:C.muted, marginTop:6, lineHeight:1.5 }}>
              위에 적은 영양성분이 <b style={{color:C.text}}>몇 g 기준</b>인지예요. 비워두면 카테고리 평균으로 어림잡아서 "≈300g" 같이 부정확하게 표시돼요.
            </div>

            <div style={{ fontSize:11, color:C.muted, fontWeight:700, margin:"14px 0 6px" }}>수분량 <span style={{ opacity:0.7 }}>(음료일 때만 · 물 자동 반영)</span></div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <LabeledInput label="수분 ml" v={cf.liquidMl} on={(v)=>setCf({...cf,liquidMl:v})} />
              <div style={{ display:"flex", gap:5 }}>
                {[250,355,500].map((ml)=>(
                  <button key={ml} onClick={()=>setCf({...cf, liquidMl:String(ml)})} style={{...chip(String(ml)===String(cf.liquidMl), "#6BC5F0"), padding:"7px 9px", fontSize:11.5}}>{ml}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize:10.5, color:C.muted, marginTop:6, lineHeight:1.5 }}>
              단백질 음료·주스 등 마시는 거면 ml를 넣어주세요. 추가할 때 물 트래커에 자동으로 더해져요. (음식이면 비워두세요.)
            </div>
            {num(cf.liquidMl)>0 && (
              <div onClick={()=>setCf({...cf, fixedLiquid:!cf.fixedLiquid})}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginTop:8, padding:"10px 12px", borderRadius:10, cursor:"pointer",
                  background: cf.fixedLiquid?tint("#6BC5F0",0.13):C.surface2, border:`1.5px solid ${cf.fixedLiquid?"#6BC5F0":C.line}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:800, color: cf.fixedLiquid?"#6BC5F0":C.text }}>💧 수분 고정</div>
                  <div style={{ fontSize:10.5, color:C.muted, marginTop:2, lineHeight:1.45 }}>보충제처럼 양(인분)이 늘어도 물은 그대로일 때. 켜면 몇 인분을 먹든 {num(cf.liquidMl)}ml만 반영돼요.</div>
                </div>
                <div style={{ width:40, height:23, borderRadius:99, flexShrink:0, background: cf.fixedLiquid?"#6BC5F0":C.line, position:"relative", transition:"background .2s" }}>
                  <div style={{ width:19, height:19, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left: cf.fixedLiquid?18:2, transition:"left .2s" }} />
                </div>
              </div>
            )}

            <button onClick={addCustomFood} disabled={!cf.name.trim()}
              style={{...primary(TYPES.legs.color), width:"100%", marginTop:12, opacity:cf.name.trim()?1:0.45}}>
              내 음식으로 저장
            </button>
          </>
        )}
      </Card>


      {/* 결과 헤더 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", margin:"18px 2px 8px" }}>
        <span style={{ fontSize:12.5, color:C.text, fontWeight:700 }}>{contextLabel()}</span>
        <span style={{ fontSize:11.5, color:C.muted }}>{results.length}개</span>
      </div>

      {/* 지금 걸린 필터 — 스크롤해도 뭐가 적용됐는지 보이게 (9번) */}
      {(cat || group || nutri || favOnly || q.trim()) && (
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginTop:11,
          padding:"9px 11px", background:tint(TYPES.push.color,0.08),
          border:`1px solid ${tint(TYPES.push.color,0.28)}`, borderRadius:11 }}>
          <span style={{ fontSize:10.5, color:C.muted, fontWeight:700, flexShrink:0 }}>필터</span>
          {q.trim() && (
            <button onClick={()=>setQ("")} style={activeTagStyle(C.text)}>
              🔍 {q.trim()} <span style={{ opacity:0.6 }}>✕</span>
            </button>
          )}
          {favOnly && (
            <button onClick={()=>setFavOnly(false)} style={activeTagStyle("#FFD24B")}>
              ⭐ 즐겨찾기 <span style={{ opacity:0.6 }}>✕</span>
            </button>
          )}
          {nutri && (()=>{ const f=NUTRI_FILTERS.find(x=>x.key===nutri); return (
            <button onClick={()=>setNutri(null)} style={activeTagStyle(f.color)}>
              {f.icon} {f.label} <span style={{ opacity:0.6 }}>✕</span>
            </button>
          ); })()}
          {group && !cat && (()=>{ const g=CATEGORY_GROUPS.find(x=>x.key===group); return (
            <button onClick={()=>setGroup(null)} style={activeTagStyle(g?g.color:TYPES.push.color)}>
              {g?g.icon:""} {group} <span style={{ opacity:0.6 }}>✕</span>
            </button>
          ); })()}
          {cat && (
            <button onClick={()=>setCat(null)} style={activeTagStyle(cat==="내 음식"?TYPES.legs.color:TYPES.push.color)}>
              {catIcon(cat)} {cat} <span style={{ opacity:0.6 }}>✕</span>
            </button>
          )}
          <button onClick={()=>{ setQ(""); setCat(null); setGroup(null); setNutri(null); setFavOnly(false); }}
            style={{ marginLeft:"auto", background:"none", border:"none", color:C.muted, fontSize:10.5,
              fontWeight:700, cursor:"pointer", padding:"2px 4px", flexShrink:0 }}>전체 해제</button>
        </div>
      )}

      {/* 결과 개수 + 정렬 */}
      {results.length>0 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:12, marginBottom:2 }}>
          <span style={{ fontSize:11.5, color:C.muted, fontWeight:700 }}>{results.length}개</span>
          <div style={{ display:"flex", gap:5 }}>
            {[["default","기본"],["protein","단백질순"],["kcal","저칼로리순"]].map(([k,label])=>(
              <button key={k} onClick={()=>setSortBy(k)}
                style={{...chip(sortBy===k, TYPES.push.color), padding:"4px 10px", fontSize:10.5}}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* 결과 목록 */}
      {results.length===0 ? (
        <Card>
          <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:"18px 0", lineHeight:1.7 }}>
            찾는 음식이 없어요.<br/>
            <span style={{ color:TYPES.legs.color, fontWeight:700 }}>+ 내 음식 등록</span>으로 직접 추가해보세요.
          </div>
        </Card>
      ) : results.slice(0, shown).map((e)=>(
        <div key={(e.custom?"c:":"")+e.key} style={{ background:C.surface,
          border:`1px solid ${e.custom?tint(TYPES.legs.color,0.45):C.line}`,
          borderRadius:14, padding:"14px", marginTop:8 }}>

          {/* 이름 + 뱃지 */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                <span style={{ fontSize:15, fontWeight:800, letterSpacing:-0.2 }}>{e.key}</span>
                {e.custom && <span style={{ fontSize:9.5, fontWeight:800, color:"#141519", background:TYPES.legs.color, borderRadius:5, padding:"2px 6px" }}>{e.aliases?.length>1?"수정됨":"내 음식"}</span>}
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                {catIcon(displayCat(e))} {displayCat(e)} · {servingLabel(e)}
              </div>
            </div>
            {/* 별표 — 눌러두면 위 "빠른 추가"에 모여 다음부터 바로 넣을 수 있다 */}
            {(()=>{
              const fav = (favorites||[]).find(f=>f.name===e.key);
              return (
                <button onClick={()=> fav
                    ? removeFavorite(fav.id)
                    : addFavorite({ name:e.key, protein:e.protein, carbs:e.carbs, sugar:e.sugar, fat:e.fat, kcal:e.kcal, liquidMl:e.liquidMl })}
                  title={fav?"별표 해제":"별표"}
                  style={{ ...xBtn, fontSize:15, color: fav ? "#FFD24B" : C.muted }}>{fav ? "★" : "☆"}</button>
              );
            })()}
            <button onClick={()=>setEditKey(editKey===e.key?null:e.key)} title="수정" style={{ ...xBtn, fontSize:14 }}>✏️</button>
            {e.custom && <ConfirmX onConfirm={()=>removeCustomFood(e.key)} label="이 음식 삭제" />}
          </div>

          {editKey===e.key && (
            <DBFoodEdit entry={e} onSave={(patch)=>saveEdit(e, patch)} onCancel={()=>setEditKey(null)} />
          )}

          {/* 영양성분 — 단백질·칼로리를 크게, 나머지는 작게 */}
          <div style={{ display:"flex", gap:6, marginTop:12 }}>
            <div style={{ flex:1, background:tint(TYPES.legs.color,0.1), border:`1px solid ${tint(TYPES.legs.color,0.3)}`,
              borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ fontSize:9.5, color:C.muted, fontWeight:600 }}>단백질</div>
              <div style={{ fontSize:19, fontWeight:800, color:TYPES.legs.color, lineHeight:1.2 }}>{e.protein}<span style={{ fontSize:10 }}>g</span></div>
              {e.kcal>0 && <div style={{ fontSize:8.5, color:C.muted, marginTop:1 }}>100kcal당 {proteinPer100kcal(e)}g</div>}
            </div>
            <div style={{ flex:1, background:C.surface2, borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ fontSize:9.5, color:C.muted, fontWeight:600 }}>칼로리</div>
              <div style={{ fontSize:19, fontWeight:800, color:C.text, lineHeight:1.2 }}>{e.kcal}</div>
              <div style={{ fontSize:8.5, color:C.muted, marginTop:1 }}>1회분 기준</div>
            </div>
            <div style={{ flex:1.3, background:C.surface2, borderRadius:10, padding:"8px 6px",
              display:"flex", flexDirection:"column", justifyContent:"center", gap:3 }}>
              {[["탄수",e.carbs,"#5AA9FF"],["당류",e.sugar,"#FF8FB0"],["지방",e.fat,"#FFB74B"]].map(([l,v,col])=>(
                <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"0 3px" }}>
                  <span style={{ fontSize:9.5, color:C.muted }}>{l}</span>
                  <span style={{ fontSize:11.5, fontWeight:700, color:col }}>{v}g</span>
                </div>
              ))}
            </div>
          </div>

          {e.liquidMl>0 && (
            <div style={{ fontSize:11, color:"#6BC5F0", fontWeight:700, marginTop:8 }}>💧 수분 {e.liquidMl}ml{e.fixedLiquid?" 고정":""} · {e.fixedLiquid?`양과 무관하게 물 ${Math.round(e.liquidMl/250*10)/10}잔 반영`:`추가 시 물 ${Math.round(e.liquidMl/250*10)/10}잔 자동 반영`}</div>
          )}

          {/* 수량 선택 (인분 칩) */}
          <div style={{ display:"flex", gap:5, marginTop:10, alignItems:"center" }}>
            {[0.5,1,1.5,2].map((m)=>{
              const active = (gramMode[e.key]==null||gramMode[e.key]==="") && (qty[e.key]||1)===m;
              return (
                <button key={m} onClick={()=>{ setQty((s)=>({ ...s, [e.key]:m })); setGramMode((s)=>({ ...s, [e.key]:"" })); }}
                  style={{ ...chip(active, TYPES.push.color), flex:1, textAlign:"center", padding:"8px 0", fontSize:12 }}>
                  {m===0.5?"½":m}인분
                </button>
              );
            })}
          </div>
          {/* 이거 먹으면 오늘 목표가 어떻게 되는지 (3번) */}
          {(target || kcalGoal) && (()=>{
            const mult = multOf(e);
            const addP = e.protein * mult, addK = e.kcal * mult;
            const pAfter = target ? Math.round((eaten.protein + addP) / target.low * 100) : null;
            const kAfter = kcalGoal ? Math.round((eaten.kcal + addK) / kcalGoal * 100) : null;
            const over = (pAfter!=null && pAfter>=100) || (kAfter!=null && kAfter>100);
            return (
              <div style={{ display:"flex", gap:6, marginTop:8 }}>
                {pAfter!=null && (
                  <div style={{ flex:1, background: pAfter>=100?tint(TYPES.legs.color,0.12):C.surface2,
                    border:`1px solid ${pAfter>=100?tint(TYPES.legs.color,0.4):C.line}`,
                    borderRadius:9, padding:"7px 9px" }}>
                    <div style={{ fontSize:9.5, color:C.muted }}>먹으면 단백질</div>
                    <div style={{ fontSize:13, fontWeight:800, color: pAfter>=100?TYPES.legs.color:C.text }}>
                      {pAfter}% <span style={{ fontSize:9.5, color:C.muted, fontWeight:600 }}>
                        ({Math.round(eaten.protein+addP)}/{target.low}g)</span>
                    </div>
                  </div>
                )}
                {kAfter!=null && (
                  <div style={{ flex:1, background: kAfter>100?tint(C.amber,0.1):C.surface2,
                    border:`1px solid ${kAfter>100?tint(C.amber,0.4):C.line}`,
                    borderRadius:9, padding:"7px 9px" }}>
                    <div style={{ fontSize:9.5, color:C.muted }}>먹으면 칼로리</div>
                    <div style={{ fontSize:13, fontWeight:800, color: kAfter>100?C.amber:C.text }}>
                      {kAfter}% <span style={{ fontSize:9.5, color:C.muted, fontWeight:600 }}>
                        ({Math.round(eaten.kcal+addK)}/{kcalGoal})</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 지금 고른 양이 실제로 어느 정도인지 */}
          {(()=>{
            const mult = multOf(e);
            const gTotal = Math.round(gramsPerServing(e) * mult);
            const hint = portionHint(gTotal, displayCat(e));
            if (!hint) return null;
            return (
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:7, padding:"7px 10px",
                background:C.surface2, borderRadius:9 }}>
                <span style={{ fontSize:12 }}>📏</span>
                <span style={{ fontSize:11, color:C.muted, lineHeight:1.45 }}>
                  약 <b style={{ color:C.text }}>{gTotal}g</b> · {hint}
                </span>
              </div>
            );
          })()}
          {/* g 직접 입력 */}
          <div style={{ display:"flex", gap:6, marginTop:6, alignItems:"center" }}>
            <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>또는 직접</span>
            <div style={{ position:"relative", flex:1 }}>
              <input value={gramMode[e.key]||""} onChange={(ev)=>setGramMode((s)=>({ ...s, [e.key]:ev.target.value }))}
                inputMode="decimal" placeholder={`${gramsPerServing(e)} = 1인분`}
                style={{...inp, width:"100%", boxSizing:"border-box", padding:"7px 26px 7px 10px", fontSize:12.5,
                  borderColor: (gramMode[e.key]&&num(gramMode[e.key])>0)?TYPES.push.color:C.line}} />
              <span style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)", fontSize:11, color:C.muted }}>g</span>
            </div>
          </div>
          <button onClick={()=>addToToday(e)} style={{...ghost, width:"100%", marginTop:8,
            color:added[e.key]?TYPES.legs.color:C.muted, borderColor:added[e.key]?TYPES.legs.color:C.line }}>
            {added[e.key]?"오늘 식단에 추가됨 ✓":(()=>{ const mult=multOf(e); const isNon=Math.abs(mult-1)>0.001; const g=gramMode[e.key]; const usingG=g&&num(g)>0;
              return `오늘 식단에 추가${isNon?` (${usingG?`${num(g)}g`:`${Math.round(mult*100)/100}인분`} · ${Math.round(e.kcal*mult)}kcal)`:""}`; })()}
          </button>
        </div>
      ))}


      {results.length > shown && (
        <button onClick={()=>setShown(n=>n+30)} style={{...ghost, width:"100%", marginTop:4}}>
          {results.length - shown}개 더 보기
        </button>
      )}
    </div>
  );
}

// 음식 DB 항목 편집 폼 (이름·영양·수분 수정 → override 저장)

function DBFoodEdit({ entry, onSave, onCancel }) {
  const [v, setV] = useState({
    key: entry.key, protein:String(num(entry.protein)), carbs:String(num(entry.carbs)),
    sugar:String(num(entry.sugar)), fat:String(num(entry.fat)), kcal:String(num(entry.kcal)),
    liquidMl:String(num(entry.liquidMl)), fixedLiquid: !!entry.fixedLiquid,
    gramsPerServing: entry.gramsPerServing ? String(entry.gramsPerServing) : "",
  });
  const F = (label, key, wide) => (
    <div style={{ flex:wide?"1 1 100%":1, minWidth:60 }}>
      <div style={{ fontSize:9.5, color:C.muted, marginBottom:3 }}>{label}</div>
      <input value={v[key]} onChange={(ev)=>setV({...v,[key]:ev.target.value})} inputMode={key==="key"?"text":"decimal"}
        style={{...inp, width:"100%", boxSizing:"border-box", padding:"8px", fontSize:13}} />
    </div>
  );
  return (
    <div style={{ background:C.surface2, borderRadius:12, padding:"12px", marginTop:12 }}>
      <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:7 }}>음식 정보 수정 <span style={{opacity:0.7}}>(1인분 기준)</span></div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>{F("이름","key",true)}</div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:7 }}>
        {F("단백질 g","protein")}{F("탄수 g","carbs")}{F("당류 g","sugar")}
      </div>
      <div style={{ display:"flex", gap:6, marginTop:7 }}>
        {F("지방 g","fat")}{F("칼로리","kcal")}{F("수분 ml","liquidMl")}
      </div>
      <div style={{ marginTop:9, padding:"9px 11px", borderRadius:9, background:C.surface, border:`1px solid ${num(v.gramsPerServing)>0?tint(TYPES.legs.color,0.4):C.line}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:800, color: num(v.gramsPerServing)>0?TYPES.legs.color:C.text }}>⚖️ 1인분 무게</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2, lineHeight:1.45 }}>
              {num(v.gramsPerServing)>0
                ? `위 영양성분이 ${num(v.gramsPerServing)}g 기준이에요`
                : `미지정 — 지금은 ≈${gramsPerServing(entry)}g로 어림잡는 중`}
            </div>
          </div>
          <div style={{ width:76, flexShrink:0 }}>
            <input value={v.gramsPerServing} onChange={(ev)=>setV({...v, gramsPerServing:ev.target.value.replace(/[^0-9.]/g,"")})}
              inputMode="decimal" placeholder="예: 25"
              style={{...inp, width:"100%", boxSizing:"border-box", padding:"8px", fontSize:13, textAlign:"center"}} />
          </div>
        </div>
      </div>
      {num(v.liquidMl)>0 && (
        <div onClick={()=>setV({...v, fixedLiquid:!v.fixedLiquid})}
          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginTop:8, padding:"9px 11px", borderRadius:9, cursor:"pointer",
            background: v.fixedLiquid?tint("#6BC5F0",0.13):C.surface, border:`1.5px solid ${v.fixedLiquid?"#6BC5F0":C.line}` }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:800, color: v.fixedLiquid?"#6BC5F0":C.text }}>💧 수분 고정</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2, lineHeight:1.45 }}>보충제처럼 인분이 늘어도 물은 {num(v.liquidMl)}ml 그대로 반영</div>
          </div>
          <div style={{ width:38, height:22, borderRadius:99, flexShrink:0, background: v.fixedLiquid?"#6BC5F0":C.line, position:"relative", transition:"background .2s" }}>
            <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left: v.fixedLiquid?18:2, transition:"left .2s" }} />
          </div>
        </div>
      )}
      <div style={{ fontSize:10.5, color:C.muted, marginTop:8, lineHeight:1.5 }}>
        수정하면 내 음식으로 저장돼서, 다음부터 검색·기록할 때 이 값이 쓰여요.
      </div>
      <div style={{ display:"flex", gap:8, marginTop:10 }}>
        <button onClick={onCancel} style={{...ghost, flex:1}}>취소</button>
        <button onClick={()=>onSave({ key:v.key.trim()||entry.key, protein:num(v.protein), carbs:num(v.carbs), sugar:num(v.sugar), fat:num(v.fat), kcal:num(v.kcal), liquidMl:num(v.liquidMl), fixedLiquid:v.fixedLiquid, gramsPerServing:num(v.gramsPerServing) })}
          style={{...primary(TYPES.legs.color), flex:2}}>저장</button>
      </div>
    </div>
  );
}

// ================= 외식 =================

const RATING = { best:{label:"추천",color:"#B6E34B"}, good:{label:"무난",color:"#35C4D8"}, caution:{label:"주의",color:"#FF7A7A"} };

function Dining({ addFoodsToday, apiKey, customFoods, embedded }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [added, setAdded] = useState({});

  const ask = async () => {
    if(!text.trim()||loading) return;
    setLoading(true); setErr(""); setResult(null); setAdded({});
    try {
      if (!apiKey || !apiKey.trim()) {
        const local = localBrandSearch(text.trim(), customFoods);
        if (!local.length) throw new Error("API 키가 없어서 로컬 목록에서만 찾을 수 있어요. 이 메뉴/브랜드는 목록에 없어요. 키를 넣거나 다른 이름으로 검색해보세요.");
        const ranked = [...local].sort((a,b)=> (b.protein/Math.max(b.kcal,1)) - (a.protein/Math.max(a.kcal,1))).slice(0,5)
          .map((e,i)=>({ name:e.key, protein:e.protein, carbs:e.carbs, sugar:e.sugar, fat:e.fat, kcal:e.kcal, liquidMl:e.liquidMl||0, rating: i===0?"best":"good", reason:"로컬 추정치 · 단백질/칼로리 비율 기준" }));
        setResult({ picks: ranked, tip: "API 키가 없어서 로컬 목록 기준으로 정렬했어요. 더 폭넓은 추천은 API 키를 등록하면 볼 수 있어요." });
        return;
      }
      const raw = await callClaudeAPI(apiKey, MENU_PROMPT+text.trim());
      const parsed = extractJSON(raw);
      if(!parsed.picks||!parsed.picks.length) throw new Error("추천을 못 읽었어요");
      setResult(parsed);
    } catch(e){ setErr(`추천 실패: ${e.message}`); } finally { setLoading(false); }
  };
  const add = (p,idx)=>{ addFoodsToday([{ id:uid(), name:p.name, protein:num(p.protein), carbs:num(p.carbs), sugar:num(p.sugar), fat:num(p.fat), kcal:num(p.kcal), liquidMl:num(p.liquidMl) }]); setAdded((a)=>({ ...a, [idx]:true })); };

  return (
    <div style={{ padding: embedded ? "0" : "22px 18px 8px" }}>
      {!embedded && <>
        <div style={{ fontSize:11, letterSpacing:3, color:TYPES.push.color, fontWeight:800 }}>DINING</div>
        <div style={{ fontSize:30, fontWeight:800, letterSpacing:-1, marginTop:4 }}>외식 메뉴 고르기</div>
      </>}
      <div style={{ fontSize:13, color:C.muted, marginTop:embedded?14:6, lineHeight:1.5 }}>음식점이나 고민 중인 메뉴를 적으면 단백질·건강 기준으로 추천해줘요. 유명 프랜차이즈는 API 키 없이도 무료로 바로 찾아져요.</div>
      <Card>
        <textarea value={text} onChange={(e)=>setText(e.target.value)} rows={3}
          placeholder={"예: 맥도날드\n예: 빅맥이랑 맥치킨 중 뭐가 나아?\n예: 롯데리아 불고기버거, 새우버거"}
          style={{...inp, width:"100%", boxSizing:"border-box", resize:"none", lineHeight:1.4, fontFamily:"inherit"}} />
        <button onClick={ask} disabled={loading} style={{...primary(TYPES.push.color), width:"100%", marginTop:8, opacity:loading?0.6:1}}>{loading?"고르는 중…":"추천 받기"}</button>
        {err && <div style={{ fontSize:12, color:C.danger, marginTop:8 }}>{err}</div>}
      </Card>
      {result && (<>
        {result.tip && <div style={{ background:tint(TYPES.push.color,0.12), border:`1px solid ${tint(TYPES.push.color,0.4)}`, borderRadius:14, padding:"12px 14px", marginTop:12, fontSize:13, lineHeight:1.5 }}>{result.tip}</div>}
        {result.picks.map((p,idx)=>{ const r=RATING[p.rating]||RATING.good;
          return (<Card key={idx}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:15, fontWeight:800 }}>{p.name}</span>
              <span style={{ fontSize:10.5, fontWeight:800, color:"#141519", background:r.color, borderRadius:6, padding:"2px 7px" }}>{r.label}</span>
            </div>
            <div style={{ fontSize:13, color:C.muted, marginTop:5 }}>단백질 <span style={{ color:TYPES.legs.color, fontWeight:700 }}>{num(p.protein)}g</span> · 탄수 {num(p.carbs)}g · 당 {num(p.sugar)}g · 지방 {num(p.fat)}g · {num(p.kcal)}kcal</div>
            {p.reason && <div style={{ fontSize:12.5, color:C.muted, marginTop:5, lineHeight:1.45 }}>{p.reason}</div>}
            <button onClick={()=>add(p,idx)} disabled={added[idx]} style={{...ghost, width:"100%", marginTop:10, color:added[idx]?TYPES.legs.color:C.muted, borderColor:added[idx]?TYPES.legs.color:C.line }}>{added[idx]?"오늘 식단에 추가됨 ✓":"오늘 식단에 추가"}</button>
          </Card>); })}
      </>)}
    </div>
  );
}

// ================= 공부 =================

function FoodFilterSheet({ catCounts, sortedGroups, sortedCatsOf, group, setGroup, cat, setCat,
  nutri, setNutri, favOnly, setFavOnly, favCount, customCount, resultCount, onClose, onClear }) {
  return (
    <SheetLayer onClose={onClose}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink:0 }}>
          <div style={grip} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontSize:16, fontWeight:800 }}>필터</span>
            <span style={{ fontSize:11.5, color:C.muted }}>{resultCount}개 표시 중</span>
          </div>
        </div>

        <div style={{ flex:"1 1 auto", minHeight:0, overflowY:"auto", paddingRight:2, overscrollBehavior:"contain" }}>
          {/* 내 목록 */}
          {(favCount>0 || customCount>0) && (<>
            <div style={{ fontSize:11.5, fontWeight:800, color:C.muted, marginBottom:7 }}>내 목록</div>
            <div style={{ display:"flex", gap:6, marginBottom:16 }}>
              {favCount>0 && (
                <button onClick={()=>{ setFavOnly(!favOnly); setNutri(null); }}
                  style={{...chip(favOnly, "#FFD24B"), flex:1, padding:"9px 0", fontSize:12}}>⭐ 즐겨찾기 {favCount}</button>
              )}
              {customCount>0 && (
                <button onClick={()=>{ setCat(cat==="내 음식"?null:"내 음식"); setGroup(null); }}
                  style={{...chip(cat==="내 음식", TYPES.legs.color), flex:1, padding:"9px 0", fontSize:12}}>내 음식 {customCount}</button>
              )}
            </div>
          </>)}

          {/* 영양 기준 */}
          <div style={{ fontSize:11.5, fontWeight:800, color:C.muted, marginBottom:7 }}>영양 기준</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {NUTRI_FILTERS.map((f)=>{
              const on = nutri===f.key;
              return (
                <button key={f.key} onClick={()=>{ setNutri(on?null:f.key); setFavOnly(false); }}
                  style={{ padding:"10px 9px", borderRadius:11, cursor:"pointer", textAlign:"left",
                    border:`1.5px solid ${on?f.color:C.line}`, background:on?tint(f.color,0.14):C.surface2,
                    color: on?f.color:C.text }}>
                  <div style={{ fontSize:12.5, fontWeight:800 }}>{f.icon} {f.label}</div>
                  <div style={{ fontSize:9.5, color:C.muted, marginTop:2, lineHeight:1.4 }}>{f.desc}</div>
                </button>
              );
            })}
          </div>

          {/* 분류 */}
          <div style={{ fontSize:11.5, fontWeight:800, color:C.muted, margin:"18px 0 7px" }}>
            분류 <span style={{ fontWeight:600, opacity:0.75 }}>· 자주 쓰는 순</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {sortedGroups.map((g)=>{
              const open = group===g.key;
              const total = g.cats.reduce((n,c)=>n+(catCounts[c]||0),0);
              return (
                <div key={g.key}>
                  <button onClick={()=>{ setGroup(open?null:g.key); setCat(null); }}
                    style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"11px 12px",
                      borderRadius:11, cursor:"pointer", textAlign:"left",
                      border:`1.5px solid ${open?g.color:C.line}`,
                      background: open?tint(g.color,0.13):C.surface2 }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>{g.icon}</span>
                    <span style={{ flex:1, fontSize:13, fontWeight:800, color:open?g.color:C.text }}>{g.key}</span>
                    <span style={{ fontSize:10.5, color:C.muted }}>{total}</span>
                    <span style={{ fontSize:10, color:C.muted }}>{open?"▴":"▾"}</span>
                  </button>
                  {open && (
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap", padding:"8px 4px 2px" }}>
                      {sortedCatsOf(g.key).map((c)=>(
                        <button key={c} onClick={()=>setCat(cat===c?null:c)}
                          style={{...chip(cat===c, g.color), padding:"6px 11px", fontSize:11.5}}>
                          {catIcon(c)} {c} <span style={{ opacity:0.6 }}>{catCounts[c]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ height:8 }} />
        </div>

        <div style={{ flexShrink:0, display:"flex", gap:8, padding:"12px 0 calc(14px + env(safe-area-inset-bottom))",
          borderTop:`1px solid ${C.line}`, background:C.surface }}>
          <button onClick={onClear} style={{...ghost, flex:1}}>초기화</button>
          <button onClick={onClose} style={{...primary(TYPES.push.color), flex:2}}>{resultCount}개 보기</button>
        </div>
      </div>
    </SheetLayer>
  );
}

// ================= 식단 세트 =================
// 매일 같은 조합(아침 세트 등)을 원탭으로 등록. 오늘 먹은 걸 그대로 세트로 저장할 수도 있다.

function MealSets({ sets, mutate, addFoodsToday, schedule }) {
  const [open, setOpen] = useState(false);
  const [makeOpen, setMakeOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🌅");
  const [added, setAdded] = useState({});
  const todayFoods = (schedule?.[todayKey()]?.foods) || [];
  const ICONS = ["🌅","☀️","🌙","🍫","💪","🥗"];

  const list = sets || [];
  const sum = (items, k)=> Math.round(items.reduce((s,f)=>s+num(f[k]),0));

  const saveSet = () => {
    if (!name.trim() || todayFoods.length===0) return;
    const items = todayFoods.map(f=>({ name:f.name, protein:num(f.protein), carbs:num(f.carbs),
      sugar:num(f.sugar), fat:num(f.fat), kcal:num(f.kcal), liquidMl:num(f.liquidMl)||0 }));
    mutate((prev)=>({ ...prev, mealSets:[...(prev.mealSets||[]), { id:uid(), name:name.trim(), icon, items }] }));
    setName(""); setMakeOpen(false);
  };
  const removeSet = (id) => {
    const t = list.find(x=>x.id===id);
    mutate((prev)=>({ ...prev, mealSets:(prev.mealSets||[]).filter(x=>x.id!==id) }), t?`"${t.name}" 세트`:"세트");
  };
  const applySet = (st) => {
    addFoodsToday(st.items.map(f=>({ ...f, id:uid() })));
    setAdded((a)=>({ ...a, [st.id]:true }));
    setTimeout(()=>setAdded((a)=>({ ...a, [st.id]:false })), 1400);
  };

  if (list.length===0 && !open) {
    return (
      <div style={{ marginBottom:12 }}>
        <button onClick={()=>setOpen(true)} style={{...ghost, width:"100%", fontSize:12}}>
          🍱 자주 먹는 조합을 세트로 저장하기
        </button>
      </div>
    );
  }

  return (
    <Card>
      <Row><span style={lbl}>식단 세트</span>
        <button onClick={()=>setMakeOpen(v=>!v)} style={{ background:"none", border:"none", color:TYPES.legs.color,
          fontSize:12, fontWeight:800, cursor:"pointer", padding:0 }}>{makeOpen?"닫기":"+ 세트 만들기"}</button>
      </Row>

      {list.length>0 ? (
        <div style={{ display:"flex", flexDirection:"column", gap:7, marginTop:11 }}>
          {list.map((st)=>{
            const done = added[st.id];
            return (
              <div key={st.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 12px", borderRadius:11,
                background: done?tint(TYPES.legs.color,0.12):C.surface2,
                border:`1px solid ${done?TYPES.legs.color:C.line}` }}>
                <span style={{ fontSize:19, flexShrink:0 }}>{st.icon||"🍱"}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:800 }}>{st.name}</div>
                  <div style={{ fontSize:10.5, color:C.muted, marginTop:2, overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {st.items.length}개 · {sum(st.items,"kcal")}kcal · 단백질 {sum(st.items,"protein")}g
                  </div>
                  <div style={{ fontSize:10, color:C.muted, opacity:0.75, marginTop:2, overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {st.items.map(f=>f.name).join(", ")}
                  </div>
                </div>
                <button onClick={()=>applySet(st)} style={{...primary(done?TYPES.legs.color:TYPES.push.color),
                  padding:"8px 13px", fontSize:11.5, flexShrink:0}}>{done?"추가됨 ✓":"추가"}</button>
                <ConfirmX onConfirm={()=>removeSet(st.id)} label="세트 삭제" />
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize:12, color:C.muted, marginTop:10, lineHeight:1.6 }}>
          아직 세트가 없어요. 오늘 먹은 걸 그대로 세트로 저장해두면 다음부터 한 번에 등록돼요.
        </div>
      )}

      {makeOpen && (
        <div style={{ marginTop:12, padding:"12px", background:C.surface2, borderRadius:11 }}>
          {todayFoods.length===0 ? (
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
              먼저 오늘 식단에 음식을 넣어주세요. <b style={{color:C.text}}>지금 오늘 먹은 목록</b>이 그대로 세트가 돼요.
            </div>
          ) : (<>
            <div style={{ fontSize:11, color:C.muted, marginBottom:7, lineHeight:1.5 }}>
              오늘 먹은 {todayFoods.length}개({sum(todayFoods,"kcal")}kcal)를 세트로 저장해요.
            </div>
            <div style={{ display:"flex", gap:5, marginBottom:8 }}>
              {ICONS.map((ic)=>(
                <button key={ic} onClick={()=>setIcon(ic)}
                  style={{ flex:1, padding:"7px 0", borderRadius:9, cursor:"pointer", fontSize:16,
                    border:`1.5px solid ${icon===ic?TYPES.legs.color:C.line}`,
                    background: icon===ic?tint(TYPES.legs.color,0.14):C.surface }}>{ic}</button>
              ))}
            </div>
            <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="세트 이름 (예: 아침 세트)"
              style={{...inp, width:"100%", boxSizing:"border-box"}} />
            <button onClick={saveSet} disabled={!name.trim()}
              style={{...primary(TYPES.legs.color), width:"100%", marginTop:8, opacity:name.trim()?1:0.45}}>
              이 조합 저장
            </button>
          </>)}
        </div>
      )}
    </Card>
  );
}

// ================= 오늘 단어 복습 (오늘 탭) =================
// 공부 탭까지 들어가야 하는 번거로움을 없애려고, 오늘 볼 단어를 여기서 바로 넘긴다.

function PortionGuideSheet({ onClose }) {
  return (
    <SheetLayer onClose={onClose}>
      <div onClick={(e)=>e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink:0 }}>
          <div style={grip} />
          <div style={{ fontSize:16, fontWeight:800 }}>📏 얼마나 먹었는지 재는 법</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:4, marginBottom:12 }}>
            저울이 없어도 손과 그릇으로 꽤 정확하게 어림할 수 있어요.
          </div>
        </div>

        <div style={{ flex:"1 1 auto", minHeight:0, overflowY:"auto", paddingRight:2, overscrollBehavior:"contain" }}>
          {/* 손 기준 */}
          <div style={{ fontSize:12, fontWeight:800, color:TYPES.push.color, marginBottom:8 }}>손으로 재기</div>
          <div style={{ fontSize:10.5, color:C.muted, marginBottom:9, lineHeight:1.5 }}>
            손은 항상 가지고 다니고 체격에 비례해서, 개인 기준으로 쓰기 좋아요.
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {HAND_GUIDE.map((h)=>(
              <div key={h.name} style={{ display:"flex", gap:11, alignItems:"flex-start",
                background:C.surface2, borderRadius:11, padding:"11px 12px" }}>
                <span style={{ fontSize:22, lineHeight:1.1, flexShrink:0 }}>{h.icon}</span>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:800 }}>{h.name} = {h.amount}</div>
                  <div style={{ fontSize:10.5, color:C.muted, marginTop:3, lineHeight:1.5 }}>{h.note}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 그릇 기준 */}
          <div style={{ fontSize:12, fontWeight:800, color:TYPES.pull.color, margin:"18px 0 8px" }}>집에 있는 그릇으로 재기</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
            {CONTAINER_GUIDE.map((c)=>(
              <div key={c.name} style={{ background:C.surface2, borderRadius:10, padding:"10px 11px" }}>
                <div style={{ fontSize:11.5, fontWeight:700 }}>{c.name}</div>
                <div style={{ fontSize:11, color:TYPES.pull.color, fontWeight:800, marginTop:3 }}>{c.amount}</div>
              </div>
            ))}
          </div>

          {/* 카테고리별 1인분 */}
          <div style={{ fontSize:12, fontWeight:800, color:TYPES.legs.color, margin:"18px 0 8px" }}>보통 1인분은 이 정도</div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {Object.entries(CAT_PORTION_HINT).map(([cat,hint])=>(
              <div key={cat} style={{ display:"flex", gap:9, alignItems:"baseline", padding:"7px 0",
                borderBottom:`1px solid ${C.line}` }}>
                <span style={{ fontSize:11.5, fontWeight:700, width:82, flexShrink:0 }}>{cat}</span>
                <span style={{ fontSize:11, color:C.muted, lineHeight:1.5 }}>{hint}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop:16, padding:"12px 13px", borderRadius:11, background:tint(TYPES.push.color,0.09),
            border:`1px solid ${tint(TYPES.push.color,0.3)}` }}>
            <div style={{ fontSize:11.5, fontWeight:800, color:TYPES.push.color, marginBottom:5 }}>💡 정확도보다 꾸준함</div>
            <div style={{ fontSize:11, color:C.muted, lineHeight:1.65 }}>
              매번 정확히 재려다 지쳐서 기록을 놓치는 게 더 손해예요.
              같은 기준으로 꾸준히 어림잡으면, 오차가 일정해서 <b style={{color:C.text}}>추세는 정확하게</b> 나와요.
              자주 먹는 음식만 한 번 저울로 재서 등록해두면 그다음부터는 편해져요.
            </div>
          </div>
          <div style={{ height:8 }} />
        </div>

        <div style={{ flexShrink:0, padding:"12px 0 calc(14px + env(safe-area-inset-bottom))",
          borderTop:`1px solid ${C.line}`, background:C.surface }}>
          <button onClick={onClose} style={{...primary(TYPES.push.color), width:"100%"}}>닫기</button>
        </div>
      </div>
    </SheetLayer>
  );
}

// ================= 공용: 식단 섹션 =================

const LabeledInput = ({label,v,on}) => (
  <div style={{ flex:1, minWidth:70 }}>
    <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{label}</div>
    <input value={v} onChange={(e)=>on(e.target.value)} inputMode="decimal" placeholder="0"
      style={{...inp, width:"100%", boxSizing:"border-box"}} />
  </div>
);

const activeTagStyle = (col) => ({
  display:"inline-flex", alignItems:"center", gap:4, background:tint(col,0.16),
  border:`1px solid ${tint(col,0.45)}`, color:col, borderRadius:999,
  padding:"4px 9px", fontSize:10.5, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap",
});

// 바텀시트를 화면 최상위(body)에 직접 그린다.
// 이렇게 하면 어떤 조상 요소에 transform·filter 같은 속성이 생겨도
// position:fixed 기준이 흔들리지 않아 시트가 늘 화면 아래에 정확히 붙는다.
