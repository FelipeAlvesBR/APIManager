import type { KeyValue } from "@apiplatform/shared";

interface Row extends Partial<KeyValue> {
  key: string;
  value: string;
  enabled: boolean;
  type?: string;
}

export function KeyValueEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  disabled?: boolean;
}) {
  function update(i: number, patch: Partial<Row>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, j) => j !== i));
  }

  return (
    <div>
      <table className="kv-table">
        <thead>
          <tr>
            <th style={{ width: 30 }}></th>
            <th style={{ width: 30 }}></th>
            <th style={{ width: "38%" }}>Key</th>
            <th>Value</th>
            <th style={{ width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                <input
                  type="checkbox"
                  checked={r.enabled}
                  title="enabled"
                  disabled={disabled}
                  onChange={(e) => update(i, { enabled: e.target.checked })}
                />
              </td>
              <td>
                <span className="small muted">{r.type ? r.type : ""}</span>
              </td>
              <td>
                <input
                  className="ds-mono"
                  value={r.key}
                  disabled={disabled}
                  placeholder="key"
                  onChange={(e) => update(i, { key: e.target.value })}
                />
              </td>
              <td>
                <input
                  className="ds-mono"
                  value={r.value}
                  disabled={disabled}
                  placeholder="value"
                  onChange={(e) => update(i, { value: e.target.value })}
                />
              </td>
              <td>
                <button className="ds-btn ghost icon sm" title="Delete row" disabled={disabled} onClick={() => remove(i)}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className="ds-btn sm"
        disabled={disabled}
        onClick={() => onChange([...rows, { key: "", value: "", enabled: true }])}
      >
        + Row
      </button>
    </div>
  );
}