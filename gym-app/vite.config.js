import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages는 https://<사용자명>.github.io/<저장소명>/ 하위 경로로 서비스되므로
// base를 저장소 이름으로 맞춰야 JS/CSS 파일 경로가 깨지지 않는다.
export default defineConfig({
  base: "/Calender/",
  plugins: [react()],
});
