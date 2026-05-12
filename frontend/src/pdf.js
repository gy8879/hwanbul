import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { createWorker } from 'tesseract.js'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

let tesseractWorker = null

async function getTesseract({ onStatus, onProgress } = {}) {
  if (tesseractWorker) return tesseractWorker
  onStatus?.('한국어 OCR 엔진 준비 중... (최초 1회 약 10~30초)')
  tesseractWorker = await createWorker(['kor', 'eng'], 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(m.progress)
      }
    },
  })
  return tesseractWorker
}

async function ocrBlob(blob, options) {
  const worker = await getTesseract(options)
  options?.onStatus?.('이미지에서 텍스트 인식 중...')
  const { data } = await worker.recognize(blob)
  return (data?.text || '').trim()
}

async function ocrPdfPage(pdf, pageNum, options) {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  return ocrBlob(blob, options)
}

export async function extractText(file, options = {}) {
  const { onStatus } = options
  const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

  if (isImage) {
    return ocrBlob(file, options)
  }

  if (!isPdf) {
    throw new Error('PDF 또는 이미지 파일(PNG/JPG)만 지원됩니다.')
  }

  onStatus?.('PDF에서 텍스트 읽는 중...')
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const parts = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (pageText) parts.push(pageText)
  }

  const combined = parts.join('\n\n').trim()
  if (combined.length >= 30) {
    return combined
  }

  const ocrParts = []
  for (let i = 1; i <= pdf.numPages; i++) {
    onStatus?.(`이미지 PDF로 보여요. ${i}/${pdf.numPages}쪽 인식 중...`)
    const text = await ocrPdfPage(pdf, i, options)
    if (text) ocrParts.push(text)
  }
  return ocrParts.join('\n\n').trim()
}

export { extractText as extractPdfText }
