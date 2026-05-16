const CASES_STORAGE_KEY = 'rh_cases_v1'

function generateCaseId() {
  return `case_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function readAll() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CASES_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeAll(cases) {
  window.localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(cases))
}

export function createCase(payload) {
  const id = generateCaseId()
  const record = {
    id,
    createdAt: new Date().toISOString(),
    status: 'pending',
    ...payload,
    vendorReply: null,
  }
  const cases = readAll()
  cases[id] = record
  writeAll(cases)
  return record
}

export function getCase(id) {
  if (!id) return null
  return readAll()[id] ?? null
}

export function listCases() {
  return Object.values(readAll()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function parseRespondCaseId(input) {
  const trimmed = String(input ?? '').trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed, window.location.origin)
    const fromQuery = url.searchParams.get('respond')
    if (fromQuery) return fromQuery
  } catch {
    /* not a URL */
  }
  if (trimmed.startsWith('case_')) return trimmed
  return null
}

export function saveVendorReply(id, { proposedRefund, message }) {
  const cases = readAll()
  const existing = cases[id]
  if (!existing) return null
  const updated = {
    ...existing,
    status: 'replied',
    vendorReply: {
      proposedRefund: String(proposedRefund ?? '').trim(),
      message: String(message ?? '').trim(),
      repliedAt: new Date().toISOString(),
    },
  }
  cases[id] = updated
  writeAll(cases)
  return updated
}

export function getVendorRespondUrl(caseId) {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('respond', caseId)
  return url.toString()
}

export function getRespondCaseIdFromUrl() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('respond')
}

export function clearRespondParam() {
  const url = new URL(window.location.href)
  url.searchParams.delete('respond')
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}
