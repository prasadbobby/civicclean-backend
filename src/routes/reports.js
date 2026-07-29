import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

// POST /gcam/common/report/garbage_logs/rawdata
router.post('/garbage_logs/rawdata', async (req, res) => {
  try {
    const { device_id, start_date, end_date, organization_id } = req.body;

    let query = `
      SELECT
        dl.id,
        dl.device_id,
        dl.imei,
        dl.garbage_log_time,
        dl.garbage_log,
        d.name as device_name,
        json_build_object('id', o.id, 'name', o.name) as organization,
        json_build_object('id', s.id, 'name', s.name) as site
      FROM device_logs dl
      JOIN devices d ON d.id = dl.device_id
      LEFT JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN sites s ON s.id = d.site_id
      WHERE dl.garbage_log IS NOT NULL
    `;
    const params = [];
    let paramIndex = 1;

    if (device_id) {
      query += ` AND dl.device_id = $${paramIndex++}`;
      params.push(device_id);
    }
    if (organization_id) {
      query += ` AND d.organization_id = $${paramIndex++}`;
      params.push(organization_id);
    }
    if (start_date) {
      query += ` AND dl.garbage_log_time >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND dl.garbage_log_time <= $${paramIndex++}`;
      params.push(end_date);
    }

    query += ' ORDER BY dl.garbage_log_time DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /gcam/common/report/motion_logs/rawdata
router.post('/motion_logs/rawdata', async (req, res) => {
  try {
    const { device_id, start_date, end_date, organization_id } = req.body;

    let query = `
      SELECT
        dl.id,
        dl.device_id,
        dl.imei,
        dl.motion_log_time,
        dl.motion_log,
        d.name as device_name,
        json_build_object('id', o.id, 'name', o.name) as organization,
        json_build_object('id', s.id, 'name', s.name) as site
      FROM device_logs dl
      JOIN devices d ON d.id = dl.device_id
      LEFT JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN sites s ON s.id = d.site_id
      WHERE dl.motion_log IS NOT NULL
    `;
    const params = [];
    let paramIndex = 1;

    if (device_id) {
      query += ` AND dl.device_id = $${paramIndex++}`;
      params.push(device_id);
    }
    if (organization_id) {
      query += ` AND d.organization_id = $${paramIndex++}`;
      params.push(organization_id);
    }
    if (start_date) {
      query += ` AND dl.motion_log_time >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND dl.motion_log_time <= $${paramIndex++}`;
      params.push(end_date);
    }

    query += ' ORDER BY dl.motion_log_time DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /gcam/common/report/anpr_logs/rawdata
router.post('/anpr_logs/rawdata', async (req, res) => {
  try {
    const { device_id, start_date, end_date, organization_id, plate_number } = req.body;

    let query = `
      SELECT
        dl.id,
        dl.device_id,
        dl.imei,
        dl.anpr_log_time,
        dl.anpr_log,
        d.name as device_name,
        json_build_object('id', o.id, 'name', o.name) as organization,
        json_build_object('id', s.id, 'name', s.name) as site
      FROM device_logs dl
      JOIN devices d ON d.id = dl.device_id
      LEFT JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN sites s ON s.id = d.site_id
      WHERE dl.anpr_log IS NOT NULL
    `;
    const params = [];
    let paramIndex = 1;

    if (device_id) {
      query += ` AND dl.device_id = $${paramIndex++}`;
      params.push(device_id);
    }
    if (organization_id) {
      query += ` AND d.organization_id = $${paramIndex++}`;
      params.push(organization_id);
    }
    if (start_date) {
      query += ` AND dl.anpr_log_time >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND dl.anpr_log_time <= $${paramIndex++}`;
      params.push(end_date);
    }
    if (plate_number) {
      query += ` AND dl.anpr_log->>'plate_number' ILIKE $${paramIndex++}`;
      params.push(`%${plate_number}%`);
    }

    query += ' ORDER BY dl.anpr_log_time DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /gcam/common/report/device_status_logs/rawdata
router.post('/device_status_logs/rawdata', async (req, res) => {
  try {
    const { device_id, start_date, end_date, organization_id } = req.body;

    let query = `
      SELECT
        dl.id,
        dl.device_id,
        dl.imei,
        dl.device_status_log_time,
        dl.device_status_log,
        d.name as device_name,
        json_build_object('id', o.id, 'name', o.name) as organization,
        json_build_object('id', s.id, 'name', s.name) as site
      FROM device_logs dl
      JOIN devices d ON d.id = dl.device_id
      LEFT JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN sites s ON s.id = d.site_id
      WHERE dl.device_status_log IS NOT NULL
    `;
    const params = [];
    let paramIndex = 1;

    if (device_id) {
      query += ` AND dl.device_id = $${paramIndex++}`;
      params.push(device_id);
    }
    if (organization_id) {
      query += ` AND d.organization_id = $${paramIndex++}`;
      params.push(organization_id);
    }
    if (start_date) {
      query += ` AND dl.device_status_log_time >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND dl.device_status_log_time <= $${paramIndex++}`;
      params.push(end_date);
    }

    query += ' ORDER BY dl.device_status_log_time DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /gcam/common/report/vehicle_detection_logs/rawdata
router.post('/vehicle_detection_logs/rawdata', async (req, res) => {
  try {
    const { device_id, start_date, end_date, organization_id } = req.body;

    let query = `
      SELECT
        dl.id,
        dl.device_id,
        dl.imei,
        dl.vehicle_detection_log_time,
        dl.vehicle_detection_log,
        d.name as device_name,
        json_build_object('id', o.id, 'name', o.name) as organization,
        json_build_object('id', s.id, 'name', s.name) as site
      FROM device_logs dl
      JOIN devices d ON d.id = dl.device_id
      LEFT JOIN organizations o ON o.id = d.organization_id
      LEFT JOIN sites s ON s.id = d.site_id
      WHERE dl.vehicle_detection_log IS NOT NULL
    `;
    const params = [];
    let paramIndex = 1;

    if (device_id) {
      query += ` AND dl.device_id = $${paramIndex++}`;
      params.push(device_id);
    }
    if (organization_id) {
      query += ` AND d.organization_id = $${paramIndex++}`;
      params.push(organization_id);
    }
    if (start_date) {
      query += ` AND dl.vehicle_detection_log_time >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND dl.vehicle_detection_log_time <= $${paramIndex++}`;
      params.push(end_date);
    }

    query += ' ORDER BY dl.vehicle_detection_log_time DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /gcam/common/report/update_log - Update any log type
router.post('/update_log', async (req, res) => {
  try {
    const { device_id, imei, log_type, log_data } = req.body;

    if (!log_type || !log_data) {
      return res.status(400).json({ error: 'log_type and log_data required' });
    }

    const validLogTypes = ['garbage_log', 'motion_log', 'anpr_log', 'device_status_log', 'vehicle_detection_log'];
    if (!validLogTypes.includes(log_type)) {
      return res.status(400).json({ error: `Invalid log_type. Must be one of: ${validLogTypes.join(', ')}` });
    }

    // Find device by id or imei
    let deviceQuery = 'SELECT id, imei FROM devices WHERE ';
    let deviceParam;
    if (device_id) {
      deviceQuery += 'id = $1';
      deviceParam = device_id;
    } else if (imei) {
      deviceQuery += 'imei = $1';
      deviceParam = imei;
    } else {
      return res.status(400).json({ error: 'device_id or imei required' });
    }

    const deviceResult = await pool.query(deviceQuery, [deviceParam]);
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = deviceResult.rows[0];
    const timeColumn = `${log_type}_time`;

    const result = await pool.query(`
      UPDATE device_logs
      SET ${log_type} = $1, ${timeColumn} = NOW()
      WHERE device_id = $2
      RETURNING *
    `, [log_data, device.id]);

    if (result.rows.length === 0) {
      // Create new log entry if doesn't exist
      const insertResult = await pool.query(`
        INSERT INTO device_logs (device_id, imei, ${log_type}, ${timeColumn})
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `, [device.id, device.imei, log_data]);
      return res.json({ success: true, log: insertResult.rows[0] });
    }

    res.json({ success: true, log: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /gcam/common/report/device_status_log/ohlc/:device_id
router.get('/device_status_log/ohlc/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;
    const isNumeric = /^\d+$/.test(device_id);

    // ponytail: single row per device in device_logs, return current status as OHLC placeholder
    const result = await pool.query(`
      SELECT
        dl.device_status_log_time as timestamp,
        dl.device_status_log->>'ram_percent' as ram_percent,
        dl.device_status_log->>'pi_temperature_c' as temperature,
        dl.device_status_log->>'battery_voltage' as battery_voltage,
        d.name as device_name,
        d.imei
      FROM device_logs dl
      JOIN devices d ON d.id = dl.device_id
      WHERE ${isNumeric ? 'dl.device_id = $1' : 'd.imei = $1'}
    `, [isNumeric ? parseInt(device_id) : device_id]);

    if (result.rows.length === 0) {
      return res.json({ ohlc: [], message: 'No status data available' });
    }

    // Return current snapshot as single point
    res.json({
      device: result.rows[0].device_name,
      imei: result.rows[0].imei,
      current: {
        timestamp: result.rows[0].timestamp,
        ram_percent: result.rows[0].ram_percent,
        temperature: result.rows[0].temperature,
        battery_voltage: result.rows[0].battery_voltage
      },
      ohlc: [] // ponytail: no historical data, add timeseries table if needed
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
