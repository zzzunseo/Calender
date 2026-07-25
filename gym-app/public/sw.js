// 오프라인 지원 — 헬스장 지하처럼 신호가 약한 곳에서도 앱이 열리게 한다.
// 데이터(기록)는 localStorage에 있으므로, 여기서는 "앱 껍데기"만 캐시한다.
const VERSION = "v1";
const SHELL = "shell-" + VERSION;   // index.html, manifest 등
const ASSETS = "assets-" + VERSION; // 해시가 붙은 js/css

// base 경로를 자동으로 구한다 (/Calender/sw.js → /Calender/)
const BASE = self.location.pathname.replace(/sw\.js$/, "");

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) =>
      // 실패해도 설치는 계속되도록 개별 처리
      Promise.allSettled([
        c.add(new Request(BASE, { cache: "reload" })),
        c.add(new Request(BASE + "manifest.json", { cache: "reload" })),
      ])
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 외부 요청(API 등)은 건드리지 않음

  // 화면 이동(HTML): 새 배포를 반영하려면 네트워크 우선, 실패하면 캐시로
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(SHELL).then((c) => c.put(BASE, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match(BASE).then((hit) => hit || caches.match(req))
        )
    );
    return;
  }

  // 그 외 정적 파일: 파일명에 해시가 있어 내용이 바뀌지 않으므로 캐시 우선
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(ASSETS).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
