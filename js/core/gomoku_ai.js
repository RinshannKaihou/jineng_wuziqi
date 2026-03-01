/**
 * 技能五子棋 - AI系统
 * 简单/中等/困难难度实现
 */

// ==================== AI配置 ====================
// 防止与 gomoku_ai_enhanced.js 中的声明冲突
var AI_CONFIG = {
    // 简单难度配置
    easy: {
        skillUsageRate: 0.2,      // 20%概率使用技能
        thinkTime: 120,           // 思考时间
        detectThreatLevel: 1,     // 仅检测五连
        searchDepth: 1,           // 搜索深度
        useAlphaBeta: false,      // 不使用AlphaBeta剪枝
    },
    // 中等难度配置
    medium: {
        skillUsageRate: 0.5,      // 50%概率使用技能
        thinkTime: 220,           // 思考时间
        detectThreatLevel: 3,     // 检测五连、四连、活三
        searchDepth: 2,           // 搜索深度
        useAlphaBeta: true,       // 使用AlphaBeta剪枝
    },
    // 困难难度配置
    hard: {
        skillUsageRate: 0.8,      // 80%概率使用技能
        thinkTime: 350,           // 思考时间
        detectThreatLevel: 5,     // 检测所有威胁类型
        useSkillCombos: true,     // 使用技能组合
        advancedStrategy: true,   // 使用高级策略
        searchDepth: 4,           // 搜索深度（可动态调整3-6）
        useAlphaBeta: true,       // 使用AlphaBeta剪枝
        useIterativeDeepening: true, // 使用迭代加深搜索
        useTranspositionTable: true,  // 使用置换表优化
    },
};

const AI_DEBUG = false;
function aiLog(...args) {
    if (AI_DEBUG) {
        console.log(...args);
    }
}

// ==================== 技能价值评分 ====================
var SKILL_VALUE = {
    // 胜战计
    's1': 60,   // 瞒天过海
    's2': 85,   // 围魏救赵
    's3': 70,   // 借刀杀人
    's4': 20,   // 以逸待劳
    's5': 95,   // 趁火打劫
    's6': 55,   // 声东击西

    // 敌战计
    'e1': 50,   // 无中生有
    'e2': 45,   // 暗度陈仓
    'e3': 75,   // 隔岸观火
    'e4': 80,   // 笑里藏刀
    'e5': 90,   // 李代桃僵
    'e6': 40,   // 顺手牵羊

    // 攻战计
    'a1': 25,   // 打草惊蛇
    'a2': 65,   // 借尸还魂
    'a3': 60,   // 调虎离山
    'a4': 50,   // 欲擒故纵
    'a5': 55,   // 抛砖引玉
    'a6': 95,   // 擒贼擒王

    // 混战计
    'c1': 40,   // 釜底抽薪
    'c2': 35,   // 浑水摸鱼
    'c3': 50,   // 金蝉脱壳
    'c4': 60,   // 关门捉贼
    'c5': 65,   // 远交近攻
    'c6': 45,   // 假途伐虢

    // 并战计
    'm1': 85,   // 偷梁换柱
    'm2': 55,   // 指桑骂槐
    'm3': 30,   // 假痴不癫
    'm4': 70,   // 上屋抽梯
    'm5': 60,   // 树上开花
    'm6': 80,   // 反客为主

    // 败战计
    'd1': 90,   // 美人计
    'd2': 50,   // 空城计
    'd3': 40,   // 反间计
    'd4': 70,   // 苦肉计
    'd5': 85,   // 连环计
    'd6': 90,   // 走为上策
};

// ==================== 技能组合定义 ====================
var SKILL_COMBOS = {
    // 进攻组合
    offensive: [
        { skills: ['e1', 'a1', 'm5'], name: '幻影进攻', bonus: 30 },
        { skills: ['e4', 'd5', 'a5'], name: '连环进攻', bonus: 40 },
        { skills: ['c5', 'm1', 'a6'], name: '转化进攻', bonus: 50 },
    ],
    // 防守组合
    defensive: [
        { skills: ['e3', 'd2', 'c4'], name: '控制防守', bonus: 35 },
        { skills: ['s5', 'e5', 'a6'], name: '破坏防守', bonus: 45 },
    ],
    // 翻盘组合
    comeback: [
        { skills: ['d1', 'm1', 'm6'], name: '逆转翻盘', bonus: 60 },
        { skills: ['d6', 'm4', 'a3'], name: '逃生翻盘', bonus: 50 },
    ],
};

// ==================== 技能分类 ====================
var SKILL_CATEGORY = {
    OFFENSIVE: ['s5', 'e4', 'e5', 'a6', 'c5', 'm1', 'd5'],  // 进攻型
    DEFENSIVE: ['s2', 's5', 'e3', 'e5', 'c4', 'd2'],         // 防守型
    ENERGY: ['a1', 's4', 'd3', 'm3'],                         // 能量型
    CONTROL: ['s2', 'e3', 'a4', 'a5', 'c4', 'm2'],           // 控制型
    COMEBACK: ['d1', 'd6', 'm1', 'm6', 'a3'],                // 翻盘型
};

// ==================== 威胁等级定义 ====================
var THREAT_LEVEL = {
    WIN: 100000,        // 五连
    LIVE_FOUR: 10000,   // 活四
    RUSH_FOUR: 5000,    // 冲四
    LIVE_THREE: 1000,   // 活三
    SLEEP_THREE: 300,   // 眠三
    LIVE_TWO: 100,      // 活二
    SINGLE: 10,         // 单子
};

// ==================== 连线检测工具 ====================
// 防止与 gomoku_ai_enhanced.js 中的类定义冲突
if (typeof LineDetector === 'undefined') {
    window.LineDetector = class LineDetector {
    /**
     * 检测指定玩家是否有五连
     */
    static detectWin(board, player) {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] !== player) continue;

                for (let [dr, dc] of directions) {
                    const result = this.countLine(board, row, col, dr, dc, player);
                    if (result.count >= 5) {
                        return {
                            hasWin: true,
                            position: { row, col },
                            direction: { dr, dc }
                        };
                    }
                }
            }
        }
        return { hasWin: false };
    }

    /**
     * 检测指定玩家的所有威胁（全面版本）
     */
    static detectThreats(board, player, game, options = {}) {
        const threats = {
            win: [],           // 五连威胁
            liveFour: [],      // 活四
            rushFour: [],      // 冲四
            liveThree: [],     // 活三
            sleepThree: [],    // 眠三
            liveTwo: [],       // 活二
            potentialThree: [],// 潜在三（隔一子的三连）
        };

        const processed = new Set();

        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] !== player) continue;

                for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
                    const lineKey = this.getLineKey(row, col, dr, dc);
                    if (processed.has(lineKey)) continue;

                    const result = this.countLine(board, row, col, dr, dc, player);
                    const type = this.classifyLine(result.count, result.openEnds);

                    if (type === 'WIN') {
                        threats.win.push({ ...result, startRow: row, startCol: col, dr, dc });
                    } else if (type === 'LIVE_FOUR') {
                        threats.liveFour.push({ ...result, startRow: row, startCol: col, dr, dc });
                    } else if (type === 'RUSH_FOUR') {
                        threats.rushFour.push({ ...result, startRow: row, startCol: col, dr, dc });
                    } else if (type === 'LIVE_THREE') {
                        threats.liveThree.push({ ...result, startRow: row, startCol: col, dr, dc });
                    } else if (type === 'SLEEP_THREE') {
                        threats.sleepThree.push({ ...result, startRow: row, startCol: col, dr, dc });
                    } else if (type === 'LIVE_TWO') {
                        threats.liveTwo.push({ ...result, startRow: row, startCol: col, dr, dc });
                    }

                    processed.add(lineKey);
                }
            }
        }

        // 可选关闭潜在三连检测（该分支代价较高）
        if (options.includePotentialThree !== false) {
            threats.potentialThree = this.detectPotentialThrees(board, player);
        }

        return threats;
    }

    /**
     * 检测潜在三连（隔一子能形成三连）
     */
    static detectPotentialThrees(board, player) {
        const potentials = [];
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] !== null) continue;

                for (const [dr, dc] of directions) {
                    // 检查这个位置能否形成三连
                    let count = 1;
                    let gaps = 0;

                    // 正向检查
                    let r = row + dr, c = col + dc;
                    for (let i = 0; i < 4 && r >= 0 && r < 15 && c >= 0 && c < 15; i++) {
                        if (board[r][c] === player) {
                            count++;
                        } else if (board[r][c] === null && gaps === 0) {
                            gaps++;
                        } else {
                            break;
                        }
                        r += dr;
                        c += dc;
                    }

                    // 反向检查
                    r = row - dr;
                    c = col - dc;
                    for (let i = 0; i < 4 && r >= 0 && r < 15 && c >= 0 && c < 15; i++) {
                        if (board[r][c] === player) {
                            count++;
                        } else if (board[r][c] === null && gaps === 0) {
                            gaps++;
                        } else {
                            break;
                        }
                        r -= dr;
                        c -= dc;
                    }

                    if (count + gaps >= 3 && gaps <= 1) {
                        potentials.push({ row, col, dr, dc, count, gaps });
                    }
                }
            }
        }

        return potentials;
    }

    /**
     * 计算从指定位置开始的连线
     */
    static countLine(board, row, col, dr, dc, player) {
        let count = 1;
        let openEnds = 0;

        // 正向计数
        let r = row + dr, c = col + dc;
        while (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === player) {
            count++;
            r += dr;
            c += dc;
        }
        if (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === null) {
            openEnds++;
        }

        // 反向计数
        r = row - dr;
        c = col - dc;
        while (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === player) {
            count++;
            r -= dr;
            c -= dc;
        }
        if (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === null) {
            openEnds++;
        }

        return { count, openEnds };
    }

    /**
     * 生成连线的唯一标识
     */
    static getLineKey(row, col, dr, dc) {
        let r = row, c = col;
        while (r >= 0 && r < 15 && c >= 0 && c < 15) {
            r -= dr;
            c -= dc;
        }
        r += dr;
        c += dc;
        return `${r},${c},${dr},${dc}`;
    }

    /**
     * 根据连线长度和开放端点分类
     */
    static classifyLine(count, openEnds) {
        if (count >= 5) return 'WIN';
        if (count === 4) {
            if (openEnds === 2) return 'LIVE_FOUR';
            if (openEnds === 1) return 'RUSH_FOUR';
        }
        if (count === 3) {
            if (openEnds === 2) return 'LIVE_THREE';
            if (openEnds === 1) return 'SLEEP_THREE';
        }
        if (count === 2 && openEnds === 2) return 'LIVE_TWO';
        if (count === 1) return 'SINGLE';
        return 'NONE';
    }

    /**
     * 计算局面的综合威胁分数
     */
    static calculateThreatScore(threats) {
        let score = 0;
        score += threats.win.length * THREAT_LEVEL.WIN;
        score += threats.liveFour.length * THREAT_LEVEL.LIVE_FOUR;
        score += threats.rushFour.length * THREAT_LEVEL.RUSH_FOUR;
        score += threats.liveThree.length * THREAT_LEVEL.LIVE_THREE;
        score += threats.sleepThree.length * THREAT_LEVEL.SLEEP_THREE;
        score += threats.liveTwo.length * THREAT_LEVEL.LIVE_TWO;
        score += threats.potentialThree.length * 50; // 潜在三连
        return score;
    }

    /**
     * 获取所有合法的落子位置
     */
    static getValidPositions(board, game) {
        const positions = [];
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (game.canPlaceStone && !game.canPlaceStone(row, col)) continue;
                if (board[row][col] === null) {
                    positions.push({ row, col });
                }
            }
        }
        return positions;
    }

    /**
     * 获取智能候选位置
     */
    static getCandidatePositions(board, game) {
        const candidates = [];
        const visited = new Set();
        let hasStone = false;

        // 第一遍：检查棋盘上是否有棋子
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] !== null) {
                    hasStone = true;
                    break;
                }
            }
            if (hasStone) break;
        }

        if (!hasStone) {
            // 棋盘为空，返回中心位置
            const centerPositions = [
                { row: 7, col: 7 }, { row: 7, col: 6 }, { row: 7, col: 8 },
                { row: 6, col: 7 }, { row: 8, col: 7 },
                { row: 6, col: 6 }, { row: 6, col: 8 }, { row: 8, col: 6 }, { row: 8, col: 8 }
            ];
            for (const pos of centerPositions) {
                if (board[pos.row][pos.col] === null) {
                    candidates.push(pos);
                }
            }
            return candidates;
        }

        // 第二遍：寻找已有棋子周围的空位
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] === null) continue;

                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = row + dr;
                        const nc = col + dc;
                        const key = `${nr},${nc}`;

                        if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 &&
                            board[nr][nc] === null &&
                            !visited.has(key)) {
                            // 检查是否可以落子（但不在这里过滤，在后续处理中过滤）
                            visited.add(key);
                            candidates.push({ row: nr, col: nc });
                        }
                    }
                }
            }
        }

        return candidates;
    }

    /**
     * 计算位置到棋盘中心的距离
     */
    static getDistanceToCenter(row, col) {
        return Math.abs(row - 7) + Math.abs(col - 7);
    }

    /**
     * 位置价值评分表（15x15）
     */
    static getPositionValue(row, col) {
        const valueTable = [
            [3, 8, 12, 15, 18, 20, 22, 20, 18, 15, 12, 8, 5, 3, 2],
            [8, 20, 30, 40, 50, 60, 70, 60, 50, 40, 30, 20, 12, 8, 5],
            [12, 30, 50, 70, 90, 110, 120, 110, 90, 70, 50, 30, 12, 8, 5],
            [15, 40, 70, 100, 130, 150, 160, 150, 130, 100, 70, 40, 15, 12, 8],
            [18, 50, 90, 130, 160, 180, 200, 180, 160, 130, 90, 50, 18, 15, 12],
            [20, 60, 110, 150, 180, 220, 240, 220, 180, 150, 110, 60, 20, 18, 15],
            [22, 70, 120, 160, 200, 240, 280, 240, 200, 160, 120, 70, 22, 20, 18],
            [20, 60, 110, 150, 180, 220, 240, 220, 180, 150, 110, 60, 20, 18, 15],
            [18, 50, 90, 130, 160, 180, 200, 180, 160, 130, 90, 50, 18, 15, 12],
            [15, 40, 70, 100, 130, 150, 160, 150, 130, 100, 70, 40, 15, 12, 8],
            [12, 30, 50, 70, 90, 110, 120, 110, 90, 70, 50, 30, 12, 8, 5],
            [8, 20, 30, 40, 50, 60, 70, 60, 50, 40, 30, 20, 12, 8, 5],
            [5, 12, 20, 30, 40, 50, 60, 50, 40, 30, 20, 12, 8, 5, 3],
            [3, 8, 12, 15, 18, 20, 22, 20, 18, 15, 12, 8, 5, 3, 2],
            [2, 5, 8, 12, 15, 18, 20, 18, 15, 12, 8, 5, 3, 2, 1],
            [1, 2, 5, 8, 12, 15, 18, 15, 12, 8, 5, 2, 1, 1, 0],
        ];

        if (row >= 0 && row < 15 && col >= 0 && col < 15) {
            return valueTable[row][col] || 10;
        }
        return 10;
    }
    };
}

