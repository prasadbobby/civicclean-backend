import { Router } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

const router = Router();

// POST /web/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Get user organizations
    let organizations = 'ALL';
    if (user.role !== 'SUPERADMIN') {
      const orgAccess = await pool.query(`
        SELECT o.*, uoa.org_role, uoa.access, uoa.devices
        FROM user_organization_access uoa
        JOIN organizations o ON o.id = uoa.organization_id
        WHERE uoa.user_id = $1
      `, [user.id]);
      organizations = orgAccess.rows;
    }

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        mobile: user.mobile,
        role: user.role,
        organizations
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /web/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /web/auth/user_info
router.get('/user_info', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    let organizations = 'ALL';
    if (user.role !== 'SUPERADMIN') {
      const orgAccess = await pool.query(`
        SELECT o.*, uoa.org_role, uoa.access, uoa.devices
        FROM user_organization_access uoa
        JOIN organizations o ON o.id = uoa.organization_id
        WHERE uoa.user_id = $1
      `, [user.id]);
      organizations = orgAccess.rows;
    }

    res.json({
      id: user.id,
      username: user.username,
      fullname: user.fullname,
      mobile: user.mobile,
      role: user.role,
      organizations
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
