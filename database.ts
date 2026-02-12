// ========== database.ts ==========
import { MongoClient, ObjectId } from 'https://esm.sh/mongodb@5.8.0';
import { 
    CONFIG, IPlayer, IGuild, IArtifact, IPvPMatch, 
    IGuildRaid, ITradeOrder, IGuildInvite, IEvent 
} from './config.ts';

export class Database {
    private client: MongoClient;
    private db: any;
    
    // Коллекции
    public players: any;
    public guilds: any;
    public artifacts: any;
    public pvpMatches: any;
    public guildRaids: any;
    public tradeOrders: any;
    public guildInvites: any;
    public events: any;
    public hallOfFame: any; // НОВАЯ КОЛЛЕКЦИЯ
    
    constructor() {
        this.client = new MongoClient(CONFIG.MONGODB_URI);
    }
    
    async connect() {
        try {
            await this.client.connect();
            console.log('✅ Подключено к MongoDB');
            
            this.db = this.client.db('sentinel_game');
            
            // Инициализация коллекций
            this.players = this.db.collection('players');
            this.guilds = this.db.collection('guilds');
            this.artifacts = this.db.collection('artifacts');
            this.pvpMatches = this.db.collection('pvp_matches');
            this.guildRaids = this.db.collection('guild_raids');
            this.tradeOrders = this.db.collection('trade_orders');
            this.guildInvites = this.db.collection('guild_invites');
            this.events = this.db.collection('events');
            this.hallOfFame = this.db.collection('hall_of_fame'); // НОВОЕ
            
            // Создание индексов
            await this.createIndexes();
            
        } catch (error) {
            console.error('❌ Ошибка подключения к MongoDB:', error);
            throw error;
        }
    }
    
    private async createIndexes() {
        try {
            // Игроки
            await this.players.createIndex({ telegramId: 1 }, { unique: true });
            await this.players.createIndex({ username: 1 });
            await this.players.createIndex({ guildId: 1 });
            
            // 🔥 НОВЫЕ ИНДЕКСЫ ДЛЯ ДУШИ
            await this.players.createIndex({ 'soul.current': 1 });
            await this.players.createIndex({ 'soul.lastResurrection': 1 });
            await this.players.createIndex({ 'soul.resurrectedBy': 1 });
            
            // 🔥 НОВЫЕ ИНДЕКСЫ ДЛЯ БЛИЗНЕЦОВ
            await this.players.createIndex({ 'twins.id': 1 });
            await this.players.createIndex({ 'twin.original.joinedAt': -1 });
            
            // Гильдии
            await this.guilds.createIndex({ name: 1 }, { unique: true });
            await this.guilds.createIndex({ tag: 1 }, { unique: true });
            
            // Артефакты
            await this.artifacts.createIndex({ telegramId: 1 });
            await this.artifacts.createIndex({ rarity: 1 });
            await this.artifacts.createIndex({ id: 1 }, { unique: true });
            
            // PvP матчи
            await this.pvpMatches.createIndex({ status: 1 });
            await this.pvpMatches.createIndex({ player1: 1, player2: 1 });
            await this.pvpMatches.createIndex({ 'memoryStrikes': 1 }); // НОВОЕ
            
            // Торговые ордера
            await this.tradeOrders.createIndex({ status: 1, price: 1 });
            await this.tradeOrders.createIndex({ sellerId: 1 });
            await this.tradeOrders.createIndex({ expiresAt: 1 });
            
            // Приглашения в гильдии
            await this.guildInvites.createIndex({ to: 1, expiresAt: 1 });
            await this.guildInvites.createIndex({ guildId: 1 });
            
            // Зал Славы
            await this.hallOfFame.createIndex({ diedAt: -1 }); // НОВОЕ
            await this.hallOfFame.createIndex({ username: 1 }); // НОВОЕ
            await this.hallOfFame.createIndex({ resurrected: 1 }); // НОВОЕ
            
            console.log('✅ Индексы MongoDB созданы (включая Soul & Twins)');
        } catch (error) {
            console.error('❌ Ошибка создания индексов:', error);
            throw error;
        }
    }
    
    // Валидация ObjectId
    isValidObjectId(id: string): boolean {
        try {
            new ObjectId(id);
            return true;
        } catch {
            return false;
        }
    }
    
    // Получение ObjectId
    toObjectId(id: string): ObjectId {
        return new ObjectId(id);
    }
    
    // Генерация уникального ID
    generateId(): string {
        return new ObjectId().toString();
    }
    
