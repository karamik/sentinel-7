// ========== pvp.ts ==========
// SENTINEL: ECHO — PvP АРЕНА С ЛИГАМИ И ТУРНИРАМИ

import { Database } from './database.ts';
import { CONFIG, IPvPMatch, IPvPLogEntry, IPlayer } from './config.ts';
import { Logger, Random } from './utils.ts';

export class PvPArena {
    private matchmakingQueue: number[] = [];
    private activeMatches: Map<string, IPvPMatch> = new Map();

    constructor(private db: Database) {}

    // ========== НОВЫЙ МЕТОД: ПОЛУЧИТЬ ЛИГУ ПО РЕЙТИНГУ ==========
    getLeague(rating: number) {
        const league = CONFIG.PVP.LEAGUES.find(l => rating >= l.min && rating <= l.max);
        return league || CONFIG.PVP.LEAGUES[0]; // По умолчанию Бронза
    }

    // ========== НОВЫЙ МЕТОД: ПОЛУЧИТЬ ТИТУЛ ИГРОКА ==========
    async getPlayerTitle(telegramId: number): Promise<string> {
        const player = await this.db.players.findOne({ telegramId });
        if (!player?.pvp) return CONFIG.PVP.LEAGUES[0].title;
        
        const league = this.getLeague(player.pvp.rating);
        return league.title;
    }

    // ========== НОВЫЙ МЕТОД: ПОЛУЧИТЬ СТАТИСТИКУ ЛИГИ ==========
    async getLeagueStats(telegramId: number) {
        const player = await this.db.players.findOne({ telegramId });
        if (!player?.pvp) return null;

        const rating = player.pvp.rating;
        const currentLeague = this.getLeague(rating);
        
        // Находим следующую лигу
        const nextLeague = CONFIG.PVP.LEAGUES.find(l => l.min > currentLeague.max);
        
        // Считаем позицию в текущей лиге
        const allPlayers = await this.db.players
            .find({ 'pvp.rating': { $gte: currentLeague.min, $lte: currentLeague.max } })
            .sort({ 'pvp.rating': -1 })
            .toArray();
        
        const position = allPlayers.findIndex(p => p.telegramId === telegramId) + 1;
        
        // Рейтинг до повышения/понижения
        const toPromotion = nextLeague ? nextLeague.min - rating : 0;
        const toRelegation = rating - currentLeague.min + 1;

        return {
            currentLeague: currentLeague.name,
            currentTitle: currentLeague.title,
            currentIcon: currentLeague.icon,
            position,
            totalInLeague: allPlayers.length,
            toPromotion: toPromotion > 0 ? toPromotion : 0,
            toRelegation,
            nextLeagueName: nextLeague?.name || 'Высшая лига',
            seasonEndsIn: CONFIG.PVP.LEAGUE_SETTINGS.SEASON_DURATION - (Date.now() % CONFIG.PVP.LEAGUE_SETTINGS.SEASON_DURATION)
        };
    }

    // ========== НОВЫЙ МЕТОД: ПОЛУЧИТЬ ТОП ЛИГИ ==========
    async getLeagueTop(leagueName: string, limit: number = 10) {
        const league = CONFIG.PVP.LEAGUES.find(l => l.name === leagueName);
        if (!league) return [];

        return await this.db.players
            .find({ 'pvp.rating': { $gte: league.min, $lte: league.max } })
            .sort({ 'pvp.rating': -1 })
            .limit(limit)
            .project({ 
                telegramId: 1, 
                username: 1, 
                'pvp.rating': 1,
                'pvp.wins': 1,
                'pvp.losses': 1
            })
            .toArray();
    }

    // ========== НОВЫЙ МЕТОД: ЗАВЕРШЕНИЕ СЕЗОНА ==========
    async endSeason() {
        Logger.info('🏆 Завершение сезона PvP лиг...');
        
        for (const league of CONFIG.PVP.LEAGUES) {
            // Получаем всех игроков лиги
            const players = await this.db.players
                .find({ 'pvp.rating': { $gte: league.min, $lte: league.max } })
                .sort({ 'pvp.rating': -1 })
                .toArray();

            // Повышение топ-3
            for (let i = 0; i < Math.min(CONFIG.PVP.LEAGUE_SETTINGS.PROMOTION_COUNT, players.length); i++) {
                const player = players[i];
                await this.db.players.updateOne(
                    { telegramId: player.telegramId },
                    { $inc: { stars: league.reward } }
                );
                
                // Отправляем уведомление (через бота)
                Logger.info(`🏆 Игрок ${player.username} получил ${league.reward}⭐ за ${league.name} лигу`);
            }

            // Понижение последних 3
            for (let i = players.length - 1; i >= Math.max(0, players.length - CONFIG.PVP.LEAGUE_SETTINGS.RELEGATION_COUNT); i--) {
                const player = players[i];
                // Здесь можно добавить логику понижения
            }
        }
    }

