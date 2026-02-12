// ========== config.ts ==========
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
    imageUrl?: string;  // <--- ДОБАВЛЕНО ДЛЯ КАРТИНОК
}

export type ArtifactRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';

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
        COOLDOWN: 60000
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
