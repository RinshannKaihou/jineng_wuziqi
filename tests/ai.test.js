const test = require('node:test');
const assert = require('node:assert/strict');
const { load, seeded, setup } = require('./load.js');

const api = load();
const { SHAPES, shapeTable } = api.GomokuAI;
// 结果对象来自 vm 上下文，展开成本地对象才能用 deepStrictEqual 比较
const think = (game, player) => ({ ...api.GomokuAI.chooseMove(game, player, { timeLimit: 1500 }) });

/** 把 9 格字符串（中心为 X）编码成棋型表下标 */
function shapeOf(line) {
    let index = 0, m = 1;
    [...line].forEach((ch, i) => {
        if (i === 4) return;
        index += (ch === 'X' ? 1 : ch === '.' ? 0 : 2) * m;
        m *= 3;
    });
    return shapeTable[index];
}

test('棋型表：连续与跳跃棋型都能识别', () => {
    assert.equal(shapeOf('..XXXXX..'), SHAPES.FIVE);
    assert.equal(shapeOf('...XXXX..'), SHAPES.OPEN_FOUR);
    assert.equal(shapeOf('..OXXXX..'), SHAPES.FOUR);
    assert.equal(shapeOf('.XX.XX...'), SHAPES.FOUR);       // 跳冲四 XX_XX
    assert.equal(shapeOf('X.XXX.X..'), SHAPES.OPEN_FOUR);  // X_XXX_X：两个成五点
    assert.equal(shapeOf('...XXX...'), SHAPES.OPEN_THREE);
    assert.equal(shapeOf('..X.XX...'), SHAPES.OPEN_THREE); // 跳活三
    assert.equal(shapeOf('..OXXX..O'), SHAPES.THREE);
    assert.equal(shapeOf('O.XXX.O..'), SHAPES.THREE);    // 两头都只剩一格，成不了活四
    assert.equal(shapeOf('...XX....'), SHAPES.OPEN_TWO);
});

test('空棋盘走天元', () => {
    const game = setup(api, [], { current: 'black' });
    assert.deepEqual(think(game, 'black'), { row: 7, col: 7 });
});

test('能成五就成五（优先于防守）', () => {
    const game = setup(api, [
        '...............',
        '.OOOO..........',
        '...............',
        '.XXXX..........',
    ], { current: 'white' });
    const move = think(game, 'white');
    assert.ok(move.row === 1 && (move.col === 0 || move.col === 5));
});

test('堵冲四，包括跳冲四 XX_XX', () => {
    const game = setup(api, ['', '', '', '', '', '', '', '....XX.XX......', '...O...........'], { current: 'white' });
    assert.deepEqual(think(game, 'white'), { row: 7, col: 6 });
});

test('堵活三，包括跳活三', () => {
    const open = setup(api, ['', '', '', '', '', '', '', '.....XXX.......', '......O........'], { current: 'white' });
    const a = think(open, 'white');
    assert.ok(a.row === 7 && [4, 8].includes(a.col), `活三应堵两端，实际 ${JSON.stringify(a)}`);

    const split = setup(api, ['', '', '', '', '', '', '', '.....X.XX......', '......O....O...'], { current: 'white' });
    const b = think(split, 'white');
    assert.ok(b.row === 7 && [4, 6, 9].includes(b.col), `跳活三应堵空位或两端，实际 ${JSON.stringify(b)}`);
});

test('自己有活三且对方无四时走成活四', () => {
    const game = setup(api, ['', '', '', '', '', '', '', '.....XXX.......', '.....OO........'], { current: 'black' });
    const move = think(game, 'black');
    assert.ok(move.row === 7 && [4, 8].includes(move.col));
});

test('找到 VCF：连续冲四取胜', () => {
    // 黑方：(5,5)(5,6)(5,7) 被白子堵住一头，(6,8)(7,8)(8,8) 同理；冲四 (5,8) 同时形成两个四
    const game = setup(api, [
        '...............',
        '...............',
        '...............',
        '...............',
        '........O......',
        '....OXXX.......',
        '........X......',
        '........X......',
        '........X......',
    ], { current: 'black' });
    const move = think(game, 'black');
    game.clickCell(move.row, move.col);
    // 无论白方怎么应，黑方最多再走几步就赢
    for (let i = 0; i < 8 && !game.isOver(); i++) {
        const reply = think(game, game.state.current);
        game.clickCell(reply.row, reply.col);
    }
    assert.equal(game.state.winner, 'black');
});

