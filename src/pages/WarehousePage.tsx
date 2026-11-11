import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  ArrowDownWideNarrow,
  CalendarDays,
  FileAudio2,
  FileText,
  Filter,
  HardDrive,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import AudioIntake from '../components/AudioIntake'
import MeetingRecord from '../components/MeetingRecord'
import { AuroraBackground } from '../registry/kit/aceternity-aurora-background/components/ui/aurora-background'
import { KineticText } from '../registry/kit/magicui-kinetic-text/registry/magicui/kinetic-text'
import { buildSearchIndex } from '../lib/search-index'
import type { ArchiveFilter, ArchiveSort, KoshMeeting, KoshPdf, KoshTag } from '../lib/types'
import { koshDB } from '../lib/kosh-db'

type WarehouseFilter = ArchiveFilter
type RecordItem = { kind: 'meeting'; id: string } | { kind: 'pdf'; id: string }

const filters: { label: string; value: WarehouseFilter }[] = [
  { label: 'All records', value: 'all' },
  { label: 'Meetings', value: 'meetings' },
  { label: 'PDFs', value: 'pdfs' },
  { label: 'Tagged', value: 'tags' },
]

const sortOptions: { label: string; value: ArchiveSort }[] = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
  { label: 'Longest first', value: 'longest' },
  { label: 'Alphabetical', value: 'alphabetical' },
]

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Duration unavailable'
  const wholeSeconds = Math.floor(seconds)
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const remainder = wholeSeconds % 60
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m`
    : `${minutes}:${String(remainder).padStart(2, '0')}`
}

function PdfRecord({ pdf }: { pdf: KoshPdf }) {
  const preview = pdf.searchableText?.trim() || 'Open the PDF workspace to work with this document.'

  return (
    <Link
      aria-label={`Open PDF tools for ${pdf.title || 'Untitled document'}`}
      className="kosh-record-card kosh-motion-enter"
      to="/pdf-tools"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="kosh-eyebrow">
            <FileText aria-hidden="true" size={13} />
            PDF document
          </span>
          <h2 className="kosh-record-card-title mt-2">{pdf.title || 'Untitled document'}</h2>
        </div>
        <span className="kosh-timecode shrink-0">{pdf.pageCount} {pdf.pageCount === 1 ? 'PAGE' : 'PAGES'}</span>
      </div>
      <p className="kosh-record-preview">{preview}</p>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium tabular-nums text-muted-foreground">
        <span>{formatDate(pdf.pdfDate || pdf.createdAt)}</span>
        <span className="inline-flex items-center gap-1.5">
          <HardDrive aria-hidden="true" size={13} />
          Stored on this device
        </span>
      </div>
      <div className="mt-auto flex min-h-6 flex-wrap items-center gap-2">
        {pdf.tagIds.length > 0 ? (
          <span className="kosh-tag kosh-tag-sage">{pdf.tagIds.length} {pdf.tagIds.length === 1 ? 'tag' : 'tags'}</span>
        ) : (
          <span className="text-xs text-muted-foreground">No tags</span>
        )}
      </div>
    </Link>
  )
}

export default function WarehousePage() {
  const [meetings, setMeetings] = useState<KoshMeeting[]>([])
  const [pdfs, setPdfs] = useState<KoshPdf[]>([])
  const [tags, setTags] = useState<KoshTag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<WarehouseFilter>('all')
  const [sort, setSort] = useState<ArchiveSort>('newest')
  const [tagId, setTagId] = useState('')
  const [dateRangeOpen, setDateRangeOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const refreshArchive = async () => {
    setLoading(true)
    setError('')
    try {
      const [meetingRows, pdfRows, tagRows] = await Promise.all([
        koshDB.getAll('meetings'),
        koshDB.getAll('pdfs'),
        koshDB.getAll('tags'),
      ])
      setMeetings(Array.isArray(meetingRows) ? meetingRows : [])
      setPdfs(Array.isArray(pdfRows) ? pdfRows : [])
      setTags(Array.isArray(tagRows) ? tagRows : [])
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'The local archive could not be read.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshArchive()
  }, [])

  const index = useMemo(() => buildSearchIndex(meetings, pdfs, tags), [meetings, pdfs, tags])
  const results = useMemo(
    () =>
      index.search({
        query,
        filter,
        sort,
        tagId: tagId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [index, query, filter, sort, tagId, dateFrom, dateTo],
  )

  const records = useMemo<RecordItem[]>(() => {
    const meetingIds = new Set(meetings.map((meeting) => meeting.id))
    const pdfIds = new Set(pdfs.map((pdf) => pdf.id))
    return results.flatMap((result) => {
      if (result.kind === 'meeting' && meetingIds.has(result.id)) return [{ kind: 'meeting', id: result.id }]
      if (result.kind === 'pdf' && pdfIds.has(result.id)) return [{ kind: 'pdf', id: result.id }]
      return []
    })
  }, [results, meetings, pdfs])

  const handleMeetingCreated = () => {
    void refreshArchive()
  }

  return (
    <section className="relative overflow-clip" aria-labelledby="warehouse-heading">
      <AuroraBackground>
        <div className="relative z-10 mx-auto w-full max-w-6xl px-1 py-7 sm:px-2 sm:py-10">
          <div className="kosh-page-header mb-0">
            <div className="min-w-0">
              <span className="kosh-eyebrow">
                <Archive aria-hidden="true" size={14} />
                Your device-local archive
              </span>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-[-0.055em] text-foreground sm:text-5xl lg:text-6xl" id="warehouse-heading">
                <KineticText
                  className="text-foreground"
                  text="Keep meetings, notes, and PDFs on your device."
                />
              </h1>
              <p className="kosh-page-description mt-5 max-w-2xl text-base leading-7">
                Record or add audio for local transcription, search your archive, and work with PDFs
                without sending your files to a server.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a className="kosh-button kosh-button-primary" href="#audio-intake">
                  <FileAudio2 aria-hidden="true" size={16} />
                  Record or drop audio
                </a>
                <Link className="kosh-button" to="/pdf-tools">
                  <FileText aria-hidden="true" size={16} />
                  Open PDF tools
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border/80 pt-5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="text-brand" size={16} />
              Your archive stays in this browser
            </span>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <span className="tabular-nums">{loading ? 'Reading records…' : `${meetings.length + pdfs.length} ${meetings.length + pdfs.length === 1 ? 'record' : 'records'}`}</span>
          </div>
        </div>
      </AuroraBackground>

      <div className="mx-auto w-full max-w-6xl space-y-10 px-1 py-8 sm:px-2 sm:py-10">
        <section aria-labelledby="archive-search-heading" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="kosh-eyebrow">
                <Search aria-hidden="true" size={14} />
                Archive index
              </span>
              <h2 className="kosh-section-title mt-2 text-2xl" id="archive-search-heading">
                Find a record again
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Search meeting titles, notes, transcripts, and text extracted from PDFs.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground" htmlFor="archive-sort">
              <ArrowDownWideNarrow aria-hidden="true" size={15} />
              <span className="sr-only">Sort records</span>
              <select
                className="min-h-10 max-w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                id="archive-sort"
                onChange={(event) => setSort(event.currentTarget.value as ArchiveSort)}
                value={sort}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="kosh-search block" htmlFor="archive-search">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
            <span className="sr-only">Search your archive</span>
            <input
              autoComplete="off"
              id="archive-search"
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search titles, transcripts, notes, and PDF text"
              type="search"
              value={query}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div aria-label="Filter archive records" className="kosh-filter-row" role="group">
              {filters.map((item) => (
                <button
                  aria-pressed={filter === item.value}
                  className={`kosh-filter-pill${filter === item.value ? ' is-active' : ''}`}
                  key={item.value}
                  onClick={() => {
                    setFilter(item.value)
                    if (item.value !== 'tags') setTagId('')
                  }}
                  type="button"
                >
                  {item.value === 'all' && <Archive aria-hidden="true" size={13} />}
                  {item.value === 'meetings' && <FileAudio2 aria-hidden="true" size={13} />}
                  {item.value === 'pdfs' && <FileText aria-hidden="true" size={13} />}
                  {item.value === 'tags' && <Filter aria-hidden="true" size={13} />}
                  {item.label}
                </button>
              ))}
              <button
                aria-expanded={dateRangeOpen}
                aria-pressed={Boolean(dateFrom || dateTo)}
                className={`kosh-filter-pill${dateFrom || dateTo ? ' is-active' : ''}`}
                onClick={() => setDateRangeOpen((open) => !open)}
                type="button"
              >
                <CalendarDays aria-hidden="true" size={13} />
                Date range
              </button>
            </div>
            <span aria-live="polite" className="text-xs font-medium tabular-nums text-muted-foreground">
              {loading ? 'Updating results' : `${records.length} ${records.length === 1 ? 'result' : 'results'}`}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2" hidden={!dateRangeOpen}>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground" htmlFor="date-from">
              From
              <input
                className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                id="date-from"
                onChange={(event) => setDateFrom(event.currentTarget.value)}
                type="date"
                value={dateFrom}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground" htmlFor="date-to">
              Through
              <input
                className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                id="date-to"
                onChange={(event) => setDateTo(event.currentTarget.value)}
                type="date"
                value={dateTo}
              />
            </label>
          </div>

          {filter === 'tags' && tags.length > 0 && (
            <label className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground" htmlFor="archive-tag">
              <SlidersHorizontal aria-hidden="true" size={15} />
              Narrow to a tag
              <select
                className="min-h-10 min-w-0 max-w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                id="archive-tag"
                onChange={(event) => setTagId(event.currentTarget.value)}
                value={tagId}
              >
                <option value="">Any tag</option>
                {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.label}</option>)}
              </select>
            </label>
          )}
        </section>

        <section aria-labelledby="records-heading">
          <div className="kosh-section-heading">
            <div>
              <span className="kosh-eyebrow">Indexed locally</span>
              <h2 className="kosh-section-title mt-2" id="records-heading">Archive records</h2>
            </div>
            {!loading && !error && records.length > 0 && (
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {meetings.length} {meetings.length === 1 ? 'meeting' : 'meetings'} · {pdfs.length} {pdfs.length === 1 ? 'PDF' : 'PDFs'}
              </span>
            )}
          </div>

          {loading && (
            <div aria-label="Loading archive records" className="kosh-record-grid" role="status">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="kosh-panel min-h-[214px] space-y-4" key={index}>
                  <div className="kosh-skeleton h-3 w-24" />
                  <div className="kosh-skeleton h-5 w-3/4" />
                  <div className="kosh-skeleton h-4 w-full" />
                  <div className="kosh-skeleton h-4 w-2/3" />
                  <div className="kosh-skeleton mt-8 h-3 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div aria-live="polite" className="kosh-alert flex flex-wrap items-center justify-between gap-4">
              <span>The local archive could not be read. Your existing records have not been replaced. {error}</span>
              <button className="kosh-button" onClick={() => void refreshArchive()} type="button">Retry</button>
            </div>
          )}

          {!loading && !error && records.length > 0 && (
            <div className="kosh-record-grid" aria-live="polite">
              {records.map((record) => {
                if (record.kind === 'meeting') {
                  const meeting = meetings.find((item) => item.id === record.id)
                  return meeting ? <MeetingRecord key={`meeting:${record.id}`} meeting={meeting} tags={tags} /> : null
                }
                const pdf = pdfs.find((item) => item.id === record.id)
                return pdf ? <PdfRecord key={`pdf:${record.id}`} pdf={pdf} /> : null
              })}
            </div>
          )}

          {!loading && !error && records.length === 0 && (
            <div className="kosh-empty-state">
              <div className="kosh-empty-state-inner">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-border bg-background text-brand">
                  {meetings.length + pdfs.length === 0
                    ? <Archive aria-hidden="true" size={21} />
                    : <Search aria-hidden="true" size={21} />}
                </div>
                <h2>{meetings.length + pdfs.length === 0 ? 'Your archive is ready for its first record' : 'No records match this search'}</h2>
                <p>
                  {meetings.length + pdfs.length === 0
                    ? 'Add a recording or bring in a PDF. Your records are saved in this browser and remain available when you return.'
                    : 'Try another phrase, widen the date range, or clear a tag filter to see more of your archive.'}
                </p>
                {meetings.length + pdfs.length > 0 && (
                  <button
                    className="kosh-button mt-4"
                    onClick={() => {
                      setQuery('')
                      setFilter('all')
                      setTagId('')
                      setDateFrom('')
                      setDateTo('')
                    }}
                    type="button"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <div id="audio-intake">
          <AudioIntake onCreated={handleMeetingCreated} />
        </div>

        <section aria-labelledby="archive-privacy-heading" className="kosh-panel kosh-panel-muted">
          <div className="flex flex-wrap items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background text-brand">
              <ShieldCheck aria-hidden="true" size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold tracking-tight text-foreground" id="archive-privacy-heading">
                A quiet index, stored close
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Kosh keeps meeting records, audio, notes, and PDFs in this browser’s local archive.
                Search and filters work against those saved records; nothing here sends your files to a service.
              </p>
            </div>
            <Link className="kosh-button" to="/settings">
              <HardDrive aria-hidden="true" size={15} />
              Backup and storage
            </Link>
          </div>
        </section>
      </div>
    </section>
  )
}