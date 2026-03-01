/**
 * 三十六计完整技能实现
 * 包含全部36个计策的技能类
 * 使用方法：将此文件内容复制到 gomoku.html 中
 */

// ==================== 胜战计 ====================

// 1. 瞒天过海：移除己方一颗棋子，然后在任意空位重新落子
class Skill_MantianGuohai extends Skill {
    constructor() {
        super({
            id: 's1',
            name: '瞒天过海',
            icon: '🌊',
            cost: 2,
            cooldown: 3,
            category: '胜战计',
            description: '移除己方一颗棋子，然后在任意空位重新落子',
            targetType: SkillTargetType.STONE
        });
    }

    canUse(game, player) {
        if (!super.canUse(game, player)) return false;
        // 检查是否有己方棋子
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (game.board[r][c] === player) return true;
            }
        }
        return false;
    }

    use(game, target, player) {
        if (!target.stone || target.stone !== player) {
            game.showEffect(target.row, target.col, '❌ 请选择己方棋子');
            return false;
        }

        // 设置等待第二次选择
        game.pendingSkillEffect = {
            skill: this,
            player: player,
            type: 's1_second',
            firstSelection: { row: target.row, col: target.col }
        };

        game.showEffect(target.row, target.col, '🌊 请选择新位置');
        return true;
    }
}

// 2. 围魏救赵：强制对方下回合必须防守指定位置
class Skill_WeiweiJiuZhao extends Skill {
    constructor() {
        super({
            id: 's2',
            name: '围魏救赵',
            icon: '⚔️',
            cost: 3,
            cooldown: 4,
            category: '胜战计',
            description: '对方下回合必须在指定位置防守，否则无法落子',
            targetType: SkillTargetType.CELL
        });
    }

    use(game, target, player) {
        if (!game.canPlaceStone(target.row, target.col)) {
            game.showEffect(target.row, target.col, '❌ 无效位置');
            return false;
        }

        const opponent = game.getOpponent(player);
        game.forcedPlacement = {
            player: opponent,
            row: target.row,
            col: target.col
        };

        game.showEffect(target.row, target.col, '⚔️ 对方被迫防守!');
        return true;
    }
}

// 3. 借刀杀人：将对方一颗棋子变为己方棋子
class Skill_JiedaoShare extends Skill {
    constructor() {
        super({
            id: 's3',
            name: '借刀杀人',
            icon: '🗡️',
            cost: 4,
            cooldown: 5,
            category: '胜战计',
            description: '将对方一颗棋子转化为己方棋子',
            targetType: SkillTargetType.STONE
        });
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);
        if (!target.stone || target.stone !== opponent) {
            game.showEffect(target.row, target.col, '❌ 请选择对方棋子');
            return false;
        }

        // 转化棋子
        game.board[target.row][target.col] = player;

        game.showEffect(target.row, target.col, '🗡️ 棋子已转化!');

        // 检查胜利
        if (game.checkWin(target.row, target.col)) {
            game.gameOver = true;
            game.showWinModal();
        }

        game.renderBoard();
        return true;
    }
}

