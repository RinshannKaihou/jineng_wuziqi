// 在 Node 中加载浏览器端脚本：与 <script> 标签一样共享同一个全局作用域
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPTS = ['board.js', 'skills.js', 'game.js', 'ai.js'];

function load() {
    const context = vm.createContext({ console });
    for (const file of SCRIPTS) {
        const source = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
        vm.runInContext(source, context, { filename: file });
    }
    return vm.runInContext('({ GomokuGame, GomokuAI, SKILLS, SKILL_MAP, Target, opponentOf })', context);
}

/** 可复现的伪随机数（mulberry32） */
function seeded(seed = 1) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * 用字符画摆棋盘：X 黑，O 白，. 空。行数不足 15 时其余为空。
 * 返回新建的对局（测试模式，全部技能、能量充足）。
 */
function setup(api, rows = [], { current = 'black', testMode = true, random = seeded(1) } = {}) {
    const game = new api.GomokuGame({ testMode, random });
    rows.forEach((line, r) => {
        [...line].forEach((ch, c) => {
            if (ch === 'X') game.state.board[r][c] = 'black';
            if (ch === 'O') game.state.board[r][c] = 'white';
        });
    });
    game.state.current = current;
    game.history = [game.snapshot()];
    return game;
}

module.exports = { load, seeded, setup };
