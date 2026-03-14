-- ============================================================
-- Car Maintenance Tracker — Supabase Schema
-- Run this in your Supabase project: Dashboard → SQL Editor
-- ============================================================

-- Enable RLS
-- (Row Level Security ensures users can only see their own data)

-- ───────────────────────────── CARS ─────────────────────────────
CREATE TABLE IF NOT EXISTS cars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname        TEXT,
  make            TEXT NOT NULL,
  model           TEXT NOT NULL,
  year            INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2100),
  current_mileage INTEGER NOT NULL DEFAULT 0 CHECK (current_mileage >= 0),
  color           TEXT,
  vin             TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their cars"
  ON cars FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ───────────────────────── MAINTENANCE LOGS ──────────────────────
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id              UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  custom_label        TEXT,
  date                DATE NOT NULL,
  mileage_at_service  INTEGER NOT NULL CHECK (mileage_at_service >= 0),
  cost                NUMERIC(10, 2),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage logs for their cars"
  ON maintenance_logs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM cars WHERE cars.id = maintenance_logs.car_id AND cars.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM cars WHERE cars.id = maintenance_logs.car_id AND cars.user_id = auth.uid())
  );

-- ──────────────────────── MAINTENANCE SCHEDULES ──────────────────
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id            UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  custom_label      TEXT,
  interval_miles    INTEGER,
  interval_months   INTEGER,
  next_due_date     DATE,
  next_due_mileage  INTEGER,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (car_id, type)
);

ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage schedules for their cars"
  ON maintenance_schedules FOR ALL
  USING (
    EXISTS (SELECT 1 FROM cars WHERE cars.id = maintenance_schedules.car_id AND cars.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM cars WHERE cars.id = maintenance_schedules.car_id AND cars.user_id = auth.uid())
  );

-- ──────────────────────── INDEXES ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cars_user_id            ON cars(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_car_id             ON maintenance_logs(car_id);
CREATE INDEX IF NOT EXISTS idx_logs_date               ON maintenance_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_schedules_car_id        ON maintenance_schedules(car_id);
CREATE INDEX IF NOT EXISTS idx_schedules_next_due_date ON maintenance_schedules(next_due_date);
