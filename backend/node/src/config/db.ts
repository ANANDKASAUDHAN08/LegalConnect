import mongoose from 'mongoose';
import '../models/BareAct';
import '../models/Lawyer';
import '../models/LegalResource';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/legalconnect_db';

  try {
    const hostLabel = uri.includes('@') ? uri.split('@').pop() : uri;
    console.log(`Connecting to MongoDB at: ${hostLabel}...`);
    
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    } as mongoose.ConnectOptions);

    console.log(`✅ MongoDB Connected successfully to host: ${conn.connection.host}`);

    // Explicitly sync/build model indexes to prevent text-search failures
    await conn.connection.model('BareAct').createIndexes().catch(() => { });
    await conn.connection.model('Section').createIndexes().catch(() => { });
    await conn.connection.model('Lawyer').createIndexes().catch(() => { });
    await conn.connection.model('LegalResource').createIndexes().catch(() => { });
    console.log('✅ MongoDB Indexes verified and synchronized.');
  } catch (error: any) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};