import { db } from "./db";
import { sendMessage } from "./telegram";

const HEVY_API = "https://api.hevyapp.com/v1";

function yesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export async function syncWorkouts(): Promise<void> {
  const date = yesterdayDate();
  try {
    const res = await fetch(`${HEVY_API}/workouts?after=${date}T00:00:00Z`, {
      headers: { "api-key": process.env.HEVY_API_KEY! },
    });

    if (!res.ok) {
      throw new Error(`Hevy API returned ${res.status}`);
    }

    const data = await res.json();
    const workouts = data.workouts ?? [];

    for (const workout of workouts) {
      const workoutDate = workout.start_time?.split("T")[0];
      if (workoutDate !== date) continue;

      for (const exercise of workout.exercises ?? []) {
        for (let i = 0; i < (exercise.sets ?? []).length; i++) {
          const set = exercise.sets[i];
          await db.from("workouts").upsert({
            hevy_id: `${workout.id}-${exercise.index}-${i}`,
            date: workoutDate,
            exercise: exercise.title ?? exercise.exercise_template_id ?? "Unknown",
            set_number: i + 1,
            reps: set.reps ?? null,
            weight_kg: set.weight_kg ?? null,
            synced_at: new Date().toISOString(),
          }, { onConflict: "hevy_id", ignoreDuplicates: false });
        }
      }
    }
  } catch (error: any) {
    console.error("Hevy sync failed:", error);
    await sendMessage(`?? Hevy sync failed: ${error.message ?? "unknown error"}`);
    throw error;
  }
}
