import type {
  ArchiveBackup,
  ArchiveStoreMap,
  ArchiveStoreName,
  KoshAudioFile,
  KoshMeeting,
  KoshPdf,
  KoshSettings,
  KoshTag,
} from './types'

const DATABASE_NAME = 'kosh-local-archive'
const DATABASE_VERSION = 1

const STORE_NAMES: ArchiveStoreName[] = [
  'meetings',
  'pdfs',
  'tags',
  'audioFiles',
  'settings',
]

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this browser.'))
  }

  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      for (const name of STORE_NAMES) {
        if (!database.objectStoreNames.contains(name)) {
          const store = database.createObjectStore(name, { keyPath: 'id' })
          store.createIndex('createdAt', 'createdAt', { unique: false })
          store.createIndex('updatedAt', 'updatedAt', { unique: false })
        }
      }

      const upgradeTransaction = request.transaction
      if (!upgradeTransaction) return

      const meetings = upgradeTransaction.objectStore('meetings')
      if (!meetings.indexNames.contains('meetingDate')) {
        meetings.createIndex('meetingDate', 'meetingDate', { unique: false })
      }

      const pdfs = upgradeTransaction.objectStore('pdfs')
      if (!pdfs.indexNames.contains('pdfDate')) {
        pdfs.createIndex('pdfDate', 'pdfDate', { unique: false })
      }

      const tags = upgradeTransaction.objectStore('tags')
      if (!tags.indexNames.contains('label')) {
        tags.createIndex('label', 'label', { unique: false })
      }

      const audioFiles = upgradeTransaction.objectStore('audioFiles')
      if (!audioFiles.indexNames.contains('meetingId')) {
        audioFiles.createIndex('meetingId', 'meetingId', { unique: false })
      }
    }

    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = null
      }
      resolve(database)
    }

    request.onerror = () => {
      databasePromise = null
      reject(request.error ?? new Error('The local archive could not be opened.'))
    }

    request.onblocked = () => {
      databasePromise = null
      reject(new Error('The archive is busy in another tab. Close other Kosh tabs and retry.'))
    }
  })

  return databasePromise
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('The archive request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('The archive transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('The archive transaction was cancelled.'))
  })
}

function makeEntity<T extends { id: string; createdAt?: string; updatedAt?: string }>(record: T): T {
  const now = new Date().toISOString()
  return {
    ...record,
    createdAt: record.createdAt || now,
    updatedAt: now,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function encodeValue(value: unknown): unknown {
  if (value instanceof Blob) {
    return value.arrayBuffer().then((buffer) => ({
      __koshType: 'blob',
      mimeType: value.type,
      bytes: bytesToBase64(new Uint8Array(buffer)),
    }))
  }

  if (value instanceof ArrayBuffer) {
    return {
      __koshType: 'arrayBuffer',
      bytes: bytesToBase64(new Uint8Array(value)),
    }
  }

  if (ArrayBuffer.isView(value)) {
    return {
      __koshType: 'typedArray',
      constructorName: value.constructor.name,
      bytes: bytesToBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)),
    }
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map(encodeValue))
  }

  if (isRecord(value)) {
    return Promise.all(
      Object.entries(value).map(async ([key, entry]) => [key, await encodeValue(entry)] as const),
    ).then((entries) => Object.fromEntries(entries))
  }

  return value
}

function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue)

  if (!isRecord(value)) return value

  if (value.__koshType === 'blob' && typeof value.bytes === 'string') {
    return new Blob([base64ToBytes(value.bytes)], {
      type: typeof value.mimeType === 'string' ? value.mimeType : '',
    })
  }

  if (value.__koshType === 'arrayBuffer' && typeof value.bytes === 'string') {
    return base64ToBytes(value.bytes).buffer
  }

  if (value.__koshType === 'typedArray' && typeof value.bytes === 'string') {
    const bytes = base64ToBytes(value.bytes)
    const constructors: Record<string, (buffer: ArrayBuffer) => ArrayBufferView> = {
      Uint8Array: (buffer) => new Uint8Array(buffer),
      Uint8ClampedArray: (buffer) => new Uint8ClampedArray(buffer),
      Int8Array: (buffer) => new Int8Array(buffer),
      Uint16Array: (buffer) => new Uint16Array(buffer),
      Int16Array: (buffer) => new Int16Array(buffer),
      Uint32Array: (buffer) => new Uint32Array(buffer),
      Int32Array: (buffer) => new Int32Array(buffer),
      Float32Array: (buffer) => new Float32Array(buffer),
      Float64Array: (buffer) => new Float64Array(buffer),
    }
    const constructor = constructors[String(value.constructorName)]
    return constructor ? constructor(bytes.buffer) : bytes
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, decodeValue(entry)]),
  )
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }

  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function validateBackup(value: unknown): asserts value is ArchiveBackup {
  if (!isRecord(value) || value.format !== 'kosh-archive' || value.version !== 1) {
    throw new Error('This file is not a supported Kosh archive backup.')
  }

  for (const storeName of STORE_NAMES) {
    if (!Array.isArray(value[storeName])) {
      throw new Error(`The backup is missing its ${storeName} records.`)
    }

    for (const record of value[storeName] as unknown[]) {
      if (!isRecord(record) || typeof record.id !== 'string') {
        throw new Error(`The backup contains an invalid ${storeName} record.`)
      }
    }
  }
}

