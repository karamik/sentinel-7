// ========== visuals.ts ==========
import { Context } from 'telegraf';
import { Database } from './database.ts';
import { CONFIG, IArtifact } from './config.ts';

export class Visuals {
  constructor(private db: Database) {}

  // ========== ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЙ ==========
  
  async generateArtifactImage(artifact: IArtifact): Promise<string> {
    const prompt = this.buildArtifactPrompt(artifact);
    
    // Бесплатный API генерации изображений Pollinations.ai
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&model=flux`;
    
    return url;
  }

  private buildArtifactPrompt(artifact: IArtifact): string {
    const styles = {
      COMMON: 'cyberpunk artifact, low tech, rusted, dim lighting, close up, 4k',
      RARE: 'glowing cyberpunk artifact, blue neon, detailed, high quality, 4k',
      EPIC: 'legendary cyberpunk artifact, purple energy, particles, dramatic lighting, 4k',
      LEGENDARY: 'mythical cyberpunk artifact, orange flames, epic, god rays, 4k',
      MYTHIC: 'divine cyberpunk artifact, red and gold, holy light, transcendent, masterpiece, 4k'
    };

    const names = {
      COMMON: 'Broken Circuit',
      RARE: 'Neural Crystal',
      EPIC: 'Soul Core',
      LEGENDARY: 'Phoenix Ember',
      MYTHIC: 'God Fragment'
    };

    return `${artifact.loreName || artifact.name}, ${styles[artifact.rarity]}, digital art, futuristic, ${names[artifact.rarity]}, artstation, cinematic`;
  }

  // ========== ASCII-АРТ ==========

  getSoulArt(percentage: number): string {
    const barLength = 20;
    const filled = Math.floor(percentage / 5);
    const empty = barLength - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    let art = '';
    if (percentage <= 0) {
      art = `
💀💀💀💀💀💀💀💀💀💀
💀                 💀
💀    ТЫ ПАЛ       💀
💀    СТРАЖ        💀
💀                 💀
💀💀💀💀💀💀💀💀💀💀`;
    } else if (percentage < 30) {
      art = `
🔥🔥🔥   🔥🔥🔥
🔥     КРИТИЧЕСКИЙ   🔥
🔥    УРОВЕНЬ ДУШИ   🔥
🔥🔥🔥   🔥🔥🔥`;
    } else {
      art = `
    ✦  ┌─┐  ✦
    │  ││  │
    └─┘└─┘
    ${bar} ${percentage}%
    `;
    }
    
    return art;
  }

  getBattleArt(): string {
    const arts = [
      `
      ⚔️     ⚔️
         VS
    [=====] [=====]
      `,
      `
      ▄▄▄▄▄▄▄▄▄▄▄
      █  БИТВА  █
      █ ВОСПОМИ-█
      █  НАНИЙ  █
      ▀▀▀▀▀▀▀▀▀▀▀
      `,
      `
      ╔══════════╗
      ║  MEMORY  ║
      ║  STRIKE  ║
      ╚══════════╝
      `
    ];
    
    return arts[Math.floor(Math.random() * arts.length)];
  }

  getWelcomeArt(): string {
    return `
╔══════════════════════════════════════╗
║                                      ║
║    ███████╗███████╗███╗   ██╗████████╗
║    ██╔════╝██╔════╝████╗  ██║╚══██╔══╝
║    ███████╗█████╗  ██╔██╗ ██║   ██║   
║    ╚════██║██╔══╝  ██║╚██╗██║   ██║   
║    ███████║███████╗██║ ╚████║   ██║   
║    ╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   
║                                      ║
║          SENTINEL 7.0               ║
║                                      ║
╚══════════════════════════════════════╝
    `;
  }

  // ========== HTML-ИНТЕРФЕЙСЫ ==========

  getBattleHTML(battle: any): string {
    const player1 = battle.player1;
    const player2 = battle.player2;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sentinel Battle</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #0a0f1e 0%, #1a1f2e 100%);
            color: #00ff9d;
            font-family: 'Courier New', monospace;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .battle-container {
            max-width: 800px;
            width: 100%;
            background: rgba(0, 255, 157, 0.05);
            border: 2px solid #00ff9d;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 0 30px rgba(0, 255, 157, 0.2);
        }
        
        .vs-header {
            text-align: center;
            font-size: 48px;
            font-weight: bold;
            color: #ff3366;
            text-shadow: 0 0 20px #ff3366;
            margin: 20px 0;
        }
        
        .players {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin: 30px 0;
        }
        
        .player-card {
            flex: 1;
            background: rgba(10, 15, 30, 0.8);
            border: 1px solid #00ff9d;
            border-radius: 15px;
            padding: 20px;
            position: relative;
            overflow: hidden;
        }
        
        .player-card::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(
                45deg,
                transparent 30%,
                rgba(0, 255, 157, 0.1) 50%,
                transparent 70%
            );
            animation: scan 3s linear infinite;
        }
        
        @keyframes scan {
            0% { transform: translateX(-100%) translateY(-100%); }
            100% { transform: translateX(100%) translateY(100%); }
        }
        
        .player-name {
            font-size: 20px;
            font-weight: bold;
            color: #00ff9d;
            margin-bottom: 10px;
        }
        
        .hp-bar {
            width: 100%;
            height: 10px;
            background: #1a1f2e;
            border-radius: 5px;
            margin: 10px 0;
            overflow: hidden;
        }
        
        .hp-fill {
            height: 100%;
            background: linear-gradient(90deg, #00ff9d, #00ffcc);
            width: ${player1.hp}%;
            transition: width 0.3s;
        }
        
        .hp-fill2 {
            height: 100%;
            background: linear-gradient(90deg, #ff3366, #ff6b6b);
            width: ${player2.hp}%;
            transition: width 0.3s;
        }
        
        .memory-card {
            background: rgba(0, 255, 157, 0.1);
            border-left: 4px solid #00ff9d;
            padding: 15px;
            margin-top: 20px;
            border-radius: 0 10px 10px 0;
        }
        
        .memory-name {
            font-size: 18px;
            font-weight: bold;
            color: #ffaa00;
            margin-bottom: 5px;
        }
        
        .memory-story {
            font-size: 12px;
            color: #888;
            font-style: italic;
        }
        
        .glitch {
            animation: glitch 1s infinite;
        }
        
        @keyframes glitch {
            0%, 100% { transform: translate(0); }
            20% { transform: translate(-2px, 2px); }
            40% { transform: translate(2px, -2px); }
            60% { transform: translate(1px, 1px); }
            80% { transform: translate(-1px, -1px); }
        }
        
        .turn-indicator {
            text-align: center;
            font-size: 24px;
            margin: 20px 0;
            padding: 15px;
            background: rgba(255, 51, 102, 0.2);
            border: 1px solid #ff3366;
            border-radius: 10px;
            color: #ff3366;
        }
        
        @media (max-width: 600px) {
            .players {
                flex-direction: column;
            }
            .vs-header {
                font-size: 36px;
            }
        }
    </style>
</head>
<body>
    <div class="battle-container">
        <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 14px; color: #00ff9d;">⚔️ БИТВА ВОСПОМИНАНИЙ ⚔️</span>
        </div>
        
        <div class="vs-header">
            VS
        </div>
        
        <div class="players">
            <div class="player-card">
                <div class="player-name">👤 ${player1.username}</div>
                <div class="hp-bar">
                    <div class="hp-fill" style="width: ${player1.hp}%;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                    <span>❤️ HP: ${player1.hp}%</span>
                    <span>💀 Душа: ${player1.soul}%</span>
                </div>
                <div class="memory-card">
                    <div class="memory-name">📖 ${player1.memory.name}</div>
                    <div class="memory-story">${player1.memory.story?.substring(0, 100) || 'Древнее воспоминание'}...</div>
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
                <div style="font-size: 32px; font-weight: bold; color: #ff3366;">⚔️</div>
                <div style="font-size: 16px; color: #888; margin-top: 10px;">РАУНД ${battle.round}</div>
            </div>
            
            <div class="player-card">
                <div class="player-name">👤 ${player2.username}</div>
                <div class="hp-bar">
                    <div class="hp-fill2" style="width: ${player2.hp}%;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                    <span>❤️ HP: ${player2.hp}%</span>
                    <span>💀 Душа: ${player2.soul}%</span>
                </div>
                <div class="memory-card">
                    <div class="memory-name">📖 ${player2.memory.name}</div>
                    <div class="memory-story">${player2.memory.story?.substring(0, 100) || 'Древнее воспоминание'}...</div>
                </div>
            </div>
        </div>
        
        <div class="turn-indicator glitch">
            ⏳ ХОД ИГРОКА: ${battle.currentTurn === player1.id ? player1.username.toUpperCase() : player2.username.toUpperCase()}
        </div>
        
        <div style="display: flex; gap: 15px; margin-top: 30px;">
            <button onclick="Telegram.WebApp.sendData('accept')" style="
                flex: 1;
                padding: 15px;
                background: transparent;
                border: 2px solid #00ff9d;
                color: #00ff9d;
                font-size: 16px;
                font-weight: bold;
                border-radius: 10px;
                cursor: pointer;
                transition: 0.3s;
            " onmouseover="this.style.background='#00ff9d'; this.style.color='#0a0f1e'"
               onmouseout="this.style.background='transparent'; this.style.color='#00ff9d'">
                💔 ПРИНЯТЬ БОЛЬ
            </button>
            <button onclick="Telegram.WebApp.sendData('erase')" style="
                flex: 1;
                padding: 15px;
                background: transparent;
                border: 2px solid #ff3366;
                color: #ff3366;
                font-size: 16px;
                font-weight: bold;
                border-radius: 10px;
                cursor: pointer;
                transition: 0.3s;
            " onmouseover="this.style.background='#ff3366'; this.style.color='#0a0f1e'"
               onmouseout="this.style.background='transparent'; this.style.color='#ff3366'">
                🧹 СТЕРЕТЬ ВОСПОМИНАНИЕ
            </button>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
            *Каждое воспоминание — часть души. Выбирай wisely.
        </div>
    </div>
    
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
</body>
</html>
    `;
  }

