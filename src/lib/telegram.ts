const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const MAX_MESSAGE_LENGTH = 4096;

export function isAllowedChat(chatId: number | string): boolean {
  return String(chatId) === String(process.env.TELEGRAM_CHAT_ID);
}

async function sendRaw(text: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "Markdown",
    }),
  });
}

// Splits long messages at word boundaries and sends sequentially
export async function sendMessage(text: string): Promise<void> {
  if (text.length <= MAX_MESSAGE_LENGTH) {
    await sendRaw(text);
    return;
  }

  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_MESSAGE_LENGTH) {
    let cutAt = remaining.lastIndexOf("\n", MAX_MESSAGE_LENGTH);
    if (cutAt < MAX_MESSAGE_LENGTH / 2) cutAt = MAX_MESSAGE_LENGTH;
    parts.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }
  if (remaining) parts.push(remaining);

  for (const part of parts) {
    await sendRaw(part);
  }
}

// Check if a Telegram message contains a photo sent as compressed image (not as file)
export function isCompressedPhoto(message: TelegramMessage): boolean {
  return !!(message.photo && !message.document);
}

// Check if message is a document (file) that looks like an image
export function isPhotoFile(message: TelegramMessage): boolean {
  return !!(
    message.document &&
    message.document.mime_type?.startsWith("image/")
  );
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  from?: { id: number; first_name: string };
  text?: string;
  caption?: string;
  photo?: { file_id: string; file_size: number; width: number; height: number }[];
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size: number };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export async function getFileUrl(fileId: string): Promise<string> {
  const res = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  const data = await res.json();
  return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
}

export async function downloadFileAsBase64(fileId: string): Promise<string> {
  const url = await getFileUrl(fileId);
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}
