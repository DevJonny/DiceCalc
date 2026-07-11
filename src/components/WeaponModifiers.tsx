import { UNIT_TYPES } from "../types";
import type { RerollMode, WeaponModifiers as WMods } from "../types";
import { NumberSpinner } from "./NumberSpinner";

const REROLL_LABELS: { value: RerollMode; label: string }[] = [
  { value: "none", label: "None" },
  { value: "ones", label: "Re-roll 1s" },
  { value: "misses", label: "Re-rolls" },
];

const ANTI_OPTIONS: { value: WMods["antiWound"]; label: string }[] = [
  { value: null, label: "Off" },
  { value: 2, label: "2+" },
  { value: 3, label: "3+" },
  { value: 4, label: "4+" },
  { value: 5, label: "5+" },
];

const AUTOWOUND_OPTIONS: { value: WMods["woundingHits"]; label: string }[] = [
  { value: null, label: "Off" },
  { value: 5, label: "5+" },
  { value: 6, label: "6+" },
];

const ANTI_KEYWORD_OPTIONS: { value: WMods["antiKeyword"]; label: string }[] = [
  { value: null, label: "None" },
  ...UNIT_TYPES.map((k) => ({ value: k, label: k })),
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

      <div className="modifier-grid">
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
          <span className="row-label">Auto-wound on</span>
          <div className="radio-group">
            {AUTOWOUND_OPTIONS.map((opt) => (
              <label
                key={String(opt.value)}
                className={mods.woundingHits === opt.value ? "pill active" : "pill"}
              >
                <input
                  type="radio"
                  checked={mods.woundingHits === opt.value}
                  onChange={() => set("woundingHits", opt.value)}
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

        <div className="row anti-row">
          <span className="row-label">Anti-* (override S vs T on keyword match)</span>
          <span className="sub-label">Wound on</span>
          <div className="radio-group">
            {ANTI_OPTIONS.map((opt) => (
              <label
                key={String(opt.value)}
                className={mods.antiWound === opt.value ? "pill active" : "pill"}
              >
                <input
                  type="radio"
                  checked={mods.antiWound === opt.value}
                  onChange={() => set("antiWound", opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          <span className="sub-label">Applies to</span>
          <div className="radio-group">
            {ANTI_KEYWORD_OPTIONS.map((opt) => (
              <label
                key={String(opt.value)}
                className={mods.antiKeyword === opt.value ? "pill active" : "pill"}
              >
                <input
                  type="radio"
                  checked={mods.antiKeyword === opt.value}
                  onChange={() => set("antiKeyword", opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
