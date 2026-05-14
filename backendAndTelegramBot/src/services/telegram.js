const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../config.json');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

let registeredChatId = null;

// Load existing config
try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    registeredChatId = config.registeredChatId;
    console.log(`Loaded registered chat ID: ${registeredChatId}`);
  }
} catch (err) {
  console.error('Failed to load config.json:', err);
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify({ registeredChatId }, null, 2));
  } catch (err) {
    console.error('Failed to save config.json:', err);
  }
}

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

bot.command('register_this_id', (ctx) => {
  registeredChatId = ctx.chat.id;
  saveConfig();
  ctx.reply(`✅ Chat ID Registered! You will now receive motion alerts. (ID: ${registeredChatId})`);
});

bot.command('devices', (ctx) => ctx.reply('hello /devices'));
bot.command('capture', (ctx) => ctx.reply('hello /capture'));
bot.command('getimage', (ctx) => ctx.reply('hello /getimage'));

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

function sendMotionAlert(location, sensor) {
  console.log(`Attempting to send Telegram alert for ${location} (${sensor})...`);
  if (!registeredChatId) {
    console.log('No chat ID registered for Telegram alerts.');
    return;
  }

  const message = `🚨 *MOTION DETECTED!* \n\n📍 *Location:* ${location}\n🛡️ *Sensor:* ${sensor}\n⏰ *Time:* ${new Date().toLocaleTimeString()}`;
  
  bot.telegram.sendMessage(registeredChatId, message, { parse_mode: 'Markdown' })
    .then(() => console.log('Telegram motion alert sent successfully.'))
    .catch((err) => {
      console.error('Failed to send Telegram motion alert:', err.message);
    });
}

module.exports = { initTelegramBot, sendMotionAlert };
