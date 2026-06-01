import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

interface SetEntry {
  reps: number;
  weight_kg: number;
}

interface ExerciseEntry {
  name: string;
  sets: SetEntry[];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, exercises }: { date: string; exercises: ExerciseEntry[] } = await req.json();

  if (!date || !exercises?.length) {
    return NextResponse.json({ error: "Missing date or exercises" }, { status: 400 });
  }

  const rows = exercises.flatMap((ex) =>
    ex.sets.map((s, i) => ({
      date,
      exercise: ex.name.toLowerCase().trim(),
      set_number: i + 1,
      reps: s.reps,
      weight_kg: s.weight_kg,
    }))
  );

  const { error } = await db.from("workouts").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, logged: rows.length });
}
