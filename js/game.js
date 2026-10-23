// ==================== 游戏核心：状态、规则、回合流程 ====================
// 不依赖 DOM。界面只读取 state / effects / message 来渲染。
//
// 回合模型：
//   每回合默认需要落子 1 次（turn.placementsLeft）。技能可以增加次数（连环计）或直接清零（以逸待劳）。
//   任何操作完成后都会调用 settle()：先判胜负，再看是否在等二段选择，最后在落子次数用完时结束回合。
//   state 只含可 JSON 序列化的数据，悔棋和技能撤销都基于快照实现。

function freshTurn() {
    return {
        placementsLeft: 1,    // 本回合还需落子次数，用完即结束回合
        sealed: null,         // 技能被封印时记录来源技能名
        cannotWin: false,     // 声东击西 / 釜底抽薪：本回合无法获胜
        soundEast: false,     // 声东击西：本回合落下的是虚像子
        isolatedBonus: false, // 假痴不癫
        beautyTrap: false,    // 美人计
        immuneNext: false,    // 苦肉计
    };
}

function createState(pool, testMode) {
    const startEnergy = testMode ? 999 : 0;
    return {
        board: createEmptyBoard(),
        current: 'black',
        testMode,
        maxEnergy: testMode ? 999 : MAX_ENERGY,
        energy: { black: startEnergy, white: startEnergy },
        pool,
        cooldowns: Object.fromEntries(pool.map(id => [id, 0])),
        moves: [],              // 落子记录 { row, col, player }，用于标记最后一手
        winner: null,
        draw: false,
        turn: freshTurn(),
        pending: null,          // 二段选择中的技能 { skill, player, prompt, ...data }
        phantoms: [],           // 幻想子 / 虚像子 { row, col, player, turns(null=不过期), soundEast }
        neutral: [],            // 中立棋子 { row, col, turns }，不计入连珠
        disguised: [],          // 伪装棋子 { row, col, turns }，仅改变显示颜色
        immune: [],             // 永久免疫对方技能的棋子 'r,c'
        restrictions: [],       // 限定落子区域 { player, cells, label }，到该玩家回合结束失效
        forbidden: [],          // 禁止落子区域 { cells, until, label }，到 until 玩家回合结束失效
        sealNext: { black: null, white: null },   // 下回合技能封印（来源技能名）
        energyPenalty: { black: 0, white: 0 },    // 下回合开始时扣除的能量
        lastSkill: { black: null, white: null },
    };
}

class GomokuGame {
    constructor({ random = Math.random, testMode = false } = {}) {
        this.random = random;
        this.newGame({ testMode });
    }

    // ==================== 对局管理 ====================

    /** 开新局。keepPool=true 时沿用本局技能池（重玩） */
    newGame({ testMode = this.state ? this.state.testMode : false, keepPool = false } = {}) {
        const allIds = SKILLS.map(s => s.id);
        let pool;
        if (testMode) {
            pool = allIds;
        } else if (keepPool && this.state && !this.state.testMode) {
            pool = this.state.pool;
        } else {
            const count = 6 + Math.floor(this.random() * 5); // 6-10 个
            pool = shuffle(allIds, this.random).slice(0, count);
        }
        pool = allIds.filter(id => pool.includes(id)); // 按技能表顺序排列，同类相邻

        this.state = createState(pool, testMode);
        this.history = [];          // 每回合开始时的快照，用于悔棋
        this.turnDirty = false;     // 本回合是否已有操作
        this.armed = null;          // 已选中、等待点击目标的技能 id
        this.pendingRollback = null;// 二段选择开始前的 { snapshot, dirty }，用于取消
        this.effects = [];          // 待播放的飘字 { row, col, text }
        this.message = '';          // 最近一次操作的提示
        this.startTurn('black');
    }

    isOver() {
        return Boolean(this.state.winner || this.state.draw);
    }

    canUndo() {
        return !this.isOver() && (this.turnDirty || this.history.length >= 2);
    }

