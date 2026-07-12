ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS maintenance_started_at TIMESTAMPTZ;

UPDATE system_settings
SET maintenance_started_at = updated_at
WHERE maintenance_mode = TRUE AND maintenance_started_at IS NULL;
