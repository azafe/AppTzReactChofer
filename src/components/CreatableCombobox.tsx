import { useState, useRef, useEffect } from "react";

export type ComboItem = { id: string; label: string };

type Props = {
  items: ComboItem[];
  value: string;
  onSelect: (id: string, label: string) => void;
  onCreate: (text: string) => Promise<ComboItem>;
  placeholder?: string;
  isLoading?: boolean;
  className?: string;
};

const defaultCls =
  "h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60";

export function CreatableCombobox({
  items,
  value,
  onSelect,
  onCreate,
  placeholder = "— Opcional —",
  isLoading,
  className,
}: Props) {
  const [inputText, setInputText] = useState(
    () => items.find((i) => i.id === value)?.label ?? ""
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync input text when external value or items change
  useEffect(() => {
    setInputText(items.find((i) => i.id === value)?.label ?? "");
  }, [value, items]);

  // Close on outside click/touch
  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setInputText(items.find((i) => i.id === value)?.label ?? "");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [value, items]);

  const trimmed = inputText.trim();
  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(trimmed.toLowerCase())
  );
  const exactMatch = items.some(
    (i) => i.label.toLowerCase() === trimmed.toLowerCase()
  );
  const canCreate = trimmed !== "" && !exactMatch;

  async function handleCreate() {
    if (!trimmed) return;
    setIsCreating(true);
    try {
      const newItem = await onCreate(trimmed);
      onSelect(newItem.id, newItem.label);
      setInputText(newItem.label);
      setIsOpen(false);
    } catch {
      // error shown by caller
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={inputText}
        onChange={(e) => {
          setInputText(e.target.value);
          setIsOpen(true);
          if (!e.target.value) onSelect("", "");
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={isLoading ? "Cargando..." : placeholder}
        disabled={isLoading}
        className={className ?? defaultCls}
      />
      {isOpen && !isLoading && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-2xl border border-white/15 bg-[#1a1d24] shadow-xl">
          {filtered.length === 0 && !canCreate && (
            <p className="px-3 py-3 text-sm text-[var(--muted)]">Sin resultados</p>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(item.id, item.label);
                setInputText(item.label);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-3 text-sm transition-colors hover:bg-white/5 ${
                item.id === value ? "font-medium text-tz-yellow" : "text-[var(--text)]"
              }`}
            >
              {item.label}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              disabled={isCreating}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
              className="w-full border-t border-white/8 px-3 py-3 text-left text-sm text-tz-yellow transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              {isCreating ? "Guardando..." : `+ Crear "${trimmed}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
