"use client";

import { useState } from "react";

export function useFilterToggle<T extends string>(initial: T[], allValue: T) {
  const [activeFilters, setActiveFilters] = useState<T[]>(initial);

  function toggleFilter(value: T) {
    if (value === allValue) {
      setActiveFilters([allValue]);
      return;
    }
    setActiveFilters((prev) => {
      const without = prev.filter((f) => f !== allValue);
      if (without.includes(value)) {
        const next = without.filter((f) => f !== value);
        return next.length === 0 ? [allValue] : next;
      }
      return [...without, value];
    });
  }

  return { activeFilters, toggleFilter };
}
