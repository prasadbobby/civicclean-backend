import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

// GET /web/admin/software/viewall
router.get('/viewall', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM software_versions
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /web/admin/software/latest
router.get('/latest', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM software_versions
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active software version found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /web/admin/software/create
router.post('/create', async (req, res) => {
  try {
    const { version, description, is_active } = req.body;

    if (!version) {
      return res.status(400).json({ error: 'Version required' });
    }

    // If new version is active, deactivate others
    if (is_active) {
      await pool.query('UPDATE software_versions SET is_active = false');
    }

    const result = await pool.query(`
      INSERT INTO software_versions (version, description, is_active)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [version, description, is_active || false]);

    res.status(201).json({ success: true, software: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Version already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /web/admin/software/update/:id
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { version, description, is_active } = req.body;

    // If setting as active, deactivate others
    if (is_active) {
      await pool.query('UPDATE software_versions SET is_active = false WHERE id != $1', [id]);
    }

    const result = await pool.query(`
      UPDATE software_versions
      SET version = COALESCE($1, version),
          description = COALESCE($2, description),
          is_active = COALESCE($3, is_active),
          updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [version, description, is_active, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Software version not found' });
    }

    res.json({ success: true, software: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /web/admin/software/delete/:id
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM software_versions WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Software version not found' });
    }

    res.json({ success: true, message: 'Software version deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /web/admin/software/activate/:id
router.post('/activate/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Deactivate all others
    await pool.query('UPDATE software_versions SET is_active = false');

    const result = await pool.query(`
      UPDATE software_versions SET is_active = true, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Software version not found' });
    }

    res.json({ success: true, software: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
