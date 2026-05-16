function formatKoreanDate(d = new Date()) {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function formatWonInline(value) {
  const n = Math.round(Number(value) || 0)
  return `${n.toLocaleString('ko-KR')}원`
}

function safe(v, fallback = '(미입력)') {
  if (v == null) return fallback
  const s = String(v).trim()
  return s.length ? s : fallback
}

export function buildCertifiedMailText({ form, calc, industryLabel }) {
  const today = formatKoreanDate()
  const userName = safe(form.userName, '(본인 성명)')
  const vendorName = safe(form.vendorName, '(업체명)')
  const vendorAddress = safe(form.vendorAddress, '(업체 주소)')
  const paymentDate = safe(form.paymentDate, '(결제일)')
  const reason = safe(form.refundReason, '개인 사정')
  const refusal = safe(form.vendorRefusalReason, '')
  const demand = safe(form.userDemand, '잔여 대금 환불')
  return `내용증명

수신: ${vendorName} 대표자 귀하
       주소: ${vendorAddress}
발신: ${userName}
작성일: ${today}

제목: ${industryLabel} 이용계약 중도해지 및 환불 요청

1. 본인은 귀 ${vendorName}과 ${paymentDate}자로 ${industryLabel} 이용계약을 체결하고
   총 ${formatWonInline(form.totalPaid)}을(를) 결제한 사실이 있습니다.

2. 본인은 ${reason}의 사유로 잔여기간에 대한 중도해지 및 환불을 요청합니다.${
  refusal !== '(미입력)' && refusal.length
    ? `\n   환불 요청에 대해 귀사는 「${refusal}」을(를) 사유로 환불을 거부하거나 일부만 안내하셨습니다.`
    : ''
}

3. 본인이 산정한 예상 환불 금액은 다음과 같습니다.
   - 총 결제 금액: ${formatWonInline(form.totalPaid)}
   - 실제 이용 기간: ${safe(form.usedDays, '0')}일 / 전체 ${safe(form.contractDays, '0')}일
   - 이용 금액(일할): ${formatWonInline(calc.usageFee)}
   - 위약금(총금액의 10% 기준): ${formatWonInline(calc.penalty)}
   - 예상 환불 금액: ${formatWonInline(calc.expectedRefund)}

4. 위 금액은 공정거래위원회 「소비자분쟁해결기준」 및 관련 법령(체육시설의 설치·이용에 관한 법률, 학원의 설립·운영 및 과외교습에 관한 법률, 방문판매 등에 관한 법률 등)을 참고하여 산정한 일반적인 기준입니다.

5. 본인의 요청사항: ${demand}

6. 본 통지서 수령일로부터 7일 이내에 환불 처리 또는 회신을 요청드립니다. 동 기간 내 합의가 이루어지지 않을 경우 한국소비자원(국번없이 1372)에 분쟁조정을 신청하거나, 카드 결제분에 대해서는 신용카드사에 「할부거래에 관한 법률」 제16조에 따른 항변권을 행사할 예정입니다.

7. 본 통지서는 향후 분쟁 시 증빙자료로 활용됩니다.

${today}
발신인: ${userName} (서명)

※ 본 문서는 본인이 직접 작성·발송하는 통지서입니다. 본 서비스는 양식 작성을 보조하는 정보 도구이며, 법률 자문이나 분쟁 대리를 제공하지 않습니다.`
}

export function buildKcaPetitionText({ form, calc, industryLabel }) {
  const today = formatKoreanDate()
  const userName = safe(form.userName, '(본인 성명)')
  const vendorName = safe(form.vendorName, '(업체명)')
  const vendorAddress = safe(form.vendorAddress, '(확인 가능 시 입력)')
  const paymentDate = safe(form.paymentDate, '(입력)')
  const reason = safe(form.refundReason, '개인 사정')
  const refusal = safe(form.vendorRefusalReason, '환불 거부 또는 일부만 안내')
  const demand = safe(form.userDemand, '잔여 대금 환불')
  return `한국소비자원 1372 분쟁조정 신청 — 사실관계 정리

[신청인]
- 성명: ${userName}
- 연락처: (전화번호 입력)
- 주소: (주소 입력)

[피신청인]
- 업체명: ${vendorName}
- 업종: ${industryLabel}
- 사업장 주소: ${vendorAddress}
- 연락처: (확인 가능 시 입력)

[분쟁 발생일]
- 계약 체결일: ${paymentDate}
- 환불 요청일: (입력)

[계약 내역]
- 총 결제 금액: ${formatWonInline(form.totalPaid)}
- 결제 수단: ${form.paymentMethod === 'card' ? '신용카드' : form.paymentMethod === 'installment' ? '신용카드 할부' : '기타'}
- 전체 계약 기간: ${safe(form.contractDays, '0')}일
- 실제 이용 기간: ${safe(form.usedDays, '0')}일

[사실관계]
1. 신청인은 ${vendorName}과 ${paymentDate}자로 ${industryLabel} 이용계약을 체결하고 ${formatWonInline(form.totalPaid)}을 결제하였습니다.
2. 신청인은 ${reason}의 사유로 중도해지 및 잔여 대금 환불을 요청하였습니다.
3. 위 환불 요청에 대해 피신청인은 ${refusal}하였습니다.
4. 신청인이 표준 기준(공정거래위원회 「소비자분쟁해결기준」)에 따라 산정한 예상 환불액은 ${formatWonInline(calc.expectedRefund)}이나,
   업체에서 안내받은 환불 가능 금액은 ${formatWonInline(calc.vendorGuided)}으로 ${formatWonInline(Math.abs(calc.diff))}의 차이가 있습니다.
5. 신청인의 요청사항: ${demand}
6. 신청인은 환불에 관한 분쟁 조정을 요청드립니다.

[첨부 자료(예시)]
- 결제 영수증 / 카드 매출전표
- 계약서 또는 약관 사본
- 환불 요청 카카오톡·문자·이메일 캡처
- 본 사건 관련 내용증명 사본

작성일: ${today}
신청인: ${userName} (서명)

※ 본 문서는 한국소비자원(국번없이 1372) 홈페이지에서 직접 분쟁조정을 신청하실 때 첨부·참고용으로 활용할 수 있도록 사실관계를 정리한 양식입니다. 본 서비스는 신청을 대리하지 않습니다.`
}

export function buildChargebackText({ form, calc, industryLabel }) {
  const today = formatKoreanDate()
  const userName = safe(form.userName, '(본인 성명)')
  const vendorName = safe(form.vendorName, '(업체명)')
  const vendorAddress = safe(form.vendorAddress, '')
  const paymentDate = safe(form.paymentDate, '(결제일 입력)')
  const refusal = safe(form.vendorRefusalReason, '환불 거부 또는 일부만 안내')
  const demand = safe(form.userDemand, '잔여 대금 환불')
  return `신용카드 할부거래 항변권 행사 통지서

수신: (카드사명) 고객센터 귀하
발신: ${userName}
작성일: ${today}

본인은 「할부거래에 관한 법률」 제16조 및 카드사 약관에 따라 아래 거래에 대한 항변권을 행사하고자 합니다.

[거래 내역]
- 가맹점: ${vendorName} (${industryLabel})${vendorAddress !== '(미입력)' && vendorAddress.length ? `\n- 가맹점 주소: ${vendorAddress}` : ''}
- 결제일: ${paymentDate}
- 결제 금액: ${formatWonInline(form.totalPaid)}
- 할부 개월: (개월 수 입력)

[항변 사유]
본인은 위 가맹점과 ${industryLabel} 이용계약을 체결하였으나, 잔여 기간에 대한 환불 요청에 대해 가맹점은 ${refusal}하였습니다. 본인이 표준 기준으로 산정한 예상 환불액은 ${formatWonInline(calc.expectedRefund)}이며, 본인의 요청사항은 ${demand}입니다. 미정산 금액에 대한 결제 중지 또는 환불 처리를 요청드립니다.

[요청 사항]
1. 본 거래에 대한 잔여 할부금 결제 중지
2. 가맹점에 대한 사실관계 확인 및 조정 협조
3. 본 항변권 행사 처리 결과 회신

[첨부]
- 결제 영수증 / 매출전표
- 환불 요청 기록(카카오톡·문자·이메일 등)
- 본 사건 관련 내용증명 사본

${today}
발신인: ${userName} (서명)
연락처: (전화번호 입력)

※ 「할부거래에 관한 법률」 제16조에 따른 항변권은 일반적으로 할부 기간 중 행사할 수 있으며, 구체적인 행사 요건은 결제 카드사 약관 및 법령에 따릅니다. 본 서비스는 양식 작성을 보조하는 정보 도구이며 행사 대리를 제공하지 않습니다.`
}

export const DISPUTE_DOCS = [
  {
    id: 'certifiedMail',
    title: '환불 요청 내용증명',
    summary: '본인 명의로 등기 우편(내용증명)으로 발송하는 공식 통지문',
    build: buildCertifiedMailText,
  },
  {
    id: 'kcaPetition',
    title: '한국소비자원 1372 분쟁조정 신청서',
    summary: '한국소비자원에 분쟁조정 신청 시 첨부할 사실관계 정리 양식',
    build: buildKcaPetitionText,
  },
  {
    id: 'chargeback',
    title: '카드 할부거래 항변권 행사 신청서',
    summary: '신용카드 할부 결제분에 대해 카드사에 보낼 항변권 행사 통지서',
    build: buildChargebackText,
  },
]

export function openPrintWindow(title, text) {
  if (typeof window === 'undefined') return
  const w = window.open('', '_blank', 'width=860,height=900')
  if (!w) {
    alert('팝업이 차단되어 있어요. 브라우저에서 팝업을 허용한 뒤 다시 시도해주세요.')
    return
  }
  const safeTitle = title.replace(/</g, '&lt;')
  const safeBody = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  w.document.write(`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  body { font-family: 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', system-ui, sans-serif; color: #191f28; line-height: 1.7; font-size: 13px; padding: 24px; }
  h1 { font-size: 16px; font-weight: 800; margin: 0 0 16px; }
  pre { white-space: pre-wrap; word-break: keep-all; font-family: inherit; font-size: 13px; }
  .toolbar { position: sticky; top: 0; background: #f9fafb; border-bottom: 1px solid #e6e8ea; padding: 10px 0 12px; margin: -24px -24px 16px; padding-left: 24px; padding-right: 24px; display: flex; gap: 8px; }
  .toolbar button { font-size: 13px; padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(0,0,0,0.08); background: #fff; cursor: pointer; font-weight: 600; }
  .toolbar .primary { background: #90E6B3; border-color: #90E6B3; color: #0d3d24; }
  @media print { .toolbar { display: none; } body { padding: 0; } }
</style>
</head>
<body>
<div class="toolbar">
  <button class="primary" onclick="window.print()">PDF로 저장 / 인쇄</button>
  <button onclick="window.close()">닫기</button>
</div>
<h1>${safeTitle}</h1>
<pre>${safeBody}</pre>
</body>
</html>`)
  w.document.close()
}
