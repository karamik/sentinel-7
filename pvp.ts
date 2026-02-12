// ========== pvp.ts ==========
import { Database } from './database.ts';
import { CONFIG, IPvPMatch, IPvPLogEntry, IPlayer } from './config.ts';
import { Logger, Random } from './utils.ts';

export class PvPArena {
    private matchmakingQueue: number[] = [];
    private activeMatches: Map<string, IPvPMatch> = new Map();

    constructor(private db: Database) {}

    // Вступление в очередь
    async joinQueue(telegramId: number) {
        try {
            const player = await this.db.players.findOne({ telegramId });
            if (!player) {
                return { success: false, message: '❌ Игрок не найден!' };
            }

            // Проверка души
            if (player.soul?.current === 0) {
                return { 
                    success: false, 
                    message: '💀 Ваша душа истощена! Воскреситесь через /resurrect' 
                };
            }

            // Проверка энергии
            if (player.energy < CONFIG.PVP.ENERGY_COST) {
                return { 
                    success: false, 
                    message: `🔋 Нужно ${CONFIG.PVP.ENERGY_COST}⚡ для боя` 
                };
            }

            // Добавляем в очередь
            if (!this.matchmakingQueue.includes(telegramId)) {
                this.matchmakingQueue.push(telegramId);
            }

            // Ищем соперника
            if (this.matchmakingQueue.length >= 2) {
                const player1 = this.matchmakingQueue.shift()!;
                const player2 = this.matchmakingQueue.shift()!;

                if (player1 === player2) {
                    this.matchmakingQueue.push(player1);
                    return { success: true, matchFound: false, message: '⏳ Поиск противника...' };
                }

                // Списываем энергию
                await this.db.players.updateOne(
                    { telegramId: player1 },
                    { $inc: { energy: -CONFIG.PVP.ENERGY_COST } }
                );
                await this.db.players.updateOne(
                    { telegramId: player2 },
                    { $inc: { energy: -CONFIG.PVP.ENERGY_COST } }
                );

                // Создаем матч
                const matchId = this.db.generateId();
                const match: IPvPMatch = {
                    id: matchId,
                    player1,
                    player2,
                    status: 'ACTIVE',
                    startTime: Date.now(),
                    turn: Random.range(0, 1) === 0 ? player1 : player2,
                    player1Health: 100,
                    player2Health: 100,
                    round: 1,
                    memoryStrikes: {
                        [player1]: 0,
                        [player2]: 0
                    },
                    logs: []
                };

                this.activeMatches.set(matchId, match);
                await this.db.pvpMatches.insertOne(match);

                return {
                    success: true,
                    matchFound: true,
                    matchId,
                    message: '⚔️ Противник найден! Бой начинается!'
                };
            }

            return {
                success: true,
                matchFound: false,
                message: '⏳ Поиск противника... Вы в очереди!'
            };

        } catch (error) {
            Logger.error('PvP join error', error);
            return { success: false, message: '❌ Ошибка поиска' };
        }
    }

    // Атака с Memory Strike
    async attack(telegramId: number, matchId: string) {
        try {
            const match = this.activeMatches.get(matchId);
            if (!match) {
                return { success: false, message: '❌ Бой не найден!' };
            }

            // Проверка хода
            if (match.turn !== telegramId) {
                return { success: false, message: '⏳ Сейчас не ваш ход!' };
            }

            // Проверка лимита раундов
            if (match.round >= CONFIG.BATTLE.MAX_ROUNDS) {
                return await this.endMatch(match, null, 'Ничья (лимит раундов)');
            }

            const isPlayer1 = match.player1 === telegramId;
            const attacker = isPlayer1 ? match.player1 : match.player2;
            const defender = isPlayer1 ? match.player2 : match.player1;

            // Расчет урона
            let damage = Random.range(10, 25);
            let isCrit = false;
            let isMemoryStrike = false;

            // Memory Strike - использует душу
            const player = await this.db.players.findOne({ telegramId: attacker });
            if (player?.soul && player.soul.current >= CONFIG.BATTLE.MEMORY_STRIKE_COST) {
                const memoryStrikeChance = 0.3;
                if (Math.random() < memoryStrikeChance) {
                    isMemoryStrike = true;
                    damage *= 1.5;
                    
                    // Тратим душу
                    player.soul.current -= CONFIG.BATTLE.MEMORY_STRIKE_COST;
                    player.soul.history?.push({
                        timestamp: Date.now(),
                        change: -CONFIG.BATTLE.MEMORY_STRIKE_COST,
                        reason: 'memory_strike',
                        newValue: player.soul.current
                    });
                    
                    await this.db.players.updateOne(
                        { telegramId: attacker },
                        { $set: { soul: player.soul } }
                    );
                    
                    match.memoryStrikes[attacker] = (match.memoryStrikes[attacker] || 0) + 1;
                }
            }

            // Крит
            isCrit = Math.random() < 0.2;
            if (isCrit) damage *= 2;

            // Наносим урон
            damage = Math.floor(damage);
            if (isPlayer1) {
                match.player2Health = Math.max(0, match.player2Health - damage);
            } else {
                match.player1Health = Math.max(0, match.player1Health - damage);
            }

            // Лог
            const logEntry: IPvPLogEntry = {
                attacker: telegramId,
                damage,
                isCrit,
                isMemoryStrike,
                timestamp: Date.now(),
                round: match.round,
                healthLeft: isPlayer1 ? match.player2Health : match.player1Health
            };
            match.logs.push(logEntry);

            // Проверка победы
            if (match.player1Health <= 0 || match.player2Health <= 0) {
                const winner = match.player1Health <= 0 ? match.player2 : match.player1;
                return await this.endMatch(match, winner);
            }

            // Смена хода
            match.turn = isPlayer1 ? match.player2 : match.player1;
            match.round++;

            // Обновляем матч
            this.activeMatches.set(matchId, match);
            await this.db.pvpMatches.updateOne(
                { id: matchId },
                {
                    $set: {
                        player1Health: match.player1Health,
                        player2Health: match.player2Health,
                        turn: match.turn,
                        round: match.round,
                        memoryStrikes: match.memoryStrikes,
                        logs: match.logs
                    }
                }
            );

            return {
                success: true,
                damage,
                isCrit,
                isMemoryStrike,
                yourHealth: isPlayer1 ? match.player1Health : match.player2Health,
                enemyHealth: isPlayer1 ? match.player2Health : match.player1Health,
                yourTurn: match.turn === telegramId,
                round: match.round,
                message: this.getAttackMessage(damage, isCrit, isMemoryStrike)
            };

        } catch (error) {
            Logger.error('PvP attack error', error);
            return { success: false, message: '❌ Ошибка атаки' };
        }
    }

