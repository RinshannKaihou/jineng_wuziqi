// ==================== 三十六计技能 ====================
//
// 每个技能是一个普通对象：
//   id / name / icon / cost / cooldown / category / description
//   target            目标类型（见 Target）
//   canUse(g, p)      可选，额外的使用条件
//   use(g, p, t)      生效；返回 true 表示成功。失败时用 `return g.fail('原因')`
//   pendingTargets()  可选，二段选择的可选格子（高亮显示）
//   resolve(...)      可选，二段选择的处理
//
// 规则约定：
//   - 技能只改状态，不负责切换回合；"落子"类技能调用 g.placeMove()，"跳过回合"调用 g.skipMove()
//   - use() 返回 false 时，游戏会把状态整体回滚，所以不必担心半途失败
//   - 二段选择进行中可以取消（Esc / 右键），能量与冷却会一并返还
//
// 新增技能：在 SKILLS 数组里按分类追加一个对象即可。

const Target = {
    NONE: 'none',     // 点击技能即生效
    OWN: 'own',       // 己方棋子
    ENEMY: 'enemy',   // 对方棋子
    EMPTY: 'empty',   // 可落子的空位
    ANY: 'any',       // 任意格子
};

const TARGET_HINTS = {
    [Target.OWN]: '请选择己方棋子',
    [Target.ENEMY]: '请选择对方棋子',
    [Target.EMPTY]: '请选择空位',
    [Target.ANY]: '请选择一个格子',
};

const SKILL_CATEGORIES = ['胜战计', '敌战计', '攻战计', '混战计', '并战计', '败战计'];

/** 上下左右相邻的空位 */
function emptyOrthogonal(g, cell) {
    return neighborCells(cell.row, cell.col, NEIGHBORS_4).filter(p => g.isEmpty(p.row, p.col));
}

/** 对方四连（恰好四颗连续）中可被移除的棋子 */
function removableFourStones(g, owner, byPlayer) {
    return g.runs(owner, 4)
        .flatMap(run => run.cells)
        .filter(p => !g.isProtected(p.row, p.col, byPlayer));
}

/** 某方参与连线最长的一颗棋子（并列取扫描顺序第一颗） */
function strongestStone(g, owner, byPlayer) {
    let best = null, bestRun = -1;
    for (const p of g.stonesOf(owner)) {
        if (byPlayer && g.isProtected(p.row, p.col, byPlayer)) continue;
        const run = g.maxRun(p.row, p.col);
        if (run > bestRun) { bestRun = run; best = p; }
    }
    return best;
}

