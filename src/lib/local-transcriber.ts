import { env, pipeline } from '@huggingface/transformers'
import type { TranscriptSegment } from './types'
import { registerLocalTranscriber } from './transcription'

// Model assets are cached by the browser after first use; inference and audio
// remain on-device. No transcript or recording is sent to a service.
env.allowRemoteModels = true
env.useBrowserCache = true

type AsrResult = {
  text?: string
  chunks?: Array<{ text?: string; timestamp?: [number | null, number | null] }>
}
type AsrPipeline = (audio: Float32Array, options: Record<string, unknown>) => Promise<AsrResult>

let modelPromise: Promise<AsrPipeline> | null = null

function loadModel(onProgress?: (message: string, progress: number) => void): Promise<AsrPipeline> {
  if (!modelPromise) {
    modelPromise = pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (event: { status?: string; progress?: number; file?: string }) => {
        const progress = Math.max(0, Math.min(100, Number(event.progress) || 0))
        if (event.status === 'progress') {
          onProgress?.(`Preparing local speech model${event.file ? ` · ${event.file.split('/').pop()}` : ''}`, progress)
        }
      },
    }).then((asr) => asr as unknown as AsrPipeline).catch((error) => {
      modelPromise = null
      throw error
    })
  }
  return modelPromise
}

async function toMono16k(audio: Blob): Promise<Float32Array> {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) throw new Error('Audio decoding is not available in this browser.')
  const context = new AudioContextClass()
  try {
    const decoded = await context.decodeAudioData(await audio.arrayBuffer())
    const length = Math.ceil(decoded.duration * 16000)
    const mono = new Float32Array(length)
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index))
    for (let i = 0; i < length; i += 1) {
      const sourcePosition = i * decoded.sampleRate / 16000
      const left = Math.floor(sourcePosition)
      const fraction = sourcePosition - left
      let sample = 0
      for (const channel of channels) {
        const a = channel[Math.min(left, channel.length - 1)] || 0
        const b = channel[Math.min(left + 1, channel.length - 1)] || 0
        sample += a + (b - a) * fraction
      }
      mono[i] = sample / channels.length
    }
    return mono
  } finally {
    await context.close()
  }
}

registerLocalTranscriber(() => ({
  async transcribe(audio, options) {
    const abort = () => { throw new DOMException('Transcription was cancelled.', 'AbortError') }
    if (options.signal?.aborted) abort()
    options.onProgress?.({ status: 'processing', progress: 2, message: 'Preparing local speech model' })
    const asr = await loadModel((message, progress) => {
      options.onProgress?.({ status: 'processing', progress: Math.min(45, progress * 0.45), message })
    })
    if (options.signal?.aborted) abort()
    options.onProgress?.({ status: 'processing', progress: 48, message: 'Transcribing audio on this device' })
    const samples = await toMono16k(audio)
    if (options.signal?.aborted) abort()
    const result = await asr(samples, {
      sampling_rate: 16000,
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
    })
    if (options.signal?.aborted) abort()
    const chunks = result.chunks?.length ? result.chunks : [{ text: result.text || '', timestamp: [0, samples.length / 16000] as [number, number] }]
    return chunks.map((chunk, index): TranscriptSegment => ({
      id: `local-${index + 1}`,
      startSeconds: Math.max(0, Number(chunk.timestamp?.[0]) || 0),
      endSeconds: Math.max(0, Number(chunk.timestamp?.[1]) || 0),
      speaker: 'Me',
      text: (chunk.text || '').trim(),
    })).filter((segment) => segment.text.length > 0)
  },
}))
