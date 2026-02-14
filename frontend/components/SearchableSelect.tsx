"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
  keywords?: string;
};

type BaseProps = {
  label: string;
  options: Option[];
  placeholder?: string;
  emptyText?: string;
  testId?: string;
};

type SingleSelectProps = BaseProps & {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  multiple?: false;
};

type MultiSelectProps = BaseProps & {
  value: string[];
  onChange: (value: string[]) => void;
  required?: boolean;
  multiple: true;
};

type Props = SingleSelectProps | MultiSelectProps;

export default function SearchableSelect({
  label,
  value,
  options,
  placeholder = "Search and select...",
  emptyText = "No matches found.",
  required,
  onChange,
  multiple = false,
  testId,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedValues = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value]
  );

  const selectedOptions = useMemo(
    () => options.filter((option) => selectedValues.includes(option.value)),
    [options, selectedValues]
  );

  const selected = useMemo(
    () => (Array.isArray(value) ? null : options.find((option) => option.value === value) || null),
    [options, value]
  );

  useEffect(() => {
    if (multiple) return;
    setQuery(selected?.label || "");
  }, [selected?.label, multiple]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        if (!multiple) {
          setQuery(selected?.label || "");
        }
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [selected?.label, multiple]);

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

  const setSingle = (next: string) => {
    if (multiple) return;
    (onChange as (value: string) => void)(next);
  };

  const setMulti = (next: string[]) => {
    if (!multiple) return;
    (onChange as (value: string[]) => void)(next);
  };

  const pick = (option: Option) => {
    if (multiple) {
      const exists = selectedValues.includes(option.value);
      const next = exists
        ? selectedValues.filter((current) => current !== option.value)
        : [...selectedValues, option.value];
      setMulti(next);
      setQuery("");
      setOpen(true);
      return;
    }

    setSingle(option.value);
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
            if (!multiple && !event.target.value.trim()) {
              setSingle("");
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
              if (!multiple) {
                setQuery(selected?.label || "");
              }
            }
          }}
          placeholder={placeholder}
          data-testid={testId}
          required={required}
        />
        {selectedValues.length > 0 ? (
          <button
            type="button"
            className="combo-clear"
            onClick={() => {
              if (multiple) {
                setMulti([]);
              } else {
                setSingle("");
              }
              if (!multiple) setQuery("");
              setOpen(false);
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      {multiple && selectedOptions.length > 0 ? (
        <div className="combo-chips">
          {selectedOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className="combo-chip"
              onClick={() => {
                setMulti(selectedValues.filter((current) => current !== option.value));
              }}
            >
              {option.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="combo-list" role="listbox">
          {filteredOptions.length === 0 ? (
            <div className="combo-empty">{emptyText}</div>
          ) : (
            filteredOptions.slice(0, 10).map((option, index) => (
              <button
                type="button"
                key={option.value}
                className={`combo-option${
                  index === activeIndex ? " active" : ""
                }${selectedValues.includes(option.value) ? " selected" : ""}`}
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
