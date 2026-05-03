import type { Scenario } from "../types";

type Props = {
  scenarios: Scenario[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
};

export function ScenarioTabs({ scenarios, activeId, onSelect, onAdd, onRename, onDelete }: Props) {
  return (
    <div className="scenario-tabs">
      {scenarios.map((s) => {
        const isActive = s.id === activeId;
        return (
          <div
            key={s.id}
            className={isActive ? "tab active" : "tab"}
            onClick={() => !isActive && onSelect(s.id)}
            role="button"
            tabIndex={0}
          >
            {isActive ? (
              <input
                className="tab-name"
                value={s.name}
                onChange={(e) => onRename(s.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="tab-name-text">{s.name}</span>
            )}
            {scenarios.length > 1 && (
              <button
                type="button"
                className="tab-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
                aria-label={`Delete ${s.name}`}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button type="button" className="tab-add" onClick={onAdd} aria-label="Add scenario">
        +
      </button>
    </div>
  );
}
