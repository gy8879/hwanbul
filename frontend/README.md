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

## 백엔드 연결 가이드 (Backend B 연동 완료)

이미 `src/api.js` 에서 Backend B 의 두 API 를 호출하도록 연결돼 있어요.
환불 금액은 프론트의 임시 로직(`computeRefund`)이 그대로 처리하고, AI 기능만 백엔드를 씁니다.

### 사용하는 엔드포인트

- `POST /api/b/analyze/contract` — 계약서 부당 조항 탐지
- `POST /api/b/generate/message` — 환불 요청 문구 3종 (카카오톡용 / 이메일용 / 강경대응용)
- `GET  /api/b/health` — 백엔드 헬스체크 (입력 화면 하단에 표시)

### 동작 방식

1. 사용자가 입력폼 제출 → `computeRefund` 로 환불금/위약금/차이 계산 (로컬)
2. `vendorPolicyText` 가 있으면 `analyzeContract` 호출 (AI 분석)
3. `generateMessage` 호출 (AI 문구 3종)
4. 둘 중 하나라도 실패하면 **자동으로 임시 로직으로 폴백**
5. 결과 화면에서 `요청 문구 유형` 토글 시 AI 결과가 있으면 AI 텍스트, 없으면 임시 텍스트 표시

### 백엔드 주소 설정

루트에 `.env` 파일 만들고 (예시: `.env.example` 복사):

```
VITE_API_BASE_URL=http://localhost:8000
```

배포 환경(Railway 등)으로 바꿀 때는 이 값만 교체하면 됩니다.

### 로컬 통합 테스트

별도 터미널에서:

```powershell
cd ..\backend-b
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python setup.py        # Groq API 키 입력 (gsk_...)
uvicorn main:app --reload
```

그 뒤 프론트(`npm run dev`)로 돌아가서 사용하면 됩니다.
입력 화면 하단에 `AI 백엔드에 연결됨` 표시가 뜨면 성공.

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
