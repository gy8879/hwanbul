import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeContract, checkHealth, generateMessage } from './api'
import { extractText } from './pdf'
import { DISPUTE_DOCS, openPrintWindow } from './disputeDocs'
import heroDumbbell from './assets/hero-dumbbell.png'
import heroClipboard from './assets/hero-clipboard.png'
import heroEnvelope from './assets/hero-envelope.png'

const INDUSTRIES = [
  {
    value: 'gym',
    label: '헬스장',
    refundLaw: '체육시설업법 및 방문판매법, 소비자분쟁해결기준',
    penaltyCapNote: '체육시설업법상 위약금은 총금액의 10% 이내로 제한됩니다.',
    typicalTraps: ['이벤트가 결제 후 정상가 기준 환불 산정', 'PT 끼워팔기 회차 분리'],
  },
  {
    value: 'pilates',
    label: '필라테스',
    refundLaw: '방문판매법 및 소비자분쟁해결기준',
    penaltyCapNote: '위약금은 일반적으로 잔여 대금의 10% 이내로 안내됩니다.',
    typicalTraps: ['그룹/개인 회차 혼합 가격 분리', '이벤트가 결제 후 정상가 환불 산정'],
  },
  {
    value: 'yoga',
    label: '요가',
    refundLaw: '방문판매법 및 소비자분쟁해결기준',
    penaltyCapNote: '위약금은 일반적으로 잔여 대금의 10% 이내로 안내됩니다.',
    typicalTraps: ['이벤트가 결제 후 정상가 환불 산정', '회차권 미사용분 환불 거부'],
  },
  {
    value: 'academy',
    label: '학원·과외',
    refundLaw: '학원의 설립·운영 및 과외교습에 관한 법률 시행령 제18조',
    penaltyCapNote: '학원법 시행령상 수강료는 미경과 기간에 대해 일할 환불이 원칙입니다.',
    typicalTraps: ['교재비·관리비 환불 거부', '월 단위 절상 환불'],
  },
  {
    value: 'skincare',
    label: '피부·미용 시술권',
    refundLaw: '방문판매법 및 소비자분쟁해결기준',
    penaltyCapNote:
      '회차권은 미사용 회차에 대해 환불 가능하며, 이벤트가 적용 시에도 결제 금액 기준으로 환불 산정하는 것이 일반적입니다.',
    typicalTraps: ['미사용 회차 환불 거부', '정상가 기준 환산으로 환불액 축소'],
  },
]

const REQUEST_TYPES = [
  { value: 'kakao', label: '카톡용', apiKey: '카카오톡용' },
  { value: 'email', label: '이메일용', apiKey: '이메일용' },
  { value: 'strong', label: '정식 요청', apiKey: '강경대응용' },
]

const WARNING_KEYWORDS = [
  '환불 불가',
  '환급 불가',
  '취소 불가',
  '양도만 가능',
  '정상가 기준',
  '이벤트가',
  '할인가',
  '위약금',
  '소멸',
]

const NAV_ITEMS = ['주요기능', '사용해보기', '요금', '성공사례', '고객지원']

const FEATURE_CARDS = [
  {
    tag: '01 / 상황 입력',
    title: '계약 정보를 그대로 붙여넣기',
    desc: '업종, 결제금액, 이용기간. 계약서 사진·PDF도 자동으로 텍스트만 뽑아 채워넣어요.',
  },
  {
    tag: '02 / 함정까지 계산',
    title: '단순 일할이 아닌, 실제 분쟁 케이스로',
    desc:
      '이벤트가/정상가 환산, 회차권 미사용분, 위약금 10% 상한 등 일반 계산기가 못 잡는 함정을 자동으로 짚어줘요.',
  },
  {
    tag: '03 / 분쟁 서류 패키지',
    title: '업체가 거부하면 다음 무기까지',
    desc:
      '환불 요청 문구는 무료. 결제하면 내용증명 · 소비자원 1372 신청서 · 카드 항변권 행사 신청서까지 본인 명의로 바로 발송 가능한 양식으로 발급해드려요.',
  },
]

const initialForm = {
  industry: '',
  vendorName: '',
  totalPaid: '',
  originalPrice: '',
  contractDays: '',
  usedDays: '',
  vendorRefund: '',
  vendorPenalty: '',
  vendorPolicyText: '',
  refundReason: '',
  requestType: 'kakao',
  userName: '',
  paymentMethod: 'card',
}

