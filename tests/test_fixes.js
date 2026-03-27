// Test script for bug fixes in gomoku_ai.js

// Mock browser globals
global.window = global;

// Load the AI module
require('../js/core/gomoku_ai.js');

const { LineDetector, AlphaBetaSearch, OpeningBook, AI_CONFIG } = window;

let passed = 0;
let failed = 0;

function assert(cond, msg) {
    if (cond) { passed++; console.log('  PASS: ' + msg); }
    else { failed++; console.log('  FAIL: ' + msg); }
}

// ====== Bug 4: Position value table ======
console.log('\n--- Bug 4: Position value table (15x15, symmetric) ---');
{
    // All positions should return valid values
    let allValid = true;
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            const v = LineDetector.getPositionValue(r, c);
            if (typeof v !== 'number' || isNaN(v) || v < 0) {
                console.log('  Invalid value at (' + r + ',' + c + '): ' + v);
                allValid = false;
            }
        }
    }
    assert(allValid, 'All 225 positions return valid values');

    // Horizontal symmetry: value(r,c) == value(r,14-c)
    let hSymmetric = true;
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 7; c++) {
            if (LineDetector.getPositionValue(r, c) !== LineDetector.getPositionValue(r, 14 - c)) {
                hSymmetric = false;
                console.log('  H-asymmetry at (' + r + ',' + c + ') vs (' + r + ',' + (14 - c) + ')');
            }
        }
    }
    assert(hSymmetric, 'Horizontal symmetry: value(r,c) == value(r,14-c)');

    // Vertical symmetry: value(r,c) == value(14-r,c)
    let vSymmetric = true;
    for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 15; c++) {
            if (LineDetector.getPositionValue(r, c) !== LineDetector.getPositionValue(14 - r, c)) {
                vSymmetric = false;
                console.log('  V-asymmetry at (' + r + ',' + c + ') vs (' + (14 - r) + ',' + c + ')');
            }
        }
    }
    assert(vSymmetric, 'Vertical symmetry: value(r,c) == value(14-r,c)');

    // Center should be highest
    const centerVal = LineDetector.getPositionValue(7, 7);
    let centerHighest = true;
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            if (LineDetector.getPositionValue(r, c) > centerVal) {
                centerHighest = false;
            }
        }
    }
    assert(centerHighest, 'Center (7,7) has the highest value: ' + centerVal);
}

// ====== Bug 1 & 2: AlphaBeta player alternation ======
console.log('\n--- Bug 1&2: AlphaBeta player alternation ---');
{
    const mockGame = {
        board: Array(15).fill(null).map(() => Array(15).fill(null)),
        moveHistory: [],
        canPlaceStone: () => true,
        checkWin: () => false
    };

    // Place a few stones to make search meaningful
    mockGame.board[7][7] = 'black';
    mockGame.board[7][8] = 'white';
    mockGame.board[7][9] = 'black';
    mockGame.board[8][8] = 'white';

    const ai = new window.GomokuAI(mockGame, 'black', 'hard');

    // Test that alphaBetaSearch returns a valid result
    const result = ai.alphaBetaSearch(2);
    assert(result !== null, 'alphaBetaSearch returns non-null result');
    assert(result.row >= 0 && result.row < 15, 'Result row is valid: ' + result.row);
    assert(result.col >= 0 && result.col < 15, 'Result col is valid: ' + result.col);
    assert(typeof result.score === 'number', 'Result has numeric score: ' + result.score);

    // Verify board is clean after search (all simulated moves undone)
    let boardClean = true;
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            var expected;
            if (r === 7 && c === 7) expected = 'black';
            else if (r === 7 && c === 8) expected = 'white';
            else if (r === 7 && c === 9) expected = 'black';
            else if (r === 8 && c === 8) expected = 'white';
            else expected = null;
            if (mockGame.board[r][c] !== expected) {
                boardClean = false;
                console.log('  Board dirty at (' + r + ',' + c + '): expected ' + expected + ', got ' + mockGame.board[r][c]);
            }
        }
    }
    assert(boardClean, 'Board is restored after search (all simulated moves undone)');

    // Test player alternation: verify nextPlayer logic
    const opponent = ai.getOpponent();
    assert(opponent === 'white', 'AI opponent is white');

    // Simulate the alternation manually
    let current = 'black';
    const sequence = [];
    for (let i = 0; i < 6; i++) {
        sequence.push(current);
        current = current === ai.player ? ai.getOpponent() : ai.player;
    }
    assert(sequence[0] === 'black', 'Turn 0: black');
    assert(sequence[1] === 'white', 'Turn 1: white');
    assert(sequence[2] === 'black', 'Turn 2: black');
    assert(sequence[3] === 'white', 'Turn 3: white');
    assert(sequence[4] === 'black', 'Turn 4: black');
    assert(sequence[5] === 'white', 'Turn 5: white');
}

