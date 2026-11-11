import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Download,
  FilePlus2,
  FileText,
  LockKeyhole,
  RotateCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { koshDB } from '../lib/kosh-db'
import { applyPdfPageEdits, inspectPdf, reorderPdfPages, signPdf } from '../lib/pdf-utils'
import type { KoshPdf } from '../lib/types'

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `kosh-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function titleFromFile(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled document'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PdfWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [searchableText, setSearchableText] = useState('')
  const [pageOrder, setPageOrder] = useState<number[]>([])
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({})
  const [removedPages, setRemovedPages] = useState<number[]>([])
  const [signature, setSignature] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const inspectFile = async (selected?: File) => {
    if (!selected) return
    setError('')
    setMessage('')
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      setError('Choose a PDF document.')
      return
    }

    setBusy(true)
    try {
      const inspection = await inspectPdf(selected, titleFromFile(selected.name))
      setFile(selected)
      setTitle(inspection.title || titleFromFile(selected.name))
      setPageCount(inspection.pageCount)
      setSearchableText(inspection.searchableText)
      setPageOrder(Array.from({ length: inspection.pageCount }, (_, index) => index))
      setPageRotations({})
      setRemovedPages([])
      setSignature('')
      setMessage(`Ready to save ${inspection.pageCount} ${inspection.pageCount === 1 ? 'page' : 'pages'} to your device archive.`)
    } catch (inspectionError) {
      setFile(null)
      setPageCount(0)
      setPageOrder([])
      setError(inspectionError instanceof Error ? inspectionError.message : 'The PDF could not be read.')
    } finally {
      setBusy(false)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void inspectFile(event.currentTarget.files?.[0])
    event.currentTarget.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    void inspectFile(event.dataTransfer.files?.[0])
  }

  const movePage = (position: number, direction: -1 | 1) => {
    const nextPosition = position + direction
    if (nextPosition < 0 || nextPosition >= pageOrder.length) return
    setPageOrder((current) => {
      const next = [...current]
      ;[next[position], next[nextPosition]] = [next[nextPosition], next[position]]
      return next
    })
    setMessage('Page arrangement updated. Save to Warehouse to keep this arrangement with the record.')
  }

  const removePage = (pageIndex: number) => {
    setRemovedPages((current) => current.includes(pageIndex) ? current.filter((index) => index !== pageIndex) : [...current, pageIndex])
    setMessage('Page removal queued. Apply page edits to create a new PDF copy; the source remains unchanged.')
  }

  const rotatePage = (pageIndex: number) => {
    setPageRotations((current) => ({
      ...current,
      [pageIndex]: ((current[pageIndex] ?? 0) + 90) % 360,
    }))
    setMessage('Page rotation updated. Save a processed copy to apply this change to the PDF.')
  }

  const applyPageEdits = async () => {
    if (!file) return
    if (removedPages.length && !window.confirm(`Permanently remove ${removedPages.length} selected ${removedPages.length === 1 ? 'page' : 'pages'} from this PDF copy? The original file remains unchanged.`)) return
    setBusy(true)
    setError('')
    try {
      let processed = await reorderPdfPages(file, pageOrder)
      const edits = [
        ...Object.entries(pageRotations).filter(([pageIndex]) => Number(pageIndex) >= 0).map(([pageIndex, rotation]) => ({ pageIndex: Number(pageIndex), rotation })),
        ...removedPages.map((pageIndex) => ({ pageIndex, remove: true })),
      ]
      if (edits.length) processed = await applyPdfPageEdits(processed, edits)
      if (signature.trim()) processed = await signPdf(processed, 0, signature.trim())
      const inspection = await inspectPdf(processed, title)
      const name = `${titleFromFile(file.name)}-edited.pdf`
      const result = new File([processed], name, { type: 'application/pdf' })
      setFile(result)
      setPageCount(inspection.pageCount)
      setPageOrder(Array.from({ length: inspection.pageCount }, (_, index) => index))
      setPageRotations({})
      setRemovedPages([])
      setSearchableText(inspection.searchableText)
      setMessage('PDF edits were applied to a new local copy. The original file was preserved.')
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'The PDF edits could not be applied.')
    } finally {
      setBusy(false)
    }
  }

  const downloadPdf = () => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const saveToWarehouse = async () => {
    if (!file || pageCount < 1) return
    if (!title.trim()) {
      setError('Enter a title before saving this document.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const now = new Date().toISOString()
      const record: KoshPdf = {
        id: createId(),
        title: title.trim(),
        pdfDate: now,
        pageCount,
        searchableText,
        tagIds: [],
        file,
        pageOrder,
        pageRotations,
        redactions: [],
        signatures: [],
        createdAt: now,
        updatedAt: now,
      }
      await koshDB.put('pdfs', record)
      setMessage('PDF record saved in the device-local warehouse. Its searchable text and page arrangement are ready to find again.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The PDF could not be saved to the local warehouse.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="kosh-panel kosh-panel-muted" aria-labelledby="pdf-workspace-title">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="kosh-eyebrow"><ShieldCheck aria-hidden="true" size={14} /> Device-local PDF workspace</span>
            <h2 className="kosh-section-title mt-2" id="pdf-workspace-title">Bring a document into your archive</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Choose a PDF to inspect its page count and searchable text, then save a searchable record in this browser.
              The original file is not uploaded or sent to a service.
            </p>
          </div>
          <FileText aria-hidden="true" className="text-brand" size={23} />
        </div>

        <div
          aria-busy={busy}
          className="kosh-dropzone"
          data-dragging={dragging}
          onDragEnter={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={handleDrop}
        >
          <div className="kosh-empty-state-inner">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl border border-border bg-background text-brand">
              <FilePlus2 aria-hidden="true" size={20} />
            </div>
            <p className="text-sm font-semibold text-foreground">Drop a PDF here to inspect it</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Your selected file stays in this browser.</p>
            <button
              className="kosh-button kosh-button-primary mt-4"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              <Upload aria-hidden="true" size={16} />
              {busy ? 'Reading document…' : 'Choose a PDF'}
            </button>
            <input
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={handleFileChange}
              ref={inputRef}
              type="file"
            />
          </div>
        </div>
      </section>

      {file && (
        <section aria-labelledby="selected-document-title" className="kosh-detail-layout">
          <div className="kosh-document-column space-y-5">
            <div className="kosh-panel">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="kosh-eyebrow"><FileText aria-hidden="true" size={13} /> Selected document</span>
                  <h2 className="kosh-section-title mt-2" id="selected-document-title">{file.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{pageCount} {pageCount === 1 ? 'page' : 'pages'} · {formatBytes(file.size)}</p>
                </div>
                <button
                  className="kosh-button"
                  onClick={() => inputRef.current?.click()}
                  type="button"
                >
                  <FilePlus2 aria-hidden="true" size={16} />
                  Replace file
                </button>
              </div>

              <label className="mt-6 block text-sm font-medium text-foreground" htmlFor="pdf-record-title">Warehouse title</label>
              <input
                className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                id="pdf-record-title"
                maxLength={180}
                onChange={(event) => setTitle(event.currentTarget.value)}
                value={title}
              />

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Page arrangement</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Save the arrangement and rotation notes with this archive record. The PDF file itself remains unchanged.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="kosh-button" disabled={busy} onClick={() => void applyPageEdits()} type="button">Apply page edits</button>
                  <button className="kosh-button" disabled={busy} onClick={downloadPdf} type="button"><Download aria-hidden="true" size={15} />Download edited PDF</button>
                  <button
                  className="kosh-button kosh-button-primary"
                  disabled={busy}
                  onClick={() => void saveToWarehouse()}
                  type="button">
                  <Save aria-hidden="true" size={16} />
                  Save to Warehouse
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground" htmlFor="pdf-signature">Type a signature to add to page 1
                  <input className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" id="pdf-signature" maxLength={120} onChange={(event) => setSignature(event.currentTarget.value)} placeholder="Your name" value={signature} />
                </label>
                <button className="kosh-button self-end" disabled={busy || !signature.trim()} onClick={() => setMessage('Signature is ready. Apply page edits to add it to page 1.')} type="button">Queue signature</button>
              </div>
              <ol className="mt-4 grid gap-2" aria-label="PDF page arrangement">
                {pageOrder.map((pageIndex, position) => (
                  <li className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3" key={pageIndex}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="kosh-timecode">PAGE {pageIndex + 1}</span>
                      <span className="text-sm font-medium text-foreground">Position {position + 1}</span>
                      {(pageRotations[pageIndex] ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground">{pageRotations[pageIndex]}° rotation queued</span>
                      )}
                      {removedPages.includes(pageIndex) && <span className="text-xs font-semibold text-destructive">Removal queued</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        aria-label={`Move page ${pageIndex + 1} up`}
                        className="kosh-button min-h-9 px-3"
                        disabled={position === 0}
                        onClick={() => movePage(position, -1)}
                        type="button"
                      >
                        <ArrowUp aria-hidden="true" size={15} />
                      </button>
                      <button
                        aria-label={`Move page ${pageIndex + 1} down`}
                        className="kosh-button min-h-9 px-3"
                        disabled={position === pageOrder.length - 1}
                        onClick={() => movePage(position, 1)}
                        type="button"
                      >
                        <ArrowDown aria-hidden="true" size={15} />
                      </button>
                      <button aria-label={`${removedPages.includes(pageIndex) ? 'Keep' : 'Remove'} page ${pageIndex + 1}`} className="kosh-button min-h-9 px-3" onClick={() => removePage(pageIndex)} type="button"><Trash2 aria-hidden="true" size={15} /></button>
                      <button
                        aria-label={`Add rotation for page ${pageIndex + 1}`}
                        className="kosh-button min-h-9 px-3"
                        onClick={() => rotatePage(pageIndex)}
                        type="button"
                      >
                        <RotateCw aria-hidden="true" size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <aside className="kosh-support-column">
            <section className="kosh-panel kosh-panel-muted" aria-labelledby="pdf-capabilities-title">
              <span className="kosh-eyebrow"><LockKeyhole aria-hidden="true" size={13} /> Local processing</span>
              <h2 className="mt-2 text-base font-semibold tracking-tight text-foreground" id="pdf-capabilities-title">What this workspace keeps</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <li>Page count and extractable text for archive search.</li>
                <li>The original PDF file, stored with your local record.</li>
                <li>Page order and rotation notes associated with the record.</li>
              </ul>
              <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                Merge, split, permanent rotation, redaction, and signature writing require a PDF editing engine that is not available in this build. This workspace does not alter PDF bytes or claim those changes were applied.
              </p>
            </section>

            <section className="kosh-panel" aria-labelledby="pdf-text-title">
              <h2 className="text-sm font-semibold text-foreground" id="pdf-text-title">Searchable text</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {searchableText.trim()
                  ? `${searchableText.trim().slice(0, 420)}${searchableText.trim().length > 420 ? '…' : ''}`
                  : 'No extractable text was found. The PDF record can still be saved and searched by its title.'}
              </p>
            </section>

            <button
              className="kosh-button w-full"
              onClick={() => {
                setFile(null)
                setTitle('')
                setPageCount(0)
                setPageOrder([])
                setPageRotations({})
                setSearchableText('')
                setMessage('')
                setError('')
              }}
              type="button"
            >
              <Trash2 aria-hidden="true" size={15} />
              Clear selection
            </button>
          </aside>
        </section>
      )}

      {message && <p aria-live="polite" className="text-sm leading-6 text-brand">{message}</p>}
      {error && <div aria-live="polite" className="kosh-alert">{error}</div>}
    </div>
  )
}