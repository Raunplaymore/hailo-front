# Golf Analysis Architecture

이 문서는 이 프로젝트를 단일 `pi_web` 저장소가 아니라, 다음 sibling 저장소를 함께 다루는
하나의 골프 스윙 분석 시스템으로 다루기 위한 기준 문서다.

- `pi_web`: 웹 UI, 업로드/목록/분석 화면, 프록시
- `pi_service`: 업로드 오케스트레이션, 분석 job 관리, 결과 스토어
- `pi_camera`: 라즈베리파이 카메라 제어, Hailo 추론 입력/메타 생성
- `hailo-infer`: 후처리 분석 엔진, 이벤트 분할, 코칭 메트릭 계산

## 목표

전신 스윙 분석기를 다음 3계층으로 분리한다.

1. 몸 분석
2. 클럽 분석
3. 이벤트/메트릭 분석

## 역할 분리

### 1. 몸 분석

몸의 쓰임은 Hailo detection 모델이 아니라 pose 기반 분석으로 처리한다.

권장 입력:

- 어깨 좌/우
- 골반 좌/우
- 손목 좌/우
- 무릎 좌/우
- 발목 좌/우
- 머리/코

권장 구현:

- CPU 기반 pose 라이브러리 사용
- 실시간보다 업로드 후 분석 우선
- 정면/측면 시점 분리 가능해야 함

몸 분석으로 계산할 핵심:

- 골반 회전
- 어깨 회전
- X-factor
- 체중 이동 근사
- 머리 흔들림
- 자세 안정성

### 2. 클럽 분석

Hailo-8은 클럽 전용 추적기로 사용한다.

우선 클래스:

- `club_head`
- `club_handle`

선택 클래스:

- `club`

비권장 클래스:

- `person`
- `player_ready`
- `player_not_ready`
- `golf_ball` (1차 안정화 전에는 제외 권장)

목표:

- `club_head`와 `club_handle` 동시 검출률 최대화
- 후처리에서 두 점으로 shaft line 추정
- takeaway/top/downswing/impact 구간의 클럽 궤적 안정화

### 3. 이벤트/메트릭 분석

최종 분석기는 detection 결과를 그대로 노출하는 서비스가 아니라, 시간축 이벤트 엔진이어야
한다.

필수 이벤트:

- address
- takeaway
- top
- transition
- impact
- finish

핵심 메트릭:

- tempo
- backswing size
- shaft plane
- hip rotation / shoulder rotation
- sequencing
- impact stability

## 하드웨어 적합 구성

현재 장비는 Raspberry Pi 5 + Hailo-8(26 TOPS) 조합이다.

이 스펙에서는 다음 구성이 적합하다.

### 실시간 경로

- `pi_camera`
  - 카메라 프리뷰
  - Hailo club detector 실행
  - frame timestamp + club detection 저장

### 업로드/후처리 경로

- `pi_service`
  - 업로드 수집
  - pose 작업 enqueue
  - Hailo meta + pose 결과 병합
  - 분석 상태(progress) 관리

- `hailo-infer`
  - club track + pose track를 받아 이벤트/메트릭 계산
  - 분석 결과 스키마 표준화

## 현재 금지할 가정

다음 가정은 금지한다.

1. Hailo가 사람/준비상태/공/클럽을 한 작은 detection 모델로 모두 안정적으로 처리할
   것이라는 가정
2. detection class 수를 늘리면 분석 품질도 같이 좋아질 것이라는 가정
3. front/back/camera/infer 저장소를 분리해서 reasoning해도 시스템이 유지된다는 가정

## 의사결정 원칙

1. 전신 분석은 pose 우선
2. Hailo는 클럽 전용 우선
3. 실시간 경로와 정밀 분석 경로를 분리
4. 정면/측면 시점 분기를 염두에 둠
5. cross-repo 변경은 항상 `pi_web` 기준으로 sibling repo까지 함께 검토
