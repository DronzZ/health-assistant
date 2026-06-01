import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./model-router";
import { db } from "./db";
import { uploadPhoto, getSignedUrl } from "./signed-url";
import { sendMessage } from "./telegram";

const client = new Anthropic();

export async function analyzeProgressPhoto(
  imageBase64: string,
  mimeType: string,
  fileBuffer: Buffer,
  fileSizeKb: number
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // Get the previous photo for comparison
  const { data: prevPhotos } = await db
    .from("progress_photos")
    .select("*")
    .order("date", { ascending: false })
    .limit(1);

  const prevPhoto = prevPhotos?.[0];

  let previousImageContent: Anthropic.ImageBlockParam | null = null;
  if (prevPhoto?.storage_path) {
    try {
      const signedUrl = await getSignedUrl(prevPhoto.storage_path);
      const res = await fetch(signedUrl);
      const buf = await res.arrayBuffer();
      previousImageContent = {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: Buffer.from(buf).toString("base64"),
        },
      };
    } catch {
      // If we can't fetch the previous photo, proceed without it
    }
  }

  const messageContent: Anthropic.ContentBlockParam[] = [];

  if (previousImageContent) {
    messageContent.push(previousImageContent);
    messageContent.push({
      type: "text",
      text: `Previous photo from ${prevPhoto.date}. Now the new photo:`,
    });
  }

  messageContent.push({
    type: "image",
    source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: imageBase64 },
  });

  messageContent.push({
    type: "text",
    text: prevPhoto
      ? `Compare these two progress photos. Be direct and specific: what has visually changed in fat distribution, muscle definition, waist-to-shoulder ratio, and overall body composition? Call out improvements and what still needs work. No fluff.`
      : `Describe this progress photo objectively: current body composition, visible fat distribution, muscle development, and areas to focus on. Be direct.`,
  });

  const response = await client.messages.create({
    model: MODELS.sonnet,
    max_tokens: 600,
    messages: [{ role: "user", content: messageContent }],
  });

  const analysis = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("\n");

  // Upload photo to Supabase Storage
  const fileName = `${today}-progress.jpg`;
  const storagePath = await uploadPhoto(fileBuffer, fileName, mimeType);

  // Save to DB
  await db.from("progress_photos").insert({
    date: today,
    storage_path: storagePath,
    claude_analysis: analysis,
    file_size_kb: fileSizeKb,
  });

  await sendMessage(`?? *Progress Photo � ${today}*\n\n${analysis}`);
}
