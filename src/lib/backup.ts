import { koshDB } from './kosh-db'
import type { ArchiveBackup } from './types'

export interface BackupExportOptions {
  includeAudio?: boolean
  fileName?: string
}

export interface BackupImportResult {
  importedAt: string
  meetings: number
  pdfs: number
  tags: number
  audioFiles: number
}

const BACKUP_MIME_TYPE = 'application/json'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateBackupShape(value: unknown): asserts value is ArchiveBackup {
  if (!isRecord(value) || value.format !== 'kosh-archive' || value.version !== 1) {
    throw new Error('This file is not a supported Kosh archive backup.')
  }

  const stores = ['meetings', 'pdfs', 'tags', 'audioFiles', 'settings'] as const
  for (const store of stores) {
    const records = value[store]
    if (!Array.isArray(records)) {
      throw new Error(`The backup is missing its ${store} records.`)
    }

    for (const record of records) {
      if (!isRecord(record) || typeof record.id !== 'string' || record.id.length === 0) {
        throw new Error(`The backup contains an invalid ${store} record.`)
      }
    }
  }
}

function safeFileName(value: string): string {
  const base = value
    .trim()
    .replace(/\.json$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 100)

  return `${base || 'kosh-archive-backup'}.json`
}

export async function createBackup(
  options: BackupExportOptions = {},
): Promise<{ backup: ArchiveBackup; json: string; fileName: string }> {
  const json = await koshDB.exportBackupJson({
    includeAudio: options.includeAudio !== false,
  })

  let backup: unknown
  try {
    backup = JSON.parse(json) as unknown
  } catch {
    throw new Error('The local archive could not be encoded as a backup.')
  }

  if (!isRecord(backup) || backup.format !== 'kosh-archive' || backup.version !== 1) {
    throw new Error('The local archive returned an unsupported backup format.')
  }

  return {
    backup: backup as unknown as ArchiveBackup,
    json,
    fileName: safeFileName(options.fileName ?? 'kosh-archive-backup'),
  }
}

export async function exportBackup(options: BackupExportOptions = {}): Promise<void> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Backup downloads are not available in this environment.')
  }

  const { json, fileName } = await createBackup(options)
  const blob = new Blob([json], { type: BACKUP_MIME_TYPE })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  try {
    anchor.href = url
    anchor.download = fileName
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(url)
  }
}

export async function readBackupFile(file: File): Promise<ArchiveBackup> {
  if (!(file instanceof Blob) || file.size === 0) {
    throw new Error('Choose a non-empty JSON backup file.')
  }

  const lowerName = file instanceof File ? file.name.toLowerCase() : ''
  if (lowerName.endsWith('.zip')) {
    throw new Error('ZIP backups are not supported by this build. Choose a JSON archive backup.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text()) as unknown
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }

  validateBackupShape(parsed)
  return parsed
}

export async function importBackupFile(file: File): Promise<BackupImportResult> {
  const backup = await readBackupFile(file)
  await koshDB.importBackup(backup)

  return {
    importedAt: new Date().toISOString(),
    meetings: backup.meetings.length,
    pdfs: backup.pdfs.length,
    tags: backup.tags.length,
    audioFiles: backup.audioFiles.length,
  }
}

export async function downloadBackup(options: BackupExportOptions = {}): Promise<void> {
  await exportBackup(options)
}

export function formatBackupSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}