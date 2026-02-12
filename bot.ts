// ========== bot.ts (фрагмент с новыми командами) ==========

// ========== СИСТЕМА ДУШИ ==========
this.bot.command('soul', async (ctx) => {
    try {
        const player = await this.db.players.findOne({ telegramId: ctx.from.id });
        if (!player?.soul) {
            return await ctx.reply('❌ Система души недоступна');
        }

        const soul = player.soul;
        const soulPercent = Math.round((soul.current / soul.max) * 100);
        
        // Прогресс-бар души
        const filledBars = Math.round(soulPercent / 10);
        const emptyBars = 10 - filledBars;
        const soulBar = '💀'.repeat(filledBars) + '🕊️'.repeat(emptyBars);

        // История изменений (последние 5)
        const history = soul.history?.slice(-5).reverse().map(entry => {
            const date = new Date(entry.timestamp).toLocaleString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit'
            });
            const sign = entry.change > 0 ? '+' : '';
            return `${date}: ${sign}${entry.change} 💀 (${entry.reason})`;
        }).join('\n') || 'Нет записей';

        // Информация о воскрешении
        let resurrectionInfo = '';
        if (soul.resurrectedBy) {
            const savior = await this.db.players.findOne({ telegramId: soul.resurrectedBy });
            const lastRes = soul.lastResurrection 
                ? new Date(soul.lastResurrection).toLocaleDateString() 
                : 'неизвестно';
            resurrectionInfo = `\n👼 Воскрешён: @${savior?.username || 'unknown'} (${lastRes})`;
        }

        // Кулдаун воскрешения
        let cooldownInfo = '';
        if (soul.lastResurrection) {
            const nextRes = soul.lastResurrection + CONFIG.SOUL.RESURRECTION_COOLDOWN;
            if (nextRes > Date.now()) {
                const daysLeft = Math.ceil((nextRes - Date.now()) / (24 * 60 * 60 * 1000));
                cooldownInfo = `\n⏳ Воскрешение через: ${daysLeft}д`;
            }
        }

        const message = `
💀 **СОСТОЯНИЕ ДУШИ**

${soulBar}
**${soul.current}/${soul.max}** 💀 (${soulPercent}%)

📊 **Статистика:**
• Потеря при провале взлома: -2 💀
• Потеря при поражении в PvP: -10 💀
• Ежедневный распад: -1 💀
• Стоимость воскрешения: ${CONFIG.SOUL.RESURRECTION_COST} 💀
• Кулдаун воскрешения: 7 дней
${resurrectionInfo}
${cooldownInfo}

📜 **История души:**
${history}

⚡ **Доступные действия:**
/resurrect [@username] - Воскресить игрока
/soul_help - Подробнее о системе души
        `;

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('💀 Воскресить', 'soul_resurrect_menu'),
                Markup.button.callback('📊 Топ душ', 'soul_top')
            ],
            [
                Markup.button.callback('❓ Как восстановить?', 'soul_help')
            ]
        ]);

        await ctx.replyWithMarkdown(message, keyboard);

    } catch (error) {
        Logger.error('Soul command error', error);
        await ctx.reply('❌ Ошибка загрузки состояния души');
    }
});

// Воскрешение
this.bot.command('resurrect', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            return await ctx.reply(
                '❌ Укажите игрока для воскрешения!\n' +
                'Пример: `/resurrect @username`'
            );
        }

        let targetUsername = args[1];
        if (targetUsername.startsWith('@')) {
            targetUsername = targetUsername.slice(1);
        }

        const target = await this.db.players.findOne({ 
            username: { $regex: new RegExp(`^${targetUsername}$`, 'i') }
        });

        if (!target) {
            return await ctx.reply('❌ Игрок не найден!');
        }

        if (!target.soul || target.soul.current > 0) {
            return await ctx.reply('❌ У этого игрока душа не истощена!');
        }

        const player = await this.db.players.findOne({ telegramId: ctx.from.id });
        if (!player?.soul) {
            return await ctx.reply('❌ У вас нет души!');
        }

        // Проверка достаточности души
        if (player.soul.current < CONFIG.SOUL.RESURRECTION_COST) {
            return await ctx.reply(
                `❌ Нужно ${CONFIG.SOUL.RESURRECTION_COST}💀 души для воскрешения!\n` +
                `У вас: ${player.soul.current}💀`
            );
        }

        // Проверка кулдауна
        if (target.soul.lastResurrection) {
            const nextRes = target.soul.lastResurrection + CONFIG.SOUL.RESURRECTION_COOLDOWN;
            if (nextRes > Date.now()) {
                const daysLeft = Math.ceil((nextRes - Date.now()) / (24 * 60 * 60 * 1000));
                return await ctx.reply(`⏳ Этого игрока можно воскресить через ${daysLeft}д`);
            }
        }

        // Подтверждение
        ctx.session = ctx.session || {};
        ctx.session.pendingResurrection = {
            targetId: target.telegramId,
            targetUsername: target.username,
            cost: CONFIG.SOUL.RESURRECTION_COST,
            expiresAt: Date.now() + 60000
        };

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('✅ Подтвердить', 'soul_resurrect_confirm'),
                Markup.button.callback('❌ Отмена', 'soul_resurrect_cancel')
            ]
        ]);

        await ctx.reply(
            `💀 **Подтвердите воскрешение**\n\n` +
            `Вы хотите воскресить @${target.username || target.telegramId}\n` +
            `Стоимость: ${CONFIG.SOUL.RESURRECTION_COST}💀 души\n\n` +
            `⚠️ После воскрешения душа не будет восстанавливаться 7 дней!`,
            { parse_mode: 'Markdown', ...keyboard }
        );

    } catch (error) {
        Logger.error('Resurrect command error', error);
        await ctx.reply('❌ Ошибка при воскрешении');
    }
});

