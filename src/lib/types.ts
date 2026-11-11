export type TagColor = 'sage' | 'blue' | 'lilac' | 'ochre'
export type ArchiveKind = 'meeting' | 'pdf'
export type TranscriptionStatus = 'queued' | 'processing' | 'complete' | 'error'
export type ThemePreference = 'light' | 'dark' | 'system'

export interface ArchiveEntity {
  id: string
  createdAt: string
  updatedAt: string
}

export interface TranscriptSegment {
  id: string
  startSeconds: number
  endSeconds: number
  speaker: string
  text: string
}

export interface ActionItem {
  id: string
  text: string
  done: boolean
  assignee?: string
  dueDate?: string
}

export interface KoshTag extends ArchiveEntity {
  label: string
  color: TagColor
}

export interface KoshMeeting extends ArchiveEntity {
  title: string
  meetingDate: string
  durationSeconds: number
  preview: string
  summary: string
  actionItems: ActionItem[]
  notes: string
  transcript: TranscriptSegment[]
  tagIds: string[]
  audioId?: string
  transcriptionStatus: TranscriptionStatus
  transcriptionError?: string
}

export interface KoshPdf extends ArchiveEntity {
  title: string
  pdfDate: string
  pageCount: number
  searchableText: string
  tagIds: string[]
  file: Blob
  pageOrder: number[]
  pageRotations: Record<number, number>
  redactions: PdfRedaction[]
  signatures: PdfSignature[]
}

export interface PdfRedaction {
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

export interface PdfSignature {
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  text?: string
  imageData?: string
}

export interface KoshAudioFile extends ArchiveEntity {
  meetingId?: string
  name: string
  mimeType: string
  durationSeconds: number
  file: Blob
}

export interface KoshSettings extends ArchiveEntity {
  theme: ThemePreference
  preferences: {
    includeAudioInBackup: boolean
    defaultSort: 'newest' | 'oldest' | 'longest' | 'alphabetical'
  }
}

export interface ArchiveStoreMap {
  meetings: KoshMeeting
  pdfs: KoshPdf
  tags: KoshTag
  audioFiles: KoshAudioFile
  settings: KoshSettings
}

export type ArchiveStoreName = keyof ArchiveStoreMap

export interface ArchiveBackup {
  format: 'kosh-archive'
  version: 1
  exportedAt: string
  meetings: KoshMeeting[]
  pdfs: KoshPdf[]
  tags: KoshTag[]
  audioFiles: KoshAudioFile[]
  settings: KoshSettings[]
}

export interface ArchiveSearchResult {
  id: string
  kind: ArchiveKind
  title: string
  preview: string
  date: string
  durationSeconds?: number
  pageCount?: number
  tagIds: string[]
  score: number
}

export type ArchiveFilter = 'all' | 'meetings' | 'pdfs' | 'tags'

export type ArchiveSort = 'newest' | 'oldest' | 'longest' | 'alphabetical'

export interface ArchiveSearchOptions {
  query?: string
  filter?: ArchiveFilter
  tagId?: string
  dateFrom?: string
  dateTo?: string
  sort?: ArchiveSort
  limit?: number
}