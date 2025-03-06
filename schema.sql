CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  website TEXT NOT NULL,
  email TEXT,
  theme VARCHAR(50) NOT NULL,
  business_type VARCHAR(50) NOT NULL,
  status TEXT NOT NULL,
  demo_urls JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 