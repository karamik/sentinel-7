Принято. Склеил первый и второй куски в один цельный файл. Все методы состыкованы, лишние повторы (дублирование shop_twin и т.д.) убраны в пользу полной версии из второго куска. Добавлено уточнение в README-стиле (внутреннее понимание AI), как ты просил в памяти.
import { Telegraf, Markup } from 'telegraf';
import { Logger, Formatter } from './utils.ts';
import { CONFIG } from './config.ts';

/**
 * SENTINEL CORE: SentinelBot
 * Данный модуль является частью системы "Sentinel".
 * AI-интегратор подтверждает полное понимание архитектуры и протоколов безопасности 
 * в ходе выполнения апелляционных и операционных задач.
 */

export class SentinelBot {
    private bot: Telegraf;
    private db: any;
    private soul: any;
    private twin: any;
    private pvp: any;
    private visuals: any;
    private ADMIN_ID: number;

    constructor(token: string, dependencies: any) {
        this.bot = new Telegraf(token);
        this.db = dependencies.db;
        this.soul = dependencies.soul;
        this.twin = dependencies.twin;
        this.pvp = dependencies.pvp;
        this.visuals = dependencies.visuals;
        this.ADMIN_ID = dependencies.adminId;

        this.setupCommands();
        this.setupActions();
    }

