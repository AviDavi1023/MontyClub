-- Create clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  advisor TEXT NOT NULL,
  student_leader TEXT NOT NULL,
  meeting_time TEXT NOT NULL,
  meeting_frequency TEXT,
  location TEXT NOT NULL,
  contact TEXT NOT NULL,
  social_media TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  announcement TEXT,
  keywords JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create registration_collections table
CREATE TABLE IF NOT EXISTS registration_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  display BOOLEAN DEFAULT false,
  accepting BOOLEAN DEFAULT false,
  renewal_enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create club_registrations table
CREATE TABLE IF NOT EXISTS club_registrations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  club_name TEXT NOT NULL,
  advisor_name TEXT NOT NULL,
  statement_of_purpose TEXT NOT NULL,
  location TEXT NOT NULL,
  meeting_day TEXT NOT NULL,
  meeting_frequency TEXT NOT NULL,
  student_contact_name TEXT NOT NULL,
  student_contact_email TEXT NOT NULL,
  advisor_agreement_date TEXT NOT NULL,
  club_agreement_date TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  status TEXT NOT NULL,
  collection_id TEXT NOT NULL REFERENCES registration_collections(id),
  denial_reason TEXT,
  approved_at TEXT,
  social_media TEXT,
  category TEXT NOT NULL,
  notes TEXT,
  renewed_from_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clubs_active ON clubs(active);
CREATE INDEX IF NOT EXISTS idx_clubs_category ON clubs(category);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON club_registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_collection ON club_registrations(collection_id);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON club_registrations(email);
CREATE INDEX IF NOT EXISTS idx_collections_display ON registration_collections(display);
CREATE INDEX IF NOT EXISTS idx_collections_accepting ON registration_collections(accepting);
