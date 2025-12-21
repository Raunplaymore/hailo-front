# 스윙 업로드 & 분석 웹앱 (DTL 단일 카메라, Vite + React + shadcn/ui)

라즈베리파이 글로벌 셔터 카메라(IMX296)로 촬영한 DTL(Down-The-Line) 스윙 영상을 수집·업로드·분석하는 프론트엔드입니다.  
정밀 런치모니터 수치 대신 **스윙 이벤트·템포·방향 경향** 같은 현실적으로 신뢰 가능한 지표를 우선합니다.

## 핵심 플로우
- **카메라 연동(Hailo Camera API)**: 상태 확인 → MJPEG 프리뷰 온/오프 → JPG/MP4 캡처 → 녹화 후 분석 요청.
- **해상도 정책(검증된 값만 노출)**: `640×360 (저화질·빠름)`, `1280×720 (권장·고화질)` 두 가지만 제공. 프리뷰/캡처 모두 동일 정책.
- **업로드 & 분석**: 업로드 직후 분석 Job 생성, `queued → running → succeeded | failed` 상태 표시 및 재시도/강제 분석 UX.
- **리스트 & 재생**: `/api/files/detail` 응답의 `url`을 그대로 사용해 mp4만 리스트/재생, 분석 상태 뱃지/CTA 제공.
- **분석 뷰**: 이벤트 타임라인(Address/Top/Impact/Finish), Tempo(비율/시간), Ball 근사값, 준비 중 지표 표기.
- **모바일 우선**: iOS/핫스팟 환경에서 프리뷰/캡처가 빠르게 동작하도록 저해상도·저FPS 프리셋 제공.

## 카메라 API 연동 요약
- 상태: `GET /api/camera/status` → `busy/streaming/streamClients/lastCaptureAt` 기반으로 버튼 활성화.
- 프리뷰: `<img src="/api/camera/stream.mjpeg?...">` 연결/해제 시 src 비우기(Abort)로 명시 종료.
- 캡처: `POST /api/camera/capture` (jpg/mp4), `POST /api/camera/capture-and-analyze` (녹화+분석).  
  - 파일명 규칙: `golf_YYYYMMDD_HHmmss_mmm_type.ext` (프런트에서 생성).
  - busy/streaming 시 409, 인증 401, 타임아웃 504 처리.
- 파일 서빙: `/uploads/:filename`

## 환경변수
- `VITE_CAMERA_API_BASE` (또는 `NEXT_PUBLIC_CAMERA_API_BASE`): 카메라 서버 주소 예) `http://192.168.x.x:3001`
- `VITE_CAMERA_AUTH_TOKEN` (옵션): Bearer 토큰

## 실행
```bash
npm install
npm run dev  # http://localhost:5173
```

## 빌드
```bash
npm run build
```
- 산출물: `dist/`

## 설계 원칙
- ✅ 단일 카메라에서 신뢰 가능한 지표(이벤트/템포/경향) 우선
- ✅ 선택지 최소화(검증된 해상도만 노출)로 안정성/UX 확보
- ❌ 스핀/정밀 볼스피드 등 다중 센서 요구 기능은 범위 밖

## 기술 스택
- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui (버튼/카드/폼/Select 등)
- Radix UI primitives (Select 등)
