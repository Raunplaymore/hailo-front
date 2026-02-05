# pi_web Context

## 프로젝트 개요
React + TypeScript 기반 골프 스윙 분석 웹 프론트엔드. 카메라 제어, 세션 녹화, 분석 결과 시각화를 담당.

## 자주 수정하는 파일

### 핵심 파일
- `src/App.tsx` (1597줄) - 메인 앱 로직, 모든 상태 관리
  - 카메라 상태, 세션 상태, 분석 상태 통합 관리
  - 4개 탭: camera, upload, list, analysis
  - Auto-record 플로우 처리

### API 통신
- `src/api/cameraApi.ts` - pi_camera 서버 통신
- `src/api/sessionApi.ts` - 세션 관리 API
- `src/api/shots.ts` - 분석 Job API
- `src/api/client.ts` - 기본 설정

### 주요 컴포넌트
- `src/components/camera/CameraPreview.tsx` - MJPEG 스트림 + 오버레이
- `src/components/camera/SessionControls.tsx` - 세션 시작/종료 버튼
- `src/components/sessions/SessionList.tsx` - 세션 목록
- `src/components/analysis/` - 분석 결과 시각화

## 상태 관리 패턴

### 세션 상태 머신
```
idle → starting → arming → addressLocked → recording → finishLocked → stopping → analyzing → done/failed
```

### Auto-Record 상태 매핑
- Auto-record는 pi_camera에서 상태 폴링 (500ms)
- `mapAutoRecordState()`로 로컬 상태와 동기화
- `AUTO_RECORD_ACTIVE_STATES`로 활성 상태 판단

### 중요한 상태들
- `isPreviewOn` - 프리뷰 스트림 활성화
- `sessionState` - 현재 세션 상태
- `liveBoxes` - 실시간 bbox 오버레이 데이터 (300ms 폴링)
- `sessionStatusMap` - 세션별 분석 상태 (localStorage 동기화)

## 주의사항

### 네트워크 최적화
- 프리뷰 해상도: MAX_PREVIEW_PIXELS (1280×720) 초과 차단
- 세션 해상도: 고정 1456×1088 @ 60fps
- 프리뷰 FPS: 15fps 고정

### 리소스 정리
- `streamUrl` 변경 시 이전 스트림 명시적 종료 필요
- `handleStopPreview()` 호출 시 상태 낙관적 업데이트 + 폴링 보정
- 폴링 타이머: useEffect cleanup에서 반드시 취소

### 좌표 정규화
- `normalizeLiveBoxes()`: bbox를 0~1 정규화
- 절대 좌표 vs 정규화 좌표 자동 판단 (`> 1` 체크)
- frameWidth/frameHeight fallback 처리

## 환경변수

### 필수
- `VITE_CAMERA_BASE_URL` - 카메라 서버 주소 (예: http://raspberrypi.local:3001)

### 선택
- `VITE_BACK_BASE_URL` - 분석 백엔드 주소
- `VITE_CAMERA_AUTH_TOKEN` - 카메라 Bearer 토큰

## 디버깅 팁

### 프리뷰가 안 나올 때
1. 카메라 상태 확인: `cameraStatus.busy`, `streaming`
2. CORS 에러: 카메라 서버 CORS 설정 확인
3. 토큰 에러: `STREAM_TOKEN` 설정 확인

### 오버레이 안 그려질 때
1. `liveBoxes` 배열 확인 (DevTools)
2. 좌표 범위 체크: 0~1 정규화 확인
3. `isOverlayActive` 상태 확인

### 분석 상태 안 바뀔 때
1. `sessionStatusMap` localStorage 확인
2. 폴링 타이머 작동 확인 (useEffect deps)
3. pi_service → hailo-infer 연결 확인

## 알려진 이슈

### Auto-Record
- 어드레스 감지 임계값: `AUTO_ADDRESS_STILL_MS=2000ms`
- 스윙 종료 감지: person bbox 연속 미검출 12프레임
- 실패 시 `lastError` 표시, 재시작으로 상태 초기화

### 세션 목록
- 카메라 서버 `/api/session/list` 의존
- 404 시 fallback 없음 (명시적 에러 표시)
- `sessionStatusMap`으로 로컬 상태 보강

## 코딩 컨벤션

### 상태 업데이트
- 낙관적 업데이트 + 후속 폴링으로 정합성 보정
- 예: `handleStopPreview()` → 즉시 상태 변경 → 800ms, 2500ms 후 재확인

### API 에러 처리
- try-catch로 에러 캐치
- 사용자 친화적 메시지로 변환
- toast 또는 상태 에러로 표시

### 타입 안전성
- `types/` 폴더에 모든 타입 정의
- API 응답 타입 명시적 정의
- `as` 최소화, type guard 사용
