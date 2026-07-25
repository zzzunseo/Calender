import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { installStoragePolyfill } from "./storage.js";
import "./index.css";

installStoragePolyfill();

// 오프라인 지원: 앱 껍데기를 캐시해 신호가 약한 곳에서도 열리게 한다.
// import.meta.env.BASE_URL 을 쓰면 GitHub Pages 하위 경로(/Calender/)에서도 맞는다.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((e) => console.warn("서비스워커 등록 실패", e));
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
