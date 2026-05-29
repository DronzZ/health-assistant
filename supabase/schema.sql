-- Health Assistant Database Schema
-- Run this in the Supabase SQL editor (supabase.com -> your project -> SQL editor)

-- Daily logs: water, weight, supplements, readiness
CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  water_ml integer DEFAULT 0,
  weight_kg numeric(5,2),
  weight_7day_avg numeric(5,2),
  supplements text[] DEFAULT '{}',
  morning_energy integer CHECK (morning_energy BETWEEN 1 AND 10),
  morning_soreness integer CHECK (morning_soreness BETWEEN 1 AND 10),
  morning_knee_pain integer CHECK (morning_knee_pain BETWEEN 1 AND 10),
  morning_mood integer CHECK (morning_mood BETWEEN 1 AND 10),
  hunger_level integer CHECK (hunger_level BETWEEN 1 AND 10),
  alcohol_units numeric(4,1) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Food entries: individual meals with macro breakdown
CREATE TABLE IF NOT EXISTS food_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  name text NOT NULL,
  grams_eaten numeric(7,1),
  calories numeric(7,1) NOT NULL,
  protein_g numeric(6,1) DEFAULT 0,
  carbs_g numeric(6,1) DEFAULT 0,
  fat_g numeric(6,1) DEFAULT 0,
  fiber_g numeric(6,1) DEFAULT 0,
  meal_slot text CHECK (meal_slot IN ('breakfast','lunch','dinner','snack')) DEFAULT 'snack',
  source text CHECK (source IN ('photo_label','database','estimated')) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Monthly body measurements
CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  waist_cm numeric(5,1),
  hips_cm numeric(5,1),
  chest_cm numeric(5,1),
  left_arm_cm numeric(5,1),
  right_arm_cm numeric(5,1),
  left_thigh_cm numeric(5,1),
  right_thigh_cm numeric(5,1),
  created_at timestamptz DEFAULT now()
);

-- Knee and pain log
CREATE TABLE IF NOT EXISTS pain_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  logged_at timestamptz DEFAULT now(),
  pain_score integer NOT NULL CHECK (pain_score BETWEEN 0 AND 10),
  location text,
  pain_type text,
  activity_context text,
  notes text
);

-- User targets and TDEE
CREATE TABLE IF NOT EXISTS user_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tdee integer,
  calorie_target integer,
  protein_g integer,
  fiber_g integer DEFAULT 35,
  water_ml integer DEFAULT 2500,
  steps integer DEFAULT 8000,
  last_tdee_recalc_weight_kg numeric(5,2),
  last_tdee_recalc_date date,
  updated_at timestamptz DEFAULT now()
);

-- Garmin auth token (persisted to avoid re-auth every sync)
CREATE TABLE IF NOT EXISTS garmin_auth (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_data jsonb,
  last_auth_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Garmin daily stats
CREATE TABLE IF NOT EXISTS garmin_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  steps integer,
  distance_km numeric(6,2),
  floors_climbed integer,
  calories_active integer,
  calories_bmr integer,
  calories_total integer,
  intensity_min_moderate integer,
  intensity_min_vigorous integer,
  resting_hr integer,
  avg_hr integer,
  max_hr integer,
  hrv_last_night numeric(5,1),
  hrv_weekly_avg numeric(5,1),
  hrv_status text,
  sleep_score integer,
  sleep_start timestamptz,
  sleep_end timestamptz,
  sleep_duration_min integer,
  deep_sleep_min integer,
  light_sleep_min integer,
  rem_sleep_min integer,
  awake_min integer,
  sleep_avg_hrv numeric(5,1),
  sleep_avg_respiration numeric(5,1),
  sleep_avg_spo2 numeric(5,1),
  body_battery_start integer,
  body_battery_end integer,
  body_battery_drain integer,
  stress_avg integer,
  stress_max integer,
  rest_stress_pct integer,
  avg_respiration numeric(5,1),
  avg_spo2 numeric(5,1),
  vo2max numeric(5,1),
  training_load numeric(6,1),
  training_readiness integer,
  recovery_time_hours integer,
  synced_at timestamptz DEFAULT now()
);

