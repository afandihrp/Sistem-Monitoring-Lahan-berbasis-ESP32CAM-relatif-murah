const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const https = require('https');

const configPath = path.join(__dirname, '../../../data/config.json');
const DATA_DIR = path.join(__dirname, '../../../data');

// Force IPv4 untuk menghindari masalah 'socket hang up' karena routing IPv6 yang rusak (sering terjadi di ISP tertentu)
const agent = new https.Agent({ family: 4 });
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  telegram: { agent }
});

// Array chat ID yang akan menerima notifikasi
let registeredChatIds = [];
const activePhotoUploads = new Map(); // Untuk menahan upload video sampai foto terkirim

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

// --- Middleware: Authentication ---
bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return next();

  // Jika sudah terdaftar, izinkan semua perintah
  if (registeredChatIds.includes(chatId)) {
    return next();
  }

  // Jika belum terdaftar, cek apakah pesan adalah password
  const text = ctx.message?.text;
  const authPassword = process.env.TELEGRAM_AUTH_PASSWORD;

  if (authPassword && text === authPassword) {
    registeredChatIds.push(chatId);
    saveConfig();
    await ctx.reply(`✅ Autentikasi Berhasil! \nID Anda (${chatId}) telah didaftarkan. Anda sekarang akan menerima notifikasi motion alerts.`);
    return;
  }

  // Jika bukan password dan belum terdaftar, minta password
  return ctx.reply('🔐 *Akses Terbatas*\n\nBot ini bersifat privat. Silakan masukkan password registrasi untuk melanjutkan.', { parse_mode: 'Markdown' });
});

// --- Helper: Cari file gambar terbaru di folder /data ---
function getLatestImageFilename() {
  try {
    const photosDir = path.join(DATA_DIR, 'photos');
    if (!fs.existsSync(photosDir)) return null;

    const files = fs.readdirSync(photosDir)
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(photosDir, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime); // terbaru lebih dulu

    return files.length > 0 ? files[0].name : null;
  } catch (err) {
    console.error('Error reading /data/photos directory:', err);
    return null;
  }
}

// --- /start ---
bot.start((ctx) => {
  const welcomeMessage = `
Welcome to Gateway_OS Bot! 🛡️
Your surveillance gateway is online and ready.

Available Commands:
/start - Tampilkan pesan sambutan ini
/register <password> - Mendaftarkan ID Anda agar menerima notifikasi
/listids - Lihat daftar ID yang sudah terdaftar
/deleteid <id> - Hapus ID dari daftar penerima notifikasi
/devices - Lihat daftar kamera ESP32 yang terhubung
/capture - Minta kamera mengambil foto secara manual saat ini juga
/flash <0-255> - Atur kecerahan lampu sorot/flash (0 mati, 255 maksimal)
/getimage DD MM YY - Ambil foto histori berdasarkan tanggal
  `;
  ctx.reply(welcomeMessage);
});

// --- /listids: List all registered chat IDs ---
bot.command('listids', (ctx) => {
  const chatId = ctx.chat.id;
  // Security check: only registered users can list IDs
  if (!registeredChatIds.includes(chatId)) {
    return ctx.reply('❌ Anda tidak memiliki izin untuk melihat daftar ID. Silakan daftar terlebih dahulu dengan /register_this_id');
  }

  if (registeredChatIds.length === 0) {
    return ctx.reply('ℹ️ Belum ada ID yang terdaftar.');
  }

  const list = registeredChatIds.map((id, index) => `${index + 1}. \`${id}\``).join('\n');
  ctx.reply(`📋 *Daftar ID Terdaftar:* \n\n${list}`, { parse_mode: 'Markdown' });
});

