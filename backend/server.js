import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { db } from './db/database.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import Route Handlers
import authRoutes from './routes/authRoutes.js';
import equipmentRoutes from './routes/equipmentRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';
import verificationRoutes from './routes/verificationRoutes.js';
import troubleshootingRoutes from './routes/troubleshootingRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Initialize DB schema & tables
db.instance;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from specified origin, localhost dev ports, or no origin (curl/mobile/same-origin)
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin === config.frontendOrigin) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive for hackathon testing
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets directly for full standalone usability
const frontendPath = path.resolve(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/troubleshoot', troubleshootingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'FaultBeforeYou',
    timestamp: new Date().toISOString(),
    gemmaModel: config.gemmaModel,
    aiConfigured: Boolean(config.geminiApiKey && config.geminiApiKey !== 'your_api_key_here')
  });
});

// Single Page Application fallback to index.html for non-API GET routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(frontendPath, 'index.html'));
  }
  next();
});

// Centralized error handler
app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
  console.log(`\n🚀 FaultBeforeYou server running at http://localhost:${config.port}`);
  console.log(`📡 Gemma 4 Model configured: ${config.gemmaModel}`);
  console.log(`🔒 Gemini API Key status: ${config.geminiApiKey ? 'Configured (Active)' : 'Not Set (Manual/Fallback Mode)'}`);
  console.log(`💻 Serving frontend from: ${frontendPath}\n`);
});

// Handle graceful shutdown
function handleShutdown() {
  console.log('\nShutting down FaultBeforeYou server...');
  server.close(() => {
    db.close();
    console.log('Database connection closed. Goodbye!');
    process.exit(0);
  });
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

export default app;
