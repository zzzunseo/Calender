// ================= 기기 간 동기화 (GitHub Gist) =================
// 이 앱은 서버가 없어서 기록이 "그 브라우저 안"에만 산다.
// 폰 ↔ PC를 오가면 데이터가 따로 놀고, 폰이 바뀌면 통째로 사라진다.
//
// 서버를 새로 띄우는 대신, 사용자가 이미 쓰는 GitHub의 비공개 Gist를
// 저장소로 빌려 쓴다. 파일 하나(JSON)를 올렸다 내렸다 하는 게 전부라
// 백엔드·가입·요금이 필요 없고, GitHub API는 브라우저 CORS를 허용한다.
//
// 토큰은 앱 데이터(data)와 분리된 별도 키에 둔다.
// → 몸 탭에서 만드는 백업 JSON에 토큰이 섞여 들어가는 사고를 원천 차단.

const CFG_KEY = "gymapp_cloud_v1";
const FILE_NAME = "linmass-backup.json";
const API = "https://api.github.com";

// ---- 설정 저장 (토큰·gistId·마지막 동기화 시각) ----
export async function loadCloudCfg() {
  try {
    const r = await window.storage.get(CFG_KEY, false);
    if (!r || !r.value) return null;
    return JSON.parse(r.value);
  } catch (e) { return null; }
}

export async function saveCloudCfg(cfg) {
  try { await window.storage.set(CFG_KEY, JSON.stringify(cfg), false); return true; }
  catch (e) { return false; }
}

export async function clearCloudCfg() {
  try { await window.storage.delete(CFG_KEY, false); return true; }
  catch (e) { return false; }
}

// ---- 공통 호출 ----
async function gh(token, path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Authorization": `Bearer ${String(token || "").trim()}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const raw = await res.text();
  let json = null;
  try { json = raw ? JSON.parse(raw) : null; } catch (e) { /* 본문이 JSON이 아닌 응답은 상태코드로만 판단 */ }
  if (!res.ok) throw new Error(ghError(res.status, json));
  return json;
}

function ghError(status, json) {
  if (status === 401) return "토큰이 올바르지 않아요. GitHub에서 다시 발급해 주세요.";
  if (status === 403) return "권한이 없어요. 토큰을 만들 때 gist 권한을 켰는지 확인해 주세요.";
  if (status === 404) return "저장 위치를 찾을 수 없어요. 연결을 해제하고 다시 연결해 주세요.";
  if (status === 422) return "GitHub가 요청을 거절했어요. 잠시 뒤 다시 시도해 주세요.";
  const msg = json && json.message ? json.message : `요청 실패 (${status})`;
  return msg;
}

// ---- 토큰 확인 + 저장소(Gist) 준비 ----
// 이미 이 앱이 만든 Gist가 있으면 재사용한다. 기기를 새로 연결할 때
// 같은 토큰만 넣으면 자동으로 기존 기록을 찾아내게 하려는 것.
export async function connect(token) {
  const me = await gh(token, "/user");
  const list = await gh(token, "/gists?per_page=100");
  const found = (list || []).find((g) => g && g.files && g.files[FILE_NAME]);
  if (found) return { token, gistId: found.id, login: me.login, created: false };

  const made = await gh(token, "/gists", {
    method: "POST",
    body: JSON.stringify({
      description: "린메스업 트래커 동기화 (자동 생성 · 비공개)",
      public: false,
      files: { [FILE_NAME]: { content: JSON.stringify({ _meta: { updatedAt: 0 } }) } },
    }),
  });
  return { token, gistId: made.id, login: me.login, created: true };
}

// ---- 올리기 ----
export async function push(cfg, data) {
  const payload = JSON.stringify({ ...data, _meta: { updatedAt: Date.now(), device: deviceName() } });
  await gh(cfg.token, `/gists/${cfg.gistId}`, {
    method: "PATCH",
    body: JSON.stringify({ files: { [FILE_NAME]: { content: payload } } }),
  });
  return Date.now();
}

// ---- 내려받기 ----
// Gist 파일이 1MB를 넘으면 API가 내용을 잘라서 주고 truncated 플래그를 세운다.
// 그럴 땐 raw_url에서 원본을 따로 받아야 데이터가 깨지지 않는다.
export async function pull(cfg) {
  const g = await gh(cfg.token, `/gists/${cfg.gistId}`);
  const f = g && g.files && g.files[FILE_NAME];
  if (!f) throw new Error("클라우드에 저장된 기록이 아직 없어요.");
  let text = f.content;
  if (f.truncated || !text) {
    const r = await fetch(f.raw_url);
    if (!r.ok) throw new Error("저장된 기록을 내려받지 못했어요.");
    text = await r.text();
  }
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { throw new Error("클라우드 기록이 손상됐어요.", { cause: e }); }
  const meta = parsed._meta || {};
  delete parsed._meta;
  return { data: parsed, remoteAt: Number(meta.updatedAt) || 0, device: meta.device || "" };
}

// 기록의 규모를 한눈에 비교하기 위한 요약 (덮어쓰기 전 확인용)
export function summarizeData(d) {
  if (!d || typeof d !== "object") return null;
  return {
    days: Object.keys(d.schedule || {}).length,
    measures: (d.measurements || []).length,
    vocab: (d.vocab || []).length,
    study: (d.study || []).length,
    foods: (d.customFoods || []).length,
    updatedAt: Number(d.updatedAt) || 0,
  };
}

function deviceName() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "아이폰";
  if (/Android/i.test(ua)) return "안드로이드";
  if (/Mac/i.test(ua)) return "맥";
  if (/Windows/i.test(ua)) return "PC";
  return "기기";
}

export function fmtAgo(ts) {
  if (!ts) return "없음";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}
