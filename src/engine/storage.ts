// Minimal IndexedDB store for artworks.
const DB = 'atelier'
const STORE = 'artworks'
const META = 'meta'
const PATTERNS = 'patterns'

export interface ArtMeta {
  id: string
  name: string
  width: number
  height: number
  updated: number
  created: number
  thumb: Blob
  frames?: number
  stack?: string // id of the stack (folder) it belongs to
}

export interface PatternItem { id: string; name: string; tile: Blob; width: number; height: number; created: number }

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 2)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(PATTERNS)) db.createObjectStore(PATTERNS, { keyPath: 'id' })
    }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

let dbp: Promise<IDBDatabase> | null = null
const db = () => (dbp ||= open())

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return db().then((d) => new Promise<T>((res, rej) => {
    const t = d.transaction(store, mode)
    const s = t.objectStore(store)
    const req = fn(s)
    t.oncomplete = () => res(req ? (req as IDBRequest<T>).result : (undefined as T))
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error)
  }))
}

export const listArt = () => tx<ArtMeta[]>(META, 'readonly', (s) => s.getAll()).then((a) => a.sort((x, y) => y.updated - x.updated))
export const getArt = (id: string) => tx<Blob | undefined>(STORE, 'readonly', (s) => s.get(id))
export async function putArt(meta: ArtMeta, data: Blob) {
  await tx(STORE, 'readwrite', (s) => { s.put(data, meta.id) })
  await tx(META, 'readwrite', (s) => { s.put(meta) })
}
export async function deleteArt(id: string) {
  await tx(STORE, 'readwrite', (s) => { s.delete(id) })
  await tx(META, 'readwrite', (s) => { s.delete(id) })
}
export async function renameArt(id: string, name: string) {
  await updateArt(id, { name })
}
export async function updateArt(id: string, patch: Partial<Omit<ArtMeta, 'id'>>) {
  const all = await listArt()
  const m = all.find((a) => a.id === id)
  if (m) await tx(META, 'readwrite', (s) => { s.put({ ...m, ...patch }) })
}

// ---- print / pattern library ----
export const listPatterns = () => tx<PatternItem[]>(PATTERNS, 'readonly', (s) => s.getAll()).then((a) => a.sort((x, y) => y.created - x.created))
export const putPattern = (p: PatternItem) => tx(PATTERNS, 'readwrite', (s) => { s.put(p) })
export const deletePattern = (id: string) => tx(PATTERNS, 'readwrite', (s) => { s.delete(id) })
export async function estimateUsage(): Promise<string> {
  try {
    const e = await navigator.storage?.estimate?.()
    if (!e || !e.usage) return ''
    const mb = e.usage / 1024 / 1024
    const used = mb < 1 ? `${Math.max(1, Math.round(e.usage / 1024))} KB` : `${mb.toFixed(1)} MB`
    return `${used} usados de ${((e.quota || 0) / 1024 / 1024 / 1024).toFixed(1)} GB disponibles en este navegador`
  } catch { return '' }
}
