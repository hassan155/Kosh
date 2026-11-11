import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  FileAudio2,
  Headphones,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import type { ActionItem, KoshAudioFile, KoshMeeting, KoshTag, TagColor } from '../lib/types'
import { koshDB } from '../lib/kosh-db'

const tagClasses: Record<TagColor, string> = {
  sage: 'kosh-tag-sage',
  blue: 'kosh-tag-blue',
  lilac: 'kosh-tag-lilac',
  ochre: 'kosh-tag-ochre',
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `kosh-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(date)
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

function formatTimecode(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainder = total % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export default function MeetingPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [meeting, setMeeting] = useState<KoshMeeting | null>(null)
  const [tags, setTags] = useState<KoshTag[]>([])
  const [audio, setAudio] = useState<KoshAudioFile | null>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [summaryDraft, setSummaryDraft] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [actionDraft, setActionDraft] = useState('')
  const [newTagDraft, setNewTagDraft] = useState('')
  const [newTagColor, setNewTagColor] = useState<TagColor>('sage')
  const audioRef = useRef<HTMLAudioElement>(null)

  const loadMeeting = useCallback(async () => {
    if (!id) {
      setMeeting(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const [meetingRow, tagRows] = await Promise.all([
        koshDB.get('meetings', id),
        koshDB.getAll('tags'),
      ])
      if (!meetingRow) {
        setMeeting(null)
        setTags(Array.isArray(tagRows) ? tagRows : [])
        setAudio(null)
        return
      }

      const safeMeeting: KoshMeeting = {
        ...meetingRow,
        actionItems: Array.isArray(meetingRow.actionItems) ? meetingRow.actionItems : [],
        transcript: Array.isArray(meetingRow.transcript) ? meetingRow.transcript : [],
        tagIds: Array.isArray(meetingRow.tagIds) ? meetingRow.tagIds : [],
      }
      const audioRows = await koshDB.getAll('audioFiles')
      const audioRow = safeMeeting.audioId
        ? await koshDB.get('audioFiles', safeMeeting.audioId)
        : audioRows.find((item) => item.meetingId === safeMeeting.id)
      setMeeting(safeMeeting)
      setTags(Array.isArray(tagRows) ? tagRows : [])
      setAudio(audioRow ?? null)
      setTitleDraft(safeMeeting.title || '')
      setSummaryDraft(safeMeeting.summary || '')
      setNotesDraft(safeMeeting.notes || '')
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'The meeting could not be opened from local storage.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadMeeting()
  }, [loadMeeting])

  useEffect(() => {
    if (!audio?.file || typeof URL === 'undefined') {
      setAudioUrl('')
      return
    }
    const url = URL.createObjectURL(audio.file)
    setAudioUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [audio])

  const persistMeeting = async (nextMeeting: KoshMeeting, successMessage: string) => {
    setSaving(true)
    setError('')
    setMessage('')
    const updated = { ...nextMeeting, updatedAt: new Date().toISOString() }
    setMeeting(updated)
    try {
      await koshDB.put('meetings', updated)
      setMessage(successMessage)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'This change could not be saved to the local archive.')
      await loadMeeting()
    } finally {
      setSaving(false)
    }
  }

  const saveDocumentFields = async () => {
    if (!meeting) return
    if (!titleDraft.trim()) {
      setError('A meeting headline is required.')
      return
    }
    await persistMeeting(
      {
        ...meeting,
        title: titleDraft.trim(),
        summary: summaryDraft.trim(),
        notes: notesDraft,
      },
      'Meeting details saved to this device.',
    )
  }

  const toggleAction = async (actionId: string) => {
    if (!meeting) return
    const nextItems = meeting.actionItems.map((item) =>
      item.id === actionId ? { ...item, done: !item.done } : item,
    )
    await persistMeeting({ ...meeting, actionItems: nextItems }, 'Action item updated.')
  }

  const removeAction = async (actionId: string) => {
    if (!meeting) return
    const nextItems = meeting.actionItems.filter((item) => item.id !== actionId)
    await persistMeeting({ ...meeting, actionItems: nextItems }, 'Action item removed.')
  }

  const addAction = async () => {
    if (!meeting || !actionDraft.trim()) return
    const item: ActionItem = {
      id: createId(),
      text: actionDraft.trim(),
      done: false,
    }
    setActionDraft('')
    await persistMeeting(
      { ...meeting, actionItems: [...meeting.actionItems, item] },
      'Action item added.',
    )
  }

  const toggleTag = async (tagId: string) => {
    if (!meeting) return
    const current = meeting.tagIds
    const nextIds = current.includes(tagId)
      ? current.filter((value) => value !== tagId)
      : [...current, tagId]
    await persistMeeting({ ...meeting, tagIds: nextIds }, 'Meeting tags updated.')
  }

  const createTag = async () => {
    if (!meeting || !newTagDraft.trim()) return
    const label = newTagDraft.trim()
    if (tags.some((tag) => tag.label.toLocaleLowerCase() === label.toLocaleLowerCase())) {
      setError('A tag with that label already exists.')
      return
    }
    const now = new Date().toISOString()
    const tag: KoshTag = {
      id: createId(),
      label,
      color: newTagColor,
      createdAt: now,
      updatedAt: now,
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await koshDB.put('tags', tag)
      const nextMeeting = {
        ...meeting,
        tagIds: [...meeting.tagIds, tag.id],
        updatedAt: new Date().toISOString(),
      }
      await koshDB.put('meetings', nextMeeting)
      setTags((current) => [...current, tag])
      setMeeting(nextMeeting)
      setNewTagDraft('')
      setMessage('Tag created and added to this meeting.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The tag could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const seekTo = (seconds: number) => {
    if (!audioRef.current || !Number.isFinite(seconds)) return
    audioRef.current.currentTime = Math.max(0, seconds)
    void audioRef.current.play().catch(() => {
      setMessage('Use the audio player controls to start playback.')
    })
  }

  if (loading) {
    return (
      <section aria-label="Loading meeting record" className="relative mx-auto w-full max-w-6xl space-y-7 py-8" role="status">
        <div className="kosh-skeleton h-4 w-28" />
        <div className="kosh-skeleton h-12 w-3/4 max-w-2xl" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="kosh-panel space-y-5">
            <div className="kosh-skeleton h-5 w-40" />
            <div className="kosh-skeleton h-24 w-full" />
            <div className="kosh-skeleton h-24 w-full" />
          </div>
          <div className="kosh-panel space-y-4">
            <div className="kosh-skeleton h-5 w-32" />
            <div className="kosh-skeleton h-12 w-full" />
            <div className="kosh-skeleton h-12 w-full" />
          </div>
        </div>
      </section>
    )
  }

  if (!meeting || error && !meeting) {
    return (
      <section className="relative mx-auto w-full max-w-6xl py-8" aria-labelledby="meeting-unavailable-heading">
        <div className="kosh-empty-state">
          <div className="kosh-empty-state-inner">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-border bg-background text-brand">
              <FileAudio2 aria-hidden="true" size={21} />
            </div>
            <h1 id="meeting-unavailable-heading">This meeting is unavailable</h1>
            <p>
              {error
                ? `The record could not be opened from local storage. ${error}`
                : 'This record may have been removed or is no longer available in this browser.'}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {error && <button className="kosh-button" onClick={() => void loadMeeting()} type="button">Retry</button>}
              <Link className="kosh-button kosh-button-primary" to="/">
                <ArrowLeft aria-hidden="true" size={15} />
                Back to warehouse
              </Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const selectedTags = tags.filter((tag) => meeting.tagIds.includes(tag.id))
  const transcript = Array.isArray(meeting.transcript) ? meeting.transcript : []
  const actionItems = Array.isArray(meeting.actionItems) ? meeting.actionItems : []

  return (
    <section className="relative mx-auto w-full max-w-6xl space-y-7 py-5 sm:py-8" aria-labelledby="meeting-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="kosh-button min-h-10 px-3" to="/">
          <ArrowLeft aria-hidden="true" size={15} />
          Warehouse
        </Link>
        <span className="kosh-eyebrow">
          <ShieldCheck aria-hidden="true" size={14} />
          Saved on this device
        </span>
      </div>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium tabular-nums text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <FileAudio2 aria-hidden="true" size={14} />
            Meeting record
          </span>
          <span>{formatDate(meeting.meetingDate || meeting.createdAt)}</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 aria-hidden="true" size={14} />
            {formatDuration(meeting.durationSeconds)}
          </span>
          {meeting.transcriptionStatus === 'complete' && (
            <span className="inline-flex items-center gap-1.5 text-brand">
              <CheckCircle2 aria-hidden="true" size={14} />
              Transcript ready
            </span>
          )}
        </div>
        <label className="sr-only" htmlFor="meeting-title-input">Meeting headline</label>
        <input
          className="kosh-document-title"
          id="meeting-title-input"
          maxLength={180}
          onChange={(event) => setTitleDraft(event.currentTarget.value)}
          placeholder="Meeting headline"
          value={titleDraft}
        />
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Edit the record, gather its working notes, and return to a passage by its timecode.
        </p>
      </header>

      {(error || message) && (
        <div aria-live="polite" className={error ? 'kosh-alert' : 'rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-6 text-brand'}>
          {error || message}
        </div>
      )}

      <div className="kosh-detail-layout">
        <div className="kosh-document-column space-y-5">
          <section className="kosh-panel" aria-labelledby="summary-heading">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="kosh-eyebrow">Record overview</span>
                <h2 className="kosh-section-title mt-2" id="summary-heading">Summary &amp; action items</h2>
              </div>
              <span className="kosh-timecode">{actionItems.filter((item) => !item.done).length} OPEN</span>
            </div>
            <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="meeting-summary">Summary</label>
            <textarea
              className="min-h-28 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground"
              id="meeting-summary"
              maxLength={12000}
              onChange={(event) => setSummaryDraft(event.currentTarget.value)}
              placeholder="Capture the decisions, context, and useful details from this conversation."
              value={summaryDraft}
            />

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-foreground">Action items</h3>
              {actionItems.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {actionItems.map((item) => (
                    <li className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3" key={item.id}>
                      <label className="mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
                        <input
                          aria-label={`${item.done ? 'Reopen' : 'Complete'} action: ${item.text}`}
                          checked={item.done}
                          className="h-4 w-4 accent-[var(--kosh-accent)]"
                          onChange={() => void toggleAction(item.id)}
                          type="checkbox"
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <p className={`break-words text-sm leading-6 ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {item.text}
                        </p>
                        {(item.assignee || item.dueDate) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[item.assignee, item.dueDate].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <button
                        aria-label={`Remove action: ${item.text}`}
                        className="kosh-button min-h-8 shrink-0 px-2.5"
                        disabled={saving}
                        onClick={() => void removeAction(item.id)}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-4 text-sm leading-6 text-muted-foreground">
                  No action items yet. Add the next step while it is still easy to find.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="sr-only" htmlFor="new-action-item">New action item</label>
                <input
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  id="new-action-item"
                  onChange={(event) => setActionDraft(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void addAction()
                    }
                  }}
                  placeholder="Add a next step"
                  value={actionDraft}
                />
                <button
                  className="kosh-button"
                  disabled={saving || !actionDraft.trim()}
                  onClick={() => void addAction()}
                  type="button"
                >
                  <Plus aria-hidden="true" size={15} />
                  Add item
                </button>
              </div>
            </div>
          </section>

          <section className="kosh-panel" aria-labelledby="transcript-heading">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="kosh-eyebrow">
                  <Headphones aria-hidden="true" size={14} />
                  Conversation index
                </span>
                <h2 className="kosh-section-title mt-2" id="transcript-heading">Transcript</h2>
              </div>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {transcript.length} {transcript.length === 1 ? 'passage' : 'passages'}
              </span>
            </div>

            {transcript.length > 0 ? (
              <ol className="kosh-transcript">
                {transcript.map((segment, index) => (
                  <li className="kosh-transcript-row" key={segment.id || `${segment.startSeconds}-${index}`}>
                    <button
                      aria-label={`Play from ${formatTimecode(segment.startSeconds)}`}
                      className="kosh-timecode mt-0.5 cursor-pointer transition-colors hover:border-brand hover:text-foreground"
                      disabled={!audioUrl}
                      onClick={() => seekTo(segment.startSeconds)}
                      type="button"
                    >
                      {formatTimecode(segment.startSeconds)}
                    </button>
                    <div className="min-w-0">
                      <p className="kosh-transcript-speaker">{segment.speaker?.trim() || 'Guest'}</p>
                      <p className="kosh-transcript-copy">{segment.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-6">
                <h3 className="text-sm font-semibold text-foreground">No transcript passages are available</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {meeting.transcriptionError || (meeting.transcriptionStatus === 'queued' || meeting.transcriptionStatus === 'processing'
                    ? 'Transcription has not finished for this recording.'
                    : 'This meeting has no transcript yet. Its notes and audio remain available here.')}
                </p>
              </div>
            )}
          </section>
        </div>

        <aside className="kosh-support-column">
          <section className="kosh-panel kosh-panel-muted" aria-labelledby="tags-heading">
            <span className="kosh-eyebrow">Organize this record</span>
            <h2 className="mt-2 text-base font-semibold tracking-tight text-foreground" id="tags-heading">Meeting tags</h2>
            <div aria-label="Select meeting tags" className="mt-4 flex flex-wrap gap-2">
              {tags.length > 0 ? tags.map((tag) => {
                const selected = meeting.tagIds.includes(tag.id)
                return (
                  <button
                    aria-pressed={selected}
                    className={`kosh-tag ${tagClasses[tag.color] ?? tagClasses.sage} cursor-pointer ring-offset-2 transition-all ${selected ? 'ring-2 ring-brand' : 'opacity-75 hover:opacity-100'}`}
                    key={tag.id}
                    onClick={() => void toggleTag(tag.id)}
                    type="button"
                  >
                    {selected && <Check aria-hidden="true" className="mr-1" size={12} />}
                    {tag.label}
                  </button>
                )
              }) : (
                <p className="text-sm leading-6 text-muted-foreground">Create a tag to begin organizing this archive.</p>
              )}
            </div>
            {selectedTags.length > 0 && (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {selectedTags.map((tag) => tag.label).join(' · ')}
              </p>
            )}
            <div className="mt-5 space-y-2 border-t border-border pt-4">
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="new-tag-label">Create a tag</label>
              <input
                className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                id="new-tag-label"
                maxLength={48}
                onChange={(event) => setNewTagDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void createTag()
                  }
                }}
                placeholder="e.g. Planning"
                value={newTagDraft}
              />
              <div className="flex flex-wrap gap-2">
                <label className="sr-only" htmlFor="new-tag-color">Tag color</label>
                <select
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  id="new-tag-color"
                  onChange={(event) => setNewTagColor(event.currentTarget.value as TagColor)}
                  value={newTagColor}
                >
                  <option value="sage">Sage</option>
                  <option value="blue">Blue</option>
                  <option value="lilac">Lilac</option>
                  <option value="ochre">Ochre</option>
                </select>
                <button
                  className="kosh-button min-h-10 px-3"
                  disabled={saving || !newTagDraft.trim()}
                  onClick={() => void createTag()}
                  type="button"
                >
                  <Plus aria-hidden="true" size={15} />
                  Create
                </button>
              </div>
            </div>
          </section>

          <section className="kosh-panel" aria-labelledby="audio-heading">
            <span className="kosh-eyebrow">
              <FileAudio2 aria-hidden="true" size={13} />
              Original recording
            </span>
            <h2 className="mt-2 text-base font-semibold tracking-tight text-foreground" id="audio-heading">Local audio</h2>
            {audioUrl ? (
              <>
                <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{audio?.name || 'Meeting audio'}</p>
                <audio
                  className="kosh-audio-player mt-4"
                  controls
                  preload="metadata"
                  ref={audioRef}
                  src={audioUrl}
                >
                  Audio playback is not supported by this browser.
                </audio>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Select a transcript timecode to jump to that passage.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                No audio file is attached to this meeting record.
              </p>
            )}
          </section>

          <section className="kosh-panel kosh-panel-muted" aria-labelledby="notes-heading">
            <span className="kosh-eyebrow">Working space</span>
            <h2 className="mt-2 text-base font-semibold tracking-tight text-foreground" id="notes-heading">Scratch notes</h2>
            <label className="sr-only" htmlFor="meeting-notes">Meeting notes</label>
            <textarea
              className="mt-3 min-h-40 w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground"
              id="meeting-notes"
              maxLength={20000}
              onChange={(event) => setNotesDraft(event.currentTarget.value)}
              placeholder="Keep follow-up context, questions, and details alongside the transcript."
              value={notesDraft}
            />
            <button
              className="kosh-button kosh-button-primary mt-3 w-full"
              disabled={saving || !titleDraft.trim()}
              onClick={() => void saveDocumentFields()}
              type="button"
            >
              <Save aria-hidden="true" size={15} />
              {saving ? 'Saving…' : 'Save meeting'}
            </button>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Headline, summary, and notes are saved together. Action items and tags save as you update them.
            </p>
          </section>

          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-brand" size={17} />
              <p className="text-xs leading-5 text-muted-foreground">
                This record and its attached audio are stored in the local archive for this browser.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Link className="kosh-button" to="/">
          <ArrowLeft aria-hidden="true" size={15} />
          Return to warehouse
        </Link>
        <span className="text-xs font-medium text-muted-foreground">
          {saving ? 'Saving local changes…' : 'Changes remain on this device'}
        </span>
      </div>
    </section>
  )
}