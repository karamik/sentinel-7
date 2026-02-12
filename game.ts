// ========== game.ts ==========
import { Database } from './database.ts';
import { CONFIG, IPlayer, IArtifact, ArtifactRarity } from './config.ts';
import { Random, Logger } from './utils.ts';

export class SentinelGame {
    constructor(private db: Database) {}

    // Регистрация нового игрока
    async registerPlayer(telegramId: number, username?: string, firstName?: string): Promise<{ player: IPlayer; isNew: boolean }> {
        try {
            const existing = await this.db.players.findOne({ telegramId });
            
            if (existing) {
                return { player: existing, isNew: false };
            }

            const now = Date.now();
            const player: IPlayer = {
                telegramId,
                username,
                firstName,
                stars: CONFIG.GAME.START_STARS,
                energy: CONFIG.GAME.START_ENERGY,
                maxEnergy: CONFIG.GAME.LEVELS[0].maxEnergy,
                level: 1,
                experience: 0,
                inventory: [],
                lastEnergyRegen: now,
                lastAction: now,
                pvp: {
                    rating: 0,
                    wins: 0,
                    losses: 0
                },
                soul: {
                    current: CONFIG.SOUL.MAX_SOUL,
                    max: CONFIG.SOUL.MAX_SOUL,
                    lastDecay: now,
                    history: [{
                        timestamp: now,
                        change: CONFIG.SOUL.MAX_SOUL,
                        reason: 'initialization',
                        newValue: CONFIG.SOUL.MAX_SOUL
                    }]
                },
                quests: {
                    list: [],
                    lastUpdate: now
                },
                achievements: [],
                stats: {
                    hacksDone: 0,
                    artifactsFound: 0,
                    raidsDone: 0,
                    pvpBattles: 0,
                    pvpWins: 0,
                    craftsDone: 0,
                    mythicCrafted: 0,
                    tradesDone: 0,
                    successfulHacks: 0,
                    failedHacks: 0,
                    referrals: 0,
                    resurrectionsGiven: 0,
                    twinContributions: 0
                },
                createdAt: now
            };

            await this.db.players.insertOne(player);
            Logger.info(`Новый игрок: ${telegramId} (${username || 'no username'})`);
            
            return { player, isNew: true };

        } catch (error) {
            Logger.error('Register player error', error);
            throw error;
        }
    }

