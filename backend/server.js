import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3010;
const JWT_SECRET = process.env.JWT_SECRET || 'monitoring-lahan-super-secret-key-12345';
const SYSTEM_PASSWORD = process.env.SYSTEM_PASSWORD || 'admin';

// Dynamic CORS Hardening: Only allow localhost and local LAN IPs on port 5173
const allowedOriginsPattern = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):5173$/;

app.use(cors({
  origin: (origin, callback) => {
    // Allow tools like curl, mobile apps, or same-origin requests (no origin header)
    if (!origin) return callback(null, true);
    
    if (allowedOriginsPattern.test(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin not allowed: ${origin}`);
      callback(null, false); // Block origin by returning false (doesn't send CORS headers)
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Login Endpoint with Password loaded from Environment Variables (.env)
app.post('/api/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required.' });
  }

  // Verify Password with value from .env
  if (password !== SYSTEM_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Password salah!' });
  }

  // Generate JWT Token
  const token = jwt.sign(
    { username: 'admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.json({
    success: true,
    message: 'Login successful.',
    token,
    username: 'admin'
  });
});

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', config: 'loaded' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Authentication server is running on port ${PORT}`);
  console.log(`System password loaded from env config.`);
});
