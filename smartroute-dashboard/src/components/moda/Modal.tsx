import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ title, onClose, children }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-200 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full sm:max-w-2xl max-h-[85dvh] overflow-y-auto rounded-t-xl sm:rounded-xl border border-light-1/15 bg-dark-2 p-4 sm:p-5 text-sm text-light-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="shrink-0 min-h-10 rounded-md border border-light-1/20 px-3 text-xs hover:bg-light-1/10 cursor-pointer"
          >
            Tutup
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
