# 환불히어로 (refundhero) — Frontend

헬스장, 필라테스, 학원, PT, 인강, 피부관리 등 중도해지 시 예상 환불금과 환불 요청 문구를 한 번에 확인하는 웹서비스의 **프론트엔드** 코드입니다.

## Tech Stack

- Vite + React 19
- Tailwind CSS v4 (`@tailwindcss/vite`)
- JavaScript (JSX)

## 빠르게 실행하기

```bash
npm install
npm run dev
```

기본 주소: <http://localhost:5173/>

## 빌드 / 미리보기

```bash
npm run build      # dist/ 생성
npm run preview    # 빌드 결과 미리보기
```

## 화면 구성 (단일 파일 step 기반)

`src/App.jsx` 한 파일에 모두 들어 있습니다.

- `step === 1` 메인(랜딩): 상단 배너, 네비, 히어로, 기능 카드
- `step === 2` 입력폼: 업종 / 결제금액 / 계약·이용기간 / 업체 안내 환불금·위약금·문구 / 환불 사유 / 요청 문구 유형
- `step === 3` 결과: 예상 환불금, 이용금액, 위약금, 업체 안내 환불금과의 차이, 주의 키워드 탐지, 요청 문구 + 복사 버튼

## 임시 계산 로직 (백엔드 연결 전)

`src/App.jsx` 의 `computeRefund` 에 들어 있습니다.

```text
이용금액 = 총 결제금액 * min(max(실제 이용기간 / 전체 계약기간, 0), 1)
위약금   = 사용자가 입력한 위약금이 있으면 그 값, 없으면 총 결제금액의 10%
예상 환불금 = 총 결제금액 - 이용금액 - 위약금
차이금액 = 예상 환불금 - 업체 안내 환불금
```

**주의 키워드** (`WARNING_KEYWORDS`): `환불 불가`, `환급 불가`, `취소 불가`, `양도만 가능`, `정상가 기준`, `이벤트가`, `할인가`, `위약금`, `소멸`

## 백엔드 연결 가이드

`submitForm` 안의 `computeRefund(form)` 호출을 아래로 교체하면 됩니다.

```js
const response = await fetch("http://localhost:8000/api/refund/result", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(form),
});
const calc = await response.json();
```

응답 스키마(권장):

```ts
{
  ok: true,
  totalPaid: number,
  usageFee: number,
  penalty: number,
  expectedRefund: number,
  vendorGuided: number,
  diff: number,
  warnings: string[]
}
```

## 디자인 토큰

`src/index.css` 의 CSS 변수로 정의되어 있습니다.

| 변수 | 값 | 용도 |
| --- | --- | --- |
| `--mint-main` | `#90E6B3` | 메인 CTA / 강조 |
| `--mint-light` | `#C9F2D8` | 보조 강조 / 배지 |
| `--text-main` | `#191f28` | 본문 텍스트 |
| `--text-sub` | `#6b7684` | 부가 텍스트 |
| `--bg-main` | `#f9fafb` | 페이지 배경 |

## 폴더 구조

```
frontend/
├── public/
├── src/
│   ├── App.jsx          # 전체 UI + 임시 계산 로직
│   ├── main.jsx
│   ├── index.css        # Tailwind import + 디자인 토큰
│   └── assets/
├── index.html
├── vite.config.js       # @tailwindcss/vite 플러그인 등록
└── package.json
```