test('只在合法位置落子（关门捉贼等限制）', () => {
    const game = setup(api, ['', '', '', '', '', '', '', '.....XXX.......'], { current: 'white' });
    game.restrict('white', [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }], '关门捉贼');
    const move = think(game, 'white');
    assert.ok(game.isLegalMove(move.row, move.col), JSON.stringify(move));
});

test('幻想子会被当作棋子考虑', () => {
    const game = setup(api, ['', '', '', '', '', '', '', '.....XXX.......'], { current: 'white' });
    game.addPhantom(7, 8, 'black', 3); // 黑方实际已是活四之势的冲四
    const move = think(game, 'white');
    assert.ok(move.row === 7 && [4, 9].includes(move.col), JSON.stringify(move));
});

test('对随机落子的对手稳定获胜', () => {
    const random = seeded(7);
    for (let round = 0; round < 6; round++) {
        const game = new api.GomokuGame({ random });
        const aiSide = round % 2 === 0 ? 'white' : 'black';
        while (!game.isOver()) {
            const side = game.state.current;
            let move;
            if (side === aiSide) {
                move = api.GomokuAI.chooseMove(game, side, { timeLimit: 200 });
            } else {
                const near = game.legalMoves().filter(p => Math.abs(p.row - 7) <= 3 && Math.abs(p.col - 7) <= 3);
                move = near[Math.floor(random() * near.length)] || game.legalMoves()[0];
            }
            assert.ok(game.clickCell(move.row, move.col), game.message);
        }
        assert.equal(game.state.winner, aiSide);
    }
});

// ==================== 计策 ====================

/** 正常模式的局面：技能池只含 pool，冷却清零，白方能量 energy，黑方能量 5 */
function normalGame(rows, pool, energy, current = 'white') {
    const game = setup(api, rows, { current, testMode: false });
    game.state.pool = pool;
    game.state.cooldowns = Object.fromEntries(pool.map(id => [id, 0]));
    game.state.energy = { black: 5, white: energy };
    return game;
}

/** 让 player 走完一整个回合，返回用过的技能；步数超限说明回合卡住了 */
function playTurn(game, player, timeLimit = 300) {
    const used = [];
    for (let step = 0; !game.isOver() && game.state.current === player; step++) {
        assert.ok(step < 6, `回合没有结束：${game.message}`);
        const action = api.GomokuAI.act(game, player, { timeLimit });
        assert.ok(action, `AI 无法行动：${game.message}`);
        if (action.skill) used.push(action.skill);
    }
    return used;
}

/** 轮到 player 时，这一手能否直接成五（不改变对局） */
function canWinNow(game, player) {
    assert.equal(game.state.current, player);
    return game.trial(() => {
        const move = api.GomokuAI.chooseMove(game, player, { timeLimit: 300 });
        return game.clickCell(move.row, move.col) && game.state.winner === player;
    });
}

const stonesOf = (game, player) => game.stonesOf(player).length;

// 黑方活四：白方只能堵一头
const OPEN_FOUR = ['', '', '', '', '', '', '', '...XXXX........', '...O..O........'];
// 白方活三：再落两子即成五
const WHITE_THREE = ['', '', '', '', '', '', '', '....OOO........', '....XX.........', '.........X'];

test('计策：对方活四堵不住时用趁火打劫 / 李代桃僵，回合结束后对方无法直接成五', () => {
    for (const id of ['s5', 'e5']) {
        const game = normalGame(OPEN_FOUR, [id], 3);
        const onlyBlock = game.trial(() => {
            const move = api.GomokuAI.chooseMove(game, 'white', { timeLimit: 300 });
            game.clickCell(move.row, move.col);
            return canWinNow(game, 'black');
        });
        assert.equal(onlyBlock, true, '只落子堵不住');
        assert.deepEqual(playTurn(game, 'white'), [id]);
        assert.equal(game.state.current, 'black');
        assert.equal(game.state.cooldowns[id], api.SKILL_MAP.get(id).cooldown - 1, '共享冷却已生效');
        assert.equal(canWinNow(game, 'black'), false, `${id} 之后黑方仍能成五`);
    }
});

test('计策：只差一步取胜时用连环计 / 无中生有当回合成五', () => {
    for (const id of ['d5', 'e1']) {
        const game = normalGame(WHITE_THREE, [id], 5);
        assert.deepEqual(playTurn(game, 'white'), [id]);
        assert.equal(game.state.winner, 'white');
    }
});

test('计策：已成必胜之势而对方还能用技能自救时，先用隔岸观火封住对方', () => {
    const game = normalGame(WHITE_THREE, ['e3', 's5'], 2);
    assert.deepEqual(playTurn(game, 'white'), ['e3']);
    assert.ok(game.turn.sealed, '黑方本回合技能被封印');
    assert.equal(game.state.winner, null);
});

