// PM2 설정: Vite 프론트엔드 실행용
module.exports = {
  apps: [
    {
      name: 'hailo-front',
      // Vite preview 서버 실행 (빌드 산출물 미리보기)
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 4173',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 4173
      }
    },
    {
      name: 'hailo-front-dev',
      // 개발용 Vite dev 서버 (필요 시만 사용)
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 5173',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'development',
        PORT: 5173
      }
    }
  ]
};