// ========== СИСТЕМА БЛИЗНЕЦОВ ==========
this.bot.command('twin', async (ctx) => {
    try {
        const player = await this.db.players.findOne({ telegramId: ctx.from.id });
        
        let message = '';
        let keyboard;

        if (player?.twin?.isVirtual) {
            // Виртуальный близнец
            const twin = player.twin;
            const bondPercent = Math.round(twin.bondStrength * 100);
            const bondBar = '🔮'.repeat(Math.round(bondPercent / 10)) + '⚪'.repeat(10 - Math.round(bondPercent / 10));

            message = `
👥 **ВАШ ВИРТУАЛЬНЫЙ БЛИЗНЕЦ**

🔮 **Сила связи:** ${bondPercent}%
${bondBar}

📊 **Прогресс близнеца:**
• Уровень: ${twin.original?.level || 1}
• Взломов: ${twin.original?.stats.hacksDone || 0}
• Артефактов: ${twin.original?.stats.artifactsFound || 0}

✨ **Бонусы:**
• +${Math.floor(twin.bondStrength * 10)}% к опыту
• +${Math.floor(twin.bondStrength * 5)}% к шансу взлома
• Виртуальный крафт (без риска)

💡 Виртуальный близнец копирует ваши действия и даёт бонусы!
            `;

            keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('🔮 Укрепить связь', 'twin_boost')],
                [Markup.button.callback('📊 Статистика', 'twin_stats')]
            ]);

        } else if (player?.twins && player.twins.length > 0) {
            // Есть присоединившиеся близнецы
            message = `👥 **ВАШИ БЛИЗНЕЦЫ (${player.twins.length})**\n\n`;
            
            for (const twin of player.twins) {
                const twinPlayer = await this.db.players.findOne({ telegramId: twin.id });
                message += `• @${twinPlayer?.username || twin.id} — ур.${twin.level}, вклад: ${twin.contribution}⭐\n`;
            }

            message += `\n✨ Бонус за близнецов: +${Math.min(player.twins.length * 5, 30)}% к опыту`;

            keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('➕ Создать виртуального', 'twin_create_virtual')],
                [Markup.button.callback('🔗 Пригласить', 'twin_invite')]
            ]);

        } else {
            // Нет близнецов
            message = `
👥 **СИСТЕМА БЛИЗНЕЦОВ**

Создайте виртуального близнеца или пригласите друга!

🔮 **Виртуальный близнец:**
• Копирует ваш прогресс
• Даёт бонусы к опыту и взлому
• Может крафтить без риска
• Стоимость: 1000⭐

🤝 **Близнец-друг:**
• Делится опытом
• Совместные рейды
• Взаимное воскрешение
• Бонус за каждого: +5% к опыту
            `;

            keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('🔮 Создать (1000⭐)', 'twin_create_virtual')],
                [Markup.button.callback('🔗 Пригласить друга', 'twin_invite')],
                [Markup.button.callback('❓ Как это работает?', 'twin_help')]
            ]);
        }

        await ctx.replyWithMarkdown(message, keyboard);

    } catch (error) {
        Logger.error('Twin command error', error);
        await ctx.reply('❌ Ошибка загрузки системы близнецов');
    }
});

// ========== ОБРАБОТЧИКИ ДЕЙСТВИЙ ==========

// Воскрешение
this.bot.action('soul_resurrect_confirm', async (ctx) => {
    await ctx.answerCbQuery();
    
    if (!ctx.session?.pendingResurrection) {
        return await ctx.editMessageText('❌ Запрос устарел, попробуйте снова');
    }

    const { targetId, cost } = ctx.session.pendingResurrection;
    
    const result = await this.soul.resurrect(ctx.from.id, targetId);
    delete ctx.session.pendingResurrection;
    
    await ctx.editMessageText(result.message, { parse_mode: 'Markdown' });
});

// Создание виртуального близнеца
this.bot.action('twin_create_virtual', async (ctx) => {
    await ctx.answerCbQuery();
    
    const player = await this.db.players.findOne({ telegramId: ctx.from.id });
    
    if (player?.twin?.isVirtual) {
        return await ctx.reply('❌ У вас уже есть виртуальный близнец!');
    }

    if (player.stars < 1000) {
        return await ctx.reply('❌ Нужно 1000⭐ для создания близнеца!');
    }

    // Создаем виртуального близнеца
    const now = Date.now();
    await this.db.players.updateOne(
        { telegramId: ctx.from.id },
        {
            $set: {
                twin: {
                    original: {
                        joinedAt: now,
                        level: player.level,
                        stats: {
                            hacksDone: player.stats.hacksDone,
                            artifactsFound: player.stats.artifactsFound
                        }
                    },
                    bondStrength: 0.1,
                    isVirtual: true
                }
            },
            $inc: { stars: -1000 }
        }
    );

    await ctx.reply(
        '✅ **Виртуальный близнец создан!**\n\n' +
        '🔮 Он будет копировать ваши действия и усиливать вас.\n' +
        'Сила связи: 10%\n\n' +
        'Совет: Чаще играйте, чтобы укрепить связь!'
    );
});

// Приглашение близнеца
this.bot.action('twin_invite', async (ctx) => {
    await ctx.answerCbQuery();
    
    ctx.session = ctx.session || {};
    ctx.session.awaitingTwinInvite = true;
    
    await ctx.reply(
        '🔗 **Приглашение близнеца**\n\n' +
        'Отправьте @username игрока, которого хотите сделать своим близнецом:\n\n' +
        'Пример: `@username`'
    );
});

