// ========== soul.ts ==========
import { Database } from './database.ts';
import { Logger } from './utils.ts';
import { CONFIG } from './config.ts';

export class SoulSystem {
  constructor(private db: Database) {}

  async initSoul(telegramId: number) {
    await this.db.players.updateOne(
      { telegramId },
      {
        $set: {
          soul: {
            current: CONFIG.SOUL.MAX_SOUL,
            max: CONFIG.SOUL.MAX_SOUL,
            lastDecay: Date.now(),
            resurrectedBy: null,
            lastResurrection: null
          }
        }
      }
    );
  }

  async getSoul(telegramId: number) {
    const player = await this.db.players.findOne({ telegramId });
    if (!player?.soul) return null;

    await this.applyIdleDecay(telegramId, player);

    return {
      current: player.soul.current,
      max: player.soul.max,
      percentage: Math.round((player.soul.current / player.soul.max) * 100),
      isCritical: player.soul.current < 30,
      isDead: player.soul.current <= 0
    };
  }

  async loseSoul(telegramId: number, amount: number, reason: string) {
    const player = await this.db.players.findOne({ telegramId });
    if (!player?.soul) return;

    const newSoulValue = Math.max(0, player.soul.current - amount);
    const isDead = newSoulValue <= 0;

    await this.db.players.updateOne(
      { telegramId },
      {
        $set: {
          'soul.current': newSoulValue,
          'soul.lastDecay': Date.now()
        },
        $push: {
          'soul.history': {
            timestamp: Date.now(),
            change: -amount,
            reason,
            newValue: newSoulValue
          }
        }
      }
    );

    if (isDead) {
      await this.onDeath(telegramId);
    }

    return {
      lost: amount,
      remaining: newSoulValue,
      isDead
    };
  }

  async restoreSoul(telegramId: number, amount: number, reason: string) {
    const player = await this.db.players.findOne({ telegramId });
    if (!player?.soul) return;

    const newSoulValue = Math.min(
      player.soul.max,
      player.soul.current + amount
    );

    await this.db.players.updateOne(
      { telegramId },
      {
        $set: { 'soul.current': newSoulValue },
        $push: {
          'soul.history': {
            timestamp: Date.now(),
            change: amount,
            reason,
            newValue: newSoulValue
          }
        }
      }
    );

    return {
      restored: amount,
      current: newSoulValue
    };
  }

  private async onDeath(telegramId: number) {
    const player = await this.db.players.findOne({ telegramId });
    if (!player) return;

    Logger.warn(`💀 Страж ${telegramId} пал в забвение`);

    const twin = await this.db.players.findOne({
      'twins.id': telegramId
    });

    if (twin) {
      await this.sendResurrectionRequest(twin.telegramId, telegramId);
    } else {
      await this.permanentDeath(telegramId);
    }
  }

  private async sendResurrectionRequest(twinId: number, deadId: number) {
    const dead = await this.db.players.findOne({ telegramId: deadId });
    
    await this.db.players.updateOne(
      { telegramId: twinId },
      {
        $push: {
          resurrectionRequests: {
            from: deadId,
            username: dead?.username || 'Неизвестный Страж',
            sentAt: Date.now(),
            expiresAt: Date.now() + 86400000
          }
        }
      }
    );

    Logger.info(`🕯️ Запрос на воскрешение отправлен близнецу ${twinId}`);
  }

  async resurrect(telegramId: number, deadId: number) {
    const twin = await this.db.players.findOne({ telegramId });
    const dead = await this.db.players.findOne({ telegramId: deadId });

    if (!twin?.soul || !dead?.soul) {
      return { success: false, message: '❌ Страж не найден' };
    }

    if (twin.soul.lastResurrection) {
      const timeSince = Date.now() - twin.soul.lastResurrection;
      if (timeSince < CONFIG.SOUL.RESURRECTION_COOLDOWN) {
        const daysLeft = Math.ceil(
          (CONFIG.SOUL.RESURRECTION_COOLDOWN - timeSince) / 86400000
        );
        return {
          success: false,
          message: `⏳ Ты можешь воскрешать раз в 7 дней. Осталось ${daysLeft} дн.`
        };
      }
    }

    if (twin.soul.current < CONFIG.SOUL.RESURRECTION_COST) {
      return {
        success: false,
        message: `❌ Недостаточно души. Нужно ${CONFIG.SOUL.RESURRECTION_COST}%`
      };
    }

    await this.loseSoul(
      telegramId,
      CONFIG.SOUL.RESURRECTION_COST,
      'resurrection_sacrifice'
    );

    await this.db.players.updateOne(
      { telegramId: deadId },
      {
        $set: {
          'soul.current': CONFIG.SOUL.MAX_SOUL * 0.5,
          'soul.resurrectedBy': telegramId,
          'soul.lastResurrection': Date.now()
        }
      }
    );

    await this.db.players.updateOne(
      { telegramId },
      {
        $set: { 'soul.lastResurrection': Date.now() },
        $inc: { 'stats.resurrectionsGiven': 1 }
      }
    );

    Logger.success(`✨ Близнец ${telegramId} воскресил ${deadId}`);

    return {
      success: true,
      message: `✨ **Ты пожертвовал частью души и воскресил своего близнеца!**\n\n` +
        `Твоя душа: ${twin.soul.current - CONFIG.SOUL.RESURRECTION_COST}%\n` +
        `Его душа: 50%\n\n` +
        `Связь стала сильнее.`
    };
  }

  private async applyIdleDecay(telegramId: number, player: any) {
    if (!player.soul?.lastDecay) return;

    const now = Date.now();
    const daysPassed = Math.floor(
      (now - player.soul.lastDecay) / 86400000
    );

    if (daysPassed > 0) {
      const totalLoss = daysPassed * CONFIG.SOUL.IDLE_DAILY_LOSS;
      await this.loseSoul(telegramId, totalLoss, 'idle_decay');
    }
  }

  private async permanentDeath(telegramId: number) {
    const player = await this.db.players.findOne({ telegramId });
    if (!player) return;

    await this.db.hallOfFame.insertOne({
      username: player.username,
      level: player.level,
      artifactsFound: player.stats?.artifactsFound || 0,
      diedAt: Date.now(),
      resurrected: false
    });

    await this.db.players.updateOne(
      { telegramId },
      {
        $set: {
          level: 1,
          experience: 0,
          stars: CONFIG.GAME.START_STARS,
          soul: {
            current: CONFIG.SOUL.MAX_SOUL,
            max: CONFIG.SOUL.MAX_SOUL,
            lastDecay: Date.now()
          },
          inventory: []
        }
      }
    );

    Logger.warn(`🔄 Страж ${telegramId} переродился`);
  }
}
