import type { TargetProfile } from "../types";
import { NumberSpinner } from "./NumberSpinner";
import { TargetModifiersForm } from "./TargetModifiers";

type Props = {
  target: TargetProfile;
  onChange: (t: TargetProfile) => void;
  presets: Record<string, TargetProfile>;
  onSavePreset: (name: string, value: TargetProfile) => void;
  onDeletePreset: (name: string) => void;
};

export function TargetProfileForm({ target, onChange, presets, onSavePreset, onDeletePreset }: Props) {
  const set = <K extends keyof TargetProfile>(k: K, v: TargetProfile[K]) =>
    onChange({ ...target, [k]: v });

  const presetNames = Object.keys(presets).sort();
  const currentMatchesPreset = presets[target.name] !== undefined;

  return (
    <section className="card">
      <h2>Target</h2>
      <div className="preset-bar">
        <select
          className="preset-select"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) onChange({ ...presets[v], name: v });
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
      <TargetModifiersForm
        mods={target.modifiers}
        onChange={(modifiers) => onChange({ ...target, modifiers })}
      />
    </section>
  );
}
