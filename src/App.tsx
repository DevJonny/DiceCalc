import { useEffect, useMemo, useRef, useState } from "react";
import { computeAll, defaultTargetModifiers, defaultWeaponModifiers } from "./calc";
import {
  loadActiveId,
  loadScenarios,
  loadTargetPresets,
  loadWeaponPresets,
  now,
  saveActiveId,
  saveScenarios,
  saveTargetPresets,
  saveWeaponPresets,
} from "./storage";
import type {
  Scenario,
  SyncStatus,
  TargetPreset,
  TargetProfile,
  WeaponPreset,
  WeaponProfile,
} from "./types";
import { CompareTable } from "./components/CompareTable";
import { ScenarioTabs } from "./components/ScenarioTabs";
import { StageResultTable } from "./components/StageResultTable";
import { SyncStatusBar } from "./components/SyncStatusBar";
import { TargetProfileForm } from "./components/TargetProfileForm";
import { WeaponProfileForm } from "./components/WeaponProfileForm";
import { SyncService } from "./sync/syncService";

const newId = () => Math.random().toString(36).slice(2, 9);

const defaultWeapon = (): WeaponProfile => ({
  name: "Weapon",
  toHit: 3,
  strength: 4,
  armourMod: 0,
  numDice: 10,
  damage: 1,
  modifiers: defaultWeaponModifiers(),
});
const defaultTarget = (): TargetProfile => ({
  name: "Target",
  toughness: 4,
  armour: 4,
  unmodifiable: null,
  unitType: null,
  wounds: 1,
  modifiers: defaultTargetModifiers(),
});

const defaultScenario = (): Scenario => ({
  id: newId(),
  name: "",
  weapon: defaultWeapon(),
  target: defaultTarget(),
  lastModified: now(),
});

