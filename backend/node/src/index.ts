import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { seedFullDatabaseIfEmpty } from './utils/autoSeeder';
import publicRoutes from './routes/public';
import lawyerRoutes from './routes/lawyer';
import adminRoutes from './routes/admin';
import { errorHandler, notFoundHandler } from './middlewares/errorMiddleware';
import actRegistry from './services/actRegistry';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Global Middleware
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:4201',
    'http://localhost:4300',
    'https://legalconnect-501109.web.app',
    'https://legalconnect-501109.firebaseapp.com',
    'https://legalconnect-admin.web.app',
    'https://legalconnect-admin.firebaseapp.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(compression()); // Gzip/Brotli compression for all responses
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Response-time header for performance monitoring
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const oldWriteHead = res.writeHead;
  res.writeHead = function (this: any, ...args: any[]) {
    if (!this.headersSent) {
      const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
      this.setHeader('X-Response-Time', `${elapsed.toFixed(1)}ms`);
    }
    return oldWriteHead.apply(this, args as any);
  };
  next();
});

// Health check
app.get(['/api/health', '/api/legal/health'], (req, res) => {
  res.json({ status: 'healthy', service: 'Node.js Express API', timestamp: new Date().toISOString() });
});

// Role-Separated Router Gateway with Inter-Service Backwards Compatibility
app.use('/api/admin', adminRoutes);
app.use('/api/legal/admin', adminRoutes);
app.use('/api/legal/contact', adminRoutes);
app.use('/api/lawyers', lawyerRoutes);
app.use('/api/legal', publicRoutes);
app.use('/api', publicRoutes);

// Global Error & Unmatched Route Middleware (Industry Standard)
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
const startServer = () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Connect to database, seed, and initialize ActRegistry
    connectDB()
      .then(() => seedFullDatabaseIfEmpty())
      .then(() => actRegistry.initialize())
      .then(() => {
        console.log('✅ Database initialization, seeding, and ActRegistry loading completed.');
      })
      .catch((err) => {
        console.error('❌ Database initialization failed:', err);
      });
  });
};

startServer();