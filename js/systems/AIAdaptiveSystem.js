/**
 * AI难度自适应系统
 * 根据玩家水平动态调整AI参数
 */

// ==================== 玩家数据管理 ====================
class PlayerDataManager {
    constructor() {
        this.storageKey = 'gomoku_player_data';
        this.playerData = this.loadData();
    }

    /**
     * 加载玩家数据
     */
    loadData() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : this.createDefaultData();
        } catch (e) {
            return this.createDefaultData();
        }
    }

    /**
     * 创建默认数据
     */
    createDefaultData() {
        return {
            playerId: this.generatePlayerId(),
            totalGames: 0,
            wins: { easy: 0, medium: 0, hard: 0 },
            losses: { easy: 0, medium: 0, hard: 0 },
            currentLevel: 1,
            currentExp: 0,
            expToNext: 100,
            skill: {
                offense: 50,    // 进攻能力
                defense: 50,    // 防守能力
                skillUse: 50,   // 技能使用
                adaptation: 50  // 适应能力
            },
            history: [],
            achievements: []
        };
    }

    /**
     * 生成玩家ID
     */
    generatePlayerId() {
        return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 保存数据
     */
    saveData() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.playerData));
            return true;
        } catch (e) {
            console.error('保存失败:', e);
            return false;
        }
    }

    /**
     * 记录对局结果
     */
    recordGame(difficulty, won, moves, duration) {
        const result = won ? 'wins' : 'losses';
        this.playerData[result][difficulty]++;
        this.playerData.totalGames++;

        // 计算经验值
        const expGain = this.calculateExpGain(difficulty, won, moves);
        this.playerData.currentExp += expGain;

        // 升级检查
        while (this.playerData.currentExp >= this.playerData.expToNext) {
            this.playerData.currentExp -= this.playerData.expToNext;
            this.playerData.currentLevel++;
            this.playerData.expToNext = Math.floor(this.playerData.expToNext * 1.2);
        }

        // 更新技能评分
        this.updateSkillScores(difficulty, won, moves);

        // 添加历史记录
        this.playerData.history.unshift({
            date: new Date().toISOString(),
            difficulty: difficulty,
            result: won ? 'win' : 'loss',
            moves: moves,
            duration: duration
        });

        // 限制历史长度
        if (this.playerData.history.length > 50) {
            this.playerData.history.pop();
        }

        this.saveData();
        return expGain;
    }

    /**
     * 计算经验值
     */
    calculateExpGain(difficulty, won, moves) {
        let baseExp = { easy: 10, medium: 25, hard: 50 }[difficulty] || 10;
        if (!won) baseExp = Math.floor(baseExp * 0.3);

        // 招数加成
        const moveBonus = Math.min(moves, 50) * 0.5;

        return Math.floor(baseExp + moveBonus);
    }

    /**
     * 更新技能评分
     */
    updateSkillScores(difficulty, won, moves) {
        const change = won ? 5 : -2;
        this.playerData.skill.offense = Math.max(0, Math.min(100, this.playerData.skill.offense + change));
        this.playerData.skill.defense = Math.max(0, Math.min(100, this.playerData.skill.defense + change));
        this.playerData.skill.skillUse = Math.max(0, Math.min(100, this.playerData.skill.skillUse + (won ? 3 : -1)));
        this.playerData.skill.adaptation = Math.max(0, Math.min(100, this.playerData.skill.adaptation + (won ? 2 : -1)));
    }

    /**
     * 获取玩家数据
     */
    getPlayerData() {
        return { ...this.playerData };
    }

    /**
     * 获取推荐难度
     */
    getRecommendedDifficulty() {
        const data = this.playerData;

        // 计算各难度的胜率
        const easyWinRate = data.wins.easy / (data.wins.easy + data.losses.easy || 1);
        const mediumWinRate = data.wins.medium / (data.wins.medium + data.losses.medium || 1);
        const hardWinRate = data.wins.hard / (data.wins.hard + data.losses.hard || 1);

        // 根据胜率推荐难度
        if (data.totalGames < 3) return 'easy';

        if (easyWinRate > 0.7 && mediumWinRate > 0.6 && data.wins.medium >= 3) {
            return 'hard';
        } else if (easyWinRate > 0.6 && data.wins.easy >= 3) {
            return 'medium';
        }

        return 'easy';
    }

    /**
     * 获取等级标题
     */
    getLevelTitle() {
        const level = this.playerData.currentLevel;
        const titles = {
            1: '初学者',
            5: '业余初段',
            10: '业余二段',
            20: '业余三段',
            30: '职业初段',
            50: '职业二段',
            100: '棋圣'
        };

        for (const [lvl, title] of Object.entries(titles).sort((a, b) => b[0] - a[0])) {
            if (level >= lvl) return title;
        }
        return '初学者';
    }

    /**
     * 重置数据
     */
    resetData() {
        this.playerData = this.createDefaultData();
        this.saveData();
    }
}

