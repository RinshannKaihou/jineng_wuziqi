const test = require('node:test');
const assert = require('node:assert/strict');
const { load, seeded, setup } = require('./load.js');

const api = load();

test('新局：随机 6-10 个技能，黑方先手，能量为 0', () => {
    for (let seed = 1; seed <= 20; seed++) {
        const game = new api.GomokuGame({ random: seeded(seed) });
        const { pool, current, energy } = game.state;
        assert.ok(pool.length >= 6 && pool.length <= 10);
        assert.equal(new Set(pool).size, pool.length);
        assert.equal(current, 'black');
        assert.deepEqual({ ...energy }, { black: 0, white: 0 });
    }
});

test('落子：加能量、换手、冷却减一', () => {
    const game = new api.GomokuGame({ random: seeded(1) });
    const id = game.state.pool[0];
    game.state.cooldowns[id] = 2;
    assert.ok(game.clickCell(7, 7));
    assert.equal(game.state.board[7][7], 'black');
    assert.equal(game.state.energy.black, 1);
    assert.equal(game.state.current, 'white');
    assert.equal(game.state.cooldowns[id], 1);
    assert.equal(game.clickCell(7, 7), false, '不能落在已有棋子处');
});

test('五连获胜，跳五（XX_XX 补中间）也算', () => {
    const game = setup(api, ['XX.XX', 'OOOO'], { current: 'black' });
    game.clickCell(0, 2);
    assert.equal(game.state.winner, 'black');
    assert.ok(game.isOver());
    assert.equal(game.clickCell(5, 5), false, '结束后不能再落子');
});

test('幻想子计入连珠，中立棋子不计入', () => {
    const game = setup(api, ['XXX'], { current: 'black' });
    game.addPhantom(0, 3, 'black', 3);
    game.clickCell(0, 4);
    assert.equal(game.state.winner, 'black');

    const blocked = setup(api, ['XXXX'], { current: 'black' });
    blocked.neutralize(0, 0, 2);
    blocked.clickCell(0, 4);
    assert.equal(blocked.state.winner, null);
});

test('悔棋：双人模式退回上一回合，并恢复能量', () => {
    const game = new api.GomokuGame({ random: seeded(2) });
    game.clickCell(7, 7);
    game.clickCell(7, 8);
    assert.equal(game.state.current, 'black');
    assert.ok(game.undo());
    assert.equal(game.state.current, 'white');
    assert.equal(game.state.board[7][8], null);
    assert.equal(game.state.energy.white, 0);
    assert.ok(game.undo());
    assert.equal(game.state.board[7][7], null);
    assert.equal(game.canUndo(), false);
});

test('悔棋：本回合用过技能则回到本回合开始（技能效果一并撤销）', () => {
    const game = setup(api, ['XO'], { current: 'black' });
    game.selectSkill('m6'); // 反客为主：交换所有权
    assert.equal(game.state.board[0][0], 'white');
    assert.ok(game.undo());
    assert.equal(game.state.board[0][0], 'black');
    assert.equal(game.state.board[0][1], 'white');
    assert.equal(game.state.current, 'black');
});

test('二段选择可取消：棋子、能量、冷却全部还原', () => {
    const game = setup(api, ['X'], { current: 'black', testMode: false });
    game.state.pool = ['s1'];
    game.state.cooldowns = { s1: 0 };
    game.state.energy.black = 5;
    game.selectSkill('s1');
    game.clickCell(0, 0); // 瞒天过海：先移除己方棋子
    assert.equal(game.state.board[0][0], null);
    assert.equal(game.state.energy.black, 3);
    assert.ok(game.state.pending);
    assert.ok(game.cancel());
    assert.equal(game.state.board[0][0], 'black');
    assert.equal(game.state.energy.black, 5);
    assert.equal(game.state.cooldowns.s1, 0);
    assert.equal(game.state.pending, null);
    assert.equal(game.turnDirty, false, '取消后本回合视为未操作');
});

test('二段选择没有可选目标时技能不生效（不会卡死）', () => {
    const game = setup(api, ['.O.', 'OXO', '.O.'], { current: 'black' });
    game.selectSkill('c2'); // 浑水摸鱼：被四面包围的棋子无处可去
    assert.equal(game.clickCell(1, 1), false);
    assert.equal(game.state.pending, null);
    assert.match(game.message, /没有可选的目标/);
});

test('限定区域全被占满时自动失效，不会无处落子', () => {
    const game = setup(api, [], { current: 'black' });
    game.restrict('black', [{ row: 0, col: 0 }], '测试');
    game.state.board[0][0] = 'white';
    assert.ok(game.legalMoves().length > 200);
    assert.ok(game.clickCell(7, 7));
});

test('隔岸观火只封印对手下一个回合（原先会封两回合）', () => {
    const game = setup(api, [], { current: 'black' });
    game.selectSkill('e3');
    game.clickCell(7, 7);           // 黑方落子，轮到白方
    assert.ok(game.turn.sealed);
    assert.equal(game.selectSkill('s4'), false);
    game.clickCell(0, 0);           // 白方落子
    game.clickCell(7, 8);           // 黑方落子
    assert.equal(game.turn.sealed, null, '白方第二个回合恢复技能');
    assert.ok(game.selectSkill('s4'));
});

test('重玩保留技能池并完全重置状态；测试模式包含全部技能', () => {
    const game = new api.GomokuGame({ random: seeded(5) });
    const pool = game.state.pool.slice();
    game.clickCell(7, 7);
    game.addPhantom(3, 3, 'white', 3);
    game.disguise(7, 7, 3);
    game.newGame({ keepPool: true });
    assert.deepEqual(game.state.pool, pool);
    assert.equal(game.state.phantoms.length, 0);
    assert.equal(game.state.disguised.length, 0);
    assert.equal(game.state.board[7][7], null);

    game.newGame({ testMode: true });
    assert.equal(game.state.pool.length, 36);
    assert.equal(game.state.energy.black, 999);
});

test('同一技能在测试模式下可以连续使用', () => {
    const game = setup(api, [], { current: 'black' });
    assert.ok(game.selectSkill('m3'));
    assert.ok(game.selectSkill('m3'));
});

test('棋盘下满判和', () => {
    const game = setup(api, [], { current: 'black' });
    // 两两交替的图案不会出现五连
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            game.state.board[r][c] = ((Math.floor(c / 2) + r) % 2 === 0) ? 'black' : 'white';
        }
    }
    game.state.board[14][14] = null;
    game.state.current = game.state.board[14][13] === 'black' ? 'white' : 'black';
    game.clickCell(14, 14);
    assert.equal(game.state.winner, null);
    assert.equal(game.state.draw, true);
});

test('trial：试走后对局完全还原（悔棋记录、选中技能、飘字都不变）', () => {
    const game = setup(api, ['XO'], { current: 'black' });
    game.selectSkill('e1');
    const before = { state: game.snapshot(), history: game.history.length, armed: game.armed, dirty: game.turnDirty };
    const result = game.trial(() => {
        game.clickCell(5, 5); // 无中生有生效
        game.clickCell(6, 6); // 落子，回合结束
        return game.state.current;
    });
    assert.equal(result, 'white');
    assert.equal(game.snapshot(), before.state);
    assert.equal(game.history.length, before.history);
    assert.equal(game.armed, before.armed);
    assert.equal(game.turnDirty, before.dirty);
    assert.equal(game.takeEffects().length, 0);
});
