import type { TargetModifiers as TMods } from "../types";

type Props = { mods: TMods; onChange: (m: TMods) => void };

export function TargetModifiersForm({ mods, onChange }: Props) {
  const set = <K extends keyof TMods>(k: K, v: TMods[K]) => onChange({ ...mods, [k]: v });

  return (
    <div className="modifier-block">
      <h3 className="modifier-heading">Modifiers</h3>
      <div className="toggles">
        <label className="toggle">
          <input
            type="checkbox"
            checked={mods.minusOneHit}
            onChange={(e) => set("minusOneHit", e.target.checked)}
          />
          <span>−1 to Hit</span>
        </label>
      </div>
      <div className="row">
        <span className="row-label">Feel No Pain</span>
        <div className="radio-group">
          <label className={mods.fnp === null ? "pill active" : "pill"}>
            <input type="radio" checked={mods.fnp === null} onChange={() => set("fnp", null)} />
            Off
          </label>
          {[2, 3, 4, 5, 6].map((v) => (
            <label key={v} className={mods.fnp === v ? "pill active" : "pill"}>
              <input type="radio" checked={mods.fnp === v} onChange={() => set("fnp", v)} />
              {v}+
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
