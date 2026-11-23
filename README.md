# 문제별 랩 타이머 (PWA)

풀 때는 탭만, 분석은 끝나고.

## 명령어

| 명령 | 하는 일 |
|---|---|
| `npm install` | 의존성 설치 (처음 한 번) |
| `npm run dev` | 개발 서버. 같은 Wi-Fi의 폰에서 `Network:` 주소로 접속 |
| `npm test` | 타이머 로직 단위 테스트 (Vitest) |
| `npm run build` | 타입 검사 + 배포용 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과를 서비스 워커 포함해서 실행 |
| `npm run icons` | `public/icon.svg`를 바꾼 뒤 PWA 아이콘 다시 만들기 |

## 폴더 구조

```
src/
  lib/timer.ts        핵심 로직 (이벤트 재생, 되돌리기, 요약) — 화면과 무관한 순수 함수
  lib/timer.test.ts   위 로직 테스트
  lib/storage.ts      localStorage 저장 (진행 중 시험, 기록, 프리셋)
  screens/            설정 / 시험 / 복기 화면
  components/         아날로그 시계, OMR 그리드, 막대그래프
  hooks/              wake lock, 길게 누르기, 현재 시각
```

## 설계 메모

- 저장하는 건 **이벤트 목록**(`start / tap / skip / jump / end` + `Date.now()` 시각)뿐이다.
  현재 문제, 보류 상태, 구간 로그는 이벤트를 처음부터 재생해서 계산한다.
  그래서 되돌리기 = 마지막 이벤트 삭제이고, 이전 상태로 정확히 돌아간다.
- 이벤트가 생길 때마다 `localStorage`에 바로 저장 → 새로고침해도 이어서 진행.

## 폰에서 확인하기

1. **같은 Wi-Fi로 빠르게 보기**: `npm run dev` → 터미널의 `Network: http://192.168.x.x:5173` 주소를 폰 브라우저에 입력.
   Windows 방화벽 창이 뜨면 "개인 네트워크" 허용. (HTTP라서 화면 꺼짐 방지·오프라인·홈 화면 설치는 동작하지 않음)
2. **PWA 전체 기능 확인**: HTTPS 배포 후 접속.
   - 아이폰 Safari: 공유 버튼 → "홈 화면에 추가"
   - 안드로이드 Chrome: 메뉴 → "앱 설치" (또는 "홈 화면에 추가")

## 배포

- **Vercel**: GitHub 저장소를 Vercel에 import → Framework는 Vite 자동 감지 → Deploy. 설정 변경 필요 없음.
- **GitHub Pages**: 저장소 Settings → Pages → Source를 "GitHub Actions"로. `main`에 push하면
  `.github/workflows/deploy.yml`이 테스트·빌드·배포를 한다. (주소: `https://아이디.github.io/저장소이름/`)
