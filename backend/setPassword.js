import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const newPassword = process.argv[2];

if (!newPassword) {
  console.log('Penggunaan: node setPassword.js <password_baru>');
  console.log('Contoh: node setPassword.js rahasia123');
  process.exit(1);
}

const hashedPassword = bcrypt.hashSync(newPassword, 10);

db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
  if (err) {
    console.error('Error saat membaca database:', err.message);
    db.close();
    return;
  }

  if (row) {
    db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, 'admin'], (err) => {
      if (err) {
        console.error('Gagal memperbarui password:', err.message);
      } else {
        console.log(`Password admin berhasil diperbarui!`);
      }
      db.close();
    });
  } else {
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword], (err) => {
      if (err) {
        console.error('Gagal menyimpan password:', err.message);
      } else {
        console.log(`Password admin baru berhasil disimpan!`);
      }
      db.close();
    });
  }
});
