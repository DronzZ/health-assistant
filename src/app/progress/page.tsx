import { redirect } from "next/navigation";

// Progress photos are managed via Telegram; body metrics live on the Body page.
export default function ProgressPage() {
  redirect("/body");
}
