"use client";

// Anti-copy chrome for the ebook reader (ported intent from the Maltivas
// anti-piracy layer): selection and context menu disabled, buyer-email
// watermark tiled behind the text. Determined pirates screenshot anyway —
// the goal is honest friction, not DRM theater.

export function ReaderShell({
  watermark,
  children,
}: {
  watermark: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative select-none"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="flex h-full w-full -rotate-12 flex-wrap content-around gap-x-24 gap-y-20 opacity-[0.05]">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="whitespace-nowrap text-sm">
              {watermark}
            </span>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
