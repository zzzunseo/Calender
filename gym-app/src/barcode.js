// ================= 바코드 스캔 =================
// 외부 식품 DB를 조회하지 않는다. 내가 등록한 바코드만 인식하는 "내 사전" 방식이라
// API 키도 서버도 필요 없고, 비행기 모드에서도 그대로 동작한다.
//
// 인식 엔진은 두 갈래다.
//  ① 브라우저 내장 BarcodeDetector — 안드로이드 크롬에 있다. 추가 용량 0, 속도도 제일 빠름.
//  ② @zxing/browser — 사파리(아이폰)에는 내장 API가 없어서 쓰는 대비책.
//     용량이 작지 않아서 정적 import 하지 않고, 스캐너를 처음 열 때만 내려받는다(동적 import).
//     그래서 평소 앱 로딩 속도는 이 기능을 넣기 전과 같다.

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];

export const hasNativeDetector = () => typeof window !== "undefined" && "BarcodeDetector" in window;

// 내장 API가 "있다"고 해서 원하는 형식을 지원한다는 보장은 없어서 실제 목록을 확인한다
export async function nativeUsable() {
  try {
    if (!hasNativeDetector()) return false;
    const list = await window.BarcodeDetector.getSupportedFormats();
    return FORMATS.some((f) => list.includes(f));
  } catch (e) { return false; }
}

// 카메라 열기 — 후면 카메라를 우선한다
export async function openCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("이 브라우저에서는 카메라를 쓸 수 없어요.");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) {
      throw new Error("카메라 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요.", { cause: e });
    }
    if (e && e.name === "NotFoundError") throw new Error("사용할 수 있는 카메라를 찾지 못했어요.", { cause: e });
    throw new Error("카메라를 열지 못했어요.", { cause: e });
  }
}

export function stopCamera(stream) {
  try { (stream ? stream.getTracks() : []).forEach((t) => t.stop()); } catch (e) { /* 이미 닫힘 */ }
}

// 스캔 시작. 인식하면 onFound(코드)를 부르고, 반환된 함수를 호출하면 멈춘다.
export async function startScan(video, onFound, onError) {
  let stopped = false;
  const stopFns = [];
  const finish = () => { stopped = true; stopFns.forEach((f) => { try { f(); } catch (e) { /* 무시 */ } }); };

  try {
    if (await nativeUsable()) {
      const det = new window.BarcodeDetector({ formats: FORMATS });
      const tick = async () => {
        if (stopped) return;
        try {
          if (video.readyState >= 2) {
            const found = await det.detect(video);
            if (found && found.length && found[0].rawValue) {
              onFound(String(found[0].rawValue).trim());
              return;   // 하나 잡으면 호출한 쪽에서 멈춘다
            }
          }
        } catch (e) { /* 프레임 단위 실패는 무시하고 다음 프레임에서 재시도 */ }
        setTimeout(tick, 220);
      };
      tick();
      return finish;
    }

    // 내장 API가 없을 때만 라이브러리를 내려받는다
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    if (stopped) return finish;
    const reader = new BrowserMultiFormatReader();
    const controls = await reader.decodeFromVideoElement(video, (result) => {
      if (result && !stopped) onFound(String(result.getText()).trim());
    });
    stopFns.push(() => controls && controls.stop && controls.stop());
    return finish;
  } catch (e) {
    if (onError) onError(e && e.message ? e.message : "바코드 인식을 시작하지 못했어요.");
    return finish;
  }
}

// 바코드 유효성 — 오인식을 거른다.
// 카메라가 흔들리면 엉뚱한 짧은 숫자가 잡히는 일이 있어서 최소 길이를 둔다.
export const validCode = (code) => {
  const c = String(code || "").trim();
  return /^[0-9A-Za-z\-_.]{6,32}$/.test(c);
};

// 국내 상품 바코드는 880으로 시작한다. 표시용 보조 정보.
export const codeLabel = (code) => {
  const c = String(code || "");
  if (/^880/.test(c) && c.length === 13) return "국내 상품";
  if (c.length === 13) return "EAN-13";
  if (c.length === 8) return "EAN-8";
  if (c.length === 12) return "UPC-A";
  return `${c.length}자리`;
};