// ==================== AlphaBeta搜索算法 ====================
/**
 * AlphaBeta剪枝搜索类
 * 实现高效的游戏树搜索算法
 */
if (typeof AlphaBetaSearch === 'undefined') {
    window.AlphaBetaSearch = class AlphaBetaSearch {
    constructor(game, player, config) {
        this.game = game;
        this.player = player;
        this.opponent = player === 'black' ? 'white' : 'black';
        this.config = config;

        // 置换表（用于缓存搜索结果）
        this.transpositionTable = new Map();
        this.maxTableSize = 100000; // 最大缓存条目数

        // 搜索统计
        this.nodesSearched = 0;
        this.cutoffs = 0;
        this.tableHits = 0;

        // 历史启发（记录导致剪枝的移动）
        this.historyTable = Array(15).fill(null).map(() => Array(15).fill(0));

        // 杀手启发（记录每层导致剪枝的移动）
        this.killerMoves = Array(10).fill(null).map(() => []);
    }

    /**
     * 主搜索入口
     * @param {number} depth - 搜索深度
     * @returns {Object} - 最佳移动 {row, col, score}
     */
    search(depth = null) {
        const searchDepth = depth || this.config.searchDepth || 3;
        this.nodesSearched = 0;
        this.cutoffs = 0;
        this.tableHits = 0;

        // 获取候选移动
        const candidates = this.generateCandidates();
        if (candidates.length === 0) {
            return { row: 7, col: 7, score: 0 };
        }

        let bestMove = null;
        let bestScore = -Infinity;

        // 对每个候选移动进行搜索
        for (const move of candidates) {
            const board = this.game.board;

            // 模拟移动
            board[move.row][move.col] = this.player;

            // AlphaBeta搜索
            const score = this.alphaBeta(
                searchDepth - 1,
                -Infinity,
                Infinity,
                false
            );

            // 撤销移动
            board[move.row][move.col] = null;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }

            this.nodesSearched++;
        }

        // 清理置换表（如果太大）
        if (this.transpositionTable.size > this.maxTableSize) {
            this.transpositionTable.clear();
        }

        return {
            row: bestMove.row,
            col: bestMove.col,
            score: bestScore,
            stats: {
                nodes: this.nodesSearched,
                cutoffs: this.cutoffs,
                tableHits: this.tableHits
            }
        };
    }

    /**
     * 迭代加深搜索
     * 逐步增加搜索深度，返回最佳结果
     */
    iterativeDeepening(maxDepth = null, timeLimit = 2000) {
        const maxSearchDepth = maxDepth || this.config.searchDepth || 4;
        const startTime = Date.now();
        let bestResult = null;

        for (let depth = 1; depth <= maxSearchDepth; depth++) {
            // 检查时间限制
            if (Date.now() - startTime > timeLimit) {
                break;
            }

            const result = this.search(depth);

            if (result.score >= 100000) {
                // 找到必胜解，立即返回
                return result;
            }

            bestResult = result;
        }

        return bestResult;
    }

    /**
     * AlphaBeta递归搜索
     * @param {number} depth - 剩余深度
     * @param {number} alpha - Alpha值（最大层的下界）
     * @param {number} beta - Beta值（最小层的上界）
     * @param {boolean} isMaximizing - 是否为最大化层
     * @returns {number} - 评估分数
     */
    alphaBeta(depth, alpha, beta, isMaximizing) {
        // 终止条件
        if (depth === 0) {
            return this.evaluate();
        }

        // 检查游戏是否结束
        const board = this.game.board;
        const currentPlayer = isMaximizing ? this.player : this.opponent;

        // 检查是否有五连
        const winCheck = LineDetector.detectWin(board, currentPlayer);
        if (winCheck.hasWin) {
            return isMaximizing ? 100000 + depth : -100000 - depth;
        }

        // 生成候选移动
        const candidates = this.generateOrderedMoves(isMaximizing);
        if (candidates.length === 0) {
            return 0; // 平局
        }

        // 生成置换表键
        const tableKey = this.generateTableKey(depth, isMaximizing);
        if (this.config.useTranspositionTable && this.transpositionTable.has(tableKey)) {
            this.tableHits++;
            const entry = this.transpositionTable.get(tableKey);

            if (entry.depth >= depth) {
                if (entry.flag === 'exact') {
                    return entry.score;
                } else if (entry.flag === 'lower' && entry.score >= beta) {
                    return entry.score;
                } else if (entry.flag === 'upper' && entry.score <= alpha) {
                    return entry.score;
                }
            }
        }

        if (isMaximizing) {
            let maxEval = -Infinity;

            for (const move of candidates) {
                board[move.row][move.col] = this.player;
                const evalScore = this.alphaBeta(depth - 1, alpha, beta, false);
                board[move.row][move.col] = null;

                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);

                if (beta <= alpha) {
                    this.cutoffs++;
                    // 更新历史启发
                    this.historyTable[move.row][move.col] += depth * depth;
                    // 更新杀手启发
                    this.updateKillerMove(depth, move);
                    break;
                }
            }

            // 存入置换表
            if (this.config.useTranspositionTable) {
                this.storeTableEntry(tableKey, depth, maxEval, alpha, beta);
            }

            return maxEval;
        } else {
            let minEval = Infinity;

            for (const move of candidates) {
                board[move.row][move.col] = this.opponent;
                const evalScore = this.alphaBeta(depth - 1, alpha, beta, true);
                board[move.row][move.col] = null;

                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);

                if (beta <= alpha) {
                    this.cutoffs++;
                    // 更新历史启发
                    this.historyTable[move.row][move.col] += depth * depth;
                    // 更新杀手启发
                    this.updateKillerMove(depth, move);
                    break;
                }
            }

            // 存入置换表
            if (this.config.useTranspositionTable) {
                this.storeTableEntry(tableKey, depth, minEval, alpha, beta);
            }

            return minEval;
        }
    }

    /**
     * 生成候选移动
     */
    generateCandidates() {
        const candidates = [];
        const board = this.game.board;
        const visited = new Set();

        // 检查已有棋子周围的位置
        let hasStone = false;
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] !== null) {
                    hasStone = true;
                    // 检查周围位置
                    for (let dr = -2; dr <= 2; dr++) {
                        for (let dc = -2; dc <= 2; dc++) {
                            if (dr === 0 && dc === 0) continue;
                            const nr = row + dr;
                            const nc = col + dc;
                            const key = `${nr},${nc}`;

                            if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 &&
                                board[nr][nc] === null &&
                                !visited.has(key)) {
                                visited.add(key);
                                candidates.push({ row: nr, col: nc });
                            }
                        }
                    }
                }
            }
        }

        // 如果棋盘为空，返回中心位置
        if (!hasStone) {
            return [
                { row: 7, col: 7 },
                { row: 7, col: 6 },
                { row: 7, col: 8 },
                { row: 6, col: 7 },
                { row: 8, col: 7 }
            ];
        }

        return candidates;
    }

    /**
     * 生成有序的移动列表（使用启发式排序）
     */
    generateOrderedMoves(isMaximizing) {
        const candidates = this.generateCandidates();
        const currentPlayer = isMaximizing ? this.player : this.opponent;

        // 为每个移动评分
        const scored = candidates.map(move => {
            let score = 0;

            // 基础位置价值
            score += LineDetector.getPositionValue(move.row, move.col);

            // 历史启发分数
            score += this.historyTable[move.row][move.col];

            // 威胁检测
            const board = this.game.board;
            board[move.row][move.col] = currentPlayer;
            const threats = LineDetector.detectThreats(board, currentPlayer, this.game);
            board[move.row][move.col] = null;

            // 高威胁优先
            score += threats.win.length * 50000;
            score += threats.liveFour.length * 10000;
            score += threats.rushFour.length * 5000;
            score += threats.liveThree.length * 1000;

            return { ...move, score };
        });

        // 降序排序
        scored.sort((a, b) => b.score - a.score);

        // 返回前N个候选（减少搜索宽度）
        const maxCandidates = this.getCandidateLimit();
        return scored.slice(0, maxCandidates);
    }

    /**
     * 获取候选移动数量限制
     */
    getCandidateLimit() {
        // 根据游戏阶段动态调整
        const moveCount = this.game.moveHistory?.length || 0;

        if (moveCount < 10) return 10;      // 开局阶段
        if (moveCount < 30) return 15;      // 中局阶段
        return 20;                          // 残局阶段
    }

    /**
     * 评估当前局面
     */
    evaluate() {
        const board = this.game.board;
        let score = 0;

        // 获取双方威胁
        const myThreats = LineDetector.detectThreats(board, this.player, this.game, { includePotentialThree: false });
        const opponentThreats = LineDetector.detectThreats(board, this.opponent, this.game, { includePotentialThree: false });

        // 计算威胁分数
        score += this.calculateThreatScore(myThreats);
        score -= this.calculateThreatScore(opponentThreats) * 1.1; // 对方威胁权重略高

        // 位置价值
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] === this.player) {
                    score += LineDetector.getPositionValue(row, col) * 0.1;
                } else if (board[row][col] === this.opponent) {
                    score -= LineDetector.getPositionValue(row, col) * 0.1;
                }
            }
        }

        return score;
    }

    /**
     * 计算威胁分数
     */
    calculateThreatScore(threats) {
        let score = 0;
        score += threats.win.length * 100000;
        score += threats.liveFour.length * 10000;
        score += threats.rushFour.length * 5000;
        score += threats.liveThree.length * 1000;
        score += threats.sleepThree.length * 300;
        score += threats.liveTwo.length * 100;
        score += threats.potentialThree.length * 50;
        return score;
    }

    /**
     * 生成置换表键
     */
    generateTableKey(depth, isMaximizing) {
        // 简单的哈希键（可以改进为更复杂的Zobrist哈希）
        const board = this.game.board;
        let key = `${depth}-${isMaximizing}`;

        // 添加棋盘状态（简化版）
        for (let row = 0; row < 15; row += 2) {
            for (let col = 0; col < 15; col += 2) {
                if (board[row][col] !== null) {
                    key += `${row}${col}${board[row][col]}`;
                }
            }
        }

        return key;
    }

    /**
     * 存储置换表条目
     */
    storeTableEntry(key, depth, score, alpha, beta) {
        let flag = 'exact';
        if (score <= alpha) {
            flag = 'upper';
        } else if (score >= beta) {
            flag = 'lower';
        }

        this.transpositionTable.set(key, {
            depth,
            score,
            flag
        });
    }

    /**
     * 更新杀手启发
     */
    updateKillerMove(depth, move) {
        if (depth > 0 && depth < this.killerMoves.length) {
            const killers = this.killerMoves[depth];

            // 避免重复
            if (!killers.some(k => k.row === move.row && k.col === move.col)) {
                killers.push({ ...move });
                // 只保留前2个杀手移动
                if (killers.length > 2) {
                    killers.shift();
                }
            }
        }
    }

    /**
     * 清空置换表
     */
    clearTable() {
        this.transpositionTable.clear();
    }

    /**
     * 重置历史启发
     */
    resetHistory() {
        this.historyTable = Array(15).fill(null).map(() => Array(15).fill(0));
    }

    /**
     * 获取搜索统计信息
     */
    getStats() {
        return {
            nodesSearched: this.nodesSearched,
            cutoffs: this.cutoffs,
            tableHits: this.tableHits,
            tableSize: this.transpositionTable.size,
            cutoffRate: this.nodesSearched > 0 ?
                (this.cutoffs / this.nodesSearched * 100).toFixed(2) + '%' : '0%'
        };
    }
    };
}

// ==================== 开局库系统 ====================
/**
 * 五子棋开局库
 * 包含常见开局定式和招法权重
 */