// Обработка текстовых приглашений
this.bot.on('text', async (ctx) => {
    // ... существующий код ...
    
    // Приглашение близнеца
    if (ctx.session?.awaitingTwinInvite) {
        let username = ctx.message.text;
        if (username.startsWith('@')) {
            username = username.slice(1);
        }

        const target = await this.db.players.findOne({ 
            username: { $regex: new RegExp(`^${username}$`, 'i') }
        });

        if (!target) {
            await ctx.reply('❌ Игрок не найден!');
            delete ctx.session.awaitingTwinInvite;
            return;
        }

        if (target.telegramId === ctx.from.id) {
            await ctx.reply('❌ Нельзя сделать близнецом самого себя!');
            delete ctx.session.awaitingTwinInvite;
            return;
        }

        // Создаем приглашение
        const invite = {
            from: ctx.from.id,
            to: target.telegramId,
            type: 'twin',
            expiresAt: Date.now() + 86400000
        };

        await this.db.guildInvites.insertOne(invite); // временно используем ту же коллекцию

        await ctx.reply(
            `✅ Приглашение отправлено @${target.username}!\n` +
            `Оно действует 24 часа.`
        );

        // Уведомление получателю (заглушка)
        delete ctx.session.awaitingTwinInvite;
        return;
    }// ========== АДМИН-ПАНЕЛЬ С ГРАФИКАМИ ==========
// Только для админа (ID: 438850682)

private async generateActivityChart(days: number = 7): Promise<string> {
    const data = [];
    const now = Date.now();
    
    for (let i = days - 1; i >= 0; i--) {
        const day = now - i * 24 * 60 * 60 * 1000;
        const nextDay = day + 24 * 60 * 60 * 1000;
        
        const count = await this.db.players.countDocuments({
            lastAction: { $gte: day, $lt: nextDay }
        });
        data.push(count);
    }
    
    const max = Math.max(...data, 1);
    let chart = '📊 **АКТИВНОСТЬ (7 ДНЕЙ)**\n```\n';
    
    const daysNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const today = new Date().getDay();
    
    for (let i = 0; i < days; i++) {
        const dayIndex = (today - days + i + 7) % 7;
        const barLength = Math.round((data[i] / max) * 20);
        const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
        chart += `${daysNames[dayIndex]} ${bar} ${data[i]}\n`;
    }
    
    chart += '```\n🟢 Активность игроков по дням';
    return chart;
}

private async generateSoulChart(): Promise<string> {
    const total = await this.db.players.countDocuments();
    const alive = await this.db.players.countDocuments({ 'soul.current': { $gt: 0 } });
    const dead = await this.db.players.countDocuments({ 'soul.current': 0 });
    const critical = await this.db.players.countDocuments({ 'soul.current': { $lt: 30, $gt: 0 } });
    
    const alivePercent = Math.round((alive / total) * 100) || 0;
    const deadPercent = Math.round((dead / total) * 100) || 0;
    const criticalPercent = Math.round((critical / total) * 100) || 0;
    
    let chart = '💀 **СОСТОЯНИЕ ДУШ**\n```\n';
    chart += `🟢 Живы:  ${'█'.repeat(Math.round(alivePercent / 5))}${'░'.repeat(20 - Math.round(alivePercent / 5))} ${alive} (${alivePercent}%)\n`;
    chart += `⚠️ Крит:  ${'█'.repeat(Math.round(criticalPercent / 5))}${'░'.repeat(20 - Math.round(criticalPercent / 5))} ${critical} (${criticalPercent}%)\n`;
    chart += `⚰️ Мертвы: ${'█'.repeat(Math.round(deadPercent / 5))}${'░'.repeat(20 - Math.round(deadPercent / 5))} ${dead} (${deadPercent}%)\n`;
    chart += '```\n🟢 Живы | ⚠️ Критически | ⚰️ Мертвы';
    return chart;
}

private async generateEconomyChart(): Promise<string> {
    const players = await this.db.players.find().sort({ stars: -1 }).limit(5).toArray();
    
    let chart = '💰 **ТОП БАЛАНСОВ**\n```\n';
    players.forEach((p, i) => {
        const stars = p.stars || 0;
        const barLength = Math.min(20, Math.round(Math.log10(stars + 1) * 5));
        const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
        chart += `${i + 1}. @${p.username || 'unknown'}\n   ${bar} ${Formatter.formatNumber(stars)}⭐\n`;
    });
    chart += '```\n🏆 Топ-5 богачей';
    return chart;
}

// ========== DASHBOARD ==========
this.bot.command('dashboard', async (ctx) => {
    // Только для админа
    if (ctx.from.id !== 438850682) {
        return await ctx.reply('❌ Только для администратора');
    }
    
    try {
        const now = Date.now();
        const hourAgo = now - 60 * 60 * 1000;
        const today = new Date().setHours(0, 0, 0, 0);
        
        const [total, online, activityChart, soulChart, economyChart] = await Promise.all([
            this.db.players.countDocuments(),
            this.db.players.countDocuments({ lastAction: { $gt: hourAgo } }),
            this.generateActivityChart(),
            this.generateSoulChart(),
            this.generateEconomyChart()
        ]);
        
        const onlinePercent = Math.round((online / total) * 100) || 0;
        const onlineBar = '🟢'.repeat(Math.round(onlinePercent / 10)) + '⚫'.repeat(10 - Math.round(onlinePercent / 10));
        
        const message = `
📊 **SENTINEL: ECHO — DASHBOARD**
━━━━━━━━━━━━━━━━━━━━━

👥 **ОНЛАЙН**
┌ 👤 Всего: ${total}
├ 🟢 Сейчас: ${online} (${onlinePercent}%)
└ ${onlineBar}

${activityChart}

${soulChart}

${economyChart}

━━━━━━━━━━━━━━━━━━━━━
📋 /stats — Детальная статистика
💀 /topsoul — Топ по душе
⚔️ /pvptop — Топ PvP
        `;
        
        await ctx.replyWithMarkdown(message);
        
    } catch (error) {
        console.error('Dashboard error:', error);
        await ctx.reply('❌ Ошибка загрузки дашборда');
    }
});

// ========== МИНИ-ИГРА: ЭХО ПАМЯТИ ==========
// Мини-игра про связь с Оригиналом

this.bot.command('memory', async (ctx) => {
    try {
        const player = await this.db.players.findOne({ telegramId: ctx.from.id });
        const twinFeeling = await this.twin.getTwinFeeling(ctx.from.id);
        
        if (!player?.twin) {
            return await ctx.reply('🔮 У тебя ещё нет Тени... Придёт время.');
        }
        
        const strength = twinFeeling?.strength || 0.1;
        const maxRounds = 3;
        let round = 1;
        let score = 0;
        
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🎮 Начать игру', 'memory_start')]
        ]);
        
        await ctx.replyWithMarkdown(
            `🧠 **ЭХО ПАМЯТИ**\n\n` +
            `Ты чувствуешь своего Оригинала. Его воспоминания становятся твоими.\n\n` +
            `**Сила связи:** ${Math.round(strength * 100)}%\n` +
            `**Сложность:** ${strength > 0.7 ? 'Легко' : strength > 0.4 ? 'Средне' : 'Тяжело'}\n\n` +
            `Попробуй угадать воспоминания Оригинала. Чем сильнее связь — тем легче.`,
            keyboard
        );
        
    } catch (error) {
        console.error('Memory game error:', error);
        await ctx.reply('❌ Ошибка');
    }
});

