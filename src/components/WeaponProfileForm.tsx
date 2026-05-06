import type { WeaponPreset, WeaponProfile } from "../types";
import { NumberSpinner } from "./NumberSpinner";
import { WeaponModifiersForm } from "./WeaponModifiers";

type Props = {
  weapon: WeaponProfile;
  onChange: (w: WeaponProfile) => void;
  onLoadPreset: (w: WeaponProfile) => void;
  presets: Record<string, WeaponPreset>;
  onSavePreset: (name: string, value: WeaponProfile) => void;
  onDeletePreset: (name: string) => void;
};

export function WeaponProfileForm({ weapon, onChange, onLoadPreset, presets, onSavePreset, onDeletePreset }: Props) {
  const set = <K extends keyof WeaponProfile>(k: K, v: WeaponProfile[K]) =>
    onChange({ ...weapon, [k]: v });

  const presetNames = Object.keys(presets)
    .filter((n) => !presets[n].isDeleted)
    .sort();
  const currentMatchesPreset =
    presets[weapon.name] !== undefined && !presets[weapon.name].isDeleted;

  return (
    <section className="card">
      <h2>Weapon</h2>
      <div className="preset-bar">
        <select
          className="preset-select"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) onLoadPreset({ ...presets[v].profile, name: v });
            e.target.value = "";
          }}
        >
          <option value="">Load weapon…</option>
          {presetNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!weapon.name.trim()}
          onClick={() => onSavePreset(weapon.name.trim(), weapon)}
        >
          Save
        </button>
        {currentMatchesPreset && (
          <button type="button" className="danger" onClick={() => onDeletePreset(weapon.name)}>
            Delete
          </button>
        )}
      </div>
      <label className="text-field">
        <span className="spinner-label">Name</span>
        <input
          type="text"
          value={weapon.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Bolt rifle"
        />
      </label>
      <div className="grid">
        <NumberSpinner label="Number of dice" value={weapon.numDice} min={1} max={60} onChange={(n) => set("numDice", n)} />
        <NumberSpinner label="To Hit (X+)" value={weapon.toHit} min={2} max={6} onChange={(n) => set("toHit", n)} />
        <NumberSpinner label="Strength" value={weapon.strength} min={1} max={20} onChange={(n) => set("strength", n)} />
        <NumberSpinner label="Armour mod (AP, e.g. 2 for AP-2)" value={weapon.armourMod} min={0} max={6} onChange={(n) => set("armourMod", n)} />
      </div>
      <WeaponModifiersForm
        mods={weapon.modifiers}
        onChange={(modifiers) => onChange({ ...weapon, modifiers })}
      />
    </section>
  );
}
