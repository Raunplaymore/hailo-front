# NAS 모바일 라이브러리 배포

`Deploy NAS Library` workflow는 NAS가 Pi와 무관하게 모바일 library build를 제공하도록 `/volume1/hailo/web/releases`에 Vite build를 올리고, 컨테이너 bind mount에서도 유효한 상대 `current` 링크를 전환한다.

workflow는 `main` push마다 NAS library build를 자동 배포한다. 설정할 repository secrets는 다음 네 개다.

| Secret | 값 |
| --- | --- |
| `NAS_HOST` | NAS의 Tailscale IP 또는 hostname |
| `NAS_SSH_PORT` | NAS SSH 포트 |
| `NAS_SSH_USER` | `/volume1/hailo/web`에 쓸 수 있는 배포 계정 |
| `NAS_SSH_KEY` | 위 계정의 전용 배포 private key |

필요하면 GitHub Actions의 **Deploy NAS Library → Run workflow**로도 수동 재배포할 수 있다. NAS storage compose는 `WEB_ROOT=/web/current`을 사용하므로, 정적 release를 처음 올린 뒤 아래 명령으로 컨테이너를 재빌드한다.

```sh
cd /volume1/hailo/compose && /usr/local/bin/docker compose --env-file .env -f compose.yml up -d --build
```

2026-10-29 확인한 Tailscale Serve의 기본 HTTPS 경로는 NAS의
`http://127.0.0.1:18080`으로 프록시된다. 모바일 접속 주소는
`https://ray.tail5b26da.ts.net/`이다. 같은 시점에 이전 문서의 `:18080` HTTPS
주소는 TLS 연결에 실패했으므로, 현재 Serve 상태를 다시 확인한 뒤 사용한다.