// ==================== AI难度自适应器 ====================
class AIDifficultyAdjuster {
    constructor(playerDataManager) {
        this.playerData = playerDataManager;
        this.baseConfig = {
            easy: {
                skillUsageRate: 0.2,
                thinkTime: 500,
                detectThreatLevel: 1,
                searchDepth: 1,
                randomBonus: 20
            },
            medium: {
                skillUsageRate: 0.5,
                thinkTime: 1000,
                detectThreatLevel: 3,
                searchDepth: 2,
                randomBonus: 10
            },
            hard: {
                skillUsageRate: 0.8,
                thinkTime: 2000,
                detectThreatLevel: 5,
                searchDepth: 4,
                randomBonus: 0
            }
        };
    }

    /**
     * 调整AI参数
     */
    adjustAIConfig(baseDifficulty, playerSkill) {
        const data = this.playerData.getPlayerData();
        const base = this.baseConfig[baseDifficulty];

        // 根据玩家技能调整
        const skill = data.skill;
        const adjusted = { ...base };

        // 进攻能力强的玩家 → 增强防守
        if (skill.offense > 60) {
            adjusted.detectThreatLevel = Math.min(5, adjusted.detectThreatLevel + 1);
        }

        // 防守能力强的玩家 → 增强进攻
        if (skill.defense > 60) {
            adjusted.skillUsageRate = Math.min(1, adjusted.skillUsageRate + 0.1);
        }

        // 适应能力强的玩家 → 减少随机性
        if (skill.adaptation > 60) {
            adjusted.randomBonus = Math.max(0, adjusted.randomBonus - 5);
        }

        // 根据对局历史微调
        const history = data.history.slice(0, 10);
        if (history.length > 0) {
            const recentWins = history.filter(h => h.result === 'win').length;
            const winRate = recentWins / history.length;

            // 玩家连胜 → 提高AI难度
            if (winRate > 0.7) {
                adjusted.thinkTime = Math.min(3000, adjusted.thinkTime + 200);
                adjusted.searchDepth = Math.min(6, adjusted.searchDepth + 1);
            }
            // 玩家连败 → 降低AI难度
            else if (winRate < 0.3) {
                adjusted.thinkTime = Math.max(300, adjusted.thinkTime - 100);
                adjusted.randomBonus = Math.min(30, adjusted.randomBonus + 5);
            }
        }

        return adjusted;
    }

    /**
     * 获取动态难度描述
     */
    getDifficultyDescription(config) {
        const descriptions = [];

        if (config.searchDepth >= 4) {
            descriptions.push('深度搜索分析');
        } else if (config.searchDepth <= 1) {
            descriptions.push('浅层思考');
        }

        if (config.skillUsageRate >= 0.7) {
            descriptions.push('积极使用技能');
        } else if (config.skillUsageRate <= 0.3) {
            descriptions.push('保守使用技能');
        }

        if (config.randomBonus > 15) {
            descriptions.push('随机性较高');
        } else if (config.randomBonus <= 5) {
            descriptions.push('精准计算');
        }

        return descriptions.join('、') || '标准配置';
    }
}

