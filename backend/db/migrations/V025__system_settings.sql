CREATE TABLE IF NOT EXISTS system_settings (
    id                   INTEGER     PRIMARY KEY DEFAULT 1,
    maintenance_mode     BOOLEAN     NOT NULL DEFAULT FALSE,
    platform_fee_percent INTEGER     NOT NULL DEFAULT 20,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT system_settings_single_row CHECK (id = 1)
);

INSERT INTO system_settings (id, maintenance_mode, platform_fee_percent)
VALUES (1, FALSE, 20)
ON CONFLICT (id) DO NOTHING;
