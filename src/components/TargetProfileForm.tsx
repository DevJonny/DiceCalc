import { UNIT_TYPES } from "../types";
import type { TargetPreset, TargetProfile } from "../types";
import { NumberSpinner } from "./NumberSpinner";
import { TargetModifiersForm } from "./TargetModifiers";

const UNIT_TYPE_OPTIONS: { value: TargetProfile["unitType"]; label: string }[] = [
  { value: null, label: "None" },
  ...UNIT_TYPES.map((k) => ({ value: k, label: k })),
];

type Props = {
  target: TargetProfile;
  onChange: (t: TargetProfile) => void;
  presets: Record<string, TargetPreset>;
  onSavePreset: (name: string, value: TargetProfile) => void;
  onDeletePreset: (name: string) => void;
};

export function TargetProfileForm({ target, onChange, presets, onSavePreset, onDeletePreset }: Props) {
  const set = <K extends keyof TargetProfile>(k: K, v: TargetProfile[K]) =>
    onChange({ ...target, [k]: v });

  const presetNames = Object.keys(presets)
    .filter((n) => !presets[n].isDeleted)
    .sort();
  const currentMatchesPreset = presets[target.name] !== undefined && !presets[target.name].isDeleted;

  const cloneName = () => {
    const base = `${target.name.trim()} copy`;
    if (!presetNames.includes(base)) return base;
    let i = 2;
    while (presetNames.includes(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  };

  return (
    <section className="card">
      <h2>Target</h2>
      <div className="preset-bar">
        <select
          className="preset-select"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) onChange({ ...presets[v].profile, name: v });
            e.target.value = "";
          }}
        >
          <option value="">Load target…</option>
          {presetNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!target.name.trim()}
          onClick={() => onSavePreset(target.name.trim(), target)}
        >
          Save
        </button>
        <button
          type="button"
          disabled={!target.name.trim()}
          onClick={() => onChange({ ...target, name: cloneName() })}
        >
          Clone
        </button>
        {currentMatchesPreset && (
          <button type="button" className="danger" onClick={() => onDeletePreset(target.name)}>
            Delete
          </button>
        )}
      </div>
      <label className="text-field">
        <span className="spinner-label">Name</span>
        <input
          type="text"
          value={target.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Terminator"
        />
      </label>
      <div className="grid">
        <NumberSpinner label="Toughness" value={target.toughness} min={1} max={20} onChange={(n) => set("toughness", n)} />
        <NumberSpinner label="Armour (X+)" value={target.armour} min={2} max={7} onChange={(n) => set("armour", n)} />
        <NumberSpinner label="Wounds" value={target.wounds} min={1} max={40} onChange={(n) => set("wounds", n)} />
        <label className="toggle">
          <input
            type="checkbox"
            checked={target.unmodifiable !== null}
            onChange={(e) => set("unmodifiable", e.target.checked ? 5 : null)}
          />
          <span>Unmodifiable save</span>
        </label>
        {target.unmodifiable !== null && (
          <NumberSpinner
            label="Unmod. save (X+)"
            value={target.unmodifiable}
            min={2}
            max={6}
            onChange={(n) => set("unmodifiable", n)}
          />
        )}
      </div>
      <div className="row">
        <span className="row-label">Unit type</span>
        <div className="radio-group">
          {UNIT_TYPE_OPTIONS.map((opt) => (
            <label
              key={String(opt.value)}
              className={target.unitType === opt.value ? "pill active" : "pill"}
            >
              <input
                type="radio"
                checked={target.unitType === opt.value}
                onChange={() => set("unitType", opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
      <TargetModifiersForm
        mods={target.modifiers}
        onChange={(modifiers) => onChange({ ...target, modifiers })}
      />
    </section>
  );
}