const SKILLS = [
    // ==================== 胜战计 ====================
    {
        id: 's1', name: '瞒天过海', icon: '🌊', cost: 2, cooldown: 3, category: '胜战计',
        description: '移除己方一颗棋子，在任意空位重新落子',
        target: Target.OWN,
        use(g, p, t) {
            g.removeStone(t.row, t.col);
            g.effect(t, '🌊 移除!');
            g.setPending(this, { prompt: '瞒天过海：请选择新位置落子' });
            return true;
        },
        pendingTargets: g => g.emptyCells(),
        resolve(g, p, pending, t) {
            g.putStone(t.row, t.col, p);
            g.effect(t, '🌊 重新落子!');
            return true;
        },
    },
    {
        id: 's2', name: '围魏救赵', icon: '🎯', cost: 3, cooldown: 4, category: '胜战计',
        description: '标记对方一条三连线，强制其下回合必须在该线两端防守',
        target: Target.NONE,
        use(g, p) {
            const ends = g.runs(opponentOf(p), 3).flatMap(run => run.ends);
            if (ends.length === 0) return g.fail('对方没有可标记的三连');
            g.restrict(opponentOf(p), ends, '围魏救赵');
            g.effect(null, '🎯 围魏救赵! 对方必须防守');
            return true;
        },
    },
    {
        id: 's3', name: '借刀杀人', icon: '🔪', cost: 4, cooldown: 5, category: '胜战计',
        description: '选择对方一颗棋子，与己方一颗棋子交换位置',
        target: Target.ENEMY,
        canUse: g => g.moveCount() >= 2,
        use(g, p, t) {
            if (g.isProtected(t.row, t.col, p)) return g.fail('该棋子受苦肉计保护');
            g.effect(t, '🔪 选择己方棋子交换');
            g.setPending(this, { prompt: '借刀杀人：请选择要交换的己方棋子', from: t });
            return true;
        },
        pendingTargets: (g, p) => g.stonesOf(p),
        resolve(g, p, pending, t) {
            g.swapStones(pending.from, t);
            g.effect(pending.from, '🔪 借刀杀人!');
            g.effect(t, '🔪 交换!');
            return true;
        },
    },
    {
        id: 's4', name: '以逸待劳', icon: '☯️', cost: 1, cooldown: 2, category: '胜战计',
        description: '跳过本回合，获得3点额外能量',
        target: Target.NONE,
        use(g, p) {
            g.addEnergy(p, 3);
            g.skipMove();
            g.effect(null, '☯️ 以逸待劳! +3能量，跳过回合');
            return true;
        },
    },
    {
        id: 's5', name: '趁火打劫', icon: '🔥', cost: 3, cooldown: 4, category: '胜战计',
        description: '从对方的四连中删除一个棋子',
        target: Target.NONE,
        use(g, p) {
            const stones = removableFourStones(g, opponentOf(p), p);
            if (stones.length === 0) return g.fail('对方无四连可破');
            const victim = stones[Math.floor(g.random() * stones.length)];
            g.removeStone(victim.row, victim.col);
            g.effect(victim, '🔥 趁火打劫! 破坏四连');
            return true;
        },
    },
    {
        id: 's6', name: '声东击西', icon: '🎭', cost: 2, cooldown: 3, category: '胜战计',
        description: '本回合落两颗虚像子，下一自己回合开始时随机消失一颗、另一颗转为真子（本回合无法获胜）',
        target: Target.NONE,
        use(g) {
            g.turn.soundEast = true;
            g.turn.cannotWin = true;
            g.addPlacements(1);
            g.effect(null, '🎭 声东击西! 请落两颗虚像子');
            return true;
        },
    },

    // ==================== 敌战计 ====================
    {
        id: 'e1', name: '无中生有', icon: '✨', cost: 5, cooldown: 6, category: '敌战计',
        description: '在空白区域放置一颗"幻想子"（3回合后消失，计入连珠）',
        target: Target.EMPTY,
        use(g, p, t) {
            g.addPhantom(t.row, t.col, p, 3);
            g.effect(t, '✨ 无中生有!');
            return true;
        },
    },
    {
        id: 'e2', name: '暗度陈仓', icon: '🌑', cost: 3, cooldown: 4, category: '敌战计',
        description: '将己方一颗棋子显示为对方的颜色（实际仍按己方计算），持续3回合',
        target: Target.OWN,
        use(g, p, t) {
            g.disguise(t.row, t.col, 3);
            g.effect(t, '🌑 暗度陈仓! 已伪装');
            return true;
        },
    },
    {
        id: 'e3', name: '隔岸观火', icon: '🔥', cost: 2, cooldown: 3, category: '敌战计',
        description: '封印对手下一回合的技能使用权',
        target: Target.NONE,
        use(g, p) {
            g.sealSkills(opponentOf(p), '隔岸观火');
            g.effect(null, '🔥 隔岸观火! 封印技能');
            return true;
        },
    },
    {
        id: 'e4', name: '笑里藏刀', icon: '😊', cost: 4, cooldown: 5, category: '敌战计',
        description: '在目标位置落子，并将相邻的一颗对方棋子转化为己方',
        target: Target.EMPTY,
        use(g, p, t) {
            if (!g.placeMove(t.row, t.col)) return false;
            const victim = neighborCells(t.row, t.col).find(n =>
                g.stoneAt(n.row, n.col) === opponentOf(p) && !g.isProtected(n.row, n.col, p));
            if (victim) g.setOwner(victim.row, victim.col, p);
            g.effect(t, victim ? '😊 笑里藏刀!' : '😊 落子');
            return true;
        },
    },
    {
        id: 'e5', name: '李代桃僵', icon: '🍑', cost: 3, cooldown: 4, category: '敌战计',
        description: '牺牲己方一颗棋子，然后选择对方四连中的一颗棋子删除',
        target: Target.OWN,
        canUse: (g, p) => g.runs(opponentOf(p), 4).length > 0,
        use(g, p, t) {
            g.removeStone(t.row, t.col);
            g.effect(t, '🍑 牺牲!');
            g.setPending(this, { prompt: '李代桃僵：请选择对方四连中的一颗棋子删除' });
            return true;
        },
        pendingTargets: (g, p) => removableFourStones(g, opponentOf(p), p),
        resolve(g, p, pending, t) {
            g.removeStone(t.row, t.col);
            g.effect(t, '🍑 删除四连棋子!');
            return true;
        },
    },
    {
        id: 'e6', name: '顺手牵羊', icon: '🐑', cost: 2, cooldown: 2, category: '敌战计',
        description: '将对方一颗棋子向上下左右任一方向推移一格',
        target: Target.ENEMY,
        use(g, p, t) {
            g.effect(t, '🐑 选择推移方向');
            g.setPending(this, { prompt: '顺手牵羊：请选择推移方向', from: t });
            return true;
        },
        pendingTargets: (g, p, pending) => emptyOrthogonal(g, pending.from),
        resolve(g, p, pending, t) {
            g.moveStone(pending.from, t);
            g.effect(t, '🐑 顺手牵羊!');
            return true;
        },
    },

    // ==================== 攻战计 ====================
    {
        id: 'a1', name: '打草惊蛇', icon: '🐍', cost: 1, cooldown: 1, category: '攻战计',
        description: '额外获得3点能量，但下回合无法使用技能',
        target: Target.NONE,
        use(g, p) {
            g.addEnergy(p, 3);
            g.sealSkills(p, '打草惊蛇');
            g.effect(null, '🐍 打草惊蛇! +3能量，但下回合封技能');
            return true;
        },
    },
    {
        id: 'a2', name: '借尸还魂', icon: '👻', cost: 4, cooldown: 5, category: '攻战计',
        description: '复制对方上一次使用的技能效果（不消耗该技能的能量和冷却）',
        target: Target.NONE,
        canUse(g, p) {
            const borrowed = SKILL_MAP.get(g.lastSkillOf(opponentOf(p)));
            return Boolean(borrowed) && borrowed.id !== this.id && (!borrowed.canUse || borrowed.canUse(g, p));
        },
        use(g, p) {
            const borrowed = SKILL_MAP.get(g.lastSkillOf(opponentOf(p)));
            g.effect(null, `👻 借尸还魂! 复制:${borrowed.name}`);
            if (borrowed.target === Target.NONE) return borrowed.use(g, p, null);
            g.setPending(this, {
                prompt: `借尸还魂 · ${borrowed.name}：${TARGET_HINTS[borrowed.target]}`,
                borrowed: borrowed.id,
            });
            return true;
        },
        pendingTargets: (g, p, pending) => g.targetCells(SKILL_MAP.get(pending.borrowed).target, p),
        resolve: (g, p, pending, t) => SKILL_MAP.get(pending.borrowed).use(g, p, t),
    },
    {
        id: 'a3', name: '调虎离山', icon: '🐯', cost: 5, cooldown: 4, category: '攻战计',
        description: '将对手的一颗棋子挪到离当前棋型最远的空位',
        target: Target.ENEMY,
        use(g, p, t) {
            const others = [...g.stonesOf('black'), ...g.stonesOf('white')].filter(s => !sameCell(s, t));
            const far = g.farthestEmptyFrom(others.length ? others : [t]);
            if (!far) return g.fail('无空位可移动');
            g.moveStone(t, far);
            g.effect(t, '🐯 调虎离山!');
            g.effect(far, '🐯 挪至远位');
            return true;
        },
    },
    {
        id: 'a4', name: '欲擒故纵', icon: '🎣', cost: 2, cooldown: 3, category: '攻战计',
        description: '放弃本回合，对手下回合必须落在你指定的3×3区域中的3个位置之一',
        target: Target.EMPTY,
        use(g, p, t) {
            const free = squareArea(t.row, t.col).filter(c => g.isEmpty(c.row, c.col));
            if (free.length < 3) return g.fail('空位不足');
            g.restrict(opponentOf(p), free.slice(0, 3), '欲擒故纵');
            g.skipMove();
            g.effect(t, '🎣 欲擒故纵!');
            return true;
        },
    },
    {
        id: 'a5', name: '抛砖引玉', icon: '🧱', cost: 2, cooldown: 3, category: '攻战计',
        description: '在目标位置落子，对手下回合必须在这颗棋子旁边落子',
        target: Target.EMPTY,
        use(g, p, t) {
            if (!g.placeMove(t.row, t.col)) return false;
            const around = neighborCells(t.row, t.col).filter(c => g.isEmpty(c.row, c.col));
            if (around.length === 0) {
                g.effect(t, '🧱 落子（旁边无空位，强制效果无效）');
            } else {
                g.restrict(opponentOf(p), around, '抛砖引玉');
                g.effect(t, '🧱 抛砖引玉! 对手必须在旁边落子');
            }
            return true;
        },
    },
    {
        id: 'a6', name: '擒贼擒王', icon: '👑', cost: 6, cooldown: 7, category: '攻战计',
        description: '移除对方棋盘上最关键的一颗子（参与连线最多的子）',
        target: Target.NONE,
        use(g, p) {
            let key = null, best = 0;
            for (const s of g.stonesOf(opponentOf(p))) {
                if (g.isProtected(s.row, s.col, p)) continue;
                const score = g.connections(s.row, s.col);
                if (score > best) { best = score; key = s; }
            }
            if (!key) return g.fail('无关键子可擒');
            g.removeStone(key.row, key.col);
            g.effect(key, '👑 擒贼擒王!');
            return true;
        },
    },

    // ==================== 混战计 ====================
    {
        id: 'c1', name: '釜底抽薪', icon: '🍲', cost: 4, cooldown: 5, category: '混战计',
        description: '移除对方一颗没有参与任何连线的棋子，本回合无法获胜',
        target: Target.ENEMY,
        use(g, p, t) {
            if (g.isProtected(t.row, t.col, p)) return g.fail('该棋子受苦肉计保护');
            if (g.maxRun(t.row, t.col) > 1) return g.fail('只能移除孤立子');
            g.removeStone(t.row, t.col);
            g.turn.cannotWin = true;
            g.effect(t, '🍲 釜底抽薪!');
            return true;
        },
    },
    {
        id: 'c2', name: '浑水摸鱼', icon: '🐟', cost: 3, cooldown: 4, category: '混战计',
        description: '将己方一颗棋子移动到上下左右相邻的空位',
        target: Target.OWN,
        use(g, p, t) {
            g.effect(t, '🐟 选择移动位置');
            g.setPending(this, { prompt: '浑水摸鱼：请选择相邻空位', from: t });
            return true;
        },
        pendingTargets: (g, p, pending) => emptyOrthogonal(g, pending.from),
        resolve(g, p, pending, t) {
            g.moveStone(pending.from, t);
            g.effect(t, '🐟 浑水摸鱼!');
            return true;
        },
    },
    {
        id: 'c3', name: '金蝉脱壳', icon: '🦗', cost: 5, cooldown: 5, category: '混战计',
        description: '将己方一颗棋子移动到棋盘任意空位，但下回合能量-2',
        target: Target.OWN,
        use(g, p, t) {
            g.effect(t, '🦗 选择目标位置');
            g.setPending(this, { prompt: '金蝉脱壳：请选择目标位置', from: t });
            return true;
        },
        pendingTargets: g => g.emptyCells(),
        resolve(g, p, pending, t) {
            g.moveStone(pending.from, t);
            g.addEnergyPenalty(p, 2);
            g.effect(t, '🦗 金蝉脱壳! 下回合-2能量');
            return true;
        },
    },
    {
        id: 'c4', name: '关门捉贼', icon: '🚪', cost: 2, cooldown: 3, category: '混战计',
        description: '指定一个3×3区域，对手下一回合必须在此区域内落子（区域已满则无法使用）',
        target: Target.ANY,
        use(g, p, t) {
            const area = squareArea(t.row, t.col);
            if (!area.some(c => g.isEmpty(c.row, c.col))) return g.fail('区域已满');
            g.restrict(opponentOf(p), area, '关门捉贼');
            g.effect(t, '🚪 关门捉贼!');
            return true;
        },
    },
    {
        id: 'c5', name: '远交近攻', icon: '🌍', cost: 3, cooldown: 4, category: '混战计',
        description: '在距离己方所有棋子最远的空位落子，然后选择删除对方一颗棋子',
        target: Target.NONE,
        use(g, p) {
            const far = g.farthestEmptyFrom(g.stonesOf(p));
            if (!far || g.stonesOf(p).length === 0) return g.fail('无空位');
            if (!g.stonesOf(opponentOf(p)).some(s => !g.isProtected(s.row, s.col, p))) {
                return g.fail('无对方棋子可删');
            }
            g.putStone(far.row, far.col, p);
            g.effect(far, '🌍 远交近攻! 落子');
            g.setPending(this, { prompt: '远交近攻：请选择要删除的对方棋子' });
            return true;
        },
        pendingTargets: (g, p) => g.stonesOf(opponentOf(p)).filter(s => !g.isProtected(s.row, s.col, p)),
        resolve(g, p, pending, t) {
            g.removeStone(t.row, t.col);
            g.effect(t, '❌ 删除!');
            return true;
        },
    },
    {
        id: 'c6', name: '假途伐虢', icon: '🛤️', cost: 3, cooldown: 4, category: '混战计',
        description: '在对方两颗相邻棋子之间落子，若成功阻断其连线，获得2点能量',
        target: Target.EMPTY,
        use(g, p, t) {
            const op = opponentOf(p);
            const owner = (r, c) => g.stoneAt(r, c);
            const between = NEIGHBORS_8.some(([dr, dc]) =>
                inBounds(t.row + dr, t.col + dc) && inBounds(t.row - dr, t.col - dc) &&
                owner(t.row + dr, t.col + dc) === op && owner(t.row - dr, t.col - dc) === op);
            if (!between) return g.fail('必须在对方相邻两子之间');
            if (!g.placeMove(t.row, t.col)) return false;
            const blocked = LINE_DIRS.some(([dr, dc]) =>
                countDirection(owner, t.row, t.col, dr, dc, op) +
                countDirection(owner, t.row, t.col, -dr, -dc, op) >= 3);
            if (blocked) g.addEnergy(p, 2);
            g.effect(t, blocked ? '🛤️ 假途伐虢! +2能量' : '🛤️ 落子');
            return true;
        },
    },

    // ==================== 并战计 ====================
    {
        id: 'm1', name: '偷梁换柱', icon: '📦', cost: 5, cooldown: 6, category: '并战计',
        description: '将对方一颗参与连线（至少二连）的棋子转化为己方棋子',
        target: Target.ENEMY,
        use(g, p, t) {
            if (g.isProtected(t.row, t.col, p)) return g.fail('该棋子受苦肉计保护');
            if (g.maxRun(t.row, t.col) < 2) return g.fail('必须选择参与连线的棋子');
            g.setOwner(t.row, t.col, p);
            g.effect(t, '📦 偷梁换柱!');
            return true;
        },
    },
    {
        id: 'm2', name: '指桑骂槐', icon: '🌳', cost: 2, cooldown: 3, category: '并战计',
        description: '在目标位置落子，周围8格内的对方棋子在对方下回合无法参与连线判定',
        target: Target.EMPTY,
        use(g, p, t) {
            if (!g.placeMove(t.row, t.col)) return false;
            const weakened = neighborCells(t.row, t.col).filter(n => g.stoneAt(n.row, n.col) === opponentOf(p));
            weakened.forEach(n => g.neutralize(n.row, n.col, 2));
            g.effect(t, `🌳 指桑骂槐! 削弱${weakened.length}颗棋子`);
            return true;
        },
    },
    {
        id: 'm3', name: '假痴不癫', icon: '🤪', cost: 1, cooldown: 2, category: '并战计',
        description: '本回合落子后，若该棋子未参与任何连线，立即获得2点能量',
        target: Target.NONE,
        use(g) {
            g.turn.isolatedBonus = true;
            g.effect(null, '🤪 假痴不癫! 孤子获能量');
            return true;
        },
    },
    {
        id: 'm4', name: '上屋抽梯', icon: '🪜', cost: 3, cooldown: 4, category: '并战计',
        description: '将对方一颗参与三连或四连的棋子移到上下左右相邻的空位，破坏其连线',
        target: Target.ENEMY,
        use(g, p, t) {
            if (g.maxRun(t.row, t.col) < 3) return g.fail('必须选择参与三连或四连的棋子');
            g.effect(t, '🪜 选择移动位置');
            g.setPending(this, { prompt: '上屋抽梯：请选择相邻空位', from: t });
            return true;
        },
        pendingTargets: (g, p, pending) => emptyOrthogonal(g, pending.from),
        resolve(g, p, pending, t) {
            g.moveStone(pending.from, t);
            g.effect(t, '🪜 上屋抽梯! 破坏连线');
            return true;
        },
    },
    {
        id: 'm5', name: '树上开花', icon: '🌸', cost: 4, cooldown: 5, category: '并战计',
        description: '选择己方一颗棋子，在其上下左右的空位各放置1颗临时子，2回合后消失',
        target: Target.OWN,
        use(g, p, t) {
            const spots = emptyOrthogonal(g, t);
            if (spots.length === 0) return g.fail('无可用位置');
            spots.forEach(s => g.addPhantom(s.row, s.col, p, 2));
            g.effect(t, '🌸 树上开花!');
            return true;
        },
    },
    {
        id: 'm6', name: '反客为主', icon: '🎭', cost: 6, cooldown: 7, category: '并战计',
        description: '交换双方场上参与连线最多的各一颗棋子的所有权',
        target: Target.NONE,
        use(g, p) {
            const mine = strongestStone(g, p);
            const theirs = strongestStone(g, opponentOf(p), p);
            if (!mine || !theirs) return g.fail('双方必须都有棋子');
            g.setOwner(mine.row, mine.col, opponentOf(p));
            g.setOwner(theirs.row, theirs.col, p);
            g.effect(mine, '🎭 反客为主!');
            g.effect(theirs, '🔄 交换!');
            return true;
        },
    },

    // ==================== 败战计 ====================
    {
        id: 'd1', name: '美人计', icon: '💃', cost: 5, cooldown: 5, category: '败战计',
        description: '本回合落子后，周围8格内的对方棋子变为中立一回合（不计入连珠）',
        target: Target.NONE,
        use(g) {
            g.turn.beautyTrap = true;
            g.effect(null, '💃 美人计! 下一颗落子将使周围敌方棋子中立');
            return true;
        },
    },
    {
        id: 'd2', name: '空城计', icon: '🏰', cost: 2, cooldown: 3, category: '败战计',
        description: '指定一个3×3区域，直到对方回合结束，双方都不能在此区域内落子',
        target: Target.EMPTY,
        use(g, p, t) {
            g.forbid(squareArea(t.row, t.col), opponentOf(p), '空城计');
            g.effect(t, '🏰 空城计!');
            return true;
        },
    },
    {
        id: 'd3', name: '反间计', icon: '🕵️', cost: 4, cooldown: 5, category: '败战计',
        description: '随机让技能池中另一个可用技能进入2回合冷却',
        target: Target.NONE,
        use(g) {
            const ready = g.state.pool.filter(id => id !== this.id && g.state.cooldowns[id] === 0);
            if (ready.length === 0) return g.fail('无可用技能');
            const victim = SKILL_MAP.get(ready[Math.floor(g.random() * ready.length)]);
            g.state.cooldowns[victim.id] = Math.min(victim.cooldown, 2);
            g.effect(null, `🕵️ 反间计! ${victim.name} CD+2`);
            return true;
        },
    },
    {
        id: 'd4', name: '苦肉计', icon: '💔', cost: 2, cooldown: 2, category: '败战计',
        description: '本回合落下的棋子永久免疫对方的移除、转化、交换效果',
        target: Target.NONE,
        use(g) {
            g.turn.immuneNext = true;
            g.effect(null, '💔 苦肉计! 本子永久免疫');
            return true;
        },
    },
    {
        id: 'd5', name: '连环计', icon: '⛓️', cost: 5, cooldown: 6, category: '败战计',
        description: '本回合可连落2颗棋子，但下回合能量-1',
        target: Target.NONE,
        use(g, p) {
            g.addPlacements(1);
            g.addEnergyPenalty(p, 1);
            g.effect(null, '⛓️ 连环计! 可连落2子');
            return true;
        },
    },
    {
        id: 'd6', name: '走为上策', icon: '🏃', cost: 6, cooldown: 8, category: '败战计',
        description: '将己方一颗棋子移到任意空位，该棋子永久免疫对方的移除、转化、交换效果',
        target: Target.OWN,
        use(g, p, t) {
            g.effect(t, '🏃 选择新位置');
            g.setPending(this, { prompt: '走为上策：请选择新位置', from: t });
            return true;
        },
        pendingTargets: g => g.emptyCells(),
        resolve(g, p, pending, t) {
            g.moveStone(pending.from, t);
            g.markImmune(t.row, t.col);
            g.effect(t, '🏃 走为上策! 移动+免疫');
            return true;
        },
    },
];

const SKILL_MAP = new Map(SKILLS.map(skill => [skill.id, skill]));