    // 🔥 МИГРАЦИЯ СУЩЕСТВУЮЩИХ ИГРОКОВ
    async migratePlayersToSoulSystem() {
        try {
            console.log('🔄 Запуск миграции игроков на систему души...');
            
            const result = await this.players.updateMany(
                { soul: { $exists: false } },
                {
                    $set: {
                        soul: {
                            current: CONFIG.SOUL.MAX_SOUL,
                            max: CONFIG.SOUL.MAX_SOUL,
                            lastDecay: Date.now(),
                            resurrectedBy: null,
                            lastResurrection: null,
                            history: []
                        },
                        'stats.resurrectionsGiven': 0,
                        'stats.twinContributions': 0,
                        'stats.referrals': 0
                    }
                }
            );
            
            console.log(`✅ Миграция завершена: ${result.modifiedCount} игроков`);
            return result;
            
        } catch (error) {
            console.error('❌ Ошибка миграции:', error);
            throw error;
        }
    }
    
    // 🔥 ОЧИСТКА ПРОСРОЧЕННЫХ ЗАПРОСОВ НА ВОСКРЕШЕНИЕ
    async cleanupExpiredResurrectionRequests() {
        try {
            const result = await this.players.updateMany(
                {
                    'resurrectionRequests.expiresAt': { $lt: Date.now() }
                },
                {
                    $pull: {
                        resurrectionRequests: {
                            expiresAt: { $lt: Date.now() }
                        }
                    }
                }
            );
            
            return result.modifiedCount;
            
        } catch (error) {
            console.error('❌ Ошибка очистки запросов:', error);
            return 0;
        }
    }
    
    // 🔥 ПОЛУЧИТЬ ТОП ДУШ
    async getTopSouls(limit: number = 10) {
        try {
            return await this.players
                .find({ 'soul.current': { $gt: 0 } })
                .sort({ 'soul.current': -1, level: -1 })
                .limit(limit)
                .toArray();
                
        } catch (error) {
            console.error('❌ Ошибка получения топа душ:', error);
            return [];
        }
    }
    
    // 🔥 ПОЛУЧИТЬ ЗАЛ СЛАВЫ
    async getHallOfFame(limit: number = 50) {
        try {
            return await this.hallOfFame
                .find({})
                .sort({ diedAt: -1 })
                .limit(limit)
                .toArray();
                
        } catch (error) {
            console.error('❌ Ошибка получения Зала Славы:', error);
            return [];
        }
    }
    
    // 🔥 ПОЛУЧИТЬ БЛИЗНЕЦОВ ИГРОКА
    async getPlayerTwins(telegramId: number) {
        try {
            const player = await this.players.findOne({ telegramId });
            if (!player?.twins) return [];
            
            const twinIds = player.twins.map((t: any) => t.id);
            return await this.players
                .find({ telegramId: { $in: twinIds } })
                .project({ 
                    telegramId: 1, 
                    username: 1, 
                    level: 1,
                    'soul.current': 1,
                    lastAction: 1 
                })
                .toArray();
                
        } catch (error) {
            console.error('❌ Ошибка получения близнецов:', error);
            return [];
        }
    }
    
    // 🔥 ПОЛУЧИТЬ ОРИГИНАЛА (ДЛЯ ТЕНИ)
    async getOriginalTwin(telegramId: number) {
        try {
            return await this.players.findOne({
                'twins.id': telegramId
            });
            
        } catch (error) {
            console.error('❌ Ошибка получения оригинала:', error);
            return null;
        }
    }
    
    async disconnect() {
        await this.client.close();
        console.log('📴 Отключено от MongoDB');
    }
}

// Экспорт единственного экземпляра
let dbInstance: Database | null = null;

export async function getDatabase(): Promise<Database> {
    if (!dbInstance) {
        dbInstance = new Database();
        await dbInstance.connect();
        
        // 🔥 АВТОМАТИЧЕСКАЯ МИГРАЦИЯ ПРИ ПЕРВОМ ЗАПУСКЕ
        await dbInstance.migratePlayersToSoulSystem();
        
        // 🔥 ЗАПУСК ПЕРИОДИЧЕСКОЙ ОЧИСТКИ
        setInterval(async () => {
            const cleaned = await dbInstance!.cleanupExpiredResurrectionRequests();
            if (cleaned > 0) {
                console.log(`🧹 Очищено ${cleaned} просроченных запросов воскрешения`);
            }
        }, 3600000); // Каждый час
    }
    return dbInstance;
}
