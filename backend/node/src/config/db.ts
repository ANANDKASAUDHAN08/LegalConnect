import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI as string, {
      maxPoolSize: 10
    } as mongoose.ConnectOptions);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Explicitly sync/build model indexes to prevent text-search failures
    await conn.connection.model('BareAct').createIndexes();
    await conn.connection.model('Lawyer').createIndexes();
    await conn.connection.model('LegalResource').createIndexes();
    console.log('✅ MongoDB Indexes verified and synchronized.');
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
