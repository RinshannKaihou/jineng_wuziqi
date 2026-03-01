/**
 * 技能模板文件
 * 
 * 使用说明：
 * 1. 复制以下技能模板
 * 2. 在 gomoku.html 的 "// ==================== 三十六计技能 ====================" 区域粘贴
 * 3. 在 SkillManager.registerAllSkills() 中添加注册
 * 
 * 注册方法：this.skillManager.register(YourSkillClass);
 */

// ==================== 技能模板 ====================

// 模板1：简单效果技能（不执行落子）
class Template_SimpleEffect extends Skill {
    constructor() {
        super({
            id: 'template1',           // 唯一标识符
            name: '技能名称',          // 显示名称
            icon: '🔥',               // 表情图标
            cost: 3,                  // 能量消耗 1-8
            cooldown: 3,              // 冷却回合 1-9
            category: '胜战计',        // 分类：胜战计/敌战计/攻战计/混战计/并战计/败战计
            description: '技能描述',   // 游戏中显示的描述
            targetType: SkillTargetType.NONE  // 目标类型：none/cell/stone
        });
    }
    
    // use方法：实现技能效果
    // game: 游戏实例，包含board/moveHistory/playerEnergy等
    // target: { row, col, stone } 目标格子信息
    // player: 'black' 或 'white' 当前玩家
    use(game, target, player) {
        // ===== 技能逻辑 =====
        
        // 示例：增加能量
        game.addEnergy(player, 2);
        
        // 示例：显示特效
        game.showEffect(7, 7, '🔥 技能发动!');
        
        // ===== 返回值 =====
        return true;  // 技能成功，消耗能量和CD
        // 或 return false; // 技能失败，不消耗
        
        // 注意：此类型技能不执行落子，不需要调用 game.switchPlayer()
    }
}

// 模板2：包含落子的技能
class Template_WithPlacement extends Skill {
    constructor() {
        super({
            id: 'template2',
            name: '落子技能',
            icon: '⚡',
            cost: 3,
            cooldown: 3,
            category: '攻战计',
            description: '在目标位置执行特殊落子',
            targetType: SkillTargetType.CELL  // 需要选择格子
        });
    }
    
    use(game, target, player) {
        // 检查能否落子
        if (!game.canPlaceStone(target.row, target.col)) {
            game.showEffect(target.row, target.col, '❌ 无法落子');
            return false;
        }
        
        // ===== 执行落子 =====
        game.board[target.row][target.col] = player;
        game.moveHistory.push({ 
            row: target.row, 
            col: target.col, 
            player: player 
        });
        
        // ===== 额外效果 =====
        // 例如：移除周围敌方棋子
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
        let removed = 0;
        for (let [dr, dc] of dirs) {
            const nr = target.row + dr, nc = target.col + dc;
            if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15) {
                const stone = game.board[nr][nc];
                if (stone && stone !== player) {
                    game.board[nr][nc] = null;
                    removed++;
                }
            }
        }
        
        // 显示效果
        game.showEffect(target.row, target.col, 
            removed > 0 ? `⚡ 落子并移除${removed}子!` : '⚡ 落子!'
        );
        
        // 更新棋盘显示
        game.renderBoard();
        
        // ===== 检查胜利 =====
        if (game.checkWin(target.row, target.col)) {
            game.gameOver = true;
            game.showWinModal();
            return true;
        }
        
        // ===== 手动切换回合 =====
        // 此类型技能包含落子，需要手动调用 switchPlayer
        game.switchPlayer();
        return true;
    }
}

// 模板3：两步选择技能
class Template_TwoStep extends Skill {
    constructor() {
        super({
            id: 'template3',
            name: '两步技能',
            icon: '🎯',
            cost: 4,
            cooldown: 4,
            category: '混战计',
            description: '选择两个位置进行某种操作',
            targetType: SkillTargetType.STONE  // 第一步：选择棋子
        });
    }
    
    use(game, target, player) {
        // 验证第一步选择
        if (!target.stone) {
            game.showEffect(target.row, target.col, '❌ 请选择棋子');
            return false;
        }
        
        // 设置pending状态，等待第二次选择
        game.pendingSkillEffect = {
            skill: this,
            player: player,
            type: 'templateSecondStep',  // 唯一标识此技能的第二步
            firstSelection: {            // 保存第一次选择
                row: target.row, 
                col: target.col,
                stone: target.stone
            }
        };
        
        game.showEffect(target.row, target.col, '🎯 请选择第二个目标');
        return true;  // 第一步成功，进入等待状态
    }
}

