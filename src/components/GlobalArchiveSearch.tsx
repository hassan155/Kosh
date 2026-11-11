import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileAudio2, FileText, Search } from 'lucide-react'
import { buildSearchIndex } from '../lib/search-index'
import { koshDB } from '../lib/kosh-db'
import type { KoshMeeting, KoshPdf, KoshTag } from '../lib/types'

export default function GlobalArchiveSearch() {
  const [query, setQuery] = useState('')
  const [meetings, setMeetings] = useState<KoshMeeting[]>([])
  const [pdfs, setPdfs] = useState<KoshPdf[]>([])
  const [tags, setTags] = useState<KoshTag[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!query.trim()) return
    let active = true
    setLoading(true)
    setError('')
    Promise.all([koshDB.getAll('meetings'), koshDB.getAll('pdfs'), koshDB.getAll('tags')])
      .then(([meetingRows, pdfRows, tagRows]) => {
        if (!active) return
        setMeetings(meetingRows)
        setPdfs(pdfRows)
        setTags(tagRows)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Local search is unavailable.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query])

  const results = useMemo(() => buildSearchIndex(meetings, pdfs, tags).search({ query, sort: 'newest', limit: 6 }), [meetings, pdfs, tags, query])

  return (
    <div className="kosh-global-search">
      <label className="kosh-search block" htmlFor="global-archive-search">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <span className="sr-only">Search all meetings, notes, transcripts, and PDFs</span>
        <input
          autoComplete="off"
          id="global-archive-search"
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search all of Kosh…"
          type="search"
          value={query}
        />
      </label>
      {query.trim() && (
        <div className="kosh-global-search-results" aria-live="polite">
          {loading && <p className="kosh-global-search-note">Searching your local archive…</p>}
          {error && <p className="kosh-global-search-note">{error}</p>}
          {!loading && !error && results.length === 0 && <p className="kosh-global-search-note">No matching local records.</p>}
          {!loading && !error && results.map((result) => (
            <Link
              className="kosh-global-search-result"
              key={`${result.kind}:${result.id}`}
              onClick={() => setQuery('')}
              to={result.kind === 'meeting' ? `/meetings/${encodeURIComponent(result.id)}` : '/pdf-tools'}
            >
              {result.kind === 'meeting' ? <FileAudio2 aria-hidden="true" size={15} /> : <FileText aria-hidden="true" size={15} />}
              <span className="min-w-0">
                <strong>{result.title || (result.kind === 'meeting' ? 'Untitled meeting' : 'Untitled PDF')}</strong>
                <small>{result.kind === 'meeting' ? 'Meeting' : 'PDF'} · {result.preview || 'No preview text'}</small>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
