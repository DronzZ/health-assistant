import { GarminConnect } from "garmin-connect";
import { db } from "./db";
import { sendMessage } from "./telegram";

async function getClient(): Promise<GarminConnect> {
  const client = new GarminConnect({
    username: process.env.GARMIN_EMAIL!,
    password: process.env.GARMIN_PASSWORD!,
  });

  const { data: authData } = await db.from("garmin_auth").select("*").single();
  if (authData?.session_data) {
    try {
      client.loadToken(
        authData.session_data.oauth1,
        authData.session_data.oauth2
      );
      return client;
    } catch {
      // Session invalid, re-authenticate below
    }
  }

  await client.login(process.env.GARMIN_EMAIL!, process.env.GARMIN_PASSWORD!);

  const token = client.exportToken();
  await db.from("garmin_auth").upsert({
    id: authData?.id ?? undefined,
    session_data: token,
    last_auth_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return client;
}

function yesterdayDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return d;
}

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function syncDailyStats(): Promise<void> {
  const date = yesterdayDate();
  const dateStr = toDateString(date);
  try {
    const client = await getClient();

    const [steps, heartRate] = await Promise.all([
      client.getSteps(date).catch(() => null),
      client.getHeartRate(date).catch(() => null),
    ]);

    await db.from("garmin_data").upsert({
      date: dateStr,
      steps: typeof steps === "number" ? steps : null,
      resting_hr: (heartRate as any)?.restingHeartRate ?? null,
      avg_hr: (heartRate as any)?.heartRateValues?.length
        ? Math.round(
            (heartRate as any).heartRateValues.reduce((s: number, v: any) => s + (Array.isArray(v) ? v[1] : v.value ?? 0), 0) /
              (heartRate as any).heartRateValues.length
          )
        : null,
      max_hr: (heartRate as any)?.maxHeartRate ?? null,
      synced_at: new Date().toISOString(),
    }, { onConflict: "date" });
  } catch (error: any) {
    console.error("Garmin stats sync failed:", error);
    await sendMessage(`⚠️ Garmin stats sync failed: ${error.message ?? "unknown error"}`);
    throw error;
  }
}

export async function syncSleep(): Promise<void> {
  const date = yesterdayDate();
  const dateStr = toDateString(date);
  try {
    const client = await getClient();
    const sleep = await client.getSleepData(date).catch(() => null);
    if (!sleep) return;

    const dto = sleep.dailySleepDTO;

    await db.from("garmin_data").upsert({
      date: dateStr,
      sleep_score: dto?.sleepScores?.overall?.value ?? null,
      sleep_duration_min: dto?.sleepTimeSeconds ? Math.round(dto.sleepTimeSeconds / 60) : null,
      deep_sleep_min: dto?.deepSleepSeconds ? Math.round(dto.deepSleepSeconds / 60) : null,
      light_sleep_min: dto?.lightSleepSeconds ? Math.round(dto.lightSleepSeconds / 60) : null,
      rem_sleep_min: dto?.remSleepSeconds ? Math.round(dto.remSleepSeconds / 60) : null,
      awake_min: dto?.awakeSleepSeconds ? Math.round(dto.awakeSleepSeconds / 60) : null,
      sleep_avg_respiration: dto?.averageRespirationValue ?? null,
      hrv_last_night: sleep.avgOvernightHrv ?? null,
      hrv_status: sleep.hrvStatus ?? null,
      body_battery_drain: sleep.bodyBatteryChange ?? null,
    }, { onConflict: "date" });
  } catch (error: any) {
    console.error("Garmin sleep sync failed:", error);
    await sendMessage(`⚠️ Garmin sleep sync failed: ${error.message ?? "unknown error"}`);
    throw error;
  }
}

export async function syncActivities(): Promise<void> {
  const dateStr = toDateString(yesterdayDate());
  try {
    const client = await getClient();
    const activities = await client.getActivities(0, 10).catch(() => null);
    if (!activities) return;

    for (const act of activities) {
      const actDate = (act.startTimeLocal ?? "").split(" ")[0];
      if (actDate !== dateStr) continue;

      await db.from("garmin_activities").upsert({
        activity_id: String(act.activityId),
        date: actDate,
        type: act.activityType?.typeKey ?? null,
        name: act.activityName ?? null,
        duration_min: act.duration ? Math.round(act.duration / 60) : null,
        distance_km: act.distance ? act.distance / 1000 : null,
        avg_hr: act.averageHR ?? null,
        max_hr: act.maxHR ?? null,
        calories: act.calories ?? null,
        training_effect_aerobic: act.aerobicTrainingEffect ?? null,
        training_effect_anaerobic: act.anaerobicTrainingEffect ?? null,
        training_load: (act as any).trainingLoad ?? null,
        synced_at: new Date().toISOString(),
      }, { onConflict: "activity_id" });
    }

    // Also sync Hevy workouts alongside activities
    const { syncWorkouts } = await import("./hevy");
    await syncWorkouts().catch((e) => {
      console.warn("Hevy sync failed (non-fatal):", e.message);
    });
  } catch (error: any) {
    console.error("Garmin activities sync failed:", error);
    await sendMessage(`⚠️ Garmin activities sync failed: ${error.message ?? "unknown error"}`);
    throw error;
  }
}
