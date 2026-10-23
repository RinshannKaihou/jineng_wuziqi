const test = require('node:test');
const assert = require('node:assert/strict');
const { load, seeded, setup } = require('./load.js');

const api = load();

/** 选中技能并（可选）点击目标 */
function cast(game, id, ...cells) {
    const ok = game.selectSkill(id);
    assert.ok(ok, `${id} 无法选中：${game.message}`);
    for (const [row, col] of cells) assert.ok(game.clickCell(row, col), `${id} 点击 (${row},${col}) 失败：${game.message}`);
}

test('技能表：36 个技能、id 唯一、每类 6 个、字段齐全', () => {
    assert.equal(api.SKILLS.length, 36);
    assert.equal(new Set(api.SKILLS.map(s => s.id)).size, 36);
    const byCategory = {};
    for (const skill of api.SKILLS) {
        byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
        for (const field of ['name', 'icon', 'description', 'target']) assert.ok(skill[field], `${skill.id}.${field}`);
        assert.ok(Number.isInteger(skill.cost) && Number.isInteger(skill.cooldown), skill.id);
        assert.equal(typeof skill.use, 'function');
        if (skill.pendingTargets || skill.resolve) {
            assert.equal(typeof skill.pendingTargets, 'function', skill.id);
            assert.equal(typeof skill.resolve, 'function', skill.id);
        }
    }
    assert.deepEqual(Object.values(byCategory), [6, 6, 6, 6, 6, 6]);
});

test('正常模式：扣能量、进入共享冷却，冷却与能量不足时不能用', () => {
    const game = setup(api, [], { current: 'black', testMode: false });
    game.state.pool = ['s4'];
    game.state.cooldowns = { s4: 0 };
    game.state.energy.black = 1;
    cast(game, 's4'); // 以逸待劳：-1 +3，跳过回合
    assert.equal(game.state.energy.black, 3);
    assert.equal(game.state.current, 'white');
    assert.equal(game.state.cooldowns.s4, 1, '回合结束时冷却已减一');
    assert.equal(game.selectSkill('s4'), false, '冷却共享，对手也不能用');
    game.state.cooldowns.s4 = 0;
    assert.equal(game.selectSkill('s4'), false, '白方能量不足');
});

test('指桑骂槐：不再报错，周围对方棋子下回合不计入连珠', () => {
    const game = setup(api, ['OOOO.', '.....'], { current: 'black' });
    cast(game, 'm2', [1, 1]);
    assert.equal(game.state.board[1][1], 'black');
    assert.equal(game.state.current, 'white', '指桑骂槐算作本回合落子');
    assert.ok(game.isNeutral(0, 1));
    game.clickCell(0, 4); // 白方想成五，但 (0,0)~(0,2) 被削弱
    assert.equal(game.state.winner, null);
    assert.equal(game.isNeutral(0, 1), false, '对方回合结束后恢复');
});

test('釜底抽薪：只能移除孤立子（原先永远失败），本回合无法获胜', () => {
    const game = setup(api, ['XXXX.', '.....', 'OO..O'], { current: 'black' });
    game.selectSkill('c1');
    assert.equal(game.clickCell(2, 0), false);
    assert.match(game.message, /孤立子/);
    assert.ok(game.clickCell(2, 4));
    assert.equal(game.state.board[2][4], null);
    game.clickCell(0, 4); // 成五也不算胜
    assert.equal(game.state.winner, null);
    assert.equal(game.state.current, 'white');
});

test('苦肉计：落下的棋子不能被对方移除或转化，可被己方移动', () => {
    const game = setup(api, ['OO'], { current: 'black' });
    cast(game, 'd4', [5, 5]);
    assert.ok(game.isImmune(5, 5));
    game.selectSkill('c1');
    assert.equal(game.clickCell(5, 5), false);
    assert.match(game.message, /苦肉计/);
    game.cancel();
    game.clickCell(9, 9);
    cast(game, 'c3', [5, 5], [6, 6]); // 黑方自己挪动免疫子，免疫跟着走
    assert.ok(game.isImmune(6, 6));
});

test('借尸还魂：复制对方上一个技能（原先没有任何效果）', () => {
    const game = setup(api, ['X..', '...', 'O..'], { current: 'black' });
    cast(game, 'e1', [0, 1]);       // 黑方：无中生有
    game.clickCell(0, 4);
    cast(game, 'a2', [2, 1]);       // 白方：复制无中生有
    const phantom = game.phantomAt(2, 1);
    assert.ok(phantom);
    assert.equal(phantom.player, 'white');
    assert.equal(game.state.lastSkill.white, 'a2');
});

