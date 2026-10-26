# Swing Lab UI/UX 개편 · 2026-10-26

상태: 구현 및 후보 검증 완료, 운영 미배포. 사용자 디자인 평가와 운영 배포 승인은 별도다.

## 목표와 범위

촬영·업로드에서 영상 및 코칭 확인까지 이어지는 흐름을 단순하게 만든다. 기존 영상 재생·이벤트 탐색·분석 계약과 저장 데이터를 유지한다. 이번 목표의 산출물은 검증된 UI 후보, 회귀 검사, 화면 증거, 의존성을 포함한 배포 패키지다.

제품 화면은 hailo-front의 MainApp이다. 연구용 debug 화면과 별도 NAS Library 제품의 정보 구조는 변경하지 않았다. 공통 버튼·탭·색상 토큰은 공유하므로 해당 화면에도 시각적으로 적용된다. 추론 정확도 개선이나 새 진단 기준 개발은 이번 UI 작업의 완료 조건에 포함하지 않는다.

## 점검에서 확인한 문제

- 운영 `practice-ux-20261026-r1`은 상단 소개가 길고 기록은 촬영 화면의 Lists 창 안에 있었다.
- 기록과 별도로 빈 분석 탭이 있었고, 목록에서 보기·임팩트 검수·제목 누르기가 서로 다른 행동이었다.
- 분석 화면에서 상태·수치·연구 코칭·자세 비교·후보 검수·타임라인이 누적됐다.
- 업로드 파일 선택과 별도 업로드 버튼, 대기 상태와 서버 메시지 카드가 중복됐다.
- 연결 실패가 레거시 API 재시도 후 빈 배열로 바뀌어 실제 빈 기록과 구분되지 않았다.
- 설정의 FPS·ROI·렌즈·FOV가 기본 촬영 조건과 같은 수준으로 노출됐다.

## 적용한 설계

| 원칙 | 구현 |
|---|---|
| 명확한 위계, 작업에 집중 | 짧은 헤더, 촬영·업로드·기록 탐색, 기록 안의 영상 상세 |
| 콘텐츠 우선 | 기록은 썸네일·파일명·상태, 상세는 영상부터 표시 |
| 일관된 조작과 피드백 | 임팩트 / 머리·골반 / 자세 비교 전환, 같은 위치의 진행·실패·재시도 |
| 점진적 공개 | 연구 기록, 원본·NAS·삭제, 고급 촬영 옵션을 펼침 항목으로 이동 |
| 모바일·키보드 사용성 | 핵심 터치 조작 48px, 안전 영역, 포커스 표시, 모달 포커스 순환·Escape·복귀 |

