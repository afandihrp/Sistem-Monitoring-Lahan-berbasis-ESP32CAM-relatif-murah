const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../../config.json');
const DATA_DIR = path.join(__dirname, '../../../data');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Array chat ID yang akan menerima notifikasi
let registeredChatIds = [];

// Load existing config — backward compatible dengan format lama (single ID)
try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (Array.isArray(config.registeredChatIds)) {
      registeredChatIds = config.registeredChatIds;
    } else if (config.registeredChatId) {
      // Migrasi dari format lama ke array
      registeredChatIds = [config.registeredChatId];
    }
    console.log(`Loaded ${registeredChatIds.length} registered chat ID(s): ${registeredChatIds.join(', ')}`);
  }
} catch (err) {
  console.error('Failed to load config.json:', err);
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify({ registeredChatIds }, null, 2));
  } catch (err) {
    console.error('Failed to save config.json:', err);
  }
}

// --- Helper: Cari file gambar terbaru di folder /data ---
function getLatestImagePath() {
  try {
    if (!fs.existsSync(DATA_DIR)) return null;

    const files = fs.readdirSync(DATA_DIR)
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
      .map(f => ({
        name: f,
        fullPath: path.join(DATA_DIR, f),
        mtime: fs.statSync(path.join(DATA_DIR, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime); // terbaru lebih dulu

    return files.length > 0 ? files[0].fullPath : null;
  } catch (err) {
    console.error('Error reading /data directory:', err);
    return null;
  }
}

// --- /start ---
bot.start((ctx) => {
  const welcomeMessage = `
Welcome to Gateway_OS Bot! 🛡️
Your surveillance gateway is online and ready.

Available Commands:
/start - Show this welcome message
/register_this_id - Subscribe to motion alerts
/devices - List all connected camera devices
/capture - Trigger a new capture on cameras
/getimage - Retrieve the latest captured image
  `;
  ctx.reply(welcomeMessage);
});

// --- /register_this_id ---
bot.command('register_this_id', (ctx) => {
  const chatId = ctx.chat.id;
  if (registeredChatIds.includes(chatId)) {
    return ctx.reply(`ℹ️ ID Anda (${chatId}) sudah terdaftar dan aktif menerima notifikasi.`);
  }
  registeredChatIds.push(chatId);
  saveConfig();
  ctx.reply(`✅ Berhasil didaftarkan!\nID: ${chatId}\nTotal penerima: ${registeredChatIds.length} akun.`);
});

// --- /devices: Tampilkan semua kamera yang terdaftar ---
bot.command('devices', async (ctx) => {
  try {
    // Import getDevices secara lazy untuk menghindari circular dependency
    const { getDevices } = require('../websocket');
    const devices = getDevices();

    if (devices.size === 0) {
      return ctx.reply('📷 Tidak ada perangkat kamera yang terhubung saat ini.');
    }

    // Format setiap perangkat menjadi satu baris
    const lines = Array.from(devices.values()).map(device => {
      const statusEmoji = device.status === 'Online' ? '🟢' : '🔴';
      const signal = device.signalBars !== undefined ? ` | 📶 ${device.signalBars}/5` : '';
      return `${statusEmoji} *${device.name}*\n   Status: ${device.status}${signal}\n   IP: \`${device.ip}\`\n   Terakhir aktif: ${device.lastSeen}`;
    });

    const message = `📷 *Perangkat Terdaftar: ${devices.size}*\n\n${lines.join('\n\n')}`;
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Error in /devices command:', err);
    await ctx.reply('❌ Gagal mengambil daftar perangkat.');
  }
});

// Antrian pending capture: setiap entry = { resolve, timer }
// FIFO: pertama request = pertama dapat foto
const pendingCaptures = [];

// Dipanggil oleh routes.js setelah foto on-demand tersimpan ke disk
function notifyCaptureResult(filepath) {
  if (pendingCaptures.length > 0) {
    const { resolve, timer } = pendingCaptures.shift();
    clearTimeout(timer);
    resolve(filepath);
  } else {
    console.log('notifyCaptureResult: no pending capture to resolve');
  }
}

// Helper: daftarkan promise + timeout, kirim capture request ke kamera
async function requestCapture(ctx, deviceId) {
  const { sendCaptureRequest } = require('../websocket');
  const sent = sendCaptureRequest(deviceId);
  if (!sent) {
    return ctx.reply('❌ Kamera tidak tersedia atau sedang offline.');
  }

  const TIMEOUT_MS = 45000; // 45 detik: TLS handshake (~3s) + flush (~5s) + upload 1080p (~15s)

  try {
    const filepath = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Hapus dari antrian jika timeout
        const idx = pendingCaptures.findIndex(p => p.resolve === resolve);
        if (idx !== -1) pendingCaptures.splice(idx, 1);
        reject(new Error('timeout'));
      }, TIMEOUT_MS);
      pendingCaptures.push({ resolve, timer });
    });

    await ctx.replyWithPhoto(
      { source: filepath },
      { caption: `📸 *Capture On-Demand*\n🕐 ${new Date().toLocaleTimeString('id-ID')} (WIB)`, parse_mode: 'Markdown' }
    );
  } catch (err) {
    if (err.message === 'timeout') {
      await ctx.reply('⏱️ Timeout! Kamera tidak merespons dalam 20 detik.\nPastikan kamera terhubung dan coba lagi.');
    } else {
      throw err;
    }
  }
}