    /** 取出并清空待播放的飘字 */
    takeEffects() {
        const effects = this.effects;
        this.effects = [];
        return effects;
    }

    snapshot() {
        return JSON.stringify(this.state);
    }

    restore(snapshot) {
        this.state = JSON.parse(snapshot);
    }

    // ==================== 查询 ====================

    stoneAt(row, col) {
        return this.state.board[row][col];
    }

    phantomAt(row, col) {
        return this.state.phantoms.find(p => p.row === row && p.col === col) || null;
    }

    isNeutral(row, col) {
        return this.state.neutral.some(n => n.row === row && n.col === col);
    }

    isDisguised(row, col) {
        return this.state.disguised.some(d => d.row === row && d.col === col);
    }

    isImmune(row, col) {
        return this.state.immune.includes(cellKey(row, col));
    }

    /** 该棋子是否受苦肉计/走为上策保护，不能被 byPlayer 移除、转化、交换 */
    isProtected(row, col, byPlayer) {
        const owner = this.stoneAt(row, col);
        return Boolean(owner) && owner !== byPlayer && this.isImmune(row, col);
    }

    /** 没有真子也没有幻想子 */
    isEmpty(row, col) {
        return !this.stoneAt(row, col) && !this.phantomAt(row, col);
    }

    /** 计入连珠时该格的归属：真子（中立棋子除外）或幻想子 */
    lineOwner(row, col) {
        const stone = this.stoneAt(row, col);
        if (stone) return this.isNeutral(row, col) ? null : stone;
        const phantom = this.phantomAt(row, col);
        return phantom ? phantom.player : null;
    }

