// ========== twins.ts ==========
import { Database } from './database.ts';
import { Logger } from './utils.ts';

export class TwinSystem {
  constructor(private db: Database) {}
  
  // При регистрации нового игрока
  async assignTwin(newPlayerId: number) {
    try {
      // 1. Найти игрока, у которого меньше всего "теней"
      const candidates = await this.db.players
        .find({ 
          telegramId: { $ne: newPlayerId },
          'stats.twinCount': { $lt: 3 } // Максимум 3 тени на человека
        })
        .sort({ 'stats.twinCount': 1 })
        .limit(5)
        .toArray();
      
      if (candidates.length === 0) {
        // Если нет подходящих - создаем "виртуального" оригинала
        await this.createVirtualTwin(newPlayerId);
        return;
      }
      
      // 2. Выбираем случайного из лучших
      const original = candidates[Math.floor(Math.random() * candidates.length)];
      
      // 3. Привязываем нового игрока как "тень"
      await this.db.players.updateOne(
        { telegramId: original.telegramId },
        { 
          $inc: { 'stats.twinCount': 1 },
          $push: { 
            twins: {
              id: newPlayerId,
              joinedAt: Date.now(),
              level: 1,
              contribution: 0
            }
          }
        }
      );
      
      // 4. Сохраняем информацию о "оригинале" для тени (НО БЕЗ ИМЕНИ И ID)
      await this.db.players.updateOne(
        { telegramId: newPlayerId },
        {
          $set: {
            'twin.original': {
              joinedAt: original.createdAt,
              level: original.level,
              stats: {
                hacksDone: original.stats?.hacksDone || 0,
                artifactsFound: original.stats?.artifactsFound || 0
              }
            },
            'twin.bondStrength': 0.1 // Начинаем с 10% связи
          }
        }
      );
      
      Logger.info(`🔮 Тень ${newPlayerId} привязана к оригиналу ${original.telegramId}`);
      
    } catch (error) {
      Logger.error('Twin assignment error', error);
    }
  }
  
  // Создать виртуального оригинала (если мало игроков)
  async createVirtualTwin(twinId: number) {
    const virtualOriginal = {
      joinedAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // 0-30 дней назад
      level: Math.floor(Math.random() * 5) + 5, // 5-10 уровень
      stats: {
        hacksDone: Math.floor(Math.random() * 500) + 100,
        artifactsFound: Math.floor(Math.random() * 100) + 20
      }
    };
    
    await this.db.players.updateOne(
      { telegramId: twinId },
      {
        $set: {
          'twin.original': virtualOriginal,
          'twin.bondStrength': 0.2,
          'twin.isVirtual': true
        }
      }
    );
  }
  
  // Когда тень делает взлом
  async onTwinHack(twinId: number, expGained: number) {
    const twin = await this.db.players.findOne({ telegramId: twinId });
    if (!twin?.twin?.original) return;
    
    // 5% опыта уходит оригиналу
    const expToOriginal = Math.floor(expGained * 0.05);
    
    // Ищем реального оригинала
    const original = await this.db.players.findOne({
      'twins.id': twinId
    });
    
    if (original) {
      await this.db.players.updateOne(
        { telegramId: original.telegramId },
        { $inc: { experience: expToOriginal } }
      );
    }
    
    // Увеличиваем силу связи
    await this.db.players.updateOne(
      { telegramId: twinId },
      { $inc: { 'twin.bondStrength': 0.001 } }
    );
  }
  
  // Когда оригинал делает взлом
  async onOriginalHack(originalId: number) {
    const original = await this.db.players.findOne({ telegramId: originalId });
    if (!original?.twins?.length) return;
    
    // 1% энергии каждой тени
    for (const twin of original.twins) {
      await this.db.players.updateOne(
        { telegramId: twin.id },
        { $inc: { energy: 1 } }
      );
    }
  }
  
  // Получить ощущение связи (для профиля)
  async getTwinFeeling(telegramId: number) {
    const player = await this.db.players.findOne({ telegramId });
    if (!player?.twin) return null;
    
    const strength = player.twin.bondStrength || 0;
    const original = player.twin.original;
    
    let feeling = '';
    if (strength < 0.1) feeling = '🔮 Ты чувствуешь чье-то далекое присутствие...';
    else if (strength < 0.3) feeling = '✨ Иногда ты ловишь чужие мысли. Они старые, но теплые.';
    else if (strength < 0.5) feeling = '💫 Ты знаешь, что кто-то гордится тобой. Ты не знаешь кто. Но это греет.';
    else if (strength < 0.7) feeling = '🌟 Вы смотрите на одни и те же звезды. В разное время. В разных местах.';
    else if (strength < 0.9) feeling = '⚡ Ты слышишь эхо его голоса. Он зовет тебя "Страж".';
    else feeling = '💞 Скоро вы встретитесь. Ты не знаешь как. Но знаешь что.';
    
    return {
      feeling,
      strength: Math.min(1, strength),
      originalLevel: original?.level,
      originalHacks: original?.stats.hacksDone,
      isVirtual: player.twin.isVirtual || false
    };
  }
}