export const koshDB = {
  open: openDatabase,

  async getAll<K extends ArchiveStoreName>(storeName: K): Promise<ArchiveStoreMap[K][]> {
    const database = await openDatabase()
    const transaction = database.transaction(storeName, 'readonly')
    const result = await requestResult(transaction.objectStore(storeName).getAll())
    await transactionDone(transaction)
    return result as ArchiveStoreMap[K][]
  },

  async get<K extends ArchiveStoreName>(
    storeName: K,
    id: string,
  ): Promise<ArchiveStoreMap[K] | undefined> {
    const database = await openDatabase()
    const transaction = database.transaction(storeName, 'readonly')
    const result = await requestResult(transaction.objectStore(storeName).get(id))
    await transactionDone(transaction)
    return result as ArchiveStoreMap[K] | undefined
  },

  async put<K extends ArchiveStoreName>(
    storeName: K,
    record: ArchiveStoreMap[K],
  ): Promise<ArchiveStoreMap[K]> {
    const database = await openDatabase()
    const updatedRecord = makeEntity(record)
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(updatedRecord)
    await transactionDone(transaction)
    return updatedRecord
  },

  async putMany<K extends ArchiveStoreName>(
    storeName: K,
    records: ArchiveStoreMap[K][],
  ): Promise<void> {
    const database = await openDatabase()
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)

    for (const record of records) {
      store.put(makeEntity(record))
    }

    await transactionDone(transaction)
  },

  async remove(storeName: ArchiveStoreName, id: string): Promise<void> {
    const database = await openDatabase()
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).delete(id)
    await transactionDone(transaction)
  },

  async clear(storeName: ArchiveStoreName): Promise<void> {
    const database = await openDatabase()
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).clear()
    await transactionDone(transaction)
  },

  async count(storeName: ArchiveStoreName): Promise<number> {
    const database = await openDatabase()
    const transaction = database.transaction(storeName, 'readonly')
    const result = await requestResult(transaction.objectStore(storeName).count())
    await transactionDone(transaction)
    return result
  },

  async exportBackup(options: { includeAudio?: boolean } = {}): Promise<ArchiveBackup> {
    const [meetings, pdfs, tags, audioFiles, settings] = await Promise.all([
      this.getAll('meetings'),
      this.getAll('pdfs'),
      this.getAll('tags'),
      options.includeAudio === false ? Promise.resolve([]) : this.getAll('audioFiles'),
      this.getAll('settings'),
    ])

    return {
      format: 'kosh-archive',
      version: 1,
      exportedAt: new Date().toISOString(),
      meetings,
      pdfs,
      tags,
      audioFiles,
      settings,
    }
  },

  async exportBackupJson(options: { includeAudio?: boolean } = {}): Promise<string> {
    const backup = await this.exportBackup(options)
    return JSON.stringify(await encodeValue(backup))
  },

  async importBackup(input: ArchiveBackup | string): Promise<void> {
    let parsed: unknown = input

    if (typeof input === 'string') {
      try {
        parsed = JSON.parse(input) as unknown
      } catch {
        throw new Error('The selected file is not valid JSON.')
      }
    }

    const decoded = decodeValue(parsed)
    validateBackup(decoded)

    const database = await openDatabase()
    const transaction = database.transaction(STORE_NAMES, 'readwrite')

    for (const storeName of STORE_NAMES) {
      const store = transaction.objectStore(storeName)
      store.clear()

      for (const record of decoded[storeName] as ArchiveStoreMap[typeof storeName][]) {
        store.put(record)
      }
    }

    await transactionDone(transaction)
  },

  async estimateUsage(): Promise<{ bytes: number; availableBytes: number | null }> {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      const bytes = estimate.usage ?? 0
      const quota = estimate.quota
      return {
        bytes,
        availableBytes: typeof quota === 'number' ? Math.max(0, quota - bytes) : null,
      }
    }

    const [meetings, pdfs, tags, audioFiles, settings] = await Promise.all([
      this.getAll('meetings'),
      this.getAll('pdfs'),
      this.getAll('tags'),
      this.getAll('audioFiles'),
      this.getAll('settings'),
    ])

    const records = [...meetings, ...pdfs, ...tags, ...audioFiles, ...settings]
    let bytes = 0

    for (const record of records) {
      bytes += new Blob([JSON.stringify(record)]).size
      if ('file' in record && record.file instanceof Blob) bytes += record.file.size
    }

    return { bytes, availableBytes: null }
  },
}

export type {
  ArchiveBackup,
  KoshAudioFile,
  KoshMeeting,
  KoshPdf,
  KoshSettings,
  KoshTag,
}