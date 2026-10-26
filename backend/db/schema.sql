-- FaultBeforeYou SQLite Schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('viewer', 'reporter', 'technician', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('printer', 'projector', 'desktop', 'scanner')),
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'out_of_service', 'maintenance')),
  model_number TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id TEXT NOT NULL,
  reporter_id INTEGER,
  reporter_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT CHECK(category IN ('Hardware', 'Supplies', 'Connectivity', 'Software', 'Display', 'Other')),
  severity TEXT DEFAULT 'Medium' CHECK(severity IN ('Low', 'Medium', 'High')),
  ai_summary TEXT,
  ai_next_step TEXT,
  technician_required INTEGER DEFAULT 1,
  ai_reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'reported' CHECK(status IN ('reported', 'under_investigation', 'awaiting_verification', 'resolved')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id),
  FOREIGN KEY (reporter_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS incident_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL,
  user_id INTEGER,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  update_type TEXT NOT NULL CHECK(update_type IN ('note', 'repair_attempt', 'status_change', 'ai_classification')),
  note TEXT NOT NULL,
  action_taken TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id TEXT NOT NULL,
  incident_id INTEGER,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by_id INTEGER,
  changed_by_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id),
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS verification_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL,
  equipment_id TEXT NOT NULL,
  verifier_id INTEGER NOT NULL,
  verifier_name TEXT NOT NULL,
  test_name TEXT NOT NULL,
  test_result TEXT NOT NULL CHECK(test_result IN ('passed', 'failed')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id),
  FOREIGN KEY (equipment_id) REFERENCES equipment(id),
  FOREIGN KEY (verifier_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS manual_passages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_type TEXT NOT NULL CHECK(equipment_type IN ('printer', 'projector', 'desktop', 'scanner')),
  manual_name TEXT NOT NULL,
  section_number TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT NOT NULL,
  is_user_safe INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id TEXT,
  incident_id INTEGER,
  type TEXT NOT NULL CHECK(type IN ('warning', 'info', 'success')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id),
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_equipment ON incidents(equipment_id);
CREATE INDEX IF NOT EXISTS idx_status_history_equipment ON status_history(equipment_id);
CREATE INDEX IF NOT EXISTS idx_verification_records_incident ON verification_records(incident_id);
