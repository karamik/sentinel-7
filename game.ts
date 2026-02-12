// ========== game.ts ==========
import { Database } from './database.ts';
import { 
    CONFIG, 
    IPlayer, 
    IArtifact, 
    ArtifactRarity 
} from './config.ts';
import { Random, Logger } from './utils.ts';
import { TwinSystem } from './twins.ts';
import { SoulSystem } from './soul.ts';
import { ArtifactStories, WELCOME_LORE } from './lore.ts';

export class SentinelGame {
    constructor(private db: Database) {}
    
    // Регистрация игрока
    async registerPlayer(
        telegramId: number, 
        username: string, 
        firstName?: string
    ): Promise<{ success: boolean; isNew: boolean; message: string }> {
        try {
            const existing = await this.db.players.findOne({ telegramId });
            
            if (existing) {
                return {
                    success: true,
                    isNew: false,
                    message: 'С возвращением!'
                };
            }
            
            const newPlayer: IPlayer = {
                telegramId,
                username,
                firstName,
                stars: CONFIG.GAME.START_STARS,
                energy: CONFIG.GAME.START_ENERGY,
                maxEnergy: CONFIG.GAME.MAX_ENERGY,
                level: 1,
                experience: 0,
                inventory: [],
                lastEnergyRegen: Date.now(),
                pvp: {
                    rating: 0,
                    wins: 0,
                    losses: 0
                },
                quests: {
                    list: [],
                    lastUpdate: 0
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
                    referrals: 0
                },
                createdAt: Date.now()
            };
            
            await this.db.players.insertOne(newPlayer);
            
            // Инициализация души
            const soulSystem = new SoulSystem(this.db);
            await soulSystem.initSoul(telegramId);
            
            // Добавляем систему близнецов
            const twinSystem = new TwinSystem(this.db);
            await twinSystem.assignTwin(telegramId);
            
            Logger.success(`Новый игрок зарегистрирован: ${username} (${telegramId})`);
            
            return {
                success: true,
                isNew: true,
                message: WELCOME_LORE + '\n\n✅ **Игрок успешно зарегистрирован!**\n\n🔮 **Ты не один.**\nГде-то в сети есть тот, чей цифровой след породил тебя.\nТы его тень. Он тебя не знает. Но чувствует.'
            };
            
        } catch (error) {
            Logger.error('Register player error', error);
            return {
                success: false,
                isNew: false,
                message: '❌ Ошибка при регистрации'
            };
        }
    }
    
