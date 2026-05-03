import type { RerollMode, WeaponModifiers as WMods } from "../types";
import { NumberSpinner } from "./NumberSpinner";

const REROLL_LABELS: { value: RerollMode; label: string }[] = [
  { value: "none", label: "None" },
  { value: "ones", label: "Re-roll 1s" },
  { value: "misses", label: "Re-rolls" },
];

type Props = { mods: WMods; onChange: (m: WMods) => void };

export function WeaponModifiersForm({ mods, onChange }: Props) {
  const set = <K extends keyof WMods>(k: K, v: WMods[K]) => onChange({ ...mods, [k]: v });

  return (
    <div className="modifier-block">
      <h3 className="modifier-heading">Modifiers</h3>
      <div className="toggles">
        <label className="toggle">
          <input type="checkbox" checked={mods.aimed} onChange={(e) => set("aimed", e.target.checked)} />
          <span>+1 to Hit</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={mods.woundingHits}
            onChange={(e) => set("woundingHits", e.target.checked)}
          />
          <span>Auto-wound on 6</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={mods.bypassingWounds}
            onChange={(e) => set("bypassingWounds", e.target.checked)}
          />
          <span>No save on Wound</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={mods.exploding} onChange={(e) => set("exploding", e.target.checked)} />
          <span>Exploding 6s</span>
        </label>
        {mods.exploding && (
          <NumberSpinner
            label="Extra hits per 6 (X)"
            value={mods.explodingX}
            min={1}
            max={5}
            onChange={(n) => set("explodingX", n)}
          />
        )}
      </div>

      <div className="row">
        <span className="row-label">Hit re-rolls</span>
        <div className="radio-group">
          {REROLL_LABELS.map((opt) => (
            <label key={opt.value} className={mods.hitReroll === opt.value ? "pill active" : "pill"}>
              <input
                type="radio"
                checked={mods.hitReroll === opt.value}
                onChange={() => set("hitReroll", opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="row">
        <span className="row-label">Wound re-rolls</span>
        <div className="radio-group">
          {REROLL_LABELS.map((opt) => (
            <label key={opt.value} className={mods.woundReroll === opt.value ? "pill active" : "pill"}>
              <input
                type="radio"
                checked={mods.woundReroll === opt.value}
                onChange={() => set("woundReroll", opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