  getInventoryHTML(artifacts: IArtifact[]): string {
    let items = '';
    artifacts.forEach((art, i) => {
      const colors = {
        COMMON: '#95a5a6',
        RARE: '#3498db',
        EPIC: '#9b59b6',
        LEGENDARY: '#f39c12',
        MYTHIC: '#e74c3c'
      };
      
      items += `
        <div class="artifact-card" style="border-color: ${colors[art.rarity]}">
            <div style="font-size: 32px; margin-bottom: 10px;">${this.getRarityEmoji(art.rarity)}</div>
            <div class="artifact-name">${art.loreName || art.name}</div>
            <div class="artifact-rarity" style="color: ${colors[art.rarity]}">${art.rarity}</div>
            <div class="artifact-value">⭐ ${art.value}</div>
            ${art.story ? `<div class="artifact-story">"${art.story.substring(0, 50)}..."</div>` : ''}
        </div>
      `;
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sentinel Inventory</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #0a0f1e 0%, #1a1f2e 100%);
            color: #00ff9d;
            font-family: 'Courier New', monospace;
        }
        
        .inventory-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
            padding: 20px;
        }
        
        .artifact-card {
            background: rgba(10, 15, 30, 0.8);
            border: 2px solid;
            border-radius: 15px;
            padding: 20px;
            position: relative;
            overflow: hidden;
            transition: transform 0.3s;
        }
        
        .artifact-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0, 255, 157, 0.2);
        }
        
        .artifact-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .artifact-rarity {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .artifact-value {
            font-size: 18px;
            font-weight: bold;
            margin-top: 10px;
        }
        
        .artifact-story {
            font-size: 11px;
            color: #888;
            margin-top: 10px;
            font-style: italic;
            border-top: 1px solid rgba(255,255,255,0.1);
            padding-top: 10px;
        }
        
        .glow {
            animation: glow 2s ease-in-out infinite;
        }
        
        @keyframes glow {
            0%, 100% { box-shadow: 0 0 5px currentColor; }
            50% { box-shadow: 0 0 20px currentColor; }
        }
        
        .stats {
            background: rgba(0, 255, 157, 0.05);
            border: 1px solid #00ff9d;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
        }
    </style>
</head>
<body>
    <div class="stats">
        <span>📦 ВСЕГО АРТЕФАКТОВ: ${artifacts.length}</span>
        <span>💰 ОБЩАЯ ЦЕННОСТЬ: ${artifacts.reduce((sum, a) => sum + a.value, 0)}⭐</span>
    </div>
    <div class="inventory-grid">
        ${items}
    </div>
</body>
</html>
    `;
  }

  private getRarityEmoji(rarity: string): string {
    const emojis = {
      COMMON: '⚪',
      RARE: '🔵',
      EPIC: '🟣',
      LEGENDARY: '🟠',
      MYTHIC: '🔴'
    };
    return emojis[rarity as keyof typeof emojis] || '⚪';
  }
}
// ========== visuals.ts - ДОПОЛНЕНИЕ: ЛИМИТЫ И ГАЛЕРЕЯ ==========

// ========== 1. СИСТЕМА ЛИМИТОВ ==========
export class VisualsSystem {
    // ... существующий код ...

    async checkGenerationLimit(telegramId: number): Promise<{
        allowed: boolean;
        remaining: number;
        total: number;
        resetTime: number;
    }> {
        const player = await this.db.players.findOne({ telegramId });
        if (!player) return { allowed: false, remaining: 0, total: 0, resetTime: 0 };

        const now = Date.now();
        const today = new Date().setHours(0, 0, 0, 0);
        
        // Настройки лимитов (можно вынести в CONFIG)
        const DAILY_LIMIT = {
            FREE: 3,        // 3 генерации в день для обычных игроков
            VIP: 10,        // 10 для VIP
            LEGENDARY: 1,   // +1 за каждую легендарку
            MYTHIC: 2       // +2 за каждый мифик
        };

        // Считаем использованные генерации за сегодня
        const used = player.stats?.generatedImages?.filter(
            (g: any) => g.timestamp > today
        ).length || 0;

        // Рассчитываем лимит
        let limit = DAILY_LIMIT.FREE;
        
        // VIP бонус
        if (player.vip?.until > now) {
            limit = DAILY_LIMIT.VIP;
        }
        
        // Бонус за легендарки
        const legendaries = await this.db.artifacts.countDocuments({
            telegramId,
            rarity: 'LEGENDARY'
        });
        limit += legendaries * DAILY_LIMIT.LEGENDARY;
        
        // Бонус за мифики
        const mythics = await this.db.artifacts.countDocuments({
            telegramId,
            rarity: 'MYTHIC'
        });
        limit += mythics * DAILY_LIMIT.MYTHIC;

        // Не больше 50 в день
        limit = Math.min(limit, 50);

        const resetTime = today + 24 * 60 * 60 * 1000;
        
        return {
            allowed: used < limit,
            remaining: Math.max(0, limit - used),
            total: limit,
            resetTime
        };
    }

    // ========== 2. ГАЛЕРЕЯ АРТЕФАКТОВ ==========
    async showGallery(telegramId: number, page: number = 0): Promise<{
        message: string;
        keyboard: any;
        total: number;
    }> {
        const ITEMS_PER_PAGE = 5;
        
        // Получаем артефакты с изображениями
        const artifacts = await this.db.artifacts
            .find({ 
                telegramId,
                imageUrl: { $exists: true, $ne: null }
            })
            .sort({ foundAt: -1 })
            .skip(page * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .toArray();

        const total = await this.db.artifacts.countDocuments({
            telegramId,
            imageUrl: { $exists: true, $ne: null }
        });

        if (artifacts.length === 0) {
            return {
                message: '🖼️ **У тебя ещё нет артефактов с изображениями**\n\nИспользуй `/imagine` чтобы создать AI-образ для своих легендарок и мификов!',
                keyboard: Markup.inlineKeyboard([
                    [Markup.button.callback('🎨 Создать изображение', 'imagine_menu')]
                ]),
                total: 0
            };
        }

        let message = `🖼️ **ГАЛЕРЕЯ АРТЕФАКТОВ**\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📦 Всего: ${total} изображений\n`;
        message += `📃 Страница ${page + 1}/${Math.ceil(total / ITEMS_PER_PAGE)}\n\n`;

        const buttons = [];
        
        for (let i = 0; i < artifacts.length; i++) {
            const a = artifacts[i];
            const emoji = {
                'COMMON': '🟢',
                'RARE': '🔵',
                'EPIC': '🟣',
                'LEGENDARY': '🟠',
                'MYTHIC': '🔴'
            }[a.rarity] || '⚪';
            
            message += `${emoji} **${a.loreName || a.name}**\n`;
            message += `└ 📊 ${a.rarity} | 💰 ${a.value}⭐\n`;
            
            // Кнопка для просмотра
            buttons.push([
                Markup.button.callback(
                    `👁️ ${a.name.substring(0, 15)}...`,
                    `view_${a.id}`
                )
            ]);
        }

        // Навигация
        const navButtons = [];
        if (page > 0) {
            navButtons.push(Markup.button.callback('◀️ Назад', `gallery_page_${page - 1}`));
        }
        if ((page + 1) * ITEMS_PER_PAGE < total) {
            navButtons.push(Markup.button.callback('Вперёд ▶️', `gallery_page_${page + 1}`));
        }
        
        if (navButtons.length > 0) {
            buttons.push(navButtons);
        }

        buttons.push([Markup.button.callback('🎨 Новое изображение', 'imagine_menu')]);
        buttons.push([Markup.button.callback('🏠 Главное меню', 'menu_game')]);

        return {
            message,
            keyboard: Markup.inlineKeyboard(buttons),
            total
        };
    }

    // ========== 3. СТАТИСТИКА ГЕНЕРАЦИЙ ==========
    async getGenerationStats(telegramId: number): Promise<string> {
        const player = await this.db.players.findOne({ telegramId });
        if (!player) return '❌ Игрок не найден';

        const now = Date.now();
        const today = new Date().setHours(0, 0, 0, 0);
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

        const total = player.stats?.generatedImages?.length || 0;
        const todayCount = player.stats?.generatedImages?.filter(
            (g: any) => g.timestamp > today
        ).length || 0;
        const weekCount = player.stats?.generatedImages?.filter(
            (g: any) => g.timestamp > weekAgo
        ).length || 0;

        const limit = await this.checkGenerationLimit(telegramId);
        const resetDate = new Date(limit.resetTime).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Группировка по редкости
        const artifacts = await this.db.artifacts
            .find({ 
                telegramId,
                imageUrl: { $exists: true }
            })
            .toArray();

        const byRarity = {
            'COMMON': 0, 'RARE': 0, 'EPIC': 0,
            'LEGENDARY': 0, 'MYTHIC': 0
        };

        artifacts.forEach(a => {
            byRarity[a.rarity] = (byRarity[a.rarity] || 0) + 1;
        });

        let message = `
🎨 **СТАТИСТИКА AI-ГЕНЕРАЦИИ**
━━━━━━━━━━━━━━━━━━━━━

📊 **Использовано:**
┌ 🎨 Всего генераций: ${total}
├ 📅 Сегодня: ${todayCount}/${limit.total}
├ 📆 За неделю: ${weekCount}
└ ⏳ Сброс лимита: ${resetDate}

🖼️ **Коллекция:**
┌ 🟢 Обычные: ${byRarity.COMMON}
├ 🔵 Редкие: ${byRarity.RARE}
├ 🟣 Эпические: ${byRarity.EPIC}
├ 🟠 Легендарные: ${byRarity.LEGENDARY}
└ 🔴 Мифические: ${byRarity.MYTHIC}

💎 **Бонусы:**
• VIP: +7 генераций в день
• Каждая легендарка: +1 генерация
• Каждый мифик: +2 генерации
        `;

        return message;
    }
}

// ========== 4. ЭКСПОРТ ОБНОВЛЁННОГО КЛАССА ==========
export function setupVisuals(db: Database): VisualsSystem {
    return new VisualsSystem(db);
}
