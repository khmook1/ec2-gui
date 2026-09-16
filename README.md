# EC2 GUI

Tauri 2 + React + TypeScript 기반 데스크톱 앱입니다.

## 앱 이름

표시 이름은 아래를 함께 맞춥니다.

| 위치 | 키 | 용도 |
|------|-----|------|
| `.env` / `.env.development` / `.env.production` | `VITE_APP_NAME` | UI(사이드바 등) 표시명 |
| `src-tauri/tauri.conf.json` | `productName` | 번들·설치 앱 이름 |
| `src-tauri/tauri.conf.json` | `app.windows[0].title` | 창 상단바 제목 |

```env
VITE_APP_NAME=EC2 GUI
```

```json
{
  "productName": "EC2 GUI",
  "app": {
    "windows": [{ "title": "EC2 GUI" }]
  }
}
```

창 제목만 바꾸려면 `title`을 수정한 뒤 `pnpm tauri dev`를 다시 실행합니다.

## 앱 아이콘

아이콘은 `src-tauri/icons/`에 있습니다.  
원본 이미지(권장: **1024×1024 PNG**)로 세트를 다시 생성하려면:

```bash
pnpm tauri icon path/to/your-icon.png
```

생성 후 `pnpm tauri dev` 또는 `pnpm tauri build`를 다시 실행하면 반영됩니다.

## 기술 스택

- Tauri 2
- React
- TypeScript
- Vite
- pnpm
- Rust
- ESLint
- Prettier
- Zustand

## 시작하기

```bash
pnpm install
pnpm tauri dev
```

## 주요 스크립트

```bash
pnpm dev
pnpm build
pnpm lint
pnpm format
pnpm tauri build
```