if (typeof OpeningBook === 'undefined') {
    window.OpeningBook = class OpeningBook {
    constructor() {
        // 开局定式库
        this.openings = this.initOpenings();

        // 招法权重表（基于历史对局学习）
        this.moveWeights = this.initMoveWeights();

        // 开局学习记录
        this.openingHistory = [];
        this.openingStats = {};
    }

    /**
     * 初始化开局定式库
     */
    initOpenings() {
        return {
            // ========== 直指开局 ==========
            // 花月（最强开局之一）
            'huayue': {
                name: '花月',
                moves: [
                    { row: 7, col: 7 },   // 天元
                    { row: 8, col: 8 },   // 斜向
                    { row: 8, col: 7 },   // 直向
                    { row: 6, col: 8 },
                    { row: 9, col: 7 }
                ],
                weight: 100,
                characteristics: ['进攻', '灵活', '多变']
            },
            // 浦月
            'puyue': {
                name: '浦月',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 8 },
                    { row: 6, col: 6 },
                    { row: 9, col: 9 },
                    { row: 5, col: 5 }
                ],
                weight: 95,
                characteristics: ['稳健', '防守反击']
            },
            // 云月
            'yunyue': {
                name: '云月',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 7 },
                    { row: 8, col: 8 },
                    { row: 6, col: 7 },
                    { row: 9, col: 7 }
                ],
                weight: 85,
                characteristics: ['平衡', '均衡发展']
            },
            // 雨月
            'yuyue': {
                name: '雨月',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 7 },
                    { row: 7, col: 8 },
                    { row: 9, col: 7 },
                    { row: 9, col: 8 }
                ],
                weight: 80,
                characteristics: ['控制', '阵地战']
            },
            // 寒星
            'hanxing': {
                name: '寒星',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 7 },
                    { row: 6, col: 7 },
                    { row: 9, col: 7 },
                    { row: 5, col: 7 }
                ],
                weight: 75,
                characteristics: ['直指', '单一方向']
            },

            // ========== 斜指开局 ==========
            // 残月
            'canyue': {
                name: '残月',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 8 },
                    { row: 6, col: 6 },
                    { row: 9, col: 9 },
                    { row: 5, col: 5 }
                ],
                weight: 90,
                characteristics: ['斜指', '攻击性强']
            },
            // 新月
            'xinyue': {
                name: '新月',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 8 },
                    { row: 7, col: 8 },
                    { row: 9, col: 9 },
                    { row: 6, col: 8 }
                ],
                weight: 85,
                characteristics: ['灵活', '多变']
            },
            // 水月
            'shuiyue': {
                name: '水月',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 8 },
                    { row: 9, col: 7 },
                    { row: 6, col: 6 },
                    { row: 9, col: 8 }
                ],
                weight: 80,
                characteristics: ['流畅', '连贯']
            },
            // 山月
            'shanyue': {
                name: '山月',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 8 },
                    { row: 8, col: 7 },
                    { row: 9, col: 9 },
                    { row: 9, col: 8 }
                ],
                weight: 75,
                characteristics: ['稳健', '厚重']
            },

            // ========== 特殊开局 ==========
            // 游星（对手应对不当可速胜）
            'youxing': {
                name: '游星',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 6 },
                    { row: 6, col: 8 },
                    { row: 9, col: 5 },
                    { row: 5, col: 9 }
                ],
                weight: 70,
                characteristics: ['冒险', '投机']
            },
            // 丘月（变化较多）
            'qiuyue': {
                name: '丘月',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 7 },
                    { row: 7, col: 6 },
                    { row: 9, col: 7 },
                    { row: 7, col: 8 }
                ],
                weight: 85,
                characteristics: ['均衡', '变化多']
            },
            // 松月（灵活多变）
            'songyue': {
                name: '松月',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 8 },
                    { row: 8, col: 7 },
                    { row: 7, col: 8 },
                    { row: 9, col: 8 }
                ],
                weight: 88,
                characteristics: ['灵活', '多变']
            },
            // 陨星（对手应对不当可速胜）
            'yunxing': {
                name: '陨星',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 6 },
                    { row: 6, col: 8 },
                    { row: 9, col: 7 },
                    { row: 5, col: 9 }
                ],
                weight: 65,
                characteristics: ['冒险', '需要精确计算']
            },
            // 瑞星（变化丰富）
            'ruixing': {
                name: '瑞星',
                moves: [
                    { row: 7, col: 7 },
                    { row: 8, col: 8 },
                    { row: 6, col: 6 },
                    { row: 9, col: 9 },
                    { row: 8, col: 7 }
                ],
                weight: 92,
                characteristics: ['平衡', '变化丰富']
            }
        };
    }

    /**
     * 初始化招法权重表
     */
    initMoveWeights() {
        // 15x15棋盘，每个位置的权重
        const weights = Array(15).fill(null).map(() => Array(15).fill(0));

        // 中心区域权重高
        for (let r = 5; r <= 9; r++) {
            for (let c = 5; c <= 9; c++) {
                weights[r][c] = 50;
            }
        }

        // 天元位置权重最高
        weights[7][7] = 100;

        // 天元周围位置权重高
        const aroundCenter = [
            [7, 6], [7, 8], [6, 7], [8, 7],
            [6, 6], [6, 8], [8, 6], [8, 8]
        ];
        for (const [r, c] of aroundCenter) {
            weights[r][c] = 80;
        }

        return weights;
    }

    /**
     * 根据当前局面查询开局库
     * @param {Array} moveHistory - 走法历史
     * @param {string} player - 当前玩家
     * @returns {Object|null} - 推荐的开局招法
     */
    query(moveHistory, player) {
        // 前10步使用开局库
        if (moveHistory.length >= 10) {
            return null;
        }

        // 检查是否匹配某个开局定式
        for (const [key, opening] of Object.entries(this.openings)) {
            const match = this.matchOpening(moveHistory, opening, player);
            if (match) {
                return {
                    opening: key,
                    name: opening.name,
                    move: match,
                    weight: opening.weight,
                    characteristics: opening.characteristics
                };
            }
        }

        // 没有匹配的开局，返回基于权重的推荐
        return this.getWeightedRecommendation(moveHistory, player);
    }

    /**
     * 检查是否匹配开局定式
     */
    matchOpening(moveHistory, opening, player) {
        const board = this.createBoardFromHistory(moveHistory);
        const moves = opening.moves;
        const moveIndex = moveHistory.length;

        // 检查是否到了这个开局的招法
        if (moveIndex >= moves.length) {
            return null;
        }

        // 检查之前的招法是否匹配
        for (let i = 0; i < moveIndex; i++) {
            const expectedMove = moves[i];
            const actualMove = moveHistory[i];

            // 考虑棋盘对称性（镜像和旋转）
            if (!this.isEquivalentMove(expectedMove, actualMove, board)) {
                return null;
            }
        }

        // 返回下一个推荐招法
        return moves[moveIndex];
    }

    /**
     * 检查两个招法是否等价（考虑对称性）
     */
    isEquivalentMove(move1, move2, board) {
        // 直接匹配
        if (move1.row === move2.row && move1.col === move2.col) {
            return true;
        }

        // 水平镜像
        if (move1.row === move2.row && move1.col === 14 - move2.col) {
            return true;
        }

        // 垂直镜像
        if (move1.row === 14 - move2.row && move1.col === move2.col) {
            return true;
        }

        // 对角线镜像
        if (move1.row === move2.col && move1.col === move2.row) {
            return true;
        }

        return false;
    }

    /**
     * 创建棋盘状态
     */
    createBoardFromHistory(moveHistory) {
        const board = Array(15).fill(null).map(() => Array(15).fill(null));

        for (let i = 0; i < moveHistory.length; i++) {
            const move = moveHistory[i];
            const player = i % 2 === 0 ? 'black' : 'white';
            board[move.row][move.col] = player;
        }

        return board;
    }

    /**
     * 获取基于权重的推荐招法
     */
    getWeightedRecommendation(moveHistory, player) {
        const board = this.createBoardFromHistory(moveHistory);
        let bestMove = null;
        let bestWeight = 0;

        // 获取所有空位
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] === null) {
                    // 只考虑已有棋子周围的位置
                    if (this.hasNeighbor(board, row, col)) {
                        const weight = this.moveWeights[row][col];
                        if (weight > bestWeight) {
                            bestWeight = weight;
                            bestMove = { row, col };
                        }
                    }
                }
            }
        }

        // 棋盘为空，返回天元
        if (!bestMove) {
            return { move: { row: 7, col: 7 }, weight: 100 };
        }

        return { move: bestMove, weight: bestWeight };
    }

    /**
     * 检查位置是否有邻近棋子
     */
    hasNeighbor(board, row, col) {
        // 棋盘为空，天元位置返回true
        let hasStone = false;
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (board[r][c] !== null) {
                    hasStone = true;
                    break;
                }
            }
            if (hasStone) break;
        }

        if (!hasStone) {
            return row === 7 && col === 7;
        }

        // 检查2格范围内是否有棋子
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15) {
                    if (board[nr][nc] !== null) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * 记录开局使用情况（用于学习）
     */
    recordOpening(openingKey, result) {
        if (!this.openingStats[openingKey]) {
            this.openingStats[openingKey] = {
                used: 0,
                wins: 0,
                losses: 0,
                draws: 0
            };
        }

        const stats = this.openingStats[openingKey];
        stats.used++;

        if (result === 'win') {
            stats.wins++;
        } else if (result === 'loss') {
            stats.losses++;
        } else {
            stats.draws++;
        }

        // 根据胜率调整开局权重
        this.adjustOpeningWeight(openingKey, stats);
    }

    /**
     * 根据胜率调整开局权重
     */
    adjustOpeningWeight(openingKey, stats) {
        if (!this.openings[openingKey]) return;

        const winRate = stats.wins / stats.used;
        const baseWeight = this.openings[openingKey].weight;

        // 胜率高于60%增加权重，低于40%降低权重
        if (stats.used >= 5) {
            if (winRate > 0.6) {
                this.openings[openingKey].weight = Math.min(150, baseWeight + 5);
            } else if (winRate < 0.4) {
                this.openings[openingKey].weight = Math.max(50, baseWeight - 5);
            }
        }
    }

    /**
     * 获取开局统计信息
     */
    getOpeningStats(openingKey = null) {
        if (openingKey) {
            return this.openingStats[openingKey] || null;
        }
        return this.openingStats;
    }

    /**
     * 随机选择一个开局（用于增加多样性）
     */
    selectRandomOpening(exclude = []) {
        const available = Object.entries(this.openings)
            .filter(([key]) => !exclude.includes(key))
            .map(([key, opening]) => ({ key, weight: opening.weight }));

        // 加权随机选择
        const totalWeight = available.reduce((sum, o) => sum + o.weight, 0);
        let random = Math.random() * totalWeight;

        for (const { key, weight } of available) {
            random -= weight;
            if (random <= 0) {
                return key;
            }
        }

        return available[0]?.key || 'huayue';
    }

    /**
     * 获取推荐的开局列表
     */
    getRecommendedOpenings(count = 5) {
        return Object.entries(this.openings)
            .sort((a, b) => b[1].weight - a[1].weight)
            .slice(0, count)
            .map(([key, opening]) => ({
                key,
                name: opening.name,
                weight: opening.weight,
                characteristics: opening.characteristics
            }));
    }

    /**
     * 导出开局数据（用于保存学习结果）
     */
    exportData() {
        return {
            openings: this.openings,
            stats: this.openingStats,
            moveWeights: this.moveWeights
        };
    }

    /**
     * 导入开局数据
     */
    importData(data) {
        if (data.openings) {
            this.openings = { ...this.openings, ...data.openings };
        }
        if (data.stats) {
            this.openingStats = { ...this.openingStats, ...data.stats };
        }
        if (data.moveWeights) {
            this.moveWeights = data.moveWeights;
        }
    }
    };
}

// ==================== 威胁空间搜索 ====================
/**
 * 威胁空间搜索类
 * 专门用于五子棋终局的高效搜索
 */
