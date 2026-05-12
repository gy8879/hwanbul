const BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:8000'

async function postJSON(path, body, signal) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return res.json()
}

export async function checkHealth(signal) {
  try {
    const res = await fetch(`${BASE_URL}/api/b/health`, { signal })
    if (!res.ok) return false
    const data = await res.json()
    return data?.status === 'ok'
  } catch {
    return false
  }
}

export function analyzeContract({ contractText, industryLabel }, signal) {
  return postJSON(
    '/api/b/analyze/contract',
    { 계약서_텍스트: contractText, 업종: industryLabel },
    signal,
  )
}

export function generateMessage(
  { industryLabel, vendorName, totalPaid, usedDays, expectedRefund, penalty },
  signal,
) {
  return postJSON(
    '/api/b/generate/message',
    {
      업종: industryLabel,
      업체명: vendorName || '업체명 미입력',
      결제금액: Math.round(totalPaid),
      이용일수: Math.round(usedDays),
      환불예상금: Math.max(0, Math.round(expectedRefund)),
      부당위약금: Math.max(0, Math.round(penalty)),
    },
    signal,
  )
}

export const API_BASE_URL = BASE_URL