// --- /capture: On-demand capture dari Telegram ---
bot.command('capture', async (ctx) => {
  try {
    const { getDevices } = require('../websocket');
    const devices = getDevices();
    const onlineDevices = Array.from(devices.values()).filter(d => d.status === 'Online');

    if (onlineDevices.length === 0) {
      return ctx.reply('📷 Tidak ada kamera yang online saat ini.\nPastikan ESP32-CAM terhubung ke jaringan.');
    }

    if (onlineDevices.length === 1) {
      // Langsung request ke satu-satunya kamera
      await ctx.reply('📸 Mengirim perintah capture ke kamera... harap tunggu (~5-15 detik).');
      await requestCapture(ctx, onlineDevices[0].id);
    } else {
      // Tampilkan pilihan kamera via inline keyboard
      const { Markup } = require('telegraf');
      const buttons = onlineDevices.map(d =>
        [Markup.button.callback(`📷 ${d.name} (${d.ip})`, `cap:${d.id}`)]
      );
      await ctx.reply(
        `📷 *Pilih kamera untuk capture:*\n${onlineDevices.length} kamera online tersedia.`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
      );
    }
  } catch (err) {
    console.error('Error in /capture command:', err);
    await ctx.reply('❌ Gagal mengirim perintah capture.');
  }
});

// --- Handler tombol pilih kamera untuk /capture ---
bot.action(/^cap:(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery('📸 Mengirim perintah ke kamera...');
    const deviceId = ctx.match[1];
    await ctx.reply('📸 Mengirim perintah capture... harap tunggu (~5-15 detik).');
    await requestCapture(ctx, deviceId);
  } catch (err) {
    console.error('Error in capture callback:', err);
    await ctx.reply('❌ Gagal melakukan capture.');
  }
});


