/**
 * 对战记录与复盘分析系统
 * 用于记录、保存和分析对局数据
 */

// ==================== 对战记录类 ====================
class GameRecorder {
    constructor(game) {
        this.game = game;
        this.recording = {
            startTime: null,
            endTime: null,
            players: {
                black: { type: null, name: null },
                white: { type: null, name: null }
            },
            moves: [],
            skillUses: [],
            events: [],
            result: null,
            skillPool: []
        };
        this.isRecording = false;
    }

    /**
     * 开始记录
     */
    startRecording(blackType, whiteType, skillPool) {
        this.recording = {
            startTime: new Date().toISOString(),
            endTime: null,
            players: {
                black: { type: blackType, name: this.getPlayerName(blackType) },
                white: { type: whiteType, name: this.getPlayerName(whiteType) }
            },
            moves: [],
            skillUses: [],
            events: [],
            result: null,
            skillPool: skillPool?.map(s => ({ id: s.id, name: s.name })) || []
        };
        this.isRecording = true;

        this.addEvent('game_start', '游戏开始');
    }

    /**
     * 记录落子
     */
    recordMove(player, row, col, thinkTime = null) {
        if (!this.isRecording) return;

        const move = {
            player: player,
            row: row,
            col: col,
            moveNumber: this.recording.moves.length + 1,
            timestamp: Date.now() - new Date(this.recording.startTime).getTime(),
            thinkTime: thinkTime
        };

        this.recording.moves.push(move);
    }

    /**
     * 记录技能使用
     */
    recordSkillUse(player, skillId, skillName, target, result) {
        if (!this.isRecording) return;

        const skillUse = {
            player: player,
            skillId: skillId,
            skillName: skillName,
            target: target,
            result: result,
            moveNumber: this.recording.moves.length + 1,
            timestamp: Date.now() - new Date(this.recording.startTime).getTime()
        };

        this.recording.skillUses.push(skillUse);
        this.addEvent('skill_use', `${player} 使用 ${skillName}`);
    }

    /**
     * 添加事件
     */
    addEvent(type, description) {
        if (!this.isRecording) return;

        this.recording.events.push({
            type: type,
            description: description,
            timestamp: Date.now() - new Date(this.recording.startTime).getTime()
        });
    }

    /**
     * 结束记录
     */
    endRecording(winner, reason) {
        if (!this.isRecording) return;

        this.recording.endTime = new Date().toISOString();
        this.recording.result = {
            winner: winner,
            reason: reason,
            totalMoves: this.recording.moves.length,
            duration: Date.now() - new Date(this.recording.startTime).getTime()
        };

        this.addEvent('game_end', `游戏结束: ${winner} 获胜 (${reason})`);
        this.isRecording = false;
    }

    /**
     * 获取记录数据
     */
    getRecording() {
        return this.recording;
    }

    /**
     * 导出为JSON
     */
    exportJSON() {
        return JSON.stringify(this.recording, null, 2);
    }

    /**
     * 导出为SGF格式
     */
    exportSGF() {
        const r = this.recording;
        let sgf = `(;GM[1]FF[4]SZ[15]KM[0.0]\n`;
        sgf += `PB[${r.players.black.name}]PB[${r.players.black.type}]\n`;
        sgf += `PW[${r.players.white.name}]PW[${r.players.white.type}]\n`;
        sgf += `DT[${new Date(r.startTime).toLocaleDateString()}]\n`;
        sgf += `RE[${r.result?.winner || '?'}.${r.result?.reason || ''}]\n`;

        // 技能池
        if (r.skillPool.length > 0) {
            sgf += `GC[技能池: ${r.skillPool.map(s => s.name).join(', ')}]\n`;
        }

        // 招法
        for (const move of r.moves) {
            const coord = this.rowColToSGF(move.row, move.col);
            sgf += `;${move.player === 'black' ? 'B' : 'W'}[${coord}]`;
        }

        // 技能使用记录
        for (const skill of r.skillUses) {
            sgf += `\nN[${skill.player} 使用 ${skill.skillName}]`;
        }

        sgf += ')';

        return sgf;
    }