    // ========== ВСТУПЛЕНИЕ В ОЧЕРЕДЬ (ОБНОВЛЕНО) ==========
    async joinQueue(telegramId: number) {
        try {
            const player = await this.db.players.findOne({ telegramId });
            if (!player) {
                return { success: false, message: '❌ Игрок не найден!' };
            }

            if (player.soul?.current === 0) {
                return { 
                    success: false, 
                    message: '💀 Ваша душа истощена! Воскреситесь через /resurrect' 
                };
            }

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

            // Ищем соперника с учётом лиг
            if (this.matchmakingQueue.length >= 2) {
                const player1 = this.matchmakingQueue.shift()!;
                const player2 = this.matchmakingQueue.shift()!;

                if (player1 === player2) {
                    this.matchmakingQueue.push(player1);
                    return { success: true, matchFound: false, message: '⏳ Поиск противника...' };
                }

                // Получаем рейтинг и лиги игроков
                const p1 = await this.db.players.findOne({ telegramId: player1 });
                const p2 = await this.db.players.findOne({ telegramId: player2 });
                
                const rating1 = p1?.pvp?.rating || 0;
                const rating2 = p2?.pvp?.rating || 0;
                
                const league1 = this.getLeague(rating1);
                const league2 = this.getLeague(rating2);

                // Проверяем, подходят ли игроки друг другу
                const ratingDiff = Math.abs(rating1 - rating2);
                if (ratingDiff > CONFIG.PVP.LEAGUE_SETTINGS.RATING_RANGE && league1.name !== league2.name) {
                    // Если слишком большая разница, возвращаем в очередь
                    this.matchmakingQueue.push(player1);
                    this.matchmakingQueue.push(player2);
                    return { success: true, matchFound: false, message: '⏳ Поиск подходящего соперника...' };
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
                    message: `⚔️ Противник найден!\n📊 ${league1.icon} ${league1.name} vs ${league2.icon} ${league2.name}`
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

    // ========== АТАКА (ОБНОВЛЕНО) ==========
    async attack(telegramId: number, matchId: string) {
        try {
            const match = this.activeMatches.get(matchId);
            if (!match) {
                return { success: false, message: '❌ Бой не найден!' };
            }

            if (match.turn !== telegramId) {
                return { success: false, message: '⏳ Сейчас не ваш ход!' };
            }

            if (match.round >= CONFIG.BATTLE.MAX_ROUNDS) {
                return await this.endMatch(match, null, 'Ничья (лимит раундов)');
            }

            const isPlayer1 = match.player1 === telegramId;
            const attacker = isPlayer1 ? match.player1 : match.player2;
            const defender = isPlayer1 ? match.player2 : match.player1;

            // Расчет урона
            let damage = Random.range(CONFIG.PVP.MIN_DAMAGE, CONFIG.PVP.MAX_DAMAGE);
            let isCrit = false;
            let isMemoryStrike = false;

            // Memory Strike
            const player = await this.db.players.findOne({ telegramId: attacker });
            if (player?.soul && player.soul.current >= CONFIG.BATTLE.MEMORY_STRIKE_COST) {
                const memoryStrikeChance = 0.3;
                if (Math.random() < memoryStrikeChance) {
                    isMemoryStrike = true;
                    damage *= 1.5;
                    
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
            isCrit = Math.random() < CONFIG.PVP.CRIT_CHANCE;
            if (isCrit) damage *= CONFIG.PVP.CRIT_MULTIPLIER;

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

    // ========== ЗАВЕРШЕНИЕ МАТЧА (ОБНОВЛЕНО С УЧЁТОМ ЛИГ) ==========
    private async endMatch(match: IPvPMatch, winnerId: number | null, reason?: string) {
        try {
            match.status = 'FINISHED';
            match.endTime = Date.now();
            match.winner = winnerId;

            if (winnerId) {
                const loserId = match.player1 === winnerId ? match.player2 : match.player1;

                // Получаем текущие рейтинги
                const winner = await this.db.players.findOne({ telegramId: winnerId });
                const loser = await this.db.players.findOne({ telegramId: loserId });
                
                const winnerRating = winner?.pvp?.rating || 0;
                const loserRating = loser?.pvp?.rating || 0;
                
                const leagueWinner = this.getLeague(winnerRating);
                const leagueLoser = this.getLeague(loserRating);

                // Расчет рейтинга с учётом разницы лиг
                let ratingChange = CONFIG.PVP.RATING_WIN;
                if (leagueWinner.name !== leagueLoser.name) {
                    // Бонус за победу над игроком из высшей лиги
                    ratingChange += 10;
                }

                // Победитель
                await this.db.players.updateOne(
                    { telegramId: winnerId },
                    {
                        $inc: {
                            stars: CONFIG.PVP.BASE_REWARD,
                            'pvp.wins': 1,
                            'pvp.rating': ratingChange,
                            'stats.pvpBattles': 1,
                            'stats.pvpWins': 1
                        },
                        $set: { lastPvpTime: Date.now() }
                    }
                );

                // Проигравший - теряет душу и рейтинг
                const loser_player = await this.db.players.findOne({ telegramId: loserId });
                if (loser_player?.soul) {
                    const soulLoss = CONFIG.SOUL.PVP_LOSS;
                    loser_player.soul.current = Math.max(0, loser_player.soul.current - soulLoss);
                    loser_player.soul.history?.push({
                        timestamp: Date.now(),
                        change: -soulLoss,
                        reason: 'pvp_loss',
                        newValue: loser_player.soul.current
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
                                soul: loser_player.soul,
                                lastPvpTime: Date.now()
                            }
                        }
                    );
                }
            }

            this.activeMatches.delete(match.id);
            
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

    // ========== ПОЛУЧИТЬ СТАТИСТИКУ (ОБНОВЛЕНО) ==========
    async getPlayerStats(telegramId: number) {
        const player = await this.db.players.findOne({ telegramId });
        if (!player) return null;

        const rating = player.pvp?.rating || 0;
        const league = this.getLeague(rating);

        return {
            rating,
            wins: player.pvp?.wins || 0,
            losses: player.pvp?.losses || 0,
            winRate: player.pvp?.wins && player.pvp?.losses
                ? Math.round((player.pvp.wins / (player.pvp.wins + player.pvp.losses)) * 100)
                : 0,
            soul: player.soul?.current || 0,
            memoryStrikes: await this.getTotalMemoryStrikes(telegramId),
            league: league.name,
            leagueIcon: league.icon,
            leagueTitle: league.title
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
