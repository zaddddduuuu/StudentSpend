import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB, closeDB } from './server/db.js';
import { apiRouter } from './server/routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  // Middleware
  app.use(express.json({ limit: '10mb' }));

  // Connect to MongoDB (with graceful fallback if not yet configured)
  await connectDB();

  // Health check endpoint (for Render, Cloud Run, and container orchestrators)
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
    });
  });

  // API Routes
  app.use('/api', apiRouter);

  // Vite development or production static serving
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // When bundled into dist/server.js, distPath is __dirname.
    // When run directly from project root, distPath is path.resolve(__dirname, 'dist').
    const distPath = fs.existsSync(path.resolve(__dirname, 'index.html'))
      ? __dirname
      : path.resolve(__dirname, 'dist');

    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[StudentSpend Server] Running on http://0.0.0.0:${port} (Port: ${port})`);
    console.log(`[StudentSpend Server] Production Mode: ${isProd}`);
    console.log(`[StudentSpend Server] Backend API routes available at /api/*`);
  });

  // Graceful shutdown on Render redeploy or SIGTERM
  const handleShutdown = async (signal: string) => {
    console.log(`[StudentSpend Server] Received ${signal}. Gracefully shutting down...`);
    server.close(async () => {
      await closeDB();
      console.log('[StudentSpend Server] Closed HTTP server and database connections.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[StudentSpend Server] Failed to start:', err);
  process.exit(1);
});
