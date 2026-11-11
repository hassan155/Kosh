import { SearchIndex } from '../lib/search-index'
import type {
  ArchiveSearchOptions,
  KoshMeeting,
  KoshPdf,
  KoshTag,
} from '../lib/types'

type SearchWorkerRequest =
  | {
      type: 'rebuild'
      requestId?: string
      meetings: KoshMeeting[]
      pdfs: KoshPdf[]
      tags?: KoshTag[]
    }
  | {
      type: 'search'
      requestId?: string
      options?: ArchiveSearchOptions
    }
  | {
      type: 'search-tags'
      requestId?: string
      query?: string
      limit?: number
    }

type SearchWorkerResponse =
  | {
      type: 'rebuilt'
      requestId?: string
      size: number
    }
  | {
      type: 'results'
      requestId?: string
      results: ReturnType<SearchIndex['search']>
    }
  | {
      type: 'tags'
      requestId?: string
      tags: ReturnType<SearchIndex['searchTags']>
    }
  | {
      type: 'error'
      requestId?: string
      message: string
    }

let index = new SearchIndex()

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<SearchWorkerRequest>) => void) | null
  postMessage: (message: SearchWorkerResponse) => void
}

workerScope.onmessage = (event) => {
  const request = event.data
  if (!request || typeof request !== 'object' || typeof request.type !== 'string') {
    workerScope.postMessage({
      type: 'error',
      message: 'The search request was not valid.',
    })
    return
  }

  try {
    if (request.type === 'rebuild') {
      if (!Array.isArray(request.meetings) || !Array.isArray(request.pdfs)) {
        throw new Error('Search records must be supplied as meeting and PDF lists.')
      }

      index = new SearchIndex()
      index.rebuild(request.meetings, request.pdfs, Array.isArray(request.tags) ? request.tags : [])
      workerScope.postMessage({
        type: 'rebuilt',
        requestId: request.requestId,
        size: index.size,
      })
      return
    }

    if (request.type === 'search') {
      const options =
        request.options && typeof request.options === 'object'
          ? request.options
          : ({} satisfies ArchiveSearchOptions)

      workerScope.postMessage({
        type: 'results',
        requestId: request.requestId,
        results: index.search(options),
      })
      return
    }

    if (request.type === 'search-tags') {
      workerScope.postMessage({
        type: 'tags',
        requestId: request.requestId,
        tags: index.searchTags(
          typeof request.query === 'string' ? request.query : '',
          typeof request.limit === 'number' && Number.isFinite(request.limit)
            ? Math.max(0, Math.floor(request.limit))
            : 20,
        ),
      })
      return
    }

    workerScope.postMessage({
      type: 'error',
      requestId: 'requestId' in request ? request.requestId : undefined,
      message: 'That search operation is not supported.',
    })
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      requestId: 'requestId' in request ? request.requestId : undefined,
      message: error instanceof Error ? error.message : 'The local search could not be completed.',
    })
  }
}