const stamp = <T extends { lastModified: string }>(o: T): T => ({ ...o, lastModified: now() });

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => {
    const loaded = loadScenarios();
    return loaded.length > 0 ? loaded : [defaultScenario()];
  });
  const [activeId, setActiveId] = useState<string>(() => loadActiveId() ?? "");
  const [view, setView] = useState<"editor" | "compare">("editor");
  const [weaponPresets, setWeaponPresets] = useState<Record<string, WeaponPreset>>(() => loadWeaponPresets());
  const [targetPresets, setTargetPresets] = useState<Record<string, TargetPreset>>(() => loadTargetPresets());

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("not-signed-in");
  const [syncError, setSyncError] = useState<string | null>(null);

  // Always-current refs so the sync service can read state without stale closures.
  const stateRef = useRef({ scenarios, weaponPresets, targetPresets, activeId });
  stateRef.current = { scenarios, weaponPresets, targetPresets, activeId };

  const sync = useRef<SyncService | null>(null);
  if (!sync.current) {
    sync.current = new SyncService({
      onStatusChange: (s, e) => {
        setSyncStatus(s);
        setSyncError(e);
      },
      onMerged: (state) => {
        setScenarios(state.scenarios);
        setWeaponPresets(state.weaponPresets);
        setTargetPresets(state.targetPresets);
        if (state.activeScenarioId !== null) setActiveId(state.activeScenarioId);
      },
      getState: () => ({
        scenarios: stateRef.current.scenarios,
        weaponPresets: stateRef.current.weaponPresets,
        targetPresets: stateRef.current.targetPresets,
        activeScenarioId: stateRef.current.activeId || null,
      }),
    });
  }

  // Initialise sync once on mount (silent re-auth if previously connected).
  useEffect(() => {
    void sync.current!.initialize();
  }, []);

  // Ensure activeId is valid
  useEffect(() => {
    const visible = scenarios.filter((s) => !s.isDeleted);
    if (!visible.find((s) => s.id === activeId)) {
      setActiveId(visible[0]?.id ?? "");
    }
  }, [scenarios, activeId]);

  // Persist + schedule sync on every data change
  useEffect(() => {
    saveScenarios(scenarios);
    sync.current?.scheduleSync();
  }, [scenarios]);
  useEffect(() => {
    if (activeId) saveActiveId(activeId);
  }, [activeId]);
  useEffect(() => {
    saveWeaponPresets(weaponPresets);
    sync.current?.scheduleSync();
  }, [weaponPresets]);
  useEffect(() => {
    saveTargetPresets(targetPresets);
    sync.current?.scheduleSync();
  }, [targetPresets]);

  const visibleScenarios = useMemo(() => scenarios.filter((s) => !s.isDeleted), [scenarios]);

  const computations = useMemo(
    () => visibleScenarios.map((s) => computeAll(s.weapon, s.target)),
    [visibleScenarios],
  );

  const active =
    visibleScenarios.find((s) => s.id === activeId) ??
    visibleScenarios[0] ??
    scenarios[0];
  const activeIdx = visibleScenarios.indexOf(active);
  const activeComp = activeIdx >= 0 ? computations[activeIdx] : computations[0];

  const updateActive = (patch: Partial<Scenario>) =>
    setScenarios((prev) =>
      prev.map((s) => (s.id === active.id ? stamp({ ...s, ...patch }) : s)),
    );

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
            Compare ({visibleScenarios.length})
          </button>
        </div>
      </header>

      <SyncStatusBar
        status={syncStatus}
        error={syncError}
        onSignIn={() => void sync.current!.signIn()}
        onSignOut={() => sync.current!.signOut()}
        onSyncNow={() => void sync.current!.syncNow()}
      />

      <ScenarioTabs
        scenarios={visibleScenarios}
        activeId={active.id}
        onSelect={setActiveId}
        onAdd={() => {
          const s = defaultScenario();
          setScenarios((prev) => [...prev, s]);
          setActiveId(s.id);
        }}
        onRename={(id, name) =>
          setScenarios((prev) =>
            prev.map((s) => (s.id === id ? stamp({ ...s, name }) : s)),
          )
        }
        onDelete={(id) =>
          setScenarios((prev) =>
            prev.map((s) => (s.id === id ? stamp({ ...s, isDeleted: true }) : s)),
          )
        }
      />

      {view === "editor" ? (
        <main className="editor">
          <WeaponProfileForm
            weapon={active.weapon}
            onChange={(weapon) => updateActive({ weapon })}
            onLoadPreset={(weapon) => updateActive({ weapon, name: "" })}
            presets={weaponPresets}
            onSavePreset={(name, value) =>
              setWeaponPresets((p) => ({
                ...p,
                [name]: { profile: { ...value, name }, lastModified: now() },
              }))
            }
            onDeletePreset={(name) =>
              setWeaponPresets((p) =>
                p[name] ? { ...p, [name]: { ...p[name], isDeleted: true, lastModified: now() } } : p,
              )
            }
          />
          <TargetProfileForm
            target={active.target}
            onChange={(target) => updateActive({ target })}
            presets={targetPresets}
            onSavePreset={(name, value) =>
              setTargetPresets((p) => ({
                ...p,
                [name]: { profile: { ...value, name }, lastModified: now() },
              }))
            }
            onDeletePreset={(name) =>
              setTargetPresets((p) =>
                p[name] ? { ...p, [name]: { ...p[name], isDeleted: true, lastModified: now() } } : p,
              )
            }
          />
          <h2 className="results-heading">Results</h2>
          <StageResultTable result={activeComp.hit} />
          <StageResultTable result={activeComp.wound} />
          <StageResultTable result={activeComp.save} />
          {activeComp.fnp && <StageResultTable result={activeComp.fnp} />}
          <section className="card summary-card">
            <div className="summary-row">
              <span className="summary-label">Total damage</span>
              <span className="summary-value">{activeComp.finalDamage.toFixed(2)}</span>
            </div>
            <div className="summary-row highlight">
              <span className="summary-label">Models destroyed</span>
              <span className="summary-value">{activeComp.modelsDestroyed.toFixed(2)}</span>
            </div>
          </section>
        </main>
      ) : (
        <main className="compare">
          <CompareTable
            scenarios={visibleScenarios}
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