function parseAmount(raw) {
  if (raw == null || raw === '') return NaN
  const n = Number(String(raw).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : NaN
}

function formatWon(value) {
  const rounded = Math.round(value)
  return `${rounded.toLocaleString('ko-KR')}원`
}

function findWarnings(text) {
  if (!text) return []
  return WARNING_KEYWORDS.filter((kw) => text.includes(kw))
}

function computeRefund(form) {
  const totalPaid = parseAmount(form.totalPaid)
  const originalPrice = parseAmount(form.originalPrice)
  const contractDays = parseAmount(form.contractDays)
  const usedDays = parseAmount(form.usedDays)
  const vendorRefund = parseAmount(form.vendorRefund)
  const vendorPenaltyInput = parseAmount(form.vendorPenalty)

  if (!Number.isFinite(totalPaid) || totalPaid <= 0) {
    return { ok: false, message: '총 결제금액을 올바르게 입력해주세요.' }
  }
  if (!Number.isFinite(contractDays) || contractDays <= 0) {
    return { ok: false, message: '전체 계약기간(일)을 0보다 크게 입력해주세요.' }
  }
  if (!Number.isFinite(usedDays) || usedDays < 0) {
    return { ok: false, message: '실제 이용기간(일)을 올바르게 입력해주세요.' }
  }

  const ratio = Math.min(Math.max(usedDays / contractDays, 0), 1)
  const usageFee = totalPaid * ratio
  const penaltyCap = totalPaid * 0.1
  const penalty =
    Number.isFinite(vendorPenaltyInput) && vendorPenaltyInput > 0
      ? vendorPenaltyInput
      : penaltyCap
  const expectedRefund = Math.max(totalPaid - usageFee - penalty, 0)
  const vendorGuided = Number.isFinite(vendorRefund) && vendorRefund >= 0 ? vendorRefund : 0
  const diff = expectedRefund - vendorGuided
  const warnings = findWarnings(form.vendorPolicyText)

  const usageFeeIfOriginal =
    Number.isFinite(originalPrice) && originalPrice > totalPaid
      ? originalPrice * ratio
      : null
  const expectedRefundIfOriginal =
    usageFeeIfOriginal != null
      ? Math.max(totalPaid - usageFeeIfOriginal - penalty, 0)
      : null

  const flags = []

  if (
    Number.isFinite(vendorPenaltyInput) &&
    vendorPenaltyInput > 0 &&
    vendorPenaltyInput > penaltyCap
  ) {
    flags.push({
      id: 'penalty_over_cap',
      severity: 'high',
      title: '위약금이 총금액의 10%를 초과해요',
      body: `업체 안내 위약금 ${formatWon(vendorPenaltyInput)}은 총 결제금액의 10%(${formatWon(penaltyCap)})를 초과합니다. 체육시설업법·소비자분쟁해결기준상 일반적으로 다투어지는 표현입니다.`,
    })
  }

  if (usageFeeIfOriginal != null && expectedRefundIfOriginal != null) {
    flags.push({
      id: 'event_vs_original',
      severity: 'high',
      title: '이벤트가 / 정상가 환산 차이',
      body: `정상가 ${formatWon(originalPrice)} 기준으로 위약금을 산정하면 환불액이 ${formatWon(expectedRefundIfOriginal)}로 줄어듭니다. 결제 기준가(${formatWon(totalPaid)})로 환불을 산정하는 것이 일반적으로 안내됩니다.`,
    })
  }

  if (vendorGuided > 0 && expectedRefund - vendorGuided > totalPaid * 0.1) {
    flags.push({
      id: 'vendor_underpay',
      severity: 'mid',
      title: '업체 안내 금액이 표준보다 낮아요',
      body: `표준 기준 예상 환불금 ${formatWon(expectedRefund)}과 업체 안내 ${formatWon(vendorGuided)} 차이가 ${formatWon(expectedRefund - vendorGuided)}로 큽니다. 근거 자료를 요청해보시는 것을 권장합니다.`,
    })
  }

  return {
    ok: true,
    totalPaid,
    originalPrice: Number.isFinite(originalPrice) ? originalPrice : null,
    usageFee,
    penalty,
    penaltyCap,
    expectedRefund,
    vendorGuided,
    diff,
    warnings,
    flags,
    expectedRefundIfOriginal,
  }
}

function buildRequestMessage(form, calc, industryLabel) {
  const type = form.requestType
  const reason = form.refundReason.trim() || '(사유 미입력)'
  const expected = formatWon(calc.expectedRefund)
  const diffLine =
    calc.diff === 0
      ? '업체 안내 환불금과 비교해 차이는 없었어요.'
      : calc.diff > 0
        ? `제가 계산한 예상 환불금은 ${expected}로, 안내해주신 금액보다 ${formatWon(Math.abs(calc.diff))} 더 높게 산출됐어요.`
        : `제가 계산한 예상 환불금은 ${expected}로, 안내해주신 금액보다 ${formatWon(Math.abs(calc.diff))} 더 낮게 산출됐어요.`

  if (type === 'kakao') {
    return [
      `안녕하세요. ${industryLabel} 중도해지 관련 문의드려요.`,
      '',
      `환불 사유: ${reason}`,
      '',
      `예상 환불금은 ${expected} 정도로 계산됐는데, ${diffLine}`,
      '',
      '환불 절차와 금액 확인 부탁드립니다.',
    ].join('\n')
  }

  if (type === 'sms') {
    return `[${industryLabel} 환불문의] 사유:${reason} 예상환불:${expected} 안내금액과 차이 확인 요청드립니다.`
  }

  return [
    '제목: 중도해지 환불 금액 문의',
    '',
    '안녕하세요.',
    '',
    `${industryLabel} 계약 중도해지에 따른 환불을 요청드립니다.`,
    '',
    `- 환불 사유: ${reason}`,
    `- 예상 환불금(자체 계산): ${expected}`,
    `- 안내 환불금과의 차이: ${formatWon(calc.diff)}`,
    '',
    diffLine,
    '',
    '검토 후 회신 부탁드립니다.',
  ].join('\n')
}

const PRICE_WON = 2900
const PAID_STORAGE_KEY = 'rh_paid_v1'

function PricingModal({ open, onClose, onPurchase, paid }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[var(--mint-light)] px-6 py-5">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/70 px-3 py-1 text-[12px] font-bold text-[#0d3d24]">
              1회 결제
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-[#0d3d24]/60 hover:bg-white/40"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
          <p className="mt-4 text-[14px] font-semibold text-[#0d3d24]">
            AI 맞춤 분석 · 작성 리포트
          </p>
          <p className="mt-1 text-[32px] font-black tabular-nums text-[#0d3d24]">
            {PRICE_WON.toLocaleString('ko-KR')}원
          </p>
          <p className="mt-1 text-[12px] text-[#0d3d24]/80">
            1회 결제, 이번 세션 동안 AI 기능 모두 사용
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-2xl bg-[var(--bg-main)] p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--text-sub)]">
              무료로 제공돼요
            </p>
            <ul className="mt-2 space-y-1.5 text-[13px] text-[var(--text-main)]">
              <li>· 환불금 / 위약금 / 업체 안내와의 차이 계산</li>
              <li>· 이벤트가·정상가 환산, 위약금 10% 상한 함정 자동 진단</li>
              <li>· 카톡 · 이메일 · 정식 요청 기본 템플릿 문구</li>
              <li>· 계약서 PDF · 사진 자동 텍스트 추출</li>
            </ul>
          </div>

          <div className="mt-3 rounded-2xl border border-[var(--mint-main)] bg-[var(--mint-light)]/30 p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#0d3d24]">
              결제하면 추가돼요 — 분쟁 서류 패키지
            </p>
            <ul className="mt-2 space-y-1.5 text-[13px] text-[var(--text-main)]">
              <li>· <strong>환불 요청 내용증명</strong> 양식 (등기 우편 그대로 송부 가능)</li>
              <li>· <strong>한국소비자원 1372 분쟁조정 신청서</strong> 양식</li>
              <li>· <strong>카드 할부거래 항변권 행사 신청서</strong> 양식</li>
              <li>· 약관·상황을 반영한 <strong>AI 맞춤 요청 문구</strong> (세 채널 모두)</li>
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-[#0d3d24]/80">
              ※ 모든 양식은 <strong>본인 명의로 본인이 직접 송부</strong>하시는 보조 양식입니다. 본 서비스는 양식 작성을 도와드릴 뿐, 신고·발송을 대리하지 않습니다.
            </p>
          </div>

          <p className="mt-4 text-[12px] leading-relaxed text-[var(--text-sub)]">
            ※ 본 결제는 「양식 작성 보조 · 정보 안내」 서비스 이용료입니다. 법률 자문
            보수가 아닙니다.
          </p>

          {paid ? (
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-2xl bg-[var(--mint-main)] py-3.5 text-[15px] font-bold text-[#0d3d24]"
            >
              이미 결제됨 — 닫기
            </button>
          ) : (
            <button
              type="button"
              onClick={onPurchase}
              className="mt-5 w-full rounded-2xl bg-[var(--mint-main)] py-3.5 text-[15px] font-bold text-[#0d3d24] shadow-sm transition hover:brightness-[1.03]"
            >
              {PRICE_WON.toLocaleString('ko-KR')}원 결제하기
            </button>
          )}
          <p className="mt-2 text-center text-[11px] text-[var(--text-sub)]">
            ※ 현재 데모 결제입니다. 실제 PG 연동 전 단계예요.
          </p>
        </div>
      </div>
    </div>
  )
}

function LockedCard({ title, onUnlock }) {
  return (
    <div className="relative mt-5 overflow-hidden rounded-3xl border border-black/[0.06] bg-white">
      <div className="select-none p-5 blur-[6px]">
        <p className="text-[15px] font-bold text-[var(--text-main)]">{title}</p>
        <p className="mt-2 text-[13px] text-[var(--text-sub)]">
          잠금된 미리보기 내용입니다. 결제하시면 바로 확인할 수 있어요. 잠금된
          미리보기 내용입니다. 결제하시면 바로 확인할 수 있어요. 잠금된 미리보기
          내용입니다.
        </p>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/30 backdrop-blur-[1px]">
        <span className="rounded-full bg-black/80 px-3 py-1 text-[12px] font-bold text-white">
          🔒 잠금
        </span>
        <p className="text-[14px] font-semibold text-[var(--text-main)]">{title}</p>
        <button
          type="button"
          onClick={onUnlock}
          className="mt-1 rounded-full bg-[var(--mint-main)] px-5 py-2 text-[13px] font-bold text-[#0d3d24] shadow-sm"
        >
          {PRICE_WON.toLocaleString('ko-KR')}원으로 잠금 해제
        </button>
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-[12px] font-bold text-[var(--mint-main)]">
        rh
      </span>
      <span className="text-[18px] font-extrabold tracking-tight text-[var(--text-main)]">
        환불히어로
      </span>
    </div>
  )
}

function TopBanner({ onClose }) {
  return (
    <div className="w-full bg-[#0c0f14] text-white">
      <div className="relative mx-auto flex max-w-6xl items-center justify-center gap-4 px-6 py-3 text-center">
        <button
          type="button"
          className="hidden h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 sm:flex"
          aria-label="이전"
        >
          ‹
        </button>
        <div className="flex flex-col items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mint-main)] px-3 py-1 text-[11px] font-bold text-[#0d3d24]">
            1분 환불 정리
          </span>
          <p className="text-[13px] text-white/70">
            받을 금액 계산 · 보낼 문구 · 분쟁 서류까지 한 번에
          </p>
          <p className="text-[14px] font-semibold text-white">
            양심 업체든 부당 업체든 — 정확한 숫자 한 장이면 끝
          </p>
        </div>
        <button
          type="button"
          className="hidden h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 sm:flex"
          aria-label="다음"
        >
          ›
        </button>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 transition hover:text-white"
          aria-label="배너 닫기"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function NavBar({ onStart, onOpenPricing }) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-black/[0.04] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-[15px] font-medium text-[var(--text-main)]/80 md:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={item === '요금' ? onOpenPricing : undefined}
              className="transition hover:text-[var(--text-main)]"
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hidden rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[14px] font-semibold text-[var(--text-main)] transition hover:bg-[var(--bg-main)] sm:inline-flex"
          >
            로그인
          </button>
          <button
            type="button"
            onClick={onStart}
            className="rounded-full bg-black px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-black/80"
          >
            지금 계산하기
          </button>
        </div>
      </div>
    </header>
  )
}

function Hero({ onStart, onOpenHowItWorks }) {
  return (
    <section className="relative mx-auto max-w-6xl overflow-visible px-6 pt-16 pb-20 text-center sm:pt-24 sm:pb-28 lg:pt-28 lg:pb-32">
      {/* 큼직한 3D 아이콘 — 본문 뒤(z-0)에 겹쳐 배치. 살짝 화면 밖으로 흘려 비대칭 + 시각 무게 */}
      <img
        src={heroDumbbell}
        alt=""
        aria-hidden="true"
        className="hero-asset-img float-slow pointer-events-none absolute left-0 top-0 z-0 w-[15rem] -translate-x-[16%] select-none sm:top-4 sm:w-[22rem] sm:-translate-x-[14%] md:w-[28rem] md:-translate-x-[12%] lg:top-6 lg:w-[34rem] lg:-translate-x-[10%] xl:w-[40rem] xl:-translate-x-[8%]"
        style={{
          '--rot': '-3deg',
          filter: 'drop-shadow(0 36px 44px rgba(45, 100, 70, 0.18))',
          opacity: 1,
        }}
      />
      <img
        src={heroEnvelope}
        alt=""
        aria-hidden="true"
        className="hero-asset-img float-fast pointer-events-none absolute right-0 top-2 z-0 w-[9rem] translate-x-[12%] select-none sm:top-6 sm:w-[14rem] sm:translate-x-[10%] md:w-[18rem] md:translate-x-[8%] lg:top-10 lg:w-[22rem] lg:translate-x-[6%] xl:w-[26rem] xl:translate-x-[4%]"
        style={{
          '--rot': '4deg',
          filter: 'drop-shadow(0 30px 38px rgba(80, 130, 100, 0.2))',
          opacity: 1,
        }}
      />
      <span
        aria-hidden="true"
        className="hero-clipboard-tilt pointer-events-none absolute right-0 bottom-0 z-0 block w-[16rem] translate-x-[14%] translate-y-[8%] sm:w-[24rem] sm:translate-x-[12%] sm:translate-y-[6%] md:w-[30rem] md:translate-x-[10%] md:translate-y-[5%] lg:w-[36rem] lg:translate-x-[8%] lg:translate-y-[4%] xl:w-[42rem] xl:translate-x-[6%]"
      >
        <img
          src={heroClipboard}
          alt=""
          aria-hidden="true"
          className="hero-asset-img float-inv h-auto w-full select-none"
          style={{
            '--rot': '0deg',
            filter: 'drop-shadow(0 38px 46px rgba(80, 130, 100, 0.2))',
            opacity: 1,
          }}
        />
      </span>

      <div className="relative z-10 mx-auto max-w-3xl">

      <p className="text-[14px] font-medium tracking-wide text-[var(--text-sub)]">
        Refund AI for memberships & subscriptions
      </p>
      <h1 className="mt-6 text-[44px] font-black leading-[1.05] tracking-tight text-[var(--text-main)] sm:text-[80px]">
        <span className="inline-flex flex-wrap justify-center gap-x-6">
          <span className="opacity-50">30분 고민</span>
          <span>1분이면 끝</span>
        </span>
        <br />
        <span className="opacity-50">감정싸움 없이</span>
      </h1>
      <p className="mx-auto mt-8 max-w-xl text-[16px] leading-relaxed text-[var(--text-sub)] sm:text-[18px]">
        헬스·필라테스·요가·학원·시술권 — 멤버십 환불을 한 번에 정리하세요.
        <br className="hidden sm:block" />
        업체가 거부해도 내용증명·소비자원 신청서·카드 항변권까지 그대로 준비돼요.
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onStart}
          className="rounded-full bg-[var(--mint-main)] px-7 py-3.5 text-[16px] font-bold text-[#0d3d24] shadow-sm transition hover:brightness-[1.03]"
        >
          1분 환불 정리 시작
        </button>
        <button
          type="button"
          onClick={onOpenHowItWorks}
          className="rounded-full border border-black/[0.08] bg-white px-7 py-3.5 text-[16px] font-semibold text-[var(--text-main)] transition hover:bg-[var(--bg-main)]"
        >
          어떻게 동작하나요
        </button>
      </div>

      </div>
    </section>
  )
}

