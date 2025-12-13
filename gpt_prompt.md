현재 프로젝트를 수정해서 아래의 내용으로 목적을 변경하려고 합니다.
아래 지시문을 참고해서 프로젝트를 리팩토링해주세요.

---

# 스윙 영상 업로드 & 분석 웹앱

(Vite + React + TypeScript)

아이폰 Safari에서도 쓰기 편한 **DTL(Down-The-Line) 골프 스윙 영상 업로드 및 분석 전용 프론트엔드**입니다.
백엔드(Node.js + Express)가 **업로드 + 비동기 분석(Job) API**를 제공한다는 가정 하에 동작합니다.

본 앱은 **트랙맨과 같은 물리 수치 측정이 아닌**,
단일 카메라 영상 기반의 **스윙 이벤트·템포·경향 분석**을 목표로 합니다.

---

## 🎯 주요 기능

### 1. 영상 업로드

- 단일 영상 선택

  ```html
  <input type="file" accept="video/*" />
  ```

- iPhone Safari 대응 (HEVC/H.264)
- 업로드 상태 표시

  - 대기 / 업로드 중 / 실패 / 완료

- 재시도 가능

---

### 2. 분석 Job 기반 처리

- 업로드 후 즉시 분석을 시작하지 않고 **Job 생성**
- 분석 진행 상태 표시

  - `queued` → `running` → `succeeded | failed`

- 분석 완료 시 결과 자동 조회

---

### 3. 분석 결과 UI

- 원본 영상 플레이어
- 스윙 이벤트 타임라인

  - Address / Top / Impact / Finish
  - 클릭 시 해당 시점으로 영상 이동

- 지표 카드

  - **Tempo**

    - backswing : downswing 비율
    - downswing 시간(ms)

  - **Event Timing**

    - 각 이벤트의 상대 시점(ms)

  - **Ball (가능한 경우)**

    - Launch Direction (좌/우, 근사)
    - Launch Angle (상/하, 근사)
    - Speed Relative (Fast / Medium / Slow)

---

### 4. TO-DO 지표 (비활성 처리)

아래 지표는 **YOLO 기반 클럽 트래킹 적용 후 활성화 예정**입니다.

- Club Path (Inside-Out / Neutral / Outside-In)
- Swing Plane (Flat / Neutral / Upright)
- Attack Angle (Down / Level / Up)

UI에는 **“준비 중” 상태로 표시**되며,
스키마/컴포넌트 구조는 미리 구현되어 있습니다.

---

### 5. 업로드 이력

- 업로드 완료된 파일 목록 조회
- 최근 분석 결과 재조회 가능

---

## 🧱 기술 스택

### Frontend

- Vite
- React
- TypeScript
- Fetch API 기반 통신
- 모바일(Safari) 우선 UX

### Backend (연동 가정)

- Node.js + Express
- 비동기 분석 Job 처리
- 영상 파일 저장 + 분석 결과 JSON 반환

---

## 🔌 백엔드 API 연동

### 업로드 & 분석 시작

```http
POST /api/analyze
```

- multipart/form-data
- 필드명: `video`
- 응답: `{ jobId }`

---

### 분석 상태 조회

```http
GET /api/analyze/{jobId}
```

```json
{
  "jobId": "string",
  "status": "queued | running | succeeded | failed"
}
```

---

### 분석 결과 조회

```http
GET /api/analyze/{jobId}/result
```

```json
{
  "events": { ... },
  "metrics": { ... },
  "ball": { ... }
}
```

---

### 파일 목록 (기존 기능 유지)

```http
GET /api/files
```

---

## ⚙️ 개발 환경

- Node.js 18+ 권장
- Vite + React + TypeScript
- `/api` 요청은 개발 시 `http://localhost:3000`으로 프록시

### vite.config.ts (예시)

```ts
server: {
  proxy: {
    '/api': 'http://localhost:3000',
  },
}
```

---

## ▶️ 실행 방법

```bash
npm install
npm run dev
# http://localhost:5173 접속
```

---

## 📦 빌드

```bash
npm run build
```

- 결과물은 `dist/` 디렉토리에 생성
- 배포 시:

  - `client-dist`로 이동하거나
  - 백엔드에서 `dist`를 static 경로로 설정

---

## 🚀 배포 메모

- 백엔드는 다음과 같이 정적 파일 서빙을 가정

```ts
app.use(express.static("client-dist"));
```

- 대용량 영상 업로드이므로:

  - body size 제한 확인
  - reverse proxy(Nginx) 사용 시 업로드 제한 설정 필요

---

## 📌 설계 철학 (중요)

- ❌ 스핀량(rpm), 정밀 볼스피드 측정
- ✅ 스윙 이벤트 분할
- ✅ 템포/리듬 분석
- ✅ 구질·방향 **경향** 분석
- ✅ 코칭 및 피드백 중심 UX

> **단일 DTL 카메라 환경에서 “현실적으로 신뢰 가능한 지표”만 제공**하는 것을 원칙으로 합니다.

---

## 🔜 향후 계획 (Roadmap)

- YOLO 기반 클럽 헤드/샤프트 감지
- 오버레이 영상 생성
- 분석 결과 비교(이전 샷 대비)
- 모바일 홈 화면(PWA) 대응

---
