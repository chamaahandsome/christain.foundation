"use client";

// Crop step for image uploads (ported from the Trickl/Maltivas pattern):
// react-easy-crop viewport + zoom slider, canvas-cropped to a JPEG blob.
// The aspect matches the surface the image is for — square/round avatars,
// wide banners, tall book covers — so what's uploaded is what shows.

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      "image/jpeg",
      0.92,
    );
  });
}

export function ImageCropModal({
  imageSrc,
  aspect,
  cropShape = "rect",
  busy = false,
  onCropped,
  onCancel,
}: {
  imageSrc: string;
  aspect: number;
  cropShape?: "rect" | "round";
  busy?: boolean;
  onCropped: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setAreaPixels(pixels);
  }, []);

  async function confirm() {
    if (!areaPixels) return;
    onCropped(await getCroppedBlob(imageSrc, areaPixels));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
          <h3 className="font-semibold">Crop the image</h3>
          <button
            type="button"
            aria-label="Cancel crop"
            onClick={onCancel}
            disabled={busy}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            ✕
          </button>
        </div>

        <div className="relative h-[340px] w-full bg-neutral-950 sm:h-[400px]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="flex items-center gap-3 px-5 py-3">
          <span className="text-xs text-neutral-500">−</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="flex-1"
          />
          <span className="text-xs text-neutral-500">+</span>
        </div>

        <div className="flex gap-3 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-neutral-300 py-2.5 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy || !areaPixels}
            className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
          >
            {busy ? "Uploading…" : "Use this crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
