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
