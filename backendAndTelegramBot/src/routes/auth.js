const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'monitoring-lahan-super-secret-key-12345';
const SYSTEM_PASSWORD = process.env.SYSTEM_PASSWORD || 'admin';

function handleLogin(req, res) {
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
}

module.exports = handleLogin;
