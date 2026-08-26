"use client";

// Animated explainer for Trickl micro-payments, modeled on the live
// round-up demo on trickl.app: everyday purchases round up, and each
// spare-change chunk pays STRAIGHT THROUGH to the creator — the bar fills,
// nothing is ever held. Pure CSS transitions, no animation library; loops.

import { useEffect, useState } from "react";

const PURCHASES = [
  { icon: "☕", name: "Coffee", amount: "$4.47", rounded: "$5.00", chunk: 53 },
  { icon: "🛒", name: "Groceries", amount: "$23.10", rounded: "$24.00", chunk: 90 },
  { icon: "⛽", name: "Fuel", amount: "$38.25", rounded: "$39.00", chunk: 75 },
  { icon: "🍽️", name: "Lunch", amount: "$11.20", rounded: "$12.00", chunk: 80 },
];

const TARGET_CENTS = 900; // the $9 ebook being paid off

export function TricklDemo() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible((v) => (v >= PURCHASES.length ? 0 : v + 1));
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  const paidCents =
    600 + PURCHASES.slice(0, visible).reduce((sum, p) => sum + p.chunk, 0);
  const percent = Math.min(100, Math.round((paidCents / TARGET_CENTS) * 100));

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      {/* Live header */}
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          How Trickl pays you
        </span>
      </div>

      {/* Rounding purchases */}
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
        {PURCHASES.map((purchase, i) => {
          const shown = i < visible;
          return (
            <li
              key={purchase.name}
              className={`flex items-center justify-between px-4 transition-all duration-500 motion-reduce:transition-none ${
                shown
                  ? "max-h-14 py-2.5 opacity-100"
                  : "max-h-0 overflow-hidden py-0 opacity-0"
              } ${i === visible - 1 ? "bg-teal-50/60 dark:bg-teal-950/20" : ""}`}
            >
              <span className="flex items-center gap-2.5 text-sm">
                <span aria-hidden>{purchase.icon}</span>
                <span>
                  <span className="font-medium">{purchase.name}</span>
                  <span className="ml-2 text-xs text-neutral-500">
                    {purchase.amount}{" "}
                    <span className="font-semibold text-teal-600 dark:text-teal-400">
                      → {purchase.rounded}
                    </span>
                  </span>
                </span>
              </span>
              <span className="text-sm font-semibold text-teal-600 dark:text-teal-400">
                +{(purchase.chunk / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </span>
            </li>
          );
        })}
      </ul>

      {/* The chunks pay the item down — instantly */}
      <div className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">
            📖 &ldquo;Knowing God&rdquo; ebook · $9.00
          </span>
          <span className="font-semibold text-amber-700 dark:text-amber-400">
            ${(paidCents / 100).toFixed(2)} paid to you
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-linear-to-r from-teal-400 to-amber-500 transition-all duration-700 motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-4 text-neutral-500">
          Every chunk lands in your Stripe account the moment it's collected —
          nothing is saved up or held along the way.
        </p>
      </div>
    </div>
  );
}
