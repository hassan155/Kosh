import type { TranscriptSegment, TranscriptionStatus } from './types'

export interface TranscriptionProgress {
  status: TranscriptionStatus
  progress: number
  message: string
}

export interface LocalTranscriber {
  transcribe(
    audio: Blob,
    options: {
      signal?: AbortSignal
      onProgress?: (progress: TranscriptionProgress) => void
    },
  ): Promise<TranscriptSegment[]>
}

export interface TranscriptionResult {
  segments: TranscriptSegment[]
  durationSeconds: number
  preview: string
}

type LocalTranscriberFactory = () => LocalTranscriber | Promise<LocalTranscriber>

let transcriberFactory: LocalTranscriberFactory | null = null

export function registerLocalTranscriber(factory: LocalTranscriberFactory): () => void {
  transcriberFactory = factory
  return () => {
    if (transcriberFactory === factory) transcriberFactory = null
  }
}

export function isAudioFileSupported(file: Pick<File, 'type' | 'name'>): boolean {
  const extension = file.name.toLowerCase().split('.').pop()
  return (
    file.type === 'audio/mpeg' ||
    file.type === 'audio/mp3' ||
    file.type === 'audio/wav' ||
    file.type === 'audio/x-wav' ||
    file.type === 'audio/wave' ||
    file.type === 'audio/mp4' ||
    file.type === 'audio/x-m4a' ||
    file.type === 'audio/webm' ||
    file.type === 'audio/ogg' ||
    extension === 'mp3' ||
    extension === 'wav' ||
    extension === 'm4a' ||
    extension === 'webm' ||
    extension === 'ogg'
  )
}

export function getTranscriptionAvailability(): {
  available: boolean
  message: string
} {
  if (!transcriberFactory) {
    return {
      available: false,
      message:
        'A local transcription model is not available in this build. Your audio has not been uploaded or sent to a speech service.',
    }
  }

  return {
    available: true,
    message: 'A local transcription engine is ready.',
  }
}

function assertSegments(value: unknown): asserts value is TranscriptSegment[] {
  if (!Array.isArray(value)) {
    throw new Error('The local transcription engine returned an invalid transcript.')
  }

  for (const segment of value) {
    if (
      typeof segment !== 'object' ||
      segment === null ||
      typeof segment.id !== 'string' ||
      typeof segment.speaker !== 'string' ||
      typeof segment.text !== 'string' ||
      !Number.isFinite(segment.startSeconds) ||
      !Number.isFinite(segment.endSeconds)
    ) {
      throw new Error('The local transcription engine returned an invalid transcript segment.')
    }
  }
}

function getAudioDuration(audio: Blob, signal?: AbortSignal): Promise<number> {
  if (typeof document === 'undefined') return Promise.resolve(0)

  return new Promise((resolve, reject) => {
    const element = document.createElement('audio')
    const url = URL.createObjectURL(audio)
    let settled = false

    const cleanup = () => {
      element.removeAttribute('src')
      element.load()
      URL.revokeObjectURL(url)
      signal?.removeEventListener('abort', abort)
    }

    const finish = (duration: number) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(Number.isFinite(duration) && duration > 0 ? duration : 0)
    }

    const fail = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve(0)
    }

    const abort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new DOMException('Audio inspection was cancelled.', 'AbortError'))
    }

    signal?.addEventListener('abort', abort, { once: true })
    element.preload = 'metadata'
    element.onloadedmetadata = () => finish(element.duration)
    element.onerror = fail
    element.src = url
  })
}

export async function transcribeAudio(
  audio: Blob,
  options: {
    signal?: AbortSignal
    onProgress?: (progress: TranscriptionProgress) => void
  } = {},
): Promise<TranscriptionResult> {
  if (!(audio instanceof Blob) || audio.size === 0) {
    throw new Error('Choose a non-empty audio file to transcribe.')
  }

  if (options.signal?.aborted) {
    throw new DOMException('Transcription was cancelled.', 'AbortError')
  }

  const factory = transcriberFactory
  if (!factory) {
    throw new Error(
      'A local transcription model is not available in this build. Your audio has not been uploaded or sent to a speech service.',
    )
  }

  options.onProgress?.({
    status: 'processing',
    progress: 0,
    message: 'Preparing audio for local transcription',
  })

  const [engine, durationSeconds] = await Promise.all([
    factory(),
    getAudioDuration(audio, options.signal),
  ])

  if (options.signal?.aborted) {
    throw new DOMException('Transcription was cancelled.', 'AbortError')
  }

  const segments = await engine.transcribe(audio, {
    signal: options.signal,
    onProgress: (update) => {
      const progress = Math.min(99, Math.max(0, Number(update.progress) || 0))
      options.onProgress?.({
        status: update.status === 'error' ? 'error' : 'processing',
        progress,
        message: update.message || 'Transcribing on this device',
      })
    },
  })

  assertSegments(segments)

  const normalizedSegments = segments
    .map((segment, index) => ({
      ...segment,
      id: segment.id || `segment-${index + 1}`,
      speaker: segment.speaker.trim() || 'Guest',
      text: segment.text.trim(),
      startSeconds: Math.max(0, segment.startSeconds),
      endSeconds: Math.max(segment.startSeconds, segment.endSeconds),
    }))
    .filter((segment) => segment.text.length > 0)
    .sort((left, right) => left.startSeconds - right.startSeconds)

  options.onProgress?.({
    status: 'complete',
    progress: 100,
    message: 'Local transcription complete',
  })

  return {
    segments: normalizedSegments,
    durationSeconds,
    preview: normalizedSegments
      .slice(0, 3)
      .map((segment) => segment.text)
      .join(' ')
      .slice(0, 240),
  }
}