// --- /deleteid <id>: Remove a chat ID ---
bot.command('deleteid', (ctx) => {
  const chatId = ctx.chat.id;
  // Security check: only registered users can delete IDs
  if (!registeredChatIds.includes(chatId)) {
    return ctx.reply('❌ Anda tidak memiliki izin untuk menghapus ID.');
  }

  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('⚠️ Gunakan format: /deleteid <chat_id>');
  }

  const targetId = parseInt(args[1]);
  const index = registeredChatIds.indexOf(targetId);

  if (index === -1) {
    return ctx.reply(`❌ ID \`${targetId}\` tidak ditemukan dalam daftar.`, { parse_mode: 'Markdown' });
  }

  registeredChatIds.splice(index, 1);
  saveConfig();
  ctx.reply(`✅ ID \`${targetId}\` berhasil dihapus.\nTotal penerima sekarang: ${registeredChatIds.length} akun.`, { parse_mode: 'Markdown' });
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
      return `${statusEmoji} *${device.ip}*\n   Status: ${device.status}${signal}\n   Terakhir aktif: ${device.lastSeen}`;
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
function notifyCaptureResult(filename) {
  if (pendingCaptures.length > 0) {
    const { resolve, timer } = pendingCaptures.shift();
    clearTimeout(timer);
    resolve(filename);
  } else {
    console.log('notifyCaptureResult: no pending capture to resolve');
  }
}

// Helper: daftarkan promise + timeout, kirim capture request ke kamera
async function requestCapture(ctx, deviceId, requestId = 'default', waitingMsgId = null) {
  const { sendCaptureRequest } = require('../websocket');
  const sent = sendCaptureRequest(deviceId);
  if (!sent) {
    if (waitingMsgId) await ctx.telegram.editMessageText(ctx.chat.id, waitingMsgId, undefined, '❌ Kamera tidak tersedia atau sedang offline.').catch(()=>{});
    return;
  }

  const TIMEOUT_MS = 45000; // 45 detik

  try {
    const filename = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = pendingCaptures.findIndex(p => p.resolve === resolve);
        if (idx !== -1) pendingCaptures.splice(idx, 1);
        reject(new Error('timeout'));
      }, TIMEOUT_MS);
      pendingCaptures.push({ resolve, reject, timer, id: requestId });
    });

    if (waitingMsgId) await ctx.telegram.editMessageText(ctx.chat.id, waitingMsgId, undefined, '✅ Capture berhasil. Mengirim foto...').catch(()=>{});

    const filePath = path.join(DATA_DIR, 'photos', filename);
    // Gunakan CURL alih-alih ctx.replyWithPhoto untuk menghindari bug socket hang up Telegraf di Node 26
    const caption = `📸 *Capture On-Demand*\n🕐 ${new Date().toLocaleTimeString('id-ID')} (WIB)`;
    const safeCaption = caption.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = ctx.chat.id;
    const cmd = `curl -s -X POST "https://api.telegram.org/bot${token}/sendPhoto" -F chat_id="${chatId}" -F photo="@${filePath}" -F caption="${safeCaption}" -F parse_mode="Markdown"`;
    
    await new Promise((resolve, reject) => {
      require('child_process').exec(cmd, (error, stdout) => {
        if (error) return reject(error);
        try {
          const res = JSON.parse(stdout);
          if (!res.ok) return reject(new Error(res.description));
          resolve(res);
        } catch(e) { reject(new Error("CURL error")); }
      });
    });
  } catch (err) {
    if (err.message === 'timeout') {
      await ctx.reply('⏱️ Timeout! Kamera tidak merespons dalam 45 detik.\nPastikan kamera terhubung dan coba lagi.');
    } else if (err.message === 'cancelled') {
      // Jika dibatalkan user, tidak perlu throw
    } else {
      await ctx.reply(`❌ Gagal mengirim gambar: ${err.message}`);
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
      const { Markup } = require('telegraf');
      const reqId = Date.now().toString();
      const waitingMsg = await ctx.reply('📸 Mengirim perintah capture ke kamera... harap tunggu (~5-15 detik).', {
        ...Markup.inlineKeyboard([Markup.button.callback('❌ Batalkan', `cancel_cap:${reqId}`)])
      });
      await requestCapture(ctx, onlineDevices[0].id, reqId, waitingMsg.message_id);
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
    const { Markup } = require('telegraf');
    const reqId = Date.now().toString();
    const waitingMsg = await ctx.reply('📸 Mengirim perintah capture... harap tunggu (~5-15 detik).', {
      ...Markup.inlineKeyboard([Markup.button.callback('❌ Batalkan', `cancel_cap:${reqId}`)])
    });
    
    // Hapus tombol list kamera sebelumnya
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    
    await requestCapture(ctx, deviceId, reqId, waitingMsg.message_id);
  } catch (err) {
    console.error('Error in capture callback:', err);
    await ctx.reply('❌ Gagal melakukan capture.');
  }
});