    // Завершение матча
    private async endMatch(match: IPvPMatch, winnerId: number | null, reason?: string) {
        try {
            match.status = 'FINISHED';
            match.endTime = Date.now();
            match.winner = winnerId;

            if (winnerId) {
                const loserId = match.player1 === winnerId ? match.player2 : match.player1;

                // Победитель
                await this.db.players.updateOne(
                    { telegramId: winnerId },
                    {
                        $inc: {
                            stars: CONFIG.PVP.BASE_REWARD,
                            'pvp.wins': 1,
                            'pvp.rating': CONFIG.PVP.RATING_WIN,
                            'stats.pvpBattles': 1,
                            'stats.pvpWins': 1
                        },
                        $set: { lastPvpTime: Date.now() }
                    }
                );

                // Проигравший - теряет душу и рейтинг
                const loser = await this.db.players.findOne({ telegramId: loserId });
                if (loser?.soul) {
                    const soulLoss = CONFIG.SOUL.PVP_LOSS;
                    loser.soul.current = Math.max(0, loser.soul.current - soulLoss);
                    loser.soul.history?.push({
                        timestamp: Date.now(),
                        change: -soulLoss,
                        reason: 'pvp_loss',
                        newValue: loser.soul.current
                    });

                    await this.db.players.updateOne(
                        { telegramId: loserId },
                        {
                            $inc: {
                                'pvp.losses': 1,
                                'pvp.rating': -CONFIG.PVP.RATING_LOSS,
                                'stats.pvpBattles': 1
                            },
                            $set: {
                                soul: loser.soul,
                                lastPvpTime: Date.now()
                            }
                        }
                    );
                }
            }

            // Удаляем из активных
            this.activeMatches.delete(match.id);

            // Обновляем в БД
            await this.db.pvpMatches.updateOne(
                { id: match.id },
                {
                    $set: {
                        status: 'FINISHED',
                        winner: winnerId,
                        endTime: match.endTime
                    }
                }
            );

            const message = winnerId 
                ? `🏆 Победа! +${CONFIG.PVP.BASE_REWARD}⭐, +${CONFIG.PVP.RATING_WIN} рейтинга`
                : `🤝 Ничья! ${reason || ''}`;

            return {
                success: true,
                matchEnded: true,
                winner: winnerId,
                message
            };

        } catch (error) {
            Logger.error('End match error', error);
            return { success: false, message: '❌ Ошибка завершения' };
        }
    }

    private getAttackMessage(damage: number, isCrit: boolean, isMemoryStrike: boolean): string {
        if (isMemoryStrike && isCrit) return `💢💫 МЕГА УДАР! ${damage} урона!`;
        if (isMemoryStrike) return `💫 Memory Strike! ${damage} урона!`;
        if (isCrit) return `💢 КРИТ! ${damage} урона!`;
        return `💥 Урон: ${damage}`;
    }

    // Получить статистику
    async getPlayerStats(telegramId: number) {
        const player = await this.db.players.findOne({ telegramId });
        if (!player) return null;

        return {
            rating: player.pvp?.rating || 0,
            wins: player.pvp?.wins || 0,
            losses: player.pvp?.losses || 0,
            winRate: player.pvp?.wins && player.pvp?.losses
                ? Math.round((player.pvp.wins / (player.pvp.wins + player.pvp.losses)) * 100)
                : 0,
            soul: player.soul?.current || 0,
            memoryStrikes: await this.getTotalMemoryStrikes(telegramId)
        };
    }

    private async getTotalMemoryStrikes(telegramId: number): Promise<number> {
        const matches = await this.db.pvpMatches
            .find({
                $or: [{ player1: telegramId }, { player2: telegramId }],
                status: 'FINISHED'
            })
            .toArray();
        
        return matches.reduce((total, match) => {
            return total + (match.memoryStrikes?.[telegramId] || 0);
        }, 0);
    }

    async cleanupOldMatches() {
        const oneHourAgo = Date.now() - 3600000;
        for (const [id, match] of this.activeMatches) {
            if (match.startTime < oneHourAgo) {
                await this.endMatch(match, null, 'таймаут');
            }
        }
    }
}
