# 스윙 업로드 & 분석 웹앱 (DTL 단일 카메라, Vite + React + shadcn/ui)

라즈베리파이 글로벌 셔터 카메라(IMX296)로 촬영한 DTL(Down-The-Line) 스윙 영상을 수집·업로드·분석하는 프론트엔드입니다.  
정밀 런치모니터 수치 대신 **스윙 이벤트·템포·방향 경향** 같은 현실적으로 신뢰 가능한 지표를 우선합니다.

## 핵심 플로우

- **AI 세션(원탭 Start/Stop)**: `POST /api/session/start` → 라이브 오버레이 → `POST /api/session/:jobId/stop` → `POST /api/analyze/from-file`.
- **라이브 프리뷰 + 오버레이**: MJPEG 프리뷰 위에 실시간 bbox를 매핑해 표시(200~400ms 폴링).
- **프리뷰/캡처 해상도 정책**:
  - 프리뷰: 핫스팟 환경을 위해 `640×640`, `640×360` 프리셋과 직접 입력을 제공(1280×720 초과는 차단).
  - 캡처: 검증된 `640×360 (저화질·빠름)`, `1280×720 (권장·고화질)` 두 가지 프리셋만 노출.
- **업로드 & 분석**: 업로드 직후 분석 Job 생성, `queued → running → succeeded | failed` 상태 표시 및 재시도/강제 분석 UX.
- **리스트 & 재생**: 카메라 `GET /api/session/list` 기반으로 세션 히스토리 구성(필요 시 `/api/files` fallback), 분석 상태 뱃지/CTA 제공. 필요 시 세션 삭제 가능.
- **분석 뷰**: 이벤트 타임라인(Address/Top/Impact/Finish), 요약 코멘트, 핵심 지표(스윙 플레인/템포/임팩트 안정성) 표시.
- **모바일 우선**: iOS/핫스팟 환경에서 프리뷰/캡처가 빠르게 동작하도록 저해상도·저FPS 프리셋 제공.

## 카메라 API 연동 요약

- 상태: `GET /api/camera/status` → `busy/streaming/streamClients/lastCaptureAt` 기반으로 버튼 활성화.
- 프리뷰: `<img src="/api/camera/stream.mjpeg?...">` 연결/해제 시 src 비우기(Abort)로 명시 종료.
- 프리뷰/세션 동시 사용 가능, 프리뷰는 멀티 클라이언트 접속 허용.
- 세션 시작/종료:
  - `POST /api/session/start` → `{ jobId, videoFile, videoUrl, metaPath }`
  - 요청(옵션): `{ width, height, fps, model, durationSec }`
  - `POST /api/session/:jobId/stop` → `{ jobId, videoUrl, metaPath }`
- 세션 상태/메타:
  - `GET /api/session/list?limit=50&offset=0` → `{ jobId, status, startedAt, stoppedAt, errorMessage, videoFile, videoUrl, metaPath }`
  - `GET /api/session/:jobId/status` → `running | stopped | failed`
  - `GET /api/session/:jobId/meta` → 정규화된 meta(frames 배열)
  - `DELETE /api/session/:jobId` → 세션 비디오/메타/상태 삭제
- 라이브 인퍼런스: `GET /api/session/:jobId/live?tailFrames=30` (bbox 배열, 최신 프레임만 사용)
- 캡처: `POST /api/camera/capture` (jpg/mp4), `POST /api/camera/capture-and-analyze` (녹화+분석).
  - 파일명 규칙: `golf_YYYYMMDD_HHmmss_mmm_type.ext` (프런트에서 생성).
  - busy/streaming 시 409, 인증 401, 타임아웃 504 처리.
- 파일 서빙: `/uploads/:filename`
- AI 라벨 구성은 `yolov8s_nms_golf.json` 고정 사용(웹에서 자동 적용).

## 백엔드 분석 API 연동 요약

- `POST /api/analyze/from-file` : `{ jobId, filename, metaPath?, force? }` → `{ ok, jobId, status }`
- `GET /api/analyze/:jobId` : `pending | running | done | failed` 상태 + 동일 스키마 결과 반환

## Service7 640 HEF 기준

- 현재 service7 업로드 분석은 `640 HEF` 기준이 더 낫습니다.
- `960 HEF` 대비 실제 Pi 비교 결과:
  - `player_ready`: `15 -> 51`
  - `club_head`: `0 -> 3`
  - `trackingQuality.score`: `0.03 -> 0.08`
  - `confidence`: `0.09 -> 0.23`
  - `shaftPlane`: `unknown -> flat`
  - `readiness`: `0.33 -> 0.60`
- 따라서 운영 기본값은 `640 HEF`로 두고, `960 HEF`는 비교용 백업으로 유지하는 것이 맞습니다.
- 다만 `person=0`, `golf_ball` 약세는 여전히 남아 있어, 현재 상태를 최종 품질로 보지는 않습니다.

## 2차 Calibration 기준

`640 HEF`가 개선을 만들긴 했지만, 추적 품질은 아직 `weak`가 많습니다. 다음 calibration 수집은 아래 기준을 따릅니다.

- 영상 구성:
  - DTL `60~70%`
  - 정면 `30~40%`
- 샷 구성:
  - address
  - takeaway
  - top
  - impact
  - finish