this.bot.action('memory_start', async (ctx) => {
    await ctx.answerCbQuery();
    
    const player = await this.db.players.findOne({ telegramId: ctx.from.id });
    const twinFeeling = await this.twin.getTwinFeeling(ctx.from.id);
    const strength = twinFeeling?.strength || 0.1;
    
    // Генерируем воспоминание
    const memories = [
        { emoji: '🌲', text: 'Лес', hint: 'Там пахло соснами' },
        { emoji: '🌊', text: 'Море', hint: 'Солёный ветер' },
        { emoji: '🏔️', text: 'Горы', hint: 'Холод и тишина' },
        { emoji: '🌃', text: 'Город', hint: 'Огни и шум' },
        { emoji: '📚', text: 'Библиотека', hint: 'Запах старых книг' },
        { emoji: '🎮', text: 'Аркада', hint: 'Пиксели и джойстики' },
        { emoji: '☕', text: 'Кафе', hint: 'Горький кофе' },
        { emoji: '🎸', text: 'Концерт', hint: 'Гитара и толпа' }
    ];
    
    const memory = memories[Math.floor(Math.random() * memories.length)];
    ctx.session = ctx.session || {};
    ctx.session.memoryGame = {
        memory,
        round: 1,
        score: 0,
        maxRounds: 3 + Math.floor(strength * 2)
    };
    
    const hintChance = Math.min(0.8, strength);
    const showHint = Math.random() < hintChance;
    
    let message = `🎮 **РАУНД ${ctx.session.memoryGame.round}**\n\n`;
    message += `Ты чувствуешь воспоминание...\n\n`;
    message += `**${memory.emoji}**\n\n`;
    
    if (showHint) {
        message += `_«${memory.hint}»_\n\n`;
    }
    
    message += `Что это за место?`;
    
    const buttons = memories.map(m => 
        Markup.button.callback(m.emoji, `memory_answer_${m.text}`)
    );
    
    // Распределяем кнопки по рядам (по 2 в ряд)
    const keyboard = Markup.inlineKeyboard([
        buttons.slice(0, 2),
        buttons.slice(2, 4),
        buttons.slice(4, 6),
        buttons.slice(6, 8)
    ]);
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
});

this.bot.action(/memory_answer_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    
    const answer = ctx.match[1];
    const game = ctx.session?.memoryGame;
    
    if (!game) {
        return await ctx.reply('❌ Игра не найдена. Начни заново /memory');
    }
    
    const isCorrect = answer === game.memory.text;
    
    if (isCorrect) {
        game.score += 10;
        await ctx.replyWithMarkdown(`✅ Верно! +10 баллов`);
    } else {
        await ctx.replyWithMarkdown(`❌ Нет, это было **${game.memory.text}**`);
    }
    
    game.round++;
    
    if (game.round > game.maxRounds) {
        // Игра окончена
        const bondIncrease = game.score / 500; // +0.02 за 10 очков
        await this.db.players.updateOne(
            { telegramId: ctx.from.id },
            { $inc: { 'twin.bondStrength': bondIncrease } }
        );
        
        const message = `
🏆 **ИГРА ОКОНЧЕНА!**

📊 **Счёт:** ${game.score}/${game.maxRounds * 10}
🔮 **Сила связи:** +${Math.round(bondIncrease * 100)}%

_Ты стал чуть ближе к своему Оригиналу..._
        `;
        
        await ctx.replyWithMarkdown(message);
        delete ctx.session.memoryGame;
    } else {
        // Следующий раунд
        const fakeCtx = { ...ctx, update: { callback_query: { data: 'memory_start' } } } as any;
        await this.bot.handleUpdate(fakeCtx.update);
    }
});

// ========== ЕЖЕДНЕВНЫЙ ОТЧЕТ ==========
// Добавь в main.ts:
/*
setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 23 && now.getMinutes() === 59) {
        const bot = getBot();
        const stats = await generateDailyReport();
        await bot.telegram.sendMessage(438850682, stats, { parse_mode: 'Markdown' });
    }
}, 60000);
*/
});
// ========== analytics.ts ==========
// ПОЛНАЯ АНАЛИТИКА ДЛЯ SENTINEL: ECHO
// Вставь этот файл целиком в папку проекта и импортируй в bot.ts

import { Database } from './database.ts';
import { Telegraf } from 'https://esm.sh/telegraf@4.15.0';

export class AnalyticsSystem {
    private bot: Telegraf;
    private readonly ADMIN_ID = 438850682; // Твой Telegram ID
    
    constructor(
        private db: Database,
        bot: Telegraf
    ) {
        this.bot = bot;
    }

