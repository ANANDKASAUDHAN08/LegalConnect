import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import legalRoutes from './routes/legalRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Node.js API is running! 🚀' });
});
app.use('/api/legal', legalRoutes);

// Start Server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