- 촬영 조건:
  - 전신이 프레임 안에 완전히 들어올 것
  - 클럽 헤드와 손잡이가 배경에서 분리될 것
  - 조명/배경/거리 variation 포함
  - 세로형 업로드 원본 분포를 반영할 것
- 제외 대상:
  - 몸 일부가 잘린 근접 영상
  - 클럽 헤드가 거의 안 보이는 어두운 영상
  - 서비스에 실제로 거의 들어오지 않는 극단 각도

권장 수량:

- 최소 `128장`
- 권장 `150~300장`
- 실제 Pi 업로드/카메라 프레임 기반 `calib_images.zip` 사용

## Pi 검증 포인트

새 HEF를 배포한 뒤에는 같은 업로드 영상 기준으로 아래를 반드시 비교합니다.

- `/tmp/<jobId>.meta.json.raw`
- `/tmp/<jobId>.meta.json`
- `/api/analyze/<jobId>`

라벨별로 봐야 할 값:

- total detections
- frames covered
- avg confidence

우선순위 라벨:

- `person`
- `player_ready`
- `player_not_ready`
- `golf_ball`
- `club_head`
- `club`
- `club_handle`

`person / player_ready / golf_ball`이 함께 살아나는지가 다음 판정 기준입니다.

## 환경변수

- `.env.example`를 참고해 로컬 `.env`를 생성하세요.
- `VITE_BACK_BASE_URL` (또는 `VITE_API_BASE`): 기본은 비워두고 same-origin `/api` 프록시를 사용합니다. Vite dev에서 별도 백엔드를 직접 붙일 때만 예) `http://localhost:3000`
- `VITE_BACK_BASE_URL_LOCAL` / `VITE_BACK_BASE_URL_PI` (옵션): 기본은 비워두고 필요할 때만 설정합니다.
- `VITE_API_BASE_LOCAL` / `VITE_API_BASE_PI` (옵션): 기존 키 호환.
- `VITE_CAMERA_BASE_URL` (또는 `VITE_CAMERA_API_BASE`, `NEXT_PUBLIC_CAMERA_API_BASE`): 카메라 서버 주소 예) `http://raspberrypi.local:3001`
- `VITE_CAMERA_AUTH_TOKEN` 또는 `NEXT_PUBLIC_CAMERA_AUTH_TOKEN` (옵션): 카메라 API Bearer 토큰
- `BACK_BASE_URL` / `CAMERA_BASE_URL` (옵션): `npm run start`에서 사용하는 런타임 프록시 대상입니다. 미설정 시 각각 `http://127.0.0.1:3000`, `http://127.0.0.1:3001`을 사용합니다.
- `server.js` 런타임 프록시는 `VITE_*`를 읽지 않습니다. `VITE_*`는 브라우저 번들 빌드 전용입니다.
- 기타 프리뷰/분석 관련 실험용 값이 필요하면 `VITE_` prefix를 사용해 추가합니다.

## 실행

```bash
npm install
npm run dev  # http://localhost:5173
```

- dev 프록시는 `/api/camera`, `/api/session`, `/uploads`를 카메라로, `/api/*`는 hailo-back으로 전달합니다.
- 프리뷰 빌드를 점검하려면 `npm run preview` 사용
- 운영용 프록시는 아래처럼 실행합니다.

```bash
npm run build
npm run start  # http://localhost:4173 (server.js)
```

## 빌드

```bash
npm run build
```

- 산출물: `dist/` (서버 프록시 `server.js`가 정적 파일 서빙 + 카메라 프록시를 담당)

## 업로드 파라미터

`useUpload` 훅은 업로드 시 아래 필드를 옵션으로 전달해 분석에 활용합니다.

| 필드              | 설명                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| `club`            | 사용한 클럽 종류(예: driver, 7i)                                                     |
| `fps`             | 촬영 프레임레이트. 캡처 시 선택한 값과 일치시켜야 이벤트 정렬 정확도가 올라갑니다.   |
| `roi`             | 분석 영역(Region of Interest). `"x1,y1,x2,y2"` 포맷 등 백엔드에서 요구하는 형태 사용 |
| `cam_distance`    | 카메라-선수 간 거리(m)                                                               |
| `cam_height`      | 카메라 높이(m)                                                                       |
| `h_fov` / `v_fov` | 카메라 수평/수직 화각(°)                                                             |
| `impact_frame`    | 수동으로 지정하는 임팩트 프레임 인덱스                                               |
| `track_frames`    | 추적 프레임 수(분석 파이프라인 전용)                                                 |

필요한 값만 선택적으로 넘길 수 있으며, 값은 모두 문자열로 폼데이터에 포함됩니다.
렌즈 선택 시 `h_fov`/`v_fov`는 카메라 보정값으로 자동 입력됩니다.

## 설계 원칙

- ✅ 단일 카메라에서 신뢰 가능한 지표(이벤트/템포/경향) 우선
- ✅ 선택지 최소화(검증된 해상도만 노출)로 안정성/UX 확보
- ❌ 스핀/정밀 볼스피드 등 다중 센서 요구 기능은 범위 밖

## 기술 스택

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui (버튼/카드/폼/Select 등)
- Radix UI primitives (Select 등)
