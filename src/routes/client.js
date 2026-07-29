import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

// GET /gcam/client/wishlist/:user_id
router.get('/wishlist/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(`
      SELECT
        uw.*,
        json_build_object(
          'id', d.id,
          'imei', d.imei,
          'name', d.name,
          'location', d.location,
          'is_active', d.is_active
        ) as device,
        json_build_object('id', o.id, 'name', o.name) as organization,
        json_build_object('id', s.id, 'name', s.name) as site
      FROM user_wishlists uw
      JOIN devices d ON d.id = uw.device_id
      LEFT JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN sites s ON s.id = d.site_id
      WHERE uw.user_id = $1
      ORDER BY uw.created_at DESC
    `, [user_id]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /gcam/client/wishlist/add
router.post('/wishlist/add', async (req, res) => {
  try {
    const { user_id, device_id } = req.body;

    if (!user_id || !device_id) {
      return res.status(400).json({ error: 'user_id and device_id required' });
    }

    // Check if already in wishlist
    const existing = await pool.query(
      'SELECT id FROM user_wishlists WHERE user_id = $1 AND device_id = $2',
      [user_id, device_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Device already in wishlist' });
    }

    const result = await pool.query(`
      INSERT INTO user_wishlists (user_id, device_id)
      VALUES ($1, $2)
      RETURNING *
    `, [user_id, device_id]);

    res.status(201).json({ success: true, wishlist: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /gcam/client/wishlist/remove
router.delete('/wishlist/remove', async (req, res) => {
  try {
    const { user_id, device_id } = req.body;

    if (!user_id || !device_id) {
      return res.status(400).json({ error: 'user_id and device_id required' });
    }

    const result = await pool.query(
      'DELETE FROM user_wishlists WHERE user_id = $1 AND device_id = $2 RETURNING *',
      [user_id, device_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /gcam/client/device/:id
router.get('/device/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        d.*,
        json_build_object('id', s.id, 'name', s.name) as site,
        json_build_object('id', o.id, 'name', o.name) as organization,
        json_build_object(
          'id', dl.id,
          'garbage_log_time', dl.garbage_log_time,
          'garbage_log', dl.garbage_log,
          'motion_log_time', dl.motion_log_time,
          'motion_log', dl.motion_log,
          'anpr_log_time', dl.anpr_log_time,
          'anpr_log', dl.anpr_log,
          'device_status_log_time', dl.device_status_log_time,
          'device_status_log', dl.device_status_log,
          'vehicle_detection_log_time', dl.vehicle_detection_log_time,
          'vehicle_detection_log', dl.vehicle_detection_log
        ) as latestlog
      FROM devices d
      LEFT JOIN sites s ON s.id = d.site_id
      LEFT JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN device_logs dl ON dl.device_id = d.id
      WHERE d.id = $1 AND d.is_deleted = false
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /gcam/client/device/by-imei/:imei
router.get('/device/by-imei/:imei', async (req, res) => {
  try {
    const { imei } = req.params;

    const result = await pool.query(`
      SELECT
        d.*,
        json_build_object('id', s.id, 'name', s.name) as site,
        json_build_object('id', o.id, 'name', o.name) as organization,
        json_build_object(
          'id', dl.id,
          'garbage_log_time', dl.garbage_log_time,
          'garbage_log', dl.garbage_log,
          'motion_log_time', dl.motion_log_time,
          'motion_log', dl.motion_log,
          'anpr_log_time', dl.anpr_log_time,
          'anpr_log', dl.anpr_log,
          'device_status_log_time', dl.device_status_log_time,
          'device_status_log', dl.device_status_log,
          'vehicle_detection_log_time', dl.vehicle_detection_log_time,
          'vehicle_detection_log', dl.vehicle_detection_log
        ) as latestlog
      FROM devices d
      LEFT JOIN sites s ON s.id = d.site_id
      LEFT JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN device_logs dl ON dl.device_id = d.id
      WHERE d.imei = $1 AND d.is_deleted = false
    `, [imei]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /gcam/client/user/:id/organizations
router.get('/user/:id/organizations', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if superadmin
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let result;
    if (userResult.rows[0].role === 'SUPERADMIN') {
      result = await pool.query(`
        SELECT o.*, COUNT(DISTINCT d.id) as device_count, COUNT(DISTINCT s.id) as site_count
        FROM organizations o
        LEFT JOIN devices d ON d.organization_id = o.id AND d.is_deleted = false
        LEFT JOIN sites s ON s.organization_id = o.id
        GROUP BY o.id
        ORDER BY o.name
      `);
    } else {
      result = await pool.query(`
        SELECT o.*, COUNT(DISTINCT d.id) as device_count, COUNT(DISTINCT s.id) as site_count
        FROM organizations o
        JOIN user_organization_access uoa ON uoa.organization_id = o.id
        LEFT JOIN devices d ON d.organization_id = o.id AND d.is_deleted = false
        LEFT JOIN sites s ON s.organization_id = o.id
        WHERE uoa.user_id = $1
        GROUP BY o.id
        ORDER BY o.name
      `, [id]);
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /web/client/device/viewall/:user_id - List user's devices (per docs)
router.get('/device/viewall/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let result;
    if (userResult.rows[0].role === 'SUPERADMIN') {
      result = await pool.query(`
        SELECT d.*,
          json_build_object('id', s.id, 'name', s.name) as site,
          json_build_object('id', o.id, 'name', o.name) as organization,
          json_build_object(
            'id', dl.id,
            'garbage_log_time', dl.garbage_log_time,
            'garbage_log', dl.garbage_log,
            'motion_log_time', dl.motion_log_time,
            'motion_log', dl.motion_log,
            'device_status_log_time', dl.device_status_log_time,
            'device_status_log', dl.device_status_log
          ) as latestlog
        FROM devices d
        LEFT JOIN sites s ON s.id = d.site_id
        LEFT JOIN organizations o ON o.id = d.organization_id
        LEFT JOIN device_logs dl ON dl.device_id = d.id
        WHERE d.is_deleted = false
        ORDER BY d.name
      `);
    } else {
      result = await pool.query(`
        SELECT d.*,
          json_build_object('id', s.id, 'name', s.name) as site,
          json_build_object('id', o.id, 'name', o.name) as organization,
          json_build_object(
            'id', dl.id,
            'garbage_log_time', dl.garbage_log_time,
            'garbage_log', dl.garbage_log,
            'motion_log_time', dl.motion_log_time,
            'motion_log', dl.motion_log,
            'device_status_log_time', dl.device_status_log_time,
            'device_status_log', dl.device_status_log
          ) as latestlog
        FROM devices d
        LEFT JOIN sites s ON s.id = d.site_id
        LEFT JOIN organizations o ON o.id = d.organization_id
        LEFT JOIN device_logs dl ON dl.device_id = d.id
        JOIN user_organization_access uoa ON uoa.organization_id = d.organization_id
        WHERE d.is_deleted = false AND uoa.user_id = $1
        ORDER BY d.name
      `, [user_id]);
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /web/client/device/location/details/:device_id
router.get('/device/location/details/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;

    const result = await pool.query(`
      SELECT
        d.id,
        d.imei,
        d.name,
        d.location,
        d.video_url,
        d.is_active,
        json_build_object('id', s.id, 'name', s.name, 'location', s.location) as site,
        json_build_object('id', o.id, 'name', o.name) as organization
      FROM devices d
      LEFT JOIN sites s ON s.id = d.site_id
      LEFT JOIN organizations o ON o.id = d.organization_id
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

// POST /web/client/wishlist/add_device_to_wishlist (per docs)
router.post('/wishlist/add_device_to_wishlist', async (req, res) => {
  try {
    const { user_id, device_id } = req.body;

    if (!user_id || !device_id) {
      return res.status(400).json({ error: 'user_id and device_id required' });
    }

    const existing = await pool.query(
      'SELECT id FROM user_wishlists WHERE user_id = $1 AND device_id = $2',
      [user_id, device_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Device already in wishlist' });
    }

    const result = await pool.query(`
      INSERT INTO user_wishlists (user_id, device_id)
      VALUES ($1, $2)
      RETURNING *
    `, [user_id, device_id]);

    res.status(201).json({ success: true, wishlist: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /web/client/wishlist/remove_device_from_wishlist (per docs)
router.post('/wishlist/remove_device_from_wishlist', async (req, res) => {
  try {
    const { user_id, device_id } = req.body;

    if (!user_id || !device_id) {
      return res.status(400).json({ error: 'user_id and device_id required' });
    }

    const result = await pool.query(
      'DELETE FROM user_wishlists WHERE user_id = $1 AND device_id = $2 RETURNING *',
      [user_id, device_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
