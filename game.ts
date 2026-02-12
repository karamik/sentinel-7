// В методе generateArtifact, после создания:
if (rarity === 'MYTHIC') {
  const story = ArtifactStories.MYTHIC[
    Math.floor(Math.random() * ArtifactStories.MYTHIC.length)
  ];
  
  artifact.story = story.story;
  artifact.loreName = story.name;
  
  // Отправляем игроку отдельным сообщением
  await ctx.replyWithMarkdown(
    `📜 **ТЫ НАШЕЛ НЕ ПРОСТО АРТЕФАКТ.**\n\n${story.story}`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🤝 Освободить сознание', callback_data: `free_${artifact.id}` },
          { text: '💎 Оставить себе', callback_data: `keep_${artifact.id}` }
        ]]
      }
    }
  );
}