    // Взлом системы
    async hack(telegramId: number): Promise<{
        success: boolean;
        message: string;
        artifact?: IArtifact;
        energyLeft?: number;
        experience?: number;
    }> {
        try {
            const player = await this.db.players.findOne({ telegramId });
            if (!player) {
                return { success: false, message: '❌ Игрок не найден!' };
            }
            
            // Регенерация энергии
            await this.regenerateEnergy(player);
            
            // Проверка энергии
            if (player.energy < CONFIG.GAME.HACK_COST) {
                return {
                    success: false,
                    message: `🔋 Недостаточно энергии! Нужно ${CONFIG.GAME.HACK_COST}⚡`
                };
            }
            
            // Проверка кулдауна
            const lastHack = player.lastHackTime || 0;
            if (Date.now() - lastHack < CONFIG.GAME.HACK_COOLDOWN) {
                const wait = Math.ceil((CONFIG.GAME.HACK_COOLDOWN - (Date.now() - lastHack)) / 1000);
                return {
                    success: false,
                    message: `⏳ Подождите ${wait}с перед следующим взломом!`
                };
            }
            
            // Снимаем энергию
            player.energy -= CONFIG.GAME.HACK_COST;
            
            // Шанс успеха (70-90% в зависимости от уровня)
            const successChance = 0.7 + (player.level * 0.02);
            const isSuccess = Math.random() < successChance;
            
            let artifact: IArtifact | undefined;
            let experience = 10;
            let message = '';
            
            if (isSuccess) {
                // Генерируем артефакт
                artifact = await this.generateArtifact(telegramId);
                experience = 20 + (artifact.value / 10);
                
                // Добавляем историю для мифических артефактов
                if (artifact.rarity === 'MYTHIC') {
                    const story = ArtifactStories.MYTHIC[
                        Math.floor(Math.random() * ArtifactStories.MYTHIC.length)
                    ];
                    artifact.story = story.story;
                    artifact.loreName = story.name;
                }
                
                // Добавляем в инвентарь
                await this.db.players.updateOne(
                    { telegramId },
                    {
                        $push: { inventory: artifact.id },
                        $inc: {
                            experience,
                            'stats.hacksDone': 1,
                            'stats.successfulHacks': 1,
                            'stats.artifactsFound': 1
                        },
                        $set: {
                            energy: player.energy,
                            lastHackTime: Date.now(),
                            lastAction: Date.now()
                        }
                    }
                );
                
                message = '✅ **ВЗЛОМ УСПЕШЕН!**';
            } else {
                // Неудача - потеря души
                const soulSystem = new SoulSystem(this.db);
                await soulSystem.loseSoul(telegramId, CONFIG.SOUL.HACK_FAIL_LOSS, 'hack_failed');
                
                await this.db.players.updateOne(
                    { telegramId },
                    {
                        $inc: {
                            experience: 5,
                            'stats.hacksDone': 1,
                            'stats.failedHacks': 1
                        },
                        $set: {
                            energy: player.energy,
                            lastHackTime: Date.now(),
                            lastAction: Date.now()
                        }
                    }
                );
                
                message = '❌ **ВЗЛОМ НЕУДАЧЕН!** Система защищена.\n💀 Душа -2%';
                experience = 5;
            }
            
            // Передаем опыт близнецу
            const twinSystem = new TwinSystem(this.db);
            await twinSystem.onTwinHack(telegramId, experience);
            
            // Проверка повышения уровня
            await this.checkLevelUp(telegramId, player.experience + experience);
            
            return {
                success: true,
                message,
                artifact,
                energyLeft: player.energy,
                experience
            };
            
        } catch (error) {
            Logger.error('Hack error', error);
            return {
                success: false,
                message: '❌ Ошибка при взломе'
            };
        }
    }
    
    // Генерация артефакта
    private async generateArtifact(telegramId: number): Promise<IArtifact> {
        const rand = Math.random();
        let rarity: ArtifactRarity;
        
        if (rand < CONFIG.GAME.ARTIFACTS.MYTHIC.chance) {
            rarity = 'MYTHIC';
        } else if (rand < CONFIG.GAME.ARTIFACTS.MYTHIC.chance + CONFIG.GAME.ARTIFACTS.LEGENDARY.chance) {
            rarity = 'LEGENDARY';
        } else if (rand < CONFIG.GAME.ARTIFACTS.MYTHIC.chance + CONFIG.GAME.ARTIFACTS.LEGENDARY.chance + CONFIG.GAME.ARTIFACTS.EPIC.chance) {
            rarity = 'EPIC';
        } else if (rand < CONFIG.GAME.ARTIFACTS.MYTHIC.chance + CONFIG.GAME.ARTIFACTS.LEGENDARY.chance + CONFIG.GAME.ARTIFACTS.EPIC.chance + CONFIG.GAME.ARTIFACTS.RARE.chance) {
            rarity = 'RARE';
        } else {
            rarity = 'COMMON';
        }
        
        const baseValue = CONFIG.GAME.ARTIFACTS[rarity].value;
        const variance = baseValue * 0.2;
        const value = Math.floor(baseValue + (Math.random() * variance * 2) - variance);
        
        const artifact: IArtifact = {
            id: this.db.generateId(),
            telegramId,
            name: Random.artifactName(),
            rarity,
            value,
            foundAt: Date.now()
        };
        
        await this.db.artifacts.insertOne(artifact);
        
        return artifact;
    }
    