// --- Handler tombol Batal untuk /capture ---
bot.action(/^cancel_cap:(.+)$/, async (ctx) => {
  try {
    const reqId = ctx.match[1];
    const idx = pendingCaptures.findIndex(p => p.id === reqId);
    
    if (idx !== -1) {
      const { reject, timer } = pendingCaptures[idx];
      clearTimeout(timer);
      pendingCaptures.splice(idx, 1);
      reject(new Error('cancelled'));
      
      await ctx.editMessageText('❌ Capture dibatalkan oleh user.').catch(() => {});
      await ctx.answerCbQuery('Dibatalkan');
    } else {
      await ctx.answerCbQuery('Proses sudah selesai atau kadaluarsa', { show_alert: true });
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    }
  } catch (err) {
    console.error('Error cancelling capture:', err);
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

    // Bangun tahun 4 digit (YY: 26 → 2026, 2026 → 2026)
    const fullYear = yy < 100 ? yy + 2000 : yy;
    const dateLabel = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${fullYear}`;

    // Baca log.json
    const { getLogs } = require('./logger');
    const logs = getLogs();

    // Filter log berdasarkan tanggal (GMT+7/WIB), dan hanya yang punya imageUrl
    const matched = logs.filter(entry => {
      if (!entry.imageUrl) return false;
      // Konversi timestamp UTC ke waktu lokal WIB (GMT+7)
      const d = new Date(entry.timestamp);
      // Tambahkan 7 jam (dalam milidetik) ke waktu UTC
      const localTimeMs = d.getTime() + (7 * 60 * 60 * 1000);
      const localDate = new Date(localTimeMs);
      
      return (
        localDate.getUTCDate()     === dd &&
        localDate.getUTCMonth() + 1 === mm &&
        localDate.getUTCFullYear() === fullYear
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
      // Label tombol: waktu WIB (GMT+7) + sensor
      const timeStr = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' }); // HH:MM:SS
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
    const filePath = path.join(DATA_DIR, 'photos', filename);

    if (!fs.existsSync(filePath)) {
      return ctx.reply(`❌ File tidak ditemukan di server: \`${filename}\``, { parse_mode: 'Markdown' });
    }

    // Ambil info waktu dari nama file: motion_IP_sensor_TIMESTAMP.jpg
    const parts = filename.replace('.jpg', '').split('_');
    const timestampMs = parseInt(parts[parts.length - 1]);
    const timeStr = isNaN(timestampMs)
      ? 'Tidak diketahui'
      : new Date(timestampMs).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    const caption = `🖼️ *${filename}*\n🕐 ${timeStr} (WIB)`;
    const safeCaption = caption.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = ctx.chat.id;
    const cmd = `curl -s -X POST "https://api.telegram.org/bot${token}/sendPhoto" -F chat_id="${chatId}" -F photo="@${filePath}" -F caption="${safeCaption}" -F parse_mode="Markdown"`;
    
    await new Promise((resolve, reject) => {
      require('child_process').exec(cmd, (error, stdout) => {
        if (error) return reject(error);
        resolve();
      });
    });
  } catch (err) {
    console.error('Error in getimage callback:', err);
    await ctx.reply('❌ Gagal mengirim gambar. Coba lagi nanti.');
  }
});