    // Взлом системы
    async hack(telegramId: number): Promise<{
        success: boolean;
        message: string;
        artifact?: IArtifact;
        energyLeft?: number;
        soulLeft?: number;
        expGained?: number;
    }> {
        try {
            const player = await this.db.players.findOne({ telegramId });
            if (!player) {
                return { success: false, message: '❌ Сначала используйте /start' };
            }

            // Проверка энергии
            if (player.energy < CONFIG.GAME.HACK_COST) {
                return { 
                    success: false, 
                    message: `🔋 Недостаточно энергии! Нужно ${CONFIG.GAME.HACK_COST}⚡` 
                };
            }

            // Проверка кулдауна
            if (player.lastHackTime) {
                const timeLeft = CONFIG.GAME.HACK_COOLDOWN - (Date.now() - player.lastHackTime);
                if (timeLeft > 0) {
                    return { 
                        success: false, 
                        message: `⏳ Подождите ${Math.ceil(timeLeft / 1000)}с` 
                    };
                }
            }

            // Шанс успеха (базовый 70% + бонус за уровень)
            const baseChance = 0.7;
            const levelBonus = player.level * 0.01;
            const successChance = Math.min(baseChance + levelBonus, 0.95);
            
            const isSuccess = Math.random() < successChance;
            
            // Тратим энергию
            player.energy -= CONFIG.GAME.HACK_COST;
            player.lastHackTime = Date.now();
            player.lastAction = Date.now();

            let message = '';
            let artifact: IArtifact | undefined;
            let expGained = 0;

            if (isSuccess) {
                // Успешный взлом
                player.stats.successfulHacks++;
                expGained = Random.range(10, 20);
                
                // Шанс найти артефакт (40% + бонус)
                const artifactChance = 0.4 + (player.level * 0.01);
                if (Math.random() < artifactChance) {
                    artifact = await this.generateArtifact(telegramId);
                    player.inventory.push(artifact.id);
                    player.stats.artifactsFound++;
                    message = `✅ Взлом успешен! Найден артефакт!`;
                } else {
                    message = `✅ Взлом успешен! +${expGained} опыта`;
                }

                // Опыт и уровень
                player.experience += expGained;
                await this.checkLevelUp(player);
                
            } else {
                // Провал - теряем душу
                player.stats.failedHacks++;
                
                if (player.soul) {
                    const soulLoss = CONFIG.SOUL.HACK_FAIL_LOSS;
                    const oldSoul = player.soul.current;
                    player.soul.current = Math.max(0, player.soul.current - soulLoss);
                    
                    player.soul.history?.push({
                        timestamp: Date.now(),
                        change: -soulLoss,
                        reason: 'hack_failed',
                        newValue: player.soul.current
                    });

                    message = `❌ Взлом провален! Потеряно ${soulLoss}💀 души`;
                    
                    // Проверка смерти
                    if (player.soul.current === 0 && oldSoul > 0) {
                        message += '\n💀 Ваша душа истощена... Требуется воскрешение!';
                    }
                } else {
                    message = `❌ Взлом провален!`;
                }
            }

            // Сохраняем
            await this.db.players.updateOne(
                { telegramId },
                { 
                    $set: { 
                        energy: player.energy,
                        lastHackTime: player.lastHackTime,
                        lastAction: player.lastAction,
                        experience: player.experience,
                        level: player.level,
                        maxEnergy: player.maxEnergy,
                        soul: player.soul,
                        'stats.successfulHacks': player.stats.successfulHacks,
                        'stats.failedHacks': player.stats.failedHacks,
                        'stats.artifactsFound': player.stats.artifactsFound
                    },
                    $inc: { 'stats.hacksDone': 1 }
                }
            );

            return {
                success: true,
                message,
                artifact,
                energyLeft: player.energy,
                soulLeft: player.soul?.current,
                expGained
            };

        } catch (error) {
            Logger.error('Hack error', error);
            return { success: false, message: '❌ Ошибка при взломе' };
        }
    }

    // Генерация артефакта
    private async generateArtifact(telegramId: number): Promise<IArtifact> {
        const rand = Math.random();
        let rarity: ArtifactRarity = 'COMMON';
        let cumulative = 0;

        for (const [rar, data] of Object.entries(CONFIG.GAME.ARTIFACTS)) {
            cumulative += data.chance;
            if (rand < cumulative) {
                rarity = rar as ArtifactRarity;
                break;
            }
        }

        const names = {
            COMMON: ['Осколок', 'Чип', 'Модуль', 'Схема'],
            RARE: ['Кристалл', 'Ядро', 'Руна', 'Код'],
            EPIC: ['Скипетр', 'Артефакт', 'Реликвия', 'Талисман'],
            LEGENDARY: ['Наследие', 'Пророчество', 'Бездна', 'Возрождение'],
            MYTHIC: ['Божество', 'Создатель', 'Бесконечность', 'Абсолют']
        };

        const prefixes = ['Древний', 'Забытый', 'Проклятый', 'Благословенный', 'Изначальный'];
        const suffix = Random.arrayItem(names[rarity]);
        const name = Math.random() < 0.3 
            ? `${Random.arrayItem(prefixes)} ${suffix}`
            : suffix;

        const artifact: IArtifact = {
            id: this.db.generateId(),
            telegramId,
            name,
            rarity,
            value: CONFIG.GAME.ARTIFACTS[rarity].value,
            foundAt: Date.now(),
            equipped: false
        };

        await this.db.artifacts.insertOne(artifact);
        return artifact;
    }