참고한 1차 자료: [Apple Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Instagram Lite의 People First, Simplicity, Craft](https://www.meta.com/design-at-meta/blog/instagram-lite-a-global-collaboration-between-research-and-design/), [Material Foundations](https://m3.material.io/foundations/), [Google 터치 영역 안내](https://support.google.com/accessibility/android/answer/7101858).

브랜드 화면을 복제하지 않고 기존 다크·민트 계열을 유지했다. 배경 장식과 카드 중첩을 줄이고 시스템 글꼴과 공통 버튼·탭을 사용한다.

## 최종 흐름

1. 촬영: 미리보기 → 촬영 시작 → 상태 확인 → 촬영 완료의 스윙 확인. 카메라 연결 오류는 접힌 상세 밖에서도 알린다.
2. 업로드: 영상 선택 하나 → 진행 상태와 중복 제출 방지 → 분석 상세로 자동 이동. 실패하면 같은 위치에서 다시 선택한다.
3. 기록: 업로드 / 카메라 촬영의 두 출처 → 파일명 또는 확인 버튼 한 번 → 영상 상세.
4. 상세: 영상과 재생 조작 → 임팩트 / 머리·골반 / 자세 비교. 타임라인은 짧은 한국어 표기로 유지한다.
5. 자세 비교는 두 후보 장면을 실제로 확인한 뒤 제출한다. 확인·추적 품질·영상 정체성 검증을 유지한다.
6. 연구 수치와 기존 코칭은 연구 참고라는 설명 아래에서 펼쳐 볼 수 있다.

설정 완료는 원래 화면으로 돌아간다. 기본 설정은 촬영 시점·사용 손·클럽이며 세부 카메라 옵션은 접혀 있다.

## 구현 중 발견해 수정한 문제

- 390px 첫 화면의 임팩트 버튼이 하단 탐색에 일부 가림: 중복 제목·화질 조작을 영상 옵션으로 이동하고 간격을 조정했다.
- 320px 타임라인의 Takeaway 글자 넘침: 준비·백스윙·탑·임팩트·피니시로 표기를 통일했다.
- 영상 실패 상태에서 장면 이동 버튼이 활성화됨: 재생 준비 상태에 따라 잠그고 영상 재로딩을 제공한다.
- 설정 포커스 순환에 닫힌 details 내부 요소가 포함됨: 접힌 조상 안의 요소를 제외하고 summary 자체는 포함한다.
- 목록 503을 빈 기록으로 오인: 서버·네트워크 오류는 전달하고 404/405/HTML 호환 상황에서만 레거시 경로로 넘어간다. 기존 기록 유지와 성공 후 오류 해제를 검사했다.

## 검증 증거

브라우저 후보는 실제 Vite 빌드를 사용했다. 저장 영상 IMG_5741.mov의 경량 사본, 기존 분석·임팩트 캐시, Pi에서 검증했던 자세 비교·움직임 응답을 격리된 로컬 HTTP 서버에서 재현했다. 후보 빌드에서는 카메라 주소만 로컬 테스트 서버로 바꿨다. 새 진단 정확도나 운영 서버의 새 추론을 검증한 것은 아니다. 업로드·분석 재시도도 로컬 테스트 응답이며 운영 업로드·분석·삭제 요청은 보내지 않았다.

증거 폴더: `hailo-model/artifacts/recovery/service-ux-2026-10-26/`

- `browser-checks.json`: 파일 선택 후 자동 이동, 실패 후 같은 파일 재시도, 영상 503 후 복구, 목록 오류·진짜 빈 기록, 상태별 목록, 머리·골반, 두 장면 비교, 키보드 순환, 320/390px 및 데스크톱 검증.
- `mobile-impact.png`, `mobile-pelvis.png`, `mobile-records.png`, `mobile-upload.png`, `mobile-records-320.png`, `desktop-impact.png`: 화면 증거.
- `fixtures/`: 운영에서 읽은 영상·분석·후보와 썸네일. 패키지에 포함하지 않는다.
- `preview-server.mjs`: 테스트 응답과 재시도 상황 재현기. 운영 서버가 아니다.

자동 검사:

- `npx tsc --noEmit`
- `npm run check:coach-release`: 기존 프런트·백엔드·추론 계약 검사 및 운영 빌드
- `npm run check:upload`, `check:list-performance`, `check:impact-review`, `check:practice-coach`, `check:movement-guide`, `check:service-ux`
- `python3 ../hailo-infer/scripts/check_movement_guide.py`
- `python3 ../hailo-infer/scripts/check_practice_review.py`
- 세 저장소의 `git diff --check`

개편용 검사는 CI의 review interface 단계에도 추가했다. 기존 대형 번들 경고는 남아 있고 새 의존성은 추가하지 않았다.

## Else-if 사용 평가

사용자가 이전에 긍정 평가한 재생 속도와 이벤트 탐색을 보존 조건으로 기록했다. 버튼·설명 카드를 계속 추가하던 방식을 반복하지 않도록 현재 기준과 실패 이유, 검증 방법을 짧게 유지했다. 수동 체크포인트만 사용했으며 전역 훅이나 설치 링크를 복구하지 않았다.

이를 바탕으로 실제 결과를 확인하며 레이아웃·키보드·오류 상태를 수정했다. 의사결정 기준을 잃지 않는 데는 도움이 됐지만 스킬 자체가 품질·속도·토큰 비용을 개선했다는 정량 비교는 하지 않았다. 사용자 디자인 평가는 아직 받지 않았다.

## 배포 경계와 한계

운영은 변경하지 않았다. 프런트 개편과 이전에 준비한 머리·골반 가이드가 함께 동작하려면 다음을 순서대로 적용해야 한다.

1. infer: `app/services/movement_guide.py`, `app/services/practice_review.py`, `app/schemas.py`
2. backend: `server.js`의 기존 후보 시각 전달 한 줄
3. frontend: 최종 `dist/`

운영 백엔드와 비교한 차이는 `impactMs` 전달 한 줄이다. infer의 기존 두 파일 차이도 movementGuide 응답과 선택적 impactMs 추가로 제한되어 있음을 확인했다. 자세 비교의 기존 확인 조건은 유지한다. 패키지는 모델·학습 자료·업로드·라벨·환경 파일·자격 증명·node_modules를 포함하지 않는다.

배포 승인을 받은 뒤 적용 직전 운영 기준 해시를 다시 확인하고, 기존 release 링크와 infer 세 파일을 백업한다. 실패하면 프런트·백엔드 링크 및 infer 파일을 함께 이전 상태로 돌린다. 사용자 영상과 라벨은 건드리지 않는다. 배포 방식은 프로젝트 배포 프로필을 따른다.

실제 iPhone Safari의 터치·안전 영역·현장 카메라 촬영은 이번 후보 검사에서 실행하지 않았다. 화면상 머리·골반 이동은 2D 관찰이며 골반의 실제 회전 깊이와 얼리 익스텐션 확정 진단을 제공하지 않는다.

## 로컬 후보 다시 열기

`hailo-front`에서 실행한다. 테스트 요청은 격리된 재현 응답으로만 처리한다.

```sh
VITE_CAMERA_BASE_URL='' VITE_CAMERA_API_BASE='' npm run build -- --outDir /tmp/hailo-service-ux-dist
node ../hailo-model/artifacts/recovery/service-ux-2026-10-26/preview-server.mjs
```

후보 주소: `http://127.0.0.1:45174/`. `release.tar.gz`의 운영 빌드는 기존 카메라 설정을 사용한다.
