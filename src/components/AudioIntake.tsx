import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { AudioLines, FileAudio2, Mic, MicOff, ShieldCheck, Upload } from 'lucide-react'
import { koshDB } from '../lib/kosh-db'
import '../lib/local-transcriber'
import { isAudioFileSupported, transcribeAudio } from '../lib/transcription'
import type { TranscriptionProgress } from '../lib/transcription'
import type { KoshAudioFile, KoshMeeting } from '../lib/types'

export interface AudioIntakeProps {
  onCreated?: (meeting: KoshMeeting) => void
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `kosh-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function titleFromFile(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled meeting'
}

function extensionFor(file: Blob): string {
  if (file.type.includes('wav')) return 'wav'
  if (file.type.includes('mpeg') || file.type.includes('mp3')) return 'mp3'
  if (file.type.includes('webm')) return 'webm'
  if (file.type.includes('ogg')) return 'ogg'
  return 'm4a'
}

export default function AudioIntake({ onCreated }: AudioIntakeProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [dragging, setDragging] = useState(false)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const processAudio = async (file: File | Blob, fileName: string) => {
    if (busy) return
    setError('')
    setMessage('')
    setProgress({ status: 'processing', progress: 0, message: 'Saving audio to this device' })
    setBusy(true)

    const meetingId = createId()
    const audioId = createId()
    const now = new Date().toISOString()
    const mimeType = file.type || 'application/octet-stream'
    const audioFile: KoshAudioFile = {
      id: audioId,
      meetingId,
      name: fileName,
      mimeType,
      durationSeconds: 0,
      file,
      createdAt: now,
      updatedAt: now,
    }
    const initialMeeting: KoshMeeting = {
      id: meetingId,
      title: titleFromFile(fileName),
      meetingDate: now,
      durationSeconds: 0,
      preview: 'Audio saved on this device. Transcription has not completed.',
      summary: '',
      actionItems: [],
      notes: '',
      transcript: [],
      tagIds: [],
      audioId,
      transcriptionStatus: 'queued',
      createdAt: now,
      updatedAt: now,
    }

    try {
      await koshDB.put('audioFiles', audioFile)
      await koshDB.put('meetings', initialMeeting)
      setMessage('Audio saved on this device. Preparing local transcription…')

      try {
        const result = await transcribeAudio(file, {
          onProgress: setProgress,
        })
        const completed: KoshMeeting = {
          ...initialMeeting,
          durationSeconds: result.durationSeconds,
          preview: result.preview || 'Transcription complete. Add a summary or notes to this record.',
          transcript: result.segments,
          transcriptionStatus: 'complete',
          updatedAt: new Date().toISOString(),
        }
        const updatedAudio: KoshAudioFile = {
          ...audioFile,
          durationSeconds: result.durationSeconds,
          updatedAt: new Date().toISOString(),
        }
        await koshDB.put('audioFiles', updatedAudio)
        await koshDB.put('meetings', completed)
        onCreated?.(completed)
        setMessage('Meeting saved. Its transcript is ready in your archive.')
      } catch (transcriptionError) {
        const detail =
          transcriptionError instanceof Error
            ? transcriptionError.message
            : 'Local transcription could not be completed.'
        const savedMeeting: KoshMeeting = {
          ...initialMeeting,
          transcriptionStatus: 'error',
          transcriptionError: detail,
          preview: 'Audio saved on this device. Transcription is unavailable in this build.',
          updatedAt: new Date().toISOString(),
        }
        await koshDB.put('meetings', savedMeeting)
        onCreated?.(savedMeeting)
        setProgress({ status: 'error', progress: 0, message: 'Audio saved; transcription unavailable' })
        setError(detail)
      }
    } catch (saveError) {
      setProgress(null)
      setError(saveError instanceof Error ? saveError.message : 'The local archive could not save this audio.')
    } finally {
      setBusy(false)
    }
  }

  const handleFile = (file?: File) => {
    if (!file) return
    setError('')
    if (!isAudioFileSupported(file)) {
      setError('Choose an MP3, WAV, M4A, WebM, or Ogg audio file.')
      return
    }
    void processAudio(file, file.name)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    handleFile(event.dataTransfer.files?.[0])
  }

  const startRecording = async () => {
    setError('')
    setMessage('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Audio recording is not supported by this browser. Choose an MP3, WAV, or M4A file instead.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      streamRef.current = stream
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        setError('The recording could not be completed. Your archive has not been changed.')
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        setRecording(false)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        setRecording(false)
        if (blob.size > 0) {
          void processAudio(blob, `Meeting recording ${new Date().toLocaleString()}.${extensionFor(blob)}`)
        } else {
          setError('No audio was captured. Try recording again.')
        }
      }
      recorder.start()
      setRecording(true)
    } catch (recordError) {
      setError(
        recordError instanceof Error
          ? recordError.message
          : 'Microphone access was not available. Choose an audio file instead.',
      )
    }
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  return (
    <section aria-labelledby="audio-intake-title" className="kosh-panel kosh-panel-muted">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="kosh-eyebrow">
            <ShieldCheck aria-hidden="true" size={14} />
            Device-local audio
          </span>
          <h2 className="kosh-section-title mt-2" id="audio-intake-title">
            Add a spoken record
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            Record with your microphone or choose an MP3, WAV, M4A, WebM, or Ogg file. Audio is
            saved in this browser’s local archive.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Kosh does not currently join or capture Google Meet calls, so its microphone recorder
            won’t record the other participants’ meeting audio. For notes inside Meet, use Google’s{' '}
            <a
              className="font-medium text-foreground underline underline-offset-4"
              href="https://support.google.com/meet/answer/14754931?hl=en&co=GENIE.Platform%3DDesktop"
              rel="noreferrer"
              target="_blank"
            >
              “Take notes for me” feature
            </a>{' '}
            (available with eligible Google Workspace editions or Google AI plans). You can add a
            recording here for Kosh’s local transcription, including WebM audio downloaded from the
            Kosh Meet extension.
          </p>
        </div>
        <AudioLines aria-hidden="true" className="text-brand" size={22} />
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
        onDrop={onDrop}
      >
        <div className="kosh-empty-state-inner">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl border border-border bg-background text-brand">
            <FileAudio2 aria-hidden="true" size={20} />
          </div>
          <p className="text-sm font-semibold text-foreground">Drop an audio file to add it</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">MP3, WAV, M4A, WebM, and Ogg are supported</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              className="kosh-button kosh-button-primary"
              disabled={busy || recording}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              <Upload aria-hidden="true" size={16} />
              Choose audio
            </button>
            {recording ? (
              <button className="kosh-button kosh-button-danger" onClick={stopRecording} type="button">
                <MicOff aria-hidden="true" size={16} />
                Stop recording
              </button>
            ) : (
              <button
                className="kosh-button"
                disabled={busy}
                onClick={() => void startRecording()}
                type="button"
              >
                <Mic aria-hidden="true" size={16} />
                Record audio
              </button>
            )}
          </div>
          <input
            accept=".mp3,.wav,.m4a,.webm,.ogg,audio/mpeg,audio/wav,audio/mp4,audio/webm,audio/ogg"
            className="sr-only"
            onChange={(event) => {
              handleFile(event.currentTarget.files?.[0])
              event.currentTarget.value = ''
            }}
            ref={inputRef}
            type="file"
          />
        </div>
      </div>

      {recording && (
        <p aria-live="polite" className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-brand">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          Recording from your microphone. Stop when you are finished.
        </p>
      )}

      {busy && progress && (
        <div aria-live="polite" className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{progress.message}</span>
            <span className="tabular-nums">{Math.round(progress.progress)}%</span>
          </div>
          <div
            aria-label="Audio processing progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(progress.progress)}
            className="kosh-progress-track"
            role="progressbar"
          >
            <div className="kosh-progress-fill" style={{ width: `${Math.max(4, progress.progress)}%` }} />
          </div>
        </div>
      )}

      {message && !busy && <p aria-live="polite" className="mt-4 text-sm leading-6 text-brand">{message}</p>}
      {error && (
        <div aria-live="polite" className="kosh-alert mt-4">
          {error}
        </div>
      )}
    </section>
  )
}