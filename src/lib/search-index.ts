import type {
  ArchiveFilter,
  ArchiveSearchOptions,
  ArchiveSearchResult,
  ArchiveSort,
  KoshMeeting,
  KoshPdf,
  KoshTag,
} from './types'

interface SearchDocument {
  id: string
  kind: 'meeting' | 'pdf'
  title: string
  body: string
  preview: string
  date: string
  durationSeconds?: number
  pageCount?: number
  tagIds: string[]
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  return normalize(value).split(' ').filter(Boolean)
}

// Small, bundled concept groups make search more forgiving without a remote
// embedding service or model download. Matching and indexing stay on-device.
const conceptGroups = [
  ['meeting', 'call', 'conversation', 'discussion', 'sync'],
  ['decision', 'decided', 'approved', 'agreement', 'conclusion'],
  ['task', 'action', 'todo', 'followup', 'next step', 'assignment'],
  ['deadline', 'due', 'date', 'schedule', 'timeline'],
  ['budget', 'cost', 'price', 'spend', 'expense', 'money'],
  ['customer', 'client', 'user', 'account', 'buyer'],
  ['problem', 'issue', 'blocker', 'risk', 'concern'],
  ['document', 'pdf', 'file', 'paper', 'report'],
  ['summary', 'notes', 'recap', 'minutes', 'transcript'],
  ['launch', 'release', 'ship', 'publish', 'rollout'],
] as const

function expandQueryTokens(query: string): string[] {
  const tokens = tokenize(query)
  const expanded = new Set(tokens)
  const normalizedQuery = normalize(query)

  for (const group of conceptGroups) {
    const terms = group.map(normalize)
    if (terms.some((term) => term.includes(' ') ? normalizedQuery.includes(term) : tokens.includes(term))) {
      for (const term of terms) for (const token of tokenize(term)) expanded.add(token)
    }
  }

  return Array.from(expanded)
}

function editDistance(left: string, right: string): number {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length
  if (Math.abs(left.length - right.length) > 2) return 3

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let row = 1; row <= left.length; row += 1) {
    const current = [row]
    let rowMinimum = row

    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1
      const value = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost,
      )
      current[column] = value
      rowMinimum = Math.min(rowMinimum, value)
    }

    if (rowMinimum > 2) return 3
    previous = current
  }

  return previous[right.length]
}

function scoreToken(queryToken: string, textTokens: string[]): number {
  let best = 0

  for (const textToken of textTokens) {
    if (queryToken === textToken) return 1
    if (textToken.startsWith(queryToken) || queryToken.startsWith(textToken)) {
      best = Math.max(best, 0.72)
      continue
    }

    if (queryToken.length >= 4 && textToken.length >= 4) {
      const distance = editDistance(queryToken, textToken)
      if (distance === 1) best = Math.max(best, 0.56)
      if (distance === 2) best = Math.max(best, 0.34)
    }
  }

  return best
}

function scoreDocument(query: string, document: SearchDocument): number {
  const queryTokens = tokenize(query)
  if (!queryTokens.length) return 1

  const titleTokens = tokenize(document.title)
  const previewTokens = tokenize(document.preview)
  const bodyTokens = tokenize(document.body)
  const allTokens = [...titleTokens, ...previewTokens, ...bodyTokens]
  if (allTokens.length === 0) return 0

  let total = 0
  for (const token of queryTokens) {
    const titleScore = scoreToken(token, titleTokens)
    const previewScore = scoreToken(token, previewTokens)
    const bodyScore = scoreToken(token, bodyTokens)
    const tokenScore = Math.max(titleScore * 1.8, previewScore * 1.3, bodyScore)
    if (tokenScore === 0) return 0
    total += tokenScore
  }

  // Related concepts improve ranking but are optional, so searching for
  // "call" can find a record titled "weekly sync" without requiring every
  // synonym in the record. This remains a small, entirely local index.
  const expandedTokens = expandQueryTokens(query).filter((token) => !queryTokens.includes(token))
  const relatedHits = expandedTokens.filter((token) =>
    allTokens.some((textToken) => scoreToken(token, [textToken]) > 0),
  ).length
  const normalizedQuery = normalize(query)
  const normalizedTitle = normalize(document.title)
  const exactPhraseBoost = normalizedTitle.includes(normalizedQuery) ? 0.8 : 0
  const relatedConceptBoost = expandedTokens.length
    ? Math.min(0.35, (relatedHits / expandedTokens.length) * 0.35)
    : 0

  return total / queryTokens.length + exactPhraseBoost + relatedConceptBoost
}

function makeMeetingDocument(meeting: KoshMeeting): SearchDocument {
  const transcriptText = Array.isArray(meeting.transcript)
    ? meeting.transcript.map((segment) => `${segment.speaker} ${segment.text}`).join(' ')
    : ''

  const actionText = Array.isArray(meeting.actionItems)
    ? meeting.actionItems.map((item) => `${item.text} ${item.assignee ?? ''}`).join(' ')
    : ''

  return {
    id: meeting.id,
    kind: 'meeting',
    title: meeting.title ?? '',
    body: [meeting.summary, meeting.notes, transcriptText, actionText].filter(Boolean).join(' '),
    preview: meeting.preview || meeting.summary || meeting.notes || transcriptText.slice(0, 180),
    date: meeting.meetingDate || meeting.createdAt,
    durationSeconds: Number.isFinite(meeting.durationSeconds) ? meeting.durationSeconds : 0,
    tagIds: Array.isArray(meeting.tagIds) ? meeting.tagIds : [],
  }
}