    /**
     * 行列转SGF坐标
     */
    rowColToSGF(row, col) {
        const letters = 'abcdefghijklmnopqrs';
        return letters[col] + letters[14 - row];
    }

    /**
     * SGF坐标转行列
     */
    sgfToRowCol(sgfCoord) {
        const letters = 'abcdefghijklmnopqrs';
        const col = letters.indexOf(sgfCoord[0]);
        const row = 14 - letters.indexOf(sgfCoord[1]);
        return { row, col };
    }

    /**
     * 获取玩家名称
     */
    getPlayerName(type) {
        const names = {
            'human': '玩家',
            'easy': 'AI(简单)',
            'medium': 'AI(中等)',
            'hard': 'AI(困难)'
        };
        return names[type] || type;
    }

    /**
     * 保存记录到本地存储
     */
    saveToLocalStorage() {
        try {
            const history = JSON.parse(localStorage.getItem('gomoku_history') || '[]');
            history.push(this.recording);

            // 最多保存100局
            if (history.length > 100) {
                history.shift();
            }

            localStorage.setItem('gomoku_history', JSON.stringify(history));
            return true;
        } catch (e) {
            console.error('保存失败:', e);
            return false;
        }
    }

    /**
     * 从本地存储加载历史记录
     */
    static loadFromLocalStorage() {
        try {
            const history = JSON.parse(localStorage.getItem('gomoku_history') || '[]');
            return history;
        } catch (e) {
            console.error('加载失败:', e);
            return [];
        }
    }

    /**
     * 清除历史记录
     */
    static clearHistory() {
        localStorage.removeItem('gomoku_history');
    }
}

// ==================== 复盘分析类 ====================
class GameAnalyzer {
    constructor(recording) {
        this.recording = recording;
        this.analysis = null;
    }

    /**
     * 执行完整分析
     */
    analyze() {
        this.analysis = {
            summary: this.analyzeSummary(),
            moves: this.analyzeMoves(),
            skills: this.analyzeSkills(),
            turningPoints: this.findTurningPoints(),
            mistakes: this.findMistakes(),
            recommendations: this.generateRecommendations()
        };

        return this.analysis;
    }

    /**
     * 分析总体概况
     */
    analyzeSummary() {
        const r = this.recording;
        const blackMoves = r.moves.filter(m => m.player === 'black').length;
        const whiteMoves = r.moves.filter(m => m.player === 'white').length;

        return {
            duration: r.result?.duration || 0,
            totalMoves: r.moves.length,
            blackMoves: blackMoves,
            whiteMoves: whiteMoves,
            skillUses: r.skillUses.length,
            skillPool: r.skillPool.length,
            winner: r.result?.winner || 'unknown',
            winReason: r.result?.reason || 'unknown'
        };
    }

    /**
     * 分析招法
     */
    analyzeMoves() {
        const moveAnalysis = [];
        let board = Array(15).fill(null).map(() => Array(15).fill(null));

        for (let i = 0; i < this.recording.moves.length; i++) {
            const move = this.recording.moves[i];

            // 分析招法类型
            const type = this.classifyMove(board, move);

            // 计算招法价值
            const value = this.evaluateMove(board, move);

            moveAnalysis.push({
                ...move,
                type: type,
                value: value,
                critical: value > 1000
            });

            // 更新棋盘
            board[move.row][move.col] = move.player;
        }

        return moveAnalysis;
    }

