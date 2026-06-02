import { GarminConnect } from "@flow-js/garmin-connect";
import { db } from "./db";
import { sendMessage } from "./telegram";
import { dateStringDaysAgo } from "./date";

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

// Garmin data for "today" is still accumulating (steps) or only finalised in the
// morning (last night's sleep is attributed to today's date), so we sync a small
// rolling window — yesterday + today — instead of only yesterday. The date string
// is computed in the user's timezone so it matches what the dashboard queries.
const SYNC_WINDOW = 2;

function recentDays(count: number): { date: Date; dateStr: string }[] {
  const days: { date: Date; dateStr: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dateStr = dateStringDaysAgo(i);
    days.push({ date: new Date(`${dateStr}T12:00:00Z`), dateStr });
  }
  return days;
}

// Drop null/undefined fields so a failed fetch (caught → null) never overwrites
// previously-synced values on the conflict update. `date` is always present.
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  ) as Partial<T>;
}

export async function syncDailyStats(): Promise<void> {
  try {
    const client = await getClient();

    for (const { date, dateStr } of recentDays(SYNC_WINDOW)) {
      const [steps, heartRate] = await Promise.all([
        client.getSteps(date).catch(() => null),
        client.getHeartRate(date).catch(() => null),
      ]);

      await db.from("garmin_data").upsert(
        compact({
          date: dateStr,
          steps: typeof steps === "number" ? steps : null,
          resting_hr: (heartRate as any)?.restingHeartRate ?? null,
          avg_hr: (heartRate as any)?.heartRateValues?.length
            ? Math.round(
                (heartRate as any).heartRateValues.reduce(
                  (s: number, v: any) => s + (Array.isArray(v) ? v[1] : v.value ?? 0),
                  0
                ) / (heartRate as any).heartRateValues.length
              )
            : null,
          max_hr: (heartRate as any)?.maxHeartRate ?? null,
          synced_at: new Date().toISOString(),
        }),
        { onConflict: "date" }
      );
    }
  } catch (error: any) {
    console.error("Garmin stats sync failed:", error);
    await sendMessage(`⚠️ Garmin stats sync failed: ${error.message ?? "unknown error"}`);
    throw error;
  }
}

export async function syncSleep(): Promise<void> {
  try {
    const client = await getClient();

    for (const { date, dateStr } of recentDays(SYNC_WINDOW)) {
      const sleep = await client.getSleepData(date).catch(() => null);
      if (!sleep) continue;

      const dto = sleep.dailySleepDTO;

      await db.from("garmin_data").upsert(
        compact({
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
        }),
        { onConflict: "date" }
      );
    }
  } catch (error: any) {
    console.error("Garmin sleep sync failed:", error);
    await sendMessage(`⚠️ Garmin sleep sync failed: ${error.message ?? "unknown error"}`);
    throw error;
  }
}

export async function syncActivities(): Promise<void> {
  try {
    const client = await getClient();
    const activities = await client.getActivities(0, 15).catch(() => null);
    if (!activities) return;

    const windowDates = new Set(recentDays(SYNC_WINDOW).map((d) => d.dateStr));

    for (const act of activities) {
      const actDate = (act.startTimeLocal ?? "").split(" ")[0];
      if (!windowDates.has(actDate)) continue;

      await db.from("garmin_activities").upsert(
        {
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
        },
        { onConflict: "activity_id" }
      );
    }
  } catch (error: any) {
    console.error("Garmin activities sync failed:", error);
    await sendMessage(`⚠️ Garmin activities sync failed: ${error.message ?? "unknown error"}`);
    throw error;
  }
}
