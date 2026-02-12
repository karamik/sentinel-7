// ========== bot.ts ==========
import { Telegraf, Context, Markup } from 'telegraf';
import { Database } from './database.ts';
import { SentinelGame } from './game.ts';
import { SoulSystem } from './soul.ts';
import { Logger } from './utils.ts';
import { CONFIG } from './config.ts';

interface SessionContext extends Context {
    session?: any;
}

export class SentinelBot {
    private bot: Telegraf<SessionContext>;
    private game: SentinelGame;
    
    constructor(token: string, private db: Database) {
        this.bot = new Telegraf(token);
        this.game = new SentinelGame(db);
        this.setupCommands();
        this.setupCallbacks();
    }
    
    private setupCommands() {
        // Старт игры
        this.bot.command('start', async (ctx) => {
            try {
                const telegramId = ctx.from?.id;
                const username = ctx.from?.username || 'player';
                const firstName = ctx.from?.first_name;
                
                if (!telegramId) return;
                
                const result = await this.game.registerPlayer(telegramId, username, firstName);
                
                // Инициализация души
                const soulSystem = new SoulSystem(this.db);
                await soulSystem.initSoul(telegramId);
                
                const message = result.isNew 
                    ? '🎮 **Добро пожаловать в Sentinel 7.0!**\n\nТы стал Стражем. Береги свою душу.'
                    : '👋 **С возвращением!**';
                
                await ctx.reply(message, {
                    parse_mode: 'Markdown',
                    ...Markup.keyboard([
                        ['💻 Взлом', '👤 Профиль'],
                        ['⚔️ Арена', '💀 Душа'],
                        ['🎒 Инвентарь', '📊 Топ']
                    ]).resize()
                });
            } catch (error) {
                Logger.error('Start command error', error);
                await ctx.reply('❌ Ошибка при запуске игры');
            }
        });
        
        // Профиль
        this.bot.command('profile', async (ctx) => {
            const telegramId = ctx.from?.id;
            if (!telegramId) return;
            
            const profile = await this.game.getProfile(telegramId);
            if (!profile) {
                await ctx.reply('❌ Игрок не найден! Напишите /start');
                return;
            }
            
            const message = `👤 **Профиль Стража**\n\n` +
                `Никнейм: @${profile.username}\n` +
                `⭐ Звезды: ${profile.stars}\n` +
                `📊 Уровень: ${profile.level}\n` +
                `⚡ Энергия: ${profile.energy}/${profile.maxEnergy}\n` +
                `🎯 Опыт: ${profile.experience}/${profile.nextLevelExp}\n` +
                `💻 Взломов: ${profile.hacksDone}\n` +
                `🔮 Артефактов: ${profile.artifactsFound}\n` +
                `📈 Успешность: ${profile.successRate}%\n` +
                `🏆 PvP Рейтинг: ${profile.pvpRating}\n\n` +
                `${profile.twinFeeling || ''}`;
            
            await ctx.reply(message, { parse_mode: 'Markdown' });
        });
        
        // Взлом
        this.bot.command('hack', async (ctx) => {
            const telegramId = ctx.from?.id;
            if (!telegramId) return;
            
            const result = await this.game.hack(telegramId);
            
            let message = result.message;
            
            if (result.artifact) {
                message += `\n\n🔮 **Найден артефакт:**\n` +
                    `**${result.artifact.loreName || result.artifact.name}**\n` +
                    `Редкость: ${this.getRarityEmoji(result.artifact.rarity)} ${result.artifact.rarity}\n` +
                    `💰 Ценность: ${result.artifact.value}⭐\n`;
                
                if (result.artifact.story) {
                    message += `\n_${result.artifact.story}_`;
                }
            }
            
            if (result.experience) {
                message += `\n\n🎯 +${result.experience} опыта`;
            }
            
            if (result.energyLeft !== undefined) {
                message += `\n⚡ Энергия: ${result.energyLeft}`;
            }
            
            await ctx.reply(message, { parse_mode: 'Markdown' });
        });
        
        // Инвентарь
        this.bot.command('inventory', async (ctx) => {
            const telegramId = ctx.from?.id;
            if (!telegramId) return;
            
            const player = await this.db.players.findOne({ telegramId });
            if (!player) {
                await ctx.reply('❌ Игрок не найден!');
                return;
            }
            
            if (!player.inventory || player.inventory.length === 0) {
                await ctx.reply('🎒 У вас пока нет артефактов! Используйте /hack для поиска.');
                return;
            }
            
            const artifacts = await this.db.artifacts.find({
                id: { $in: player.inventory.slice(0, 10) }
            }).toArray();
            
            let message = '🎒 **Ваш инвентарь**\n\n';
            artifacts.forEach((art, i) => {
                message += `${i + 1}. ${this.getRarityEmoji(art.rarity)} **${art.loreName || art.name}**\n`;
                message += `   Редкость: ${art.rarity} | Цена: ${art.value}⭐\n\n`;
            });
            
            message += `Всего предметов: ${player.inventory.length}/25`;
            
            await ctx.reply(message, { parse_mode: 'Markdown' });
        });
        
        // Душа
        this.bot.command('soul', async (ctx) => {
            const telegramId = ctx.from.id;
            const soulSystem = new SoulSystem(this.db);
            const soul = await soulSystem.getSoul(telegramId);
            
            if (!soul) {
                return ctx.reply('❌ Душа не найдена. Напиши /start');
            }

            let soulBar = '';
            for (let i = 0; i < 20; i++) {
                if (i < Math.floor(soul.percentage / 5)) {
                    soulBar += '█';
                } else {
                    soulBar += '░';
                }
            }

            let statusEmoji = '💚';
            let statusText = 'Крепка';
            if (soul.isDead) {
                statusEmoji = '💀';
                statusText = 'ПАЛ';
            } else if (soul.isCritical) {
                statusEmoji = '🔥';
                statusText = 'Истончена';
            }

            const message = 
                `💀 **СОСТОЯНИЕ ДУШИ**\n\n` +
                `${soulBar} ${soul.percentage}%\n\n` +
                `${statusEmoji} **Статус:** ${statusText}\n` +
                `📊 **Прочность:** ${soul.current}/${soul.max}\n\n` +
                `_Каждый неудачный взлом, поражение в битве или день бездействия истончают душу._\n` +
                `_Когда душа достигнет 0%, Страж падет в забвение._`;

            await ctx.replyWithMarkdown(message);
        });

        // Воскрешение
        this.bot.command('resurrect', async (ctx) => {
            const telegramId = ctx.from.id;
            
            const player = await this.db.players.findOne({ telegramId });
            if (!player?.resurrectionRequests || player.resurrectionRequests.length === 0) {
                return ctx.reply('🕯️ Нет запросов на воскрешение.');
            }

            let message = '🕯️ **ЗАПРОСЫ НА ВОСКРЕШЕНИЕ**\n\n';
            const buttons = [];

            for (const req of player.resurrectionRequests) {
                if (req.expiresAt > Date.now()) {
                    message += `👤 **${req.username}**\n` +
                        `⏳ Истекает: ${new Date(req.expiresAt).toLocaleString('ru-RU')}\n\n`;
                    
                    buttons.push([
                        { text: `✨ Воскресить ${req.username}`, callback_data: `resurrect_${req.from}` }
                    ]);
                }
            }

            await ctx.replyWithMarkdown(message, {
                reply_markup: { inline_keyboard: buttons }
            });
        });

        // Арена
        this.bot.command('arena', async (ctx) => {
            const telegramId = ctx.from.id;
            
            const opponent = await this.db.players.findOne({
                telegramId: { $ne: telegramId },
                'soul.current': { $gt: 0 },
                energy: { $gte: CONFIG.PVP.ENERGY_COST }
            });

            if (!opponent) {
                return ctx.reply('👥 Нет доступных противников. Попробуй позже.');
            }

            const result = await this.game.startMemoryBattle(telegramId, opponent.telegramId);
            
            if (result.success) {
                await ctx.replyWithMarkdown(result.message, {
                    reply_markup: { inline_keyboard: result.buttons || [] }
                });
                
                await ctx.telegram.sendMessage(
                    opponent.telegramId,
                    `⚔️ **Тебя вызвали на Битву Воспоминаний!**\n\n` +
                    `Противник: @${ctx.from.username || 'Страж'}\n` +
                    `ID битвы: ${result.battleId}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '⚔️ Принять бой', callback_data: `join_battle_${result.battleId}` }
                            ]]
                        }
                    }
                );
            } else {
                await ctx.reply(result.message);
            }
        });
        
        // Помощь
        this.bot.command('help', async (ctx) => {
            const message = `📚 **Доступные команды**\n\n` +
                `**Основные:**\n` +
                `/start - Начать игру\n` +
                `/profile - Мой профиль\n` +
                `/hack - Взломать систему\n` +
                `/inventory - Инвентарь\n` +
                `/soul - Состояние души\n\n` +
                `**PvP:**\n` +
                `/arena - Арена\n` +
                `/top - Топ игроков\n\n` +
                `**Гильдии:**\n` +
                `/guild - Управление гильдией\n` +
                `/raid - Рейд\n\n` +
                `**Экономика:**\n` +
                `/craft - Крафт\n` +
                `/market - Торговля`;
            
            await ctx.reply(message, { parse_mode: 'Markdown' });
        });
        
        // Обработка текстовых кнопок
        this.bot.hears('💻 Взлом', (ctx) => ctx.reply('Используйте команду /hack'));
        this.bot.hears('👤 Профиль', (ctx) => ctx.reply('Используйте команду /profile'));
        this.bot.hears('⚔️ Арена', (ctx) => ctx.reply('Используйте команду /arena'));
        this.bot.hears('💀 Душа', (ctx) => ctx.reply('Используйте команду /soul'));
        this.bot.hears('🎒 Инвентарь', (ctx) => ctx.reply('Используйте команду /inventory'));
        this.bot.hears('📊 Топ', (ctx) => ctx.reply('Используйте команду /top'));
    }
    
    private setupCallbacks() {
        this.bot.on('callback_query', async (ctx) => {
            try {
                await ctx.answerCbQuery();
                
                if (!ctx.session) ctx.session = {};
                
                const data = (ctx.callbackQuery as any).data;
                
                if (data.startsWith('join_battle_')) {
                    const battleId = data.replace('join_battle_', '');
                    await ctx.reply(`⚔️ Ты присоединился к битве ${battleId}`);
                }
                
                if (data.startsWith('battle_accept_')) {
                    const battleId = data.replace('battle_accept_', '');
                    const result = await this.game.acceptPain(battleId, ctx.from.id);
                    await ctx.editMessageText(result.message, { parse_mode: 'Markdown' });
                }
                
                if (data.startsWith('battle_erase_')) {
                    const battleId = data.replace('battle_erase_', '');
                    const result = await this.game.eraseMemory(battleId, ctx.from.id);
                    await ctx.editMessageText(result.message, { parse_mode: 'Markdown' });
                }
                
                if (data.startsWith('resurrect_')) {
                    const deadId = parseInt(data.replace('resurrect_', ''));
                    const soulSystem = new SoulSystem(this.db);
                    const result = await soulSystem.resurrect(ctx.from.id, deadId);
                    await ctx.editMessageText(result.message, { parse_mode: 'Markdown' });
                }
                
                if (data.startsWith('buy_')) {
                    await ctx.reply('Покупка в разработке');
                }
            } catch (error) {
                Logger.error('Callback error', error);
            }
        });
    }
    
    private getRarityEmoji(rarity: string): string {
        const emojis = {
            COMMON: '⚪',
            RARE: '🔵',
            EPIC: '🟣',
            LEGENDARY: '🟠',
            MYTHIC: '🔴'
        };
        return emojis[rarity as keyof typeof emojis] || '⚪';
    }
    
    async start() {
        try {
            await this.bot.launch();
            Logger.success('✅ Telegram бот запущен!');
            Logger.success('🎮 SENTINEL 7.0 УСПЕШНО ЗАПУЩЕН!');
        } catch (error) {
            Logger.error('Ошибка запуска бота', error);
            throw error;
        }
    }
    
    stop() {
        this.bot.stop();
    }
}
