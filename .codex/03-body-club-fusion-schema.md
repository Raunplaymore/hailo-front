# Body/Club Fusion Schema

이 문서는 전신 스윙 분석기의 최소 관측 스키마와 결과 스키마를 정의한다.

## 입력 스키마

최종 분석 엔진은 최소 아래 입력을 받는다.

### A. 공통 메타

```json
{
  "jobId": "string",
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "durationMs": 2200,
  "viewpoint": "face_on | down_the_line | unknown"
}
```

### B. Body track

```json
{
  "frames": [
    {
      "frameIndex": 0,
      "timeMs": 0,
      "keypoints": {
        "nose": [0.0, 0.0, 0.0],
        "left_shoulder": [0.0, 0.0, 0.0],
        "right_shoulder": [0.0, 0.0, 0.0],
        "left_hip": [0.0, 0.0, 0.0],
        "right_hip": [0.0, 0.0, 0.0],
        "left_wrist": [0.0, 0.0, 0.0],
        "right_wrist": [0.0, 0.0, 0.0],
        "left_knee": [0.0, 0.0, 0.0],
        "right_knee": [0.0, 0.0, 0.0],
        "left_ankle": [0.0, 0.0, 0.0],
        "right_ankle": [0.0, 0.0, 0.0]
      }
    }
  ]
}
```

설명:

- 좌표는 normalized x/y + confidence
- pose 라이브러리 선택은 자유지만 출력은 이 형태로 정규화

### C. Club track

```json
{
  "frames": [
    {
      "frameIndex": 0,
      "timeMs": 0,
      "clubHead": { "x": 0.0, "y": 0.0, "confidence": 0.0 },
      "clubHandle": { "x": 0.0, "y": 0.0, "confidence": 0.0 },
      "clubBox": { "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0, "confidence": 0.0 }
    }
  ]
}
```

설명:

- `clubBox`는 보조 입력
- shaft line은 후처리로 `clubHead` + `clubHandle`에서 계산

## 진행 상태 스키마

분석 상태는 아래 축으로 관리한다.

```json
{
  "progress": {
    "stage": "uploaded | video_ready | pose_running | club_running | fusion_running | succeeded | failed",
    "stageLabel": "문자열",
    "message": "문자열",
    "detail": {}
  }
}
```

권장 실패 코드:

- `POSE_PIPELINE_UNREACHED`
- `POSE_DATA_INSUFFICIENT`
- `CLUB_PIPELINE_UNREACHED`
- `CLUB_DATA_INSUFFICIENT`
- `FUSION_FAILED`

## 이벤트 스키마

```json
{
  "events": {
    "address": { "frame": 0, "timeMs": 0 },
    "top": { "frame": 0, "timeMs": 0 },
    "impact": { "frame": 0, "timeMs": 0 },
    "finish": { "frame": 0, "timeMs": 0 }
  }
}
```

## 메트릭 스키마

### A. Body metrics

```json
{
  "bodyMetrics": {
    "hipRotation": {},
    "shoulderRotation": {},
    "xFactor": {},
    "headStability": {},
    "weightShiftApprox": {}
  }
}
```

### B. Club metrics

```json
{
  "clubMetrics": {
    "shaftPlane": {},
    "backswing": {},
    "tempo": {},
    "impactStability": {},
    "trackingQuality": {}
  }
}
```

### C. Fusion metrics

```json
{
  "fusionMetrics": {
    "sequencing": {},
    "transitionTiming": {},
    "releaseTiming": {}
  }
}
```

## 최종 결과 스키마

```json
{
  "jobId": "string",
  "status": "queued | running | succeeded | failed",
  "analysisVersion": "body-club-fusion-v1",
  "events": {},
  "metrics": {
    "body": {},
    "club": {},
    "fusion": {}
  },
  "summary": "string | null",
  "coachSummary": [],
  "confidence": 0.0,
  "progress": {},
  "debug": {}
}
```

## 신뢰도 계산 원칙

confidence는 단순 class detection 수가 아니라 아래를 조합한다.

1. pose coverage
2. club head/handle 동시 검출률
3. 이벤트 분할 안정성
4. 시점 적합도
5. 프레임 품질

## 사용 원칙

1. `person` detection 수로 몸 분석 품질을 판단하지 않는다.
2. shaft plane은 `club_head + club_handle` 없이는 확정하지 않는다.
3. 골반/어깨 관련 코칭은 pose 없이는 확정하지 않는다.
4. UI는 body/club/fusion 실패를 서로 분리해서 보여줘야 한다.