    // ========== ГЛАВНЫЙ ДАШБОРД ==========
    async getMainDashboard(): Promise<string> {
        const now = Date.now();
        const today = new Date().setHours(0, 0, 0, 0);
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
        const hourAgo = now - 60 * 60 * 1000;

        const [
            totalPlayers,
            newToday,
            newWeek,
            newMonth,
            onlineNow,
            activeToday,
            activeWeek,
            activeMonth,
            totalStars,
            totalDonated,
            totalDonations,
            donatorsCount,
            avgDonation,
            topDonator,
            totalSoul,
            deadPlayers,
            hallCount,
            totalHacks,
            totalPvp,
            totalRaids,
            totalTwins,
            totalResurrections,
            vipCount
        ] = await Promise.all([
            // 👥 Игроки
            this.db.players.countDocuments(),
            this.db.players.countDocuments({ createdAt: { $gt: today } }),
            this.db.players.countDocuments({ createdAt: { $gt: weekAgo } }),
            this.db.players.countDocuments({ createdAt: { $gt: monthAgo } }),
            
            // 🟢 Онлайн
            this.db.players.countDocuments({ lastAction: { $gt: hourAgo } }),
            this.db.players.countDocuments({ lastAction: { $gt: today } }),
            this.db.players.countDocuments({ lastAction: { $gt: weekAgo } }),
            this.db.players.countDocuments({ lastAction: { $gt: monthAgo } }),
            
            // 💰 Экономика
            this.db.players.aggregate([{ $group: { _id: null, total: { $sum: "$stars" } } }]).toArray(),
            this.db.players.aggregate([{ $group: { _id: null, total: { $sum: "$stats.totalDonated" } } }]).toArray(),
            this.db.players.aggregate([{ $group: { _id: null, total: { $sum: "$stats.donations" } } }]).toArray(),
            this.db.players.countDocuments({ "stats.totalDonated": { $gt: 0 } }),
            this.db.players.aggregate([
                { $match: { "stats.totalDonated": { $gt: 0 } } },
                { $group: { _id: null, avg: { $avg: "$stats.totalDonated" } } }
            ]).toArray(),
            this.db.players.find({ "stats.totalDonated": { $gt: 0 } })
                .sort({ "stats.totalDonated": -1 })
                .limit(1)
                .toArray(),
            
            // 💀 Душа
            this.db.players.aggregate([
                { $match: { "soul.current": { $exists: true } } },
                { $group: { _id: null, total: { $sum: "$soul.current" } } }
            ]).toArray(),
            this.db.players.countDocuments({ "soul.current": 0 }),
            this.db.hallOfFame.countDocuments(),
            
            // ⚔️ Активность
            this.db.players.aggregate([{ $group: { _id: null, total: { $sum: "$stats.hacksDone" } } }]).toArray(),
            this.db.players.aggregate([{ $group: { _id: null, total: { $sum: "$stats.pvpBattles" } } }]).toArray(),
            this.db.players.aggregate([{ $group: { _id: null, total: { $sum: "$stats.raidsDone" } } }]).toArray(),
            
            // 👥 Тени
            this.db.players.countDocuments({ twins: { $exists: true, $ne: [] } }),
            this.db.players.aggregate([{ $group: { _id: null, total: { $sum: "$stats.resurrectionsGiven" } } }]).toArray(),
            
            // 👑 VIP
            this.db.players.countDocuments({ "vip.until": { $gt: now } })
        ]);

        const formatNumber = (num: number) => num?.toLocaleString() || '0';
        const formatPercent = (part: number, total: number) => 
            total > 0 ? `${Math.round((part / total) * 100)}%` : '0%';

        // Прогресс-бары
        const onlinePercent = Math.round((onlineNow / totalPlayers) * 100) || 0;
        const onlineBar = '🟢'.repeat(Math.round(onlinePercent / 10)) + '⚫'.repeat(10 - Math.round(onlinePercent / 10));
        
        const soulPercent = totalPlayers > 0 ? Math.round(((totalPlayers - deadPlayers) / totalPlayers) * 100) : 0;
        const soulBar = '💀'.repeat(Math.round(soulPercent / 10)) + '🕊️'.repeat(10 - Math.round(soulPercent / 10));

        return `
📊 **SENTINEL: ECHO — ГЛОБАЛЬНАЯ АНАЛИТИКА**
━━━━━━━━━━━━━━━━━━━━━
🕐 ${new Date().toLocaleString('ru-RU')}

👥 **АУДИТОРИЯ**
┌ 👤 Всего игроков: ${formatNumber(totalPlayers)}
├ 🆕 Новых сегодня: ${formatNumber(newToday)} (${formatPercent(newToday, totalPlayers)})
├ 🆕 Новых за неделю: ${formatNumber(newWeek)} (${formatPercent(newWeek, totalPlayers)})
├ 🆕 Новых за месяц: ${formatNumber(newMonth)} (${formatPercent(newMonth, totalPlayers)})
├
├ 🟢 Онлайн сейчас: ${formatNumber(onlineNow)} (${onlinePercent}%)
│  ${onlineBar}
├ 📅 Активны сегодня: ${formatNumber(activeToday)} (${formatPercent(activeToday, totalPlayers)})
├ 📆 Активны за неделю: ${formatNumber(activeWeek)} (${formatPercent(activeWeek, totalPlayers)})
└ 📆 Активны за месяц: ${formatNumber(activeMonth)} (${formatPercent(activeMonth, totalPlayers)})

💰 **ФИНАНСЫ**
┌ 💰 Касса игроков: ${formatNumber(totalStars[0]?.total || 0)} ⭐
├ 💎 Всего донатов: ${formatNumber(totalDonated[0]?.total || 0)} ⭐
├ 🛒 Всего покупок: ${formatNumber(totalDonations[0]?.total || 0)}
├ 👥 Доноров: ${formatNumber(donatorsCount)}
├ 📊 Средний чек: ${formatNumber(Math.round(avgDonation[0]?.avg || 0))} ⭐
├ 👑 Топ донатер: @${topDonator[0]?.username || 'unknown'} (${formatNumber(topDonator[0]?.stats?.totalDonated || 0)}⭐)
└ 👑 VIP активны: ${formatNumber(vipCount)}

💀 **ДУША**
┌ 💀 Всего души: ${formatNumber(totalSoul[0]?.total || 0)} / ${formatNumber(totalPlayers * 100)}
│  ${soulBar}
├ ⚰️ Мертвых: ${formatNumber(deadPlayers)} (${formatPercent(deadPlayers, totalPlayers)})
├ 📜 В Зале Славы: ${formatNumber(hallCount)}
└ 🔄 Воскрешений: ${formatNumber(totalResurrections[0]?.total || 0)}

⚔️ **АКТИВНОСТЬ ЗА ВСЁ ВРЕМЯ**
┌ 🔍 Взломов: ${formatNumber(totalHacks[0]?.total || 0)}
├ ⚔️ PvP битв: ${formatNumber(totalPvp[0]?.total || 0)}
├ 🏰 Рейдов: ${formatNumber(totalRaids[0]?.total || 0)}
└ 👥 Активных теней: ${formatNumber(totalTwins)}

━━━━━━━━━━━━━━━━━━━━━
📈 /analytics_detailed — Детальная аналитика
💰 /analytics_revenue — Финансовый отчёт
👥 /analytics_players — Аналитика игроков
💀 /analytics_soul — Аналитика души
📊 /analytics_charts — Графики
        `;
    }

