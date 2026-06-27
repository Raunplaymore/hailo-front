// PM2 설정: Vite 프론트엔드 실행용
// 빌드 산출물 심볼릭 링크(~/hailo-front/current)를 바라보게 설정합니다.
// Pi의 실제 경로에 맞게 FRONT_HOME을 수정하세요.
module.exports = {
  apps: [
    {
      name: "hailo-front", // CI에서 pm2 reload 대상으로 사용하는 이름
      cwd: process.env.FRONT_HOME || "/home/ray/hailo-front",
      script: "server.js",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: 4173,
        FRONT_DIST_DIR:
          process.env.FRONT_DIST_DIR || "/home/ray/hailo-front/current/dist",
        BACK_BASE_URL: process.env.BACK_BASE_URL || "http://127.0.0.1:3000",
        CAMERA_BASE_URL: process.env.CAMERA_BASE_URL || "http://127.0.0.1:3001",
      },
    },
  ],
};
