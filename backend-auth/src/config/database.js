const sql = require('mssql');
const mongoose = require('mongoose');

// SQL Server Configuration
const sqlConfig = {
  server: process.env.SQL_HOST,
  port: parseInt(process.env.SQL_PORT),
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// SQL Server Connection Pool
let sqlPool = null;

const connectSQL = async () => {
  try {
    if (sqlPool) {
      return sqlPool;
    }

    console.log('🔌 Connecting to SQL Server...');
    sqlPool = await sql.connect(sqlConfig);
    console.log('✅ SQL Server connected successfully');

    return sqlPool;
  } catch (error) {
    console.error('❌ SQL Server connection failed:', error.message);
    throw error;
  }
};

const getSQLPool = () => {
  if (!sqlPool) {
    throw new Error('SQL Server not connected. Call connectSQL() first.');
  }
  return sqlPool;
};

const disconnectSQL = async () => {
  if (sqlPool) {
    await sqlPool.close();
    sqlPool = null;
    console.log('🔌 SQL Server disconnected');
  }
};

// MongoDB Connection
const connectMongoDB = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');

    await mongoose.connect(process.env.MONGODB_URI);

    console.log('✅ MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
};

const disconnectMongoDB = async () => {
  await mongoose.disconnect();
  console.log('🔌 MongoDB disconnected');
};

// Close all connections
const closeConnections = async () => {
  await disconnectSQL();
  await disconnectMongoDB();
};

module.exports = {
  connectSQL,
  getSQLPool,
  disconnectSQL,
  connectMongoDB,
  disconnectMongoDB,
  closeConnections,
  sql
};
