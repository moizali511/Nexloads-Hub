export default function DataTable({ columns, rows, emptyLabel = 'No records yet.' }) {
  if (!rows?.length) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px 0' }}>{emptyLabel}</div>
  }
  return (
    <div className="data-table-wrap scrollbar-thin">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row._key}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