function FeatureSection({ onStart }) {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.18)] sm:p-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-[11px] font-bold text-[var(--mint-main)]">
              rh
            </span>
            <span className="text-[15px] font-bold text-[var(--text-main)]">
              환불히어로 AI
            </span>
          </div>
          <span className="text-[13px] font-medium text-[var(--text-sub)]">
            {FEATURE_CARDS[0].tag}
          </span>
        </div>
        <p className="mt-6 text-[18px] font-semibold leading-relaxed text-[var(--text-main)] sm:text-[22px]">
          30분 고민하던 환불, 1분이면 끝나요. 계산기·문구 작성·분쟁 증빙을
          AI 한 번에 정리해 드려요. 양심적인 업체에서도 정확한 숫자가 더 빠른 합의를
          만들어요.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FEATURE_CARDS.map((card) => (
            <div
              key={card.tag}
              className="rounded-2xl bg-[var(--bg-main)] p-5"
            >
              <p className="text-[12px] font-bold tracking-wide text-[var(--text-sub)]">
                {card.tag}
              </p>
              <p className="mt-2 text-[15px] font-bold text-[var(--text-main)]">
                {card.title}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-sub)]">
                {card.desc}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={onStart}
            className="rounded-full bg-[var(--mint-main)] px-6 py-3 text-[15px] font-bold text-[#0d3d24] transition hover:brightness-[1.03]"
          >
            바로 계산해보기
          </button>
        </div>
      </div>
    </section>
  )
}

