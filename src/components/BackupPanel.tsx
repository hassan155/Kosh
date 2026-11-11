import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  Archive,
  Download,
  FileInput,
  HardDrive,
  Info,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import {
  exportBackup,
  formatBackupSize,
  importBackupFile,
} from '../lib/backup'
import { koshDB } from '../lib/kosh-db'
import type { BackupImportResult } from '../lib/backup'

interface StorageSummary {
  bytes: number
  availableBytes: number | null
  meetings: number
  pdfs: number
  tags: number
  audioFiles: number
}

function emptySummary(): StorageSummary {
  return {
    bytes: 0,
    availableBytes: null,
    meetings: 0,
    pdfs: 0,
    tags: 0,
    audioFiles: 0,
  }
}

export default function BackupPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [includeAudio, setIncludeAudio] = useState(true)
  const [summary, setSummary] = useState<StorageSummary>(emptySummary())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [importResult, setImportResult] = useState<BackupImportResult | null>(null)
  const [usageOpen, setUsageOpen] = useState(false)

  const refreshSummary = async () => {
    setLoading(true)
    setError('')
    try {
      const [usage, meetings, pdfs, tags, audioFiles] = await Promise.all([
        koshDB.estimateUsage(),
        koshDB.count('meetings'),
        koshDB.count('pdfs'),
        koshDB.count('tags'),
        koshDB.count('audioFiles'),
      ])
      setSummary({
        bytes: usage.bytes,
        availableBytes: usage.availableBytes,
        meetings,
        pdfs,
        tags,
        audioFiles,
      })
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'Local storage information could not be read.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshSummary()
  }, [])

  const handleExport = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await exportBackup({ includeAudio })
      setMessage(includeAudio
        ? 'Your JSON archive backup has been downloaded with audio files included.'
        : 'Your JSON archive backup has been downloaded without audio files.')
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'The archive backup could not be exported.')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setBusy(true)
    setError('')
    setMessage('')
    setImportResult(null)
    try {
      const result = await importBackupFile(file)
      setImportResult(result)
      setMessage('Backup imported. The archive now contains the records from that file.')
      await refreshSummary()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'The selected backup could not be imported.')
    } finally {
      setBusy(false)
    }
  }

  const closeUsageDialog = () => setUsageOpen(false)

  return (
    <div className="space-y-8">
      <section className="kosh-panel kosh-panel-muted" aria-labelledby="backup-heading">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="kosh-eyebrow"><ShieldCheck aria-hidden="true" size={14} /> Device-local portability</span>
            <h2 className="kosh-section-title mt-2" id="backup-heading">Move your archive with you</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Export a JSON backup to keep a copy of your records, or import a supported Kosh JSON backup into this device.
              Import replaces the current local archive.
            </p>
          </div>
          <Archive aria-hidden="true" className="text-brand" size={23} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-center gap-2 text-foreground">
              <Download aria-hidden="true" className="text-brand" size={18} />
              <h3 className="text-base font-semibold tracking-tight">Export a backup</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Download your meetings, PDFs, tags, settings, and optionally their attached audio files.
            </p>
            <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-surface p-3 text-sm leading-5 text-foreground">
              <input
                checked={includeAudio}
                className="mt-1 accent-[var(--kosh-accent)]"
                onChange={(event) => setIncludeAudio(event.currentTarget.checked)}
                type="checkbox"
              />
              <span>
                Include audio files
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">Backups can be larger when recordings are included.</span>
              </span>
            </label>
            <button
              className="kosh-button kosh-button-primary mt-4 w-full"
              disabled={busy || loading}
              onClick={() => void handleExport()}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              {busy ? 'Preparing backup…' : 'Download JSON backup'}
            </button>
          </article>

          <article className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-center gap-2 text-foreground">
              <FileInput aria-hidden="true" className="text-brand" size={18} />
              <h3 className="text-base font-semibold tracking-tight">Import a backup</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Select a Kosh JSON archive backup. The file is validated before import; a successful import replaces the records on this device.
            </p>
            <div className="mt-4 rounded-lg border border-border bg-surface p-3 text-xs leading-5 text-muted-foreground">
              Keep a separate export if you want to preserve the archive currently on this device.
            </div>
            <button
              className="kosh-button mt-4 w-full"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              <Upload aria-hidden="true" size={16} />
              {busy ? 'Working…' : 'Choose JSON backup'}
            </button>
            <input
              accept=".json,application/json"
              className="sr-only"
              onChange={(event) => void handleImport(event)}
              ref={inputRef}
              type="file"
            />
          </article>
        </div>
      </section>

      <section className="kosh-panel" aria-labelledby="storage-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="kosh-eyebrow"><HardDrive aria-hidden="true" size={14} /> Local archive status</span>
            <h2 className="kosh-section-title mt-2" id="storage-heading">Storage on this device</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Usage is measured from browser storage when available. Counts are read from the local archive.
            </p>
          </div>
          <button
            aria-label="Refresh storage information"
            className="kosh-button min-h-10 px-3"
            disabled={loading}
            onClick={() => void refreshSummary()}
            type="button"
          >
            <RefreshCw aria-hidden="true" className={loading ? 'animate-spin' : ''} size={15} />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Meetings', value: summary.meetings },
            { label: 'PDF records', value: summary.pdfs },
            { label: 'Tags', value: summary.tags },
            { label: 'Audio files', value: summary.audioFiles },
          ].map((item) => (
            <div className="rounded-xl border border-border bg-surface p-4" key={item.label}>
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {loading ? '—' : item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{loading ? 'Measuring local storage…' : formatBackupSize(summary.bytes)}</p>
            <p className="text-xs leading-5 text-muted-foreground">
              {summary.availableBytes === null
                ? 'Browser quota details are not available.'
                : `${formatBackupSize(summary.availableBytes)} estimated remaining browser storage`}
            </p>
          </div>
          <button
            className="kosh-button"
            onClick={() => setUsageOpen(true)}
            type="button"
          >
            <Info aria-hidden="true" size={15} />
            Storage details
          </button>
        </div>
      </section>

      <section className="kosh-panel kosh-panel-muted" aria-labelledby="privacy-heading">
        <div className="flex items-start gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-brand" size={19} />
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground" id="privacy-heading">A backup is a file you control</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Kosh keeps its archive in this browser’s local storage. Export creates a file on your device; importing reads the selected file into this archive. Keep backups somewhere you trust.
            </p>
          </div>
        </div>
      </section>

      {message && (
        <div aria-live="polite" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-6 text-brand">
          {message}
          {importResult && (
            <span className="mt-1 block text-xs text-muted-foreground">
              Imported {importResult.meetings} meetings, {importResult.pdfs} PDFs, {importResult.tags} tags, and {importResult.audioFiles} audio files.
            </span>
          )}
        </div>
      )}
      {error && <div aria-live="polite" className="kosh-alert">{error}</div>}

      {usageOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-primary/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeUsageDialog()
          }}
        >
          <section
            aria-labelledby="storage-dialog-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-2xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="kosh-eyebrow"><HardDrive aria-hidden="true" size={13} /> Measured browser storage</span>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground" id="storage-dialog-title">Storage details</h2>
              </div>
              <button
                aria-label="Close storage details"
                className="kosh-button min-h-9 px-3"
                onClick={closeUsageDialog}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3 text-sm">
                <span className="text-muted-foreground">Measured browser usage</span>
                <strong className="tabular-nums text-foreground">{loading ? 'Measuring…' : formatBackupSize(summary.bytes)}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3 text-sm">
                <span className="text-muted-foreground">Meetings</span>
                <strong className="tabular-nums text-foreground">{summary.meetings}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3 text-sm">
                <span className="text-muted-foreground">PDF records</span>
                <strong className="tabular-nums text-foreground">{summary.pdfs}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3 text-sm">
                <span className="text-muted-foreground">Audio files</span>
                <strong className="tabular-nums text-foreground">{summary.audioFiles}</strong>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Browser usage may include other sites and browser data. This estimate is not a Kosh-only storage quota.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}