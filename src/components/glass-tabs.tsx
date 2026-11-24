import { useState, type CSSProperties } from "react";

type Tab = { id: string; label: string };

export function GlassTabs({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Tab[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === value));
  const [sheen, setSheen] = useState(0);

  return (
    <div
      className="sp-glass-tabs"
      role="tablist"
      aria-label={label}
      style={{ "--tabs": tabs.length, "--index": index } as CSSProperties}
    >
      <span className="sp-glass-thumb" aria-hidden="true">
        <i key={sheen} />
      </span>
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${label}-${tab.id}`}
            aria-selected={on}
            aria-controls={`panel-${label}-${tab.id}`}
            className={on ? "is-on" : undefined}
            onClick={() => {
              if (!on) setSheen((n) => n + 1);
              onChange(tab.id);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
