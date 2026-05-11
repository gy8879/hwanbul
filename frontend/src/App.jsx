import { useMemo, useState } from 'react'

const INDUSTRIES = [
  { value: 'gym', label: '헬스장' },
  { value: 'pilates', label: '필라테스' },
  { value: 'academy', label: '학원' },
  { value: 'pt', label: 'PT' },
  { value: 'online', label: '인강' },
  { value: 'skincare', label: '피부관리' },
  { value: 'other', label: '기타' },
]

const REQUEST_TYPES = [
  { value: 'kakao', label: '카톡용' },
  { value: 'sms', label: '문자용' },
  { value: 'email', label: '이메일용' },
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
    tag: '01 / 상황 설명',
    title: '계약 정보를 그대로 붙여 넣으세요',
    desc: '업종, 결제금액, 계약기간, 안내받은 환불 문구까지. 정확하지 않아도 괜찮아요.',
  },
  {
    tag: '02 / AI 계산',
    title: '예상 환불금을 한 번에 계산해요',
    desc: '이용기간 비율과 위약금을 반영해 업체 안내 금액과 얼마나 차이 나는지 알려드려요.',
  },
  {
    tag: '03 / 요청 문구',
    title: '바로 보낼 수 있는 문구까지',
    desc: '카톡, 문자, 이메일에 맞춰 정리된 환불 요청 문구를 복사해서 그대로 보내세요.',
  },
]

