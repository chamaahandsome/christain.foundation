"use client";

// The Start Here page frame: a step, and the note about its teachers.
//
// Rolled up, the note is only its heading and the step stays centred, as it
// always was. Opened, the step slides to the left edge and the note widens
// beside it with the full text.
//
// Sliding needs room: a centred 48rem step leaves a 240px margin inside the
// 80rem container, just enough for the rolled-up card, which only exists
// from about 1320px wide. Below that there is no room beside the step, so
// the note sits above it and opens downward instead.

import { useState } from "react";
import { StartHereTeachersNote } from "@/components/StartHereTeachersNote";

export function StartHereFrame({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <main className="relative mx-auto max-w-7xl px-4 py-8">
      {/* The note. Wide: a full-height column pinned to the right, so the
          card inside can stay in view while the page scrolls. Narrow: in the
          flow above the step, at the step's width. */}
      <aside className="mb-6 min-[1320px]:absolute min-[1320px]:inset-y-8 min-[1320px]:right-4 min-[1320px]:mb-0">
        <div
          className={`mx-auto max-w-3xl transition-[width] duration-500 ease-out motion-reduce:transition-none min-[1320px]:sticky min-[1320px]:top-20 min-[1320px]:max-w-none ${
            expanded ? "min-[1320px]:w-[17rem]" : "min-[1320px]:w-56"
          }`}
        >
          <StartHereTeachersNote expanded={expanded} onToggle={() => setExpanded((open) => !open)} />
        </div>
      </aside>

      {/* The step: centred while the note is rolled up, slid to the left
          edge while it is open. Margin (not transform) moves it, so the
          layout itself makes room rather than the step painting over the
          note. */}
      <div
        className={`min-w-0 transition-[margin] duration-500 ease-out motion-reduce:transition-none min-[1320px]:w-[48rem] ${
          expanded ? "min-[1320px]:ml-0" : "min-[1320px]:ml-[calc((100%_-_48rem)/2)]"
        }`}
      >
        <div className="mx-auto max-w-3xl">{children}</div>
      </div>
    </main>
  );
}