// 4. 以逸待劳：跳过本回合，获得2点能量
class Skill_YiyiDailao extends Skill {
    constructor() {
        super({
            id: 's4',
            name: '以逸待劳',
            icon: '🧘',
            cost: 1,
            cooldown: 2,
            category: '胜战计',
            description: '跳过本回合，获得2点能量',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        game.addEnergy(player, 2);
        game.showEffect(7, 7, '🧘 蓄势待发! +2能量');
        game.switchPlayer();
        return true;
    }
}

// 5. 趁火打劫：当对方有威胁时使用，打断其连线
class Skill_ChenhuoDajie extends Skill {
    constructor() {
        super({
            id: 's5',
            name: '趁火打劫',
            icon: '🔥',
            cost: 3,
            cooldown: 4,
            category: '胜战计',
            description: '移除对方参与三连或四连的一颗棋子',
            targetType: SkillTargetType.STONE
        });
    }

    canUse(game, player) {
        if (!super.canUse(game, player)) return false;
        const opponent = game.getOpponent(player);
        // 检查对方是否有三连或四连
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (game.board[r][c] === opponent) {
                    if (game.checkFormLine(r, c, opponent, 3) ||
                        game.checkFormLine(r, c, opponent, 4)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);
        if (!target.stone || target.stone !== opponent) {
            game.showEffect(target.row, target.col, '❌ 请选择对方棋子');
            return false;
        }

        // 检查该棋子是否参与连线
        if (!game.checkFormLine(target.row, target.col, opponent, 3) &&
            !game.checkFormLine(target.row, target.col, opponent, 4)) {
            game.showEffect(target.row, target.col, '❌ 请选择参与连线的棋子');
            return false;
        }

        game.board[target.row][target.col] = null;
        game.showEffect(target.row, target.col, '🔥 连线被打断!');
        game.renderBoard();
        return true;
    }
}

// 6. 声东击西：标记一个区域为"危险区"，对方不能在此落子
class Skill_ShengdongJixi extends Skill {
    constructor() {
        super({
            id: 's6',
            name: '声东击西',
            icon: '🎭',
            cost: 2,
            cooldown: 3,
            category: '胜战计',
            description: '标记3x3区域为危险区，持续2回合',
            targetType: SkillTargetType.CELL,
            range: 1
        });
    }

    use(game, target, player) {
        const area = this.getArea(target.row, target.col);

        // 设置危险区
        game.dangerZone = {
            cells: area,
            turns: 2,
            creator: player
        };

        game.showEffect(target.row, target.col, '🎭 危险区域已标记!');
        game.renderBoard();
        return true;
    }
}

// ==================== 敌战计 ====================

// 7. 无中生有：在空位放置一颗"幻影棋子"，持续1回合
class Skill_WuzhongShengyou extends Skill {
    constructor() {
        super({
            id: 'e1',
            name: '无中生有',
            icon: '👻',
            cost: 5,
            cooldown: 6,
            category: '敌战计',
            description: '在空位放置幻影棋子，持续1回合后消失',
            targetType: SkillTargetType.CELL
        });
    }

    use(game, target, player) {
        if (!game.canPlaceStone(target.row, target.col)) {
            game.showEffect(target.row, target.col, '❌ 无效位置');
            return false;
        }

        // 放置幻影棋子
        game.board[target.row][target.col] = player;
        game.phantomStones = game.phantomStones || [];
        game.phantomStones.push({
            row: target.row,
            col: target.col,
            turns: 1
        });

        game.showEffect(target.row, target.col, '👻 幻影棋子!');
        game.renderBoard();
        return true;
    }
}

// 8. 暗度陈仓：本回合可以落子两次
class Skill_AnduChencang extends Skill {
    constructor() {
        super({
            id: 'e2',
            name: '暗度陈仓',
            icon: '🌙',
            cost: 3,
            cooldown: 4,
            category: '敌战计',
            description: '本回合可以连续落子两次',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        game.extraTurn = {
            player: player,
            count: 1
        };

        game.showEffect(7, 7, '🌙 额外行动机会!');
        return true;
    }
}

// 9. 隔岸观火：禁止双方使用技能，持续2回合
class Skill_GeAnGuanhuo extends Skill {
    constructor() {
        super({
            id: 'e3',
            name: '隔岸观火',
            icon: '🔥',
            cost: 2,
            cooldown: 3,
            category: '敌战计',
            description: '双方2回合内无法使用技能',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        game.skillSeal = {
            turns: 2,
            creator: player
        };

        game.showEffect(7, 7, '🔥 技能已被封印!');
        return true;
    }
}

// 10. 笑里藏刀：与对方交换1点能量
class Skill_XiaoliCangdao extends Skill {
    constructor() {
        super({
            id: 'e4',
            name: '笑里藏刀',
            icon: '😊',
            cost: 1,
            cooldown: 2,
            category: '敌战计',
            description: '与对方交换1点能量',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);
        const playerEnergy = game.getPlayerEnergy(player);
        const opponentEnergy = game.getPlayerEnergy(opponent);

        // 双方各给对方1点能量
        if (playerEnergy >= 1) {
            game.consumeEnergy(player, 1);
            game.addEnergy(opponent, 1);
        }
        if (opponentEnergy >= 1) {
            game.consumeEnergy(opponent, 1);
            game.addEnergy(player, 1);
        }

        game.showEffect(7, 7, '😊 能量交换!');
        return true;
    }
}

// 11. 李代桃僵：牺牲己方一颗棋子，破坏对方一条连线
class Skill_LidaiTaojiang extends Skill {
    constructor() {
        super({
            id: 'e5',
            name: '李代桃僵',
            icon: '🍑',
            cost: 3,
            cooldown: 4,
            category: '敌战计',
            description: '移除己方一子，打断对方一条四连线',
            targetType: SkillTargetType.NONE
        });
    }

    canUse(game, player) {
        if (!super.canUse(game, player)) return false;
        const opponent = game.getOpponent(player);
        // 检查对方是否有四连
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (game.board[r][c] === opponent) {
                    if (game.checkFormLine(r, c, opponent, 4)) return true;
                }
            }
        }
        return false;
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);

        // 找到对方的四连并打断
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (game.board[r][c] === opponent) {
                    if (game.checkFormLine(r, c, opponent, 4)) {
                        game.board[r][c] = null;
                        game.showEffect(r, c, '🍑 连线被破坏!');
                        game.renderBoard();
                        return true;
                    }
                }
            }
        }

        game.showEffect(7, 7, '❌ 未找到四连');
        return false;
    }
}

// 12. 顺手牵羊：将对方一颗棋子向任意方向移动一格
class Skill_ShunshouQianyang extends Skill {
    constructor() {
        super({
            id: 'e6',
            name: '顺手牵羊',
            icon: '🐑',
            cost: 2,
            cooldown: 3,
            category: '敌战计',
            description: '移动对方一颗棋子到相邻位置',
            targetType: SkillTargetType.STONE
        });
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);
        if (!target.stone || target.stone !== opponent) {
            game.showEffect(target.row, target.col, '❌ 请选择对方棋子');
            return false;
        }

        // 设置等待选择新位置
        game.pendingSkillEffect = {
            skill: this,
            player: player,
            type: 'e6_second',
            firstSelection: { row: target.row, col: target.col }
        };

        game.showEffect(target.row, target.col, '🐑 请选择移动位置');
        return true;
    }
}

// ==================== 攻战计 ====================

// 13. 打草惊蛇：查看对方当前能量和上次使用的技能
class Skill_DacaoJingshe extends Skill {
    constructor() {
        super({
            id: 'a1',
            name: '打草惊蛇',
            icon: '🐍',
            cost: 1,
            cooldown: 1,
            category: '攻战计',
            description: '查看对方能量和技能信息',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);
        const energy = game.getPlayerEnergy(opponent);
        const lastSkill = game.lastUsedSkill?.[opponent];

        let info = `🐍 对方能量: ${energy}`;
        if (lastSkill) {
            info += `\n上次使用: ${lastSkill.name}`;
        }

        game.showEffect(7, 7, info);
        return true;
    }
}

// 14. 借尸还魂：复活上一颗被移除的己方棋子
class Skill_JieshiHuanhun extends Skill {
    constructor() {
        super({
            id: 'a2',
            name: '借尸还魂',
            icon: '💀',
            cost: 4,
            cooldown: 5,
            category: '攻战计',
            description: '在空位复活一颗被移除的己方棋子',
            targetType: SkillTargetType.CELL
        });
    }

    canUse(game, player) {
        if (!super.canUse(game, player)) return false;
        return game.removedStones?.[player]?.length > 0;
    }

    use(game, target, player) {
        if (!game.canPlaceStone(target.row, target.col)) {
            game.showEffect(target.row, target.col, '❌ 无效位置');
            return false;
        }

        // 获取最后一颗被移除的棋子位置
        const lastRemoved = game.removedStones[player].pop();
        if (!lastRemoved) {
            game.showEffect(7, 7, '❌ 无可复活棋子');
            return false;
        }

        game.board[target.row][target.col] = player;
        game.showEffect(target.row, target.col, '💀 棋子复活!');

        if (game.checkWin(target.row, target.col)) {
            game.gameOver = true;
            game.showWinModal();
        }

        game.renderBoard();
        return true;
    }
}

// 15. 调虎离山：强制对方下一颗棋子必须落在离中心最远的位置
class Skill_DiaohuliLishan extends Skill {
    constructor() {
        super({
            id: 'a3',
            name: '调虎离山',
            icon: '🏔️',
            cost: 3,
            cooldown: 4,
            category: '攻战计',
            description: '对方下回合必须在远离中心的位置落子',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);
        game.farFromCenter = {
            player: opponent,
            turns: 1
        };

        game.showEffect(7, 7, '🏔️ 对方被调离!');
        return true;
    }
}

// 16. 欲擒故纵：让出一回合，获得3点能量
class Skill_YuqingGuzong extends Skill {
    constructor() {
        super({
            id: 'a4',
            name: '欲擒故纵',
            icon: '🎯',
            cost: 2,
            cooldown: 3,
            category: '攻战计',
            description: '让出一回合，获得3点能量',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        game.addEnergy(player, 3);
        game.showEffect(7, 7, '🎯 放长线钓大鱼! +3能量');
        game.switchPlayer();
        return true;
    }
}

// 17. 抛砖引玉：随机获取一个未解锁的技能
class Skill_PaozhuanYinyu extends Skill {
    constructor() {
        super({
            id: 'a5',
            name: '抛砖引玉',
            icon: '🧱',
            cost: 3,
            cooldown: 4,
            category: '攻战计',
            description: '本回合可以使用任意一个技能，能量减半',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        game.halfCostSkill = {
            player: player,
            turns: 1
        };

        game.showEffect(7, 7, '🧱 技能能量减半!');
        return true;
    }
}

// 18. 擒贼擒王：直接获得胜利（需要5颗棋子连线）
class Skill_QinzeiQinwang extends Skill {
    constructor() {
        super({
            id: 'a6',
            name: '擒贼擒王',
            icon: '👑',
            cost: 8,
            cooldown: 9,
            category: '攻战计',
            description: '自动形成五连获胜（需已有4连）',
            targetType: SkillTargetType.NONE
        });
    }

    canUse(game, player) {
        if (!super.canUse(game, player)) return false;
        // 检查是否有四连
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (game.board[r][c] === player) {
                    if (game.checkFormLine(r, c, player, 4)) return true;
                }
            }
        }
        return false;
    }

    use(game, target, player) {
        // 找到四连并完成第五子
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (game.board[r][c] === player) {
                    if (game.checkFormLine(r, c, player, 4)) {
                        // 找到第五个位置
                        const dirs = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [-1,-1], [1,-1], [-1,1]];
                        for (let [dr, dc] of dirs) {
                            let count = 1;
                            let endR = r, endC = c;
                            // 正向
                            let nr = r + dr, nc = c + dc;
                            while (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && game.board[nr][nc] === player) {
                                count++;
                                endR = nr;
                                endC = nc;
                                nr += dr;
                                nc += dc;
                            }
                            // 反向
                            nr = r - dr;
                            nc = c - dc;
                            while (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && game.board[nr][nc] === player) {
                                count++;
                                nr -= dr;
                                nc -= dc;
                            }

                            if (count === 4) {
                                // 放置第五子
                                let winR = endR + dr, winC = endC + dc;
                                if (winR >= 0 && winR < 15 && winC >= 0 && winC < 15 &&
                                    game.board[winR][winC] === null) {
                                    game.board[winR][winC] = player;
                                    game.moveHistory.push({ row: winR, col: winC, player });
                                    game.showEffect(winR, winC, '👑 擒贼擒王!');
                                    game.gameOver = true;
                                    game.showWinModal();
                                    game.renderBoard();
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }

        game.showEffect(7, 7, '❌ 无法完成五连');
        return false;
    }
}

// ==================== 混战计 ====================

// 19. 釜底抽薪：移除棋盘上所有双方各一颗棋子
class Skill_FudiChouxin extends Skill {
    constructor() {
        super({
            id: 'c1',
            name: '釜底抽薪',
            icon: '🔥',
            cost: 5,
            cooldown: 6,
            category: '混战计',
            description: '移除双方各一颗棋子（各选一颗）',
            targetType: SkillTargetType.STONE
        });
    }

    use(game, target, player) {
        if (!target.stone) {
            game.showEffect(target.row, target.col, '❌ 请选择棋子');
            return false;
        }

        const opponent = game.getOpponent(player);
        const firstPlayer = target.stone;

        // 设置等待第二颗棋子
        game.pendingSkillEffect = {
            skill: this,
            player: player,
            type: 'c1_second',
            firstSelection: { row: target.row, col: target.col, firstPlayer }
        };

        game.showEffect(target.row, target.col, '🔥 请选择第二颗棋子');
        return true;
    }
}

// 20. 浑水摸鱼：随机移动3颗棋子
class Skill_HunshuiMoyu extends Skill {
    constructor() {
        super({
            id: 'c2',
            name: '浑水摸鱼',
            icon: '🐟',
            cost: 3,
            cooldown: 4,
            category: '混战计',
            description: '随机移动棋盘上3颗棋子',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        let moved = 0;
        const attempts = 50;

        for (let i = 0; i < attempts && moved < 3; i++) {
            // 随机选择一颗棋子
            const stones = [];
            for (let r = 0; r < 15; r++) {
                for (let c = 0; c < 15; c++) {
                    if (game.board[r][c]) stones.push({ r, c, stone: game.board[r][c] });
                }
            }

            if (stones.length === 0) break;

            const from = stones[Math.floor(Math.random() * stones.length)];
            game.board[from.r][from.c] = null;

            // 随机选择新位置
            let newR, newC;
            let tryCount = 0;
            do {
                newR = Math.floor(Math.random() * 15);
                newC = Math.floor(Math.random() * 15);
                tryCount++;
            } while (game.board[newR][newC] !== null && tryCount < 20);

            if (game.board[newR][newC] === null) {
                game.board[newR][newC] = from.stone;
                moved++;
            } else {
                game.board[from.r][from.c] = from.stone;
            }
        }

        game.showEffect(7, 7, `🐟 移动了${moved}颗棋子!`);
        game.renderBoard();
        return true;
    }
}

// 21. 金蝉脱壳：本回合落子后可以再移动一次
class Skill_JinchanTuqiao extends Skill {
    constructor() {
        super({
            id: 'c3',
            name: '金蝉脱壳',
            icon: '🦗',
            cost: 3,
            cooldown: 4,
            category: '混战计',
            description: '落子后可立即移动该棋子',
            targetType: SkillTargetType.CELL
        });
    }

    use(game, target, player) {
        if (!game.canPlaceStone(target.row, target.col)) {
            game.showEffect(target.row, target.col, '❌ 无效位置');
            return false;
        }

        // 先落子
        game.board[target.row][target.col] = player;

        // 设置可以移动
        game.canMoveLastStone = {
            player: player,
            row: target.row,
            col: target.col
        };

        game.showEffect(target.row, target.col, '🦗 可立即移动!');
        game.renderBoard();

        if (game.checkWin(target.row, target.col)) {
            game.gameOver = true;
            game.showWinModal();
        } else {
            game.switchPlayer();
        }

        return true;
    }
}

// 22. 关门捉贼：在指定区域设置"包围区"，对方棋子无法离开
class Skill_GuanmenZhuozei extends Skill {
    constructor() {
        super({
            id: 'c4',
            name: '关门捉贼',
            icon: '🚪',
            cost: 3,
            cooldown: 4,
            category: '混战计',
            description: '设置5x5包围区，对方棋子无法移出',
            targetType: SkillTargetType.CELL,
            range: 2
        });
    }

    use(game, target, player) {
        const area = [];
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const nr = target.row + dr;
                const nc = target.col + dc;
                if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15) {
                    area.push({ row: nr, col: nc });
                }
            }
        }

        game.trapZone = {
            area: area,
            turns: 2,
            creator: player
        };

        game.showEffect(target.row, target.col, '🚪 包围区已设!');
        game.renderBoard();
        return true;
    }
}

// 23. 远交近攻：距离对方最近的己方棋子获得强化
class Skill_YuanjiaoJingong extends Skill {
    constructor() {
        super({
            id: 'c5',
            name: '远交近攻',
            icon: '🤝',
            cost: 2,
            cooldown: 3,
            category: '混战计',
            description: '标记一颗己方棋子为强化状态',
            targetType: SkillTargetType.STONE
        });
    }

    use(game, target, player) {
        if (!target.stone || target.stone !== player) {
            game.showEffect(target.row, target.col, '❌ 请选择己方棋子');
            return false;
        }

        game.enhancedStones = game.enhancedStones || [];
        game.enhancedStones.push({
            row: target.row,
            col: target.col,
            player: player
        });

        game.showEffect(target.row, target.col, '🤝 棋子已强化!');
        game.renderBoard();
        return true;
    }
}

// 24. 假途伐虢：借用对方棋子连线来强化己方
class Skill_Jiatufage extends Skill {
    constructor() {
        super({
            id: 'c6',
            name: '假途伐虢',
            icon: '🛤️',
            cost: 4,
            cooldown: 5,
            category: '混战计',
            description: '选择对方一条三连，在其两端各放一颗己方棋子',
            targetType: SkillTargetType.STONE
        });
    }

    canUse(game, player) {
        if (!super.canUse(game, player)) return false;
        const opponent = game.getOpponent(player);
        // 检查对方是否有三连
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (game.board[r][c] === opponent) {
                    if (game.checkFormLine(r, c, opponent, 3)) return true;
                }
            }
        }
        return false;
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);
        if (!target.stone || target.stone !== opponent) {
            game.showEffect(target.row, target.col, '❌ 请选择对方三连中的棋子');
            return false;
        }

        // 检查是否是三连
        if (!game.checkFormLine(target.row, target.col, opponent, 3)) {
            game.showEffect(target.row, target.col, '❌ 请选择三连中的棋子');
            return false;
        }

        // 找到三连的两端并放置己方棋子
        const dirs = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [-1,-1], [1,-1], [-1,1]];
        let placed = 0;

        for (let [dr, dc] of dirs) {
            // 找一端
            let r = target.row, c = target.col;
            while (r >= 0 && r < 15 && c >= 0 && c < 15 && game.board[r][c] === opponent) {
                r += dr;
                c += dc;
            }
            if (r >= 0 && r < 15 && c >= 0 && c < 15 && game.board[r][c] === null) {
                game.board[r][c] = player;
                placed++;
                game.showEffect(r, c, '🛤️ 己方棋子!');
            }

            // 找另一端
            r = target.row;
            c = target.col;
            while (r >= 0 && r < 15 && c >= 0 && c < 15 && game.board[r][c] === opponent) {
                r -= dr;
                c -= dc;
            }
            if (r >= 0 && r < 15 && c >= 0 && c < 15 && game.board[r][c] === null) {
                game.board[r][c] = player;
                placed++;
                game.showEffect(r, c, '🛤️ 己方棋子!');
            }

            if (placed > 0) break;
        }

        game.renderBoard();
        return true;
    }
}

// ==================== 并战计 ====================

// 25. 偷梁换柱：交换两颗不同颜色棋子的位置
class Skill_TouliangHuanzhu extends Skill {
    constructor() {
        super({
            id: 'm1',
            name: '偷梁换柱',
            icon: '🔄',
            cost: 4,
            cooldown: 5,
            category: '并战计',
            description: '交换一颗己方和一颗对方棋子的位置',
            targetType: SkillTargetType.STONE
        });
    }

    use(game, target, player) {
        if (!target.stone) {
            game.showEffect(target.row, target.col, '❌ 请选择棋子');
            return false;
        }

        const opponent = game.getOpponent(player);
        const firstStone = target.stone;
        const needSecond = firstStone === player ? opponent : player;

        game.pendingSkillEffect = {
            skill: this,
            player: player,
            type: 'm1_second',
            firstSelection: { row: target.row, col: target.col, stone: firstStone },
            needSecond: needSecond
        };

        game.showEffect(target.row, target.col, `🔄 请选择${needSecond === player ? '己方' : '对方'}棋子`);
        return true;
    }
}

// 26. 指桑骂槐：标记对方一颗棋子，对方下回合必须移除它
class Skill_ZhisangMahuai extends Skill {
    constructor() {
        super({
            id: 'm2',
            name: '指桑骂槐',
            icon: '👆',
            cost: 2,
            cooldown: 3,
            category: '并战计',
            description: '标记对方棋子，对方下回合必须移除它',
            targetType: SkillTargetType.STONE
        });
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);
        if (!target.stone || target.stone !== opponent) {
            game.showEffect(target.row, target.col, '❌ 请选择对方棋子');
            return false;
        }

        game.markedForRemoval = {
            row: target.row,
            col: target.col,
            player: opponent,
            turns: 1
        };

        game.showEffect(target.row, target.col, '👆 被标记!');
        game.renderBoard();
        return true;
    }
}

// 27. 假痴不癫：本回合落子后获得2点能量
class Skill_Jiachibudian extends Skill {
    constructor() {
        super({
            id: 'm3',
            name: '假痴不癫',
            icon: '🎭',
            cost: 1,
            cooldown: 2,
            category: '并战计',
            description: '落子后额外获得2点能量',
            targetType: SkillTargetType.CELL
        });
    }

    use(game, target, player) {
        if (!game.canPlaceStone(target.row, target.col)) {
            game.showEffect(target.row, target.col, '❌ 无效位置');
            return false;
        }

        game.board[target.row][target.col] = player;
        game.addEnergy(player, 2);
        game.moveHistory.push({ row: target.row, col: target.col, player });

        game.showEffect(target.row, target.col, '🎭 落子! +2能量');
        game.renderBoard();

        if (game.checkWin(target.row, target.col)) {
            game.gameOver = true;
            game.showWinModal();
        } else {
            game.switchPlayer();
        }

        return true;
    }
}

// 28. 上屋抽梯：双方各获得2点能量，但下回合不能使用技能
class Skill_ShangwuChouti extends Skill {
    constructor() {
        super({
            id: 'm4',
            name: '上屋抽梯',
            icon: '🪜',
            cost: 2,
            cooldown: 4,
            category: '并战计',
            description: '双方各+2能量，但下回合不能使用技能',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);
        game.addEnergy(player, 2);
        game.addEnergy(opponent, 2);

        game.skillSeal = {
            turns: 1,
            creator: null,
            bothPlayers: true
        };

        game.showEffect(7, 7, '🪜 能量+2，下回合禁用技能!');
        return true;
    }
}

// 29. 树上开花：在空位放置两颗虚拟棋子（1回合后消失）
class Skill_ShushangKaihua extends Skill {
    constructor() {
        super({
            id: 'm5',
            name: '树上开花',
            icon: '🌸',
            cost: 3,
            cooldown: 4,
            category: '并战计',
            description: '放置2颗虚拟棋子（1回合后消失）',
            targetType: SkillTargetType.CELL
        });
    }

    use(game, target, player) {
        if (!game.canPlaceStone(target.row, target.col)) {
            game.showEffect(target.row, target.col, '❌ 无效位置');
            return false;
        }

        // 放置第一颗虚拟棋子
        game.board[target.row][target.col] = player;
        game.virtualStones = game.virtualStones || [];
        game.virtualStones.push({
            row: target.row,
            col: target.col,
            player: player,
            turns: 1
        });

        // 寻找相邻空位放第二颗
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
        let placed = false;
        for (let [dr, dc] of dirs) {
            const nr = target.row + dr;
            const nc = target.col + dc;
            if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 &&
                game.board[nr][nc] === null && game.canPlaceStone(nr, nc)) {
                game.board[nr][nc] = player;
                game.virtualStones.push({
                    row: nr,
                    col: nc,
                    player: player,
                    turns: 1
                });
                placed = true;
                break;
            }
        }

        game.showEffect(target.row, target.col, '🌸 虚拟棋子!');
        game.renderBoard();
        return true;
    }
}

// 30. 反客为主：获得对方下回合的控制权
class Skill_FankehrWeizhu extends Skill {
    constructor() {
        super({
            id: 'm6',
            name: '反客为主',
            icon: '🔄',
            cost: 6,
            cooldown: 7,
            category: '并战计',
            description: '下回合由你代替对方落子',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);
        game.controlOverride = {
            controller: player,
            originalPlayer: opponent,
            turns: 1
        };

        game.showEffect(7, 7, '🔄 控制权已夺取!');
        return true;
    }
}

// ==================== 败战计 ====================

// 31. 美人计：让出本回合，对方下回合能量消耗+1
class Skill_Meirenji extends Skill {
    constructor() {
        super({
            id: 'd1',
            name: '美人计',
            icon: '💃',
            cost: 3,
            cooldown: 4,
            category: '败战计',
            description: '让出回合，对方下回合技能消耗+1',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);
        game.extraCost = {
            player: opponent,
            amount: 1,
            turns: 1
        };

        game.showEffect(7, 7, '💃 让出回合，对方消耗+1!');
        game.switchPlayer();
        return true;
    }
}

// 32. 空城计：在3x3区域设置空城，双方都不能落子
class Skill_Kongchengji extends Skill {
    constructor() {
        super({
            id: 'd2',
            name: '空城计',
            icon: '🏰',
            cost: 2,
            cooldown: 3,
            category: '败战计',
            description: '设置3x3空城区，持续2回合',
            targetType: SkillTargetType.CELL,
            range: 1
        });
    }

    use(game, target, player) {
        const area = this.getArea(target.row, target.col);

        game.emptyCity = {
            area: area,
            turns: 2,
            creator: player
        };

        game.showEffect(target.row, target.col, '🏰 空城计!');
        game.renderBoard();
        return true;
    }
}

// 33. 反间计：查看并禁用对方一个技能
class Skill_Fanjianji extends Skill {
    constructor() {
        super({
            id: 'd3',
            name: '反间计',
            icon: '🕵️',
            cost: 4,
            cooldown: 5,
            category: '败战计',
            description: '随机禁用对方一个技能，持续3回合',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        const opponent = game.getOpponent(player);

        // 随机选择一个技能禁用
        const skillIds = ['s1', 's2', 's3', 's4', 's5', 's6', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'];
        const randomId = skillIds[Math.floor(Math.random() * skillIds.length)];

        game.disabledSkills = game.disabledSkills || {};
        game.disabledSkills[randomId] = {
            turns: 3,
            forPlayer: opponent
        };

        game.showEffect(7, 7, `🕵️ 禁用技能: ${randomId}!`);
        return true;
    }
}

// 34. 苦肉计：失去3点能量，获得额外行动机会
class Skill_Kurouji extends Skill {
    constructor() {
        super({
            id: 'd4',
            name: '苦肉计',
            icon: '🩸',
            cost: 0,
            cooldown: 3,
            category: '败战计',
            description: '消耗3点能量，获得额外行动机会',
            targetType: SkillTargetType.NONE
        });
    }

    canUse(game, player) {
        const energy = game.getPlayerEnergy(player);
        return energy >= 3;
    }

    use(game, target, player) {
        game.consumeEnergy(player, 3);
        game.extraTurn = {
            player: player,
            count: 1
        };

        game.showEffect(7, 7, '🩸 苦肉计! 额外行动!');
        return true;
    }
}

// 35. 连环计：连续使用两个技能（能量分别计算）
class Skill_Lianhuanji extends Skill {
    constructor() {
        super({
            id: 'd5',
            name: '连环计',
            icon: '⛓️',
            cost: 7,
            cooldown: 8,
            category: '败战计',
            description: '本回合可以使用两个技能',
            targetType: SkillTargetType.NONE
        });
    }

    use(game, target, player) {
        game.doubleSkill = {
            player: player,
            count: 1
        };

        game.showEffect(7, 7, '⛓️ 可再使用一个技能!');
        return true;
    }
}

// 36. 走为上策：将局面恢复到5回合前的状态
class Skill_Zouweishangce extends Skill {
    constructor() {
        super({
            id: 'd6',
            name: '走为上策',
            icon: '🏃',
            cost: 8,
            cooldown: 9,
            category: '败战计',
            description: '将局面回溯到5回合前',
            targetType: SkillTargetType.NONE
        });
    }

    canUse(game, player) {
        if (!super.canUse(game, player)) return false;
        return game.moveHistory.length >= 10; // 至少5个回合
    }

    use(game, target, player) {
        const history = game.moveHistory;
        const keepLength = Math.max(0, history.length - 10);

        // 清空棋盘
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                game.board[r][c] = null;
            }
        }

        // 重新放置保留的棋子
        game.moveHistory = [];
        for (let i = 0; i < keepLength; i++) {
            const move = history[i];
            game.board[move.row][move.col] = move.player;
            game.moveHistory.push(move);
        }

        // 重置当前玩家
        const lastPlayer = keepLength > 0 ?
            game.moveHistory[keepLength - 1].player :
            'white';
        game.currentPlayer = lastPlayer === 'black' ? 'white' : 'black';

        game.showEffect(7, 7, '🏃 局面已回溯!');
        game.renderBoard();
        return true;
    }
}

// ==================== 导出所有技能 ====================
const ALL_SKILLS = [
    // 胜战计
    Skill_MantianGuohai,   // s1
    Skill_WeiweiJiuZhao,   // s2
    Skill_JiedaoShare,      // s3
    Skill_YiyiDailao,       // s4
    Skill_ChenhuoDajie,     // s5
    Skill_ShengdongJixi,    // s6
    // 敌战计
    Skill_WuzhongShengyou,  // e1
    Skill_AnduChencang,     // e2
    Skill_GeAnGuanhuo,      // e3
    Skill_XiaoliCangdao,    // e4
    Skill_LidaiTaojiang,    // e5
    Skill_ShunshouQianyang, // e6
    // 攻战计
    Skill_DacaoJingshe,     // a1
    Skill_JieshiHuanhun,    // a2
    Skill_DiaohuliLishan,   // a3
    Skill_YuqingGuzong,     // a4
    Skill_PaozhuanYinyu,    // a5
    Skill_QinzeiQinwang,    // a6
    // 混战计
    Skill_FudiChouxin,      // c1
    Skill_HunshuiMoyu,      // c2
    Skill_JinchanTuqiao,    // c3
    Skill_GuanmenZhuozei,   // c4
    Skill_YuanjiaoJingong,  // c5
    Skill_Jiatufage,        // c6
    // 并战计
    Skill_TouliangHuanzhu,  // m1
    Skill_ZhisangMahuai,    // m2
    Skill_Jiachibudian,     // m3
    Skill_ShangwuChouti,    // m4
    Skill_ShushangKaihua,   // m5
    Skill_FankehrWeizhu,    // m6
    // 败战计
    Skill_Meirenji,         // d1
    Skill_Kongchengji,      // d2
    Skill_Fanjianji,        // d3
    Skill_Kurouji,          // d4
    Skill_Lianhuanji,       // d5
    Skill_Zouweishangce     // d6
];
