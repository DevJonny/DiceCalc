import type { Computation, Scenario } from "../types";

const fmt = (n: number) => (Math.abs(n) < 0.005 ? "0" : n.toFixed(2));

type Props = {
  scenarios: Scenario[];
  computations: Computation[];
  onEdit: (id: string) => void;
};

function modifierChips(s: Scenario): string[] {
  const w = s.weapon.modifiers;
  const t = s.target.modifiers;
  const out: string[] = [];
  if (w.aimed) out.push("+1");
  if (t.minusOneHit) out.push("−1");
  if (w.woundingHits !== null) out.push(`WH${w.woundingHits}+`);
  if (w.bypassingWounds) out.push("BW");
  if (w.exploding) out.push(`X${w.explodingX}`);
  if (w.hitReroll !== "none") out.push(`HR:${w.hitReroll === "ones" ? "1s" : "Miss"}`);
  if (w.woundReroll !== "none") out.push(`WR:${w.woundReroll === "ones" ? "1s" : "Miss"}`);
  if (t.fnp !== null) out.push(`FNP ${t.fnp}+`);
  return out;
}

export function CompareTable({ scenarios, computations, onEdit }: Props) {
  const anyFnp = computations.some((c) => c.fnp !== null);

  const rows: { group?: string; label: string; cell: (c: Computation, s: Scenario) => string }[] = [
    { group: "Inputs", label: "Dice", cell: (_, s) => `${s.weapon.numDice}` },
    { label: "To Hit", cell: (_, s) => `${s.weapon.toHit}+` },
    { label: "S", cell: (_, s) => `${s.weapon.strength}` },
    { label: "AP", cell: (_, s) => `${s.weapon.armourMod}` },
    { label: "T", cell: (_, s) => `${s.target.toughness}` },
    { label: "Sv", cell: (_, s) => `${s.target.armour}+` },
    {
      label: "Invuln",
      cell: (_, s) => (s.target.unmodifiable !== null ? `${s.target.unmodifiable}+` : "—"),
    },
    { group: "Hit", label: "Need", cell: (c) => c.hit.needed },
    { label: "Total hits", cell: (c) => fmt(c.hit.total) },
    { group: "Wound", label: "Need", cell: (c) => c.wound.needed },
    { label: "Total wounds", cell: (c) => fmt(c.wound.total) },
    { group: "Save", label: "Effective save", cell: (c) => c.save.needed },
    { label: "Final unsaved", cell: (c) => fmt(c.save.total) },
  ];

  if (anyFnp) {
    rows.push({ group: "FNP", label: "Need", cell: (c) => (c.fnp ? c.fnp.needed : "—") });
    rows.push({ label: "Damage taken", cell: (c) => fmt(c.finalDamage) });
  }

  return (
    <div className="compare-wrap">
      <table className="compare-table">
        <thead>
          <tr>
            <th className="sticky-col">Metric</th>
            {scenarios.map((s) => (
              <th key={s.id}>
                <div className="compare-name">{s.name.trim() || s.weapon.name.trim() || "Scenario"}</div>
                <div className="compare-sub">
                  <span className="weapon-tag">{s.weapon.name || "Weapon"}</span>
                  <span className="arrow">→</span>
                  <span className="target-tag">{s.target.name || "Target"}</span>
                </div>
                <div className="compare-chips">
                  {modifierChips(s).map((c) => (
                    <span key={c} className="chip">
                      {c}
                    </span>
                  ))}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.group ? "group-start" : ""}>
              <th className="sticky-col">
                {r.group && <span className="group-tag">{r.group}</span>}
                {r.label}
              </th>
              {scenarios.map((s, j) => (
                <td key={s.id} className="num">
                  {r.cell(computations[j], s)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th className="sticky-col">&nbsp;</th>
            {scenarios.map((s) => (
              <td key={s.id}>
                <button type="button" className="link-btn" onClick={() => onEdit(s.id)}>
                  Edit →
                </button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
