ALTER TABLE reports ALTER COLUMN acc DROP NOT NULL;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS photo_hash text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS time_source text,
  ADD COLUMN IF NOT EXISTS device_public_key text;

CREATE UNIQUE INDEX IF NOT EXISTS reports_photo_hash_uidx
  ON reports (photo_hash)
  WHERE photo_hash IS NOT NULL;