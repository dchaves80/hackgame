require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { connectSQL, connectMongoDB, closeConnections } = require('./config/database');
const socketService = require('./services/socketService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize socket service
socketService.init(io);

// Socket.io JWT authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 User ${socket.username} connected (socket: ${socket.id})`);

  // Join computer room
  socket.on('join-computer', (computerId) => {
    socket.join(`computer:${computerId}`);
    console.log(`   └─ ${socket.username} joined room computer:${computerId}`);
  });

  // Leave computer room
  socket.on('leave-computer', (computerId) => {
    socket.leave(`computer:${computerId}`);
    console.log(`   └─ ${socket.username} left room computer:${computerId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User ${socket.username} disconnected`);
  });
});

// Middleware
app.use(cors({
  origin: '*',  // Acepta cualquier origen (solo para desarrollo)
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'backend-auth',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api/filesystem', require('./routes/filesystem'));
app.use('/api/terminal', require('./routes/terminal'));
app.use('/api/compiler', require('./routes/compiler'));
app.use('/api/processes', require('./routes/process'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  try {
    // Connect to both databases
    await connectSQL();
    await connectMongoDB();

    // Start HTTP server (Express + Socket.io)
    server.listen(PORT, () => {
      console.log(`🚀 Backend-Auth running on port ${PORT}`);
      console.log(`🔌 Socket.io ready`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await closeConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await closeConnections();
  process.exit(0);
});

startServer();
