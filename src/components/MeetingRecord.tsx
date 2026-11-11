import { Clock3, FileAudio2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { KoshMeeting, KoshTag, TagColor } from '../lib/types'

export interface MeetingRecordProps {
  meeting: KoshMeeting
  tags?: KoshTag[]
}

const tagClass: Record<TagColor, string> = {
  sage: 'kosh-tag-sage',
  blue: 'kosh-tag-blue',
  lilac: 'kosh-tag-lilac',
  ochre: 'kosh-tag-ochre',
}

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
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function formatTimecode(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export default function MeetingRecord({ meeting, tags = [] }: MeetingRecordProps) {
  const safeMeeting = meeting
  const meetingTags = Array.isArray(safeMeeting.tagIds)
    ? safeMeeting.tagIds
        .map((tagId) => tags.find((tag) => tag?.id === tagId))
        .filter((tag): tag is KoshTag => Boolean(tag))
    : []
  const firstSegment = Array.isArray(safeMeeting.transcript)
    ? safeMeeting.transcript.find((segment) => typeof segment?.text === 'string' && segment.text.trim())
    : undefined
  const preview =
    safeMeeting.preview?.trim() ||
    firstSegment?.text?.trim() ||
    safeMeeting.summary?.trim() ||
    safeMeeting.notes?.trim() ||
    'Open this meeting to add a summary, notes, and transcript.'

  return (
    <Link
      aria-label={`Open meeting: ${safeMeeting.title || 'Untitled meeting'}`}
      className="kosh-record-card kosh-motion-enter"
      to={`/meetings/${encodeURIComponent(safeMeeting.id)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="kosh-eyebrow">
            <FileAudio2 aria-hidden="true" size={13} />
            Meeting
          </span>
          <h2 className="kosh-record-card-title mt-2">{safeMeeting.title || 'Untitled meeting'}</h2>
        </div>
        {firstSegment && (
          <span aria-label={`Transcript begins at ${formatTimecode(firstSegment.startSeconds)}`} className="kosh-timecode shrink-0">
            {formatTimecode(firstSegment.startSeconds)}
          </span>
        )}
      </div>

      <p className="kosh-record-preview">{preview}</p>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium tabular-nums text-muted-foreground">
        <span>{formatDate(safeMeeting.meetingDate || safeMeeting.createdAt)}</span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 aria-hidden="true" size={13} />
          {formatDuration(safeMeeting.durationSeconds)}
        </span>
      </div>

      <div className="mt-auto flex min-h-6 flex-wrap items-center gap-2">
        {meetingTags.length > 0 ? (
          meetingTags.slice(0, 4).map((tag) => (
            <span className={`kosh-tag ${tagClass[tag.color] ?? tagClass.sage}`} key={tag.id}>
              {tag.label}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">No tags</span>
        )}
        {safeMeeting.transcriptionStatus === 'processing' && (
          <span className="ml-auto text-xs font-medium text-brand">Transcribing</span>
        )}
        {safeMeeting.transcriptionStatus === 'error' && (
          <span className="ml-auto text-xs font-medium text-muted-foreground">Audio saved</span>
        )}
      </div>
    </Link>
  )
}