function HowItWorksModal({ open, onClose, onStart }) {
  if (!open) return null
  const steps = [
    {
      n: '1',
      title: '정보 입력 (무료)',
      body: '업종, 결제 금액, 약정·사용 기간, 업체 안내 금액을 넣어요. 계약서 PDF나 사진을 올리면 텍스트를 자동으로 채워줘요.',
    },
    {
      n: '2',
      title: '예상 환불 + 함정 진단 (무료)',
      body: '받을 금액·위약금·업체 안내와의 차이를 표준 기준으로 계산해요. 이벤트가/정상가, 위약금 10% 상한 같은 함정도 자동으로 짚어드려요.',
    },
    {
      n: '3',
      title: '환불 요청 문구 (무료)',
      body: '카톡·이메일·정식 요청 세 채널 모두 기본 템플릿 문구로 복사할 수 있어요. 결제하면 약관·상황을 반영한 AI 맞춤 문구로 자동 교체돼요.',
    },
    {
      n: '4',
      title: '분쟁 서류 패키지 (유료)',
      body: '업체가 거부하면? 본인 명의로 바로 보낼 수 있는 내용증명·한국소비자원 1372 분쟁조정 신청서·카드 할부 항변권 행사 신청서 양식을 발급해드려요.',
    },
  ]
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-extrabold tracking-tight text-[var(--text-main)]">
              어떻게 동작하나요?
            </h2>
            <p className="mt-1 text-[14px] text-[var(--text-sub)]">
              4단계면 끝나요. 복잡한 법률 용어 없이 숫자와 문구만 정리해 드려요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-[var(--text-sub)] hover:bg-[var(--bg-main)]"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <ol className="mt-6 space-y-3">
          {steps.map((s) => (
            <li
              key={s.n}
              className="flex gap-3 rounded-2xl border border-black/[0.06] bg-[var(--bg-main)] p-4 text-left"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--mint-main)] text-[15px] font-black text-[#0d3d24]">
                {s.n}
              </span>
              <div>
                <p className="text-[15px] font-bold text-[var(--text-main)]">{s.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-sub)]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-[12px] leading-relaxed text-[var(--text-sub)]">
          본 서비스는 법률 자문이 아닌 계산·정보 안내 도구입니다. 분쟁이 크면 한국소비자원(1372) 상담을 권장드려요.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-row-reverse sm:justify-start">
          <button
            type="button"
            onClick={() => {
              onClose()
              onStart()
            }}
            className="w-full rounded-2xl bg-[var(--mint-main)] py-3.5 text-[15px] font-bold text-[#0d3d24] sm:w-auto sm:min-w-[12rem]"
          >
            1분 환불 정리 시작
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-black/[0.08] bg-white py-3.5 text-[15px] font-semibold text-[var(--text-main)] sm:w-auto sm:min-w-[7rem]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

function Landing({
  onStart,
  bannerOpen,
  setBannerOpen,
  onOpenTerms,
  onOpenPricing,
  onOpenHowItWorks,
}) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-white">
      {bannerOpen ? <TopBanner onClose={() => setBannerOpen(false)} /> : null}
      <NavBar onStart={onStart} onOpenPricing={onOpenPricing} />
      <Hero onStart={onStart} onOpenHowItWorks={onOpenHowItWorks} />
      <FeatureSection onStart={onStart} />
      <Footer onOpenTerms={onOpenTerms} onOpenPricing={onOpenPricing} />
    </div>
  )
}

function Footer({ onOpenTerms, onOpenPricing }) {
  return (
    <footer className="border-t border-black/[0.04] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-8 text-[12px] leading-relaxed text-[var(--text-sub)]">
        <p>
          본 서비스는 <strong>법률 자문이 아닌 계산·정보 안내 도구</strong>입니다.
          공정거래위원회 「소비자분쟁해결기준」을 참고한 일반 정보를 제공할 뿐,
          구체적인 사건에 대한 법률 판단을 제공하지 않습니다.
        </p>
        <p className="mt-2">
          구체적인 분쟁이 있다면 <strong>한국소비자원(국번없이 1372)</strong> 상담
          또는 변호사 상담을 권장드립니다.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onOpenTerms}
            className="font-semibold text-[var(--text-main)] underline-offset-2 hover:underline"
          >
            이용약관·면책고지
          </button>
          {onOpenPricing ? (
            <button
              type="button"
              onClick={onOpenPricing}
              className="font-semibold text-[var(--text-main)] underline-offset-2 hover:underline"
            >
              요금 안내
            </button>
          ) : null}
          <span>© 환불히어로</span>
        </div>
      </div>
    </footer>
  )
}

