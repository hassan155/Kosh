type TranscriptionWorkerRequest =
  | {
      type: 'availability'
      requestId?: string
    }
  | {
      type: 'transcribe'
      requestId?: string
      audio?: Blob
    }

type TranscriptionWorkerResponse =
  | {
      type: 'availability'
      requestId?: string
      available: false
      message: string
    }
  | {
      type: 'progress'
      requestId?: string
      status: 'error'
      progress: 0
      message: string
    }
  | {
      type: 'result'
      requestId?: string
      segments: []
      durationSeconds: number
      preview: string
    }

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<TranscriptionWorkerRequest>) => void) | null
  postMessage: (message: TranscriptionWorkerResponse) => void
}

const unavailableMessage =
  'A local transcription model is not available in this build. Audio has not been uploaded or sent to a speech service.'

workerScope.onmessage = (event) => {
  const request = event.data
  if (!request || typeof request !== 'object' || typeof request.type !== 'string') {
    workerScope.postMessage({
      type: 'progress',
      requestId: undefined,
      status: 'error',
      progress: 0,
      message: 'The transcription request was not valid.',
    })
    return
  }

  if (request.type === 'availability') {
    workerScope.postMessage({
      type: 'availability',
      requestId: request.requestId,
      available: false,
      message: unavailableMessage,
    })
    return
  }

  if (request.type === 'transcribe') {
    if (!(request.audio instanceof Blob) || request.audio.size === 0) {
      workerScope.postMessage({
        type: 'progress',
        requestId: request.requestId,
        status: 'error',
        progress: 0,
        message: 'Choose a non-empty audio file to transcribe.',
      })
      return
    }

    workerScope.postMessage({
      type: 'progress',
      requestId: request.requestId,
      status: 'error',
      progress: 0,
      message: unavailableMessage,
    })
    return
  }

  workerScope.postMessage({
    type: 'progress',
    requestId: 'requestId' in request ? request.requestId : undefined,
    status: 'error',
    progress: 0,
    message: 'That transcription operation is not supported.',
  })
}