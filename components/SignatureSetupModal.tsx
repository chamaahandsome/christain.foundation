"use client";

// First-visit signature creation (the Maltivas DigitalSignatureModal flow):
// a cursive signature is auto-generated from the creator's name onto the
// canvas; they can redraw it by hand instead. Saved once, reused on every
// contract they send.

import { useCallback, useEffect, useRef, useState } from "react";

export function SignatureSetupModal({
  open,
  channelId,
  creatorName,
  onSaved,
  onClose,
}: {
  open: boolean;
  channelId: string;
  creatorName: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [name, setName] = useState(creatorName);
  const [mode, setMode] = useState<"generated" | "drawn">("generated");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderCursive = useCallback((text: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const scale = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * scale;
    canvas.height = canvas.offsetHeight * scale;
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    ctx.fillStyle = "#171717";
    // Cursive stack — the browser picks the best it has.
    let size = 44;
    do {
      ctx.font = `italic ${size}px "Snell Roundhand", "Segoe Script", "Brush Script MT", cursive`;
      size -= 2;
    } while (ctx.measureText(text).width > canvas.offsetWidth - 32 && size > 16);
    ctx.textBaseline = "middle";
    ctx.fillText(text, 16, canvas.offsetHeight / 2);
  }, []);

  useEffect(() => {
    if (open && mode === "generated") {
      setName(creatorName);
      // Wait a frame for layout so offsetWidth is real.
      requestAnimationFrame(() => renderCursive(creatorName));
    }
  }, [open, mode, creatorName, renderCursive]);

  if (!open) return null;

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
        <h2 className="text-lg font-semibold">Create your signature</h2>
        <p className="mt-1 text-sm text-neutral-500">
          It signs every contract you send — set it once here.
        </p>

        <label className="mt-4 block text-xs font-medium text-neutral-500">
          Your full legal name
        </label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (mode === "generated") renderCursive(e.target.value);
          }}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950"
        />

        <div className="mt-4 flex gap-2">
          {(
            [
              ["generated", "Generate from my name"],
              ["drawn", "Draw it myself"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                if (m === "drawn") clearCanvas();
                else renderCursive(name);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                mode === m
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <canvas
          ref={canvasRef}
          className={`mt-3 h-28 w-full rounded-lg border border-dashed border-neutral-300 bg-white dark:border-neutral-600 ${
            mode === "drawn" ? "touch-none cursor-crosshair" : ""
          }`}
          onPointerDown={(e) => {
            if (mode !== "drawn") return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            const ctx = e.currentTarget.getContext("2d");
            if (ctx) {
              ctx.lineWidth = 2;
              ctx.lineCap = "round";
              ctx.strokeStyle = "#171717";
              const { x, y } = pos(e);
              ctx.beginPath();
              ctx.moveTo(x, y);
            }
          }}
          onPointerMove={(e) => {
            if (mode !== "drawn" || !drawing.current) return;
            const ctx = e.currentTarget.getContext("2d");
            const { x, y } = pos(e);
            ctx?.lineTo(x, y);
            ctx?.stroke();
          }}
          onPointerUp={() => {
            drawing.current = false;
          }}
        />
        {mode === "drawn" && (
          <button
            onClick={clearCanvas}
            className="mt-1 text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            Clear
          </button>
        )}

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="text-sm text-neutral-500 hover:underline"
          >
            Later
          </button>
          <button
            disabled={busy || name.trim().length < 2}
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              setBusy(true);
              setError(null);
              void fetch("/api/studio/business/signature", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  channelId,
                  name,
                  signature: canvas.toDataURL("image/png"),
                }),
              })
                .then(async (res) => {
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setError(data.error ?? `Failed (${res.status})`);
                    return;
                  }
                  onSaved();
                })
                .finally(() => setBusy(false));
            }}
            className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save signature"}
          </button>
        </div>
      </div>
    </div>
  );
}
