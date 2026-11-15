-- Migration: Add ELMIS integration columns to reports table
-- Author: MarkDanielsMCraft

ALTER TABLE reports ADD COLUMN IF NOT EXISTS elmis_sync_id text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS elmis_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_reports_elmis_sync ON reports (elmis_sync_id) WHERE elmis_sync_id IS NOT NULL;
