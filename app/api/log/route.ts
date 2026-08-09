import { NextResponse } from "next/server";
import { z } from "zod";

// Lightweight client-event sink: shows up in the dev terminal locally and in
// function logs (e.g. Vercel) in production. No storage, no PII.

const BodySchema = z.object({
  source: z.string().min(1).max(40),
  videoId: z.string().min(1).max(20),
  code: z.number().int().optional(),
  message: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }
  const { source, videoId, code, message } = parsed.data;
  console.error(
    `[client-log] ${source}: video=${videoId}${code !== undefined ? ` code=${code}` : ""}${message ? ` (${message})` : ""}`,
  );
  return new NextResponse(null, { status: 204 });
}