function makePdfDocument(pdf: KoshPdf): SearchDocument {
  return {
    id: pdf.id,
    kind: 'pdf',
    title: pdf.title ?? '',
    body: pdf.searchableText ?? '',
    preview: (pdf.searchableText ?? '').replace(/\s+/g, ' ').trim().slice(0, 180),
    date: pdf.pdfDate || pdf.createdAt,
    pageCount: Number.isFinite(pdf.pageCount) ? pdf.pageCount : 0,
    tagIds: Array.isArray(pdf.tagIds) ? pdf.tagIds : [],
  }
}

function withinDateRange(dateValue: string, options: ArchiveSearchOptions): boolean {
  if (!options.dateFrom && !options.dateTo) return true

  const time = Date.parse(dateValue)
  if (!Number.isFinite(time)) return false

  if (options.dateFrom) {
    const from = Date.parse(options.dateFrom)
    if (Number.isFinite(from) && time < from) return false
  }

  if (options.dateTo) {
    const to = Date.parse(options.dateTo)
    if (Number.isFinite(to)) {
      const endOfDay = new Date(to)
      if (options.dateTo.length <= 10) endOfDay.setHours(23, 59, 59, 999)
      if (time > endOfDay.getTime()) return false
    }
  }

  return true
}

function compareResults(sort: ArchiveSort, left: ArchiveSearchResult, right: ArchiveSearchResult): number {
  if (sort === 'alphabetical') return left.title.localeCompare(right.title)
  if (sort === 'oldest') return Date.parse(left.date) - Date.parse(right.date)
  if (sort === 'longest') {
    return (right.durationSeconds ?? right.pageCount ?? 0) - (left.durationSeconds ?? left.pageCount ?? 0)
  }
  return Date.parse(right.date) - Date.parse(left.date)
}

function toResult(document: SearchDocument, score: number): ArchiveSearchResult {
  return {
    id: document.id,
    kind: document.kind,
    title: document.title,
    preview: document.preview,
    date: document.date,
    durationSeconds: document.durationSeconds,
    pageCount: document.pageCount,
    tagIds: document.tagIds,
    score,
  }
}

export class SearchIndex {
  private documents = new Map<string, SearchDocument>()
  private tagLabels = new Map<string, string>()

  rebuild(meetings: KoshMeeting[], pdfs: KoshPdf[], tags: KoshTag[] = []): void {
    this.documents.clear()
    this.tagLabels.clear()

    for (const meeting of meetings) {
      if (meeting?.id) this.documents.set(`meeting:${meeting.id}`, makeMeetingDocument(meeting))
    }

    for (const pdf of pdfs) {
      if (pdf?.id) this.documents.set(`pdf:${pdf.id}`, makePdfDocument(pdf))
    }

    for (const tag of tags) {
      if (tag?.id) this.tagLabels.set(tag.id, tag.label ?? '')
    }
  }

  upsertMeeting(meeting: KoshMeeting): void {
    if (meeting?.id) this.documents.set(`meeting:${meeting.id}`, makeMeetingDocument(meeting))
  }

  upsertPdf(pdf: KoshPdf): void {
    if (pdf?.id) this.documents.set(`pdf:${pdf.id}`, makePdfDocument(pdf))
  }

  upsertTag(tag: KoshTag): void {
    if (tag?.id) this.tagLabels.set(tag.id, tag.label ?? '')
  }

  remove(kind: 'meeting' | 'pdf', id: string): void {
    this.documents.delete(`${kind}:${id}`)
  }

  removeTag(id: string): void {
    this.tagLabels.delete(id)
  }

  search(options: ArchiveSearchOptions = {}): ArchiveSearchResult[] {
    const query = options.query?.trim() ?? ''
    const filter = options.filter ?? 'all'
    const results: ArchiveSearchResult[] = []

    for (const document of this.documents.values()) {
      if (filter === 'meetings' && document.kind !== 'meeting') continue
      if (filter === 'pdfs' && document.kind !== 'pdf') continue
      if (filter === 'tags' && document.tagIds.length === 0) continue
      if (options.tagId && !document.tagIds.includes(options.tagId)) continue
      if (!withinDateRange(document.date, options)) continue

      const score = query ? scoreDocument(query, document) : 1
      if (query && score <= 0) continue

      results.push(toResult(document, score))
    }

    results.sort((left, right) => {
      if (query && right.score !== left.score) return right.score - left.score
      return compareResults(options.sort ?? 'newest', left, right)
    })

    return typeof options.limit === 'number' && options.limit >= 0
      ? results.slice(0, options.limit)
      : results
  }

  searchTags(query: string, limit = 20): KoshTag[] {
    const tokens = tokenize(query)
    const matches = Array.from(this.tagLabels.entries())
      .map(([id, label]) => {
        const normalizedLabel = normalize(label)
        const score = tokens.length
          ? tokens.reduce((sum, token) => sum + scoreToken(token, tokenize(normalizedLabel)), 0) /
            tokens.length
          : 1
        return { id, label, score }
      })
      .filter((tag) => tag.score > 0)
      .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
      .slice(0, Math.max(0, limit))

    return matches.map((tag) => ({
      id: tag.id,
      label: tag.label,
      color: 'sage',
      createdAt: '',
      updatedAt: '',
    }))
  }

  get size(): number {
    return this.documents.size
  }
}

export function buildSearchIndex(
  meetings: KoshMeeting[],
  pdfs: KoshPdf[],
  tags: KoshTag[] = [],
): SearchIndex {
  const index = new SearchIndex()
  index.rebuild(meetings, pdfs, tags)
  return index
}

export function searchArchive(
  meetings: KoshMeeting[],
  pdfs: KoshPdf[],
  options: ArchiveSearchOptions = {},
): ArchiveSearchResult[] {
  const index = buildSearchIndex(meetings, pdfs)
  return index.search(options)
}

export type { ArchiveFilter, ArchiveSearchOptions, ArchiveSearchResult, ArchiveSort }