const initialForm = {
  industry: '',
  totalPaid: '',
  contractDays: '',
  usedDays: '',
  vendorRefund: '',
  vendorPenalty: '',
  vendorPolicyText: '',
  refundReason: '',
  requestType: 'kakao',
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
  const penalty =
    Number.isFinite(vendorPenaltyInput) && vendorPenaltyInput > 0
      ? vendorPenaltyInput
      : totalPaid * 0.1
  const expectedRefund = totalPaid - usageFee - penalty
  const vendorGuided = Number.isFinite(vendorRefund) && vendorRefund >= 0 ? vendorRefund : 0
  const diff = expectedRefund - vendorGuided
  const warnings = findWarnings(form.vendorPolicyText)

  return {
    ok: true,
    totalPaid,
    usageFee,
    penalty,
    expectedRefund,
    vendorGuided,
    diff,
    warnings,
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
            AI 환불 계산기 오픈
          </span>
          <p className="text-[13px] text-white/70">
            구독 서비스 환불, 계약서만 넣어도 기준 자동 정리
          </p>
          <p className="text-[14px] font-semibold text-white">
            3분 안에 환급액 계산, 요구 문구, 분쟁 대응까지 한 번에
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

function NavBar({ onStart }) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-black/[0.04] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-[15px] font-medium text-[var(--text-main)]/80 md:flex">
          {NAV_ITEMS.map((item) => (
            <a key={item} href="#" className="transition hover:text-[var(--text-main)]">
              {item}
            </a>
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

function Hero({ onStart }) {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 pb-10 text-center sm:pt-24">
      <p className="text-[14px] font-medium tracking-wide text-[var(--text-sub)]">
        Refund AI for memberships & subscriptions
      </p>
      <h1 className="mt-6 text-[44px] font-black leading-[1.05] tracking-tight text-[var(--text-main)] sm:text-[80px]">
        <span className="inline-flex flex-wrap justify-center gap-x-6">
          <span className="opacity-60 blur-[2px] sm:blur-[3px]">복잡한</span>
          <span>환불은 쉽게</span>
        </span>
        <br />
        <span className="opacity-60 blur-[2px] sm:blur-[3px]">정당하게</span>
      </h1>
      <p className="mx-auto mt-8 max-w-xl text-[16px] leading-relaxed text-[var(--text-sub)] sm:text-[18px]">
        헬스장, 필라테스, 학원, 인강, 피부관리 환불을 AI가 계산하고
        <br className="hidden sm:block" />
        바로 보낼 환불 요청 문구까지 정리해 드립니다.
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onStart}
          className="rounded-full bg-[var(--mint-main)] px-7 py-3.5 text-[16px] font-bold text-[#0d3d24] shadow-sm transition hover:brightness-[1.03]"
        >
          환불금 계산하기
        </button>
        <button
          type="button"
          className="rounded-full border border-black/[0.08] bg-white px-7 py-3.5 text-[16px] font-semibold text-[var(--text-main)] transition hover:bg-[var(--bg-main)]"
        >
          사용해보기
        </button>
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
          중도해지 상황을 자세히 알려주세요. 업종, 결제금액, 사용한 기간만 있어도
          AI가 환불금을 자동으로 계산해 드려요.
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

function Landing({ onStart, bannerOpen, setBannerOpen }) {
  return (
    <div className="min-h-dvh bg-white">
      {bannerOpen ? <TopBanner onClose={() => setBannerOpen(false)} /> : null}
      <NavBar onStart={onStart} />
      <Hero onStart={onStart} />
      <FeatureSection onStart={onStart} />
    </div>
  )
}

function PageShell({ children, onHome }) {
  return (
    <div className="min-h-dvh bg-[var(--bg-main)]">
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
      <main className="mx-auto max-w-md px-5 pb-14 pt-8 md:max-w-2xl">{children}</main>
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

  const industryLabel = useMemo(() => {
    return INDUSTRIES.find((i) => i.value === form.industry)?.label ?? '해당 업종'
  }, [form.industry])

  const requestMessage = useMemo(() => {
    if (!result?.calc?.ok) return ''
    return buildRequestMessage(form, result.calc, industryLabel)
  }, [form, result, industryLabel])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function goStep2() {
    setError('')
    setStep(2)
  }

  function submitForm() {
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
    setResult({ calc })
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
      <Landing
        onStart={goStep2}
        bannerOpen={bannerOpen}
        setBannerOpen={setBannerOpen}
      />
    )
  }

  if (step === 2) {
    return (
      <PageShell onHome={resetAll}>
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

          <div>
            <FieldLabel>총 결제금액</FieldLabel>
            <TextInput
              inputMode="decimal"
              placeholder="예: 1200000"
              value={form.totalPaid}
              onChange={(e) => updateField('totalPaid', e.target.value)}
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
            <FieldLabel optional>업체 환불 안내 문구</FieldLabel>
            <textarea
              rows={4}
              placeholder="계약서·안내문에 적힌 환불 조항을 붙여넣기"
              value={form.vendorPolicyText}
              onChange={(e) => updateField('vendorPolicyText', e.target.value)}
              className="w-full resize-none rounded-2xl border border-black/[0.06] bg-[var(--bg-main)] px-4 py-3.5 text-[16px] text-[var(--text-main)] outline-none ring-[var(--mint-main)] transition placeholder:text-[var(--text-sub)] focus:border-[var(--mint-main)] focus:bg-white focus:ring-2"
            />
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
          <PrimaryButton onClick={submitForm}>결과 확인하기</PrimaryButton>
          <GhostButton onClick={() => setStep(1)}>처음으로</GhostButton>
        </div>
      </PageShell>
    )
  }

  if (step === 3 && result?.calc?.ok) {
    return (
      <PageShell onHome={resetAll}>
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

        {result.calc.warnings.length > 0 ? (
          <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-[15px] font-bold text-amber-900">
              확인이 필요한 문구가 발견됐어요
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-amber-900/90">
              {result.calc.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-5 rounded-3xl border border-black/[0.06] bg-white px-5 py-4 text-[14px] text-[var(--text-sub)]">
            자주 문제되는 키워드는 안 보여요. 그래도 계약서 전체를 한 번 더 확인해주세요.
          </p>
        )}

        <div className="mt-8">
          <p className="text-[15px] font-bold text-[var(--text-main)]">
            바로 보낼 수 있는 환불 요청 문구
          </p>
          <Card className="mt-3">
            <pre className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--text-main)]">
              {requestMessage}
            </pre>
            <div className="mt-4">
              <PrimaryButton onClick={copyMessage}>
                {copied ? '복사했어요' : '문구 복사하기'}
              </PrimaryButton>
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <GhostButton onClick={resetAll}>다시 계산하기</GhostButton>
        </div>
      </PageShell>
    )
  }

  return null
}
