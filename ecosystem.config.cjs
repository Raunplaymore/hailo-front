// PM2 설정: Vite 프론트엔드 실행용
// 빌드 산출물 심볼릭 링크(~/hailo-front/current)를 바라보게 설정합니다.
// Pi의 실제 경로에 맞게 FRONT_HOME을 수정하세요.
module.exports = {
  apps: [
    {
      name: "hailo-front", // CI에서 pm2 reload 대상으로 사용하는 이름
      // dist 정적 서빙 (vite preview 대신 serve 사용)
      cwd: process.env.FRONT_HOME || "/home/ray/hailo-front",
      script: "npx",
      args: "serve -s current/dist -l 4173",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: 4173,
      },
    },
    {
      name: "hailo-front-dev",
      // 개발용 Vite dev 서버 (필요 시만 사용)
      cwd: process.env.FRONT_HOME || "/home/ray/hailo-front/current",
      script: "npm",
      args: "run dev -- --host 0.0.0.0 --port 5173",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "development",
        PORT: 5173,
      },
    },
  ],
};
