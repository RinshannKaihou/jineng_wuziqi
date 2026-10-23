// ==================== 界面渲染 ====================
// 只读取游戏状态更新 DOM；用户操作通过 handlers 回调交给控制器。

const $ = id => document.getElementById(id);

const keySet = cells => new Set(cells.map(c => cellKey(c.row, c.col)));

class GomokuView {
    /** handlers: { onCell(row, col), onSkill(id), onCancel() } */
    constructor(handlers) {
        this.handlers = handlers;
        this.cells = [];
        this.modalShown = false;
        this.buildBoard();
    }

    buildBoard() {
        const board = $('board');
        board.innerHTML = '';
        const stars = [3, 7, 11];
        for (let row = 0; row < BOARD_SIZE; row++) {
            this.cells[row] = [];
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                if (stars.includes(row) && stars.includes(col)) {
                    cell.classList.add('star-point');
                    const dot = document.createElement('div');
                    dot.className = 'star-dot';
                    cell.appendChild(dot);
                }
                cell.addEventListener('click', () => this.handlers.onCell(row, col));
                cell.addEventListener('contextmenu', event => {
                    event.preventDefault();
                    this.handlers.onCancel();
                });
                board.appendChild(cell);
                this.cells[row][col] = cell;
            }
        }
    }

    render(game, { aiPlayer = null, aiThinking = false } = {}) {
        this.renderBoard(game);
        this.renderPlayers(game);
        this.renderSkills(game);
        this.renderStatus(game, aiPlayer, aiThinking);
        this.renderModal(game);
        this.playEffects(game.takeEffects());
    }

    renderBoard(game) {
        const s = game.state;
        const last = s.moves[s.moves.length - 1];
        const pending = keySet(game.pendingTargets());
        let allowed = new Set(), blocked = new Set();
        if (!s.pending && !game.isOver()) {
            const legal = game.legalMoves();
            const empties = game.emptyCells();
            const legalKeys = keySet(legal);
            blocked = new Set([...keySet(empties)].filter(k => !legalKeys.has(k)));
            if (s.restrictions.some(r => r.player === s.current) && blocked.size > 0) allowed = legalKeys;
        }

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = this.cells[row][col];
                const key = cellKey(row, col);
                cell.classList.toggle('must-place', pending.has(key) || allowed.has(key));
                cell.classList.toggle('forbidden-place', blocked.has(key));
                this.renderStone(game, cell, row, col, last);
            }
        }
    }

    renderStone(game, cell, row, col, last) {
        const stone = game.stoneAt(row, col);
        const phantom = game.phantomAt(row, col);
        const owner = stone || (phantom && phantom.player);
        let el = cell.querySelector('.stone');
        if (!owner) {
            if (el) el.remove();
            return;
        }
        const disguised = stone && game.isDisguised(row, col);
        const color = disguised ? opponentOf(stone) : owner;
        const classes = ['stone', color];
        const notes = [];
        if (phantom) {
            classes.push('phantom');
            notes.push(phantom.soundEast
                ? `声东击西虚像子（${playerName(phantom.player)}）`
                : `幻想子（${playerName(phantom.player)}）剩余${phantom.turns}回合`);
        }
        if (disguised) { classes.push('disguised'); notes.push(`暗度陈仓：实际为${playerName(stone)}`); }
        if (stone && game.isNeutral(row, col)) { classes.push('neutral'); notes.push('中立棋子：不计入连珠'); }
        if (stone && game.isImmune(row, col)) { classes.push('immune'); notes.push('免疫对方的移除、转化、交换'); }
        if (last && last.row === row && last.col === col && stone) classes.push('last-move');

        // 颜色或虚实变化时重建元素（播放落子动画），否则只更新样式
        const identity = `${color}${phantom ? '-phantom' : ''}`;
        if (!el || el.dataset.identity !== identity) {
            if (el) el.remove();
            el = document.createElement('div');
            el.dataset.identity = identity;
            cell.appendChild(el);
        }
        el.className = classes.join(' ');
        el.title = notes.join('；');
    }

    renderPlayers(game) {
        const s = game.state;
        for (const player of ['black', 'white']) {
            $(`${player}-player`).classList.toggle('active', s.current === player && !game.isOver());
            $(`${player}-energy-fill`).style.width = `${(s.energy[player] / s.maxEnergy) * 100}%`;
            $(`${player}-energy-text`).textContent = `${s.energy[player]} / ${s.maxEnergy}`;
        }
    }

    renderSkills(game) {
        const s = game.state;
        $('skill-pool-info').textContent = s.testMode
            ? `🧪 测试模式：全部 ${s.pool.length} 个技能，能量无限，无冷却`
            : `本局随机 ${s.pool.length} 个技能 | 双方共享CD`;

        const container = $('skills-list');
        container.innerHTML = '';
        let lastCategory = '';
        for (const id of s.pool) {
            const skill = SKILL_MAP.get(id);
            if (skill.category !== lastCategory) {
                const header = document.createElement('div');
                header.className = 'skill-category';
                header.textContent = skill.category;
                container.appendChild(header);
                lastCategory = skill.category;
            }
            const item = document.createElement('div');
            item.className = 'skill-item';
            const cooldown = s.testMode ? 0 : s.cooldowns[id];
            const reason = game.skillBlockReason(skill);
            if (game.armed === id) item.classList.add('active');
            if (cooldown > 0) {
                item.classList.add('cooldown');
                item.dataset.cooldown = cooldown;
            } else if (reason) {
                item.classList.add('insufficient');
            }
            item.title = reason || '';
            item.innerHTML = `
                <div class="skill-cost">${skill.cost} 能量</div>
                <div class="skill-name">${skill.icon} ${skill.name}${cooldown > 0 ? ` [CD:${cooldown}]` : ''}</div>
                <div class="skill-desc">${skill.description}</div>`;
            item.addEventListener('click', () => this.handlers.onSkill(id));
            container.appendChild(item);
        }
    }

    renderStatus(game, aiPlayer, aiThinking) {
        const s = game.state;
        const name = playerName(s.current);
        const lines = [];
        if (s.winner) {
            lines.push(`🎉 ${playerName(s.winner)}获胜！`);
        } else if (s.draw) {
            lines.push('🤝 平局！');
        } else if (aiPlayer === s.current) {
            lines.push(`🤖 ${name}（AI）${aiThinking ? '思考中…' : '回合'}`);
        } else {
            lines.push(aiPlayer ? `${name}回合（玩家）` : `${name}回合`);
            const armed = game.armed && SKILL_MAP.get(game.armed);
            if (s.pending) lines.push(`${s.pending.prompt}\n（Esc / 右键取消，能量返还）`);
            else if (armed) lines.push(`已选择 ${armed.icon} ${armed.name}：${TARGET_HINTS[armed.target]}\n（再次点击技能 / Esc / 右键取消）`);
            else if (s.turn.soundEast) lines.push(`🎭 声东击西：请落虚像子（还剩 ${s.turn.placementsLeft} 颗）`);
            else if (s.turn.placementsLeft > 1) lines.push(`还可连续落子 ${s.turn.placementsLeft} 次`);
            else if (game.turnDirty) lines.push('技能已使用，请落子结束回合');
            else lines.push('可直接落子或使用技能');
            lines.push(`能量: ${s.energy[s.current]} / ${s.maxEnergy}`);
            if (s.turn.sealed) lines.push(`🔒 技能被封印（${s.turn.sealed}）`);
        }
        const status = $('game-status');
        status.textContent = lines.join('\n');
        if (game.message) {
            const message = document.createElement('span');
            message.className = 'status-message';
            message.textContent = game.message;
            status.appendChild(message);
        }
    }

    renderControls({ aiEnabled, testMode, canUndo, canCancel }) {
        const ai = $('ai-mode-btn');
        ai.textContent = aiEnabled ? '🤖 AI对战: 开启' : '🤖 AI对战: 关闭';
        ai.classList.toggle('btn-primary', aiEnabled);
        ai.classList.toggle('btn-secondary', !aiEnabled);
        const test = $('test-mode-btn');
        test.textContent = testMode ? '🧪 关闭测试模式' : '🧪 开启测试模式';
        test.classList.toggle('btn-primary', testMode);
        test.classList.toggle('btn-secondary', !testMode);
        $('undo-btn').disabled = !canUndo;
        $('cancel-btn').disabled = !canCancel;
    }

    renderModal(game) {
        const s = game.state;
        const over = game.isOver();
        $('modal').classList.toggle('show', over);
        if (!over) {
            this.modalShown = false;
            return;
        }
        if (this.modalShown) return;
        this.modalShown = true;
        $('modal-title').textContent = s.winner ? `🎉 ${playerName(s.winner)}获胜！` : '🤝 平局！';
        $('modal-message').textContent = s.winner ? `恭喜${playerName(s.winner)}赢得比赛！` : '棋盘已满，双方平局！';
        const skills = $('modal-skills');
        skills.innerHTML = '<div style="margin:10px 0;">本局技能池:</div>';
        for (const id of s.pool) {
            const skill = SKILL_MAP.get(id);
            const tag = document.createElement('span');
            tag.className = 'skill-tag';
            tag.textContent = `${skill.icon} ${skill.name}`;
            skills.appendChild(tag);
        }
    }

    playEffects(effects) {
        const layer = $('effect-layer');
        const origin = layer.getBoundingClientRect();
        for (const { row, col, text } of effects) {
            const rect = this.cells[row][col].getBoundingClientRect();
            const el = document.createElement('div');
            el.className = 'effect-text';
            el.textContent = text;
            el.style.left = `${rect.left - origin.left + rect.width / 2}px`;
            el.style.top = `${rect.top - origin.top}px`;
            layer.appendChild(el);
            setTimeout(() => el.remove(), 2000);
        }
    }
}