    // Регенерация энергии
    private async regenerateEnergy(player: IPlayer): Promise<void> {
        const now = Date.now();
        const lastRegen = player.lastEnergyRegen || now;
        const timePassed = now - lastRegen;
        
        if (timePassed < CONFIG.GAME.ENERGY_REGEN_INTERVAL) {
            return;
        }
        
        const intervalsPasssed = Math.floor(timePassed / CONFIG.GAME.ENERGY_REGEN_INTERVAL);
        const energyToAdd = intervalsPasssed * CONFIG.GAME.ENERGY_REGEN;
        
        if (energyToAdd > 0) {
            const newEnergy = Math.min(player.maxEnergy, player.energy + energyToAdd);
            
            await this.db.players.updateOne(
                { telegramId: player.telegramId },
                {
                    $set: {
                        energy: newEnergy,
                        lastEnergyRegen: now
                    }
                }
            );
            
            player.energy = newEnergy;
            player.lastEnergyRegen = now;
        }
    }
    
    // Проверка повышения уровня
    private async checkLevelUp(telegramId: number, totalExperience: number): Promise<void> {
        const player = await this.db.players.findOne({ telegramId });
        if (!player) return;
        
        const currentLevel = player.level;
        let newLevel = currentLevel;
        
        for (const levelData of CONFIG.GAME.LEVELS) {
            if (totalExperience >= levelData.expNeeded) {
                newLevel = levelData.level;
            } else {
                break;
            }
        }
        
        if (newLevel > currentLevel) {
            const levelData = CONFIG.GAME.LEVELS.find(l => l.level === newLevel);
            
            await this.db.players.updateOne(
                { telegramId },
                {
                    $set: {
                        level: newLevel,
                        maxEnergy: levelData?.maxEnergy || player.maxEnergy
                    }
                }
            );
            
            Logger.info(`Игрок ${player.username} повысил уровень до ${newLevel}`);
        }
    }
    
    // Получить профиль игрока
    async getProfile(telegramId: number) {
        try {
            const player = await this.db.players.findOne({ telegramId });
            if (!player) return null;
            
            await this.regenerateEnergy(player);
            
            const currentLevel = player.level;
            const nextLevelData = CONFIG.GAME.LEVELS.find(l => l.level === currentLevel + 1);
            const nextLevelExp = nextLevelData?.expNeeded || player.experience;
            
            const totalHacks = (player.stats?.successfulHacks || 0) + (player.stats?.failedHacks || 0);
            const successRate = totalHacks > 0 
                ? Math.round(((player.stats?.successfulHacks || 0) / totalHacks) * 100) 
                : 0;
            
            // Получаем состояние души
            const soulSystem = new SoulSystem(this.db);
            const soul = await soulSystem.getSoul(telegramId);
            
            // Получаем ощущение связи с близнецом
            const twinFeeling = await new TwinSystem(this.db).getTwinFeeling(telegramId);
            
            return {
                username: player.username,
                stars: player.stars,
                energy: player.energy,
                maxEnergy: player.maxEnergy,
                level: player.level,
                experience: player.experience,
                nextLevelExp,
                hacksDone: player.stats?.hacksDone || 0,
                artifactsFound: player.stats?.artifactsFound || 0,
                successRate,
                guildId: player.guildId,
                pvpRating: player.pvp?.rating || 0,
                soulPercentage: soul?.percentage || 100,
                soulState: soul?.isDead ? '💀' : soul?.isCritical ? '🔥' : '💚',
                twinFeeling: twinFeeling?.feeling || null,
                twinBond: twinFeeling?.strength || 0
            };
            
        } catch (error) {
            Logger.error('Get profile error', error);
            return null;
        }
    }

    // ========== МЕТОДЫ БИТВ ==========

