import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { FormControl } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export type ProjectNameOption = {
  value: string;
  label: string;
};

export type ProjectNamePickerProps =
  | {
      multiple: true;
      value: string[];
      onChange: (value: string[]) => void;
      placeholder: string;
      options: ProjectNameOption[];
      disabled?: boolean;
    }
  | {
      multiple?: false;
      value?: string;
      onChange: (value: string | undefined) => void;
      placeholder: string;
      options: ProjectNameOption[];
      disabled?: boolean;
    };

export function ProjectNamePicker(props: ProjectNamePickerProps) {
  const { options, placeholder, disabled } = props;
  const isMultiple = props.multiple === true;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  useEffect(() => {
    if (!open) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => option.label.toLowerCase().includes(term));
  }, [options, search]);

  const multiValue = isMultiple ? ((props.value as string[]) ?? []) : [];
  const singleValue = !isMultiple ? (props.value as string | undefined) : undefined;

  const handleMultiChange = (next: string[]) => {
    (props.onChange as (value: string[]) => void)(next);
  };

  const handleSingleChange = (next: string | undefined) => {
    (props.onChange as (value: string | undefined) => void)(next);
  };

  let triggerText = placeholder;
  let hasSelection = false;

  if (isMultiple) {
    const selectedLabels = options
      .filter((option) => multiValue.includes(option.value))
      .map((option) => option.label);

    hasSelection = selectedLabels.length > 0;

    if (selectedLabels.length === 0) {
      triggerText = placeholder;
    } else if (selectedLabels.length <= 2) {
      triggerText = selectedLabels.join(", ");
    } else {
      triggerText = `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2} more`;
    }
  } else if (singleValue) {
    const match = options.find((option) => option.value === singleValue);
    if (match) {
      triggerText = match.label;
      hasSelection = true;
    }
  }

  const toggleOption = (value: string) => {
    if (isMultiple) {
      const next = multiValue.includes(value)
        ? multiValue.filter((id) => id !== value)
        : [...multiValue, value];
      handleMultiChange(next);
      return;
    }

    handleSingleChange(value);
    setOpen(false);
  };

  const clearSelection = () => {
    if (isMultiple) {
      handleMultiChange([]);
    } else {
      handleSingleChange(undefined);
    }
  };

  const showClear = !isMultiple && Boolean(singleValue);

  return (
    <div className="relative" ref={containerRef}>
      <FormControl>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            open && "ring-1 ring-ring",
            !hasSelection && "text-muted-foreground"
          )}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
          }}
        >
          <span
            className={cn(
              "truncate text-left",
              hasSelection ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {triggerText}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </button>
      </FormControl>

      {open ? (
        <div className="absolute z-50 mt-2 w-full min-w-[260px] rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isMultiple) {
                  event.preventDefault();
                  const first = filteredOptions[0];
                  if (first) {
                    handleSingleChange(first.value);
                    setOpen(false);
                  }
                }
              }}
              placeholder="Search names…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoComplete="off"
            />
          </div>

          {showClear ? (
            <button
              type="button"
              className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/50"
              onClick={() => {
                clearSelection();
                setOpen(false);
              }}
            >
              Clear selection
              <X className="size-3.5" />
            </button>
          ) : null}

          <div className="max-h-60 overflow-y-auto py-2">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matching names.
              </p>
            ) : (
              filteredOptions.map((option) => {
                const selected = isMultiple
                  ? multiValue.includes(option.value)
                  : option.value === singleValue;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-muted/60",
                      selected && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => toggleOption(option.value)}
                  >
                    <span className="truncate">{option.label}</span>
                    <span
                      className={cn(
                        "ml-2 flex h-4 w-4 items-center justify-center rounded border border-border",
                        selected && "border-primary bg-primary text-primary-foreground"
                      )}
                    >
                      {selected ? <Check className="size-3" /> : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

