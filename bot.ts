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
    }
});