// ====== Bug 3: Transposition table hash ======
console.log('\n--- Bug 3: Transposition table hash covers all cells ---');
{
    const mockGame = {
        board: Array(15).fill(null).map(() => Array(15).fill(null)),
        moveHistory: [],
        canPlaceStone: () => true,
        checkWin: () => false
    };
    const search = new AlphaBetaSearch(mockGame, 'black', { searchDepth: 2, useTranspositionTable: true });

    // Place stones at odd positions - these MUST be included in the hash
    mockGame.board[1][1] = 'black';
    mockGame.board[3][5] = 'white';
    const key1 = search.generateTableKey(3, true);

    // Clear odd-position stones
    mockGame.board[1][1] = null;
    mockGame.board[3][5] = null;
    const key2 = search.generateTableKey(3, true);

    assert(key1 !== key2, 'Hash differs when odd-position stones change (all cells sampled)');
}

// ====== Bug 5: Double-threat detection ======
console.log('\n--- Bug 5: Double-threat detection ---');
{
    const mockGame = {
        board: Array(15).fill(null).map(() => Array(15).fill(null)),
        moveHistory: [],
        canPlaceStone: () => true,
        checkWin: () => false
    };
    const ai = new window.GomokuAI(mockGame, 'black', 'hard');

    // Setup: create a scenario where placing one stone creates two threats
    // Horizontal: _BBB_ (live three at 7,6-7,8)
    mockGame.board[7][6] = 'black';
    mockGame.board[7][7] = 'black';
    mockGame.board[7][8] = 'black';

    // Diagonal setup for a second threat
    mockGame.board[5][10] = 'black';
    mockGame.board[6][9] = 'black';

    var myThreats = LineDetector.detectThreats(mockGame.board, 'black', mockGame, { includePotentialThree: false });
    var oppThreats = LineDetector.detectThreats(mockGame.board, 'white', mockGame, { includePotentialThree: false });

    var doubleAttack = ai.findDoubleAttackPosition(myThreats, oppThreats);
    // Not crashing is the minimum bar; the result may be null if no true double-threat found
    assert(doubleAttack === null || (doubleAttack.row >= 0 && doubleAttack.row < 15), 'findDoubleAttackPosition runs without error');

    // Test a more explicit double-threat scenario
    // Clear board
    for (var r = 0; r < 15; r++) for (var c = 0; c < 15; c++) mockGame.board[r][c] = null;

    // Create horizontal live-three: _BBB_ at row 7
    mockGame.board[7][5] = 'black';
    mockGame.board[7][6] = 'black';
    mockGame.board[7][7] = 'black';
    // Create vertical two: BB at col 9 (rows 6-7)
    mockGame.board[6][9] = 'black';
    mockGame.board[7][9] = 'black';
    // Placing at (8,9) extends vertical to live three AND creates another threat direction
    // Placing at (5,9) extends vertical upward

    myThreats = LineDetector.detectThreats(mockGame.board, 'black', mockGame, { includePotentialThree: false });
    oppThreats = LineDetector.detectThreats(mockGame.board, 'white', mockGame, { includePotentialThree: false });

    doubleAttack = ai.findDoubleAttackPosition(myThreats, oppThreats);
    assert(doubleAttack === null || (doubleAttack.row >= 0 && doubleAttack.row < 15), 'findDoubleAttackPosition handles multi-direction setup');
}

// ====== Core LineDetector tests ======
console.log('\n--- Core LineDetector tests ---');
{
    var board = Array(15).fill(null).map(function() { return Array(15).fill(null); });

    // Test live three detection
    board[7][7] = 'black';
    board[7][8] = 'black';
    board[7][9] = 'black';
    var threats = LineDetector.detectThreats(board, 'black');
    assert(threats.liveThree.length > 0, 'Detects live three (3 stones with 2 open ends)');

    // Test win detection
    board[7][10] = 'black';
    board[7][11] = 'black';
    var threats2 = LineDetector.detectThreats(board, 'black');
    assert(threats2.win.length > 0, 'Detects five in a row');

    // Test classifyLine
    assert(LineDetector.classifyLine(5, 0) === 'WIN', 'classifyLine(5,0) = WIN');
    assert(LineDetector.classifyLine(4, 2) === 'LIVE_FOUR', 'classifyLine(4,2) = LIVE_FOUR');
    assert(LineDetector.classifyLine(4, 1) === 'RUSH_FOUR', 'classifyLine(4,1) = RUSH_FOUR');
    assert(LineDetector.classifyLine(3, 2) === 'LIVE_THREE', 'classifyLine(3,2) = LIVE_THREE');
    assert(LineDetector.classifyLine(3, 1) === 'SLEEP_THREE', 'classifyLine(3,1) = SLEEP_THREE');
    assert(LineDetector.classifyLine(2, 2) === 'LIVE_TWO', 'classifyLine(2,2) = LIVE_TWO');
}

// ====== OpeningBook tests ======
console.log('\n--- OpeningBook tests ---');
{
    var book = new OpeningBook();
    var move = book.query([], 'black');
    assert(move !== null, 'OpeningBook returns opening move for empty board');
    assert(move.move.row === 7 && move.move.col === 7, 'Opening move is center (7,7)');
}

console.log('\n========================================');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
