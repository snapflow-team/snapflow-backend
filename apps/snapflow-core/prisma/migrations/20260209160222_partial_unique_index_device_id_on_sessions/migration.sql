-- up
DROP INDEX IF EXISTS sessions_deviceId_key;
CREATE UNIQUE INDEX idx_sessions_deviceId_active
    ON sessions ("deviceId")
    WHERE deleted_at IS NULL;
