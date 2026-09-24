import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function GlobalSearch({ callerId, onNavigate }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)

  async function search() {
    if (!q.trim()) {
      setResults([])
      return
    }
    const { data } = await supabase.rpc('crm_global_search', {
      p_caller_id: callerId,
      p_query: q.trim(),
      p_limit: 25,
    })
    setResults(data?.success ? data.results || [] : [])
    setOpen(true)
  }

  return (
    <div className="global-search" style={{ position: 'relative', marginBottom: 16, maxWidth: 520 }}>
      <input
        type="search"
        placeholder="Search employees, leads, clients, loads…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && search()}
      />
      <button type="button" className="btn-primary" style={{ marginTop: 8, padding: '0.5rem 1rem' }} onClick={search}>
        Search
      </button>
      {open && results.length > 0 && (
        <div className="card" style={{ position: 'absolute', zIndex: 20, width: '100%', marginTop: 8, maxHeight: 280, overflowY: 'auto' }}>
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              type="button"
              className="btn-ghost"
              style={{ width: '100%', textAlign: 'left', marginBottom: 4 }}
              onClick={() => { onNavigate?.(r); setOpen(false) }}
            >
              <span className="pill" style={{ marginRight: 8 }}>{r.type}</span>
              {r.title} <span style={{ color: 'var(--text-muted)' }}>{r.subtitle}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