test('声东击西：落两颗虚像子，自己下回合一颗消失、一颗转实', () => {
    const game = setup(api, [], { current: 'black' });
    cast(game, 's6', [7, 7], [7, 8]);
    assert.equal(game.state.current, 'white');
    assert.equal(game.state.phantoms.filter(p => p.soundEast).length, 2);
    game.clickCell(0, 0);
    assert.equal(game.state.current, 'black');
    assert.equal(game.state.phantoms.length, 0);
    const real = [game.stoneAt(7, 7), game.stoneAt(7, 8)].filter(Boolean);
    assert.deepEqual(real, ['black']);
});

test('连环计：连落两子，下回合能量 -1', () => {
    const game = setup(api, [], { current: 'black', testMode: false });
    game.state.pool = ['d5'];
    game.state.cooldowns = { d5: 0 };
    game.state.energy.black = 6;
    cast(game, 'd5', [7, 7]);
    assert.equal(game.state.current, 'black');
    game.clickCell(7, 8);
    assert.equal(game.state.current, 'white');
    assert.equal(game.state.energy.black, 3); // 6 - 5 + 2
    game.clickCell(0, 0);
    assert.equal(game.state.energy.black, 2);
});

test('围魏救赵 / 关门捉贼：对手只能在指定位置落子', () => {
    const game = setup(api, ['', '', '.OOO.'], { current: 'black' });
    cast(game, 's2');
    game.clickCell(10, 10);
    assert.equal(game.clickCell(7, 7), false);
    assert.ok(game.clickCell(2, 4));

    cast(game, 'c4', [12, 12]);
    game.clickCell(0, 0);
    const legal = game.legalMoves();
    assert.ok(legal.length > 0 && legal.every(p => Math.abs(p.row - 12) <= 1 && Math.abs(p.col - 12) <= 1));
});

test('空城计：区域内双方都不能落子，持续到对方回合结束', () => {
    const game = setup(api, [], { current: 'black' });
    cast(game, 'd2', [7, 7]);
    assert.equal(game.clickCell(7, 7), false);
    game.clickCell(0, 0);
    assert.equal(game.clickCell(6, 6), false);
    game.clickCell(0, 1);
    assert.ok(game.clickCell(7, 7));
});

test('李代桃僵 / 趁火打劫：需要对方有四连', () => {
    const game = setup(api, ['X', '', 'OOOO'], { current: 'black' });
    cast(game, 'e5', [0, 0], [2, 1]);
    assert.equal(game.state.board[0][0], null);
    assert.equal(game.state.board[2][1], null);

    const none = setup(api, ['X', '', 'OOO'], { current: 'black' });
    assert.equal(none.selectSkill('e5'), false);
    assert.equal(none.selectSkill('s5'), false);
});

test('欲擒故纵 / 抛砖引玉：限制对手落点', () => {
    const game = setup(api, [], { current: 'black' });
    cast(game, 'a4', [7, 7]);
    assert.equal(game.state.current, 'white');
    assert.equal(game.legalMoves().length, 3);

    const brick = setup(api, [], { current: 'black' });
    cast(brick, 'a5', [7, 7]);
    assert.equal(brick.state.board[7][7], 'black');
    assert.equal(brick.legalMoves().length, 8);
});

test('随机对局压力测试：任意技能组合不抛异常且状态自洽', () => {
    const random = seeded(42);
    const pick = list => list[Math.floor(random() * list.length)];
    for (let round = 0; round < 150; round++) {
        const game = new api.GomokuGame({ random, testMode: round % 2 === 0 });
        for (let step = 0; step < 120 && !game.isOver(); step++) {
            const roll = random();
            if (roll < 0.3) {
                game.selectSkill(pick(game.state.pool));
            } else if (roll < 0.33) {
                game.cancel();
            } else if (roll < 0.35) {
                game.undo();
            } else {
                const targets = game.state.pending ? game.pendingTargets() : game.allCells();
                const cell = pick(targets);
                game.clickCell(cell.row, cell.col);
            }
            const s = game.state;
            for (const p of s.phantoms) assert.equal(s.board[p.row][p.col], null, '幻想子不会与真子重叠');
            for (const player of ['black', 'white']) {
                assert.ok(s.energy[player] >= 0 && s.energy[player] <= s.maxEnergy);
            }
            assert.ok(s.turn.placementsLeft >= 0 || s.pending);
            assert.ok(game.legalMoves().length > 0 || game.isOver());
        }
    }
});
