type Props = {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (n: number) => void;
};

export function NumberSpinner({ label, value, min = 0, max = 99, step = 1, onChange }: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <label className="spinner">
      {label && <span className="spinner-label">{label}</span>}
      <div className="spinner-controls">
        <button type="button" className="spinner-btn" onClick={() => onChange(clamp(value - step))} aria-label="decrease">
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(clamp(n));
          }}
        />
        <button type="button" className="spinner-btn" onClick={() => onChange(clamp(value + step))} aria-label="increase">
          +
        </button>
      </div>
    </label>
  );
}