    // PvP Битва Воспоминаний
    async startMemoryBattle(player1Id: number, player2Id: number) {
        try {
            const player1 = await this.db.players.findOne({ telegramId: player1Id });
            const player2 = await this.db.players.findOne({ telegramId: player2Id });

            if (!player1 || !player2) {
                return { success: false, message: '❌ Игрок не найден' };
            }

            // Проверка энергии
            if (player1.energy < CONFIG.PVP.ENERGY_COST || player2.energy < CONFIG.PVP.ENERGY_COST) {
                return { success: false, message: '❌ Недостаточно энергии' };
            }

            // Создаем битву
            const battleId = this.db.generateId();
            const battle = {
                id: battleId,
                player1: {
                    id: player1Id,
                    username: player1.username,
                    soul: player1.soul?.current || 100,
                    hp: 100,
                    memory: await this.getRandomArtifact(player1Id)
                },
                player2: {
                    id: player2Id,
                    username: player2.username,
                    soul: player2.soul?.current || 100,
                    hp: 100,
                    memory: await this.getRandomArtifact(player2Id)
                },
                currentTurn: player1Id,
                round: 1,
                status: 'active',
                createdAt: Date.now(),
                lastAction: Date.now()
            };

            // Сохраняем битву
            await this.db.battles.insertOne(battle);

            // Снимаем энергию
            await this.db.players.updateMany(
                { telegramId: { $in: [player1Id, player2Id] } },
                { $inc: { energy: -CONFIG.PVP.ENERGY_COST } }
            );

            return {
                success: true,
                battleId,
                message: `⚔️ **БИТВА ВОСПОМИНАНИЙ НАЧАЛАСЬ!**\n\n` +
                    `${player1.username} VS ${player2.username}\n\n` +
                    `🎮 Ход игрока: ${battle.currentTurn === player1Id ? player1.username : player2.username}\n\n` +
                    `📖 **Воспоминание:**\n` +
                    `"${battle[battle.currentTurn === player1Id ? 'player1' : 'player2'].memory.name}"\n` +
                    `${battle[battle.currentTurn === player1Id ? 'player1' : 'player2'].memory.story || 'Древнее воспоминание...'}`
            };
        } catch (error) {
            Logger.error('Battle error', error);
            return { success: false, message: '❌ Ошибка создания битвы' };
        }
    }

    // Ход в битве
    async memoryStrike(battleId: string, attackerId: number, defenderId: number) {
        try {
            const battle = await this.db.battles.findOne({ id: battleId });
            if (!battle || battle.status !== 'active') {
                return { success: false, message: '❌ Битва не найдена или завершена' };
            }

            if (battle.currentTurn !== attackerId) {
                return { success: false, message: '⏳ Сейчас не твой ход' };
            }

            const attacker = battle.player1.id === attackerId ? battle.player1 : battle.player2;
            const defender = battle.player1.id === defenderId ? battle.player1 : battle.player2;

            const buttons = [
                [{ text: '💔 Принять боль (-15 HP)', callback_data: `battle_accept_${battleId}` }],
                [{ text: '🧹 Стереть воспоминание (-1 артефакт)', callback_data: `battle_erase_${battleId}` }]
            ];

            return {
                success: true,
                message: `🔮 **Ход игрока ${attacker.username}**\n\n` +
                    `📖 **Воспоминание:**\n"${attacker.memory.name}"\n\n` +
                    `${attacker.username} атакует ${defender.username}!\n\n` +
                    `**Выбери свою судьбу:**`,
                buttons
            };
        } catch (error) {
            Logger.error('Memory strike error', error);
            return { success: false, message: '❌ Ошибка хода' };
        }
    }

