-- Person detections table for storing AI detection events
CREATE TABLE IF NOT EXISTS person_detections (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id),
  imei VARCHAR(50),
  person_count INTEGER DEFAULT 1,
  image_file VARCHAR(255),
  video_file VARCHAR(255),
  bounding_boxes JSONB DEFAULT '[]',
  detected_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_person_detections_device ON person_detections(device_id);
CREATE INDEX IF NOT EXISTS idx_person_detections_date ON person_detections(detected_at);
CREATE INDEX IF NOT EXISTS idx_person_detections_device_date ON person_detections(device_id, DATE(detected_at));
