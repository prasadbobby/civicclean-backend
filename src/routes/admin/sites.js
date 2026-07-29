import { Router } from 'express';
import pool from '../../db/pool.js';

const router = Router();

// GET /web/admin/site/viewall
router.get('/viewall', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
        json_build_object('id', o.id, 'name', o.name) as organization,
        COUNT(d.id) as device_count
      FROM sites s
      LEFT JOIN organizations o ON o.id = s.organization_id
      LEFT JOIN devices d ON d.site_id = s.id AND d.is_deleted = false
      GROUP BY s.id, o.id
      ORDER BY s.id
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /web/admin/site/create
router.post('/create', async (req, res) => {
  try {
    const { name, location, organization_id, site_initiate_images } = req.body;

    if (!name || !organization_id) {
      return res.status(400).json({ error: 'Site name and organization_id required' });
    }

    const result = await pool.query(`
      INSERT INTO sites (name, location, organization_id, site_initiate_images)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, location, organization_id, site_initiate_images]);

    res.status(201).json({ success: true, site: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /web/admin/site/update/:id
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, organization_id, site_initiate_images } = req.body;

    const result = await pool.query(`
      UPDATE sites
      SET name = COALESCE($1, name),
          location = COALESCE($2, location),
          organization_id = COALESCE($3, organization_id),
          site_initiate_images = COALESCE($4, site_initiate_images),
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [name, location, organization_id, site_initiate_images, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({ success: true, site: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /web/admin/site/delete/:id
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM sites WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({ success: true, message: 'Site deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