    // Принять урон
    async acceptPain(battleId: string, defenderId: number) {
        const battle = await this.db.battles.findOne({ id: battleId });
        if (!battle) return { success: false, message: '❌ Битва не найдена' };

        const defender = battle.player1.id === defenderId ? battle.player1 : battle.player2;
        const attacker = battle.player1.id === defenderId ? battle.player2 : battle.player1;

        const damage = CONFIG.BATTLE.BASE_DAMAGE + Math.floor(Math.random() * 20);
        defender.hp -= damage;

        let battleEnded = false;
        let winner = null;

        if (defender.hp <= 0) {
            battleEnded = true;
            winner = attacker.id;
            defender.hp = 0;
        }

        await this.db.battles.updateOne(
            { id: battleId },
            {
                $set: {
                    currentTurn: battleEnded ? null : defender.id,
                    round: battle.round + 1,
                    lastAction: Date.now(),
                    status: battleEnded ? 'finished' : 'active',
                    winner: winner,
                    [`${defender.id === battle.player1.id ? 'player1' : 'player2'}.hp`]: defender.hp
                }
            }
        );

        if (battleEnded) {
            // Награда победителю
            await this.db.players.updateOne(
                { telegramId: winner },
                {
                    $inc: {
                        stars: CONFIG.PVP.BASE_REWARD,
                        'stats.pvpWins': 1,
                        'pvp.rating': CONFIG.PVP.RATING_WIN
                    }
                }
            );

            // Наказание проигравшему
            const soulSystem = new SoulSystem(this.db);
            await soulSystem.loseSoul(
                defender.id,
                CONFIG.SOUL.PVP_LOSS,
                'pvp_defeat'
            );

            return {
                success: true,
                battleEnded: true,
                winner: attacker.username,
                message: `💥 **УДАР ПРИНЯТ!**\n\n` +
                    `${defender.username} получает ${damage} урона\n` +
                    `HP: ${defender.hp + damage} → ${defender.hp}\n\n` +
                    `🏆 **ПОБЕДИТЕЛЬ: ${attacker.username}**\n` +
                    `Награда: ${CONFIG.PVP.BASE_REWARD}⭐, +${CONFIG.PVP.RATING_WIN} рейтинга\n` +
                    `💀 Проигравший теряет ${CONFIG.SOUL.PVP_LOSS}% души`
            };
        }

        return {
            success: true,
            battleEnded: false,
            message: `💔 **${defender.username} принял боль!**\n\n` +
                `Урон: ${damage}\n` +
                `Осталось HP: ${defender.hp}\n\n` +
                `🎮 Следующий ход: ${defender.username}`
        };
    }

    // Стереть воспоминание
    async eraseMemory(battleId: string, defenderId: number) {
        const battle = await this.db.battles.findOne({ id: battleId });
        if (!battle) return { success: false, message: '❌ Битва не найдена' };

        const defender = battle.player1.id === defenderId ? battle.player1 : battle.player2;
        const attacker = battle.player1.id === defenderId ? battle.player2 : battle.player1;

        const player = await this.db.players.findOne({ telegramId: defenderId });
        if (!player || !player.inventory || player.inventory.length === 0) {
            return this.acceptPain(battleId, defenderId);
        }

        const randomIndex = Math.floor(Math.random() * player.inventory.length);
        const artifactId = player.inventory[randomIndex];

        await this.db.players.updateOne(
            { telegramId: defenderId },
            { $pull: { inventory: artifactId } }
        );

        await this.db.artifacts.deleteOne({ id: artifactId });

        const damage = Math.floor(CONFIG.BATTLE.BASE_DAMAGE * 0.5);
        defender.hp -= damage;

        await this.db.battles.updateOne(
            { id: battleId },
            {
                $set: {
                    currentTurn: defender.id,
                    round: battle.round + 1,
                    lastAction: Date.now(),
                    [`${defender.id === battle.player1.id ? 'player1' : 'player2'}.hp`]: defender.hp
                }
            }
        );

        return {
            success: true,
            message: `🧹 **ВОСПОМИНАНИЕ СТЕРТО!**\n\n` +
                `${defender.username} пожертвовал артефактом, чтобы уменьшить боль.\n` +
                `Урон: ${damage}\n` +
                `HP: ${defender.hp + damage} → ${defender.hp}\n\n` +
                `🎮 Следующий ход: ${defender.username}`
        };
    }

    // Получить случайный артефакт игрока
    private async getRandomArtifact(telegramId: number) {
        const player = await this.db.players.findOne({ telegramId });
        if (!player?.inventory || player.inventory.length === 0) {
            return {
                id: 'default',
                name: 'Воспоминание о пустоте',
                story: 'Ты еще не создал ни одного воспоминания...',
                value: 0
            };
        }

        const randomId = player.inventory[
            Math.floor(Math.random() * player.inventory.length)
        ];
        
        const artifact = await this.db.artifacts.findOne({ id: randomId });
        return artifact || {
            id: 'default',
            name: 'Утраченное воспоминание',
            story: 'Оно было стерто временем...',
            value: 0
        };
    }
}