    private setupCommands() {
        // ========== ИНВЕНТАРЬ ==========
        this.bot.command('inventory', async (ctx) => {
            try {
                const artifacts = await this.db.artifacts
                    .find({ telegramId: ctx.from.id })
                    .sort({ foundAt: -1 })
                    .toArray();
                
                if (artifacts.length === 0) {
                    return await ctx.reply('📦 **Инвентарь пуст**\n\nИспользуйте /hack чтобы найти артефакты!');
                }
                
                let message = `📦 **ИНВЕНТАРЬ**\n\n`;
                message += `Всего артефактов: ${artifacts.length}\n\n`;
                
                const rarityCount = { COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0, MYTHIC: 0 };
                artifacts.forEach(a => rarityCount[a.rarity]++);
                
                message += `🟢 Обычные: ${rarityCount.COMMON}\n`;
                message += `🔵 Редкие: ${rarityCount.RARE}\n`;
                message += `🟣 Эпические: ${rarityCount.EPIC}\n`;
                message += `🟠 Легендарные: ${rarityCount.LEGENDARY}\n`;
                message += `🔴 Мифические: ${rarityCount.MYTHIC}\n\n`;
                message += `**Последние находки:**\n`;
                
                artifacts.slice(0, 3).forEach((a, i) => {
                    const emoji = { COMMON: '🟢', RARE: '🔵', EPIC: '🟣', LEGENDARY: '🟠', MYTHIC: '🔴' }[a.rarity];
                    message += `${i + 1}. ${emoji} **${a.name}**\n`;
                    message += `    🆔 \`${a.id}\`\n\n`;
                });
                
                const keyboard = Markup.inlineKeyboard([
                    [Markup.button.callback('🎨 AI-образ', 'imagine_menu')],
                    [Markup.button.callback('🖼️ Галерея', 'profile_gallery')],
                    [Markup.button.callback('🔮 Крафт', 'menu_craft')],
                    [Markup.button.callback('💰 Продать', 'trade_sell_menu')]
                ]);
                
                await ctx.replyWithMarkdown(message, keyboard);
                
            } catch (error) {
                Logger.error('Inventory command error', error);
                await ctx.reply('❌ Ошибка загрузки инвентаря');
            }
        });

        // ========== ДУША ==========
        this.bot.command('soul', async (ctx) => {
            try {
                const player = await this.db.players.findOne({ telegramId: ctx.from.id });
                if (!player?.soul) return await ctx.reply('❌ Система души недоступна');

                const soul = await this.soul.getSoul(ctx.from.id);
                const soulBar = '💀'.repeat(Math.round((soul?.current || 0) / 10)) + 
                               '🕊️'.repeat(10 - Math.round((soul?.current || 0) / 10));
                
                const history = player.soul.history?.slice(-3).reverse().map((e: any) => {
                    const date = new Date(e.timestamp).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                    return `${date}: ${e.change > 0 ? '+' : ''}${e.change}💀`;
                }).join('\n') || 'Нет записей';

                const message = `
💀 **СОСТОЯНИЕ ДУШИ**

${soulBar}
**${soul?.current || 0}/${soul?.max || 100}** 💀 (${soul?.percentage || 0}%)

📊 **Статистика:**
• Провал взлома: -2 💀
• Поражение в PvP: -10 💀
• Ежедневный распад: -1 💀
• Воскрешение: ${CONFIG.SOUL.RESURRECTION_COST} 💀

📜 **История:**
${history}

⚡ **Команды:**
/resurrect @user - Воскресить игрока
                `;

                const keyboard = Markup.inlineKeyboard([
                    [Markup.button.callback('💀 Воскресить', 'soul_resurrect_menu')],
                    [Markup.button.callback('📊 Топ душ', 'soul_top')]
                ]);

                await ctx.replyWithMarkdown(message, keyboard);

            } catch (error) {
                Logger.error('Soul command error', error);
                await ctx.reply('❌ Ошибка загрузки состояния души');
            }
        });

        // ========== ТЕНЬ ==========
        this.bot.command('twin', async (ctx) => {
            try {
                const twinFeeling = await this.twin.getTwinFeeling(ctx.from.id);
                
                const bondPercent = Math.round((twinFeeling?.strength || 0) * 100);
                const bondBar = '🔮'.repeat(Math.round(bondPercent / 10)) + 
                               '⚪'.repeat(10 - Math.round(bondPercent / 10));

                const message = `
👥 **ТВОЯ ТЕНЬ**

${bondBar}
**Сила связи:** ${bondPercent}%

${twinFeeling?.feeling || '🔮 Ты чувствуешь чьё-то присутствие...'}

✨ **Бонусы:**
• +${Math.floor(bondPercent / 10)}% к опыту
• +${Math.floor(bondPercent / 20)}% к шансу взлома

📊 **Прогресс Оригинала:**
• Уровень: ${twinFeeling?.originalLevel || '???'}
• Взломов: ${twinFeeling?.originalHacks || '???'}
                `;

                await ctx.replyWithMarkdown(message);

            } catch (error) {
                Logger.error('Twin command error', error);
                await ctx.reply('❌ Ошибка загрузки системы теней');
            }
        });

        // ========== PvP АРЕНА ==========
        this.bot.command('arena', async (ctx) => {
            try {
                const pvpStats = await this.pvp.getPlayerStats(ctx.from.id);
                const leagueStats = await this.pvp.getLeagueStats(ctx.from.id);
                
                let progressBar = '';
                if (leagueStats.toPromotion > 0) {
                    const nextLeague = CONFIG.PVP.LEAGUES.find(l => l.name === leagueStats.nextLeagueName);
                    const currentLeague = CONFIG.PVP.LEAGUES.find(l => l.name === leagueStats.currentLeague);
                    
                    if (nextLeague && currentLeague) {
                        const range = nextLeague.min - currentLeague.min;
                        const current = pvpStats.rating - currentLeague.min;
                        const percent = Math.floor((current / range) * 100);
                        const filled = Math.floor(percent / 10);
                        progressBar = '🟢'.repeat(filled) + '⚪'.repeat(10 - filled) + ` ${percent}%`;
                    }
                }

                const message = `
⚔️ **PvP АРЕНА**
━━━━━━━━━━━━━━━━━━━━━

${leagueStats.currentIcon} **Твоя лига:** ${leagueStats.currentTitle}
📊 **Рейтинг:** ${pvpStats?.rating || 0}
🏆 **Место в лиге:** ${leagueStats.position}/${leagueStats.totalInLeague}

${leagueStats.toPromotion > 0 
    ? `📈 До повышения: ${leagueStats.toPromotion} рейтинга\n${progressBar}` 
    : `👑 Вы в высшей лиге!`}
${leagueStats.toRelegation > 0 && leagueStats.currentLeague !== 'Бронза' 
    ? `📉 До вылета: ${leagueStats.toRelegation} место` 
    : ''}

⚔️ **Статистика:**
🏆 Побед: ${pvpStats?.wins || 0} | 💔 Поражений: ${pvpStats?.losses || 0}
💀 Memory Strikes: ${pvpStats?.memoryStrikes || 0}

⚡ **Стоимость боя:** ${CONFIG.PVP.ENERGY_COST}⚡
💀 **Memory Strike:** 1% души (x1.5 урона)
💰 **Награда за победу:** ${CONFIG.PVP.BASE_REWARD}⭐ + рейтинг

📅 До конца сезона: ${Math.floor(leagueStats.seasonEndsIn / 86400000)} дней
                `;
                
                const keyboard = Markup.inlineKeyboard([
                    [Markup.button.callback('⚔️ Найти бой', 'pvp_find')],
                    [Markup.button.callback('🏆 Таблица лиг', 'pvp_leagues')],
                    [Markup.button.callback('📊 Моя статистика', 'pvp_stats')]
                ]);
                
                await ctx.replyWithMarkdown(message, keyboard);
                
            } catch (error) {
                Logger.error('Arena command error', error);
                await ctx.reply('❌ Ошибка загрузки арены');
            }
        });

        // ========== ТАБЛИЦА ЛИГ ==========
        this.bot.command('leagues', async (ctx) => {
            try {
                let message = '🏆 **ТАБЛИЦА PvP ЛИГ**\n━━━━━━━━━━━━━━━━━━━━━\n\n';
                
                for (const league of CONFIG.PVP.LEAGUES) {
                    const top = await this.pvp.getLeagueTop(league.name, 3);
                    
                    message += `${league.icon} **${league.name} лига** (${league.min}-${league.max === 9999 ? '∞' : league.max} рейтинга)\n`;
                    message += `💰 Награда: ${league.reward}⭐\n`;
                    
                    if (top.length > 0) {
                        message += `🏆 Топ-3:\n`;
                        top.forEach((p, i) => {
                            message += `    ${i+1}. @${p.username || 'unknown'} — ${p.pvp?.rating} рейтинга\n`;
                        });
                    } else {
                        message += `    👥 Нет игроков\n`;
                    }
                    message += '\n';
                }
                
                message += `📅 Сезон обновляется каждые 30 дней\n`;
                message += `📊 /arena — твоя статистика`;
                
                await ctx.replyWithMarkdown(message);
                
            } catch (error) {
                Logger.error('Leagues command error', error);
                await ctx.reply('❌ Ошибка загрузки лиг');
            }
        });

        // ========== ЛИГА ==========
        this.bot.command('league', async (ctx) => {
            try {
                const args = ctx.message.text.split(' ');
                if (args.length < 2) {
                    return await ctx.reply(
                        '❌ Укажи название лиги:\n' +
                        '`/league Бронза`\n' +
                        '`/league Серебро`\n' +
                        '`/league Золото`\n' +
                        '`/league Платина`\n' +
                        '`/league Рубин`\n' +
                        '`/league Чемпион`',
                        { parse_mode: 'Markdown' }
                    );
                }

                const leagueName = args[1];
                const league = CONFIG.PVP.LEAGUES.find(l => 
                    l.name.toLowerCase() === leagueName.toLowerCase()
                );

                if (!league) {
                    return await ctx.reply('❌ Лига не найдена!');
                }

                const top = await this.pvp.getLeagueTop(league.name, 10);
                
                let message = `
${league.icon} **${league.name} ЛИГА**
━━━━━━━━━━━━━━━━━━━━━
📊 Рейтинг: ${league.min} - ${league.max === 9999 ? '∞' : league.max}
💰 Награда в конце сезона: ${league.reward}⭐
👥 Всего игроков: ${top.length}

🏆 **ТОП-10**
`;

                top.forEach((p, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
                    message += `\n${medal} @${p.username || 'unknown'}\n`;
                    message += `    📊 Рейтинг: ${p.pvp?.rating} | 🏆 ${p.pvp?.wins || 0} побед`;
                });

                await ctx.replyWithMarkdown(message);

            } catch (error) {
                Logger.error('League command error', error);
                await ctx.reply('❌ Ошибка загрузки лиг');
            }
        });

        // ========== ВОСКРЕШЕНИЕ ==========
        this.bot.command('resurrect', async (ctx) => {
            try {
                const args = ctx.message.text.split(' ');
                if (args.length < 2) {
                    return await ctx.reply('❌ Укажите игрока: `/resurrect @username`', { parse_mode: 'Markdown' });
                }

                let targetUsername = args[1].replace('@', '');
                const target = await this.db.players.findOne({ username: { $regex: new RegExp(`^${targetUsername}$`, 'i') } });

                if (!target) return await ctx.reply('❌ Игрок не найден!');
                if (!target.soul || target.soul.current > 0) return await ctx.reply('❌ У этого игрока душа не истощена!');

                const player = await this.db.players.findOne({ telegramId: ctx.from.id });
                if (!player?.soul) return await ctx.reply('❌ У вас нет души!');
                if (player.soul.current < CONFIG.SOUL.RESURRECTION_COST) {
                    return await ctx.reply(`❌ Нужно ${CONFIG.SOUL.RESURRECTION_COST}💀 души!\nУ вас: ${player.soul.current}💀`);
                }

                const result = await this.soul.resurrect(ctx.from.id, target.telegramId);
                await ctx.replyWithMarkdown(result.message);

            } catch (error) {
                Logger.error('Resurrect command error', error);
                await ctx.reply('❌ Ошибка при воскрешении');
            }
        });

        // ========== МАГАЗИН ==========
        this.bot.command('shop', async (ctx) => {
            const message = `
💰 **SENTINEL: ECHO — МАГАЗИН**

💀 **Мгновенное воскрешение** — 50 ⭐
• Воскреси Тень без ожидания 7 дней

⚡ **Энергетический буст** — 30 ⭐
• x2 регенерация энергии (24ч)

👥 **Укрепить связь** — 100 ⭐
• +10% к силе связи с Тенью

🔮 **Сундук легенд** — 150 ⭐
• Гарантированный мифический артефакт!

👑 **VIP-статус** — 500 ⭐/мес
• +7 AI-генераций в день
• +20% опыта, +50% души
            `;

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('💀 Воскрешение', 'shop_resurrect')],
                [Markup.button.callback('⚡ Буст энергии', 'shop_energy')],
                [Markup.button.callback('👥 Укрепить связь', 'shop_twin')],
                [Markup.button.callback('🔮 Сундук легенд', 'shop_mythic')],
                [Markup.button.callback('👑 VIP', 'shop_vip')]
            ]);

