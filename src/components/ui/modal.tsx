"use client";

import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** id of the heading inside the modal, for screen readers. */
  labelledBy?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        // text-left: the dialog can be mounted inside a right-aligned cell.
        className="max-h-[90vh] w-full max-w-[430px] overflow-auto rounded-modal bg-card p-6 text-left"
      >
        {children}
      </div>
    </div>
  );
}
