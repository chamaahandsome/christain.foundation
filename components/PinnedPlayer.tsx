"use client";

// Pins the player under the site header below the desktop breakpoint and
// reserves its exact height in the document flow. The spacer is measured
// from the real rendered bar (ResizeObserver), so embed chrome or aspect
// differences can never hide content behind the player.

import { useEffect, useRef, useState } from "react";

export function PinnedPlayer({ children }: { children: React.ReactNode }) {
  const barRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        ref={barRef}
        className="fixed inset-x-0 top-14 z-30 bg-black lg:static lg:inset-x-auto lg:z-auto lg:bg-transparent"
      >
        <div className="mx-auto w-full max-w-xl lg:max-w-none">{children}</div>
      </div>
      <div
        aria-hidden
        className={
          height === null
            ? "mx-auto aspect-video w-full max-w-xl lg:hidden"
            : "lg:hidden"
        }
        style={height === null ? undefined : { height }}
      />
    </>
  );
}
