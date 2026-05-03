import { useEffect, useMemo, useState } from "react";
import { computeAll, defaultTargetModifiers, defaultWeaponModifiers } from "./calc";
import {
  loadActiveId,
  loadScenarios,
  loadTargetPresets,
  loadWeaponPresets,
  saveActiveId,
  saveScenarios,
  saveTargetPresets,
  saveWeaponPresets,
} from "./storage";
import type { Scenario, TargetProfile, WeaponProfile } from "./types";
import { CompareTable } from "./components/CompareTable";
import { ScenarioTabs } from "./components/ScenarioTabs";
import { StageResultTable } from "./components/StageResultTable";
import { TargetProfileForm } from "./components/TargetProfileForm";
import { WeaponProfileForm } from "./components/WeaponProfileForm";

const newId = () => Math.random().toString(36).slice(2, 9);

const defaultWeapon = (): WeaponProfile => ({
  name: "Weapon",
  toHit: 3,
  strength: 4,
  armourMod: 0,
  numDice: 10,
  modifiers: defaultWeaponModifiers(),
});
const defaultTarget = (): TargetProfile => ({
  name: "Target",
  toughness: 4,
  armour: 4,
  unmodifiable: null,
  modifiers: defaultTargetModifiers(),
});

const defaultScenario = (n = 1): Scenario => ({
  id: newId(),
  name: `Scenario ${n}`,
  weapon: defaultWeapon(),
  target: defaultTarget(),
});

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => {
    const loaded = loadScenarios();
    return loaded.length > 0 ? loaded : [defaultScenario(1)];
  });
  const [activeId, setActiveId] = useState<string>(() => {
    const id = loadActiveId();
    return id ?? "";
  });
  const [view, setView] = useState<"editor" | "compare">("editor");
  const [weaponPresets, setWeaponPresets] = useState(() => loadWeaponPresets());
  const [targetPresets, setTargetPresets] = useState(() => loadTargetPresets());

  // Ensure activeId is valid
  useEffect(() => {
    if (!scenarios.find((s) => s.id === activeId)) {
      setActiveId(scenarios[0]?.id ?? "");
    }
  }, [scenarios, activeId]);

  useEffect(() => saveScenarios(scenarios), [scenarios]);
  useEffect(() => {
    if (activeId) saveActiveId(activeId);
  }, [activeId]);
  useEffect(() => saveWeaponPresets(weaponPresets), [weaponPresets]);
  useEffect(() => saveTargetPresets(targetPresets), [targetPresets]);

  const computations = useMemo(
    () => scenarios.map((s) => computeAll(s.weapon, s.target)),
    [scenarios],
  );

  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];
  const activeComp = computations[scenarios.indexOf(active)];

  const updateActive = (patch: Partial<Scenario>) =>
    setScenarios((prev) => prev.map((s) => (s.id === active.id ? { ...s, ...patch } : s)));

  return (
    <div className="app">
      <header className="app-header">
        <h1>DiceCalc</h1>
        <div className="view-toggle">
          <button
            type="button"
            className={view === "editor" ? "active" : ""}
            onClick={() => setView("editor")}
          >
            Editor
          </button>
          <button
            type="button"
            className={view === "compare" ? "active" : ""}
            onClick={() => setView("compare")}
          >
            Compare ({scenarios.length})
          </button>
        </div>
      </header>

      <ScenarioTabs
        scenarios={scenarios}
        activeId={active.id}
        onSelect={setActiveId}
        onAdd={() => {
          const s = defaultScenario(scenarios.length + 1);
          setScenarios((prev) => [...prev, s]);
          setActiveId(s.id);
        }}
        onRename={(id, name) =>
          setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
        }
        onDelete={(id) => setScenarios((prev) => prev.filter((s) => s.id !== id))}
      />

      {view === "editor" ? (
        <main className="editor">
          <WeaponProfileForm
            weapon={active.weapon}
            onChange={(weapon) => updateActive({ weapon })}
            presets={weaponPresets}
            onSavePreset={(name, value) =>
              setWeaponPresets((p) => ({ ...p, [name]: { ...value, name } }))
            }
            onDeletePreset={(name) =>
              setWeaponPresets((p) => {
                const { [name]: _, ...rest } = p;
                return rest;
              })
            }
          />
          <TargetProfileForm
            target={active.target}
            onChange={(target) => updateActive({ target })}
            presets={targetPresets}
            onSavePreset={(name, value) =>
              setTargetPresets((p) => ({ ...p, [name]: { ...value, name } }))
            }
            onDeletePreset={(name) =>
              setTargetPresets((p) => {
                const { [name]: _, ...rest } = p;
                return rest;
              })
            }
          />
          <h2 className="results-heading">Results</h2>
          <StageResultTable result={activeComp.hit} />
          <StageResultTable result={activeComp.wound} />
          <StageResultTable result={activeComp.save} />
          {activeComp.fnp && <StageResultTable result={activeComp.fnp} />}
        </main>
      ) : (
        <main className="compare">
          <CompareTable
            scenarios={scenarios}
            computations={computations}
            onEdit={(id) => {
              setActiveId(id);
              setView("editor");
            }}
          />
        </main>
      )}
    </div>
  );
}