-- Garmin activities (runs, rides, gym sessions, etc.)
CREATE TABLE IF NOT EXISTS garmin_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id text UNIQUE NOT NULL,
  date date NOT NULL,
  type text,
  name text,
  duration_min integer,
  distance_km numeric(6,2),
  avg_hr integer,
  max_hr integer,
  calories integer,
  avg_pace_per_km numeric(6,2),
  training_effect_aerobic numeric(4,1),
  training_effect_anaerobic numeric(4,1),
  training_load numeric(6,1),
  hr_zone_1_min integer,
  hr_zone_2_min integer,
  hr_zone_3_min integer,
  hr_zone_4_min integer,
  hr_zone_5_min integer,
  synced_at timestamptz DEFAULT now()
);

-- Hevy workouts
CREATE TABLE IF NOT EXISTS workouts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hevy_id text,
  date date NOT NULL,
  exercise text NOT NULL,
  set_number integer,
  reps integer,
  weight_kg numeric(6,2),
  synced_at timestamptz DEFAULT now()
);

-- Running plan
CREATE TABLE IF NOT EXISTS running_plan (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week integer NOT NULL,
  session integer NOT NULL,
  type text CHECK (type IN ('easy','tempo','long','rest','walk')) NOT NULL,
  target_distance_km numeric(5,2),
  target_duration_min integer,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  knee_screen_notes text,
  UNIQUE(week, session)
);

-- Weekly meal plan
CREATE TABLE IF NOT EXISTS meal_plan (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6) NOT NULL,
  meal_slot text CHECK (meal_slot IN ('breakfast','lunch','dinner','snack')) NOT NULL,
  food_item text NOT NULL,
  target_grams numeric(6,1),
  kcal_per_100g numeric(6,1),
  protein_per_100g numeric(6,1),
  carbs_per_100g numeric(6,1),
  fat_per_100g numeric(6,1),
  fiber_per_100g numeric(6,1) DEFAULT 0,
  is_refeed_day boolean DEFAULT false,
  UNIQUE(day_of_week, meal_slot, food_item)
);

-- Supplement schedule
CREATE TABLE IF NOT EXISTS supplement_schedule (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplement_name text NOT NULL,
  timing text CHECK (timing IN ('morning','pre-workout','post-workout','evening')) NOT NULL,
  reminder_time time NOT NULL,
  notes text
);

-- Conversation history (last 30 days kept, older summarised)
CREATE TABLE IF NOT EXISTS conversation_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  role text CHECK (role IN ('user','assistant')) NOT NULL,
  message text NOT NULL,
  model_used text,
  actions_taken jsonb DEFAULT '[]',
  token_count integer
);

-- Conversation summaries (replace old messages)
CREATE TABLE IF NOT EXISTS conversation_summary (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  summary_text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Progress photos
CREATE TABLE IF NOT EXISTS progress_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  storage_path text NOT NULL,
  claude_analysis text,
  file_size_kb integer,
  created_at timestamptz DEFAULT now()
);

-- Bloodwork markers
CREATE TABLE IF NOT EXISTS bloodwork (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  marker text NOT NULL,
  value numeric(10,3),
  unit text,
  reference_range text,
  status text CHECK (status IN ('optimal','suboptimal','deficient','high','normal')),
  created_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_food_entries_date ON food_entries(date);
CREATE INDEX IF NOT EXISTS idx_garmin_data_date ON garmin_data(date);
CREATE INDEX IF NOT EXISTS idx_garmin_activities_date ON garmin_activities(date);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
CREATE INDEX IF NOT EXISTS idx_pain_log_date ON pain_log(date);
CREATE INDEX IF NOT EXISTS idx_conversation_history_created ON conversation_history(created_at);
CREATE INDEX IF NOT EXISTS idx_bloodwork_date ON bloodwork(date);
CREATE INDEX IF NOT EXISTS idx_bloodwork_marker ON bloodwork(marker);

-- Row Level Security (single-user app — service key bypasses RLS, anon key is blocked)
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pain_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE running_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloodwork ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_auth ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write their own data
-- (In practice the server uses the service key which bypasses RLS)
-- This prevents the anon key from reading data if ever exposed
CREATE POLICY "authenticated_only" ON daily_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON food_entries FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON body_measurements FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON pain_log FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON user_targets FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON garmin_data FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON garmin_activities FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON workouts FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON running_plan FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON meal_plan FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON supplement_schedule FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON conversation_history FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON conversation_summary FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON progress_photos FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON bloodwork FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_only" ON garmin_auth FOR ALL TO authenticated USING (true);

-- Insert a default user_targets row
INSERT INTO user_targets (tdee, calorie_target, protein_g, fiber_g, water_ml, steps)
VALUES (2500, 2000, 160, 35, 2500, 8000)
ON CONFLICT DO NOTHING;
