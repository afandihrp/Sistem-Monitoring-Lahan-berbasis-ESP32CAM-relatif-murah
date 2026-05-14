const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => ctx.reply('hello world'));
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

module.exports = { initTelegramBot };
