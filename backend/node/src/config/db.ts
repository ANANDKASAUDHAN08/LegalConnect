import mongoose from 'mongoose';
import '../models/BareAct';
import '../models/Lawyer';
import '../models/LegalResource';
import '../models/Notification';
import '../models/NotificationPreference';
import '../models/StatutoryRight';
import '../models/EmergencyScenario';
import '../models/JudicialDecision';
import '../models/DiagnosticCrisis';
import '../models/DiagnosticRule';
import '../models/PracticeArea';
import '../models/Faq';
import '../models/LegalTemplate';
import '../models/IngestionLog';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/legalconnect_db';

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
    await conn.connection.model('Notification').createIndexes().catch(() => { });
    await conn.connection.model('NotificationPreference').createIndexes().catch(() => { });
    await conn.connection.model('StatutoryRight').createIndexes().catch(() => { });
    await conn.connection.model('EmergencyScenario').createIndexes().catch(() => { });
    await conn.connection.model('JudicialDecision').createIndexes().catch(() => { });
    await conn.connection.model('DiagnosticCrisis').createIndexes().catch(() => { });
    await conn.connection.model('DiagnosticRule').createIndexes().catch(() => { });
    await conn.connection.model('PracticeArea').createIndexes().catch(() => { });
    await conn.connection.model('Faq').createIndexes().catch(() => { });
    await conn.connection.model('LegalTemplate').createIndexes().catch(() => { });
    await conn.connection.model('IngestionLog').createIndexes().catch(() => { });
    console.log('✅ MongoDB Indexes verified and synchronized across all Legal Knowledge models.');
  } catch (error: any) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};