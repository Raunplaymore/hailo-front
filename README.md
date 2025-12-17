# 스윙 영상 업로드 & 분석 웹앱 (DTL, Vite + React)

단일 DTL(Down-The-Line) 카메라 영상을 업로드해 비동기 Job으로 분석하는 프론트엔드입니다.  
트랙맨처럼 정밀한 물리 수치 대신 **스윙 이벤트·템포·방향 경향** 등 현실적으로 신뢰 가능한 지표에 집중합니다.

## 주요 기능

- 단일 영상 업로드 (iPhone Safari HEVC/H.264 대응)
- 업로드 → 분석 Job 생성 → `queued → running → succeeded | failed` 상태 표시
- 원본 영상 + 이벤트 타임라인(Address/Top/Impact/Finish 클릭 시 해당 시점으로 이동)
- 지표 카드
  - Tempo: 백스윙/다운스윙 시간, 비율
  - Event Timing: 주요 이벤트 상대 시점(ms)
  - Ball(근사): Launch Direction, Launch Angle, Speed Relative
- 준비 중 지표: Club Path / Swing Plane / Attack Angle을 “준비 중”으로 표시
- 업로드 이력: `/api/files` 기반 목록, 재조회 가능

## 백엔드 API (가정)

- `POST /api/analyze` : multipart/form-data(`video`) → `{ jobId }`
- `GET /api/analyze/{jobId}` : Job 상태 조회
- `GET /api/analyze/{jobId}/result` : 분석 결과(이벤트/지표) 조회
- `GET /api/files` : 업로드된 파일 목록

개발 시 `/api`는 Vite 프록시로 `http://localhost:3000`에 연결되어 있다고 가정합니다.

## 설계 철학

- ✅ 단일 카메라에서 신뢰 가능한 지표(이벤트/템포/경향) 중심
- ❌ 스핀량·정밀 볼스피드 등 다중 센서가 필요한 수치는 제외
- ✅ 모바일(Safari) 우선 UX, 업로드 상태와 Job 진행도를 명확히 노출

## 라즈베리파이 카메라 연동 (Hailo Camera API)

- `.env` 예시: `VITE_CAMERA_API_BASE=http://192.168.x.x:3001`, `VITE_CAMERA_AUTH_TOKEN=<옵션>`
- UI: 카메라 탭에서 상태 확인 → MJPEG 프리뷰 온/오프 → JPG/MP4 캡처(5초/사용자 지정) → “녹화 후 분석” 요청
- 프리뷰 해상도/FPS 프리셋 제공(저화질 권장), 프리뷰 켜진 상태에서 녹화 시 자동 종료 설정 가능
- 파일명 규칙: `[세션_]golf_YYYYMMDD_HHmmss_mmm_type.ext` (세션은 선택, 로컬스토리지 저장)
- 에러 처리: 401 토큰 안내, 409 “카메라 사용 중”, 504 타임아웃 메시지 노출

## 실행

```bash
npm install
npm run dev
# http://localhost:5173
```

## 빌드/배포

```bash
npm run build
```

- 산출물: `dist/`
- Express 예시: `app.use(express.static("client-dist"))`
- 대용량 업로드 환경에서는 서버 및 프록시(Nginx) body size 제한을 확인하세요.
