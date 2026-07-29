import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

// GET /gcam/common/list/organizations
router.get('/list/organizations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, logo_url, created_at
      FROM organizations
      ORDER BY name
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /gcam/common/list/organization/:id/sites
router.get('/list/organization/:id/sites', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT s.*, COUNT(d.id) as device_count
      FROM sites s
      LEFT JOIN devices d ON d.site_id = s.id AND d.is_deleted = false
      WHERE s.organization_id = $1
      GROUP BY s.id
      ORDER BY s.name
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /gcam/common/list/organization/inner_roles/:id
router.get('/list/organization/inner_roles/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT * FROM organization_roles
      WHERE organization_id = $1
      ORDER BY role_name
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /gcam/common/list/registered/devices
router.get('/list/registered/devices', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*,
        json_build_object('id', s.id, 'name', s.name) as site,
        json_build_object('id', o.id, 'name', o.name) as organization
      FROM devices d
      LEFT JOIN sites s ON s.id = d.site_id
      LEFT JOIN organizations o ON o.id = d.organization_id
      WHERE d.is_deleted = false AND d.organization_id IS NOT NULL
      ORDER BY d.name
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /gcam/common/list/not-registered/devices
router.get('/list/not-registered/devices', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM devices
      WHERE is_deleted = false AND organization_id IS NULL
      ORDER BY imei
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /gcam/common/list/owned/devices/for/user/:id
router.get('/list/owned/devices/for/user/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is superadmin
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    let result;
    if (user.role === 'SUPERADMIN') {
      result = await pool.query(`
        SELECT d.*,
          json_build_object('id', s.id, 'name', s.name) as site,
          json_build_object('id', o.id, 'name', o.name) as organization
        FROM devices d
        LEFT JOIN sites s ON s.id = d.site_id
        LEFT JOIN organizations o ON o.id = d.organization_id
        WHERE d.is_deleted = false
        ORDER BY d.name
      `);
    } else {
      result = await pool.query(`
        SELECT d.*,
          json_build_object('id', s.id, 'name', s.name) as site,
          json_build_object('id', o.id, 'name', o.name) as organization
        FROM devices d
        LEFT JOIN sites s ON s.id = d.site_id
        LEFT JOIN organizations o ON o.id = d.organization_id
        JOIN user_organization_access uoa ON uoa.organization_id = d.organization_id
        WHERE d.is_deleted = false AND uoa.user_id = $1
        ORDER BY d.name
      `, [id]);
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /gcam/common/devices-storage-logs
router.post('/devices-storage-logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id,
        d.imei,
        d.name,
        json_build_object('id', o.id, 'name', o.name) as organization,
        dl.device_status_log->'ftp_storage_mb' as storage_mb
      FROM devices d
      LEFT JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN device_logs dl ON dl.device_id = d.id
      WHERE d.is_deleted = false
      ORDER BY d.name
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /gcam/common/devices-storage-logs/by-device
router.post('/devices-storage-logs/by-device', async (req, res) => {
  try {
    const { device_id } = req.body;

    if (!device_id) {
      return res.status(400).json({ error: 'device_id required' });
    }

    const result = await pool.query(`
      SELECT
        d.id,
        d.imei,
        d.name,
        json_build_object('id', o.id, 'name', o.name) as organization,
        dl.device_status_log->'ftp_storage_mb' as storage_mb,
        dl.device_status_log
      FROM devices d
      LEFT JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN device_logs dl ON dl.device_id = d.id
      WHERE d.id = $1 AND d.is_deleted = false
    `, [device_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /gcam/common/ftp/get_device_size/:device_id
router.get('/ftp/get_device_size/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;

    const result = await pool.query(`
      SELECT dl.device_status_log->'ftp_storage_mb' as storage_mb
      FROM device_logs dl
      JOIN devices d ON d.id = dl.device_id
      WHERE d.imei = $1 OR d.id::text = $1
    `, [device_id]);

    if (result.rows.length === 0) {
      return res.json({ storage_mb: 0, message: 'Device not found or no storage data' });
    }

    res.json({ storage_mb: result.rows[0].storage_mb || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
