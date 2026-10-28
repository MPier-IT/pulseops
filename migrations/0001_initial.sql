CREATE TABLE services (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, url TEXT NOT NULL, region TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'operational', latency INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE checks (id INTEGER PRIMARY KEY AUTOINCREMENT, service_id TEXT NOT NULL REFERENCES services(id), status TEXT NOT NULL, latency INTEGER NOT NULL, checked_at TEXT NOT NULL);
CREATE INDEX checks_service_time ON checks(service_id, checked_at DESC);
CREATE TABLE incidents (id TEXT PRIMARY KEY, service_id TEXT NOT NULL REFERENCES services(id), title TEXT NOT NULL, status TEXT NOT NULL, severity TEXT NOT NULL, started_at TEXT NOT NULL, resolved_at TEXT);
CREATE INDEX incidents_status ON incidents(status, started_at DESC);
CREATE UNIQUE INDEX one_open_incident_per_service ON incidents(service_id) WHERE status != 'resolved';
CREATE TABLE incident_events (id INTEGER PRIMARY KEY AUTOINCREMENT, incident_id TEXT NOT NULL REFERENCES incidents(id), message TEXT NOT NULL, created_at TEXT NOT NULL);
