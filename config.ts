// ========== config.ts ==========
// SENTINEL: ECHO — ПОЛНАЯ КОНФИГУРАЦИЯ С PvP ЛИГАМИ

export type ArtifactRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';

export interface IPlayer {
    telegramId: number;
    username?: string;
    firstName?: string;
    stars: number;
    energy: number;
    maxEnergy: number;
    level: number;
    experience: number;
    inventory: string[];
    lastEnergyRegen: number;
    lastHackTime?: number;
    lastAction?: number;
    guildId?: string;
    soul?: {
        current: number;
        max: number;
        lastDecay: number;
        resurrectedBy?: number | null;
        lastResurrection?: number | null;
        history?: Array<{
            timestamp: number;
            change: number;
            reason: string;
            newValue: number;
        }>;
    };
    twin?: {
        original?: {
            joinedAt: number;
            level: number;
            stats: {
                hacksDone: number;
                artifactsFound: number;
            };
        };
        bondStrength: number;
        isVirtual?: boolean;
    };
    twins?: Array<{
        id: number;
        joinedAt: number;
        level: number;
        contribution: number;
    }>;
    resurrectionRequests?: Array<{
        from: number;
        username: string;
        sentAt: number;
        expiresAt: number;
    }>;
    pvp: {
        rating: number;
        wins: number;
        losses: number;
        league?: string; // Новая опциональная настройка
    };
    quests: {
        list: string[];
        lastUpdate: number;
    };
    achievements: string[];
    stats: {
        hacksDone: number;
        artifactsFound: number;
        raidsDone: number;
        pvpBattles: number;
        pvpWins: number;
        craftsDone: number;
        mythicCrafted: number;
        tradesDone: number;
        successfulHacks: number;
        failedHacks: number;
        referrals: number;
        resurrectionsGiven?: number;
        twinContributions?: number;
        generatedImages?: Array<{
            artifactId: string;
            timestamp: number;
        }>;
        totalDonated?: number;
        donations?: number;
        lastDonation?: number;
        purchases?: Array<{
            payload: string;
            amount: number;
            date: number;
        }>;
        lastPurchase?: {
            payload: string;
            amount: number;
            date: number;
        };
    };
    vip?: {
        until: number;
        bonus: {
            exp: number;
            soul: number;
            noCooldown: boolean;
        };
    };
    boost?: {
        energy?: {
            multiplier: number;
            expiresAt: number;
        };
    };
    createdAt: number;
}

export interface IArtifact {
    id: string;
    telegramId: number;
    name: string;
    rarity: ArtifactRarity;
    value: number;
    foundAt: number;
    equipped?: boolean;
    story?: string;
    loreName?: string;
    imageUrl?: string;
    imageProvider?: string;
    prompt?: string;
}

export interface IPvPMatch {
    id: string;
    player1: number;
    player2: number;
    status: 'ACTIVE' | 'FINISHED' | 'SURRENDERED';
    startTime: number;
    endTime?: number;
    turn: number;
    player1Health: number;
    player2Health: number;
    round: number;
    memoryStrikes: Record<number, number>;
    winner?: number;
    logs: Array<{
        attacker: number;
        damage: number;
        isCrit: boolean;
        isMemoryStrike?: boolean;
        timestamp: number;
        round: number;
        healthLeft: number;
    }>;
}

export const CONFIG = {
    GAME: {
        START_STARS: 100,
        START_ENERGY: 50,
        MAX_ENERGY: 100,
        HACK_COST: 20,
        HACK_COOLDOWN: 30000,
        ENERGY_REGEN: 10,
        ENERGY_REGEN_INTERVAL: 60000,
        ARTIFACTS: {
            COMMON: { chance: 0.4, value: 50 },
            RARE: { chance: 0.3, value: 150 },
            EPIC: { chance: 0.15, value: 400 },
            LEGENDARY: { chance: 0.1, value: 1000 },
            MYTHIC: { chance: 0.05, value: 2500 }
        },
        LEVELS: [
            { level: 1, expNeeded: 0, maxEnergy: 100 },
            { level: 2, expNeeded: 100, maxEnergy: 120 },
            { level: 3, expNeeded: 300, maxEnergy: 140 },
            { level: 4, expNeeded: 600, maxEnergy: 160 },
            { level: 5, expNeeded: 1000, maxEnergy: 180 },
            { level: 6, expNeeded: 1500, maxEnergy: 200 },
            { level: 7, expNeeded: 2100, maxEnergy: 220 },
            { level: 8, expNeeded: 2800, maxEnergy: 240 },
            { level: 9, expNeeded: 3600, maxEnergy: 260 },
            { level: 10, expNeeded: 4500, maxEnergy: 300 }
        ]
    },
    
    PVP: {
        ENERGY_COST: 20,
        BASE_REWARD: 150,
        RATING_WIN: 25,
        RATING_LOSS: 10,
        COOLDOWN: 60000,
        MIN_DAMAGE: 10,
        MAX_DAMAGE: 25,
        CRIT_CHANCE: 0.2,
        CRIT_MULTIPLIER: 2,
        
        // ========== НОВЫЕ PvP ЛИГИ ==========
        LEAGUES: [
            { 
                name: 'Бронза', 
                min: 0, 
                max: 499, 
                reward: 1000, 
                title: '🥉 Бронзовый страж',
                color: '#CD7F32',
                icon: '🥉'
            },
            { 
                name: 'Серебро', 
                min: 500, 
                max: 999, 
                reward: 2500, 
                title: '🥈 Серебряный воин',
                color: '#C0C0C0',
                icon: '🥈'
            },
            { 
                name: 'Золото', 
                min: 1000, 
                max: 1499, 
                reward: 5000, 
                title: '🥇 Золотой страж',
                color: '#FFD700',
                icon: '🥇'
            },
            { 
                name: 'Платина', 
                min: 1500, 
                max: 1999, 
                reward: 10000, 
                title: '💎 Платиновый легенда',
                color: '#E5E4E2',
                icon: '💎'
            },
            { 
                name: 'Рубин', 
                min: 2000, 
                max: 2499, 
                reward: 20000, 
                title: '🔴 Рубиновый бессмертный',
                color: '#E0115F',
                icon: '🔴'
            },
            { 
                name: 'Чемпион', 
                min: 2500, 
                max: 9999, 
                reward: 50000, 
                title: '👑 Чемпион душ',
                color: '#9400D3',
                icon: '👑'
            }
        ],
        
        // Настройки для лиг
        LEAGUE_SETTINGS: {
            SEASON_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 дней
            PROMOTION_COUNT: 3, // Топ-3 повышаются
            RELEGATION_COUNT: 3, // Последние 3 вылетают
            RATING_RANGE: 100, // Диапазон поиска соперников
            BONUS_FOR_STREAK: 10 // Бонус за серию побед
        }
    },
    
    GUILD: {
        CREATE_COST: 5000,
        MIN_MEMBERS: 2,
        MAX_MEMBERS: 50,
        RAID_COST: 100,
        RAID_COOLDOWN: 3600000
    },
    
    SOUL: {
        MAX_SOUL: 100,
        HACK_FAIL_LOSS: 2,
        PVP_LOSS: 10,
        IDLE_DAILY_LOSS: 1,
        RESURRECTION_COST: 30,
        RESURRECTION_COOLDOWN: 7 * 24 * 60 * 60 * 1000,
        GUILD_SOUL_BONUS: 0.1
    },
    
    BATTLE: {
        MAX_ROUNDS: 20,
        TIME_LIMIT: 60000,
        BASE_DAMAGE: 15,
        MEMORY_STRIKE_COST: 1
    }
};
