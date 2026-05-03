import type { StageResult } from "../types";

const fmt = (n: number) => (Math.abs(n) < 0.005 ? "0" : n.toFixed(2));
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const TITLES: Record<StageResult["stage"], string> = {
  hit: "Hit roll",
  wound: "Wound roll",
  save: "Save roll",
  fnp: "Feel No Pain",
};

export function StageResultTable({ result }: { result: StageResult }) {
  return (
    <section className="card stage-card">
      <header className="stage-header">
        <h3>{TITLES[result.stage]}</h3>
        <span className="stage-meta">
          {fmt(result.diceIn)} dice · need {result.needed} · {pct(result.rollProbability)}
        </span>
      </header>
      <table className="stage-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Expected</th>
          </tr>
        </thead>
        <tbody>
          {result.contributions.map((c, i) => (
            <tr key={i} className={c.value < 0 ? "neg" : ""}>
              <td>{c.label}</td>
              <td className="num">{fmt(c.value)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            <td className="num">{fmt(result.total)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
