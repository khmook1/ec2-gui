# macOS 원격(SSH) GUI — 기능 할일

원격 macOS 호스트용 대시보드에 넣을 기능 후보.  
체크하면서 진행하면 됨.

---

## 1. 우선 넣으면 좋은 것 (Linux 대체·보완)

- [x] **시스템 리소스**
  - 왜: 왼쪽 Coming Soon을 채움
  - 실마리: `top` / `vm_stat` / `sysctl` / `netstat` (`/proc` 대체)

- [x] **메모리 압력**
  - 왜: Mac은 RAM%보다 pressure가 실사용 지표
  - 실마리: `memory_pressure`

- [x] **부팅 / 업타임 · 모델**
  - 왜: “이 머신 뭔지” 한눈에
  - 실마리: `uptime`, `sysctl hw.model`, `sw_vers`

- [x] **디스크: Data 볼륨 중심**
  - 왜: APFS는 `/`와 Data가 갈림
  - 실마리: 기존 `df` → Data·스냅샷 용량 강조

- [x] **대용량 디렉터리 (제한 스캔)**
  - 왜: 루트 `du`는 포기해도 유용
  - 실마리: `du`를 `/Users`, `/Applications`, `/Library`만

---

## 2. Mac이라서 사용자가 특히 알고 싶은 것

- [ ] **SIP / Secure Boot 상태**
  - 왜: 원격 관리·설치 가능 여부
  - 비고: `csrutil status`

- [ ] **FileVault on/off**
  - 왜: 디스크 암호화·복구 리스크
  - 비고: `fdesetup status`

- [ ] **배터리·전원 (노트북)**
  - 왜: 원격 Mac이 꺼질지
  - 비고: `pmset -g batt`

- [ ] **절전 / 디스플레이 sleep**
  - 왜: SSH 끊김·응답 지연 원인
  - 비고: `pmset -g`

- [ ] **공유·원격 설정**
  - 왜: Remote Login / Screen Sharing
  - 비고: `systemsetup`, sharing 관련

- [ ] **로그인 사용자 / GUI 세션**
  - 왜: 누가 콘솔에 앉아 있는지
  - 비고: `who`, `last`, `scutil`

- [ ] **Spotlight 인덱싱 · Time Machine**
  - 왜: CPU·디스크 급증 원인
  - 비고: `tmutil status`, `mdutil`

- [ ] **인증서·키체인 이슈 힌트**
  - 왜: HTTPS/앱 서명 실패
  - 비고: 상태만 요약 (키 내용 노출 X)

---

## 3. Docker / 앱 운영 쪽

- [ ] **Docker Desktop vs Colima / OrbStack**
  - 왜: Mac 원격은 엔진이 제각각 — “설치됨 / 실행 중” 구분

- [ ] **Rosetta / arch**
  - 왜: `arm64` 호스트에 `x86_64` 바이너리 이슈

- [ ] **LaunchAgents / Daemons**
  - 왜: Linux systemd 대응 — 상주 서비스 목록

- [ ] **Homebrew 서비스**
  - 왜: `brew services list` — 개발 Mac에 흔함

---

## 참고: 후순위 / 주의

- 전체 디스크 접근·TCC — SSH만으로 바꾸기 어려움
- 키체인 비밀번호·iCloud — GUI 노출 금지
- Screen Sharing 제어 — 별도 프로토콜
- 소프트웨어 업데이트 강제 — 재부팅·권한·시간 이슈

## 권장 구현 순서

1. 시스템 리소스(Mac) + 메모리 압력
2. 머신 요약 (`sw_vers` / 모델 / 업타임 / FileVault / SIP)
3. 제한 경로 대용량 디렉터리
4. 전원·절전·배터리
5. LaunchAgents / brew services
