import { Router } from 'express';
import pool from '../../db/pool.js';

const router = Router();

// GET /web/admin/organization/viewall
router.get('/viewall', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.*,
        COUNT(DISTINCT d.id) FILTER (WHERE d.is_deleted = false) as total_devices,
        COUNT(DISTINCT d.id) FILTER (WHERE d.is_active = true AND d.is_deleted = false) as active_devices,
        COUNT(DISTINCT d.id) FILTER (WHERE d.is_active = false AND d.is_deleted = false) as inactive_devices,
        COUNT(DISTINCT s.id) as total_sites,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', s.id, 'name', s.name, 'location', s.location, 'photo_url', s.site_initiate_images[1])
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) as site_data,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', r.id, 'role_name', r.role_name, 'description', r.description)
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) as roles
      FROM organizations o
      LEFT JOIN devices d ON d.organization_id = o.id
      LEFT JOIN sites s ON s.organization_id = o.id
      LEFT JOIN organization_roles r ON r.organization_id = o.id
      GROUP BY o.id
      ORDER BY o.id
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /web/admin/organization/create
router.post('/create', async (req, res) => {
  try {
    const { name, logo_url, roles, sites } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Organization name required' });
    }

    const result = await pool.query(`
      INSERT INTO organizations (name, logo_url)
      VALUES ($1, $2)
      RETURNING *
    `, [name, logo_url]);

    const org = result.rows[0];

    // Add roles if provided
    if (roles && Array.isArray(roles)) {
      for (const role of roles) {
        if (role.role_name || role) {
          await pool.query(`
            INSERT INTO organization_roles (organization_id, role_name, description)
            VALUES ($1, $2, $3)
          `, [org.id, role.role_name || role, role.description || null]);
        }
      }
    }

    // Add sites if provided
    if (sites && Array.isArray(sites)) {
      for (const site of sites) {
        if (site.name) {
          // ponytail: convert "lat,lng" string to JSONB, photo_url to TEXT[]
          let locationJson = null;
          if (site.location && typeof site.location === 'string') {
            const [lat, lng] = site.location.split(',').map(s => parseFloat(s.trim()));
            if (!isNaN(lat) && !isNaN(lng)) locationJson = { lat, lng };
          }
          const images = site.photo_url ? [site.photo_url] : null;
          await pool.query(`
            INSERT INTO sites (organization_id, name, location, site_initiate_images)
            VALUES ($1, $2, $3, $4)
          `, [org.id, site.name, locationJson, images]);
        }
      }
    }

    res.status(201).json({ success: true, organization: org });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /web/admin/organization/update/:id
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logo_url, roles, sites } = req.body;

    const result = await pool.query(`
      UPDATE organizations
      SET name = COALESCE($1, name),
          logo_url = COALESCE($2, logo_url),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [name, logo_url, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // ponytail: replace roles if provided
    if (roles && Array.isArray(roles)) {
      await pool.query('DELETE FROM organization_roles WHERE organization_id = $1', [id]);
      for (const role of roles) {
        if (role.role_name) {
          await pool.query(`
            INSERT INTO organization_roles (organization_id, role_name, description)
            VALUES ($1, $2, $3)
          `, [id, role.role_name, role.description || null]);
        }
      }
    }

    // ponytail: replace sites if provided
    if (sites && Array.isArray(sites)) {
      await pool.query('DELETE FROM sites WHERE organization_id = $1', [id]);
      for (const site of sites) {
        if (site.name) {
          let locationJson = null;
          if (site.location && typeof site.location === 'string') {
            const [lat, lng] = site.location.split(',').map(s => parseFloat(s.trim()));
            if (!isNaN(lat) && !isNaN(lng)) locationJson = { lat, lng };
          }
          const images = site.photo_url ? [site.photo_url] : null;
          await pool.query(`
            INSERT INTO sites (organization_id, name, location, site_initiate_images)
            VALUES ($1, $2, $3, $4)
          `, [id, site.name, locationJson, images]);
        }
      }
    }

    res.json({ success: true, organization: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /web/admin/organization/delete/:id
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM organizations WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({ success: true, message: 'Organization deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