    /**
     * 分类招法
     */
    classifyMove(board, move) {
        const { row, col, player } = move;

        // 检查是否在中心区域
        const isCenter = row >= 5 && row <= 9 && col >= 5 && col <= 9;

        // 检查周围棋子数
        let neighbors = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc]) {
                    neighbors++;
                }
            }
        }

        // 分类
        if (this.isWinningMove(board, move)) return 'winning';
        if (this.isBlockingMove(board, move)) return 'blocking';
        if (this.isFormingLine(board, move, 4)) return 'attack_4';
        if (this.isFormingLine(board, move, 3)) return 'attack_3';
        if (neighbors >= 3) return 'developing';
        if (isCenter) return 'central';
        return 'normal';
    }

    /**
     * 评估招法价值
     */
    evaluateMove(board, move) {
        const { row, col, player } = move;
        let value = 0;

        // 位置价值
        const centerDist = Math.abs(row - 7) + Math.abs(col - 7);
        value += (14 - centerDist) * 5;

        // 模拟落子后的威胁
        board[row][col] = player;
        const threats = this.detectThreats(board, player);
        board[row][col] = null;

        value += threats.win.length * 100000;
        value += threats.liveFour.length * 10000;
        value += threats.rushFour.length * 5000;
        value += threats.liveThree.length * 1000;
        value += threats.sleepThree.length * 300;
        value += threats.liveTwo.length * 100;

        return value;
    }

    /**
     * 检测威胁
     */
    detectThreats(board, player) {
        // 简化的威胁检测
        return {
            win: this.findLines(board, player, 5),
            liveFour: this.findLines(board, player, 4, 2),
            rushFour: this.findLines(board, player, 4, 1),
            liveThree: this.findLines(board, player, 3, 2),
            sleepThree: this.findLines(board, player, 3, 1),
            liveTwo: this.findLines(board, player, 2, 2)
        };
    }

    /**
     * 查找连线
     */
    findLines(board, player, length, openEnds = 0) {
        const lines = [];
        const dirs = [[0,1], [1,0], [1,1], [1,-1]];

        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (board[r][c] !== player) continue;

                for (const [dr, dc] of dirs) {
                    let count = 1;
                    let ends = 0;

                    // 正向
                    let nr = r + dr, nc = c + dc;
                    while (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc] === player) {
                        count++;
                        nr += dr;
                        nc += dc;
                    }
                    if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc] === null) ends++;

                    // 反向
                    nr = r - dr;
                    nc = c - dc;
                    while (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc] === player) {
                        count++;
                        nr -= dr;
                        nc -= dc;
                    }
                    if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc] === null) ends++;

                    if (count >= length && ends >= openEnds) {
                        lines.push({ row: r, col: c, dr, dc, count, ends });
                    }
                }
            }
        }

        return lines;
    }

    /**
     * 判断是否为获胜招法
     */
    isWinningMove(board, move) {
        board[move.row][move.col] = move.player;
        const isWin = this.findLines(board, move.player, 5).length > 0;
        board[move.row][move.col] = null;
        return isWin;
    }

    /**
     * 判断是否为防守招法
     */
    isBlockingMove(board, move) {
        const opponent = move.player === 'black' ? 'white' : 'black';
        board[move.row][move.col] = opponent;
        const isBlocking = this.findLines(board, opponent, 5).length > 0;
        board[move.row][move.col] = null;
        return isBlocking;
    }

    /**
     * 判断是否形成指定长度连线
     */
    isFormingLine(board, move, length) {
        board[move.row][move.col] = move.player;
        const hasLine = this.findLines(board, move.player, length).length > 0;
        board[move.row][move.col] = null;
        return hasLine;
    }

    /**
     * 分析技能使用
     */
    analyzeSkills() {
        const skillStats = {};
        const playerStats = { black: [], white: [] };

        for (const use of this.recording.skillUses) {
            // 技能统计
            if (!skillStats[use.skillId]) {
                skillStats[use.skillId] = {
                    name: use.skillName,
                    count: 0,
                    players: { black: 0, white: 0 }
                };
            }
            skillStats[use.skillId].count++;
            skillStats[use.skillId].players[use.player]++;

            // 玩家统计
            playerStats[use.player].push({
                skillId: use.skillId,
                skillName: use.skillName,
                moveNumber: use.moveNumber,
                result: use.result
            });
        }

        return {
            bySkill: skillStats,
            byPlayer: playerStats,
            total: this.recording.skillUses.length
        };
    }

    /**
     * 找到转折点
     */
    findTurningPoints() {
        const turningPoints = [];
        const moves = this.analyzeMoves();

        for (let i = 1; i < moves.length; i++) {
            const prevValue = moves[i - 1].value;
            const currValue = moves[i].value;

            // 价值变化超过阈值
            if (Math.abs(currValue - prevValue) > 2000) {
                turningPoints.push({
                    moveNumber: i + 1,
                    type: currValue > prevValue ? 'advantage_gained' : 'advantage_lost',
                    change: currValue - prevValue,
                    move: moves[i]
                });
            }

            // 关键招法
            if (moves[i].critical) {
                turningPoints.push({
                    moveNumber: i + 1,
                    type: 'critical_move',
                    move: moves[i]
                });
            }
        }

        return turningPoints;
    }

    /**
     * 找到失误
     */
    findMistakes() {
        const mistakes = [];
        const moves = this.analyzeMoves();

        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];

            // 未防守对方威胁
            if (i > 0 && moves[i - 1].type === 'attack_4' && move.type !== 'blocking') {
                mistakes.push({
                    moveNumber: i + 1,
                    type: 'missed_block',
                    severity: 'high',
                    description: '未防守对方四连',
                    move: move
                });
            }

            // 低价值招法
            if (move.value < 50 && i > 10) {
                mistakes.push({
                    moveNumber: i + 1,
                    type: 'low_value',
                    severity: 'low',
                    description: '低价值招法',
                    move: move
                });
            }
        }

        return mistakes;
    }

    /**
     * 生成建议
     */
    generateRecommendations() {
        const recommendations = [];
        const summary = this.analyzeSummary();
        const skills = this.analyzeSkills();

        // 技能使用建议
        if (skills.total < summary.totalMoves / 10) {
            recommendations.push({
                type: 'skill_usage',
                priority: 'medium',
                message: '技能使用偏少，建议更积极地使用技能来改变局面'
            });
        }

        // 招法建议
        const mistakes = this.findMistakes();
        if (mistakes.filter(m => m.severity === 'high').length > 2) {
            recommendations.push({
                type: 'defensive_awareness',
                priority: 'high',
                message: '防守意识需要提高，注意对方的关键威胁'
            });
        }

        // 胜率建议
        if (summary.winner === 'unknown') {
            recommendations.push({
                type: 'completion',
                priority: 'low',
                message: '对局未完成，建议完成对局以获得完整分析'
            });
        }

        return recommendations;
    }

    /**
     * 生成分析报告
     */
    generateReport() {
        if (!this.analysis) {
            this.analyze();
        }

        const a = this.analysis;

        return `
=== 对局分析报告 ===

【基本信息】
- 对局时间: ${new Date(this.recording.startTime).toLocaleString()}
- 对局时长: ${Math.floor(a.summary.duration / 1000)}秒
- 总招数: ${a.summary.totalMoves}
- 技能使用: ${a.summary.skillUses}次
- 获胜方: ${a.summary.winner}

【招法分析】
- 黑方招数: ${a.summary.blackMoves}
- 白方招数: ${a.summary.whiteMoves}
- 关键招法: ${a.moves.filter(m => m.critical).length}个

【技能分析】
${Object.values(a.skills.bySkill).map(s =>
    `- ${s.name}: 使用${s.count}次 (黑:${s.players.black}, 白:${s.players.white})`
).join('\n')}

【转折点】
${a.turningPoints.map(tp =>
    `- 第${tp.moveNumber}手: ${tp.type === 'critical_move' ? '关键招法' : '优势变化'}`
).join('\n') || '无明显转折点'}

【改进建议】
${a.recommendations.map(r =>
    `- [${r.priority}] ${r.message}`
).join('\n') || '无需特别改进'}
        `.trim();
    }

    /**
     * 导出分析数据
     */
    exportAnalysis() {
        return JSON.stringify(this.analysis, null, 2);
    }
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GameRecorder,
        GameAnalyzer
    };
}
