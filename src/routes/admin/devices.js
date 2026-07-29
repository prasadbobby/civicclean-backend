import { Router } from 'express';
import pool from '../../db/pool.js';

const router = Router();

// Helper to get device with latest log
async function getDeviceWithLog(deviceId) {
  const result = await pool.query(`
    SELECT
      d.*,
      json_build_object('id', s.id, 'name', s.name) as site,
      json_build_object('id', o.id, 'name', o.name) as organization,
      json_build_object(
        'id', dl.id,
        'device_id', dl.device_id,
        'garbage_log_time', dl.garbage_log_time,
        'garbage_log', dl.garbage_log,
        'motion_log_time', dl.motion_log_time,
        'motion_log', dl.motion_log,
        'anpr_log_time', dl.anpr_log_time,
        'anpr_log', dl.anpr_log,
        'device_status_log_time', dl.device_status_log_time,
        'device_status_log', dl.device_status_log,
        'vehicle_detection_log_time', dl.vehicle_detection_log_time,
        'vehicle_detection_log', dl.vehicle_detection_log,
        'created_at', dl.created_at
      ) as latestlog
    FROM devices d
    LEFT JOIN sites s ON s.id = d.site_id
    LEFT JOIN organizations o ON o.id = d.organization_id
    LEFT JOIN device_logs dl ON dl.device_id = d.id
    WHERE d.id = $1 AND d.is_deleted = false
  `, [deviceId]);

  return result.rows[0];
}

// GET /web/admin/device/all
router.get('/all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.*,
        json_build_object('id', s.id, 'name', s.name) as site,
        json_build_object('id', o.id, 'name', o.name) as organization,
        json_build_object(
          'id', dl.id,
          'device_id', dl.device_id,
          'garbage_log_time', dl.garbage_log_time,
          'garbage_log', dl.garbage_log,
          'motion_log_time', dl.motion_log_time,
          'motion_log', dl.motion_log,
          'anpr_log_time', dl.anpr_log_time,
          'anpr_log', dl.anpr_log,
          'device_status_log_time', dl.device_status_log_time,
          'device_status_log', dl.device_status_log,
          'vehicle_detection_log_time', dl.vehicle_detection_log_time,
          'vehicle_detection_log', dl.vehicle_detection_log,
          'created_at', dl.created_at
        ) as latestlog
      FROM devices d
      LEFT JOIN sites s ON s.id = d.site_id
      LEFT JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN device_logs dl ON dl.device_id = d.id
      WHERE d.is_deleted = false
      ORDER BY d.id
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /web/admin/device/register
router.post('/register', async (req, res) => {
  try {
    const { imei, name, location, video_url, site_id, organization_id, max_count } = req.body;

    if (!imei) {
      return res.status(400).json({ error: 'Device IMEI required' });
    }

    const result = await pool.query(`
      INSERT INTO devices (imei, name, location, video_url, site_id, organization_id, max_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [imei, name || imei, location, video_url, site_id, organization_id, max_count || 10]);

    const device = result.rows[0];

    // Create empty device_logs entry
    await pool.query(`
      INSERT INTO device_logs (device_id, imei)
      VALUES ($1, $2)
    `, [device.id, device.imei]);

    res.status(201).json({ success: true, device });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Device IMEI already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /web/admin/device/update/:id
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { imei, name, location, video_url, is_active, site_id, organization_id, max_count } = req.body;

    const result = await pool.query(`
      UPDATE devices
      SET imei = COALESCE($1, imei),
          name = COALESCE($2, name),
          location = COALESCE($3, location),
          video_url = COALESCE($4, video_url),
          is_active = COALESCE($5, is_active),
          site_id = COALESCE($6, site_id),
          organization_id = COALESCE($7, organization_id),
          max_count = COALESCE($8, max_count),
          updated_at = NOW()
      WHERE id = $9 AND is_deleted = false
      RETURNING *
    `, [imei, name, location, video_url, is_active, site_id, organization_id, max_count, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = await getDeviceWithLog(id);
    res.json({ success: true, device });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /web/admin/device/delete/:id (soft delete)
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE devices SET is_deleted = true, updated_at = NOW()
      WHERE id = $1 AND is_deleted = false
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ success: true, message: 'Device moved to trash' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /web/admin/device/trash/viewall
router.get('/trash/viewall', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*,
        json_build_object('id', s.id, 'name', s.name) as site,
        json_build_object('id', o.id, 'name', o.name) as organization
      FROM devices d
      LEFT JOIN sites s ON s.id = d.site_id
      LEFT JOIN organizations o ON o.id = d.organization_id
      WHERE d.is_deleted = true
      ORDER BY d.updated_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /web/admin/device/restore/:id
router.post('/restore/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE devices SET is_deleted = false, updated_at = NOW()
      WHERE id = $1 AND is_deleted = true
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found in trash' });
    }

    res.json({ success: true, message: 'Device restored', device: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /web/admin/device/permanent/delete/:id
router.delete('/permanent/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM devices WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ success: true, message: 'Device permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
