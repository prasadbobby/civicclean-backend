import { Router } from 'express';
import pool from '../../db/pool.js';

const router = Router();

// ponytail: helper to parse devices string to array
function parseDevices(devices) {
  if (!devices || devices === 'ALL') return 'ALL';
  return devices.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
}

// GET /web/admin/user_manage/viewall
router.get('/viewall', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', o.id,
              'name', o.name,
              'org_role', uoa.org_role,
              'access', uoa.access,
              'devices', uoa.devices
            )
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'
        ) as organizations
      FROM users u
      LEFT JOIN user_organization_access uoa ON uoa.user_id = u.id
      LEFT JOIN organizations o ON o.id = uoa.organization_id
      GROUP BY u.id
      ORDER BY u.id
    `);

    const users = result.rows.map(u => ({
      ...u,
      organizations: u.role === 'SUPERADMIN' ? 'ALL' : u.organizations.map(org => ({
        ...org,
        devices: parseDevices(org.devices)
      }))
    }));

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /web/admin/user_manage/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT u.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', o.id,
              'name', o.name,
              'org_role', uoa.org_role,
              'access', uoa.access,
              'devices', uoa.devices
            )
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'
        ) as organizations
      FROM users u
      LEFT JOIN user_organization_access uoa ON uoa.user_id = u.id
      LEFT JOIN organizations o ON o.id = uoa.organization_id
      WHERE u.id = $1
      GROUP BY u.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      ...user,
      organizations: user.role === 'SUPERADMIN' ? 'ALL' : user.organizations.map(org => ({
        ...org,
        devices: parseDevices(org.devices)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /web/admin/user_manage/create
router.post('/create', async (req, res) => {
  try {
    const { username, password, fullname, mobile, role, organizations } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await pool.query(`
      INSERT INTO users (username, password, fullname, mobile, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [username, password, fullname, mobile, role || 'USER']);

    const user = result.rows[0];

    // Add organization access if provided
    if (organizations && Array.isArray(organizations)) {
      for (const org of organizations) {
        // ponytail: convert array to comma-separated string for storage
        const devicesStr = Array.isArray(org.devices) ? org.devices.join(',') : (org.devices || 'ALL');
        await pool.query(`
          INSERT INTO user_organization_access (user_id, organization_id, org_role, access, devices)
          VALUES ($1, $2, $3, $4, $5)
        `, [user.id, org.organization_id, org.org_role || 'ADMIN', org.access || 'ALL', devicesStr]);
      }
    }

    res.status(201).json({ success: true, user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /web/admin/user_manage/update/:id
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, fullname, mobile, role, organizations } = req.body;

    const result = await pool.query(`
      UPDATE users
      SET username = COALESCE($1, username),
          password = COALESCE($2, password),
          fullname = COALESCE($3, fullname),
          mobile = COALESCE($4, mobile),
          role = COALESCE($5, role),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [username, password, fullname, mobile, role, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update organization access if provided
    if (organizations && Array.isArray(organizations)) {
      await pool.query('DELETE FROM user_organization_access WHERE user_id = $1', [id]);
      for (const org of organizations) {
        const devicesStr = Array.isArray(org.devices) ? org.devices.join(',') : (org.devices || 'ALL');
        await pool.query(`
          INSERT INTO user_organization_access (user_id, organization_id, org_role, access, devices)
          VALUES ($1, $2, $3, $4, $5)
        `, [id, org.organization_id, org.org_role || 'ADMIN', org.access || 'ALL', devicesStr]);
      }
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /web/admin/user_manage/delete/:id
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