if (typeof ThreatSpaceSearch === 'undefined') {
    window.ThreatSpaceSearch = class ThreatSpaceSearch {
    constructor(game, player) {
        this.game = game;
        this.player = player;
        this.opponent = player === 'black' ? 'white' : 'black';

        // 搜索统计
        this.threatsAnalyzed = 0;
        this.sequencesFound = 0;
    }

    /**
     * 主搜索入口 - 查找必胜序列
     * @returns {Object|null} - 必胜招法或null
     */
    findWinningSequence(maxDepth = 6) {
        this.threatsAnalyzed = 0;
        this.sequencesFound = 0;

        // 检查是否有立即获胜
        const immediateWin = this.findImmediateWin();
        if (immediateWin) {
            return {
                type: 'immediate',
                move: immediateWin,
                depth: 1
            };
        }

        // 检查是否有双重威胁（双三、双四）
        const doubleThreat = this.findDoubleThreat();
        if (doubleThreat) {
            return {
                type: 'double_threat',
                move: doubleThreat,
                depth: 2
            };
        }

        // 深度搜索威胁序列
        const sequence = this.searchThreatSequence(maxDepth);
        if (sequence) {
            return sequence;
        }

        return null;
    }

    /**
     * 查找立即获胜的招法
     */
    findImmediateWin() {
        const board = this.game.board;

        // 检查五连
        const winInfo = LineDetector.detectWin(board, this.player);
        if (winInfo.hasWin) {
            // 找到完成五连的位置
            for (let row = 0; row < 15; row++) {
                for (let col = 0; col < 15; col++) {
                    if (board[row][col] === null && this.game.canPlaceStone?.(row, col)) {
                        board[row][col] = this.player;
                        const wouldWin = this.game.checkWin?.(row, col);
                        board[row][col] = null;

                        if (wouldWin) {
                            return { row, col };
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * 查找双重威胁（双三、双四、四三）
     */
    findDoubleThreat() {
        const board = this.game.board;
        const candidates = this.generateCandidates();

        for (const candidate of candidates) {
            board[candidate.row][candidate.col] = this.player;
            const threats = LineDetector.detectThreats(board, this.player, this.game);
            board[candidate.row][candidate.col] = null;

            // 检查是否形成双重威胁
            const threatCount = threats.liveFour.length +
                               threats.rushFour.length +
                               threats.liveThree.length;

            if (threatCount >= 2) {
                // 检查对方能否同时防守两个威胁
                const canDefendAll = this.canDefendAllThreats(threats);
                if (!canDefendAll) {
                    return candidate;
                }
            }
        }

        return null;
    }

    /**
     * 检查对方是否能防守所有威胁
     */
    canDefendAllThreats(threats) {
        let defenseCount = 0;

        // 检查每个威胁需要多少防守招法
        for (const four of threats.liveFour) {
            defenseCount += 2; // 活四需要两步防守
        }
        for (const four of threats.rushFour) {
            defenseCount += 1;
        }
        for (const three of threats.liveThree) {
            defenseCount += 1;
        }

        return defenseCount <= 1;
    }

    /**
     * 搜索威胁序列
     */
    searchThreatSequence(maxDepth) {
        const sequence = [];

        for (let depth = 2; depth <= maxDepth; depth++) {
            const result = this.depthLimitedSearch(depth, sequence, true);
            if (result) {
                return {
                    type: 'sequence',
                    sequence: result,
                    depth: depth
                };
            }
        }

        return null;
    }

    /**
     * 深度受限的威胁搜索
     */
    depthLimitedSearch(depth, sequence, isMaximizing) {
        if (depth === 0) {
            // 检查当前状态是否必胜
            const board = this.game.board;
            const myThreats = LineDetector.detectThreats(board, this.player, this.game);

            if (myThreats.win.length > 0) {
                return sequence;
            }

            return null;
        }

        const board = this.game.board;
        const candidates = this.generateOrderedThreatCandidates(isMaximizing);

        for (const candidate of candidates) {
            // 模拟招法
            board[candidate.row][candidate.col] = isMaximizing ? this.player : this.opponent;

            // 检查是否产生新的威胁
            const threats = LineDetector.detectThreats(board, isMaximizing ? this.player : this.opponent, this.game);
            this.threatsAnalyzed++;

            if (isMaximizing) {
                // 己方招法：检查是否创造必胜威胁
                if (this.isWinningThreat(threats)) {
                    sequence.push({ ...candidate, type: 'attack' });

                    // 递归搜索
                    const result = this.depthLimitedSearch(depth - 1, sequence, false);

                    if (result) {
                        board[candidate.row][candidate.col] = null;
                        return result;
                    }

                    sequence.pop();
                }
            } else {
                // 对方招法：检查防守是否有效
                if (!this.isLosingPosition(threats)) {
                    sequence.push({ ...candidate, type: 'defend' });

                    const result = this.depthLimitedSearch(depth - 1, sequence, true);

                    if (result) {
                        board[candidate.row][candidate.col] = null;
                        return result;
                    }

                    sequence.pop();
                }
            }

            // 撤销招法
            board[candidate.row][candidate.col] = null;
        }

        return null;
    }

    /**
     * 检查威胁是否必胜
     */
    isWinningThreat(threats) {
        return threats.win.length > 0 ||
               threats.liveFour.length > 0 ||
               (threats.rushFour.length >= 2) ||
               (threats.rushFour.length >= 1 && threats.liveThree.length >= 1);
    }

    /**
     * 检查位置是否必败
     */
    isLosingPosition(threats) {
        return threats.win.length > 0 ||
               threats.liveFour.length > 0;
    }

    /**
     * 生成威胁候选招法
     */
    generateOrderedThreatCandidates(isMaximizing) {
        const candidates = this.generateCandidates();
        const currentPlayer = isMaximizing ? this.player : this.opponent;

        // 为每个候选招法评分
        const scored = candidates.map(move => {
            let score = 0;
            const board = this.game.board;

            board[move.row][move.col] = currentPlayer;
            const threats = LineDetector.detectThreats(board, currentPlayer, this.game);
            board[move.row][move.col] = null;

            // 高威胁优先
            score += threats.win.length * 100000;
            score += threats.liveFour.length * 10000;
            score += threats.rushFour.length * 5000;
            score += threats.liveThree.length * 1000;

            // 位置价值
            score += LineDetector.getPositionValue(move.row, move.col) * 0.5;

            return { ...move, score };
        });

        // 降序排序
        scored.sort((a, b) => b.score - a.score);

        // 只返回高价值候选
        return scored.slice(0, 8);
    }

    /**
     * 生成候选招法
     */
    generateCandidates() {
        const candidates = [];
        const board = this.game.board;
        const visited = new Set();

        // 检查已有棋子周围的位置
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] !== null) {
                    // 检查周围2格内的位置
                    for (let dr = -2; dr <= 2; dr++) {
                        for (let dc = -2; dc <= 2; dc++) {
                            if (dr === 0 && dc === 0) continue;
                            const nr = row + dr;
                            const nc = col + dc;
                            const key = `${nr},${nc}`;

                            if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 &&
                                board[nr][nc] === null &&
                                !visited.has(key)) {
                                visited.add(key);
                                candidates.push({ row: nr, col: nc });
                            }
                        }
                    }
                }
            }
        }

        // 如果棋盘为空，返回中心位置
        if (candidates.length === 0) {
            return [
                { row: 7, col: 7 },
                { row: 7, col: 6 },
                { row: 7, col: 8 },
                { row: 6, col: 7 },
                { row: 8, col: 7 }
            ];
        }

        return candidates;
    }

    /**
     * 检查是否有必胜防守
     */
    findCriticalDefense() {
        const board = this.game.board;
        const opponentThreats = LineDetector.detectThreats(board, this.opponent, this.game);

        // 检查对方是否有必胜威胁
        if (opponentThreats.win.length > 0) {
            // 必须防守
            for (let row = 0; row < 15; row++) {
                for (let col = 0; col < 15; col++) {
                    if (board[row][col] === null) {
                        board[row][col] = this.opponent;
                        const wouldWin = this.game.checkWin?.(row, col);
                        board[row][col] = null;

                        if (wouldWin) {
                            return { row, col, type: 'block_win' };
                        }
                    }
                }
            }
        }

        // 检查对方活四
        if (opponentThreats.liveFour.length > 0) {
            // 找到防守位置
            for (const threat of opponentThreats.liveFour) {
                // 防守活四的两端
                const defenses = this.findDefensePositions(threat);
                for (const defense of defenses) {
                    return { ...defense, type: 'block_live_four' };
                }
            }
        }

        // 检查对方冲四
        if (opponentThreats.rushFour.length > 0) {
            for (const threat of opponentThreats.rushFour) {
                const defenses = this.findDefensePositions(threat);
                for (const defense of defenses) {
                    return { ...defense, type: 'block_rush_four' };
                }
            }
        }

        return null;
    }

    /**
     * 查找威胁的防守位置
     */
    findDefensePositions(threat) {
        const defenses = [];
        const { startRow, startCol, dr, dc, count, openEnds } = threat;

        // 检查两端是否可防守
        if (openEnds > 0) {
            // 正向端点
            let r = startRow + dr * (count + 1);
            let c = startCol + dc * (count + 1);
            if (r >= 0 && r < 15 && c >= 0 && c < 15 && this.game.board[r][c] === null) {
                defenses.push({ row: r, col: c });
            }

            // 反向端点
            if (openEnds > 1) {
                r = startRow - dr;
                c = startCol - dc;
                if (r >= 0 && r < 15 && c >= 0 && c < 15 && this.game.board[r][c] === null) {
                    defenses.push({ row: r, col: c });
                }
            }
        }

        return defenses;
    }

    /**
     * 获取搜索统计信息
     */
    getStats() {
        return {
            threatsAnalyzed: this.threatsAnalyzed,
            sequencesFound: this.sequencesFound
        };
    }
    };
}

// ==================== 技能组合连击系统 ====================
/**
 * 技能组合连击系统
 * 检测和执行技能组合效果
 */
if (typeof SkillComboSystem === 'undefined') {
    window.SkillComboSystem = class SkillComboSystem {
    constructor(game) {
        this.game = game;
        this.recentSkills = {
            black: [],
            white: []
        };
        this.maxHistory = 5; // 记录最近5个技能
        this.activeCombos = [];
        this.comboMultiplier = 1;
    }

    /**
     * 记录使用的技能
     */
    recordSkill(player, skillId) {
        this.recentSkills[player].push({
            skillId: skillId,
            turn: this.game.moveHistory?.length || 0,
            timestamp: Date.now()
        });

        // 限制历史长度
        if (this.recentSkills[player].length > this.maxHistory) {
            this.recentSkills[player].shift();
        }

        // 检查组合
        const combo = this.checkCombo(player);
        if (combo) {
            this.activateCombo(combo);
        }
    }

    /**
     * 检查是否触发组合
     */
    checkCombo(player) {
        const history = this.recentSkills[player];
        if (history.length < 2) return null;

        const recentIds = history.map(h => h.skillId);

        // 检查预定义组合
        for (const comboType of Object.values(SKILL_COMBOS)) {
            for (const combo of comboType) {
                if (this.matchCombo(recentIds, combo.skills)) {
                    return combo;
                }
            }
        }

        // 检查动态组合（基于分类）
        const dynamicCombo = this.checkDynamicCombo(player, recentIds);
        if (dynamicCombo) {
            return dynamicCombo;
        }

        return null;
    }

    /**
     * 匹配预定义组合
     */
    matchCombo(recentIds, comboSkills) {
        // 组合必须按顺序使用
        const comboLen = comboSkills.length;
        if (recentIds.length < comboLen) return false;

        // 检查最近N个技能是否匹配
        const lastUsed = recentIds.slice(-comboLen);
        return this.arraysEqual(lastUsed, comboSkills);
    }

    /**
     * 检查动态组合
     */
    checkDynamicCombo(player, recentIds) {
        const last3 = recentIds.slice(-3);

        // 进攻+进攻：连续使用2个进攻技能
        const offensiveCount = last3.filter(id => SKILL_CATEGORY.OFFENSIVE.includes(id)).length;
        if (offensiveCount >= 2) {
            return {
                name: '双重进攻',
                type: 'offensive_chain',
                bonus: 25,
                skills: last3
            };
        }

        // 防守+控制：先防守后控制
        const hasDefense = last3.some(id => SKILL_CATEGORY.DEFENSIVE.includes(id));
        const hasControl = last3.some(id => SKILL_CATEGORY.CONTROL.includes(id));
        if (hasDefense && hasControl) {
            return {
                name: '防御控制',
                type: 'defense_control',
                bonus: 30,
                skills: last3
            };
        }

        // 能量+技能：能量获取后立即使用技能
        const hasEnergy = last3.some(id => SKILL_CATEGORY.ENERGY.includes(id));
        if (hasEnergy && last3.length >= 2) {
            return {
                name: '能量释放',
                type: 'energy_release',
                bonus: 20,
                skills: last3
            };
        }

        // 翻盘组合：逆境中使用2个翻盘技能
        const comebackCount = last3.filter(id => SKILL_CATEGORY.COMEBACK.includes(id)).length;
        if (comebackCount >= 2) {
            return {
                name: '绝地反击',
                type: 'comeback_chain',
                bonus: 50,
                skills: last3
            };
        }

        return null;
    }

    /**
     * 激活组合效果
     */
    activateCombo(combo) {
        this.activeCombos.push({
            ...combo,
            turn: this.game.moveHistory?.length || 0,
            remainingTurns: 2
        });

        // 应用组合加成
        this.comboMultiplier = 1 + (combo.bonus / 100);

        this.game.showEffect(7, 7, `⚡ ${combo.name}! +${combo.bonus}% 效果!`);
    }

    /**
     * 获取当前组合加成
     */
    getComboBonus(skillId) {
        let totalBonus = 0;

        for (const combo of this.activeCombos) {
            // 检查技能是否在组合中
            if (combo.skills?.includes(skillId)) {
                totalBonus += combo.bonus;
            }
        }

        return totalBonus;
    }

    /**
     * 获取技能的调整后成本
     */
    getAdjustedCost(skillId, originalCost) {
        const bonus = this.getComboBonus(skillId);
        const reduction = Math.floor(originalCost * (bonus / 100));
        return Math.max(1, originalCost - reduction);
    }

    /**
     * 获取技能的调整后效果
     */
    getAdjustedEffect(skillId, baseEffect) {
        const bonus = this.getComboBonus(skillId);
        return baseEffect * (1 + bonus / 100);
    }

    /**
     * 更新组合状态（每回合调用）
     */
    updateCombos() {
        // 减少组合剩余回合
        this.activeCombos = this.activeCombos.filter(combo => {
            combo.remainingTurns--;
            return combo.remainingTurns > 0;
        });

        // 重置倍率
        if (this.activeCombos.length === 0) {
            this.comboMultiplier = 1;
        }
    }

    /**
     * 获取推荐组合技能
     */
    getRecommendedCombos(player) {
        const history = this.recentSkills[player];
        const availableSkills = this.game.currentSkillPool || [];
        const recommendations = [];

        // 找出可以形成组合的技能
        for (const comboType of Object.values(SKILL_COMBOS)) {
            for (const combo of comboType) {
                const used = this.countUsedSkills(history, combo.skills);
                if (used > 0 && used < combo.skills.length) {
                    const nextSkill = combo.skills[used];
                    const available = availableSkills.find(s => s.id === nextSkill);

                    if (available && available.canUse?.(this.game, player)) {
                        recommendations.push({
                            comboName: combo.name,
                            skillId: nextSkill,
                            skill: available,
                            progress: `${used}/${combo.skills.length}`,
                            bonus: combo.bonus
                        });
                    }
                }
            }
        }

        return recommendations;
    }

    /**
     * 计算已使用的组合技能数
     */
    countUsedSkills(history, comboSkills) {
        let count = 0;
        const recentIds = history.map(h => h.skillId);

        for (let i = 0; i < comboSkills.length; i++) {
            if (recentIds.includes(comboSkills[i])) {
                count++;
            }
        }

        return count;
    }

    /**
     * 数组相等比较
     */
    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }

    /**
     * 获取组合统计信息
     */
    getComboStats() {
        return {
            activeCombos: this.activeCombos.length,
            multiplier: this.comboMultiplier,
            recentSkills: this.recentSkills
        };
    }

    /**
     * 重置系统
     */
    reset() {
        this.recentSkills = { black: [], white: [] };
        this.activeCombos = [];
        this.comboMultiplier = 1;
    }
    };
}

