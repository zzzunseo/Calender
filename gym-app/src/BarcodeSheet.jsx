import { useState, useRef, useEffect } from "react";
import { C, TYPES, tint, num, uid, SheetLayer, sheet, grip, inp, primary, ghost, ConfirmX } from "./shared.jsx";
import { openCamera, stopCamera, startScan, validCode, codeLabel, hasNativeDetector } from "./barcode.js";
import { searchAllFoods } from "./foodDB.js";

const ACC = TYPES.legs.color;

// ================= 내 바코드 사전 =================
// 흐름은 두 갈래뿐이다.
//   등록된 코드  → 바로 오늘 기록에 추가 (인분만 조절)
//   처음 보는 코드 → 어떤 음식인지 한 번 지정 → 사전에 저장 → 다음부터는 위 흐름
export function BarcodeSheet({ barcodes, mutate, customFoods, addFoodsToday, onClose }) {
  const [mode, setMode] = useState("scan");   // scan | hit | register | list
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [qty, setQty] = useState(1);
  const [manual, setManual] = useState("");

  const onCode = (c) => {
    if (!validCode(c)) return;
    setCode(c);
    setErr("");
    setMode(barcodes[c] ? "hit" : "register");
  };

  const hit = code ? barcodes[code] : null;

  const addNow = () => {
    const n = Math.max(0.25, num(qty) || 1);
    addFoodsToday([{
      id: uid(), name: hit.name + (n !== 1 ? ` ×${n}` : ""),
      protein: Math.round(num(hit.protein) * n), carbs: Math.round(num(hit.carbs) * n),
      sugar: Math.round(num(hit.sugar) * n), fat: Math.round(num(hit.fat) * n),
      kcal: Math.round(num(hit.kcal) * n), liquidMl: Math.round(num(hit.liquidMl) * n),
    }]);
    // 사용 횟수를 세두면 사전 목록을 자주 쓰는 순으로 보여줄 수 있다
    mutate((prev) => ({
      ...prev,
      barcodes: { ...prev.barcodes, [code]: { ...hit, count: num(hit.count) + 1, lastUsed: Date.now() } },
    }));
    onClose();
  };

  const saveMapping = (food) => {
    mutate((prev) => ({
      ...prev,
      barcodes: {
        ...prev.barcodes,
        [code]: {
          name: food.name,
          protein: num(food.protein), carbs: num(food.carbs), sugar: num(food.sugar),
          fat: num(food.fat), kcal: num(food.kcal), liquidMl: num(food.liquidMl) || 0,
          count: 0, lastUsed: 0, created: Date.now(),
        },
      },
    }), "바코드 등록");
    setMode("hit");
  };

  return (
    <SheetLayer onClose={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={sheet}>
        <div style={{ flexShrink: 0 }}>
          <div style={grip} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>
              {mode === "list" ? "내 바코드 사전" : mode === "register" ? "이 바코드 등록" : "바코드로 기록"}
            </span>
            <button onClick={() => setMode(mode === "list" ? "scan" : "list")}
              style={{ background: "none", border: "none", color: C.muted, fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>
              {mode === "list" ? "스캔으로" : `사전 ${Object.keys(barcodes).length}개`}
            </button>
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          {mode === "scan" && <Scanner onCode={onCode} onErr={setErr} err={err} onManual={(v) => onCode(v)} manual={manual} setManual={setManual} />}

          {mode === "hit" && hit && (
            <div>
              <div style={{ padding: "14px 15px", borderRadius: 13, background: tint(ACC, 0.1), border: `1px solid ${tint(ACC, 0.35)}` }}>
                <div style={{ fontSize: 10.5, color: C.muted, fontFamily: "monospace" }}>{code} · {codeLabel(code)}</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 5 }}>{hit.name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                  {num(hit.kcal)}kcal · 단백질 {num(hit.protein)}g · 탄수 {num(hit.carbs)}g · 당류 {num(hit.sugar)}g · 지방 {num(hit.fat)}g
                </div>
                {num(hit.count) > 0 && (
                  <div style={{ fontSize: 10.5, color: ACC, marginTop: 6, fontWeight: 700 }}>{num(hit.count)}번 기록했어요</div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14 }}>
                <span style={{ fontSize: 12.5, color: C.muted, fontWeight: 700 }}>수량</span>
                {[0.5, 1, 1.5, 2].map((n) => (
                  <button key={n} onClick={() => setQty(n)}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 800,
                      border: `1.5px solid ${qty === n ? ACC : C.line}`,
                      background: qty === n ? tint(ACC, 0.15) : C.surface2,
                      color: qty === n ? ACC : C.muted }}>{n}</button>
                ))}
              </div>

              <button onClick={addNow} style={{ ...primary(ACC), width: "100%", marginTop: 13 }}>
                오늘 기록에 추가
              </button>
              <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                <button onClick={() => { setCode(""); setMode("scan"); }} style={{ ...ghost, flex: 1, fontSize: 12 }}>다시 스캔</button>
                <button onClick={() => setMode("register")} style={{ ...ghost, flex: 1, fontSize: 12 }}>내용 바꾸기</button>
              </div>
            </div>
          )}

          {mode === "register" && (
            <Register code={code} customFoods={customFoods} onSave={saveMapping}
              onBack={() => { setCode(""); setMode("scan"); }} existing={barcodes[code]} />
          )}

          {mode === "list" && <Dictionary barcodes={barcodes} mutate={mutate} />}
        </div>
      </div>
    </SheetLayer>
  );
}

