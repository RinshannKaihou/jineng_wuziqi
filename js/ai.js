// ==================== 五子棋 AI ====================
// chooseMove 决定"下在哪里"；chooseSkill 决定回合开头要不要用计策；act 把两者合成一步操作。
//
//   1. 棋型查表：把某格在一个方向上前后各 4 格编码成 3^8 的下标，预先算好对应棋型
//      （五连 / 活四 / 冲四 / 活三 / 眠三 / 活二 / 眠二），跳三、跳四也能识别
//   2. 必胜/必防：能成五就成五；对方能成五就堵；能走出活四、双四、四三就走
//   3. VCF 算杀：连续冲四取胜；对方有 VCF 时只考虑能化解它的着法
//   4. alpha-beta 搜索：迭代加深 + 威胁优先的着法生成，超时返回上一层的结果
//   5. 计策：在对局上试用每个可用技能（候选目标经过筛选），把回合走完后按威胁分档打分，
//      比直接落子明显更好才用

const GomokuAI = (() => {
    const N = BOARD_SIZE;
    const SIZE = N * N;
    const EMPTY = 0, WALL = 3;

    // ---------- 棋型 ----------
    const NONE = 0, ONE = 1, TWO = 2, OPEN_TWO = 3, THREE = 4, OPEN_THREE = 5, FOUR = 6, OPEN_FOUR = 7, FIVE = 8;
    const SHAPE_SCORE = [0, 4, 20, 120, 150, 1000, 1100, 0, 0];
    const WIN5 = 10000000;  // 成五
    const WIN4 = 1000000;   // 活四 / 双四 / 四三：下一步必成五
    const DOUBLE3 = 100000; // 双活三
    const WIN = 1000000000;

    /** line: 长度 9，中心(下标 4)为己方；0 空，1 己方，2 对方或边界 */
    const shapeTable = new Uint8Array(6561);
    (function buildShapeTable() {
        const memo = new Int8Array(6561).fill(-1);
        const encode = line => {
            let index = 0, m = 1;
            for (let i = 0; i < 9; i++) {
                if (i === 4) continue;
                index += line[i] * m;
                m *= 3;
            }
            return index;
        };
        const classify = line => {
            const key = encode(line);
            if (memo[key] >= 0) return memo[key];
            let shape = NONE;
            const completions = new Set();
            for (let s = 0; s <= 4; s++) {
                let own = 0, gap = -1, blocked = false;
                for (let i = s; i < s + 5; i++) {
                    if (line[i] === 1) own++;
                    else if (line[i] === 0) gap = i;
                    else { blocked = true; break; }
                }
                if (blocked) continue;
                if (own === 5) { shape = FIVE; break; }
                if (own === 4) completions.add(gap);
            }
            if (shape !== FIVE) {
                if (completions.size >= 2) shape = OPEN_FOUR;
                else if (completions.size === 1) shape = FOUR;
                else {
                    // 再下一子能升级成什么，决定当前是几
                    for (let e = 0; e < 9; e++) {
                        if (line[e] !== 0) continue;
                        line[e] = 1;
                        const next = classify(line);
                        line[e] = 0;
                        const derived = next === OPEN_FOUR ? OPEN_THREE
                            : next === FOUR ? THREE
                            : next === OPEN_THREE ? OPEN_TWO
                            : next === THREE ? TWO
                            : (next === OPEN_TWO || next === TWO) ? ONE
                            : NONE;
                        if (derived > shape) shape = derived;
                    }
                }
            }
            memo[key] = shape;
            return shape;
        };
        const line = new Array(9);
        for (let index = 0; index < 6561; index++) {
            let rest = index;
            for (let i = 0; i < 9; i++) {
                if (i === 4) { line[i] = 1; continue; }
                line[i] = rest % 3;
                rest = Math.floor(rest / 3);
            }
            shapeTable[index] = classify(line);
        }
    })();

    // 每个格子在 4 个方向上距离 -4..-1、+1..+4 的格子下标（越界为 -1）
    const STEPS = [-4, -3, -2, -1, 1, 2, 3, 4];
    const LINES = new Int16Array(SIZE * 4 * 8);
    for (let cell = 0; cell < SIZE; cell++) {
        const r = Math.floor(cell / N), c = cell % N;
        LINE_DIRS.forEach(([dr, dc], d) => {
            STEPS.forEach((k, slot) => {
                const rr = r + dr * k, cc = c + dc * k;
                LINES[(cell * 4 + d) * 8 + slot] = inBounds(rr, cc) ? rr * N + cc : -1;
            });
        });
    }
    const CENTER_BIAS = new Int8Array(SIZE);
    for (let cell = 0; cell < SIZE; cell++) {
        const r = Math.floor(cell / N), c = cell % N;
        CENTER_BIAS[cell] = CENTER - Math.max(Math.abs(r - CENTER), Math.abs(c - CENTER));
    }

    // Zobrist 哈希（固定种子，结果可复现），用于 VCF 剪掉重复局面
    const ZOBRIST = new Int32Array(SIZE * 4 * 2);
    let seed = 0x9e3779b9;
    for (let i = 0; i < ZOBRIST.length; i++) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        ZOBRIST[i] = seed;
    }

    class TimeUp extends Error {}

    class Engine {
        constructor(board, { deadline = Infinity } = {}) {
            this.board = board;              // Int8Array(225)：0 空，1 黑，2 白，3 不可用
            this.near = new Uint8Array(SIZE); // 周围 2 格内的棋子数，>0 才作为候选点
            this.deadline = deadline;
            this.nodes = 0;
            this.stack = [];
            this.stones = 0;
            this.hashHi = 0;
            this.hashLo = 0;
            this.vcfFailed = [null, new Map(), new Map()]; // 按进攻方记录：局面 → 已证明失败的深度
            for (let cell = 0; cell < SIZE; cell++) {
                if (board[cell] !== EMPTY) {
                    this.markNear(cell, 1);
                    this.toggleHash(cell, board[cell]);
                }
            }
            this.scoreMe = new Int32Array(SIZE);
            this.scoreOp = new Int32Array(SIZE);
            this.maxMe = new Uint8Array(SIZE);
            this.maxOp = new Uint8Array(SIZE);
        }

        toggleHash(cell, player) {
            const i = (cell * 4 + player) * 2;
            this.hashHi ^= ZOBRIST[i];
            this.hashLo ^= ZOBRIST[i + 1];
        }

        hashKey() {
            return (this.hashHi >>> 0) * 2097152 + (this.hashLo >>> 11);
        }

        markNear(cell, delta) {
            const r = Math.floor(cell / N), c = cell % N;
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    if (inBounds(r + dr, c + dc)) this.near[(r + dr) * N + c + dc] += delta;
                }
            }
            this.stones += delta;
        }

        place(cell, player) {
            this.board[cell] = player;
            this.markNear(cell, 1);
            this.toggleHash(cell, player);
            this.stack.push(cell);
        }

        undo() {
            const cell = this.stack.pop();
            this.toggleHash(cell, this.board[cell]);
            this.board[cell] = EMPTY;
            this.markNear(cell, -1);
        }

        unwindTo(depth) {
            while (this.stack.length > depth) this.undo();
        }

        checkTime() {
            if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) throw new TimeUp();
        }

        /** 在空位 cell 落子后，me / op 各自在 4 个方向上的棋型，结果写入 score/max 数组 */
        scoreCell(cell, me) {
            const board = this.board;
            let sumMe = 0, sumOp = 0, maxMe = 0, maxOp = 0;
            let fivesMe = 0, foursMe = 0, openFoursMe = 0, threesMe = 0;
            let fivesOp = 0, foursOp = 0, openFoursOp = 0, threesOp = 0;
            for (let d = 0; d < 4; d++) {
                const base = (cell * 4 + d) * 8;
                let iMe = 0, iOp = 0, m = 1;
                for (let slot = 0; slot < 8; slot++, m *= 3) {
                    const n = LINES[base + slot];
                    const v = n < 0 ? WALL : board[n];
                    if (v === EMPTY) continue;
                    if (v === me) { iMe += m; iOp += 2 * m; } else if (v === WALL) { iMe += 2 * m; iOp += 2 * m; } else { iMe += 2 * m; iOp += m; }
                }
                const a = shapeTable[iMe], b = shapeTable[iOp];
                if (a > maxMe) maxMe = a;
                if (b > maxOp) maxOp = b;
                sumMe += SHAPE_SCORE[a];
                sumOp += SHAPE_SCORE[b];
                if (a === FIVE) fivesMe++; else if (a === OPEN_FOUR) openFoursMe++; else if (a === FOUR) foursMe++; else if (a === OPEN_THREE) threesMe++;
                if (b === FIVE) fivesOp++; else if (b === OPEN_FOUR) openFoursOp++; else if (b === FOUR) foursOp++; else if (b === OPEN_THREE) threesOp++;
            }
            const combine = (fives, openFours, fours, threes, sum) =>
                fives ? WIN5
                    : (openFours || fours >= 2 || (fours && threes)) ? WIN4
                    : threes >= 2 ? DOUBLE3
                    : sum + CENTER_BIAS[cell];
            this.scoreMe[cell] = combine(fivesMe, openFoursMe, foursMe, threesMe, sumMe);
            this.scoreOp[cell] = combine(fivesOp, openFoursOp, foursOp, threesOp, sumOp);
            this.maxMe[cell] = maxMe;
            this.maxOp[cell] = maxOp;
        }

        /** 给所有候选点打分，返回候选点列表 */
        scoreAll(me) {
            const cells = [];
            for (let cell = 0; cell < SIZE; cell++) {
                if (this.board[cell] !== EMPTY || this.near[cell] === 0) continue;
                this.scoreCell(cell, me);
                cells.push(cell);
            }
            return cells;
        }

        /**
         * 威胁优先的着法生成（me 方行棋）
         * 返回 { win: cell } 或 { moves: [...], cells }
         */
        generate(me, limit) {
            const cells = this.scoreAll(me);
            const { scoreMe, scoreOp, maxMe, maxOp } = this;
            const byValue = list => list.sort((x, y) => (scoreMe[y] + scoreOp[y]) - (scoreMe[x] + scoreOp[x]));
            const five = cells.find(c => scoreMe[c] >= WIN5);
            if (five !== undefined) return { win: five, cells };
            const blocks = cells.filter(c => scoreOp[c] >= WIN5);
            if (blocks.length) return { moves: blocks, cells };
            const wins = cells.filter(c => scoreMe[c] >= WIN4);
            if (wins.length) return { moves: byValue(wins).slice(0, 1), cells };
            if (cells.some(c => scoreOp[c] >= WIN4)) {
                // 对方有活三/四三的威胁：只考虑防守点和自己的冲四
                const defend = cells.filter(c => scoreOp[c] >= WIN4 || maxOp[c] >= FOUR || maxMe[c] >= FOUR);
                return { moves: byValue(defend), cells };
            }
            return { moves: byValue(cells).slice(0, limit), cells };
        }

        /** 静态评估（me 方行棋），必须在 generate/scoreAll 之后调用 */
        evaluate(cells, ply) {
            const { scoreMe, scoreOp } = this;
            let total = 0, opFives = 0, meWin4 = false;
            for (const c of cells) {
                if (scoreMe[c] >= WIN5) return WIN - ply;
                if (scoreOp[c] >= WIN5) opFives++;
                if (scoreMe[c] >= WIN4) meWin4 = true;
                total += Math.min(scoreMe[c], WIN4) - Math.min(scoreOp[c], WIN4);
            }
            if (opFives >= 2) return -(WIN - ply);
            if (opFives === 0 && meWin4) return WIN - ply - 2;
            return total;
        }

        negamax(depth, alpha, beta, me, ply) {
            this.checkTime();
            const gen = this.generate(me, 10);
            if (gen.win !== undefined) return WIN - ply;
            if (depth <= 0) return this.evaluate(gen.cells, ply);
            if (gen.moves.length === 0) return 0;
            // 只有一个应着（必须堵）时不减深度，避免被冲四序列挤出视野
            const nextDepth = gen.moves.length === 1 && ply < 16 ? depth : depth - 1;
            let best = -Infinity;
            for (const move of gen.moves) {
                this.place(move, me);
                const value = -this.negamax(nextDepth, -beta, -alpha, 3 - me, ply + 1);
                this.undo();
                if (value > best) best = value;
                if (value > alpha) alpha = value;
                if (alpha >= beta) break;
            }
            return best;
        }

        /** 在 cell 落子能否让 player 直接成五 */
        makesFive(cell, player) {
            this.scoreCell(cell, player);
            return this.scoreMe[cell] >= WIN5;
        }

        /** 刚在 cell 落子后，player 新出现的成五点（只需检查经过 cell 的四条线） */
        fiveSpotsThrough(cell, player) {
            const spots = new Set();
            for (let d = 0; d < 4; d++) {
                for (let slot = 0; slot < 8; slot++) {
                    const n = LINES[(cell * 4 + d) * 8 + slot];
                    if (n >= 0 && this.board[n] === EMPTY && !spots.has(n) && this.makesFive(n, player)) spots.add(n);
                }
            }
            return [...spots];
        }

        /** VCF：attacker 能否靠连续冲四取胜，返回第一手或 -1 */
        vcf(attacker, depth) {
            this.checkTime();
            if (depth <= 0) return -1;
            const failed = this.vcfFailed[attacker];
            const key = this.hashKey();
            if (failed.get(key) >= depth) return -1;
            const result = this.searchVcf(attacker, depth);
            if (result < 0) failed.set(key, depth);
            return result;
        }

        searchVcf(attacker, depth) {
            const defender = 3 - attacker;
            const cells = this.scoreAll(attacker);
            const five = cells.find(c => this.scoreMe[c] >= WIN5);
            if (five !== undefined) return five;
            if (cells.some(c => this.scoreOp[c] >= WIN5)) return -1; // 对方先成五
            const fours = cells.filter(c => this.maxMe[c] >= FOUR);
            const value = fours.map(c => this.scoreMe[c]);
            const order = fours.map((c, i) => i).sort((x, y) => value[y] - value[x]);
            for (const i of order) {
                const move = fours[i];
                this.place(move, attacker);
                const spots = this.fiveSpotsThrough(move, attacker);
                let wins = spots.length >= 2;
                if (spots.length === 1 && !this.makesFive(spots[0], defender)) {
                    this.place(spots[0], defender);
                    const counter = this.fiveSpotsThrough(spots[0], defender).length > 0;
                    wins = !counter && this.vcf(attacker, depth - 1) >= 0;
                    this.undo();
                }
                this.undo();
                if (wins) return move;
            }
            return -1;
        }
    }

    /** ignore(phantom) 为真的幻想子按空位处理 */
    function toBoard(game, ignore = null) {
        const board = new Int8Array(SIZE);
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const phantom = ignore && !game.stoneAt(r, c) && game.phantomAt(r, c);
                if (phantom && ignore(phantom)) continue;
                const owner = game.lineOwner(r, c);
                board[r * N + c] = owner === 'black' ? 1 : owner === 'white' ? 2
                    : game.isEmpty(r, c) ? EMPTY : WALL; // 中立棋子：双方都不能借用
            }
        }
        return board;
    }

    /**
     * 为 player 选择一手棋。
     * @returns {{row:number, col:number}|null}
     */
    function chooseMove(game, player, { timeLimit = 800, maxDepth = 8, vcfDepth = 10 } = {}) {
        const legal = game.legalMoves(player).map(p => p.row * N + p.col);
        if (legal.length === 0) return null;
        const toCell = cell => ({ row: Math.floor(cell / N), col: cell % N });
        const start = Date.now();
        // VCF 阶段最多用 40% 的时间，剩下的留给 alpha-beta
        const engine = new Engine(toBoard(game), { deadline: start + timeLimit * 0.4 });
        const me = player === 'black' ? 1 : 2, op = 3 - me;
        const isLegal = new Set(legal);

        if (engine.stones === 0) {
            const center = CENTER * N + CENTER;
            return toCell(isLegal.has(center) ? center : legal.sort((a, b) => CENTER_BIAS[b] - CENTER_BIAS[a])[0]);
        }

        // 根节点候选：合法点逐个打分（限定区域可能远离现有棋子）
        legal.forEach(cell => engine.scoreCell(cell, me));
        const scoreMe = Int32Array.from(engine.scoreMe), scoreOp = Int32Array.from(engine.scoreOp);
        const maxMe = Uint8Array.from(engine.maxMe);
        const best = list => list.reduce((a, b) => (scoreMe[b] + scoreOp[b] > scoreMe[a] + scoreOp[a] ? b : a));

        const fives = legal.filter(c => scoreMe[c] >= WIN5);
        if (fives.length) return toCell(fives[0]);
        const blocks = legal.filter(c => scoreOp[c] >= WIN5);
        if (blocks.length) return toCell(best(blocks));
        const wins = legal.filter(c => scoreMe[c] >= WIN4);
        if (wins.length) return toCell(best(wins));

        try {
            const attack = engine.vcf(me, vcfDepth);
            if (attack >= 0 && isLegal.has(attack)) return toCell(attack);
        } catch (e) {
            if (!(e instanceof TimeUp)) throw e;
            engine.unwindTo(0);
        }

        let candidates = (engine.generate(me, 16).moves || []).filter(c => isLegal.has(c));
        if (candidates.length === 0) {
            candidates = legal.slice().sort((a, b) => (scoreMe[b] + scoreOp[b]) - (scoreMe[a] + scoreOp[a])).slice(0, 16);
        }
        // 开局前几手只贴着已有棋子走，避免搜索在局面很空时选出"隔一格"的怪招
        if (engine.stones <= 3) {
            const adjacent = candidates.filter(cell => neighborCells(Math.floor(cell / N), cell % N)
                .some(p => engine.board[p.row * N + p.col] !== EMPTY));
            if (adjacent.length) candidates = adjacent;
        }

        // 对方有 VCF：只保留能化解的着法（含自己的冲四反击）
        try {
            if (engine.vcf(op, vcfDepth) >= 0) {
                const tries = [...new Set([...candidates, ...legal.filter(c => maxMe[c] >= FOUR)])];
                const safe = tries.filter(c => {
                    engine.place(c, me);
                    const threat = engine.vcf(op, vcfDepth);
                    engine.undo();
                    return threat < 0;
                });
                if (safe.length) candidates = safe;
            }
        } catch (e) {
            if (!(e instanceof TimeUp)) throw e;
            engine.unwindTo(0);
        }

        // 迭代加深 alpha-beta
        engine.deadline = start + timeLimit;
        let choice = candidates[0];
        for (let depth = 2; depth <= maxDepth; depth++) {
            let alpha = -Infinity, bestThisDepth = choice;
            try {
                for (const move of candidates) {
                    engine.place(move, me);
                    const value = -engine.negamax(depth - 1, -Infinity, -alpha, op, 1);
                    engine.undo();
                    if (value > alpha) { alpha = value; bestThisDepth = move; }
                }
            } catch (e) {
                if (!(e instanceof TimeUp)) throw e;
                engine.unwindTo(0);
                break;
            }
            choice = bestThisDepth;
            candidates = [choice, ...candidates.filter(c => c !== choice)];
            if (alpha >= WIN / 2 || alpha <= -WIN / 2) break; // 已算出胜负
        }
        return toCell(choice);
    }

    // ==================== 计策 ====================

    // 每点能量折合的局面分（只计到本局最贵技能的费用为止）。一手闲棋约值几千分，
    // 所以以逸待劳只在落子几乎没用时（例如被关门捉贼困在角落）才划算
    const ENERGY_VALUE = 1000;
    const SEAL_COST = 1000;   // 自己下回合技能被封印（打草惊蛇）
    const MIN_GAIN = 200;     // 技能至少要比直接落子好这么多才用
    const TOP_CELLS = 8;      // 空位候选：棋型分最高的几个
    const TOP_STONES = 3;     // 棋子候选：最关键、最不关键的各几颗
    const QUICK = { maxDepth: 0, vcfDepth: 0 }; // 推演里补完回合用的快速着法：只看必胜必防和棋型分

    /**
     * 回合已结束（轮到对手或已分胜负）时，从 me 的角度给局面打分。
     * 分档：自己已胜 > 对手堵不住自己的成五（对手还能用技能自救时打折）> 普通局面
     *       > 对手能走出活四、四三 > 对手下一手成五；同档内比较棋型分和能量。
     */
    function outlook(game, me) {
        const s = game.state;
        if (s.winner) return s.winner === me ? WIN : -WIN;
        if (s.draw) return 0;
        const op = opponentOf(me);
        // 撑不到自己下回合的幻想子（树上开花、声东击西的虚像）不算自己的威胁
        const engine = new Engine(toBoard(game, p => p.player === me && (p.soundEast || p.turns === 1)));
        const cells = engine.scoreAll(op === 'black' ? 1 : 2);
        const mine = engine.scoreOp, theirs = engine.scoreMe; // 轮到对手，所以 scoreMe 是对手的分
        const legal = new Set(game.legalMoves(op).map(p => p.row * N + p.col));

        let total = 0;
        for (const c of cells) total += Math.min(mine[c], DOUBLE3) - Math.min(theirs[c], DOUBLE3);
        const desired = Math.max(0, ...s.pool.map(id => SKILL_MAP.get(id).cost));
        const energy = Math.max(0, s.energy[me] - s.energyPenalty[me]);
        total += ENERGY_VALUE * Math.min(energy, desired) - (s.sealNext[me] ? SEAL_COST : 0);

        const opMoves = cells.filter(c => legal.has(c));
        // 推移、交换对方棋子可能直接替对方连成五（只在对方行动时才判胜）
        if (game.hasFive(op) || opMoves.some(c => theirs[c] >= WIN5)) return total - WIN / 2;
        const fives = cells.filter(c => mine[c] >= WIN5);
        if (fives.length >= 2 || (fives.length === 1 && !legal.has(fives[0]))) {
            const canEscape = s.pool.some(id => !game.skillBlockReason(SKILL_MAP.get(id), op));
            return total + (canEscape ? WIN / 4 : WIN / 2);
        }
        const replies = fives.length === 1 ? fives : opMoves; // 自己冲四时对手只能去堵
        if (replies.some(c => theirs[c] >= WIN4)) return total - WIN / 8;
        return total;
    }

    /** 把 me 这一回合剩下的落子走完再打分；preferred（搜索选出的着法）与快速着法取较好者 */
    function finish(game, me, preferred = null) {
        if (game.isOver() || game.state.current !== me) return outlook(game, me);
        const moves = [chooseMove(game, me, QUICK)];
        if (preferred && !sameCell(preferred, moves[0]) && game.isLegalMove(preferred.row, preferred.col)) moves.push(preferred);
        return Math.max(...moves.map(move => game.trial(() =>
            (move && game.clickCell(move.row, move.col) ? finish(game, me) : -WIN))));
    }

    /** 候选目标筛选：空位取棋型分最高的几个（外加离所有棋子最远的一格），棋子取最关键和最不关键的几颗 */
    function targetPicker(game, player) {
        const engine = new Engine(toBoard(game));
        const interest = new Int32Array(SIZE);
        for (const { row, col } of game.emptyCells()) {
            const cell = row * N + col;
            engine.scoreCell(cell, player === 'black' ? 1 : 2);
            interest[cell] = engine.scoreMe[cell] + engine.scoreOp[cell];
        }
        const far = game.farthestEmptyFrom(game.allCells().filter(p => !game.isEmpty(p.row, p.col)));
        return cells => {
            const empty = cells.filter(p => game.isEmpty(p.row, p.col));
            const stones = cells.filter(p => !game.isEmpty(p.row, p.col));
            empty.sort((a, b) => interest[b.row * N + b.col] - interest[a.row * N + a.col]);
            const picked = empty.slice(0, TOP_CELLS);
            if (far && empty.length > TOP_CELLS && empty.some(p => sameCell(p, far))) picked.push(far);
            if (stones.length <= TOP_STONES * 2) return picked.concat(stones);
            const weight = p => game.connections(p.row, p.col);
            stones.sort((a, b) => weight(b) - weight(a));
            return picked.concat(stones.slice(0, TOP_STONES), stones.slice(-TOP_STONES));
        };
    }

    /**
     * 回合开头决定是否用技能：在对局上逐个试用可用技能（含二段选择），走完回合后打分，
     * 比直接下 move 明显更好才用。
     * @returns {{skill:string, targets:{row:number,col:number}[]}|null} targets 按顺序点选
     */
    function chooseSkill(game, player, { move = null, timeLimit = 400 } = {}) {
        if (game.isOver() || game.state.current !== player || game.turnDirty || game.state.pending || game.armed) return null;
        const skills = game.state.pool.map(id => SKILL_MAP.get(id)).filter(skill => !game.skillBlockReason(skill, player));
        if (skills.length === 0) return null;
        move = move || chooseMove(game, player);
        const deadline = Date.now() + timeLimit;
        let bestValue = game.trial(() => finish(game, player, move)) + MIN_GAIN;
        if (bestValue > WIN) return null; // 直接落子就赢
        let best = null;
        const pick = targetPicker(game, player);

        // 已用出技能：二段选择就展开候选目标，否则走完回合打分
        const search = (skill, targets) => {
            if (Date.now() > deadline) return;
            if (game.state.pending) {
                for (const t of pick(game.pendingTargets())) {
                    game.trial(() => game.clickCell(t.row, t.col) && search(skill, [...targets, t]));
                }
                return;
            }
            const value = finish(game, player, move);
            if (value > bestValue) {
                bestValue = value;
                best = { skill: skill.id, targets };
            }
        };
        // 无目标的先算，二段选择的最后算：超时时先保证推演量小的技能
        const order = skill => (skill.target === Target.NONE ? 0 : skill.pendingTargets ? 2 : 1);
        for (const skill of skills.sort((a, b) => order(a) - order(b))) {
            const firsts = skill.target === Target.NONE ? [null] : pick(game.targetCells(skill.target, player));
            for (const t of firsts) {
                game.trial(() => game.selectSkill(skill.id) && (!t || game.clickCell(t.row, t.col)) && search(skill, t ? [t] : []));
            }
        }
        return best;
    }

    /**
     * AI 走一步：用一次技能（含全部点选）或落一子。轮到 AI 时反复调用，直到回合结束。
     * 只在回合开头考虑技能，所以每回合最多用一次；技能执行失败就撤销并照常落子，不会卡住回合。
     * @returns {{skill:string, targets:object[]}|{move:{row:number,col:number}}|null}
     */
    function act(game, player, { timeLimit = 800 } = {}) {
        if (game.isOver() || game.state.current !== player) return null;
        if (game.state.pending || game.armed) game.cancel(); // 正常不会出现，防止点选被误当成技能目标
        const move = chooseMove(game, player, { timeLimit });
        const plan = chooseSkill(game, player, { move, timeLimit: timeLimit / 2 });
        if (plan) {
            if (game.selectSkill(plan.skill) && plan.targets.every(t => game.clickCell(t.row, t.col)) && !game.state.pending) {
                return plan;
            }
            game.cancel();
        }
        for (const p of [move, ...game.legalMoves(player)]) {
            if (p && game.clickCell(p.row, p.col)) return { move: p };
        }
        return null;
    }

    return { chooseMove, chooseSkill, act, Engine, shapeTable, SHAPES: { NONE, ONE, TWO, OPEN_TWO, THREE, OPEN_THREE, FOUR, OPEN_FOUR, FIVE } };
})();
