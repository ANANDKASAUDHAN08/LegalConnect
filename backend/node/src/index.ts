import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { seedFullDatabaseIfEmpty } from './utils/autoSeeder';
import legalRoutes from './routes/legalRoutes';
import lawyerRoutes from './routes/lawyerRoutes';
import templateRoutes from './routes/templateRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:4300',
    'https://legalconnect-501109.web.app',
    'https://legalconnect-501109.firebaseapp.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Node.js API is running! 🚀' });
});
app.use('/api/legal', legalRoutes);
app.use('/api/legal', templateRoutes);
app.use('/api/lawyers', lawyerRoutes);

// Start Server
const startServer = () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Connect to database and run auto-seeder asynchronously in the background
    connectDB()
      .then(() => seedFullDatabaseIfEmpty())
      .then(() => {
        console.log('✅ Database initialization and seeding check completed.');
      })
      .catch((err) => {
        console.error('❌ Database initialization failed:', err);
      });
  });
};

startServer();