function TermsModal({ open, onClose }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-extrabold tracking-tight text-[var(--text-main)]">
            이용약관 · 면책고지
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--text-sub)] hover:bg-[var(--bg-main)]"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-5 text-[14px] leading-relaxed text-[var(--text-main)]">
          <section>
            <h3 className="text-[15px] font-bold">1. 서비스의 성격</h3>
            <p className="mt-1 text-[var(--text-sub)]">
              「환불히어로」(이하 “본 서비스”)는 사용자가 입력한 정보를 바탕으로
              일반적인 환불 금액 계산과 환불 요청 문구 정리를 도와주는{' '}
              <strong>정보 안내·문서 작성 보조 도구</strong>입니다. 변호사법 제3조에
              따른 법률사무를 수행하지 않으며, 어떠한 형태의 법률 자문, 법령 적용
              판단, 분쟁 대리도 제공하지 않습니다.
            </p>
          </section>

          <section>
            <h3 className="text-[15px] font-bold">2. 정보의 한계</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--text-sub)]">
              <li>
                본 서비스의 계산 결과는 공정거래위원회 「소비자분쟁해결기준」 등
                공개 자료를 참고한 일반적인 산출치이며, 개별 계약 조건·약관에 따라
                실제 환불액과 차이가 있을 수 있습니다.
              </li>
              <li>
                AI가 표시하는 “자주 분쟁이 되는 표현” 안내는 일반적인 정보이며,
                특정 약관 조항의 적법성·유효성에 대한 판단이 아닙니다.
              </li>
              <li>
                안내된 문구는 사용자가 직접 송부하기 위한 작성 예시이며, 회사가
                당사자를 대리해 분쟁을 처리하지 않습니다.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-[15px] font-bold">3. 권장 절차</h3>
            <p className="mt-1 text-[var(--text-sub)]">
              구체적인 분쟁이 발생한 경우 <strong>한국소비자원(1372)</strong>{' '}
              또는 변호사 상담을 우선 권장드립니다. 본 서비스는 그러한 상담·신고
              이전 단계에서 사용자가 스스로 상황을 정리하도록 돕는 데 목적이 있습니다.
            </p>
          </section>

          <section>
            <h3 className="text-[15px] font-bold">4. 책임의 제한</h3>
            <p className="mt-1 text-[var(--text-sub)]">
              회사는 본 서비스의 정보·문구를 신뢰함으로 인해 사용자가 입게 된 직간접
              손해에 대하여 책임을 지지 않습니다. 본 서비스 이용 결과의 최종적인
              판단과 책임은 사용자 본인에게 있습니다.
            </p>
          </section>

          <section>
            <h3 className="text-[15px] font-bold">5. 결제·환불</h3>
            <p className="mt-1 text-[var(--text-sub)]">
              유료 기능 결제는 “환불 계산 리포트 발급” 및 “문서 작성 보조” 등 서비스
              이용료이며, 법률 자문 보수가 아닙니다. 결제·환불 정책은 별도 안내에
              따릅니다.
            </p>
          </section>

          <section>
            <h3 className="text-[15px] font-bold">6. 입력 정보 처리</h3>
            <p className="mt-1 text-[var(--text-sub)]">
              사용자가 입력한 약관 텍스트·금액 등은 응답 생성을 위해 외부 AI
              모델(예: Groq)에 일시 전송될 수 있으며, 회사는 개인식별이 가능한 정보를
              저장·학습에 활용하지 않습니다.
            </p>
          </section>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-[var(--mint-main)] py-3.5 text-[15px] font-bold text-[#0d3d24]"
        >
          확인했어요
        </button>
      </div>
    </div>
  )
}

function PageShell({ children, onHome, onOpenTerms, onOpenPricing }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg-main)]">
      <header className="sticky top-0 z-20 w-full border-b border-black/[0.04] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4 md:max-w-2xl">
          <button type="button" onClick={onHome} className="flex items-center gap-2">
            <Logo />
          </button>
          <button
            type="button"
            onClick={onHome}
            className="text-[13px] font-semibold text-[var(--text-sub)]"
          >
            처음으로
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-14 pt-8 md:max-w-2xl">
        {children}
      </main>
      <Footer onOpenTerms={onOpenTerms} onOpenPricing={onOpenPricing} />
    </div>
  )
}

function Card({ className = '', children }) {
  return (
    <div
      className={`rounded-3xl border border-black/[0.04] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ${className}`}
    >
      {children}
    </div>
  )
}

function FieldLabel({ children, optional }) {
  return (
    <label className="mb-1.5 block text-[15px] font-semibold text-[var(--text-main)]">
      {children}
      {optional ? (
        <span className="ml-1 text-[13px] font-normal text-[var(--text-sub)]">(선택)</span>
      ) : null}
    </label>
  )
}

function TextInput(props) {
  const { className = '', ...rest } = props
  return (
    <input
      {...rest}
      className={`w-full rounded-2xl border border-black/[0.06] bg-[var(--bg-main)] px-4 py-3.5 text-[16px] text-[var(--text-main)] outline-none ring-[var(--mint-main)] transition placeholder:text-[var(--text-sub)] focus:border-[var(--mint-main)] focus:bg-white focus:ring-2 ${className}`}
    />
  )
}

function SelectInput(props) {
  const { className = '', children, ...rest } = props
  return (
    <select
      {...rest}
      className={`w-full appearance-none rounded-2xl border border-black/[0.06] bg-[var(--bg-main)] px-4 py-3.5 text-[16px] text-[var(--text-main)] outline-none ring-[var(--mint-main)] transition focus:border-[var(--mint-main)] focus:bg-white focus:ring-2 ${className}`}
    >
      {children}
    </select>
  )
}

function PrimaryButton({ children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className="w-full rounded-2xl bg-[var(--mint-main)] py-4 text-[17px] font-semibold text-[#0d3d24] shadow-sm transition enabled:active:scale-[0.99] enabled:hover:brightness-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function GhostButton({ children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className="w-full rounded-2xl border border-black/[0.08] bg-white py-3.5 text-[15px] font-semibold text-[var(--text-main)] transition hover:bg-[var(--bg-main)]"
    >
      {children}
    </button>
  )
}