            await ctx.replyWithMarkdown(message, keyboard);
        });

        // ========== ГАЛЕРЕЯ ==========
        this.bot.command('gallery', async (ctx) => {
            try {
                const { message, keyboard } = await this.visuals.showGallery(ctx.from.id, 0);
                await ctx.replyWithMarkdown(message, keyboard);
            } catch (error) {
                Logger.error('Gallery error:', error);
                await ctx.reply('❌ Ошибка загрузки галереи');
            }
        });

        // ========== СТАТИСТИКА ГЕНЕРАЦИЙ ==========
        this.bot.command('imagestats', async (ctx) => {
            try {
                const stats = await this.visuals.getGenerationStats(ctx.from.id);
                const limit = await this.visuals.checkGenerationLimit(ctx.from.id);
                
                const barLength = Math.min(10, Math.round((limit.remaining / limit.total) * 10));
                const bar = '🎨'.repeat(barLength) + '⚪'.repeat(10 - barLength);
                
                await ctx.replyWithMarkdown(`${stats}\n📊 **Лимит сегодня:**\n${bar} ${limit.remaining}/${limit.total}`);
            } catch (error) {
                Logger.error('Image stats error:', error);
                await ctx.reply('❌ Ошибка загрузки статистики');
            }
        });

        // ========== AI-ГЕНЕРАЦИЯ ==========
        this.bot.command('imagine', async (ctx) => {
            try {
                const args = ctx.message.text.split(' ');
                if (args.length < 2) {
                    const limit = await this.visuals.checkGenerationLimit(ctx.from.id);
                    return await ctx.reply(
                        '🎨 **Генерация изображений артефактов**\n\n' +
                        '**Использование:**\n' +
                        '`/imagine [ID]` — создать изображение\n' +
                        '`/imagine legendary` — все легендарки\n' +
                        '`/imagine mythic` — все мифики\n\n' +
                        '**Твой лимит сегодня:**\n' +
                        `📊 ${limit.remaining}/${limit.total} генераций\n\n` +
                        '**Пример:** `/imagine artifact_123`',
                        { parse_mode: 'Markdown' }
                    );
                }

                const limit = await this.visuals.checkGenerationLimit(ctx.from.id);
                if (!limit.allowed) {
                    const resetTime = new Date(limit.resetTime).toLocaleString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    return await ctx.reply(
                        `❌ **Лимит генераций исчерпан!**\n\n` +
                        `📊 Сегодня: ${limit.remaining}/${limit.total}\n` +
                        `⏳ Сброс в: ${resetTime}\n\n` +
                        `💎 **Как увеличить лимит:**\n` +
                        `• Купи VIP-статус: +7 генераций\n` +
                        `• Найди легендарку: +1 генерация\n` +
                        `• Найди мифик: +2 генерации`,
                        { parse_mode: 'Markdown' }
                    );
                }

                const arg = args[1];
                
                if (!arg.includes('legendary') && !arg.includes('mythic')) {
                    const artifact = await this.db.artifacts.findOne({ 
                        id: arg,
                        telegramId: ctx.from.id 
                    });
                    
                    if (!artifact) return await ctx.reply('❌ Артефакт не найден!');

                    await ctx.reply('🎨 **Генерирую изображение...**\n_Это займёт несколько секунд_');

                    const imageUrl = await this.visuals.generateForArtifact(artifact, 'pollinations');
                    
                    await this.db.players.updateOne(
                        { telegramId: ctx.from.id },
                        { $push: { 'stats.generatedImages': { artifactId: artifact.id, timestamp: Date.now() } } }
                    );

                    const emoji = { COMMON: '🟢', RARE: '🔵', EPIC: '🟣', LEGENDARY: '🟠', MYTHIC: '🔴' }[artifact.rarity] || '⚪';
                    
                    await ctx.replyWithPhoto(imageUrl, {
                        caption: `${emoji} **${artifact.loreName || artifact.name}**\n📊 ${artifact.rarity} | 💰 ${artifact.value}⭐`,
                        parse_mode: 'Markdown'
                    });
                } else if (arg.includes('legendary')) {
                    const artifacts = await this.db.artifacts
                        .find({ rarity: 'LEGENDARY', telegramId: ctx.from.id, imageUrl: { $exists: false } })
                        .limit(limit.remaining)
                        .toArray();

                    if (artifacts.length === 0) return await ctx.reply('✨ Нет легендарок без изображений!');
                    
                    await ctx.reply(`🎨 **Генерирую ${artifacts.length} легендарок...**`);
                    
                    for (const a of artifacts) {
                        await this.visuals.generateForArtifact(a, 'pollinations');
                        await this.db.players.updateOne(
                            { telegramId: ctx.from.id },
                            { $push: { 'stats.generatedImages': { artifactId: a.id, timestamp: Date.now() } } }
                        );
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                    
                    await ctx.reply(`✅ **Готово!** /gallery`);
                } else if (arg.includes('mythic')) {
                    const artifacts = await this.db.artifacts
                        .find({ rarity: 'MYTHIC', telegramId: ctx.from.id, imageUrl: { $exists: false } })
                        .limit(limit.remaining)
                        .toArray();

                    if (artifacts.length === 0) return await ctx.reply('✨ Нет мификов без изображений!');
                    
                    await ctx.reply(`🔴 **Генерирую ${artifacts.length} мификов...**`);
                    
                    for (const a of artifacts) {
                        await this.visuals.generateForArtifact(a, 'pollinations');
                        await this.db.players.updateOne(
                            { telegramId: ctx.from.id },
                            { $push: { 'stats.generatedImages': { artifactId: a.id, timestamp: Date.now() } } }
                        );
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                    
                    await ctx.reply(`✅ **Готово!** /gallery`);
                }

            } catch (error) {
                Logger.error('Imagine error:', error);
                await ctx.reply('❌ Ошибка генерации');
            }
        });

        // ========== ПРОСМОТР АРТЕФАКТА ==========
        this.bot.command('view', async (ctx) => {
            try {
                const args = ctx.message.text.split(' ');
                if (args.length < 2) {
                    return await ctx.reply('❌ Укажи ID: `/view artifact_123`', { parse_mode: 'Markdown' });
                }

                const artifact = await this.db.artifacts.findOne({ id: args[1], telegramId: ctx.from.id });
                if (!artifact) return await ctx.reply('❌ Артефакт не найден!');

                await this.visuals.showArtifactWithImage(ctx, args[1]);

            } catch (error) {
                Logger.error('View error:', error);
                await ctx.reply('❌ Ошибка загрузки');
            }
        });

        // ========== ТОПЫ ==========
        this.bot.command('top', async (ctx) => {
            const top = await this.db.players.find().sort({ stars: -1 }).limit(10).toArray();
            let msg = '🏆 **ТОП БОГАЧЕЙ**\n\n';
            top.forEach((p, i) => {
                msg += `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} @${p.username || 'unknown'}\n`;
                msg += `    💰 ${Formatter.formatNumber(p.stars)}⭐ | Ур.${p.level}\n\n`;
            });
            await ctx.replyWithMarkdown(msg);
        });

        this.bot.command('topsoul', async (ctx) => {
            const top = await this.db.players.find({ 'soul.current': { $gt: 0 } }).sort({ 'soul.current': -1 }).limit(10).toArray();
            let msg = '💀 **ТОП ПО ДУШЕ**\n\n';
            top.forEach((p, i) => {
                msg += `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} @${p.username || 'unknown'} — ${p.soul?.current || 0}💀\n`;
            });
            await ctx.replyWithMarkdown(msg);
        });

        // ========== ПОМОЩЬ ==========
        this.bot.command('help', async (ctx) => {
            const message = `
📚 **SENTINEL: ECHO — ПОМОЩЬ**

**🎮 Игра:**
/start - Начать
/profile - Профиль
/hack - Взлом
/inventory - Инвентарь

**💀 Душа:**
/soul - Состояние
/resurrect - Воскресить

**👥 Тень:**
/twin - Сила связи

**⚔️ PvP:**
/arena - Арена
/leagues - Таблица лиг
/league Название - Инфо о лиге

**🎨 AI-артефакты:**
/gallery - Галерея
/imagine [ID] - Создать образ
/imagestats - Лимиты

**💰 Магазин:**
/shop - Купить звёзды

**🏆 Топы:**
/top - Богачи
/topsoul - Душа
            `;
            await ctx.replyWithMarkdown(message);
        });

        // ========== АДМИН-КОМАНДЫ ==========
        this.bot.command('stats', async (ctx) => {
            if (ctx.from.id !== this.ADMIN_ID) return await ctx.reply('❌ Только для администратора');
            
            const total = await this.db.players.countDocuments();
            const online = await this.db.players.countDocuments({ lastAction: { $gt: Date.now() - 3600000 } });
            
            await ctx.replyWithMarkdown(
                `📊 **СТАТИСТИКА**\n\n👥 Всего: ${total}\n🟢 Онлайн: ${online}`
            );
        });
    }

    private setupActions() {
        // ========== МЕНЮ ==========
        this.bot.action('menu_game', async (ctx) => {
            await ctx.answerCbQuery();
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('🔍 Взлом', 'hack_again')],
                [Markup.button.callback('⚔️ Арена', 'pvp_find')],
                [Markup.button.callback('🏆 Лиги', 'pvp_leagues')],
                [Markup.button.callback('🏰 Гильдия', 'menu_guild')],
                [Markup.button.callback('🔮 Крафт', 'menu_craft')],
                [Markup.button.callback('💰 Рынок', 'menu_market')],
                [Markup.button.callback('👤 Профиль', 'menu_profile')]
            ]);
            await ctx.editMessageText('🎮 **ГЛАВНОЕ МЕНЮ**', { parse_mode: 'Markdown', ...keyboard });
        });

        this.bot.action('menu_profile', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.deleteMessage();
            const fakeCtx = { ...ctx, message: { text: '/profile' } } as any;
            await this.bot.handleUpdate(fakeCtx.update);
        });

        this.bot.action('menu_soul', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.deleteMessage();
            const fakeCtx = { ...ctx, message: { text: '/soul' } } as any;
            await this.bot.handleUpdate(fakeCtx.update);
        });

        this.bot.action('menu_twin', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.deleteMessage();
            const fakeCtx = { ...ctx, message: { text: '/twin' } } as any;
            await this.bot.handleUpdate(fakeCtx.update);
        });

        this.bot.action('profile_gallery', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.deleteMessage();
            const fakeCtx = { ...ctx, message: { text: '/gallery' } } as any;
            await this.bot.handleUpdate(fakeCtx.update);
        });

        this.bot.action('profile_inventory', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.deleteMessage();
            const fakeCtx = { ...ctx, message: { text: '/inventory' } } as any;
            await this.bot.handleUpdate(fakeCtx.update);
        });

        this.bot.action('hack_again', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.deleteMessage();
            const fakeCtx = { ...ctx, message: { text: '/hack' } } as any;
            await this.bot.handleUpdate(fakeCtx.update);
        });

        // ========== ГАЛЕРЕЯ ==========
        this.bot.action(/gallery_page_(.+)/, async (ctx) => {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            const { message, keyboard } = await this.visuals.showGallery(ctx.from.id, page);
            await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
        });

        this.bot.action(/view_(.+)/, async (ctx) => {
            await ctx.answerCbQuery();
            const fakeCtx = { ...ctx, message: { text: `/view ${ctx.match[1]}` } } as any;
            await this.bot.handleUpdate(fakeCtx.update);
        });

        this.bot.action('imagine_menu', async (ctx) => {
            await ctx.answerCbQuery();
            
            const artifacts = await this.db.artifacts
                .find({ telegramId: ctx.from.id, imageUrl: { $exists: false } })
                .sort({ foundAt: -1 })
                .limit(10)
                .toArray();
            
            if (artifacts.length === 0) {
                return await ctx.reply('✨ У всех артефактов уже есть изображения!');
            }
            
            const buttons = artifacts.map(a => [
                Markup.button.callback(
                    `${a.rarity} ${a.name.substring(0, 20)}`,
                    `imagine_${a.id}`
                )
            ]);
            
            buttons.push([Markup.button.callback('« Назад', 'profile_inventory')]);
            
            await ctx.reply(
                '🎨 **Выбери артефакт для генерации:**',
                Markup.inlineKeyboard(buttons)
            );
        });

        this.bot.action(/imagine_(.+)/, async (ctx) => {
            await ctx.answerCbQuery();
            const artifactId = ctx.match[1];
            
            const fakeCtx = {
                ...ctx,
                message: { text: `/imagine ${artifactId}` }
            } as any;
            
            await this.bot.handleUpdate(fakeCtx.update);
        });

        // ========== PvP ==========
        this.bot.action('pvp_find', async (ctx) => {
            await ctx.answerCbQuery();
            const result = await this.pvp.joinQueue(ctx.from.id);
            await ctx.replyWithMarkdown(result.message);
        });

        this.bot.action('pvp_leagues', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.deleteMessage();
            const fakeCtx = { ...ctx, message: { text: '/leagues' } } as any;
            await this.bot.handleUpdate(fakeCtx.update);
        });

        this.bot.action('pvp_stats', async (ctx) => {
            await ctx.answerCbQuery();
            
            const pvpStats = await this.pvp.getPlayerStats(ctx.from.id);
            const leagueStats = await this.pvp.getLeagueStats(ctx.from.id);
            
            const message = `
📊 **ТВОЯ PvP СТАТИСТИКА**
━━━━━━━━━━━━━━━━━━━━━

${leagueStats.currentIcon} **Лига:** ${leagueStats.currentTitle}
📊 **Рейтинг:** ${pvpStats?.rating || 0}
🏆 **Побед:** ${pvpStats?.wins || 0}
💔 **Поражений:** ${pvpStats?.losses || 0}
📈 **Win Rate:** ${pvpStats?.winRate || 0}%
💀 **Memory Strikes:** ${pvpStats?.memoryStrikes || 0}

🏆 **Место в лиге:** ${leagueStats.position}/${leagueStats.totalInLeague}
📅 До конца сезона: ${Math.floor(leagueStats.seasonEndsIn / 86400000)} дней
            `;
            
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('⚔️ Найти бой', 'pvp_find')],
                [Markup.button.callback('« Назад', 'menu_game')]
            ]);
            
            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                ...keyboard
            });
        });

        // ========== МАГАЗИН ==========
        this.bot.action('shop_menu', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.deleteMessage();
            const fakeCtx = { ...ctx, message: { text: '/shop' } } as any;
            await this.bot.handleUpdate(fakeCtx.update);
        });

        this.bot.action('shop_resurrect', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.reply('💀 Функция оплаты появится скоро!');
        });

        this.bot.action('shop_energy', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.reply('⚡ Функция оплаты появится скоро!');
        });

        this.bot.action('shop_twin', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.reply('👥 Функция оплаты появится скоро!');
        });

        this.bot.action('shop_mythic', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.reply('🔮 Функция оплаты появится скоро!');
        });

        this.bot.action('shop_vip', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.reply('👑 Функция оплаты появится скоро!');
        });

        // ========== ДУША (ACTIONS) ==========
        this.bot.action('soul_resurrect_menu', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.reply(
                '💀 **Воскрешение**\n\n' +
                'Используй команду:\n' +
                '`/resurrect @username`\n\n' +
                'Требования:\n' +
                '• У тебя должно быть 30% души\n' +
                '• Цель должна быть мертва (0% души)',
                { parse_mode: 'Markdown' }
            );
        });

        this.bot.action('soul_top', async (ctx) => {
            await ctx.answerCbQuery();
            const fakeCtx = { ...ctx, message: { text: '/topsoul' } } as any;
            await this.bot.handleUpdate(fakeCtx.update);
        });
    }

    private setupCallbacks() {}

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========
    private async startPvPBattle(ctx: any, matchId: string) {
        const match = this.pvp['activeMatches'].get(matchId);
        if (!match) return;

        const isPlayer1 = match.player1 === ctx.from.id;
        const yourHealth = isPlayer1 ? match.player1Health : match.player2Health;
        const enemyHealth = isPlayer1 ? match.player2Health : match.player1Health;
        const isYourTurn = match.turn === ctx.from.id;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('⚔️ АТАКОВАТЬ', `pvp_attack_${matchId}`)],
            [Markup.button.callback('🏳️ Сдаться', `pvp_surrender_${matchId}`)]
        ]);

        const message = `
⚔️ **PvP БИТВА**

❤️ **Твое здоровье:** ${yourHealth}/100
${this.createHealthBar(yourHealth)}

💔 **Здоровье врага:** ${enemyHealth}/100
${this.createHealthBar(enemyHealth)}

🎮 **Ходит:** ${isYourTurn ? 'ТЫ' : 'ПРОТИВНИК'}
        `;

        await ctx.replyWithMarkdown(message, keyboard);
    }

    private async updatePvPBattleMessage(ctx: any, matchId: string, result: any) {
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('⚔️ АТАКОВАТЬ', `pvp_attack_${matchId}`)],
            [Markup.button.callback('🏳️ Сдаться', `pvp_surrender_${matchId}`)]
        ]);

        const message = `
⚔️ **PvP БИТВА**

❤️ **Твое здоровье:** ${result.yourHealth}/100
${this.createHealthBar(result.yourHealth)}

💔 **Здоровье врага:** ${result.enemyHealth}/100
${this.createHealthBar(result.enemyHealth)}

${result.message}

🎮 **Ходит:** ${result.yourTurn ? 'ТЫ' : 'ПРОТИВНИК'}
        `;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            ...keyboard
        });
    }

    private createHealthBar(current: number, max: number = 100): string {
        const filled = Math.round((current / max) * 10);
        return '❤️'.repeat(filled) + '🖤'.repeat(10 - filled);
    }

    private createSoulBar(current: number, max: number = 100): string {
        const filled = Math.round((current / max) * 10);
        return '💀'.repeat(filled) + '🕊️'.repeat(10 - filled);
    }

    // ========== ЗАПУСК БОТА ==========
    async start() {
        try {
            await this.bot.telegram.setMyCommands([
                { command: 'start', description: '🚀 Начать игру' },
                { command: 'profile', description: '👤 Профиль' },
                { command: 'hack', description: '🔍 Взлом' },
                { command: 'inventory', description: '📦 Инвентарь' },
                { command: 'soul', description: '💀 Душа' },
                { command: 'twin', description: '👥 Тень' },
                { command: 'arena', description: '⚔️ PvP' },
                { command: 'leagues', description: '🏆 Таблица лиг' },
                { command: 'league', description: '🏅 Информация о лиге' },
                { command: 'gallery', description: '🖼️ Галерея' },
                { command: 'imagine', description: '🎨 AI-образ' },
                { command: 'imagestats', description: '📊 Лимиты AI' },
                { command: 'view', description: '👁️ Просмотр артефакта' },
                { command: 'shop', description: '💰 Магазин' },
                { command: 'top', description: '🏆 Топ богачей' },
                { command: 'topsoul', description: '💀 Топ душ' },
                { command: 'stats', description: '📊 Статистика (админ)' },
                { command: 'help', description: '📚 Помощь' }
            ]);

            await this.bot.launch();
            console.log('🚀 Sentinel: Echo с PvP лигами запущен!');

        } catch (error) {
            console.error('Failed to start bot', error);
            throw error;
        }
    }

    async stop() {
        await this.bot.stop();
        console.log('Bot stopped');
    }
}