// Command untuk mengatur intensitas flash kamera secara manual (0-255)
bot.command('flash', async (ctx) => {
  const chatId = ctx.chat.id;
  if (!registeredChatIds.includes(chatId)) {
    return ctx.reply('❌ Anda tidak terdaftar. Gunakan /register <password>');
  }

  const message = ctx.message.text.trim();
  const parts = message.split(' ');
  
  if (parts.length < 2) {
    return ctx.reply('ℹ️ Format salah. Gunakan: `/flash <0-255>`\nContoh: `/flash 50` untuk cahaya redup, `/flash 255` untuk maksimal.', { parse_mode: 'Markdown' });
  }

  const intensity = parseInt(parts[1]);
  
  if (isNaN(intensity) || intensity < 0 || intensity > 255) {
    return ctx.reply('❌ Nilai intensitas harus berupa angka antara 0 hingga 255.');
  }

  try {
    const { updateFlashIntensity } = require('../websocket');
    updateFlashIntensity(intensity);
    await ctx.reply(`✅ Intensitas flash berhasil diubah menjadi **${intensity}** untuk semua kamera.`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[Telegram] Failed to update flash:', err);
    await ctx.reply(`❌ Terjadi kesalahan saat mengubah flash: ${err.message}`);
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

const photoResolvers = new Map();

function registerExpectedPhoto(sensor) {
  console.log(`[Telegram] Mendaftarkan antrean foto yang diharapkan untuk sensor ${sensor}...`);
  const promise = new Promise((resolve) => {
    photoResolvers.set(sensor, resolve);
  });
  activePhotoUploads.set(sensor, promise);
  
  // Timeout 15 detik jika foto gagal diupload oleh ESP32
  setTimeout(() => {
    if (photoResolvers.has(sensor)) {
      console.log(`[Telegram] Timeout menunggu foto dari sensor ${sensor} (15s), membebaskan antrean video.`);
      const resolve = photoResolvers.get(sensor);
      resolve();
      photoResolvers.delete(sensor);
      activePhotoUploads.delete(sensor);
    }
  }, 15000);
}

// --- sendMotionAlert: Kirim peringatan teks + foto ke SEMUA registered chat ID ---
async function sendMotionAlert(location, sensor, filename = null) {
  const uploadPromise = (async () => {
    console.log(`Attempting to send Telegram alert for ${location} (${sensor})...`);
    if (registeredChatIds.length === 0) {
      console.log('No chat IDs registered for Telegram alerts.');
      return;
    }

    const message = `🚨 *MOTION DETECTED!* \n\n📍 *Location:* ${location}\n🛡️ *Sensor:* ${sensor}\n⏰ *Time:* ${new Date().toLocaleTimeString()}`;
    const targetFilename = filename || getLatestImageFilename();

    let imageBuffer = null;
    if (targetFilename) {
      try {
        imageBuffer = fs.readFileSync(path.join(DATA_DIR, 'photos', targetFilename));
      } catch (readErr) {
        console.error(`Failed to read image ${targetFilename} from disk:`, readErr.message);
      }
    }

    // Kirim ke semua registered chat ID
    for (const chatId of registeredChatIds) {
      try {
        await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        if (targetFilename) {
          const imagePath = path.join(DATA_DIR, 'photos', targetFilename);
          if (fs.existsSync(imagePath)) {
            const caption = `📸 Foto dari sensor *${sensor}* — ${new Date().toLocaleTimeString('id-ID')}`;
            const safeCaption = caption.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
            const token = process.env.TELEGRAM_BOT_TOKEN;
            const cmd = `curl -s -X POST "https://api.telegram.org/bot${token}/sendPhoto" -F chat_id="${chatId}" -F photo="@${imagePath}" -F caption="${safeCaption}" -F parse_mode="Markdown"`;
            
            await new Promise((resolve, reject) => {
              require('child_process').exec(cmd, (error, stdout, stderr) => {
                if (error) return reject(error);
                try {
                  const res = JSON.parse(stdout);
                  if (!res.ok) return reject(new Error(res.description || "Unknown API Error"));
                  resolve(res);
                } catch(e) {
                  reject(new Error("CURL response parsing failed"));
                }
              });
            });
            console.log(`[Telegram] Foto berhasil diunggah via CURL ke chat ID: ${chatId}`);
          }
        }
        console.log(`Alert sent to chat ID: ${chatId}`);
      } catch (err) {
        console.error(`Failed to send alert to ${chatId}:`, err.message);
      }
    }
  })();
  
  // Jika ini bukan dari antrean yg diharapkan (manual capture), maka set di map
  if (!activePhotoUploads.has(sensor)) {
    activePhotoUploads.set(sensor, uploadPromise);
  }
  
  await uploadPromise;
  
  // Selesai upload foto, bebaskan lock agar video bisa lanjut
  if (photoResolvers.has(sensor)) {
    const resolve = photoResolvers.get(sensor);
    resolve();
    photoResolvers.delete(sensor);
  }
  activePhotoUploads.delete(sensor);
}

// --- sendMotionVideoAlert: Kirim peringatan teks + video ke SEMUA registered chat ID ---
async function sendMotionVideoAlert(location, sensor, videoFilePath) {
  if (activePhotoUploads.has(sensor)) {
    console.log(`[Telegram] Menahan upload video untuk sensor ${sensor} sampai foto selesai terkirim...`);
    await activePhotoUploads.get(sensor).catch(() => {});
    console.log(`[Telegram] Foto terkonfirmasi terkirim, melanjutkan upload video untuk ${sensor}.`);
  }

  console.log(`Attempting to send Telegram video alert for ${location} (${sensor})...`);
  if (registeredChatIds.length === 0) {
    console.log('No chat IDs registered for Telegram alerts.');
    return;
  }

  let fileStats;
  if (videoFilePath) {
    try {
      fileStats = fs.statSync(videoFilePath);
      if (fileStats.size < 1000) {
        console.error(`[Telegram] Video file ${videoFilePath} is too small (${fileStats.size} bytes), likely corrupted/empty.`);
        return;
      }
    } catch (readErr) {
      console.error(`Failed to stat video ${videoFilePath}:`, readErr.message);
      return;
    }
  }

  // Kirim ke semua registered chat ID
  for (const chatId of registeredChatIds) {
    try {
      if (videoFilePath && fileStats) {
        const caption = `🎥 Rekaman 10 detik dari sensor *${sensor}* — ${new Date().toLocaleTimeString('id-ID')}`;
        console.log(`[Telegram] Uploading video via CURL to bypass Node.js stream bugs...`);
        
        // Eksekusi CURL murni (karena Telegraf terbukti bug 'socket hang up' di Node 26)
        const safeCaption = caption.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const cmd = `curl -s -X POST "https://api.telegram.org/bot${token}/sendVideo" -F chat_id="${chatId}" -F video="@${videoFilePath}" -F caption="${safeCaption}" -F parse_mode="Markdown"`;
        
        await new Promise((resolve, reject) => {
          require('child_process').exec(cmd, (error, stdout, stderr) => {
            if (error) {
              return reject(error);
            }
            try {
              const res = JSON.parse(stdout);
              if (!res.ok) return reject(new Error(res.description || "Unknown API Error"));
              resolve(res);
            } catch (e) {
              reject(new Error("Gagal parsing response CURL"));
            }
          });
        });
        console.log(`[Telegram] Video berhasil diunggah via CURL ke chat ID: ${chatId}`);
      }
    } catch (err) {
      console.error(`Failed to send video alert to ${chatId}:`, err.message);
    }
  }
}

module.exports = { initTelegramBot, sendMotionAlert, sendMotionVideoAlert, notifyCaptureResult, registerExpectedPhoto };