export default function App() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [bannerOpen, setBannerOpen] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [backendOnline, setBackendOnline] = useState(null)
  const [termsOpen, setTermsOpen] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const [paid, setPaid] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.sessionStorage.getItem(PAID_STORAGE_KEY) === '1'
  })
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfStatus, setPdfStatus] = useState('')
  const [pdfProgress, setPdfProgress] = useState(0)
  const [pdfError, setPdfError] = useState('')
  const [pdfFileName, setPdfFileName] = useState('')
  const pdfInputRef = useRef(null)

  async function handlePdfUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfError('')
    setPdfFileName(file.name)
    setPdfLoading(true)
    setPdfStatus('파일 분석 중...')
    setPdfProgress(0)
    try {
      const text = await extractText(file, {
        onStatus: (s) => setPdfStatus(s),
        onProgress: (p) => setPdfProgress(p),
      })
      if (!text) {
        setPdfError('파일에서 텍스트를 찾지 못했어요. 다른 파일로 시도해주세요.')
      } else {
        const existing = form.vendorPolicyText.trim()
        const next = existing ? `${existing}\n\n${text}` : text
        setForm((prev) => ({ ...prev, vendorPolicyText: next }))
      }
    } catch (err) {
      console.error(err)
      setPdfError(err.message || '파일을 읽지 못했어요. 다른 파일로 시도해주세요.')
    } finally {
      setPdfLoading(false)
      setPdfStatus('')
      setPdfProgress(0)
      e.target.value = ''
    }
  }

  function clearPdfFile() {
    setPdfFileName('')
    setPdfError('')
  }

  function purchase() {
    setPaid(true)
    try {
      window.sessionStorage.setItem(PAID_STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setPricingOpen(false)
  }

  useEffect(() => {
    const ctrl = new AbortController()
    checkHealth(ctrl.signal).then(setBackendOnline)
    return () => ctrl.abort()
  }, [])

  const industryLabel = useMemo(() => {
    return INDUSTRIES.find((i) => i.value === form.industry)?.label ?? '해당 업종'
  }, [form.industry])

  const requestMessage = useMemo(() => {
    if (!result?.calc?.ok) return ''
    const apiKey = REQUEST_TYPES.find((t) => t.value === form.requestType)?.apiKey
    const aiText = apiKey ? result.aiMessages?.[apiKey] : null
    if (aiText) return aiText
    return buildRequestMessage(form, result.calc, industryLabel)
  }, [form, result, industryLabel])

  const messageSource = result?.aiMessages
    ? REQUEST_TYPES.find((t) => t.value === form.requestType)?.apiKey &&
      result.aiMessages[
        REQUEST_TYPES.find((t) => t.value === form.requestType)?.apiKey
      ]
      ? 'ai'
      : 'local'
    : 'local'

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function goStep2() {
    setError('')
    setStep(2)
  }

  async function submitForm() {
    setError('')
    if (!form.industry) {
      setError('업종을 선택해주세요.')
      return
    }
    const calc = computeRefund(form)
    if (!calc.ok) {
      setError(calc.message)
      return
    }

    setSubmitting(true)
    const label =
      INDUSTRIES.find((i) => i.value === form.industry)?.label ?? '해당 업종'

    const tasks = []
    if (form.vendorPolicyText.trim()) {
      tasks.push(
        analyzeContract({
          contractText: form.vendorPolicyText,
          industryLabel: label,
        }).catch(() => null),
      )
    } else {
      tasks.push(Promise.resolve(null))
    }
    tasks.push(
      generateMessage({
        industryLabel: label,
        vendorName: form.vendorName,
        totalPaid: calc.totalPaid,
        usedDays: parseAmount(form.usedDays) || 0,
        expectedRefund: calc.expectedRefund,
        penalty: calc.penalty,
      }).catch(() => null),
    )

    const [analysis, aiMessages] = await Promise.all(tasks)
    setResult({ calc, analysis, aiMessages })
    setSubmitting(false)
    setCopied(false)
    setStep(3)
  }

  function resetAll() {
    setForm(initialForm)
    setResult(null)
    setError('')
    setCopied(false)
    setStep(1)
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(requestMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const diffCopy =
    result?.calc?.ok &&
    (() => {
      const d = result.calc.diff
      if (d === 0) return '업체 안내 금액과 비슷하게 계산됐어요.'
      if (d > 0)
        return `업체 안내 금액보다 ${formatWon(Math.abs(d))} 더 높게 계산됐어요.`
      return `업체 안내 금액보다 ${formatWon(Math.abs(d))} 더 낮게 계산됐어요.`
    })()

  if (step === 1) {
    return (
      <>
        <Landing
          onStart={goStep2}
          bannerOpen={bannerOpen}
          setBannerOpen={setBannerOpen}
          onOpenTerms={() => setTermsOpen(true)}
          onOpenPricing={() => setPricingOpen(true)}
          onOpenHowItWorks={() => setHowItWorksOpen(true)}
        />
        <HowItWorksModal
          open={howItWorksOpen}
          onClose={() => setHowItWorksOpen(false)}
          onStart={goStep2}
        />
        <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
        <PricingModal
          open={pricingOpen}
          onClose={() => setPricingOpen(false)}
          onPurchase={purchase}
          paid={paid}
        />
      </>
    )
  }

  if (step === 2) {
    return (
      <PageShell
        onHome={resetAll}
        onOpenTerms={() => setTermsOpen(true)}
        onOpenPricing={() => setPricingOpen(true)}
      >
        <button
          type="button"
          onClick={() => {
            setError('')
            setStep(1)
          }}
          className="mb-6 text-[15px] font-semibold text-[var(--text-sub)]"
        >
          ← 뒤로
        </button>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[var(--text-main)]">
          환불 정보를 입력해주세요
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-sub)]">
          정확하지 않아도 괜찮아요.
          <br />
          알고 있는 금액과 기간만 입력하면 예상 환불금을 계산해드려요.
        </p>

        <Card className="mt-8 space-y-5">
          <div>
            <FieldLabel>업종</FieldLabel>
            <SelectInput
              value={form.industry}
              onChange={(e) => updateField('industry', e.target.value)}
            >
              <option value="">선택해주세요</option>
              {INDUSTRIES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </SelectInput>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel optional>본인 성명</FieldLabel>
              <TextInput
                placeholder="분쟁 서류용"
                value={form.userName}
                onChange={(e) => updateField('userName', e.target.value)}
              />
            </div>
            <div>
              <FieldLabel optional>업체명</FieldLabel>
              <TextInput
                placeholder="예: 강남헬스클럽"
                value={form.vendorName}
                onChange={(e) => updateField('vendorName', e.target.value)}
              />
            </div>
          </div>

          <div>
            <FieldLabel>총 결제금액 (실제 결제한 금액)</FieldLabel>
            <TextInput
              inputMode="decimal"
              placeholder="예: 1200000"
              value={form.totalPaid}
              onChange={(e) => updateField('totalPaid', e.target.value)}
            />
          </div>

          <div>
            <FieldLabel optional>정상가 (이벤트가로 결제한 경우만)</FieldLabel>
            <TextInput
              inputMode="decimal"
              placeholder="이벤트가 결제 시 정상가를 입력하면 함정 진단을 받을 수 있어요"
              value={form.originalPrice}
              onChange={(e) => updateField('originalPrice', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>전체 계약기간(일)</FieldLabel>
              <TextInput
                inputMode="numeric"
                placeholder="예: 180"
                value={form.contractDays}
                onChange={(e) => updateField('contractDays', e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>실제 이용기간(일)</FieldLabel>
              <TextInput
                inputMode="numeric"
                placeholder="예: 45"
                value={form.usedDays}
                onChange={(e) => updateField('usedDays', e.target.value)}
              />
            </div>
          </div>

          <div>
            <FieldLabel optional>업체 안내 환불금</FieldLabel>
            <TextInput
              inputMode="decimal"
              placeholder="모르면 비워도 돼요"
              value={form.vendorRefund}
              onChange={(e) => updateField('vendorRefund', e.target.value)}
            />
          </div>

          <div>
            <FieldLabel optional>업체 안내 위약금</FieldLabel>
            <TextInput
              inputMode="decimal"
              placeholder="비우면 결제금액의 10%로 계산"
              value={form.vendorPenalty}
              onChange={(e) => updateField('vendorPenalty', e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <FieldLabel optional>업체 환불 안내 문구</FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf,image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={pdfLoading}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-main)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-main)] transition hover:bg-black/[0.05] disabled:opacity-50"
                >
                  {pdfLoading ? (
                    <>
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--text-sub)] border-t-transparent" />
                      읽는 중...
                    </>
                  ) : (
                    <>📎 계약서 PDF · 사진 첨부</>
                  )}
                </button>
              </div>
            </div>
            <textarea
              rows={5}
              placeholder="계약서·안내문에 적힌 환불 조항을 붙여넣거나, 우측 [계약서 PDF 첨부] 로 업로드하세요."
              value={form.vendorPolicyText}
              onChange={(e) => updateField('vendorPolicyText', e.target.value)}
              className="w-full resize-none rounded-2xl border border-black/[0.06] bg-[var(--bg-main)] px-4 py-3.5 text-[16px] text-[var(--text-main)] outline-none ring-[var(--mint-main)] transition placeholder:text-[var(--text-sub)] focus:border-[var(--mint-main)] focus:bg-white focus:ring-2"
            />
            {pdfLoading ? (
              <div className="mt-2 rounded-2xl bg-[var(--bg-main)] px-3 py-2 text-[12px] text-[var(--text-main)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{pdfStatus || '처리 중...'}</span>
                  {pdfProgress > 0 ? (
                    <span className="shrink-0 tabular-nums text-[var(--text-sub)]">
                      {Math.round(pdfProgress * 100)}%
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full bg-[var(--mint-main)] transition-all"
                    style={{ width: `${Math.max(8, pdfProgress * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
            {pdfFileName && !pdfError && !pdfLoading ? (
              <div className="mt-2 flex items-center justify-between rounded-2xl bg-[var(--mint-light)]/60 px-3 py-2 text-[12px] text-[#0d3d24]">
                <span className="truncate">📄 {pdfFileName} 불러왔어요</span>
                <button
                  type="button"
                  onClick={clearPdfFile}
                  className="ml-2 shrink-0 text-[11px] font-semibold underline-offset-2 hover:underline"
                >
                  파일 정보 지우기
                </button>
              </div>
            ) : null}
            {pdfError ? (
              <p className="mt-2 text-[12px] text-red-600">{pdfError}</p>
            ) : null}
            <p className="mt-1.5 text-[11px] text-[var(--text-sub)]">
              * PDF · PNG · JPG 모두 지원해요. 사진은 한국어 OCR로 텍스트를 추출하며,
              해상도가 낮으면 정확도가 떨어질 수 있어요.
            </p>
          </div>

          <div>
            <FieldLabel optional>환불 사유</FieldLabel>
            <TextInput
              placeholder="예: 이사, 건강 문제 등"
              value={form.refundReason}
              onChange={(e) => updateField('refundReason', e.target.value)}
            />
          </div>

          <div>
            <FieldLabel optional>결제 수단</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {[
                { v: 'card', l: '신용카드 일시불' },
                { v: 'installment', l: '신용카드 할부' },
                { v: 'etc', l: '기타' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => updateField('paymentMethod', opt.v)}
                  className={`rounded-full px-4 py-2 text-[14px] font-semibold transition ${
                    form.paymentMethod === opt.v
                      ? 'bg-[var(--mint-main)] text-[#0d3d24]'
                      : 'bg-[var(--bg-main)] text-[var(--text-sub)]'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--text-sub)]">
              * 할부 결제인 경우, 환불 거부 시 카드사에 「할부거래법」 제16조 항변권 행사가 가능해요.
            </p>
          </div>

          <div>
            <FieldLabel>요청 문구 유형</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {REQUEST_TYPES.map((t) => {
                const active = form.requestType === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => updateField('requestType', t.value)}
                    className={`rounded-full px-4 py-2 text-[14px] font-semibold transition ${
                      active
                        ? 'bg-[var(--mint-main)] text-[#0d3d24]'
                        : 'bg-[var(--bg-main)] text-[var(--text-sub)]'
                    }`}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>
        </Card>

        {error ? (
          <p className="mt-4 text-center text-[14px] font-medium text-red-600">{error}</p>
        ) : null}

        <div className="mt-8 space-y-3">
          <PrimaryButton onClick={submitForm} disabled={submitting}>
            {submitting ? 'AI가 계산 중...' : '결과 확인하기'}
          </PrimaryButton>
          <GhostButton onClick={() => setStep(1)}>처음으로</GhostButton>
        </div>

        <p className="mt-4 text-center text-[12px] text-[var(--text-sub)]">
          {backendOnline === true
            ? '기본 계산·템플릿 문구는 무료, AI 맞춤 분석·문구는 결제 후 자동 적용돼요.'
            : backendOnline === false
              ? 'AI 도우미 미연결 — 기본 계산·템플릿으로 동작'
              : '연결 상태 확인 중...'}
        </p>
        <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
        <PricingModal
          open={pricingOpen}
          onClose={() => setPricingOpen(false)}
          onPurchase={purchase}
          paid={paid}
        />
      </PageShell>
    )
  }

  if (step === 3 && result?.calc?.ok) {
    return (
      <PageShell
        onHome={resetAll}
        onOpenTerms={() => setTermsOpen(true)}
        onOpenPricing={() => setPricingOpen(true)}
      >
        <button
          type="button"
          onClick={() => {
            setError('')
            setStep(2)
          }}
          className="mb-6 text-[15px] font-semibold text-[var(--text-sub)]"
        >
          ← 입력 수정
        </button>

        <p className="text-[15px] font-semibold text-[var(--text-sub)]">예상 환불금</p>
        <p className="mt-1 text-[44px] font-black tabular-nums tracking-tight text-[var(--text-main)]">
          {formatWon(result.calc.expectedRefund)}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-sub)]">{diffCopy}</p>

        <Card className="mt-8 space-y-4">
          <div className="flex items-center justify-between text-[15px]">
            <span className="text-[var(--text-sub)]">이용금액</span>
            <span className="font-semibold tabular-nums text-[var(--text-main)]">
              {formatWon(result.calc.usageFee)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[15px]">
            <span className="text-[var(--text-sub)]">위약금</span>
            <span className="font-semibold tabular-nums text-[var(--text-main)]">
              {formatWon(result.calc.penalty)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[15px]">
            <span className="text-[var(--text-sub)]">업체 안내 환불금과의 차이</span>
            <span className="font-semibold tabular-nums text-[var(--text-main)]">
              {formatWon(result.calc.diff)}
            </span>
          </div>
        </Card>

        {result.calc.flags && result.calc.flags.length > 0 ? (
          <div className="mt-5 space-y-3">
            <p className="text-[13px] font-bold uppercase tracking-wide text-[var(--text-sub)]">
              함정 진단 — 자주 다투어지는 항목
            </p>
            {result.calc.flags.map((f) => (
              <div
                key={f.id}
                className={`rounded-3xl border px-5 py-4 ${
                  f.severity === 'high'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-black/[0.06] bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-bold text-[var(--text-main)]">
                    {f.title}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      f.severity === 'high'
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-[var(--bg-main)] text-[var(--text-sub)]'
                    }`}
                  >
                    {f.severity === 'high' ? '확인 필요' : '참고'}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-main)]/90">
                  {f.body}
                </p>
              </div>
            ))}
            <p className="text-[11px] text-[var(--text-sub)]">
              ※ 공정거래위원회 「소비자분쟁해결기준」 등에서 자주 분쟁이 되는 표현을
              참고한 일반 정보입니다. 법률 자문이 아닙니다.
            </p>
          </div>
        ) : null}

        {!paid ? (
          <LockedCard
            title="AI 약관 표현 안내"
            onUnlock={() => setPricingOpen(true)}
          />
        ) : null}

        {paid &&
          (() => {
            const analysis = result.analysis
            const aiCount = Array.isArray(analysis?.탐지된_조항)
              ? analysis.탐지된_조항.length
              : null
            const aiLevel = analysis?.위험도
            const isSafe =
              aiCount === 0 ||
              aiLevel === '낮음' ||
              (!analysis && result.calc.warnings.length === 0)

            if (isSafe) {
            return (
              <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-bold text-emerald-900">
                    약관 문구 체크 — 표준 범위예요
                  </p>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[12px] font-bold text-emerald-800">
                    분쟁 가능성 낮음
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-emerald-900/90">
                  {analysis?.총평 ||
                    '자주 분쟁이 되는 표현은 보이지 않아요. 위 계산 결과를 참고해 환불 요청해보세요.'}
                </p>
                <p className="mt-2 text-[12px] text-emerald-800/80">
                  ※ 본 안내는 공정거래위원회 소비자분쟁해결기준 등을 참고한 일반
                  정보이며, 법률 자문이 아닙니다.
                </p>
              </div>
            )
          }

          if (analysis && Array.isArray(analysis.탐지된_조항)) {
            return (
              <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-bold text-amber-900">
                    약관 문구 체크 결과
                  </p>
                  {aiLevel ? (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                        aiLevel === '높음'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      분쟁 가능성 {aiLevel}
                    </span>
                  ) : null}
                </div>
                {analysis.총평 ? (
                  <p className="mt-2 text-[14px] text-amber-900/90">
                    {analysis.총평}
                  </p>
                ) : null}
                {analysis.탐지된_조항.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-[13px] text-amber-900/90">
                    {analysis.탐지된_조항.map((item, idx) => (
                      <li key={idx} className="rounded-xl bg-white/60 p-3">
                        <p className="font-semibold">“{item.원문}”</p>
                        <p className="mt-1">{item.판정}</p>
                        {item.근거법령 ? (
                          <p className="mt-1 text-[12px] text-amber-700">
                            참고 기준: {item.근거법령}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 text-[12px] text-amber-800/80">
                  ※ 본 결과는 공정거래위원회 소비자분쟁해결기준 등에서 자주 분쟁이
                  되는 표현을 참고한 일반 정보입니다. 법률 자문이 아니며, 구체적인
                  분쟁은 한국소비자원(1372) 또는 변호사 상담을 권장합니다.
                </p>
              </div>
            )
          }

          return (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-[15px] font-bold text-amber-900">
                주의가 필요한 문구가 발견됐어요
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-amber-900/90">
                {result.calc.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-amber-800/80">
                ※ 일반적으로 분쟁이 자주 되는 표현을 단순 검색한 결과입니다. 법률
                자문이 아닙니다.
              </p>
            </div>
          )
        })()}

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-bold text-[var(--text-main)]">
              바로 보낼 수 있는 환불 요청 문구
            </p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                messageSource === 'ai'
                  ? 'bg-[var(--mint-light)] text-[#0d3d24]'
                  : 'bg-[var(--bg-main)] text-[var(--text-sub)]'
              }`}
            >
              {messageSource === 'ai' ? 'AI 생성' : '기본 생성'}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {REQUEST_TYPES.map((t) => {
              const active = form.requestType === t.value
              const hasAi = !!result.aiMessages?.[t.apiKey]
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => updateField('requestType', t.value)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                    active
                      ? 'bg-[var(--mint-main)] text-[#0d3d24]'
                      : 'border border-black/[0.08] bg-white text-[var(--text-sub)]'
                  }`}
                >
                  {t.label}
                  {paid && hasAi ? <span className="ml-1 opacity-70">·AI</span> : null}
                </button>
              )
            })}
          </div>

          <Card className="mt-3">
            <pre className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--text-main)]">
              {requestMessage}
            </pre>
            <div className="mt-4">
              <PrimaryButton onClick={copyMessage}>
                {copied ? '복사했어요' : '문구 복사하기'}
              </PrimaryButton>
            </div>
            <p className="mt-3 text-[12px] text-[var(--text-sub)]">
              {paid
                ? '※ AI가 입력하신 약관·상황을 반영해 톤과 근거를 맞춘 맞춤 문구예요.'
                : '※ 기본 템플릿으로 작성된 문구예요. AI 맞춤 작성·분쟁 서류 패키지는 결제 후 같은 화면에서 잠금 해제돼요.'}
            </p>
          </Card>

        </div>

        <div className="mt-10">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-bold text-[var(--text-main)]">
              분쟁 서류 패키지
            </p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                paid
                  ? 'bg-[var(--mint-light)] text-[#0d3d24]'
                  : 'bg-[var(--bg-main)] text-[var(--text-sub)]'
              }`}
            >
              {paid ? '잠금 해제됨' : '결제 시 발급'}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-sub)]">
            업체가 환불을 거부하면 다음 단계에서 쓰는 공식 양식 3종이에요. 본인 명의로
            본인이 직접 발송·접수하시면 됩니다.
          </p>

          <div className="mt-3 space-y-2">
            {DISPUTE_DOCS.map((doc) => (
              <div
                key={doc.id}
                className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-white p-4"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--mint-light)] text-[12px] font-black text-[#0d3d24]">
                  📄
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[var(--text-main)]">
                    {doc.title}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-sub)]">
                    {doc.summary}
                  </p>
                </div>
                {paid ? (
                  <button
                    type="button"
                    onClick={() => {
                      const text = doc.build({
                        form,
                        calc: result.calc,
                        industryLabel:
                          INDUSTRIES.find((i) => i.value === form.industry)?.label || '',
                      })
                      openPrintWindow(doc.title, text)
                    }}
                    className="shrink-0 rounded-full bg-[var(--mint-main)] px-3 py-1.5 text-[12px] font-bold text-[#0d3d24]"
                  >
                    양식 열기
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full bg-[var(--bg-main)] px-3 py-1.5 text-[12px] font-bold text-[var(--text-sub)]">
                    🔒
                  </span>
                )}
              </div>
            ))}
          </div>

          {!paid ? (
            <button
              type="button"
              onClick={() => setPricingOpen(true)}
              className="mt-4 block w-full rounded-2xl border border-[var(--mint-main)] bg-[var(--mint-light)]/40 p-4 text-left transition hover:bg-[var(--mint-light)]/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-extrabold text-[var(--text-main)]">
                    분쟁 서류 + AI 맞춤 문구 잠금 해제
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-sub)]">
                    내용증명, 소비자원 1372 신청서, 카드 항변권 행사 신청서까지 본인 명의로 바로 발송 가능한 양식으로 발급해드려요. AI 맞춤 요청 문구도 같이 열려요.
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[15px] font-black text-[var(--text-main)]">
                    ₩{PRICE_WON.toLocaleString('ko-KR')}
                  </p>
                  <p className="text-[11px] text-[var(--text-sub)]">1회 결제</p>
                </div>
              </div>
            </button>
          ) : null}

          <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-sub)]">
            ※ 본 양식은 사용자가 <strong>본인 명의로 직접 작성·발송</strong>하시는 보조 양식입니다. 본 서비스는 양식 작성을 보조하는 정보 도구이며, 신고·발송 대리나 법률 자문을 제공하지 않습니다.
          </p>
        </div>

        <div className="mt-6">
          <GhostButton onClick={resetAll}>다시 계산하기</GhostButton>
        </div>
        <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
        <PricingModal
          open={pricingOpen}
          onClose={() => setPricingOpen(false)}
          onPurchase={purchase}
          paid={paid}
        />
      </PageShell>
    )
  }

  return null
}