// --- /getimage DD MM YY: Filter log berdasarkan tanggal, tampilkan inline keyboard ---
bot.command('getimage', async (ctx) => {
  try {
    // Parse argumen: /getimage DD MM YY
    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    if (args.length !== 3) {
      return ctx.reply(
        '⚠️ Format salah.\n\nGunakan: /getimage DD MM YY\nContoh: /getimage 16 05 26'
      );
    }

    const [dd, mm, yy] = args.map(Number);
    if ([dd, mm, yy].some(isNaN) || dd < 1 || dd > 31 || mm < 1 || mm > 12) {
      return ctx.reply('❌ Tanggal tidak valid. Pastikan format: /getimage DD MM YY\nContoh: /getimage 16 05 26');
    }

    // Bangun tahun 4 digit (YY: 26 → 2026)
    const fullYear = yy + 2000;
    const dateLabel = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${fullYear}`;

    // Baca log.json
    const { getLogs } = require('./logger');
    const logs = getLogs();

    // Filter log berdasarkan tanggal (UTC) yang sesuai, dan hanya yang punya imageUrl
    const matched = logs.filter(entry => {
      if (!entry.imageUrl) return false;
      const d = new Date(entry.timestamp);
      return (
        d.getUTCDate()     === dd &&
        d.getUTCMonth() + 1 === mm &&
        d.getUTCFullYear() === fullYear
      );
    });

    if (matched.length === 0) {
      return ctx.reply(`📂 Tidak ada data gambar pada tanggal *${dateLabel}*.\n\nCek tanggal lain atau pastikan kamera sudah mengirim foto.`, { parse_mode: 'Markdown' });
    }

    // Batasi tampilan maksimal 10 tombol agar tidak terlalu panjang
    const MAX_BUTTONS = 10;
    const displayed = matched.slice(0, MAX_BUTTONS);
    const remaining = matched.length - MAX_BUTTONS;

    // Buat baris inline keyboard, 2 tombol per baris
    const { Markup } = require('telegraf');
    const buttons = displayed.map((entry, idx) => {
      const d = new Date(entry.timestamp);
      // Label tombol: waktu UTC + sensor
      const timeStr = d.toISOString().substr(11, 8); // HH:MM:SS
      const label = `${timeStr} · ${entry.sensor}`;
      // Ekstrak nama file dari imageUrl untuk callback_data (maks 64 byte)
      const filename = entry.imageUrl.split('/').pop();
      return Markup.button.callback(label, `gi:${filename}`);
    });

    // Susun tombol 2 per baris
    const keyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      keyboard.push(buttons.slice(i, i + 2));
    }

    let caption = `🗂️ *Data gambar pada ${dateLabel}*\nDitemukan *${matched.length}* event dengan foto.\n\nPilih event untuk melihat gambarnya:`;
    if (remaining > 0) {
      caption += `\n\n_(Menampilkan 10 terbaru. ${remaining} lainnya tidak ditampilkan)_`;
    }

    await ctx.reply(caption, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (err) {
    console.error('Error in /getimage command:', err);
    await ctx.reply('❌ Gagal memproses perintah. Coba lagi nanti.');
  }
});

// --- Handler callback inline keyboard /getimage ---
bot.action(/^gi:(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery(); // Hapus animasi loading pada tombol
    const filename = ctx.match[1];
    const filePath = path.join(DATA_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return ctx.reply(`❌ File tidak ditemukan di server: \`${filename}\``, { parse_mode: 'Markdown' });
    }

    // Ambil info waktu dari nama file: motion_IP_sensor_TIMESTAMP.jpg
    const parts = filename.replace('.jpg', '').split('_');
    const timestampMs = parseInt(parts[parts.length - 1]);
    const timeStr = isNaN(timestampMs)
      ? 'Tidak diketahui'
      : new Date(timestampMs).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    await ctx.replyWithPhoto(
      { source: filePath },
      {
        caption: `🖼️ *${filename}*\n🕐 ${timeStr} (WIB)`,
        parse_mode: 'Markdown'
      }
    );
  } catch (err) {
    console.error('Error in getimage callback:', err);
    await ctx.reply('❌ Gagal mengirim gambar. Coba lagi nanti.');
  }
});


// --- Inisialisasi bot ---
function initTelegramBot() {
  bot.launch().then(() => {
    console.log('Telegram bot started');
  }).catch((err) => {
    console.error('Failed to start Telegram bot:', err);
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// --- sendMotionAlert: Kirim peringatan teks + foto ke SEMUA registered chat ID ---
async function sendMotionAlert(location, sensor, imagePath = null) {
  console.log(`Attempting to send Telegram alert for ${location} (${sensor})...`);
  if (registeredChatIds.length === 0) {
    console.log('No chat IDs registered for Telegram alerts.');
    return;
  }

  const message = `🚨 *MOTION DETECTED!* \n\n📍 *Location:* ${location}\n🛡️ *Sensor:* ${sensor}\n⏰ *Time:* ${new Date().toLocaleTimeString()}`;
  const targetImage = imagePath || getLatestImagePath();

  // Kirim ke semua registered chat ID
  for (const chatId of registeredChatIds) {
    try {
      await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      if (targetImage) {
        await bot.telegram.sendPhoto(
          chatId,
          { source: fs.createReadStream(targetImage) },
          { caption: `📸 Foto dari sensor *${sensor}* — ${new Date().toLocaleTimeString('id-ID')}`, parse_mode: 'Markdown' }
        );
      }
      console.log(`Alert sent to chat ID: ${chatId}`);
    } catch (err) {
      console.error(`Failed to send alert to ${chatId}:`, err.message);
    }
  }
}

module.exports = { initTelegramBot, sendMotionAlert, notifyCaptureResult };