// ==================== AI主类 ====================
if (typeof GomokuAI === 'undefined') {
    window.GomokuAI = class GomokuAI {
    constructor(game, player, difficulty = 'hard') {
        this.game = game;
        this.player = player;
        this.difficulty = 'hard';
        this.config = AI_CONFIG.hard;
        this.isThinking = false;
        this.skillsDisabled = true; // AI固定禁用技能

        // 困难难度专用
        this.turnCount = 0;
        this.lastSkillUsed = null;
        this.skillHistory = [];

        // 单一AI模式固定启用开局库
        this.openingBook = new OpeningBook();
    }

    /**
     * 主决策函数
     */
    makeDecision() {
        aiLog('[AI] makeDecision called, mode: AI');

        const opponent = this.getOpponent();
        const board = this.game.board;

        aiLog('[AI] Board state:', board);
        aiLog('[AI] Current player:', this.player, 'Opponent:', opponent);

        return this.makeDecisionHard(board, opponent);
    }

    /**
     * 简单难度决策（增强版）
     */
    makeDecisionEasy(board, opponent) {
        aiLog('[AI] makeDecisionEasy: Start');

        // 获取双方的威胁信息
        const myThreats = LineDetector.detectThreats(board, this.player, this.game, { includePotentialThree: false });
        const opponentThreats = LineDetector.detectThreats(board, opponent, this.game, { includePotentialThree: false });

        aiLog('[AI] makeDecisionEasy: My threats:', myThreats);
        aiLog('[AI] makeDecisionEasy: Opponent threats:', opponentThreats);

        // 优先级1：自己能赢
        if (myThreats.win.length > 0) {
            const winPosition = this.findWinPosition(this.player);
            if (winPosition) {
                aiLog('[AI] Easy: Found winning move');
                return { action: 'place', row: winPosition.row, col: winPosition.col };
            }
        }

        // 优先级2：对方要赢，必须防守
        if (opponentThreats.win.length > 0) {
            const blockPosition = this.findBlockPosition(opponent);
            if (blockPosition) {
                aiLog('[AI] Easy: Blocking opponent win');
                return { action: 'place', row: blockPosition.row, col: blockPosition.col };
            }
        }

        // 优先级3：自己有活四，直接赢
        if (myThreats.liveFour.length > 0) {
            // 找到能将活四完成成五连的位置
            const winPosition = this.findWinPosition(this.player);
            if (winPosition) {
                aiLog('[AI] Easy: Completing live four to win at', winPosition.row, winPosition.col);
                return { action: 'place', row: winPosition.row, col: winPosition.col };
            }
            // 如果找不到直接获胜的位置，尝试形成新的活四
            const position = this.findLiveFourPosition(this.player);
            if (position) {
                aiLog('[AI] Easy: Found additional live four at', position.row, position.col);
                return { action: 'place', row: position.row, col: position.col };
            }
        }

        // 优先级4：对方有活四，必须防守
        if (opponentThreats.liveFour.length > 0) {
            // 找到对方活四威胁的防守位置
            const blockPosition = this.findLiveFourBlockPosition(opponentThreats);
            if (blockPosition) {
                aiLog('[AI] Easy: Blocking opponent live four at', blockPosition.row, blockPosition.col);
                return { action: 'place', row: blockPosition.row, col: blockPosition.col };
            }
            // 如果找不到特定的防守位置，尝试找到对方可能获胜的位置并阻止
            const blockWin = this.findBlockPosition(opponent);
            if (blockWin) {
                aiLog('[AI] Easy: Blocking opponent win at', blockWin.row, blockWin.col);
                return { action: 'place', row: blockWin.row, col: blockWin.col };
            }
        }

        // 优先级5：对方有冲四，需要防守
        if (opponentThreats.rushFour.length > 0) {
            const position = this.findRushFourPosition(opponent);
            if (position) {
                aiLog('[AI] Easy: Blocking opponent rush four');
                return { action: 'place', row: position.row, col: position.col };
            }
        }

        // 优先级6：自己有活三，优先发展
        if (myThreats.liveThree.length > 0) {
            const position = this.findLiveThreePosition(this.player);
            if (position) {
                aiLog('[AI] Easy: Found live three');
                return { action: 'place', row: position.row, col: position.col };
            }
        }

        // 优先级7：阻止对方活三（固定执行，避免随机漏防）
        if (opponentThreats.liveThree.length > 0) {
            const position = this.findLiveThreePosition(opponent);
            if (position) {
                aiLog('[AI] Easy: Blocking opponent live three');
                return { action: 'place', row: position.row, col: position.col };
            }
        }

        // 选择最佳位置（使用改进的评估方法）
        aiLog('[AI] Easy: Calling selectBestPositionSmart');
        const bestMove = this.selectBestPositionSmart(myThreats, opponentThreats, 0);
        aiLog('[AI] Easy: Selected position:', bestMove);
        return {
            action: 'place',
            row: bestMove.row,
            col: bestMove.col
        };
    }

    /**
     * 中等难度决策
     */
    makeDecisionMedium(board, opponent) {
        const myThreats = LineDetector.detectThreats(board, this.player, this.game, { includePotentialThree: false });
        const opponentThreats = LineDetector.detectThreats(board, opponent, this.game, { includePotentialThree: false });

        // 优先级处理
        if (myThreats.win.length > 0) {
            const winPosition = this.findWinPosition(this.player);
            if (winPosition) {
                return { action: 'place', row: winPosition.row, col: winPosition.col };
            }
        }

        if (opponentThreats.win.length > 0) {
            const blockPosition = this.findBlockPosition(opponent);
            if (blockPosition) {
                return { action: 'place', row: blockPosition.row, col: blockPosition.col };
            }
        }

        if (myThreats.liveFour.length > 0) {
            // 找到能将活四完成成五连的位置
            const winPosition = this.findWinPosition(this.player);
            if (winPosition) {
                aiLog('[AI] Medium: Completing live four to win at', winPosition.row, winPosition.col);
                return { action: 'place', row: winPosition.row, col: winPosition.col };
            }
            // 如果找不到直接获胜的位置，尝试形成新的活四
            const position = this.findLiveFourPosition(this.player);
            if (position) {
                aiLog('[AI] Medium: Found additional live four at', position.row, position.col);
                return { action: 'place', row: position.row, col: position.col };
            }
        }

        if (opponentThreats.liveFour.length > 0) {
            // 找到对方活四威胁的防守位置
            const blockPosition = this.findLiveFourBlockPosition(opponentThreats);
            if (blockPosition) {
                aiLog('[AI] Medium: Blocking opponent live four at', blockPosition.row, blockPosition.col);
                return { action: 'place', row: blockPosition.row, col: blockPosition.col };
            }
            // 如果找不到特定的防守位置，尝试找到对方可能获胜的位置并阻止
            const blockWin = this.findBlockPosition(opponent);
            if (blockWin) {
                aiLog('[AI] Medium: Blocking opponent win at', blockWin.row, blockWin.col);
                return { action: 'place', row: blockWin.row, col: blockWin.col };
            }
        }

        if (opponentThreats.rushFour.length > 0) {
            // 找到对方冲四威胁的防守位置
            const blockPosition = this.findRushFourBlockPosition(opponentThreats);
            if (blockPosition) {
                aiLog('[AI] Medium: Blocking opponent rush four at', blockPosition.row, blockPosition.col);
                return { action: 'place', row: blockPosition.row, col: blockPosition.col };
            }
        }

        // 检查双重威胁（两个活三）
        const doubleThreat = this.findDoubleThreat(myThreats);
        if (doubleThreat) {
            return { action: 'place', row: doubleThreat.row, col: doubleThreat.col };
        }

        // 检查对方的活三，必须防守
        if (opponentThreats.liveThree.length >= 2) {
            // 对方有多个活三，需要阻止
            const position = this.findBestBlockPosition(opponentThreats);
            if (position) {
                return { action: 'place', row: position.row, col: position.col };
            }
        }

        // 使用智能位置选择（确定性）
        const bestMove = this.selectBestPositionSmart(myThreats, opponentThreats, 0);
        return {
            action: 'place',
            row: bestMove.row,
            col: bestMove.col
        };
    }

    /**
     * 困难难度决策
     */
    makeDecisionHard(board, opponent) {
        this.turnCount++;
        const moveCount = this.game.moveHistory?.length || 0;

        // 全面威胁检测
        const myThreats = LineDetector.detectThreats(board, this.player, this.game, { includePotentialThree: false });
        const opponentThreats = LineDetector.detectThreats(board, opponent, this.game, { includePotentialThree: false });

        // 计算威胁分数
        const myThreatScore = LineDetector.calculateThreatScore(myThreats);
        const opponentThreatScore = LineDetector.calculateThreatScore(opponentThreats);
        const threatAdvantage = myThreatScore - opponentThreatScore;

        aiLog('[AI] Hard: My threats:', myThreats, 'Opponent threats:', opponentThreats);

        // ========== 最高优先级：必胜/必防 ==========
        // 优先级1：自己能赢
        if (myThreats.win.length > 0) {
            const winPosition = this.findWinPosition(this.player);
            if (winPosition) {
                aiLog('[AI] Hard: Found winning move');
                return { action: 'place', row: winPosition.row, col: winPosition.col };
            }
        }

        // 优先级2：对方要赢，必须防守
        if (opponentThreats.win.length > 0) {
            const blockPosition = this.findBlockPosition(opponent);
            if (blockPosition) {
                aiLog('[AI] Hard: Blocking opponent win');
                return { action: 'place', row: blockPosition.row, col: blockPosition.col };
            }
        }

        // 优先级3：自己有活四，直接赢
        if (myThreats.liveFour.length > 0) {
            // 找到能将活四完成成五连的位置
            const winPosition = this.findWinPosition(this.player);
            if (winPosition) {
                aiLog('[AI] Hard: Completing live four to win at', winPosition.row, winPosition.col);
                return { action: 'place', row: winPosition.row, col: winPosition.col };
            }
            // 如果找不到直接获胜的位置，尝试形成更多的活四
            const position = this.findLiveFourPosition(this.player);
            if (position) {
                aiLog('[AI] Hard: Found additional live four at', position.row, position.col);
                return { action: 'place', row: position.row, col: position.col };
            }
        }

        // 优先级4：对方有活四，必须防守
        if (opponentThreats.liveFour.length > 0) {
            // 找到对方活四威胁的防守位置
            const blockPosition = this.findLiveFourBlockPosition(opponentThreats);
            if (blockPosition) {
                aiLog('[AI] Hard: Blocking opponent live four at', blockPosition.row, blockPosition.col);
                return { action: 'place', row: blockPosition.row, col: blockPosition.col };
            }
            // 如果找不到特定的防守位置，尝试找到对方可能获胜的位置并阻止
            const blockWin = this.findBlockPosition(opponent);
            if (blockWin) {
                aiLog('[AI] Hard: Blocking opponent win at', blockWin.row, blockWin.col);
                return { action: 'place', row: blockWin.row, col: blockWin.col };
            }
        }

        // 优先级5：对方有冲四，需要防守
        if (opponentThreats.rushFour.length > 0) {
            // 找到对方冲四威胁的防守位置
            const blockPosition = this.findRushFourBlockPosition(opponentThreats);
            if (blockPosition) {
                aiLog('[AI] Hard: Blocking opponent rush four at', blockPosition.row, blockPosition.col);
                return { action: 'place', row: blockPosition.row, col: blockPosition.col };
            }
            // 如果找不到特定的防守位置，使用智能位置选择
            aiLog('[AI] Hard: Using smart position to block rush four');
        }

        // ========== 开局策略 ==========
        // 仅在局面平稳时使用开局库，避免在已有明显威胁时忽略防守。
        const isQuietOpening =
            moveCount < 6 &&
            myThreats.liveThree.length === 0 &&
            myThreats.rushFour.length === 0 &&
            myThreats.liveFour.length === 0 &&
            opponentThreats.liveThree.length === 0 &&
            opponentThreats.rushFour.length === 0 &&
            opponentThreats.liveFour.length === 0 &&
            opponentThreats.win.length === 0;

        if (isQuietOpening) {
            const openingDecision = this.handleOpeningStrategy(myThreats, opponentThreats);
            if (
                openingDecision &&
                openingDecision.action === 'place' &&
                Number.isInteger(openingDecision.row) &&
                Number.isInteger(openingDecision.col) &&
                (!this.game.canPlaceStone || this.game.canPlaceStone(openingDecision.row, openingDecision.col))
            ) {
                aiLog('[AI] Hard: Using opening strategy move', openingDecision);
                return openingDecision;
            }
        }

        // ========== 高级战术：双重威胁 ==========
        // 检查是否能形成双重威胁（两个活三或活三+冲四）
        const doubleThreat = this.findDoubleThreat(myThreats);
        if (doubleThreat) {
            aiLog('[AI] Hard: Found double threat');
            return { action: 'place', row: doubleThreat.row, col: doubleThreat.col };
        }

        // 检查对方的潜在双重威胁，需要阻止
        if (opponentThreats.liveThree.length >= 2) {
            const blockPosition = this.findBestBlockPosition(opponentThreats);
            if (blockPosition) {
                aiLog('[AI] Hard: Blocking double threat');
                return { action: 'place', row: blockPosition.row, col: blockPosition.col };
            }
        }

        // ========== 进攻策略 ==========
        // 优先级6：自己有活三，优先发展
        if (myThreats.liveThree.length > 0) {
            // 找到能形成活四的位置
            const liveFourPos = this.findLiveFourPosition(this.player);
            if (liveFourPos) {
                aiLog('[AI] Hard: Extending live three to live four');
                return { action: 'place', row: liveFourPos.row, col: liveFourPos.col };
            }

            // 找到能形成新活三的位置
            const position = this.findLiveThreePosition(this.player);
            if (position) {
                aiLog('[AI] Hard: Creating new live three');
                return { action: 'place', row: position.row, col: position.col };
            }
        }

        // ========== 防守策略 ==========
        // 阻止对方活三
        if (opponentThreats.liveThree.length > 0) {
            const position = this.findBestBlockPosition(opponentThreats);
            if (position) {
                aiLog('[AI] Hard: Blocking opponent live three');
                return { action: 'place', row: position.row, col: position.col };
            }
        }

        // ========== 技能决策 ==========
        // ========== 最终决策：智能位置选择 ==========
        // 使用确定性的智能选择
        const bestMove = this.selectBestPositionSmart(myThreats, opponentThreats, 0);
        aiLog('[AI] Hard: Selecting best position:', bestMove);
        return {
            action: 'place',
            row: bestMove.row,
            col: bestMove.col
        };
    }

    /**
     * 困难难度：开局策略
     */
    handleOpeningStrategy(myThreats, opponentThreats) {
        const moveCount = this.game.moveHistory.length;

        // 使用开局库（如果启用）
        if (this.openingBook && moveCount < 10) {
            const openingRecommendation = this.openingBook.query(
                this.game.moveHistory,
                this.player
            );

            if (openingRecommendation && openingRecommendation.move) {
                // 记录使用的开局（用于后续学习）
                if (!this.currentOpening) {
                    this.currentOpening = openingRecommendation.opening;
                }

                // 偶尔使用能量获取技能
                if (moveCount < 5 && Math.random() < 0.2) {
                    const energy = this.game.getPlayerEnergy(this.player);
                    if (energy < 5) {
                        const usableSkills = this.getUsableSkills();
                        const energySkills = usableSkills.filter(s =>
                            ['a1', 's4'].includes(s.id)
                        );
                        if (energySkills.length > 0) {
                            const skill = energySkills[0];
                            return {
                                action: 'skill',
                                skillId: skill.id,
                                target: this.selectSkillTargetHard(skill)
                            };
                        }
                    }
                }

                return {
                    action: 'place',
                    row: openingRecommendation.move.row,
                    col: openingRecommendation.move.col
                };
            }
        }

        // 回退到原始开局逻辑
        // 第一步：占领中心
        if (moveCount === 0) {
            return { action: 'place', row: 7, col: 7 };
        }

        // 第二步：靠近中心
        if (moveCount === 1) {
            const centerPositions = [
                { row: 7, col: 6 }, { row: 7, col: 8 },
                { row: 6, col: 7 }, { row: 8, col: 7 },
            ];
            for (const pos of centerPositions) {
                if (this.game.board[pos.row][pos.col] === null) {
                    return { action: 'place', row: pos.row, col: pos.col };
                }
            }
        }

        // 前5步：优先使用能量获取技能
        if (moveCount < 5) {
            const energy = this.game.getPlayerEnergy(this.player);
            if (energy < 5) {
                const usableSkills = this.getUsableSkills();
                const energySkills = usableSkills.filter(s =>
                    ['a1', 's4'].includes(s.id) // 打草惊蛇、以逸待劳
                );
                if (energySkills.length > 0 && Math.random() > 0.5) {
                    const skill = energySkills[0];
                    return {
                        action: 'skill',
                        skillId: skill.id,
                        target: this.selectSkillTargetHard(skill)
                    };
                }
            }
        }

        // 建立基础棋型
        const bestMove = this.selectBestPositionHard(myThreats, opponentThreats, 0);
        return {
            action: 'place',
            row: bestMove.row,
            col: bestMove.col
        };
    }

    /**
     * 困难难度：逆风策略
     */
    handleComebackStrategy(myThreats, opponentThreats) {
        const usableSkills = this.getUsableSkills();

        // 优先使用翻盘型技能
        const comebackSkills = usableSkills.filter(s =>
            SKILL_CATEGORY.COMEBACK.includes(s.id)
        );

        if (comebackSkills.length > 0) {
            // 选择价值最高的翻盘技能
            comebackSkills.sort((a, b) => (SKILL_VALUE[b.id] || 50) - (SKILL_VALUE[a.id] || 50));
            const skill = comebackSkills[0];

            // 检查是否满足使用条件
            if (skill.canUse && skill.canUse(this.game, this.player)) {
                return {
                    action: 'skill',
                    skillId: skill.id,
                    target: this.selectSkillTargetHard(skill)
                };
            }
        }

        // 没有翻盘技能，尝试破坏型技能
        const offensiveSkills = usableSkills.filter(s =>
            SKILL_CATEGORY.OFFENSIVE.includes(s.id)
        );

        if (offensiveSkills.length > 0) {
            offensiveSkills.sort((a, b) => (SKILL_VALUE[b.id] || 50) - (SKILL_VALUE[a.id] || 50));
            const skill = offensiveSkills[0];

            return {
                action: 'skill',
                skillId: skill.id,
                target: this.selectSkillTargetHard(skill)
            };
        }

        // 冒险进攻：尝试形成活三
        const candidates = LineDetector.getCandidatePositions(this.game.board, this.game);
        const scored = candidates.map(pos => {
            const board = this.game.board;
            board[pos.row][pos.col] = this.player;
            const newThreats = LineDetector.detectThreats(board, this.player, this.game);
            board[pos.row][pos.col] = null;

            return {
                ...pos,
                score: newThreats.liveThree.length * 1000 + newThreats.liveTwo.length * 100
            };
        });

        scored.sort((a, b) => b.score - a.score);
        if (scored.length > 0) {
            const best = scored[0];
            if (best.score > 500) {
                return { action: 'place', row: best.row, col: best.col };
            }
        }

        return null;
    }

    /**
     * 困难难度：顺风策略
     */
    handleWinningStrategy(myThreats, opponentThreats) {
        // 使用控制型技能限制对手
        const usableSkills = this.getUsableSkills();
        const controlSkills = usableSkills.filter(s =>
            SKILL_CATEGORY.CONTROL.includes(s.id)
        );

        if (controlSkills.length > 0 && Math.random() > 0.3) {
            const skill = controlSkills[0];
            return {
                action: 'skill',
                skillId: skill.id,
                target: this.selectSkillTargetHard(skill)
            };
        }

        // 稳健落子，避免冒险
        const bestMove = this.selectBestPositionHard(myThreats, opponentThreats, 2000);
        return {
            action: 'place',
            row: bestMove.row,
            col: bestMove.col
        };
    }

    /**
     * 简单难度：技能使用决策
     */
    decideSkillUseEasy() {
        if (this.skillsDisabled) {
            return { shouldUse: false };
        }

        if (Math.random() > this.config.skillUsageRate) {
            return { shouldUse: false };
        }

        const usableSkills = this.getUsableSkills();
        if (usableSkills.length === 0) {
            return { shouldUse: false };
        }

        if (this.isSkillSealed()) {
            return { shouldUse: false };
        }

        const selectedSkill = usableSkills[Math.floor(Math.random() * usableSkills.length)];
        const target = this.selectSkillTargetEasy(selectedSkill);

        return {
            shouldUse: true,
            skillId: selectedSkill.id,
            target: target
        };
    }

    /**
     * 中等难度：技能使用决策
     */
    decideSkillUseMedium(myThreats, opponentThreats) {
        if (this.skillsDisabled) {
            return { shouldUse: false };
        }

        if (Math.random() > this.config.skillUsageRate) {
            return { shouldUse: false };
        }

        const usableSkills = this.getUsableSkills();
        if (usableSkills.length === 0) {
            return { shouldUse: false };
        }

        if (this.isSkillSealed()) {
            return { shouldUse: false };
        }

        const prioritizedSkills = this.prioritizeSkillsMedium(usableSkills, myThreats, opponentThreats);
        const selectedSkill = prioritizedSkills[0];
        const target = this.selectSkillTargetMedium(selectedSkill);

        return {
            shouldUse: true,
            skillId: selectedSkill.id,
            target: target
        };
    }

    /**
     * 困难难度：技能使用决策
     */
    decideSkillUseHard(myThreats, opponentThreats, threatAdvantage) {
        if (this.skillsDisabled) {
            return { shouldUse: false };
        }

        if (Math.random() > this.config.skillUsageRate) {
            return { shouldUse: false };
        }

        const usableSkills = this.getUsableSkills();
        if (usableSkills.length === 0) {
            return { shouldUse: false };
        }

        if (this.isSkillSealed()) {
            return { shouldUse: false };
        }

        // 困难难度：使用技能组合系统
        if (this.config.useSkillCombos) {
            const comboSkill = this.findBestSkillCombo(usableSkills, myThreats, opponentThreats, threatAdvantage);
            if (comboSkill) {
                return {
                    shouldUse: true,
                    skillId: comboSkill.id,
                    target: this.selectSkillTargetHard(comboSkill)
                };
            }
        }

        // 没有合适的组合，使用高级优先级系统
        const prioritizedSkills = this.prioritizeSkillsHard(usableSkills, myThreats, opponentThreats, threatAdvantage);
        const selectedSkill = prioritizedSkills[0];

        return {
            shouldUse: true,
            skillId: selectedSkill.id,
            target: this.selectSkillTargetHard(selectedSkill)
        };
    }

    /**
     * 困难难度：查找最佳技能组合
     */
    findBestSkillCombo(usableSkills, myThreats, opponentThreats, threatAdvantage) {
        const availableIds = usableSkills.map(s => s.id);

        // 检查每个组合
        for (const comboType of Object.values(SKILL_COMBOS)) {
            for (const combo of comboType) {
                // 检查组合中的技能是否可用
                const hasComboSkills = combo.skills.some(id => availableIds.includes(id));

                if (hasComboSkills) {
                    // 根据局势选择合适的组合类型
                    let shouldUse = false;

                    if (comboType === SKILL_COMBOS.offensive) {
                        // 进攻组合：己方有优势或有机会
                        shouldUse = threatAdvantage > 500 || myThreats.liveThree.length > 1;
                    } else if (comboType === SKILL_COMBOS.defensive) {
                        // 防守组合：对方有威胁
                        shouldUse = opponentThreats.liveFour.length > 0 || opponentThreats.liveThree.length > 1;
                    } else if (comboType === SKILL_COMBOS.comeback) {
                        // 翻盘组合：明显落后
                        shouldUse = threatAdvantage < -1000;
                    }

                    if (shouldUse) {
                        // 返回组合中可用的第一个技能
                        for (const skillId of combo.skills) {
                            const skill = usableSkills.find(s => s.id === skillId);
                            if (skill && skill.canUse && skill.canUse(this.game, this.player)) {
                                // 给技能添加组合加成
                                skill._comboBonus = combo.bonus;
                                return skill;
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * 中等难度：技能优先级排序
     */
    prioritizeSkillsMedium(skills, myThreats, opponentThreats) {
        const scored = skills.map(skill => {
            let score = SKILL_VALUE[skill.id] || 50;

            if (opponentThreats.liveFour.length > 0 || opponentThreats.rushFour.length > 0) {
                if (['s5', 'e5', 'a6'].includes(skill.id)) {
                    score += 50;
                }
            }

            if (myThreats.liveThree.length > 0) {
                if (['e4', 'd5', 'a4'].includes(skill.id)) {
                    score += 30;
                }
            }

            const energy = this.game.getPlayerEnergy(this.player);
            if (energy < 5) {
                if (['a1', 's4'].includes(skill.id)) {
                    score += 40;
                }
            }

            return { skill, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.map(s => s.skill);
    }

    /**
     * 困难难度：技能优先级排序
     */
    prioritizeSkillsHard(skills, myThreats, opponentThreats, threatAdvantage) {
        const scored = skills.map(skill => {
            let score = SKILL_VALUE[skill.id] || 50;

            // 添加组合加成
            if (skill._comboBonus) {
                score += skill._comboBonus;
            }

            // 对方威胁等级加成
            const opponentThreatLevel = this.getThreatLevel(opponentThreats);
            if (opponentThreatLevel >= 4) { // 对方有四连
                if (SKILL_CATEGORY.DEFENSIVE.includes(skill.id)) {
                    score += 100; // 大幅提高防守技能价值
                }
            } else if (opponentThreatLevel >= 3) { // 对方有活三
                if (['c4', 'e3', 'a4'].includes(skill.id)) {
                    score += 60; // 控制型技能加成
                }
            }

            // 己方机会加成
            const myThreatLevel = this.getThreatLevel(myThreats);
            if (myThreatLevel >= 3) {
                if (SKILL_CATEGORY.OFFENSIVE.includes(skill.id)) {
                    score += 50;
                }
            }

            // 能量管理
            const energy = this.game.getPlayerEnergy(this.player);
            const maxEnergy = this.game.maxEnergy;
            if (energy < maxEnergy * 0.3) { // 能量低于30%
                if (SKILL_CATEGORY.ENERGY.includes(skill.id)) {
                    score += 80;
                }
                // 惩罚高消耗技能
                if (skill.cost > energy) {
                    score -= 200;
                }
            }

            // 技能协同效应
            if (this.lastSkillUsed) {
                // 上次使用了进攻技能，这次优先使用控制技能
                if (SKILL_CATEGORY.OFFENSIVE.includes(this.lastSkillUsed) &&
                    SKILL_CATEGORY.CONTROL.includes(skill.id)) {
                    score += 30;
                }
            }

            // 局势适应性
            if (threatAdvantage < -500) { // 逆风
                if (SKILL_CATEGORY.COMEBACK.includes(skill.id)) {
                    score += 70;
                }
            } else if (threatAdvantage > 1000) { // 顺风
                if (SKILL_CATEGORY.CONTROL.includes(skill.id)) {
                    score += 40;
                }
                // 避免使用冒险技能
                if (['a1', 's1', 'c2'].includes(skill.id)) {
                    score -= 30;
                }
            }

            return { skill, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.map(s => s.skill);
    }

    /**
     * 获取威胁等级（用于技能决策）
     */
    getThreatLevel(threats) {
        if (threats.win.length > 0) return 5;
        if (threats.liveFour.length > 0) return 4;
        if (threats.rushFour.length > 0) return 3;
        if (threats.liveThree.length > 0) return 2;
        if (threats.sleepThree.length > 0) return 1;
        return 0;
    }

    /**
     * 简单难度：选择技能目标
     */
    selectSkillTargetEasy(skill) {
        if (!skill.targetType || skill.targetType === 'none') {
            return null;
        }

        const validTargets = this.getValidTargetsForSkill(skill);
        if (validTargets.length === 0) {
            return null;
        }

        return validTargets[Math.floor(Math.random() * validTargets.length)];
    }

    /**
     * 中等难度：选择技能目标
     */
    selectSkillTargetMedium(skill) {
        if (!skill.targetType || skill.targetType === 'none') {
            return null;
        }

        const validTargets = this.getValidTargetsForSkill(skill);
        if (validTargets.length === 0) {
            return null;
        }

        if (skill.targetType === 'stone' || skill.targetType === 'STONE') {
            const scored = validTargets.map(target => ({
                ...target,
                score: this.evaluateStoneTarget(target)
            }));
            scored.sort((a, b) => b.score - a.score);
            return scored[0];
        }

        const scored = validTargets.map(target => ({
            ...target,
            score: LineDetector.getPositionValue(target.row, target.col)
        }));
        scored.sort((a, b) => b.score - a.score);

        const topTargets = scored.slice(0, Math.min(3, scored.length));
        return topTargets[Math.floor(Math.random() * topTargets.length)];
    }

    /**
     * 困难难度：选择技能目标
     */
    selectSkillTargetHard(skill) {
        if (!skill.targetType || skill.targetType === 'none') {
            return null;
        }

        const validTargets = this.getValidTargetsForSkill(skill);
        if (validTargets.length === 0) {
            return null;
        }

        // 根据技能类型选择目标策略
        if (SKILL_CATEGORY.OFFENSIVE.includes(skill.id) ||
            SKILL_CATEGORY.COMEBACK.includes(skill.id)) {
            // 进攻型技能：优先选择对方参与连线的棋子
            if (skill.targetType === 'stone' || skill.targetType === 'STONE') {
                const opponentTargets = validTargets.filter(t => t.stone === this.getOpponent());
                if (opponentTargets.length > 0) {
                    const scored = opponentTargets.map(target => ({
                        ...target,
                        score: this.evaluateStoneTargetAdvanced(target)
                    }));
                    scored.sort((a, b) => b.score - a.score);
                    return scored[0];
                }
            }
        }

        if (SKILL_CATEGORY.DEFENSIVE.includes(skill.id)) {
            // 防守型技能：优先选择对方高威胁棋子
            if (skill.targetType === 'stone' || skill.targetType === 'STONE') {
                const opponentTargets = validTargets.filter(t => t.stone === this.getOpponent());
                if (opponentTargets.length > 0) {
                    const scored = opponentTargets.map(target => ({
                        ...target,
                        score: this.evaluateDefensiveTarget(target)
                    }));
                    scored.sort((a, b) => b.score - a.score);
                    return scored[0];
                }
            }
        }

        if (SKILL_CATEGORY.ENERGY.includes(skill.id)) {
            // 能量型技能：选择高价值位置
            if (skill.targetType === 'cell' || skill.targetType === 'CELL') {
                const scored = validTargets.map(target => ({
                    ...target,
                    score: LineDetector.getPositionValue(target.row, target.col) * 2
                }));
                scored.sort((a, b) => b.score - a.score);
                return scored[0];
            }
        }

        // 默认使用中等难度的目标选择
        return this.selectSkillTargetMedium(skill);
    }

    /**
     * 困难难度：高级棋子目标评估
     */
    evaluateStoneTargetAdvanced(target) {
        const board = this.game.board;
        const player = target.stone;
        const opponent = this.getOpponent();

        let score = 50;

        // 检查该棋子参与的各类连线
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
            const result = LineDetector.countLine(board, target.row, target.col, dr, dc, player);
            const type = LineDetector.classifyLine(result.count, result.openEnds);

            if (type === 'LIVE_FOUR') score += 150;
            else if (type === 'RUSH_FOUR') score += 120;
            else if (type === 'LIVE_THREE') score += 80;
            else if (type === 'SLEEP_THREE') score += 40;
            else if (type === 'LIVE_TWO') score += 15;
        }

        // 检查是否能形成双重威胁
        const tempBoard = JSON.parse(JSON.stringify(board));
        tempBoard[target.row][target.col] = null;
        const threats = LineDetector.detectThreats(tempBoard, player, this.game);
        const multipleThreats = threats.liveThree.length + threats.liveFour.length;
        score += multipleThreats * 30;

        // 对手棋子价值更高
        if (player === opponent) {
            score *= 1.8;
        }

        return score;
    }

    /**
     * 评估防守目标价值
     */
    evaluateDefensiveTarget(target) {
        const board = this.game.board;
        const opponent = this.getOpponent();

        let score = 50;

        // 移除该棋子后评估对方威胁减少程度
        board[target.row][target.col] = null;
        const threatsAfter = LineDetector.detectThreats(board, opponent, this.game);
        board[target.row][target.col] = target.stone;

        const threatsBefore = LineDetector.detectThreats(board, opponent, this.game);

        const reduction =
            (threatsBefore.liveFour.length - threatsAfter.liveFour.length) * 200 +
            (threatsBefore.rushFour.length - threatsAfter.rushFour.length) * 100 +
            (threatsBefore.liveThree.length - threatsAfter.liveThree.length) * 30;

        score += reduction;

        return score;
    }

    /**
     * 评估棋子目标价值（中等难度）
     */
    evaluateStoneTarget(target) {
        const board = this.game.board;
        const player = target.stone;
        const opponent = this.getOpponent();

        let score = 50;

        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
            const result = LineDetector.countLine(board, target.row, target.col, dr, dc, player);
            const type = LineDetector.classifyLine(result.count, result.openEnds);

            if (type === 'LIVE_FOUR') score += 100;
            else if (type === 'RUSH_FOUR') score += 80;
            else if (type === 'LIVE_THREE') score += 60;
            else if (type === 'SLEEP_THREE') score += 30;
            else if (type === 'LIVE_TWO') score += 10;
        }

        if (player === opponent) {
            score *= 1.5;
        }

        return score;
    }

    /**
     * 获取技能的合法目标
     */
    getValidTargetsForSkill(skill) {
        const targets = [];
        const board = this.game.board;

        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                const stone = board[row][col];

                if (skill.targetType === 'cell' || skill.targetType === 'CELL') {
                    if (stone === null && this.game.canPlaceStone(row, col)) {
                        targets.push({ row, col, stone: null });
                    }
                } else if (skill.targetType === 'stone' || skill.targetType === 'STONE') {
                    if (stone !== null) {
                        targets.push({ row, col, stone });
                    }
                }
            }
        }

        return targets;
    }

    /**
     * 对候选位置进行确定性排序（避免同局面下随机抖动）
     */
    compareScoredMoves(a, b) {
        if (b.score !== a.score) {
            return b.score - a.score;
        }

        // 同分时优先中心高价值点
        const valueDelta = LineDetector.getPositionValue(b.row, b.col) -
            LineDetector.getPositionValue(a.row, a.col);
        if (valueDelta !== 0) {
            return valueDelta;
        }

        // 再按距离中心、坐标兜底，保证完全确定性
        const distDelta = LineDetector.getDistanceToCenter(a.row, a.col) -
            LineDetector.getDistanceToCenter(b.row, b.col);
        if (distDelta !== 0) {
            return distDelta;
        }

        if (a.row !== b.row) {
            return a.row - b.row;
        }
        return a.col - b.col;
    }

    /**
     * 简单难度：选择最佳落子位置
     */
    selectBestPositionEasy() {
        aiLog('[AI] selectBestPositionEasy called');
        const candidates = LineDetector.getCandidatePositions(this.game.board, this.game);
        aiLog('[AI] Candidate positions:', candidates);

        if (candidates.length === 0) {
            aiLog('[AI] No candidates, returning center');
            return { row: 7, col: 7 };
        }

        const scored = candidates.map(pos => ({
            ...pos,
            score: this.evaluatePositionSimple(pos)
        }));

        scored.sort((a, b) => this.compareScoredMoves(a, b));
        aiLog('[AI] Selected position:', scored[0]);
        return scored[0];
    }

    /**
     * 中等难度：选择最佳落子位置
     */
    selectBestPositionMedium(myThreats, opponentThreats) {
        const candidates = LineDetector.getCandidatePositions(this.game.board, this.game);

        if (candidates.length === 0) {
            return { row: 7, col: 7 };
        }

        const scored = candidates.map(pos => ({
            ...pos,
            score: this.evaluatePositionMedium(pos, myThreats, opponentThreats)
        }));

        scored.sort((a, b) => this.compareScoredMoves(a, b));
        return scored[0];
    }

    /**
     * 困难难度：选择最佳落子位置
     */
    selectBestPositionHard(myThreats, opponentThreats, threatAdvantage) {
        const candidates = LineDetector.getCandidatePositions(this.game.board, this.game);

        if (candidates.length === 0) {
            return { row: 7, col: 7 };
        }

        // 困难难度：更全面的位置评估
        const scored = candidates.map(pos => ({
            ...pos,
            score: this.evaluatePositionHard(pos, myThreats, opponentThreats, threatAdvantage)
        }));

        scored.sort((a, b) => this.compareScoredMoves(a, b));
        return scored[0];
    }

    /**
     * 简单位置评估（增强版）
     */
    evaluatePositionSimple(pos) {
        const board = this.game.board;
        const opponent = this.getOpponent();
        let score = 0;

        // 基础位置值（距离中心越近越好）
        const distance = LineDetector.getDistanceToCenter(pos.row, pos.col);
        score += 100 - distance * 5;

        // 评估己方落子后的威胁
        board[pos.row][pos.col] = this.player;
        const myThreats = LineDetector.detectThreats(board, this.player, this.game);
        board[pos.row][pos.col] = null;

        // 奖励形成连珠
        score += myThreats.liveThree.length * 300;  // 活三很重要
        score += myThreats.sleepThree.length * 100; // 眠三
        score += myThreats.liveTwo.length * 50;     // 活二
        score += myThreats.rushFour.length * 1000;  // 冲四

        // 评估对方落子后的威胁（防守）
        board[pos.row][pos.col] = opponent;
        const opponentThreats = LineDetector.detectThreats(board, opponent, this.game, { includePotentialThree: false });
        board[pos.row][pos.col] = null;

        // 阻止对方连珠
        score += opponentThreats.liveThree.length * 250;  // 阻止活三
        score += opponentThreats.sleepThree.length * 80;  // 阻止眠三
        score += opponentThreats.liveTwo.length * 40;     // 阻止活二
        score += opponentThreats.rushFour.length * 800;   // 阻止冲四

        return score;
    }

    /**
     * 中等位置评估
     */
    evaluatePositionMedium(pos, myThreats, opponentThreats) {
        let score = 0;

        score += LineDetector.getPositionValue(pos.row, pos.col);

        const board = this.game.board;
        board[pos.row][pos.col] = this.player;
        const myNewThreats = LineDetector.detectThreats(board, this.player, this.game, { includePotentialThree: false });
        board[pos.row][pos.col] = null;

        if (myNewThreats.liveFour.length > myThreats.liveFour.length) score += 5000;
        if (myNewThreats.liveThree.length > myThreats.liveThree.length) score += 500;
        if (myNewThreats.liveTwo.length > myThreats.liveTwo.length) score += 50;

        board[pos.row][pos.col] = this.getOpponent();
        const opponentNewThreats = LineDetector.detectThreats(board, this.getOpponent(), this.game, { includePotentialThree: false });
        board[pos.row][pos.col] = null;

        if (opponentThreats.liveFour.length > 0 && opponentNewThreats.liveFour.length === 0) score += 3000;
        if (opponentThreats.liveThree.length > 0 && opponentNewThreats.liveThree.length === 0) score += 300;
        if (opponentThreats.rushFour.length > 0 && opponentNewThreats.rushFour.length === 0) score += 1000;

        return score;
    }

    /**
     * 困难位置评估
     */
    evaluatePositionHard(pos, myThreats, opponentThreats, threatAdvantage) {
        let score = 0;

        // 1. 位置基础价值
        score += LineDetector.getPositionValue(pos.row, pos.col) * 1.5;

        const board = this.game.board;

        // 2. 详细评估该位置的进攻价值
        board[pos.row][pos.col] = this.player;
        const myNewThreats = LineDetector.detectThreats(board, this.player, this.game, { includePotentialThree: false });
        board[pos.row][pos.col] = null;

        // 创造新威胁的奖励
        if (myNewThreats.win.length > myThreats.win.length) score += 30000;
        if (myNewThreats.liveFour.length > myThreats.liveFour.length) score += 8000;
        if (myNewThreats.rushFour.length > myThreats.rushFour.length) score += 3000;
        if (myNewThreats.liveThree.length > myThreats.liveThree.length) score += 800;
        if (myNewThreats.sleepThree.length > myThreats.sleepThree.length) score += 200;
        if (myNewThreats.liveTwo.length > myThreats.liveTwo.length) score += 80;

        // 创造双重威胁的奖励
        const newThreatCount = myNewThreats.liveThree.length + myNewThreats.liveFour.length;
        if (newThreatCount >= 2) score += 1500;

        // 3. 详细评估该位置的防守价值
        board[pos.row][pos.col] = this.getOpponent();
        const opponentNewThreats = LineDetector.detectThreats(board, this.getOpponent(), this.game, { includePotentialThree: false });
        board[pos.row][pos.col] = null;

        // 阻止对方威胁的奖励
        if (opponentThreats.win.length > 0 && opponentNewThreats.win.length === 0) score += 15000;
        if (opponentThreats.liveFour.length > 0 && opponentNewThreats.liveFour.length === 0) score += 5000;
        if (opponentThreats.rushFour.length > 0 && opponentNewThreats.rushFour.length === 0) score += 2000;
        if (opponentThreats.liveThree.length > 0 && opponentNewThreats.liveThree.length === 0) score += 500;
        if (opponentThreats.sleepThree.length > 0 && opponentNewThreats.sleepThree.length === 0) score += 150;

        // 4. 局势适应性评分
        if (threatAdvantage > 1000) {
            // 顺风：更重视防守，减少冒险
            score += this.evaluatePositionWinning(pos, myThreats, opponentThreats);
        } else if (threatAdvantage < -500) {
            // 逆风：更重视进攻，增加冒险
            score += this.evaluatePositionComeback(pos, myThreats, opponentThreats);
        }

        // 5. 连锁效应评估
        score += this.evaluateChainEffect(pos);

        // 6. 能量获取潜力
        score += this.evaluateEnergyPotential(pos);

        return score;
    }

    /**
     * 评估顺风局面的位置价值
     */
    evaluatePositionWinning(pos, myThreats, opponentThreats) {
        let score = 0;

        // 优先稳健，避免给对方创造机会
        const board = this.game.board;
        board[pos.row][pos.col] = this.getOpponent();

        // 检查是否会给对方创造好机会
        const opponentNewThreats = LineDetector.detectThreats(board, this.getOpponent(), this.game, { includePotentialThree: false });
        board[pos.row][pos.col] = null;

        if (opponentNewThreats.liveThree.length > opponentThreats.liveThree.length) {
            score -= 500; // 惩罚给对方创造活三
        }
        if (opponentNewThreats.liveFour.length > 0) {
            score -= 2000; // 严厉惩罚给对方创造活四
        }

        return score;
    }

    /**
     * 评估逆风局面的位置价值
     */
    evaluatePositionComeback(pos, myThreats, opponentThreats) {
        let score = 0;

        // 逆风时更重视创造威胁
        const board = this.game.board;
        board[pos.row][pos.col] = this.player;

        const myNewThreats = LineDetector.detectThreats(board, this.player, this.game, { includePotentialThree: false });
        board[pos.row][pos.col] = null;

        // 创造多个威胁的额外奖励
        const threatIncrease =
            (myNewThreats.liveThree.length - myThreats.liveThree.length) +
            (myNewThreats.liveFour.length - myThreats.liveFour.length) * 3;

        score += threatIncrease * 300;

        // 形成眠三也有一定价值（可以后续发展）
        if (myNewThreats.sleepThree.length > myThreats.sleepThree.length) {
            score += 200;
        }

        return score;
    }

    /**
     * 评估位置的连锁效应
     */
    evaluateChainEffect(pos) {
        let score = 0;

        // 检查该位置是否能连接多个方向
        const board = this.game.board;
        let connectedDirections = 0;

        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
            let hasConnection = false;

            // 正向检查
            let r = pos.row + dr, c = pos.col + dc;
            if (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === this.player) {
                hasConnection = true;
            }

            // 反向检查
            r = pos.row - dr;
            c = pos.col - dc;
            if (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === this.player) {
                hasConnection = true;
            }

            if (hasConnection) {
                connectedDirections++;
            }
        }

        // 连接方向越多，位置越有价值
        score += connectedDirections * 20;

        return score;
    }

    /**
     * 评估位置的能量获取潜力
     */
    evaluateEnergyPotential(pos) {
        let score = 0;

        // 检查该位置是否参与多个连线
        const board = this.game.board;
        board[pos.row][pos.col] = this.player;

        let connections = 0;
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
            const result = LineDetector.countLine(board, pos.row, pos.col, dr, dc, this.player);
            if (result.count >= 2) {
                connections++;
            }
        }

        board[pos.row][pos.col] = null;

        // 参与的连线越多，能量获取潜力越高
        score += connections * 10;

        return score;
    }

    /**
     * 获取可用技能列表
     */
    getUsableSkills() {
        if (this.skillsDisabled) {
            return [];
        }

        const skills = [];

        for (const skill of this.game.currentSkillPool || []) {
            if (skill.canUse && skill.canUse(this.game, this.player)) {
                skills.push(skill);
            }
        }

        return skills;
    }

    /**
     * 检查是否被技能封印
     */
    isSkillSealed() {
        return this.game.skillSeal &&
            this.game.skillSeal.player === this.player &&
            this.game.skillSeal.turns > 0;
    }

    /**
     * 找到完成五连的位置
     */
    findWinPosition(player) {
        const board = this.game.board;
        let foundPosition = null;

        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] !== null) continue;
                if (this.game.canPlaceStone && !this.game.canPlaceStone(row, col)) continue;

                board[row][col] = player;
                const isWin = this.game.checkWin(row, col);
                board[row][col] = null;

                if (isWin) {
                    foundPosition = { row, col };
                    aiLog('[AI] findWinPosition: Found winning position at', row, col);
                    return foundPosition;
                }
            }
        }

        aiLog('[AI] findWinPosition: No winning position found');
        return foundPosition;
    }

    /**
     * 找到堵截对方五连的位置
     */
    findBlockPosition(opponent) {
        const board = this.game.board;
        let foundPosition = null;

        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] !== null) continue;
                if (this.game.canPlaceStone && !this.game.canPlaceStone(row, col)) continue;

                board[row][col] = opponent;
                const wouldWin = this.game.checkWin(row, col);
                board[row][col] = null;

                if (wouldWin) {
                    foundPosition = { row, col };
                    aiLog('[AI] findBlockPosition: Found block position at', row, col);
                    return foundPosition;
                }
            }
        }

        aiLog('[AI] findBlockPosition: No block position found');
        return foundPosition;
    }

    /**
     * 找到形成活四的位置
     */
    findLiveFourPosition(player) {
        const board = this.game.board;

        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] !== null) continue;
                if (!this.game.canPlaceStone(row, col)) continue;

                board[row][col] = player;
                const threats = LineDetector.detectThreats(board, player, this.game, { includePotentialThree: false });
                board[row][col] = null;

                if (threats.liveFour.length > 0) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    /**
     * 找到防守对方活四的位置
     */
    findLiveFourBlockPosition(opponentThreats) {
        const board = this.game.board;
        const opponent = this.getOpponent();
        let bestPosition = null;
        let bestScore = -Infinity;

        aiLog('[AI] findLiveFourBlockPosition: opponentThreats.liveFour =', opponentThreats.liveFour);

        // 遍历对方的所有活四威胁
        for (const threat of opponentThreats.liveFour) {
            const { startRow, startCol, dr, dc } = threat;
            aiLog('[AI] findLiveFourBlockPosition: Checking threat at', startRow, startCol, 'direction', dr, dc);

            // 找到这个威胁线上的防守位置
            for (let i = -4; i <= 4; i++) {
                const row = startRow + dr * i;
                const col = startCol + dc * i;

                if (row < 0 || row >= 15 || col < 0 || col >= 15) continue;
                if (board[row][col] !== null) continue;
                if (!this.game.canPlaceStone(row, col)) continue;

                // 评估这个位置的防守价值
                let score = 0;

                // 在这个位置由AI落子，检查是否能阻止对方活四
                board[row][col] = this.player;
                const opponentNewThreats = LineDetector.detectThreats(board, opponent, this.game, { includePotentialThree: false });
                const myNewThreats = LineDetector.detectThreats(board, this.player, this.game, { includePotentialThree: false });
                board[row][col] = null;

                // 如果落子后对方活四数量减少，说明这个位置是有效的防守位置
                const liveFourReduced = opponentThreats.liveFour.length - opponentNewThreats.liveFour.length;
                score += liveFourReduced * 100000;
                score += (opponentThreats.rushFour.length - opponentNewThreats.rushFour.length) * 50000;
                score += (opponentThreats.liveThree.length - opponentNewThreats.liveThree.length) * 5000;

                // 同时也要考虑是否能形成自己的威胁（进攻性防守）
                score += myNewThreats.liveFour.length * 10000;
                score += myNewThreats.rushFour.length * 5000;
                score += myNewThreats.liveThree.length * 1000;

                // 位置价值
                score += LineDetector.getPositionValue(row, col);

                if (score > bestScore) {
                    bestScore = score;
                    bestPosition = { row, col };
                }
            }
        }

        aiLog('[AI] findLiveFourBlockPosition: Best position =', bestPosition, 'score =', bestScore);
        return bestPosition;
    }

    /**
     * 找到冲四的位置
     */
    findRushFourPosition(player) {
        const board = this.game.board;

        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] !== null) continue;
                if (!this.game.canPlaceStone(row, col)) continue;

                board[row][col] = player;
                const threats = LineDetector.detectThreats(board, player, this.game, { includePotentialThree: false });
                board[row][col] = null;

                if (threats.rushFour.length > 0) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    /**
     * 找到防守对方冲四的位置
     */
    findRushFourBlockPosition(opponentThreats) {
        const board = this.game.board;
        const opponent = this.getOpponent();
        let bestPosition = null;
        let bestScore = -Infinity;

        aiLog('[AI] findRushFourBlockPosition: opponentThreats.rushFour =', opponentThreats.rushFour);

        // 遍历对方的所有冲四威胁
        for (const threat of opponentThreats.rushFour) {
            const { startRow, startCol, dr, dc } = threat;
            aiLog('[AI] findRushFourBlockPosition: Checking threat at', startRow, startCol, 'direction', dr, dc);

            // 找到这个威胁线上的防守位置
            for (let i = -4; i <= 4; i++) {
                const row = startRow + dr * i;
                const col = startCol + dc * i;

                if (row < 0 || row >= 15 || col < 0 || col >= 15) continue;
                if (board[row][col] !== null) continue;
                if (!this.game.canPlaceStone(row, col)) continue;

                // 评估这个位置的防守价值
                let score = 0;

                // 在这个位置由AI落子，检查是否能阻止对方冲四
                board[row][col] = this.player;
                const opponentNewThreats = LineDetector.detectThreats(board, opponent, this.game, { includePotentialThree: false });
                const myNewThreats = LineDetector.detectThreats(board, this.player, this.game, { includePotentialThree: false });
                board[row][col] = null;

                // 如果落子后对方冲四数量减少，说明这个位置是有效的防守位置
                const rushFourReduced = opponentThreats.rushFour.length - opponentNewThreats.rushFour.length;
                score += rushFourReduced * 10000;
                score += (opponentThreats.liveFour.length - opponentNewThreats.liveFour.length) * 50000;
                score += (opponentThreats.liveThree.length - opponentNewThreats.liveThree.length) * 1000;

                // 同时也要考虑是否能形成新的冲四（进攻性防守）
                score += myNewThreats.rushFour.length * 5000;
                score += myNewThreats.liveThree.length * 1000;

                // 位置价值
                score += LineDetector.getPositionValue(row, col);

                if (score > bestScore) {
                    bestScore = score;
                    bestPosition = { row, col };
                }
            }
        }

        aiLog('[AI] findRushFourBlockPosition: Best position =', bestPosition, 'score =', bestScore);
        return bestPosition;
    }

    /**
     * 找到形成活三的位置
     */
    findLiveThreePosition(player) {
        const board = this.game.board;

        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] !== null) continue;
                if (!this.game.canPlaceStone(row, col)) continue;

                board[row][col] = player;
                const threats = LineDetector.detectThreats(board, player, this.game, { includePotentialThree: false });
                board[row][col] = null;

                if (threats.liveThree.length > 0) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    /**
     * 智能位置选择（综合评估）
     * @param {Object} myThreats - 己方威胁
     * @param {Object} opponentThreats - 对方威胁
     * @param {Number} randomness - 随机性参数（已保留兼容，不再参与评分）
     */
    selectBestPositionSmart(myThreats, opponentThreats, randomness = 0) {
        const board = this.game.board;
        const candidates = LineDetector.getCandidatePositions(board, this.game);

        aiLog('[AI] selectBestPositionSmart: candidates count =', candidates.length);

        if (candidates.length === 0) {
            aiLog('[AI] selectBestPositionSmart: No candidates, returning center');
            return { row: 7, col: 7 };
        }

        const opponent = this.getOpponent();
        let bestPosition = null;
        let bestScore = -Infinity;

        for (const pos of candidates) {
            // 检查位置是否可用
            if (this.game.canPlaceStone && !this.game.canPlaceStone(pos.row, pos.col)) {
                continue;
            }

            let score = 0;

            // 1. 评估己方落子后的威胁变化
            board[pos.row][pos.col] = this.player;
            const myNewThreats = LineDetector.detectThreats(board, this.player, this.game, { includePotentialThree: false });
            board[pos.row][pos.col] = null;

            // 奖励形成新的威胁
            score += myNewThreats.liveFour.length * 10000;
            score += myNewThreats.rushFour.length * 5000;
            score += myNewThreats.liveThree.length * 1000;
            score += myNewThreats.sleepThree.length * 200;
            score += myNewThreats.liveTwo.length * 100;

            // 奖励连续的威胁（多方向威胁）
            const myMultiDirBonus = this.countMultiDirectionThreats(myNewThreats);
            score += myMultiDirBonus * 500;

            // 2. 评估对方落子后的威胁变化（防守）
            board[pos.row][pos.col] = opponent;
            const opponentNewThreats = LineDetector.detectThreats(board, opponent, this.game, { includePotentialThree: false });
            board[pos.row][pos.col] = null;

            // 阻止对方的威胁
            score += (opponentThreats.liveFour.length - opponentNewThreats.liveFour.length) * 9000;
            score += (opponentThreats.rushFour.length - opponentNewThreats.rushFour.length) * 4500;
            score += (opponentThreats.liveThree.length - opponentNewThreats.liveThree.length) * 900;
            score += (opponentThreats.sleepThree.length - opponentNewThreats.sleepThree.length) * 180;
            score += (opponentThreats.liveTwo.length - opponentNewThreats.liveTwo.length) * 80;

            // 对方多方向威胁的防守价值
            const opponentOldMultiDir = this.countMultiDirectionThreats(opponentThreats);
            const opponentNewMultiDir = this.countMultiDirectionThreats(opponentNewThreats);
            score += (opponentOldMultiDir - opponentNewMultiDir) * 450;

            // 3. 位置价值（中心位置更有价值）
            score += LineDetector.getPositionValue(pos.row, pos.col);

            // 4. 兼容参数 randomness：不再用于评分，避免同局面随机抖动
            if (score > bestScore) {
                bestScore = score;
                bestPosition = pos;
            } else if (score === bestScore && bestPosition) {
                const preferred = this.compareScoredMoves(
                    { ...pos, score },
                    { ...bestPosition, score: bestScore }
                );
                if (preferred < 0) {
                    bestPosition = pos;
                }
            }
        }

        // 如果没有找到任何有效位置，返回中心
        if (!bestPosition) {
            aiLog('[AI] selectBestPositionSmart: No valid position found, returning center');
            return { row: 7, col: 7 };
        }

        aiLog('[AI] selectBestPositionSmart: Best position =', bestPosition, 'score =', bestScore);
        return bestPosition;
    }

    /**
     * 查找双重威胁位置（能形成两个或更多活三的位置）
     */
    findDoubleThreat(threats) {
        // 如果已经有活三，尝试找一个能形成新活三的位置
        if (threats.liveThree.length < 1) return null;

        const board = this.game.board;
        const bestPositions = [];

        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                if (board[row][col] !== null) continue;
                if (!this.game.canPlaceStone(row, col)) continue;

                board[row][col] = this.player;
                const newThreats = LineDetector.detectThreats(board, this.player, this.game, { includePotentialThree: false });
                board[row][col] = null;

                // 检查是否形成了多个活三
                if (newThreats.liveThree.length >= 2) {
                    bestPositions.push({ row, col, count: newThreats.liveThree.length });
                }
            }
        }

        if (bestPositions.length > 0) {
            // 返回活三最多的位置
            bestPositions.sort((a, b) => b.count - a.count);
            return bestPositions[0];
        }

        return null;
    }

    /**
     * 查找最佳防守位置
     */
    findBestBlockPosition(opponentThreats) {
        if (opponentThreats.liveThree.length === 0) return null;

        const board = this.game.board;
        const opponent = this.getOpponent();
        let bestPosition = null;
        let bestThreatScore = Infinity;
        let bestTieBreaker = -Infinity;

        // 检查每个威胁位置
        for (const threat of opponentThreats.liveThree) {
            // 尝试在这个威胁方向上落子
            const { startRow, startCol, dr, dc } = threat;

            // 检查威胁线上的所有位置
            for (let i = -2; i <= 4; i++) {
                const row = startRow + dr * i;
                const col = startCol + dc * i;

                if (row < 0 || row >= 15 || col < 0 || col >= 15) continue;
                if (board[row][col] !== null) continue;
                if (!this.game.canPlaceStone(row, col)) continue;

                // 在该点由AI落子，评估对方剩余威胁
                board[row][col] = this.player;
                const opponentNewThreats = LineDetector.detectThreats(board, opponent, this.game, { includePotentialThree: false });
                const myNewThreats = LineDetector.detectThreats(board, this.player, this.game, { includePotentialThree: false });
                board[row][col] = null;

                const opponentThreatScore = LineDetector.calculateThreatScore(opponentNewThreats);
                const tieBreaker =
                    myNewThreats.liveFour.length * 10000 +
                    myNewThreats.rushFour.length * 5000 +
                    myNewThreats.liveThree.length * 1000 +
                    LineDetector.getPositionValue(row, col);

                if (
                    opponentThreatScore < bestThreatScore ||
                    (opponentThreatScore === bestThreatScore && tieBreaker > bestTieBreaker)
                ) {
                    bestThreatScore = opponentThreatScore;
                    bestTieBreaker = tieBreaker;
                    bestPosition = { row, col };
                }
            }
        }

        return bestPosition;
    }

    /**
     * 计算多方向威胁数量
     */
    countMultiDirectionThreats(threats) {
        let multiDirCount = 0;
        const directions = new Map();

        for (const threat of [...threats.liveFour, ...threats.rushFour, ...threats.liveThree]) {
            const key = `${threat.dr},${threat.dc}`;
            if (!directions.has(key)) {
                directions.set(key, 0);
            }
            directions.set(key, directions.get(key) + 1);
        }

        // 计算有多个威胁的方向数量
        for (const count of directions.values()) {
            if (count >= 2) {
                multiDirCount += count;
            }
        }

        return multiDirCount;
    }

    /**
     * 获取对手
     */
    getOpponent() {
        return this.player === 'black' ? 'white' : 'black';
    }

    /**
     * 执行AI决策（异步）
     */
    async executeDecision() {
        aiLog('[AI] executeDecision called', {
            isThinking: this.isThinking,
            player: this.player,
            difficulty: this.difficulty
        });

        if (this.isThinking) {
            aiLog('[AI] Already thinking, skipping');
            return;
        }
        this.isThinking = true;

        await new Promise(resolve => setTimeout(resolve, this.config.thinkTime));

        aiLog('[AI] Calling makeDecision...');
        const decision = this.makeDecision();
        aiLog('[AI] Decision made:', decision);
        this.executeAction(decision);

        this.isThinking = false;
    }

    /**
     * 执行行动（直接操作棋盘，不通过handleCellClick的拦截）
     */
    executeAction(decision) {
        aiLog('[AI] executeAction called with decision:', decision);

        switch (decision.action) {
            case 'place':
                aiLog('[AI] Placing stone at:', decision.row, decision.col);
                this.placeStoneViaGameFlow(decision.row, decision.col);
                break;

            case 'skill':
                // AI禁用技能：任何技能决策都回退到正常落子
                console.warn('[AI] Skill action ignored because AI skills are disabled');
                this.placeStoneViaGameFlow(decision.target?.row ?? 7, decision.target?.col ?? 7);
                break;

            case 'skip':
                aiLog('[AI] Skipping turn');
                this.game.switchPlayer();
                break;

            default:
                console.error('[AI] Unknown action:', decision.action);
        }
    }

    /**
     * 通过游戏主流程落子，保持与玩家一致的规则处理
     */
    placeStoneViaGameFlow(row, col) {
        if (this.game.canPlaceStone && !this.game.canPlaceStone(row, col)) {
            let fallback = LineDetector
                .getCandidatePositions(this.game.board, this.game)
                .find(pos => !this.game.canPlaceStone || this.game.canPlaceStone(pos.row, pos.col));

            if (!fallback) {
                for (let r = 0; r < 15 && !fallback; r++) {
                    for (let c = 0; c < 15; c++) {
                        if (!this.game.canPlaceStone || this.game.canPlaceStone(r, c)) {
                            fallback = { row: r, col: c };
                            break;
                        }
                    }
                }
            }

            if (!fallback) {
                console.error('[AI] No valid positions available!');
                return;
            }
            row = fallback.row;
            col = fallback.col;
        }

        if (typeof this.game.handleCellClick === 'function') {
            this.game.handleCellClick(row, col, { fromAI: true });
            return;
        }

        // 兜底方案（仅在主流程不可用时使用）
        this.directPlaceStone(row, col);
    }

    /**
     * 直接落子（绕过可能的拦截）
     */
    directPlaceStone(row, col) {
        aiLog('[AI] directPlaceStone called:', { row, col, player: this.player });

        const board = this.game.board;
        const player = this.player;

        // 检查位置是否可用
        if (this.game.canPlaceStone && !this.game.canPlaceStone(row, col)) {
            console.error('[AI] Cannot place stone at position!', { row, col });
            // 尝试找一个可用的位置
            const candidates = LineDetector.getCandidatePositions(board, this.game)
                .filter(pos => !this.game.canPlaceStone || this.game.canPlaceStone(pos.row, pos.col));
            if (candidates.length > 0) {
                const newPos = candidates[0];
                aiLog('[AI] Trying alternative position:', newPos);
                row = newPos.row;
                col = newPos.col;
            } else {
                console.error('[AI] No valid positions available!');
                return;
            }
        }

        // 直接放置棋子
        board[row][col] = player;
        aiLog('[AI] Stone placed successfully at', row, col);

        // 添加到历史记录
        if (this.game.moveHistory) {
            this.game.moveHistory.push({ row, col, player });
        }

        // 渲染棋盘
        if (this.game.renderBoard) {
            this.game.renderBoard();
        }

        // 检查胜利
        if (this.game.checkWin && this.game.checkWin(row, col)) {
            this.game.gameOver = true;
            if (this.game.showWinModal) {
                this.game.showWinModal();
            }
        } else {
            // 切换玩家
            this.game.switchPlayer();
        }
    }

    /**
     * 执行技能（改进版）
     */
    executeSkill(decision) {
        if (this.skillsDisabled) {
            this.placeStoneViaGameFlow(decision.target?.row || 7, decision.target?.col || 7);
            return;
        }

        const skill = this.game.currentSkillPool?.find(s => s.id === decision.skillId);
        if (!skill) {
            // 没找到技能，改为普通落子
            this.placeStoneViaGameFlow(decision.target?.row || 7, decision.target?.col || 7);
            return;
        }

        // 检查技能是否可用
        if (skill.canUse && !skill.canUse(this.game, this.player)) {
            // 技能不可用，改为普通落子
            this.placeStoneViaGameFlow(decision.target?.row || 7, decision.target?.col || 7);
            return;
        }

        // 检查能量是否足够
        const energy = this.game.getPlayerEnergy ? this.game.getPlayerEnergy(this.player) : 0;
        if (energy < skill.cost) {
            // 能量不足，改为普通落子
            this.placeStoneViaGameFlow(decision.target?.row || 7, decision.target?.col || 7);
            return;
        }

        // 消耗能量
        if (this.game.consumeEnergy) {
            this.game.consumeEnergy(this.player, skill.cost);
        }

        // 开始技能冷却
        if (skill.startCooldown) {
            skill.startCooldown();
        }

        // 设置活跃技能
        this.game.activeSkill = skill;

        // 处理技能目标
        if (decision.target && skill.targetType !== 'none') {
            this.useSkillWithTarget(skill, decision.target);
        } else {
            // 无目标技能，直接使用
            const result = skill.use(this.game, null, this.player);

            // 检查技能是否包含落子
            const skillIncludesPlacement = this.skillIncludesPlacement(skill);

            if (!skillIncludesPlacement) {
                // 技能不包含落子，需要切换玩家
                this.game.switchPlayer();
            }
        }

        // 更新UI
        if (this.game.renderSkills) {
            this.game.renderSkills();
        }
        if (this.game.updateEnergyUI) {
            this.game.updateEnergyUI();
        }
    }

    /**
     * 检查技能是否包含落子
     */
    skillIncludesPlacement(skill) {
        if (!skill.use) return false;
        const skillCode = skill.use.toString();
        return skillCode.includes('switchPlayer') || skillCode.includes('placeStone');
    }

    /**
     * 使用带目标的技能
     */
    useSkillWithTarget(skill, target) {
        const targetInfo = {
            row: target.row,
            col: target.col,
            stone: target.stone || this.game.board[target.row][target.col]
        };

        const result = skill.use(this.game, targetInfo, this.player);

        // 检查是否进入pending状态
        if (this.game.pendingSkillEffect) {
            // 等待第二次选择
            return;
        }

        // 技能完成后的处理
        this.finishSkillUse(skill, result);
    }

    /**
     * 完成技能使用后的处理
     */
    finishSkillUse(skill, result) {
        // 检查是否需要切换玩家
        if (!this.skillIncludesPlacement(skill)) {
            this.game.switchPlayer();
        }
    }
    };
}

// ==================== 浏览器环境兼容性 ====================
// 确保在浏览器环境中所有类都可用
// 类已经在条件语句中定义并附加到window对象，这里不需要重复赋值

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GomokuAI,
        LineDetector,
        AlphaBetaSearch,
        OpeningBook,
        ThreatSpaceSearch,
        SkillComboSystem,
        AI_CONFIG,
        SKILL_VALUE,
        SKILL_COMBOS,
        SKILL_CATEGORY,
        THREAT_LEVEL
    };
}
