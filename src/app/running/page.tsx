import { redirect } from "next/navigation";

// Running/cardio is folded into the Train page (Garmin activities section).
export default function RunningPage() {
  redirect("/workouts");
}
