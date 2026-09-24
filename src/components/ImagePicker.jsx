import { useRef, useState } from 'react'
import { fileToCompressedDataUrl } from '../utils/imageUpload'

// A small "attach a screenshot" control: a button that opens the file
// picker, a thumbnail preview once one is chosen, and a way to remove
// it. Used for both employee -> admin reports (deal/payment
// screenshots) and admin -> employee messages.
export default function ImagePicker({ value, onChange }) {
  const inputRef = useRef(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again later
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const dataUrl = await fileToCompressedDataUrl(file)
      onChange(dataUrl)
    } catch (err) {
      setError(err.message || 'Could not attach that image.')
    }
    setBusy(false)
  }

  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={value} alt="Attached" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-soft)' }} />
        <button type="button" className="btn-ghost" style={{ padding: '5px 10px', fontSize: '0.78rem' }} onClick={() => onChange(null)}>
          Remove image
        </button>
      </div>
    )
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      <button
        type="button" className="btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem' }}
        onClick={() => inputRef.current?.click()} disabled={busy}
      >
        {busy ? 'Attaching…' : '📎 Attach screenshot'}
      </button>
      {error && <div style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: 4 }}>{error}</div>}
    </div>
  )
}
