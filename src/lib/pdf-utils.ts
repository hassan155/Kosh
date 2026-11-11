import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorkerUrl from './pdfjs-worker'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export interface PdfInspection {
  pageCount: number
  title: string
  searchableText: string
  bytes: number
}
export interface PdfPageSelection { start: number; end: number }
export interface PdfPageEdit { pageIndex: number; rotation?: number; remove?: boolean }

function pdfBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy.buffer
}
function pdfBlob(bytes: Uint8Array): Blob { return new Blob([pdfBytes(bytes)], { type: 'application/pdf' }) }
function assertPdfFile(file: Blob): void {
  if (!(file instanceof Blob) || file.size === 0) throw new Error('Choose a non-empty PDF file.')
}

export async function inspectPdf(file: Blob, fallbackTitle = 'Untitled document'): Promise<PdfInspection> {
  assertPdfFile(file)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('This file does not have a valid PDF header.')
  try {
    const document = await pdfjs.getDocument({ data: bytes.slice(), disableWorker: typeof window === 'undefined' }).promise
    const pages: string[] = []
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => 'str' in item ? item.str : '').filter(Boolean).join(' '))
    }
    const metadata = await document.getMetadata().catch(() => null)
    const info = metadata?.info as { Title?: string } | undefined
    return { pageCount: document.numPages, title: info?.Title?.trim() || fallbackTitle, searchableText: pages.join('\n').replace(/\s+/g, ' ').trim(), bytes: file.size }
  } catch (error) {
    throw new Error(error instanceof Error ? `The PDF could not be read: ${error.message}` : 'The PDF could not be read.')
  }
}
export async function extractPdfText(file: Blob): Promise<string> { return (await inspectPdf(file)).searchableText }
export function validatePageSelection(selection: PdfPageSelection, pageCount: number): PdfPageSelection {
  if (!Number.isInteger(selection.start) || !Number.isInteger(selection.end) || selection.start < 1 || selection.end < selection.start || selection.end > pageCount) throw new Error(`Choose a page range from 1 to ${pageCount}.`)
  return selection
}
export function createPdfFileName(title: string): string {
  const base = title.trim().replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').slice(0, 120)
  return `${base || 'document'}.pdf`
}
async function loadDocument(file: Blob): Promise<PDFDocument> {
  assertPdfFile(file)
  try { return await PDFDocument.load(await file.arrayBuffer()) } catch (error) { throw new Error(error instanceof Error ? `The PDF could not be edited: ${error.message}` : 'The PDF could not be edited.') }
}
async function copyPages(file: Blob, indices: number[]): Promise<Blob> {
  const source = await loadDocument(file)
  const result = await PDFDocument.create()
  const pages = await result.copyPages(source, indices)
  pages.forEach((page) => result.addPage(page))
  return pdfBlob(await result.save())
}
export async function selectPdfPages(file: Blob, selection: PdfPageSelection): Promise<Blob> {
  const source = await loadDocument(file)
  validatePageSelection(selection, source.getPageCount())
  const indices = Array.from({ length: selection.end - selection.start + 1 }, (_, index) => selection.start - 1 + index)
  const result = await PDFDocument.create()
  const pages = await result.copyPages(source, indices)
  pages.forEach((page) => result.addPage(page))
  return pdfBlob(await result.save())
}
export async function reorderPdfPages(file: Blob, pageOrder: number[]): Promise<Blob> {
  const source = await loadDocument(file)
  if (pageOrder.length !== source.getPageCount() || new Set(pageOrder).size !== pageOrder.length || pageOrder.some((index) => !Number.isInteger(index) || index < 0 || index >= source.getPageCount())) throw new Error('The page order must include every page exactly once.')
  const result = await PDFDocument.create()
  const pages = await result.copyPages(source, pageOrder)
  pages.forEach((page) => result.addPage(page))
  return pdfBlob(await result.save())
}
export async function mergePdfFiles(files: Blob[]): Promise<Blob> {
  if (files.length < 2) throw new Error('Select at least two PDFs to merge.')
  const merged = await PDFDocument.create()
  for (const file of files) {
    const source = await loadDocument(file)
    const pages = await merged.copyPages(source, source.getPageIndices())
    pages.forEach((page) => merged.addPage(page))
  }
  return pdfBlob(await merged.save())
}
export async function applyPdfPageEdits(file: Blob, edits: PdfPageEdit[]): Promise<Blob> {
  if (!edits.length) throw new Error('Choose at least one page edit.')
  const source = await loadDocument(file)
  const count = source.getPageCount()
  for (const edit of edits) {
    if (!Number.isInteger(edit.pageIndex) || edit.pageIndex < 0 || edit.pageIndex >= count) throw new Error('A page edit refers to a page outside this document.')
    if (edit.rotation !== undefined && ![0, 90, 180, 270].includes(edit.rotation)) throw new Error('Page rotation must be 0, 90, 180, or 270 degrees.')
  }
  const removals = new Set(edits.filter((edit) => edit.remove).map((edit) => edit.pageIndex))
  if (removals.size >= count) throw new Error('A PDF must keep at least one page.')
  for (const edit of edits) if (edit.rotation !== undefined) source.getPage(edit.pageIndex).setRotation(degrees(edit.rotation))
  for (const index of [...removals].sort((a, b) => b - a)) source.removePage(index)
  return pdfBlob(await source.save())
}
export async function redactPdfAreas(file: Blob, redactions: Array<{ pageIndex: number; x: number; y: number; width: number; height: number }>): Promise<Blob> {
  const document = await loadDocument(file)
  for (const mark of redactions) {
    if (!Number.isInteger(mark.pageIndex) || mark.pageIndex < 0 || mark.pageIndex >= document.getPageCount()) throw new Error('A redaction refers to a page outside this document.')
    const page = document.getPage(mark.pageIndex)
    const size = page.getSize()
    page.drawRectangle({ x: Math.max(0, mark.x * size.width), y: Math.max(0, size.height - (mark.y + mark.height) * size.height), width: Math.max(1, mark.width * size.width), height: Math.max(1, mark.height * size.height), color: rgb(0, 0, 0), opacity: 1 })
  }
  return pdfBlob(await document.save())
}
export async function signPdf(file: Blob, pageIndex: number, signature: string): Promise<Blob> {
  const document = await loadDocument(file)
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= document.getPageCount()) throw new Error('Choose a page in this document for the signature.')
  const page = document.getPage(pageIndex)
  const font = await document.embedFont(StandardFonts.HelveticaOblique)
  page.drawText(signature.trim(), { x: 48, y: 48, size: 18, font, color: rgb(0.12, 0.18, 0.14), maxWidth: page.getWidth() - 96 })
  return pdfBlob(await document.save())
}
export function createPdfBlob(bytes: Uint8Array): Blob {
  if (bytes.length < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('The generated file is not a valid PDF.')
  return pdfBlob(bytes)
}
export function getPdfMimeType(): string { return 'application/pdf' }
