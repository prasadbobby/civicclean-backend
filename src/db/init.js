import pool from './pool.js';

const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    fullname VARCHAR(100),
    mobile VARCHAR(20),
    role VARCHAR(20) DEFAULT 'USER',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites table
CREATE TABLE IF NOT EXISTS sites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location JSONB,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    site_initiate_images TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100),
    location JSONB,
    video_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    max_count INTEGER DEFAULT 10,
    alert_zone JSONB,
    live_stream_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ponytail: add columns if not exist (for existing databases)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'alert_zone') THEN
    ALTER TABLE devices ADD COLUMN alert_zone JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'live_stream_url') THEN
    ALTER TABLE devices ADD COLUMN live_stream_url TEXT;
  END IF;
END $$;

-- Device logs table (latest log per device)
CREATE TABLE IF NOT EXISTS device_logs (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE UNIQUE,
    imei VARCHAR(50),
    garbage_log_time TIMESTAMPTZ,
    garbage_log JSONB,
    motion_log_time TIMESTAMPTZ,
    motion_log JSONB,
    anpr_log_time TIMESTAMPTZ,
    anpr_log JSONB,
    device_status_log_time TIMESTAMPTZ,
    device_status_log JSONB,
    vehicle_detection_log_time TIMESTAMPTZ,
    vehicle_detection_log JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Software versions table
CREATE TABLE IF NOT EXISTS software_versions (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User organization access table
CREATE TABLE IF NOT EXISTS user_organization_access (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    org_role VARCHAR(20) DEFAULT 'ADMIN',
    alert_settings_feature BOOLEAN DEFAULT true,
    inner_role_id INTEGER,
    access TEXT DEFAULT 'ALL',
    devices TEXT DEFAULT 'ALL',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

-- User wishlist table
CREATE TABLE IF NOT EXISTS user_wishlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

-- Organization roles table
CREATE TABLE IF NOT EXISTS organization_roles (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for scaling to 1M+ devices
CREATE INDEX IF NOT EXISTS idx_devices_imei ON devices(imei);
CREATE INDEX IF NOT EXISTS idx_devices_org ON devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_devices_site ON devices(site_id);
CREATE INDEX IF NOT EXISTS idx_device_logs_device ON device_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_sites_org ON sites(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_org_access ON user_organization_access(user_id, organization_id);

-- ponytail: additional indexes for large scale queries
CREATE INDEX IF NOT EXISTS idx_devices_org_active ON devices(organization_id, is_active) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_devices_active_status ON devices(is_active, is_deleted);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username_search ON users(lower(username));
CREATE INDEX IF NOT EXISTS idx_org_roles_org ON organization_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_orgs_name_search ON organizations(lower(name));
CREATE INDEX IF NOT EXISTS idx_user_org_user ON user_organization_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_org_org ON user_organization_access(organization_id);

-- ponytail: add unique constraint if not exists (for existing databases)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_organization_access_user_id_organization_id_key') THEN
    ALTER TABLE user_organization_access ADD CONSTRAINT user_organization_access_user_id_organization_id_key UNIQUE(user_id, organization_id);
  END IF;
END $$;
`;

async function init() {
  try {
    console.log('Initializing database schema...');
    await pool.query(schema);
    console.log('Schema created successfully');

    // Seed default superadmin
    const existingAdmin = await pool.query("SELECT id FROM users WHERE username = 'admin'");
    if (existingAdmin.rows.length === 0) {
      await pool.query(`
        INSERT INTO users (username, password, fullname, role)
        VALUES ('admin', 'admin123', 'System Admin', 'SUPERADMIN')
      `);
      console.log('Default admin user created (admin/admin123)');
    }

    console.log('Database initialization complete');
    process.exit(0);
  } catch (err) {
    console.error('Database init error:', err);
    process.exit(1);
  }
}

init();
