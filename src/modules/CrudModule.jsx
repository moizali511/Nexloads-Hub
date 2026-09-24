import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import DataTable from '../components/crm/DataTable'

/**
 * Generic list + simple create form driven by RPC name and field config.
 */
export default function CrudModule({
  title,
  callerId,
  listRpc,
  listArgs = {},
  upsertRpc,
  fields,
  columns,
  emptyPayload = {},
}) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(emptyPayload)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.rpc(listRpc, { p_caller_id: callerId, ...listArgs })
    const key = Object.keys(data || {}).find((k) => k !== 'success' && Array.isArray(data[k]))
    if (data?.success && key) setRows(data[key])
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    const { data } = await supabase.rpc(upsertRpc, { p_caller_id: callerId, p_payload: form })
    if (!data?.success) {
      setError('Save failed. Ensure migrations 002+ are applied on Supabase.')
      return
    }
    setForm(emptyPayload)
    load()
  }

  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      <form onSubmit={save} style={{ marginTop: 14, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {fields.map((f) => (
          f.type === 'select' ? (
            <select key={f.key} value={form[f.key] || ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
              <option value="">{f.placeholder || f.label}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input
              key={f.key}
              type={f.type || 'text'}
              placeholder={f.label}
              required={f.required}
              value={form[f.key] ?? ''}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          )
        ))}
        {error && <div style={{ color: 'var(--danger)', gridColumn: '1 / -1' }}>{error}</div>}
        <button type="submit" className="btn-primary">Save</button>
      </form>
      <div style={{ marginTop: 18 }}>
        <DataTable columns={columns} rows={rows} />
      </div>
    </div>
  )
}
