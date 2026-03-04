interface FilterDef<T extends string> {
  label: string;
  value: T;
}

interface FilterTabsProps<T extends string> {
  filters: FilterDef<T>[];
  /** Pass a single value for single-select, or an array for multi-select. */
  active: T | T[];
  onToggle: (value: T) => void;
  className?: string;
}

export default function FilterTabs<T extends string>({
  filters,
  active,
  onToggle,
  className = "",
}: FilterTabsProps<T>) {
  const activeArr = Array.isArray(active) ? active : [active];

  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {filters.map((f) => {
        const isActive = activeArr.includes(f.value);
        return (
          <button
            key={f.value}
            onClick={() => onToggle(f.value)}
            className={`text-sm px-4 py-1.5 rounded-full border font-medium transition-colors ${
              isActive
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