// ===== 在 game.handlePendingEffect 中添加处理 =====
/*
在 gomoku.html 中找到 handlePendingEffect 方法，
在 else if 链中添加：

else if (effect.type === 'templateSecondStep') {
    // 验证第二次选择
    const secondStone = game.board[row][col];
    if (!secondStone) {
        game.showEffect(7, 7, '❌ 请选择一个棋子');
        return;
    }
    
    const first = effect.firstSelection;
    
    // ===== 执行技能效果 =====
    // 例如：交换两颗棋子的位置
    const temp = game.board[first.row][first.col];
    game.board[first.row][first.col] = secondStone;
    game.board[row][col] = temp;
    
    game.showEffect(row, col, '🎯 交换完成!');
    game.renderBoard();
    
    // 清除pending状态
    game.pendingSkillEffect = null;
    
    // 切换回合
    game.switchPlayer();
}
*/

// 模板4：条件判断技能
class Template_Conditional extends Skill {
    constructor() {
        super({
            id: 'template4',
            name: '条件技能',
            icon: '💫',
            cost: 3,
            cooldown: 3,
            category: '敌战计',
            description: '根据场上情况产生不同效果',
            targetType: SkillTargetType.NONE
        });
    }
    
    // 可选：自定义可用性检查
    canUse(game, player) {
        // 先检查基础条件（能量、CD）
        if (!super.canUse(game, player)) return false;
        
        // 添加自定义条件
        // 例如：必须有一定数量的棋子
        const hasEnoughStones = game.moveHistory.filter(m => m.player === player).length >= 3;
        
        return hasEnoughStones;
    }
    
    use(game, target, player) {
        const opponent = game.getOpponent(player);
        
        // ===== 条件判断 =====
        const myStones = game.moveHistory.filter(m => m.player === player).length;
        const oppStones = game.moveHistory.filter(m => m.player === opponent).length;
        
        if (myStones > oppStones) {
            // 条件A：棋子多时的效果
            game.addEnergy(player, 2);
            game.showEffect(7, 7, '💫 优势局面! +2能量');
        } else if (myStones < oppStones) {
            // 条件B：棋子少时的效果
            game.showEffect(7, 7, '💫 劣势局面! 本回合免费');
            // 返还能量
            game.addEnergy(player, this.cost);
        } else {
            // 条件C：平局时的效果
            game.showEffect(7, 7, '💫 均势! 双方各+1能量');
            game.addEnergy(player, 1);
            game.addEnergy(opponent, 1);
        }
        
        return true;
    }
}

// 模板5：范围效果技能
class Template_AreaEffect extends Skill {
    constructor() {
        super({
            id: 'template5',
            name: '范围技能',
            icon: '💥',
            cost: 4,
            cooldown: 4,
            category: '混战计',
            description: '对目标周围3x3区域产生影响',
            targetType: SkillTargetType.CELL,
            range: 1  // 影响半径：1表示3x3区域
        });
    }
    
    use(game, target, player) {
        // 获取影响范围（自动处理边界）
        const area = this.getArea(target.row, target.col);
        
        let affected = 0;
        
        // 遍历区域内的格子
        area.forEach(({row, col}) => {
            const stone = game.board[row][col];
            
            // 跳过中心点（可选）
            if (row === target.row && col === target.col) return;
            
            // 效果：移除对方棋子
            if (stone && stone !== player) {
                game.board[row][col] = null;
                affected++;
            }
        });
        
        game.showEffect(target.row, target.col, 
            affected > 0 ? `💥 清除${affected}颗棋子!` : '💥 范围内无目标'
        );
        
        game.renderBoard();
        return true;
    }
}

// ==================== 注册技能 ====================

/*
在 GomokuGame.registerAllSkills() 方法中添加：

this.skillManager.register(Template_SimpleEffect);
this.skillManager.register(Template_WithPlacement);
this.skillManager.register(Template_TwoStep);
this.skillManager.register(Template_Conditional);
this.skillManager.register(Template_AreaEffect);

这样就完成了技能的添加！
*/

// ==================== 常用代码片段 ====================

// 1. 获取对手
// const opponent = game.getOpponent(player);

// 2. 检查格子是否为空
// if (!game.board[row][col]) { /* 格子为空 */ }

// 3. 遍历所有方向
// const dirs = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [-1,-1], [1,-1], [-1,1]];

// 4. 计算曼哈顿距离
// const dist = Math.abs(r1 - r2) + Math.abs(c1 - c2);

// 5. 检查是否形成指定长度的连线
// const formed = game.checkFormLine(row, col, player, 3); // 检查是否形成3连

// 6. 查找玩家的所有连线
// const lines = game.findLines(player, 3); // 找所有3连线

// 7. 随机选择空位
/*
const empty = [];
for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
        if (!game.board[r][c]) empty.push({r, c});
    }
}
const random = empty[Math.floor(Math.random() * empty.length)];
*/

// 8. 延迟执行
/*
setTimeout(() => {
    game.showEffect(row, col, '延迟效果!');
}, 1000);
*/