    // ========== ФИНАНСОВЫЙ ОТЧЁТ ==========
    async getRevenueReport(): Promise<string> {
        const now = Date.now();
        const today = new Date().setHours(0, 0, 0, 0);
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

        // Продажи по товарам
        const products = [
            { payload: 'resurrect_instant', name: '💀 Воскрешение', price: 50 },
            { payload: 'energy_boost_24h', name: '⚡ Буст энергии', price: 30 },
            { payload: 'twin_boost_permanent', name: '👥 Связь +10%', price: 100 },
            { payload: 'mythic_chest', name: '🔮 Сундук легенд', price: 150 },
            { payload: 'vip_month', name: '👑 VIP-статус', price: 500 }
        ];

        const productStats = await Promise.all(products.map(async p => {
            const todaySales = await this.db.players.countDocuments({
                "stats.lastPurchase.payload": p.payload,
                "stats.lastPurchase.date": { $gt: today }
            });
            
            const weekSales = await this.db.players.countDocuments({
                "stats.lastPurchase.payload": p.payload,
                "stats.lastPurchase.date": { $gt: weekAgo }
            });

            const totalSales = await this.db.players.aggregate([
                { $match: { "stats.totalDonated": { $gt: 0 } } },
                { $project: { purchases: "$stats.purchases" } },
                { $unwind: "$purchases" },
                { $match: { "purchases.payload": p.payload } },
                { $count: "total" }
            ]).toArray();

            return {
                ...p,
                today: todaySales,
                week: weekSales,
                total: totalSales[0]?.total || 0,
                revenue: (totalSales[0]?.total || 0) * p.price
            };
        }));

        const totalRevenue = productStats.reduce((sum, p) => sum + p.revenue, 0);
        const totalSales = productStats.reduce((sum, p) => sum + p.total, 0);

        // Топ донатеров
        const topDonators = await this.db.players
            .find({ "stats.totalDonated": { $gt: 0 } })
            .sort({ "stats.totalDonated": -1 })
            .limit(10)
            .project({ 
                username: 1, 
                firstName: 1,
                "stats.totalDonated": 1,
                "stats.donations": 1,
                "stats.lastDonation": 1,
                vip: 1
            })
            .toArray();

        // Последние покупки
        const recentPurchases = await this.db.players
            .find({ "stats.lastPurchase": { $exists: true } })
            .sort({ "stats.lastPurchase.date": -1 })
            .limit(10)
            .project({
                username: 1,
                firstName: 1,
                "stats.lastPurchase": 1
            })
            .toArray();

        let message = `
💰 **SENTINEL: ECHO — ФИНАНСОВЫЙ ОТЧЁТ**
━━━━━━━━━━━━━━━━━━━━━
🕐 ${new Date().toLocaleString('ru-RU')}

💎 **ОБЩАЯ СТАТИСТИКА**
┌ 💰 Всего донатов: ${totalRevenue} ⭐
├ 🛒 Всего продаж: ${totalSales}
├ 📊 Средний чек: ${totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0} ⭐
└ 👥 Всего доноров: ${topDonators.length}

📦 **ПРОДАЖИ ПО ТОВАРАМ**
`;

        productStats.forEach(p => {
            const percent = totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 100) : 0;
            const bar = '█'.repeat(Math.round(percent / 5)) + '░'.repeat(20 - Math.round(percent / 5));
            message += `
${p.name}
┌ 📊 Продаж всего: ${p.total}
├ 💰 Выручка: ${p.revenue} ⭐ (${percent}%)
├ 📈 За неделю: +${p.week}
└ 📅 Сегодня: +${p.today}
   ${bar}`;
        });

        message += `

🏆 **ТОП ДОНАТЕРОВ**
`;

        topDonators.forEach((p, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            const vip = p.vip?.until > Date.now() ? '👑' : '';
            const lastDonation = p.stats?.lastDonation 
                ? new Date(p.stats.lastDonation).toLocaleDateString('ru-RU')
                : 'никогда';
            
            message += `
${medal} ${vip} @${p.username || p.firstName || 'unknown'}
   💎 Донатов: ${p.stats?.totalDonated || 0} ⭐
   🛒 Покупок: ${p.stats?.donations || 0}
   📅 Последний донат: ${lastDonation}`;
        });

        message += `

🕐 **ПОСЛЕДНИЕ ПОКУПКИ**
`;

