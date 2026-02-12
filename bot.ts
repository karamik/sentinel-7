bot.command('hack', async (ctx) => {
  const player = await db.players.findOne({ telegramId: ctx.from.id });
  if (!player) return ctx.reply('❌ Сначала /start');
  
  // Проверка энергии
  if (player.energy < CONFIG.GAME.HACK_COST) {
    return ctx.reply(`🔋 Недостаточно энергии! Нужно ${CONFIG.GAME.HACK_COST}⚡`);
  }
  
  // Отправляем WebApp
  await ctx.replyWithWebApp(
    '🔐 ЗАПУСК ПРОТОКОЛА ВЗЛОМА',
    { url: 'https://твой-сайт.com/hack.html' } // Сюда свой URL
  );
});

// Обработка результата
bot.on('web_app_data', async (ctx) => {
  const data = JSON.parse(ctx.webAppData.data);
  const telegramId = ctx.from.id;
  
  if (data.success) {
    // Множитель награды за сложность
    const rewardMultiplier = {
      easy: 1,
      medium: 3,
      hard: 6
    }[data.difficulty] || 1;
    
    // Генерируем артефакт с повышенным шансом
    const artifact = await game.generateArtifact(telegramId, rewardMultiplier);
    
    await ctx.replyWithMarkdown(
      `✅ **ВЗЛОМ УСПЕШЕН!**\n\n` +
      `Уровень сложности: ${data.difficulty.toUpperCase()}\n` +
      `🎁 Множитель награды: x${rewardMultiplier}\n\n` +
      `🔮 **Найден артефакт:**\n` +
      `**${artifact.loreName || artifact.name}**\n` +
      `💰 Ценность: ${artifact.value * rewardMultiplier}⭐`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📖 История артефакта', callback_data: `story_${artifact.id}` }
          ]]
        }
      }
    );
  } else {
    // Неудача - частичный возврат энергии
    await db.players.updateOne(
      { telegramId },
      { $inc: { energy: 5 } }
    );
    
    await ctx.reply(
      `❌ **ВЗЛОМ НЕУДАЧЕН**\n\n` +
      `Система распознала атаку.\n` +
      `⚡ Возвращено 5 энергии.\n` +
      `🔄 Попробуй другую последовательность.`
    );
  }
});