    hasFive(player) {
        const owner = (r, c) => this.lineOwner(r, c);
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (owner(r, c) !== player) continue;
                for (const [dr, dc] of LINE_DIRS) {
                    if (1 + countDirection(owner, r, c, dr, dc, player) >= 5) return true;
                }
            }
        }
        return false;
    }

    allCells() {
        const cells = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) cells.push({ row: r, col: c });
        }
        return cells;
    }

    stonesOf(player) {
        return this.allCells().filter(p => this.stoneAt(p.row, p.col) === player);
    }

    emptyCells() {
        return this.allCells().filter(p => this.isEmpty(p.row, p.col));
    }

    moveCount() {
        return this.state.moves.length;
    }

    lastSkillOf(player) {
        return this.state.lastSkill[player];
    }

    /** 该棋子所在最长连续同色线的长度（只看真子） */
    maxRun(row, col) {
        const player = this.stoneAt(row, col);
        if (!player) return 0;
        const owner = (r, c) => this.stoneAt(r, c);
        return Math.max(...LINE_DIRS.map(([dr, dc]) =>
            1 + countDirection(owner, row, col, dr, dc, player) + countDirection(owner, row, col, -dr, -dc, player)));
    }

    /** 四个方向连线长度之和，衡量棋子的"关键程度" */
    connections(row, col) {
        const player = this.stoneAt(row, col);
        if (!player) return 0;
        const owner = (r, c) => this.stoneAt(r, c);
        return LINE_DIRS.reduce((sum, [dr, dc]) =>
            sum + 1 + countDirection(owner, row, col, dr, dc, player) + countDirection(owner, row, col, -dr, -dc, player), 0);
    }

    /** 某方所有恰好 length 颗的连续真子线：{ cells, ends(两端可落子的空位) } */
    runs(player, length) {
        const owner = (r, c) => this.stoneAt(r, c);
        const result = [];
        for (const { row, col } of this.stonesOf(player)) {
            for (const [dr, dc] of LINE_DIRS) {
                const before = { row: row - dr, col: col - dc };
                if (inBounds(before.row, before.col) && owner(before.row, before.col) === player) continue; // 不是线的起点
                const count = 1 + countDirection(owner, row, col, dr, dc, player);
                if (count !== length) continue;
                const cells = Array.from({ length }, (_, i) => ({ row: row + dr * i, col: col + dc * i }));
                const after = { row: row + dr * length, col: col + dc * length };
                const ends = [before, after].filter(p => inBounds(p.row, p.col) && this.isEmpty(p.row, p.col));
                result.push({ cells, ends });
            }
        }
        return result;
    }

    /** 离给定棋子群最远（最小曼哈顿距离最大）的空位 */
    farthestEmptyFrom(cells) {
        if (cells.length === 0) return null;
        let best = null, bestDist = -1;
        for (const p of this.emptyCells()) {
            const dist = Math.min(...cells.map(s => Math.abs(s.row - p.row) + Math.abs(s.col - p.col)));
            if (dist > bestDist) { bestDist = dist; best = p; }
        }
        return best;
    }

    targetCells(type, player) {
        switch (type) {
            case Target.OWN: return this.stonesOf(player);
            case Target.ENEMY: return this.stonesOf(opponentOf(player));
            case Target.EMPTY: return this.emptyCells();
            case Target.ANY: return this.allCells();
            default: return [];
        }
    }

    matchesTarget(type, cell, player) {
        return this.targetCells(type, player).some(p => sameCell(p, cell));
    }

    /**
     * 当前玩家可以正常落子的位置。
     * 限定区域（围魏救赵等）和禁区（空城计）若让玩家无处可下，则自动失效，避免卡死。
     */
    legalMoves(player = this.state.current) {
        const empties = this.emptyCells();
        const forbidden = new Set(this.state.forbidden.flatMap(f => f.cells.map(c => cellKey(c.row, c.col))));
        const restrictions = this.state.restrictions
            .filter(r => r.player === player)
            .map(r => new Set(r.cells.map(c => cellKey(c.row, c.col))));
        const open = empties.filter(c => !forbidden.has(cellKey(c.row, c.col)));
        const restricted = open.filter(c => restrictions.every(set => set.has(cellKey(c.row, c.col))));
        if (restricted.length) return restricted;
        return open.length ? open : empties;
    }

    isLegalMove(row, col) {
        return this.legalMoves().some(c => c.row === row && c.col === col);
    }

    illegalReason(row, col) {
        if (!this.isEmpty(row, col)) return '该位置不能落子';
        const inCells = cells => cells.some(c => c.row === row && c.col === col);
        const forbidden = this.state.forbidden.find(f => inCells(f.cells));
        if (forbidden) return `${forbidden.label}：此区域禁止落子`;
        const restriction = this.state.restrictions.find(r => r.player === this.state.current && !inCells(r.cells));
        if (restriction) return `${restriction.label}：必须在高亮区域落子`;
        return '该位置不能落子';
    }

    /** 技能当前不能用的原因；可用时返回 null */
    skillBlockReason(skill, player = this.state.current) {
        const s = this.state;
        if (!s.pool.includes(skill.id)) return '本局技能池中没有该技能';
        if (s.turn.sealed) return `技能被封印（${s.turn.sealed}）`;
        if (!s.testMode && s.cooldowns[skill.id] > 0) {
            return `${skill.name}冷却中，还需 ${s.cooldowns[skill.id]} 回合（双方共享）`;
        }
        if (!s.testMode && s.energy[player] < skill.cost) {
            return `能量不足：需要 ${skill.cost}，当前 ${s.energy[player]}`;
        }
        if (skill.canUse && !skill.canUse(this, player)) return `${skill.name}：当前条件不满足`;
        return null;
    }

    pendingTargets() {
        const pending = this.state.pending;
        if (!pending) return [];
        return SKILL_MAP.get(pending.skill).pendingTargets(this, pending.player, pending);
    }

    // ==================== 玩家操作（界面与 AI 的唯一入口） ====================

    /** 点击棋盘：依次处理二段选择 → 已选中的技能 → 普通落子 */
    clickCell(row, col) {
        if (this.isOver()) return false;
        this.message = '';
        let ok;
        if (this.state.pending) ok = this.resolvePending(row, col);
        else if (this.armed) ok = this.useSkill(SKILL_MAP.get(this.armed), { row, col });
        else ok = this.placeMove(row, col);
        if (ok) this.settle();
        return ok;
    }

    /** 点击技能：无目标技能立即生效，其余技能进入选目标状态；再次点击取消 */
    selectSkill(id) {
        if (this.isOver()) return false;
        this.message = '';
        if (this.state.pending) return this.fail('请先完成当前技能（Esc 可取消）');
        if (this.armed === id) {
            this.armed = null;
            this.message = '已取消技能';
            return true;
        }
        const skill = SKILL_MAP.get(id);
        const blocked = this.skillBlockReason(skill);
        if (blocked) return this.fail(blocked);
        if (skill.target !== Target.NONE) {
            this.armed = id;
            return true;
        }
        this.armed = null;
        const ok = this.useSkill(skill, null);
        if (ok) this.settle();
        return ok;
    }

    /** 取消选中的技能；二段选择中取消则整体撤销该技能并返还能量和冷却 */
    cancel() {
        if (this.state.pending && this.pendingRollback) {
            this.restore(this.pendingRollback.snapshot);
            this.turnDirty = this.pendingRollback.dirty;
            this.pendingRollback = null;
            this.message = '已撤销技能，能量与冷却已返还';
            return true;
        }
        if (this.armed) {
            this.armed = null;
            this.message = '已取消技能';
            return true;
        }
        return false;
    }

    /** 悔棋：本回合已有操作则回到本回合开始，否则回到上一回合开始 */
    undo() {
        if (!this.canUndo()) return false;
        if (!this.turnDirty) this.history.pop();
        this.restore(this.history[this.history.length - 1]);
        this.turnDirty = false;
        this.armed = null;
        this.pendingRollback = null;
        this.message = '↩️ 已悔棋';
        return true;
    }

    // ==================== 内部流程 ====================

    useSkill(skill, target) {
        const p = this.state.current;
        if (target && !this.matchesTarget(skill.target, target, p)) return this.fail(TARGET_HINTS[skill.target]);
        const before = this.snapshot();
        const wasDirty = this.turnDirty;
        const effectCount = this.effects.length;
        const rollback = () => {
            this.restore(before);
            this.effects.length = effectCount;
            return false;
        };

        if (!this.state.testMode) this.state.energy[p] -= skill.cost;
        if (!skill.use(this, p, target)) return rollback();

        this.state.cooldowns[skill.id] = skill.cooldown;
        this.state.lastSkill[p] = skill.id;
        this.armed = null;
        this.turnDirty = true;
        if (this.state.pending) {
            if (this.pendingTargets().length === 0) {
                rollback();
                return this.fail('没有可选的目标，技能未生效');
            }
            this.pendingRollback = { snapshot: before, dirty: wasDirty };
        }
        return true;
    }

    resolvePending(row, col) {
        const pending = this.state.pending;
        if (!this.pendingTargets().some(c => c.row === row && c.col === col)) {
            return this.fail('请选择高亮的位置（Esc 可取消技能）');
        }
        const before = this.snapshot();
        const effectCount = this.effects.length;
        this.state.pending = null;
        const ok = SKILL_MAP.get(pending.skill).resolve(this, pending.player, pending, { row, col });
        if (!ok) {
            this.restore(before);
            this.effects.length = effectCount;
            return false;
        }
        if (this.state.pending && this.pendingTargets().length === 0) {
            // 借尸还魂复制的技能又进入二段选择却没有目标：整体撤销
            this.restore(this.pendingRollback.snapshot);
            this.turnDirty = this.pendingRollback.dirty;
            this.effects.length = effectCount;
            this.pendingRollback = null;
            return this.fail('没有可选的目标，技能未生效');
        }
        if (!this.state.pending) this.pendingRollback = null;
        this.turnDirty = true;
        return true;
    }

    /** 作为本回合落子的一手（普通落子与落子类技能共用） */
    placeMove(row, col) {
        const s = this.state, p = s.current;
        if (!this.isLegalMove(row, col)) return this.fail(this.illegalReason(row, col));
        if (s.turn.soundEast) {
            s.phantoms.push({ row, col, player: p, turns: null, soundEast: true });
            this.effect({ row, col }, '🎭 虚像子');
        } else {
            s.board[row][col] = p;
            s.moves.push({ row, col, player: p });
            this.applyPlacementBonuses(row, col, p);
        }
        this.addEnergy(p, ENERGY_PER_MOVE);
        s.turn.placementsLeft--;
        this.turnDirty = true;
        return true;
    }

    applyPlacementBonuses(row, col, player) {
        const turn = this.state.turn;
        if (turn.beautyTrap) {
            turn.beautyTrap = false;
            const victims = neighborCells(row, col).filter(n => this.stoneAt(n.row, n.col) === opponentOf(player));
            victims.forEach(n => this.neutralize(n.row, n.col, 2));
            if (victims.length) this.effect({ row, col }, `💃 美人计! ${victims.length}颗棋子中立`);
        }
        if (turn.isolatedBonus && this.maxRun(row, col) === 1) {
            turn.isolatedBonus = false;
            this.addEnergy(player, 2);
            this.effect({ row, col }, '🤪 假痴不癫! +2能量');
        }
        if (turn.immuneNext) {
            turn.immuneNext = false;
            this.markImmune(row, col);
            this.effect({ row, col }, '💔 永久免疫');
        }
    }

    settle() {
        const s = this.state;
        if (this.isOver()) return;
        if (!s.turn.cannotWin && this.hasFive(s.current)) {
            s.winner = s.current;
            this.armed = null;
            return;
        }
        if (s.pending) return;
        if (s.turn.placementsLeft <= 0) this.endTurn();
        if (this.emptyCells().length === 0) s.draw = true;
    }

    endTurn() {
        const s = this.state;
        const ending = s.current;
        const tick = list => list.filter(item => item.turns === null || --item.turns > 0);
        s.phantoms = tick(s.phantoms);
        s.neutral = tick(s.neutral);
        s.disguised = tick(s.disguised);
        s.restrictions = s.restrictions.filter(r => r.player !== ending);
        s.forbidden = s.forbidden.filter(f => f.until !== ending);
        for (const id of s.pool) s.cooldowns[id] = s.testMode ? 0 : Math.max(0, s.cooldowns[id] - 1);
        this.armed = null;
        this.startTurn(opponentOf(ending));
    }

    startTurn(player) {
        const s = this.state;
        s.current = player;
        s.turn = freshTurn();
        s.pending = null;
        if (s.sealNext[player]) {
            s.turn.sealed = s.sealNext[player];
            s.sealNext[player] = null;
        }
        if (s.energyPenalty[player]) {
            s.energy[player] = Math.max(0, s.energy[player] - s.energyPenalty[player]);
            this.effect(null, `⚡ ${playerName(player)}能量 -${s.energyPenalty[player]}`);
            s.energyPenalty[player] = 0;
        }
        this.revealSoundEast(player);
        this.history.push(this.snapshot());
        this.turnDirty = false;
        this.pendingRollback = null;
    }

    /** 声东击西：自己下回合开始时随机消失一颗虚像子，剩下的转为真子 */
    revealSoundEast(player) {
        const s = this.state;
        const mine = s.phantoms.filter(p => p.soundEast && p.player === player);
        if (mine.length === 0) return;
        if (mine.length >= 2) {
            const gone = mine[Math.floor(this.random() * mine.length)];
            this.effect(gone, '🎭 虚像子消失');
            mine.splice(mine.indexOf(gone), 1);
        }
        for (const p of mine) {
            if (!this.stoneAt(p.row, p.col)) s.board[p.row][p.col] = player;
            this.effect(p, '🎭 虚像转实');
        }
        s.phantoms = s.phantoms.filter(p => !(p.soundEast && p.player === player));
    }

    // ==================== 技能可调用的状态修改 ====================

    fail(text) {
        this.message = `❌ ${text}`;
        return false;
    }

    effect(cell, text) {
        const { row, col } = cell || { row: CENTER, col: CENTER };
        this.effects.push({ row, col, text });
    }

    get turn() {
        return this.state.turn;
    }

    setPending(skill, data) {
        this.state.pending = { skill: skill.id, player: this.state.current, ...data };
    }

    skipMove() {
        this.state.turn.placementsLeft = 0;
    }

    addPlacements(count) {
        this.state.turn.placementsLeft += count;
    }

    addEnergy(player, amount) {
        const s = this.state;
        s.energy[player] = Math.min(s.maxEnergy, s.energy[player] + amount);
    }

    addEnergyPenalty(player, amount) {
        this.state.energyPenalty[player] += amount;
    }

    /** 技能附带的落子（不算本回合的一手，不加能量） */
    putStone(row, col, player) {
        this.state.board[row][col] = player;
        this.state.moves.push({ row, col, player });
    }

    removeStone(row, col) {
        this.state.board[row][col] = null;
        this.clearMarks(row, col);
    }

    setOwner(row, col, player) {
        this.state.board[row][col] = player;
        const s = this.state;
        s.neutral = s.neutral.filter(n => !(n.row === row && n.col === col));
        s.disguised = s.disguised.filter(d => !(d.row === row && d.col === col));
    }

    moveStone(from, to) {
        const board = this.state.board;
        board[to.row][to.col] = board[from.row][from.col];
        board[from.row][from.col] = null;
        this.remapMarks(cell => (sameCell(cell, from) ? to : cell));
    }

    swapStones(a, b) {
        const board = this.state.board;
        [board[a.row][a.col], board[b.row][b.col]] = [board[b.row][b.col], board[a.row][a.col]];
        this.remapMarks(cell => (sameCell(cell, a) ? b : sameCell(cell, b) ? a : cell));
    }

    addPhantom(row, col, player, turns) {
        this.state.phantoms.push({ row, col, player, turns, soundEast: false });
    }

    neutralize(row, col, turns) {
        const s = this.state;
        s.neutral = s.neutral.filter(n => !(n.row === row && n.col === col));
        s.neutral.push({ row, col, turns });
    }

    disguise(row, col, turns) {
        const s = this.state;
        s.disguised = s.disguised.filter(d => !(d.row === row && d.col === col));
        s.disguised.push({ row, col, turns });
    }

    markImmune(row, col) {
        if (!this.isImmune(row, col)) this.state.immune.push(cellKey(row, col));
    }

    restrict(player, cells, label) {
        this.state.restrictions.push({ player, cells: cells.map(({ row, col }) => ({ row, col })), label });
    }

    forbid(cells, until, label) {
        this.state.forbidden.push({ cells: cells.map(({ row, col }) => ({ row, col })), until, label });
    }

    sealSkills(player, label) {
        this.state.sealNext[player] = label;
    }

    clearMarks(row, col) {
        const s = this.state;
        s.immune = s.immune.filter(k => k !== cellKey(row, col));
        s.neutral = s.neutral.filter(n => !(n.row === row && n.col === col));
        s.disguised = s.disguised.filter(d => !(d.row === row && d.col === col));
    }

    /** 棋子移动/交换后，让它身上的标记（免疫/中立/伪装）跟着走 */
    remapMarks(mapCell) {
        const s = this.state;
        s.immune = s.immune.map(key => {
            const [row, col] = key.split(',').map(Number);
            const next = mapCell({ row, col });
            return cellKey(next.row, next.col);
        });
        for (const mark of [...s.neutral, ...s.disguised]) {
            const next = mapCell({ row: mark.row, col: mark.col });
            mark.row = next.row;
            mark.col = next.col;
        }
    }
}