// ---------- 카메라 화면 ----------
function Scanner({ onCode, onErr, err, manual, setManual }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stopRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const stream = await openCamera();
        if (dead) { stopCamera(stream); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        v.setAttribute("playsinline", "true");   // 아이폰에서 전체화면으로 튀는 것 방지
        await v.play().catch(() => {});
        setReady(true);
        stopRef.current = await startScan(v, (c) => { onCode(c); }, (m) => onErr(m));
      } catch (e) {
        if (!dead) onErr(e.message || "카메라를 열지 못했어요.");
      }
    })();
    return () => {
      dead = true;
      // 화면을 벗어나면 카메라를 반드시 꺼야 한다. 안 그러면 표시등이 켜진 채로 남는다.
      if (stopRef.current) stopRef.current();
      stopCamera(streamRef.current);
    };
  }, []);

  return (
    <div>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", borderRadius: 13, overflow: "hidden", background: "#000" }}>
        <video ref={videoRef} muted playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {/* 조준선 — 어디에 대야 하는지 알려준다 */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: "78%", height: "34%", border: `2px solid ${ACC}`, borderRadius: 9, boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
        </div>
        {!ready && !err && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12.5 }}>
            카메라 준비 중…
          </div>
        )}
      </div>

      {err ? (
        <div style={{ fontSize: 12, color: C.danger, marginTop: 11, lineHeight: 1.55 }}>{err}</div>
      ) : (
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 11, lineHeight: 1.55, textAlign: "center" }}>
          제품 뒷면 바코드를 네모 안에 맞춰주세요
          {!hasNativeDetector() && <><br /><span style={{ fontSize: 10.5 }}>인식기를 처음 불러오는 중이라 몇 초 걸릴 수 있어요</span></>}
        </div>
      )}

      {/* 인식이 안 될 때를 위한 수동 입력 — 바코드 아래 숫자를 직접 치면 된다 */}
      <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
        {typing ? (
          <>
            <input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric"
              placeholder="바코드 아래 숫자 (예: 8801234567890)"
              style={{ ...inp, width: "100%", boxSizing: "border-box", fontFamily: "monospace" }} />
            <button onClick={() => { if (validCode(manual)) onCode(manual.trim()); else onErr("숫자를 다시 확인해 주세요."); }}
              style={{ ...primary(ACC), width: "100%", marginTop: 8, fontSize: 12.5 }}>확인</button>
          </>
        ) : (
          <button onClick={() => setTyping(true)}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 11.5, cursor: "pointer", textDecoration: "underline", width: "100%" }}>
            잘 안 읽히면 숫자로 입력하기
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- 이 바코드가 무슨 음식인지 지정 ----------
function Register({ code, customFoods, onSave, onBack, existing }) {
  const [q, setQ] = useState(existing ? existing.name : "");
  const [picked, setPicked] = useState(existing || null);
  const [custom, setCustom] = useState(false);
  const [form, setForm] = useState(existing
    ? { name: existing.name, kcal: String(num(existing.kcal)), protein: String(num(existing.protein)),
        carbs: String(num(existing.carbs)), sugar: String(num(existing.sugar)), fat: String(num(existing.fat)) }
    : { name: "", kcal: "", protein: "", carbs: "", sugar: "", fat: "" });

  const results = q.trim().length >= 1 && !custom ? searchAllFoods(q, customFoods).slice(0, 8) : [];

  return (
    <div>
      <div style={{ padding: "10px 12px", borderRadius: 10, background: C.surface2, marginBottom: 13 }}>
        <div style={{ fontSize: 10.5, color: C.muted }}>처음 보는 바코드예요</div>
        <div style={{ fontSize: 13.5, fontWeight: 800, fontFamily: "monospace", marginTop: 3 }}>{code}</div>
        <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{codeLabel(code)} · 한 번만 등록하면 다음부터 바로 기록돼요</div>
      </div>

      {!custom ? (
        <>
          <input value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }}
            placeholder="제품 이름으로 검색 (예: 바프 닭가슴살)"
            style={{ ...inp, width: "100%", boxSizing: "border-box" }} />

          {results.map((r, i) => (
            <button key={i} onClick={() => setPicked(r)}
              style={{ display: "block", width: "100%", textAlign: "left", marginTop: 7, padding: "11px 12px", borderRadius: 10, cursor: "pointer",
                background: picked && picked.name === r.name ? tint(ACC, 0.14) : C.surface2,
                border: `1.5px solid ${picked && picked.name === r.name ? ACC : C.line}`, color: C.text }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                {num(r.kcal)}kcal · 단백질 {num(r.protein)}g · 당류 {num(r.sugar)}g
              </div>
            </button>
          ))}

          {q.trim() && results.length === 0 && (
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10, lineHeight: 1.55 }}>
              검색 결과가 없어요. 영양성분표를 보고 직접 입력해 주세요.
            </div>
          )}

          <button onClick={() => { setCustom(true); setForm((f) => ({ ...f, name: f.name || q })); }}
            style={{ ...ghost, width: "100%", marginTop: 10, fontSize: 12 }}>
            영양성분표 보고 직접 입력
          </button>

          {picked && (
            <button onClick={() => onSave(picked)} style={{ ...primary(ACC), width: "100%", marginTop: 9 }}>
              이 음식으로 등록
            </button>
          )}
        </>
      ) : (
        <>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="제품명" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 8 }}>
            {[["kcal", "칼로리"], ["protein", "단백질 g"], ["carbs", "탄수화물 g"], ["sugar", "당류 g"], ["fat", "지방 g"]].map(([k, label]) => (
              <input key={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                inputMode="decimal" placeholder={label} style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            제품 뒷면 "총 내용량당" 기준으로 넣으면 한 개 = 1인분이 돼요.
          </div>
          <button onClick={() => { if (form.name.trim()) onSave(form); }}
            disabled={!form.name.trim()}
            style={{ ...primary(ACC), width: "100%", marginTop: 11, opacity: form.name.trim() ? 1 : 0.5 }}>
            등록하기
          </button>
          <button onClick={() => setCustom(false)} style={{ ...ghost, width: "100%", marginTop: 8, fontSize: 12 }}>검색으로 돌아가기</button>
        </>
      )}

      <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 11.5,
        cursor: "pointer", textDecoration: "underline", width: "100%", marginTop: 12 }}>다시 스캔</button>
    </div>
  );
}

// ---------- 등록된 목록 ----------
function Dictionary({ barcodes, mutate }) {
  const list = Object.keys(barcodes)
    .map((c) => ({ code: c, ...barcodes[c] }))
    .sort((a, b) => num(b.count) - num(a.count) || String(a.name).localeCompare(String(b.name)));

  const remove = (code) => {
    mutate((prev) => {
      const next = { ...prev.barcodes };
      delete next[code];
      return { ...prev, barcodes: next };
    }, "바코드 삭제");
  };

  if (!list.length) {
    return (
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, padding: "18px 4px" }}>
        아직 등록된 바코드가 없어요.<br />
        자주 먹는 제품을 한 번씩 스캔해두면, 다음부터는 카메라만 대도 바로 기록됩니다.
      </div>
    );
  }

  return (
    <div>
      {list.map((it) => (
        <div key={it.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3, fontFamily: "monospace" }}>{it.code}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {num(it.kcal)}kcal · 단백질 {num(it.protein)}g{num(it.count) > 0 ? ` · ${num(it.count)}회 기록` : ""}
            </div>
          </div>
          <ConfirmX onConfirm={() => remove(it.code)} />
        </div>
      ))}
    </div>
  );
}