        recentPurchases.forEach((p, i) => {
            const purchase = p.stats?.lastPurchase;
            const product = products.find(pr => pr.payload === purchase?.payload);
            message += `
${i + 1}. @${p.username || p.firstName || 'unknown'}
   🛒 ${product?.name || purchase?.payload || 'Неизвестно'}
   💰 ${purchase?.amount || 0} ⭐
   🕐 ${purchase?.date ? new Date(purchase.date).toLocaleString('ru-RU') : ''}`;
        });

        message += `

━━━━━━━━━━━━━━━━━━━━━
📊 /analytics — Главный дашборд
📈 /analytics_charts — Графики продаж
💎 /analytics_top_donators — Топ-50 донатеров
        `;

        return message;
    }

    // ========== ГРАФИКИ ПРОДАЖ ==========
    async getSalesCharts(): Promise<string> {
        const now = Date.now();
        const days = [];
        
        // Последние 30 дней
        for (let i = 29; i >= 0; i--) {
            const day = now - i * 24 * 60 * 60 * 1000;
            const nextDay = day + 24 * 60 * 60 * 1000;
            
            const sales = await this.db.players.aggregate([
                { $match: { "stats.purchases.date": { $gte: day, $lt: nextDay } } },
                { $unwind: "$stats.purchases" },
                { $match: { "stats.purchases.date": { $gte: day, $lt: nextDay } } },
                { $group: { _id: null, total: { $sum: "$stats.purchases.amount" } } }
            ]).toArray();
            
            days.push({
                date: new Date(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' }),
                revenue: sales[0]?.total || 0
            });
        }

        const maxRevenue = Math.max(...days.map(d => d.revenue), 1);
        
        let chart = `
📈 **SENTINEL: ECHO — ГРАФИК ПРОДАЖ (30 ДНЕЙ)**
━━━━━━━━━━━━━━━━━━━━━
📅 Выручка по дням в Telegram Stars ⭐
\`\`\`
`;

        // График
        for (let i = 0; i < days.length; i += 3) { // Каждый 3-й день для читаемости
            const day = days[i];
            const barLength = Math.round((day.revenue / maxRevenue) * 30);
            const bar = '█'.repeat(barLength);
            chart += `${day.date.padEnd(10)} ${bar.padEnd(30)} ${day.revenue}⭐\n`;
        }

        chart += '```\n';

        // Статистика по дням недели
        const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const weekStats = new Array(7).fill(0);
        const weekCounts = new Array(7).fill(0);
        
        days.forEach((day, index) => {
            const dayOfWeek = (new Date(now - index * 24 * 60 * 60 * 1000)).getDay();
            const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Пн = 0
            weekStats[adjustedDay] += day.revenue;
            weekCounts[adjustedDay]++;
        });

        chart += `
📊 **СРЕДНИЙ ДОХОД ПО ДНЯМ НЕДЕЛИ**
\`\`\`
`;

        weekDays.forEach((day, i) => {
            const avg = weekCounts[i] > 0 ? Math.round(weekStats[i] / weekCounts[i]) : 0;
            const barLength = Math.round((avg / maxRevenue) * 20);
            const bar = '█'.repeat(barLength);
            chart += `${day}: ${bar.padEnd(20)} ${avg}⭐\n`;
        });

        chart += '```';

        return chart;
    }

    // ========== ДЕТАЛЬНАЯ АНАЛИТИКА ИГРОКОВ ==========
    async getPlayerAnalytics(): Promise<string> {
        const now = Date.now();
        
        const [
            levels,
            souls,
            retention,
            activity
        ] = await Promise.all([
            // Распределение по уровням
            this.db.players.aggregate([
                { $group: { 
                    _id: "$level",
                    count: { $sum: 1 }
                }},
                { $sort: { _id: 1 } }
            ]).toArray(),
            
            // Распределение души
            this.db.players.aggregate([
                { $match: { "soul.current": { $exists: true } } },
                { $bucket: {
                    groupBy: "$soul.current",
                    boundaries: [0, 20, 40, 60, 80, 100],
                    default: "100+",
                    output: { count: { $sum: 1 } }
                }}
            ]).toArray(),
            
            // Удержание (Retention)
            {
                day1: await this.playersRetention(1),
                day7: await this.playersRetention(7),
                day30: await this.playersRetention(30)
            },
            
            // Часовая активность
            this.getHourlyActivity()
        ]);

        let message = `
👥 **SENTINEL: ECHO — АНАЛИТИКА ИГРОКОВ**
━━━━━━━━━━━━━━━━━━━━━
🕐 ${new Date().toLocaleString('ru-RU')}

📊 **РАСПРЕДЕЛЕНИЕ ПО УРОВНЯМ**
\`\`\`
`;

        levels.forEach(level => {
            const barLength = Math.round((level.count / levels[0].count) * 20);
            const bar = '█'.repeat(barLength);
            message += `Ур.${String(level._id).padEnd(3)} ${bar.padEnd(20)} ${level.count} чел.\n`;
        });

        message += '```\n';

        message += `
💀 **РАСПРЕДЕЛЕНИЕ ДУШИ**
\`\`\`
`;

        souls.forEach(soul => {
            const range = soul._id === '100+' ? '90-100' : `${soul._id}-${soul._id + 20}`;
            const barLength = Math.round((soul.count / levels[0].count) * 20);
            const bar = '█'.repeat(barLength);
            message += `${range.padEnd(8)} ${bar.padEnd(20)} ${soul.count} чел.\n`;
        });

        message += '```';

        message += `

📈 **УДЕРЖАНИЕ (RETENTION)**
┌ День 1:  ${retention.day1}%
├ День 7:  ${retention.day7}%
└ День 30: ${retention.day30}%

⏰ **ЧАСОВАЯ АКТИВНОСТЬ**
\`\`\`
`;

        for (let hour = 0; hour < 24; hour += 3) {
            const activity_hour = activity.find(a => a._id === hour)?.count || 0;
            const barLength = Math.round((activity_hour / Math.max(...activity.map(a => a.count))) * 20);
            const bar = '█'.repeat(barLength);
            message += `${String(hour).padStart(2)}:00 ${bar.padEnd(20)} ${activity_hour} игр.\n`;
        }

        message += '```';

        return message;
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========
    private async playersRetention(days: number): Promise<number> {
        const periodAgo = Date.now() - days * 24 * 60 * 60 * 1000;
        
        const [registered, active] = await Promise.all([
            this.db.players.countDocuments({ createdAt: { $lt: periodAgo } }),
            this.db.players.countDocuments({ 
                createdAt: { $lt: periodAgo },
                lastAction: { $gt: periodAgo }
            })
        ]);

        return registered > 0 ? Math.round((active / registered) * 100) : 0;
    }

    private async getHourlyActivity(): Promise<any[]> {
        const today = new Date().setHours(0, 0, 0, 0);
        
        return await this.db.players.aggregate([
            { $match: { lastAction: { $gt: today } } },
            { $project: {
                hour: { $hour: { $toDate: "$lastAction" } }
            }},
            { $group: {
                _id: "$hour",
                count: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
        ]).toArray();
    }

    // ========== ЭКСПОРТ В CSV ==========
    async exportToCSV(type: 'players' | 'donations' | 'souls'): Promise<string> {
        switch(type) {
            case 'players':
                const players = await this.db.players.find()
                    .limit(1000)
                    .toArray();
                
                let csv = 'ID,Username,Уровень,Звёзды,Душа,Взломов,PvP,Донат,Регистрация\n';
                players.forEach(p => {
                    csv += `${p.telegramId},${p.username || 'unknown'},${p.level},${p.stars},${p.soul?.current || 0},${p.stats?.hacksDone || 0},${p.stats?.pvpWins || 0},${p.stats?.totalDonated || 0},${new Date(p.createdAt).toLocaleDateString()}\n`;
                });
                return csv;
                
            case 'donations':
                // Аналогично для донатов
                return "Экспорт донатов...";
                
            case 'souls':
                // Аналогично для души
                return "Экспорт души...";
        }
    }

    // ========== ЗАПУСК АВТОМАТИЧЕСКИХ ОТЧЁТОВ ==========
    startAutoReports() {
        console.log('📊 Система автоматической аналитики запущена');
        
        // Ежедневный отчёт в 23:59
        setInterval(async () => {
            const now = new Date();
            if (now.getHours() === 23 && now.getMinutes() === 59) {
                const dashboard = await this.getMainDashboard();
                await this.bot.telegram.sendMessage(this.ADMIN_ID, dashboard, {
                    parse_mode: 'Markdown'
                });
                
                const revenue = await this.getRevenueReport();
                await this.bot.telegram.sendMessage(this.ADMIN_ID, revenue, {
                    parse_mode: 'Markdown'
                });
            }
        }, 60000);
        
        // Еженедельный отчёт (воскресенье, 23:59)
        setInterval(async () => {
            const now = new Date();
            if (now.getDay() === 0 && now.getHours() === 23 && now.getMinutes() === 59) {
                const charts = await this.getSalesCharts();
                await this.bot.telegram.sendMessage(this.ADMIN_ID, charts, {
                    parse_mode: 'Markdown'
                });
                
                const players = await this.getPlayerAnalytics();
                await this.bot.telegram.sendMessage(this.ADMIN_ID, players, {
                    parse_mode: 'Markdown'
                });
            }
        }, 60000);
        
        // Оповещения о крупных донатах
        this.bot.on('successful_payment', async (ctx) => {
            const amount = ctx.message.successful_payment.total_amount;
            if (amount >= 500) { // VIP-статус и выше
                await this.bot.telegram.sendMessage(
                    this.ADMIN_ID,
                    `🎉 **КРУПНЫЙ ДОНАТ!**\n\n` +
                    `💰 Сумма: ${amount} ⭐\n` +
                    `👤 Игрок: @${ctx.from.username || ctx.from.id}\n` +
                    `🆔 ID: ${ctx.from.id}\n` +
                    `📦 Товар: ${ctx.message.successful_payment.invoice_payload}`,
                    { parse_mode: 'Markdown' }
                );
            }
        });
    }
}

// ========== ЭКСПОРТ ==========
export function setupAnalytics(db: Database, bot: Telegraf): AnalyticsSystem {
    const analytics = new AnalyticsSystem(db, bot);
    
    // Регистрируем команды
    bot.command('analytics', async (ctx) => {
        if (ctx.from.id !== 438850682) return ctx.reply('❌ Только для администратора');
        const report = await analytics.getMainDashboard();
        await ctx.replyWithMarkdown(report);
    });
    
    bot.command('analytics_revenue', async (ctx) => {
        if (ctx.from.id !== 438850682) return ctx.reply('❌ Только для администратора');
        const report = await analytics.getRevenueReport();
        await ctx.replyWithMarkdown(report);
    });
    
    bot.command('analytics_charts', async (ctx) => {
        if (ctx.from.id !== 438850682) return ctx.reply('❌ Только для администратора');
        const charts = await analytics.getSalesCharts();
        await ctx.replyWithMarkdown(charts);
    });
    
    bot.command('analytics_players', async (ctx) => {
        if (ctx.from.id !== 438850682) return ctx.reply('❌ Только для администратора');
        const report = await analytics.getPlayerAnalytics();
        await ctx.replyWithMarkdown(report);
    });
    
    bot.command('export_players', async (ctx) => {
        if (ctx.from.id !== 438850682) return ctx.reply('❌ Только для администратора');
        const csv = await analytics.exportToCSV('players');
        await ctx.replyWithDocument({
            filename: 'players_export.csv',
            content: csv
        });
    });
    
    // Запускаем автоотчёты
    analytics.startAutoReports();
    
    return analytics;
}// ========== ПОДКЛЮЧЕНИЕ АНАЛИТИКИ ==========
private analytics: AnalyticsSystem;

// В конструкторе, после инициализации всех систем:
this.analytics = setupAnalytics(this.db, this.bot);
