// ==================== 启动与控制器 ====================
// 连接游戏核心、界面和 AI：处理按钮、键盘，并在轮到 AI 时调度它行动。

(() => {
    const AI_DELAY = 250;       // 让"思考中"先显示出来
    const AI_TIME_LIMIT = 800;  // AI 单步落子搜索时间上限（毫秒），推演技能另用一半

    const game = new GomokuGame();
    const ai = { enabled: false, player: 'white', timer: null, note: '' };

    const isAITurn = () => ai.enabled && !game.isOver() && game.state.current === ai.player;

    const view = new GomokuView({
        onCell(row, col) {
            if (isAITurn()) return;
            game.clickCell(row, col);
            refresh();
        },
        onSkill(id) {
            if (isAITurn()) return;
            game.selectSkill(id);
            refresh();
        },
        onCancel() {
            game.cancel();
            refresh();
        },
    });

    function refresh() {
        view.render(game, { aiPlayer: ai.enabled ? ai.player : null, aiThinking: isAITurn() });
        view.renderControls({
            aiEnabled: ai.enabled,
            testMode: game.state.testMode,
            canUndo: game.canUndo(),
            canCancel: Boolean(game.armed || game.state.pending),
        });
        scheduleAI();
    }

    function scheduleAI() {
        if (!isAITurn() || ai.timer) return;
        ai.timer = setTimeout(() => {
            ai.timer = null;
            if (!isAITurn()) return;
            // 每次走一步（用技能或落子）；refresh 后若仍轮到 AI 会再排下一步，直到回合结束
            const action = GomokuAI.act(game, ai.player, { timeLimit: AI_TIME_LIMIT });
            if (action && action.skill) {
                const skill = SKILL_MAP.get(action.skill);
                ai.note = `🤖 AI 使用了 ${skill.icon} ${skill.name}`;
            }
            if (ai.note) game.message = ai.note; // 落子会清空提示，回合结束前一直显示用过的技能
            if (!isAITurn()) ai.note = '';
            refresh();
        }, AI_DELAY);
    }

    function stopAI() {
        clearTimeout(ai.timer);
        ai.timer = null;
        ai.note = '';
    }

    const actions = {
        'ai-mode-btn'() {
            ai.enabled = !ai.enabled;
            if (!ai.enabled) stopAI();
            game.cancel();
            game.message = ai.enabled ? '🤖 AI对战已开启：AI执白，玩家执黑' : '🤖 AI对战已关闭：双人对战';
        },
        'undo-btn'() {
            stopAI();
            game.undo();
            // 人机对战时一直退回到玩家的回合
            while (ai.enabled && game.state.current === ai.player && game.undo());
        },
        'cancel-btn'() {
            game.cancel();
        },
        'restart-btn'() {
            stopAI();
            game.newGame();
        },
        'rematch-btn'() {
            stopAI();
            game.newGame({ keepPool: true });
            game.message = '🎯 重玩模式：相同技能组';
        },
        'modal-restart-btn'() {
            actions['restart-btn']();
        },
        'modal-rematch-btn'() {
            actions['rematch-btn']();
        },
        'test-mode-btn'() {
            stopAI();
            game.newGame({ testMode: !game.state.testMode });
            game.message = game.state.testMode ? '🧪 测试模式已开启：所有技能可用，能量无限' : '🧪 测试模式已关闭';
        },
    };

    for (const [id, action] of Object.entries(actions)) {
        $(id).addEventListener('click', () => {
            action();
            refresh();
        });
    }

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            game.cancel();
            refresh();
        }
    });

    refresh();
})();
