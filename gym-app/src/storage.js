// Claude.ai 아티팩트의 window.storage API를 그대로 흉내내는 localStorage 기반 폴리필.
// App.jsx는 이 인터페이스에만 의존하므로 코드를 거의 그대로 재사용할 수 있음.
// 핵심: 이 저장소는 배포된 사이트의 브라우저(도메인)에 귀속되고,
// 이후 코드를 아무리 다시 배포해도 이 데이터는 절대 지워지지 않음 (기존 아티팩트 미리보기와 가장 큰 차이점).

const PREFIX = "gymapp_store::";

function makeKey(key, shared) {
  return `${PREFIX}${shared ? "shared" : "priv"}::${key}`;
}

export function installStoragePolyfill() {
  window.storage = {
    async get(key, shared = false) {
      try {
        const raw = localStorage.getItem(makeKey(key, shared));
        if (raw === null) return null;
        return { key, value: raw, shared };
      } catch (e) {
        console.error("storage.get 실패", e);
        return null;
      }
    },
    async set(key, value, shared = false) {
      try {
        localStorage.setItem(makeKey(key, shared), value);
        return { key, value, shared };
      } catch (e) {
        console.error("storage.set 실패", e);
        throw e;
      }
    },
    async delete(key, shared = false) {
      try {
        localStorage.removeItem(makeKey(key, shared));
        return { key, deleted: true, shared };
      } catch (e) {
        console.error("storage.delete 실패", e);
        return null;
      }
    },
    async list(prefix = "", shared = false) {
      try {
        const full = makeKey(prefix, shared);
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(full)) keys.push(k.slice(makeKey("", shared).length));
        }
        return { keys, prefix, shared };
      } catch (e) {
        console.error("storage.list 실패", e);
        return null;
      }
    },
  };
}
