import mongoose from 'mongoose';
import '../models/BareAct';
import '../models/Lawyer';
import '../models/LegalResource';

export const connectDB = async () => {
  const uris = [
    process.env.MONGODB_URI as string,
    'mongodb://localhost:27017/legalconnect_db',
    'mongodb://127.0.0.1:27017/legalconnect_db',
    'mongodb://root:rootpassword@localhost:27018/legalconnect_db?authSource=admin'
  ].filter(Boolean);

  let connected = false;

  for (const uri of uris) {
    try {
      console.log(`Connecting to MongoDB at: ${uri.split('@').pop() || uri}...`);
      const conn = await mongoose.connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 4000
      } as mongoose.ConnectOptions);

      console.log(`✅ MongoDB Connected successfully to host: ${conn.connection.host}`);
      connected = true;

      // Explicitly sync/build model indexes to prevent text-search failures
      await conn.connection.model('BareAct').createIndexes().catch(() => { });
      await conn.connection.model('Section').createIndexes().catch(() => { });
      await conn.connection.model('Lawyer').createIndexes().catch(() => { });
      await conn.connection.model('LegalResource').createIndexes().catch(() => { });
      console.log('✅ MongoDB Indexes verified and synchronized.');
      break;
    } catch (error: any) {
      console.warn(`⚠️ Connection attempt failed for ${uri.split('@').pop() || uri}: ${error.message}`);
    }
  }

  if (!connected) {
    console.error('❌ Error: Could not connect to any MongoDB instance.');
    process.exit(1);
  }
};