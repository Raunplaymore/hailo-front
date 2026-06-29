# Cross-Repo Refactor Plan

이 문서는 `pi_web`을 기준 workspace anchor로 삼아, sibling 저장소까지 포함한 실제 수정
순서를 정의한다.

## 기준

작업 시작점은 항상 `pi_web`이다. 다만 다음 변화는 반드시 sibling 저장소를 함께 검토한 뒤
수정한다.

- 업로드 API
- 분석 상태 스키마
- 카메라 meta 형식
- Hailo 추론 설정
- pose/club 융합 결과
- 배포/런타임 설정

## 저장소별 최종 역할

### `pi_web`

책임:

- 업로드/분석 진행 상태 UI
- 분석 결과 렌더링
- 카메라 설정/세션 UI
- 시점, 품질, 실패 이유를 사용자에게 설명

해야 할 변경:

- pose 기반 메트릭 섹션과 club 기반 메트릭 섹션 분리
- 분석 progress를 `video_ready -> pose_running -> club_running -> fusion -> done`
  흐름으로 수용
- 실패 사유를 `pose_missing`, `club_missing`, `fusion_failed` 같은 축으로 세분화
- 스키마 변경을 견딜 수 있게 카드/상태 UI를 느슨하게 구성

### `pi_service`

책임:

- 업로드 수신
- 변환/메타 준비
- pose 작업과 infer 작업 오케스트레이션
- 결과 병합 및 상태 스토어

해야 할 변경:

- 업로드 분석 job을 body/club/fusion 단계로 분리
- OpenCV fallback 중심 구조를 제거하거나 보조 경로로 축소
- pose 결과 파일 경로와 club meta 경로를 함께 저장
- 결과 progress를 top-level과 analysis 내부에 일관되게 기록

### `pi_camera`

책임:

- 카메라 제어
- Hailo club detector 실행
- Hailo detection meta 생성

해야 할 변경:

- service7 다중 클래스 방향에서 club-only 방향으로 모델 역할 축소
- `club_head`, `club_handle` 검출률을 우선 지표로 삼음
- 운영용 HEF와 debug HEF를 명확히 분리
- raw/meta 저장 경로를 분석 재현 가능하게 유지

### `hailo-infer`

책임:

- detection 소비 서비스가 아니라 분석 엔진
- pose + club 데이터를 결합해 이벤트와 메트릭 생성

해야 할 변경:

- 입력 스키마에 pose track 추가
- club track만으로 계산하는 항목과 pose가 필요한 항목을 분리
- `analysisVersion`을 detection 버전이 아니라 분석 파이프라인 버전으로 관리
- confidence를 class count가 아니라 입력 품질과 event segmentation 품질 중심으로 계산

## 단계별 실행 순서

### Phase 1. 모델 역할 재정의

1. Hailo용 모델 목표를 club-only로 축소
2. pose는 CPU 기반 별도 경로로 설계
3. 현재 7-class service7는 운영 기준에서 축소 또는 폐기 후보로 둠

완료 기준:

- 시스템 문서상 Hailo와 pose의 역할이 분리됨

### Phase 2. 스키마 정리

1. body/club/fusion 입력 스키마 정의
2. progress 단계 표준화
3. `pi_service`, `hailo-infer`, `pi_web`에 동일 필드 반영

완료 기준:

- 업로드 분석 결과가 `body`, `club`, `fusion`, `summary` 축으로 분리되어 설명 가능

### Phase 3. 구현 연결

1. `pi_service`가 pose와 club 경로를 오케스트레이션
2. `hailo-infer`가 fusion 계산
3. `pi_web`가 단계별 상태와 결과 렌더링

완료 기준:

- 사용자 기준으로 “어느 단계에서 실패했는지”가 보임
- `opencv-v1` fallback에 의존하지 않음

### Phase 4. 품질 고도화

1. 정면/측면 시점 분리
2. ball detector 추가 검토
3. club-only HEF 품질 향상
4. pose 안정화 및 골반/어깨 메트릭 고도화

## 수정 우선순위

1. `pi_service` + `hailo-infer` 스키마/오케스트레이션
2. `pi_web` 상태/결과 UI
3. `pi_camera` 운영용 HEF 역할 축소
4. HEF 재학습/재컴파일 반복

## 검증 원칙

각 단계에서 반드시 확인:

1. 입력 파일 경로
2. progress 상태
3. 결과 JSON 구조
4. front 렌더링
5. Pi 런타임 서비스 상태

## Codex 작업 규칙

이 workspace에서 Codex는 다음 규칙을 따른다.

1. `pi_web` 작업이라도 API/분석 관련이면 `pi_service`와 `hailo-infer`를 함께 읽는다.
2. 카메라 모델/HEF/meta 관련이면 `pi_camera`를 함께 읽는다.
3. API contract를 바꿀 때는 front-back-infer 3곳을 세트로 본다.
4. “웹만 수정” 같은 단일 repo 사고를 금지한다.
