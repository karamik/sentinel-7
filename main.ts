import { Telegraf } from 'https://esm.sh/telegraf@4.15.0';
import { MongoClient } from 'https://esm.sh/mongodb@5.8.0';
import "https://deno.land/std@0.208.0/dotenv/load.ts";

// ========== ИМПОРТЫ ТВОИХ КЛАССОВ ==========
import { SentinelBot } from './bot.ts';
import { SoulSystem } from './soul.ts';
import { TwinSystem } from './twins.ts';
import { PvPArena } from './pvp.ts';
import { VisualsSystem } from './visuals.ts';
import { Database } from './database.ts';
import { Logger } from './utils.ts';
import { CONFIG } from './config.ts';

const token = Deno.env.get('BOT_TOKEN');
if (!token) {
  console.error('❌ BOT_TOKEN не найден в .env файле!');
  Deno.exit(1);
}

const mongoUri = Deno.env.get('MONGODB_URI') || 'mongodb://localhost:27017';
const client = new MongoClient(mongoUri);

try {
  await client.connect();
  console.log('✅ Подключено к MongoDB');
  
  const db = client.db('sentinel_echo');
  const players = db.collection('players');

  // ========== ПРОСТЫЕ КОМАНДЫ (ДЛЯ ТЕСТА) ==========
  const bot = new Telegraf(token);

  bot.command('start', async (ctx) => {
    await players.updateOne(
      { telegramId: ctx.from.id },
      { 
        $setOnInsert: {
          telegramId: ctx.from.id,
          username: ctx.from.username,
          stars: 100,
          energy: 50,
          maxEnergy: 100,
          level: 1,
          experience: 0,
          inventory: [],
          createdAt: Date.now()
        }
      },
      { upsert: true }
    );
    await ctx.reply('🎮 **Добро пожаловать в Sentinel: Echo!**\n\nИспользуйте /hack для начала игры!\n\nПолная версия с душой и тенями запускается отдельно...', 
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('hack', async (ctx) => {
    const player = await players.findOne({ telegramId: ctx.from.id });
    if (!player) return ctx.reply('❌ Сначала напишите /start');
    
    const success = Math.random() > 0.3;
    if (success) {
      await players.updateOne(
        { telegramId: ctx.from.id },
        { $inc: { stars: 50, energy: -10 } }
      );
      await ctx.reply('✅ **Взлом успешен!**\n\n🔮 Найден артефакт\n💰 +50⭐\n⚡ -10 энергии');
    } else {
      await players.updateOne(
        { telegramId: ctx.from.id },
        { $inc: { energy: -10 } }
      );
      await ctx.reply('❌ **Взлом неудачен!**\n\n🛡️ Система защищена.\n⚡ -10 энергии');
    }
  });

  bot.command('profile', async (ctx) => {
    const player = await players.findOne({ telegramId: ctx.from.id });
    if (!player) return ctx.reply('❌ Сначала напишите /start');
    
    await ctx.reply(
      `👤 **Профиль игрока**\n\n` +
      `ID: ${player.telegramId}\n` +
      `⭐ Звезды: ${player.stars}\n` +
      `⚡ Энергия: ${player.energy}/${player.maxEnergy}\n` +
      `📊 Уровень: ${player.level}\n` +
      `🎯 Опыт: ${player.experience}`,
      { parse_mode: 'Markdown' }
    );
  });

  // Запускаем простого бота
  await bot.launch();
  console.log('✅ Простой Telegram бот запущен!');
  
  // ========== ЗАПУСК ПОЛНОЙ ВЕРСИИ (ОПЦИОНАЛЬНО) ==========
  console.log('🎮 Sentinel: Echo успешно работает!');
  console.log('📝 Для запуска полной версии с душой и тенями используй:');
  console.log('   deno run -A main_full.ts');
  
} catch (error) {
  console.error('❌ Ошибка:', error);
}
