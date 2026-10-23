// ==================== 棋盘常量与通用工具 ====================
// 纯函数，不依赖 DOM，供规则、技能、AI 共用。

const BOARD_SIZE = 15;
const CENTER = 7;
const MAX_ENERGY = 10;
const ENERGY_PER_MOVE = 1;

const PLAYER_NAMES = { black: '黑方', white: '白方' };

/** 连线方向（正向），反向用 -dr, -dc */
const LINE_DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
/** 周围 8 格 */
const NEIGHBORS_8 = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
/** 上下左右 4 格 */
const NEIGHBORS_4 = [[0, 1], [0, -1], [1, 0], [-1, 0]];

function inBounds(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function opponentOf(player) {
    return player === 'black' ? 'white' : 'black';
}

function playerName(player) {
    return PLAYER_NAMES[player];
}

function sameCell(a, b) {
    return a.row === b.row && a.col === b.col;
}

function cellKey(row, col) {
    return `${row},${col}`;
}

function createEmptyBoard() {
    return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

/** 以 (row, col) 为中心、半径 radius 的方形区域（裁剪到棋盘内） */
function squareArea(row, col, radius = 1) {
    const cells = [];
    for (let r = row - radius; r <= row + radius; r++) {
        for (let c = col - radius; c <= col + radius; c++) {
            if (inBounds(r, c)) cells.push({ row: r, col: c });
        }
    }
    return cells;
}

/** 相邻格子（只含棋盘内） */
function neighborCells(row, col, dirs = NEIGHBORS_8) {
    return dirs
        .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
        .filter(p => inBounds(p.row, p.col));
}

/**
 * 从 (row, col) 沿 (dr, dc) 方向数连续的 owner(r, c) === player 的格子（不含起点）
 * owner 默认读取 board 上的真实棋子。
 */
function countDirection(owner, row, col, dr, dc, player) {
    let count = 0;
    let r = row + dr, c = col + dc;
    while (inBounds(r, c) && owner(r, c) === player) {
        count++;
        r += dr;
        c += dc;
    }
    return count;
}

/** 洗牌（Fisher–Yates），random 可注入以便测试 */
function shuffle(items, random = Math.random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
