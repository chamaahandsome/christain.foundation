// S3 uploads — same bucket and env conventions as Maltivas (NEXT_AWS_*),
// so the existing AWS setup drops straight in. Lazy like the Stripe client:
// the app boots without AWS keys and upload surfaces degrade with a notice.

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function s3Configured(): boolean {
  return Boolean(
    process.env.NEXT_AWS_REGION &&
      process.env.NEXT_AWS_ACCESS_KEY_ID &&
      process.env.NEXT_AWS_SECRET_ACCESS_KEY &&
      process.env.NEXT_AWS_BUCKET_NAME,
  );
}

function s3Client(): S3Client {
  if (!s3Configured()) throw new Error("S3 is not configured.");
  client ??= new S3Client({
    region: process.env.NEXT_AWS_REGION!,
    credentials: {
      accessKeyId: process.env.NEXT_AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.NEXT_AWS_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

/** Keep keys URL-safe: drop anything exotic from user file names. */
export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

/** Upload a publicly-readable object; returns its virtual-hosted URL
 * (the Maltivas pattern for stored asset URLs). */
export async function uploadPublicObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const bucket = process.env.NEXT_AWS_BUCKET_NAME!;
  await s3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
  return `https://${bucket}.s3.${process.env.NEXT_AWS_REGION}.amazonaws.com/${input.key}`;
}
