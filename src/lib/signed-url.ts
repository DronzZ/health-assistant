import { db } from "./db";

const BUCKET = "progress-photos";
const TTL_SECONDS = 3600; // 1 hour

export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }

  return data.signedUrl;
}

export async function uploadPhoto(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const path = `${new Date().getFullYear()}/${fileName}`;
  const { error } = await db.storage.from(BUCKET).upload(path, fileBuffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}
