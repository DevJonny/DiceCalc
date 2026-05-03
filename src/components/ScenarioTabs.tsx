import { useEffect, useRef, useState } from "react";
import type { Scenario } from "../types";

type Props = {
  scenarios: Scenario[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
};

const displayName = (s: Scenario) => s.name.trim() || s.weapon.name.trim() || "Scenario";

export function ScenarioTabs({ scenarios, activeId, onSelect, onAdd, onRename, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  return (
    <div className="scenario-tabs">
      {scenarios.map((s) => {
        const isActive = s.id === activeId;
        const isEditing = editingId === s.id;
        return (
          <div
            key={s.id}
            className={isActive ? "tab active" : "tab"}
            onClick={() => !isActive && !isEditing && onSelect(s.id)}
            role="button"
            tabIndex={0}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                className="tab-name"
                value={s.name}
                placeholder={s.weapon.name || "Scenario"}
                onChange={(e) => onRename(s.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") setEditingId(null);
                }}
              />
            ) : (
              <span className="tab-name-text">{displayName(s)}</span>
            )}
            {isActive && !isEditing && (
              <button
                type="button"
                className="tab-edit"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(s.id);
                }}
                aria-label="Rename scenario"
              >
                ✎
              </button>
            )}
            {scenarios.length > 1 && !isEditing && (
              <button
                type="button"
                className="tab-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
                aria-label={`Delete ${displayName(s)}`}
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
