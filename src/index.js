import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import adminUserRoutes from './routes/admin/users.js';
import adminOrgRoutes from './routes/admin/organizations.js';
import adminDeviceRoutes from './routes/admin/devices.js';
import adminSiteRoutes from './routes/admin/sites.js';
import commonRoutes from './routes/common.js';
import reportRoutes from './routes/reports.js';
import clientRoutes from './routes/client.js';
import softwareRoutes from './routes/software.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'GCAM API Server', version: '1.0.0' });
});

// Auth routes
app.use('/web/auth', authRoutes);

// Admin routes
app.use('/web/admin/user_manage', adminUserRoutes);
app.use('/web/admin/organization', adminOrgRoutes);
app.use('/web/admin/device', adminDeviceRoutes);
app.use('/web/admin/site', adminSiteRoutes);

// Common routes
app.use('/gcam/common', commonRoutes);

// Report routes
app.use('/gcam/common/report', reportRoutes);

// Client routes
app.use('/web/client', clientRoutes);

// Software version routes
app.use('/gcam/common/device_software_version', softwareRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`GCAM API running on http://localhost:${PORT}`);
});
