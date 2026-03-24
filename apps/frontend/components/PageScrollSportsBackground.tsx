"use client";

import { useEffect } from "react";

export default function PageScrollSportsBackground() {
  useEffect(() => {
    const updateScrollVars = () => {
      const doc = document.documentElement;
      const shift = window.scrollY * 0.18;

      // Keep the court subtly moving with scroll.
      doc.style.setProperty("--badminton-court-shift", `${shift}px`);
    };

    updateScrollVars();
    window.addEventListener("scroll", updateScrollVars, { passive: true });
    window.addEventListener("resize", updateScrollVars);

    return () => {
      window.removeEventListener("scroll", updateScrollVars);
      window.removeEventListener("resize", updateScrollVars);
    };
  }, []);

  return null;
}