// 平稳局面：双方都没有三连以上的棋型
const QUIET = ['', '', '', '', '', '', '.......X.......', '......XO.......', '.....O.X.......'];

test('计策：能量不够时蓄能——局面平稳用打草惊蛇（照常落子），被困在角落时用以逸待劳', () => {
    const calm = normalGame(QUIET, ['a1', 's5', 'a6'], 1);
    assert.deepEqual(playTurn(calm, 'white'), ['a1']);
    assert.equal(stonesOf(calm, 'white'), 3, '打草惊蛇不耽误落子');
    assert.equal(calm.state.energy.white, 1 - 1 + 3 + 1);
    assert.ok(calm.state.sealNext.white, '白方下回合技能被封');

    const cornered = normalGame(QUIET, ['s4', 's5', 'a6'], 1);
    cornered.restrict('white', [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }], '关门捉贼');
    assert.deepEqual(playTurn(cornered, 'white'), ['s4']);
    assert.equal(stonesOf(cornered, 'white'), 2, '以逸待劳跳过落子');
    assert.equal(cornered.state.energy.white, 1 - 1 + 3);

    // 反例：能量已经够用，或者这一手棋有实际价值，就不蓄能
    assert.deepEqual(playTurn(normalGame(QUIET, ['a1', 's5', 'a6'], 8), 'white'), []);
    assert.deepEqual(playTurn(normalGame(QUIET, ['s4', 's5', 'a6'], 1), 'white'), []);
});

test('计策：能量不足、冷却中、被封印时不用技能，照常落子结束回合', () => {
    const cases = {
        能量不足: game => { game.state.energy.white = 2; },
        冷却中: game => { game.state.cooldowns.s5 = 1; },
        被封印: game => { game.state.turn.sealed = '隔岸观火'; },
    };
    for (const [name, prepare] of Object.entries(cases)) {
        const game = normalGame(OPEN_FOUR, ['s5'], 3);
        prepare(game);
        const energy = game.state.energy.white;
        assert.deepEqual(playTurn(game, 'white'), [], name);
        assert.equal(stonesOf(game, 'white'), 3, `${name}：落了一子`);
        assert.equal(game.state.energy.white, energy + 1, `${name}：没有扣能量`);
        assert.equal(game.state.current, 'black', name);
    }
});

test('计策：不会用推移类技能替对方连成五', () => {
    // 黑四贴上边、左端被堵，成五点 (0,7) 右侧也是白子；把 (1,7) 的黑子往上推就替黑方补成两头堵死的五连
    const game = normalGame(['..OXXXX.O......', '...OOXOX.......'], ['e6'], 5);
    playTurn(game, 'white');
    assert.equal(game.hasFive('black'), false);
    assert.equal(canWinNow(game, 'black'), false);
});

test('计策：推演不会改变对局', () => {
    const game = normalGame(OPEN_FOUR, ['s5', 'e5', 'c5', 'd2', 'c4', 'a2', 's1'], 10);
    const before = { state: game.snapshot(), history: game.history.length };
    api.GomokuAI.chooseSkill(game, 'white', { timeLimit: 300 });
    assert.equal(game.snapshot(), before.state);
    assert.equal(game.history.length, before.history);
    assert.equal(game.armed, null);
    assert.equal(game.takeEffects().length, 0);
});

test('计策：随机技能池整局对弈不会卡住回合（对手随机乱用技能）', () => {
    const random = seeded(11);
    const pick = list => list[Math.floor(random() * list.length)];
    for (let round = 0; round < 8; round++) {
        const game = new api.GomokuGame({ random, testMode: round % 4 === 3 });
        const aiSide = round % 2 === 0 ? 'white' : 'black';
        for (let turn = 0; turn < 80 && !game.isOver(); turn++) {
            const side = game.state.current;
            if (side === aiSide) {
                playTurn(game, side, 60);
                continue;
            }
            // 对手：随机用技能、随机点格子，最后保底落子
            for (let tries = 0; tries < 6 && game.state.current === side && !game.isOver(); tries++) {
                if (random() < 0.3) game.selectSkill(pick(game.state.pool));
                const cell = pick(game.state.pending ? game.pendingTargets() : game.legalMoves());
                game.clickCell(cell.row, cell.col);
            }
            if (game.state.current === side && !game.isOver()) {
                game.cancel();
                const cell = game.legalMoves()[0];
                assert.ok(game.clickCell(cell.row, cell.col), game.message);
            }
        }
    }
});