// ==================== 实时对局分析器 ====================
class RealTimeAnalyzer {
    constructor() {
        this.positionHistory = [];
        this.skillHistory = [];
        this.advantageHistory = [];
    }

    /**
     * 记录局面
     */
    recordPosition(board, currentPlayer) {
        const score = this.evaluateBoard(board, currentPlayer);
        this.advantageHistory.push({
            turn: this.positionHistory.length + 1,
            score: score,
            player: currentPlayer
        });

        this.positionHistory.push({
            board: JSON.parse(JSON.stringify(board)),
            player: currentPlayer,
            score: score
        });
    }

    /**
     * 记录技能使用
     */
    recordSkill(player, skillId) {
        this.skillHistory.push({
            turn: this.positionHistory.length,
            player: player,
            skillId: skillId
        });
    }

    /**
     * 评估棋盘
     */
    evaluateBoard(board, player) {
        let score = 0;
        const opponent = player === 'black' ? 'white' : 'black';

        // 计算双方威胁
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (board[r][c] === player) {
                    score += this.evaluatePosition(board, r, c, player);
                } else if (board[r][c] === opponent) {
                    score -= this.evaluatePosition(board, r, c, opponent);
                }
            }
        }

        return score;
    }

    /**
     * 评估位置
     */
    evaluatePosition(board, row, col, player) {
        let score = 0;
        const dirs = [[0,1], [1,0], [1,1], [1,-1]];

        for (const [dr, dc] of dirs) {
            let count = 1;
            let openEnds = 0;

            // 正向
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === player) {
                count++;
                r += dr;
                c += dc;
            }
            if (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === null) openEnds++;

            // 反向
            r = row - dr;
            c = col - dc;
            while (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === player) {
                count++;
                r -= dr;
                c -= dc;
            }
            if (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === null) openEnds++;

            if (count >= 5) score += 100000;
            else if (count === 4 && openEnds === 2) score += 10000;
            else if (count === 4 && openEnds === 1) score += 5000;
            else if (count === 3 && openEnds === 2) score += 1000;
            else if (count === 3 && openEnds === 1) score += 300;
            else if (count === 2 && openEnds === 2) score += 100;
        }

        return score;
    }

    /**
     * 获取当前优势
     */
    getCurrentAdvantage() {
        if (this.advantageHistory.length === 0) return { advantage: 0, leader: null };

        const latest = this.advantageHistory[this.advantageHistory.length - 1];
        return {
            advantage: latest.score,
            leader: latest.score > 0 ? latest.player : (latest.score < 0 ? 'opponent' : 'equal')
        };
    }

    /**
     * 检测优势变化
     */
    detectAdvantageChange() {
        if (this.advantageHistory.length < 2) return null;

        const prev = this.advantageHistory[this.advantageHistory.length - 2];
        const curr = this.advantageHistory[this.advantageHistory.length - 1];
        const change = curr.score - prev.score;

        if (Math.abs(change) > 1000) {
            return {
                type: change > 0 ? 'gained' : 'lost',
                amount: Math.abs(change),
                player: curr.player
            };
        }

        return null;
    }

    /**
     * 获取对局统计
     */
    getStats() {
        const advantage = this.getCurrentAdvantage();
        const change = this.detectAdvantageChange();

        return {
            totalMoves: this.positionHistory.length,
            skillUses: this.skillHistory.length,
            currentAdvantage: advantage,
            advantageChange: change,
            advantageTrend: this.getAdvantageTrend()
        };
    }

    /**
     * 获取优势趋势
     */
    getAdvantageTrend() {
        if (this.advantageHistory.length < 5) return 'stable';

        const recent = this.advantageHistory.slice(-5);
        const trend = recent[recent.length - 1].score - recent[0].score;

        if (trend > 500) return 'improving';
        if (trend < -500) return 'declining';
        return 'stable';
    }

    /**
     * 重置
     */
    reset() {
        this.positionHistory = [];
        this.skillHistory = [];
        this.advantageHistory = [];
    }
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PlayerDataManager,
        AIDifficultyAdjuster,
        RealTimeAnalyzer
    };
}