    // Проверка повышения уровня
    private async checkLevelUp(player: IPlayer) {
        const currentLevelIndex = player.level - 1;
        const nextLevel = CONFIG.GAME.LEVELS[currentLevelIndex + 1];
        
        if (nextLevel && player.experience >= nextLevel.expNeeded) {
            player.level = nextLevel.level;
            player.maxEnergy = nextLevel.maxEnergy;
            player.energy = Math.min(player.energy + 50, player.maxEnergy);
            
            // Награда за уровень
            player.stars += player.level * 100;
            
            Logger.info(`Игрок ${player.telegramId} достиг уровня ${player.level}`);
        }
    }

    // Регенерация энергии
    async regenerateEnergy() {
        try {
            const now = Date.now();
            const players = await this.db.players.find({
                lastEnergyRegen: { $lt: now - CONFIG.GAME.ENERGY_REGEN_INTERVAL },
                energy: { $lt: '$maxEnergy' }
            }).toArray();

            for (const player of players) {
                const intervals = Math.floor(
                    (now - player.lastEnergyRegen) / CONFIG.GAME.ENERGY_REGEN_INTERVAL
                );
                
                if (intervals > 0) {
                    const regenAmount = intervals * CONFIG.GAME.ENERGY_REGEN;
                    player.energy = Math.min(
                        player.energy + regenAmount,
                        player.maxEnergy
                    );
                    player.lastEnergyRegen = now;

                    await this.db.players.updateOne(
                        { telegramId: player.telegramId },
                        {
                            $set: {
                                energy: player.energy,
                                lastEnergyRegen: player.lastEnergyRegen
                            }
                        }
                    );
                }
            }
        } catch (error) {
            Logger.error('Energy regeneration error', error);
        }
    }

    // Ежедневный распад души
    async dailySoulDecay() {
        try {
            const now = Date.now();
            const oneDayAgo = now - 24 * 60 * 60 * 1000;
            
            const players = await this.db.players.find({
                'soul.current': { $gt: 0 },
                'soul.lastDecay': { $lt: oneDayAgo }
            }).toArray();

            for (const player of players) {
                if (!player.soul) continue;

                const daysPassed = Math.floor(
                    (now - player.soul.lastDecay) / (24 * 60 * 60 * 1000)
                );

                if (daysPassed > 0) {
                    const loss = daysPassed * CONFIG.SOUL.IDLE_DAILY_LOSS;
                    const oldSoul = player.soul.current;
                    player.soul.current = Math.max(0, player.soul.current - loss);
                    player.soul.lastDecay = now;

                    player.soul.history?.push({
                        timestamp: now,
                        change: -loss,
                        reason: 'daily_decay',
                        newValue: player.soul.current
                    });

                    await this.db.players.updateOne(
                        { telegramId: player.telegramId },
                        {
                            $set: {
                                soul: player.soul
                            }
                        }
                    );

                    if (player.soul.current === 0 && oldSoul > 0) {
                        Logger.info(`Игрок ${player.telegramId} потерял душу (бездействие)`);
                    }
                }
            }
        } catch (error) {
            Logger.error('Soul decay error', error);
        }
    }

    // Получить профиль
    async getProfile(telegramId: number) {
        const player = await this.db.players.findOne({ telegramId });
        if (!player) return null;

        const nextLevel = CONFIG.GAME.LEVELS.find(l => l.level === player.level + 1);
        const expNeeded = nextLevel?.expNeeded || player.experience;
        const expCurrent = player.experience - (CONFIG.GAME.LEVELS[player.level - 1]?.expNeeded || 0);
        const expTotal = expNeeded - (CONFIG.GAME.LEVELS[player.level - 1]?.expNeeded || 0);

        const totalHacks = player.stats.successfulHacks + player.stats.failedHacks;
        const successRate = totalHacks > 0 
            ? Math.round((player.stats.successfulHacks / totalHacks) * 100) 
            : 0;

        return {
            stars: player.stars,
            energy: player.energy,
            maxEnergy: player.maxEnergy,
            level: player.level,
            experience: player.experience,
            nextLevelExp: expNeeded,
            expCurrent,
            expTotal,
            artifactsFound: player.stats.artifactsFound,
            hacksDone: player.stats.hacksDone,
            successRate,
            soul: player.soul?.current || 0,
            maxSoul: player.soul?.max || CONFIG.SOUL.MAX_SOUL
        };
    }
}
