"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
  keywords?: string;
};

type Props = {
  label: string;
  value: string;
  options: Option[];
  placeholder?: string;
  emptyText?: string;
  required?: boolean;
  onChange: (value: string) => void;
  testId?: string;
};

export default function SearchableSelect({
  label,
  value,
  options,
  placeholder = "Search and select...",
  emptyText = "No matches found.",
  required,
  onChange,
  testId,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  );

  useEffect(() => {
    setQuery(selected?.label || "");
  }, [selected?.label]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected?.label || "");
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [selected?.label]);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.keywords || ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [options, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const pick = (option: Option) => {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  };

  return (
    <div className="searchable-select" ref={rootRef}>
      <label>{label}</label>
      <div className="combo-wrap">
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (!event.target.value.trim()) {
              onChange("");
            }
          }}
          onKeyDown={(event) => {
            if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              setOpen(true);
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((prev) => Math.max(prev - 1, 0));
            }
            if (event.key === "Enter" && open && filteredOptions[activeIndex]) {
              event.preventDefault();
              pick(filteredOptions[activeIndex]);
            }
            if (event.key === "Escape") {
              setOpen(false);
              setQuery(selected?.label || "");
            }
          }}
          placeholder={placeholder}
          data-testid={testId}
          required={required}
        />
        {value ? (
          <button
            type="button"
            className="combo-clear"
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(false);
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="combo-list" role="listbox">
          {filteredOptions.length === 0 ? (
            <div className="combo-empty">{emptyText}</div>
          ) : (
            filteredOptions.slice(0, 10).map((option, index) => (
              <button
                type="button"
                key={option.value}
                className={`combo-option${index === activeIndex ? " active" : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(option);
                }}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
