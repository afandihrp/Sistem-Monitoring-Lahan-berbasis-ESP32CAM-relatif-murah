import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3010;
const JWT_SECRET = process.env.JWT_SECRET || 'monitoring-lahan-super-secret-key-12345';

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

// Initialize Database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeDb();
  }
});

function initializeDb() {
  db.serialize(() => {
    // Create users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )
    `, (err) => {
      if (err) {
        console.error('Failed to create users table:', err.message);
        return;
      }
      
      // Check if admin user exists, if not create one
      db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
        if (err) {
          console.error('Error checking users:', err.message);
        } else if (!row) {
          // Default password is admin
          const hashedPassword = bcrypt.hashSync('admin', 10);
          db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword], (err) => {
            if (err) {
              console.error('Failed to create default admin user:', err.message);
            } else {
              console.log('Default admin user created successfully with default password: admin');
            }
          });
        }
      });
    });
  });
}

// Login Endpoint with Password
app.post('/api/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required.' });
  }

  // Look up the admin user
  const query = 'SELECT * FROM users WHERE username = ?';
  db.get(query, ['admin'], (err, user) => {
    if (err) {
      console.error('Database query error:', err.message);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'System password not configured.' });
    }

    // Verify Password using bcryptjs
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Password salah!' });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: user.id, username: 'admin' },
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
});

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'connected' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Authentication server is running on port ${PORT}`);
});
