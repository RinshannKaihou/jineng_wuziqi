/**
 * 游戏 UI/UX 优化方案
 * 包含界面改进、动画效果、响应式设计等
 */

// ==================== UI 主题配置 ====================
const UITheme = {
    colors: {
        primary: '#2c3e50',
        secondary: '#34495e',
        accent: '#3498db',
        success: '#27ae60',
        warning: '#f39c12',
        danger: '#e74c3c',
        light: '#ecf0f1',
        dark: '#2c3e50'
    },
    board: {
        background: '#daa520',
        line: '#8b4513',
        starPoint: '#8b4513',
        blackStone: '#1a1a1a',
        whiteStone: '#f5f5f5',
        highlight: 'rgba(52, 152, 219, 0.3)',
        lastMove: 'rgba(231, 76, 60, 0.5)'
    }
};

// ==================== 动画管理器 ====================
class AnimationManager {
    constructor() {
        this.animations = [];
        this.isAnimating = false;
    }

    /**
     * 落子动画
     */
    playPlaceAnimation(row, col, player, callback) {
        const board = document.querySelector('.board');
        if (!board) return;

        const cell = board.children[row * 15 + col];
        if (!cell) return;

        this.isAnimating = true;

        // 创建棋子元素
        const stone = document.createElement('div');
        stone.className = `stone ${player} placing`;
        cell.appendChild(stone);

        // 触发动画
        setTimeout(() => {
            stone.classList.add('placed');
        }, 10);

        // 动画结束
        setTimeout(() => {
            stone.classList.remove('placing');
            if (callback) callback();
            this.isAnimating = false;
        }, 300);
    }

    /**
     * 技能发动动画
     */
    playSkillAnimation(skillId, skillName, target, callback) {
        const overlay = document.querySelector('.skill-overlay') || this.createSkillOverlay();

        // 显示技能名称
        const skillText = overlay.querySelector('.skill-name');
        skillText.textContent = `${skillName} 发动!`;
        skillText.style.animation = 'none';
        skillText.offsetHeight; // 触发重绘
        skillText.style.animation = 'skillName 1.5s ease-out';

        overlay.style.display = 'flex';

        // 目标高亮
        if (target) {
            this.highlightCell(target.row, target.col);
        }

        // 动画结束
        setTimeout(() => {
            overlay.style.display = 'none';
            this.clearHighlight();
            if (callback) callback();
        }, 1500);
    }

    /**
     * 威胁提示动画
     */
    playThreatAnimation(positions, type) {
        const board = document.querySelector('.board');
        if (!board) return;

        positions.forEach(pos => {
            const cell = board.children[pos.row * 15 + pos.col];
            if (cell) {
                cell.classList.add('threat', type);

                setTimeout(() => {
                    cell.classList.remove('threat', type);
                }, 1000);
            }
        });
    }

    /**
     * 胜利动画
     */
    playWinAnimation(winner, winningLine) {
        const board = document.querySelector('.board');
        if (!board) return;

        // 高亮获胜连线
        winningLine.forEach(pos => {
            const cell = board.children[pos.row * 15 + pos.col];
            if (cell) {
                cell.classList.add('winning-stone');
            }
        });

        // 显示胜利模态框
        setTimeout(() => {
            this.showWinModal(winner);
        }, 500);
    }

    /**
     * 高亮格子
     */
    highlightCell(row, col, duration = 1000) {
        const board = document.querySelector('.board');
        if (!board) return;

        const cell = board.children[row * 15 + col];
        if (cell) {
            cell.classList.add('highlighted');
            setTimeout(() => {
                cell.classList.remove('highlighted');
            }, duration);
        }
    }

    /**
     * 清除高亮
     */
    clearHighlight() {
        const highlighted = document.querySelectorAll('.highlighted');
        highlighted.forEach(el => el.classList.remove('highlighted'));
    }

    /**
     * 创建技能覆盖层
     */
    createSkillOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'skill-overlay';
        overlay.innerHTML = `
            <div class="skill-name"></div>
            <div class="skill-effect"></div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    /**
     * 显示胜利模态框
     */
    showWinModal(winner) {
        const modal = document.querySelector('.win-modal') || this.createWinModal();
        modal.style.display = 'flex';

        const winnerText = modal.querySelector('.winner-text');
        winnerText.textContent = winner === 'black' ? '黑方' : '白方';
        winnerText.style.color = winner === 'black' ? '#1a1a1a' : '#f5f5f5';
    }

    /**
     * 创建胜利模态框
     */
    createWinModal() {
        const modal = document.createElement('div');
        modal.className = 'win-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="winner-icon">🏆</div>
                <h2><span class="winner-text"></span> 获胜!</h2>
                <div class="modal-buttons">
                    <button class="btn btn-primary" data-action="restart">再来一局</button>
                    <button class="btn btn-secondary" data-action="review">复盘</button>
                    <button class="btn btn-outline" data-action="close">关闭</button>
                </div>
            </div>
        `;
        modal.addEventListener('click', (event) => {
            const action = event.target && event.target.dataset ? event.target.dataset.action : null;
            if (!action) return;
            this.handleWinModalAction(action, modal);
        });
        document.body.appendChild(modal);
        return modal;
    }

    /**
     * 处理胜利模态框按钮动作
     */
    handleWinModalAction(action, modal) {
        const gameInstance = typeof window !== 'undefined' ? window.game : null;

        if (action === 'close') {
            modal.style.display = 'none';
            return;
        }

        if (!gameInstance) {
            return;
        }

        if (action === 'restart') {
            if (typeof gameInstance.rematch === 'function') {
                gameInstance.rematch();
            } else if (typeof gameInstance.restart === 'function') {
                gameInstance.restart();
            }
            modal.style.display = 'none';
            return;
        }

        if (action === 'review') {
            if (typeof gameInstance.review === 'function') {
                gameInstance.review();
            }
            modal.style.display = 'none';
        }
    }
}

// ==================== 响应式布局管理器 ====================
class ResponsiveLayoutManager {
    constructor() {
        this.breakpoints = {
            mobile: 768,
            tablet: 1024,
            desktop: 1440
        };
        this.currentBreakpoint = this.getCurrentBreakpoint();
        this.init();
    }

    init() {
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize();
    }

    getCurrentBreakpoint() {
        const width = window.innerWidth;
        if (width < this.breakpoints.mobile) return 'mobile';
        if (width < this.breakpoints.tablet) return 'tablet';
        if (width < this.breakpoints.desktop) return 'desktop';
        return 'large';
    }

    handleResize() {
        const newBreakpoint = this.getCurrentBreakpoint();
        if (newBreakpoint !== this.currentBreakpoint) {
            this.currentBreakpoint = newBreakpoint;
            this.applyLayout();
        }
    }

    applyLayout() {
        const gameContainer = document.querySelector('.game-container');
        if (!gameContainer) return;

        // 移除所有布局类
        gameContainer.classList.remove('layout-mobile', 'layout-tablet', 'layout-desktop', 'layout-large');

        // 添加当前布局类
        gameContainer.classList.add(`layout-${this.currentBreakpoint}`);

        // 调整棋盘大小
        this.adjustBoardSize();

        // 调整面板位置
        this.adjustPanelPosition();
    }

    adjustBoardSize() {
        const board = document.querySelector('.board');
        if (!board) return;

        const sizes = {
            mobile: Math.min(window.innerWidth - 32, 400),
            tablet: Math.min(window.innerWidth - 100, 500),
            desktop: 550,
            large: 600
        };

        const size = sizes[this.currentBreakpoint];
        board.style.width = `${size}px`;
        board.style.height = `${size}px`;
    }

    adjustPanelPosition() {
        const sidePanel = document.querySelector('.side-panel');
        const skillPanel = document.querySelector('.skill-panel');

        if (this.currentBreakpoint === 'mobile') {
            // 移动端：面板在底部
            if (sidePanel) {
                sidePanel.style.position = 'static';
                sidePanel.style.width = '100%';
            }
            if (skillPanel) {
                skillPanel.style.position = 'static';
                skillPanel.style.width = '100%';
            }
        } else {
            // 桌面端：面板在侧边
            if (sidePanel) {
                sidePanel.style.position = 'sticky';
                sidePanel.style.width = '300px';
            }
            if (skillPanel) {
                skillPanel.style.position = 'sticky';
                skillPanel.style.width = '300px';
            }
        }
    }
}

// ==================== 效果提示管理器 ====================
class EffectToastManager {
    constructor() {
        this.container = this.createContainer();
        this.toasts = [];
    }

    createContainer() {
        let container = document.querySelector('.effect-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'effect-toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    /**
     * 显示效果提示
     */
    show(row, col, message, type = 'info', duration = 2000) {
        const toast = document.createElement('div');
        toast.className = `effect-toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${this.getIcon(type)}</span>
            <span class="toast-message">${message}</span>
        `;

        // 定位
        const board = document.querySelector('.board');
        if (board && row !== undefined) {
            const cell = board.children[row * 15 + col];
            if (cell) {
                const rect = cell.getBoundingClientRect();
                toast.style.position = 'fixed';
                toast.style.left = `${rect.left + rect.width / 2}px`;
                toast.style.top = `${rect.top - 40}px`;
                toast.style.transform = 'translateX(-50%)';
            }
        }

        this.container.appendChild(toast);
        this.toasts.push(toast);

        // 动画进入
        setTimeout(() => toast.classList.add('show'), 10);

        // 自动移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
                this.toasts = this.toasts.filter(t => t !== toast);
            }, 300);
        }, duration);
    }

    getIcon(type) {
        const icons = {
            info: 'ℹ️',
            success: '✓',
            warning: '⚠️',
            error: '✗',
            skill: '⚡',
            energy: '⚡',
            combo: '🔥'
        };
        return icons[type] || icons.info;
    }

    /**
     * 显示能量变化
     */
    showEnergyChange(row, col, player, amount) {
        const message = amount > 0 ? `+${amount} 能量` : `${amount} 能量`;
        this.show(row, col, message, amount > 0 ? 'success' : 'warning', 1500);
    }

    /**
     * 显示技能效果
     */
    showSkillEffect(row, col, skillName, effect) {
        this.show(row, col, `${skillName}: ${effect}`, 'skill', 2500);
    }

    /**
     * 显示组合
     */
    showCombo(comboName, bonus) {
        this.show(undefined, undefined, `${comboName}! +${bonus}%`, 'combo', 3000);
    }

    /**
     * 清除所有提示
     */
    clearAll() {
        this.toasts.forEach(toast => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
        this.toasts = [];
    }
}

// ==================== 声音管理器 ====================
class SoundManager {
    constructor() {
        this.enabled = true;
        this.volume = 0.5;
        this.sounds = {};
        this.initSounds();
    }

    initSounds() {
        // 使用Web Audio API生成简单音效
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    /**
     * 播放落子音效
     */
    playPlaceStone() {
        if (!this.enabled) return;
        this.playTone(800, 0.1, 'sine');
    }

    /**
     * 播放技能音效
     */
    playSkill() {
        if (!this.enabled) return;
        this.playTone(600, 0.1, 'square');
        setTimeout(() => this.playTone(900, 0.1, 'square'), 100);
    }

    /**
     * 播放胜利音效
     */
    playWin() {
        if (!this.enabled) return;
        const melody = [523, 659, 784, 1047];
        melody.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.2, 'sine'), i * 150);
        });
    }

    /**
     * 播放失败音效
     */
    playLose() {
        if (!this.enabled) return;
        const melody = [392, 349, 330, 294];
        melody.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.2, 'sine'), i * 150);
        });
    }

    /**
     * 播放音调
     */
    playTone(frequency, duration, type = 'sine') {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;

        gainNode.gain.value = this.volume * 0.3;
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    /**
     * 切换静音
     */
    toggleMute() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    /**
     * 设置音量
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
}

// ==================== 设置管理器 ====================
class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
    }

    loadSettings() {
        const saved = localStorage.getItem('gomoku_settings');
        return saved ? JSON.parse(saved) : this.getDefaultSettings();
    }

    getDefaultSettings() {
        return {
            sound: true,
            music: false,
            volume: 0.5,
            animations: true,
            showHints: true,
            autoSave: true,
            difficulty: 'medium',
            boardTheme: 'classic',
            language: 'zh-CN'
        };
    }

    saveSettings() {
        localStorage.setItem('gomoku_settings', JSON.stringify(this.settings));
    }

    get(key) {
        return this.settings[key];
    }

    set(key, value) {
        this.settings[key] = value;
        this.saveSettings();
    }

    reset() {
        this.settings = this.getDefaultSettings();
        this.saveSettings();
    }
}

// ==================== CSS 样式注入 ====================
function injectCustomStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* 基础样式 */
        .game-container {
            display: flex;
            gap: 20px;
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
            transition: all 0.3s ease;
        }

        /* 响应式布局 */
        .layout-mobile {
            flex-direction: column;
            align-items: center;
        }

        .layout-tablet .game-container {
            flex-wrap: wrap;
        }

        /* 棋盘样式 */
        .board {
            display: grid;
            grid-template-columns: repeat(15, 1fr);
            background: ${UITheme.board.background};
            border: 2px solid ${UITheme.board.line};
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: width 0.3s, height 0.3s;
        }

        .cell {
            border: 1px solid ${UITheme.board.line};
            position: relative;
            cursor: pointer;
        }

        /* 星位点 */
        .cell.star-point::after {
            content: '';
            position: absolute;
            width: 8px;
            height: 8px;
            background: ${UITheme.board.starPoint};
            border-radius: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }

        /* 棋子样式 */
        .stone {
            width: 80%;
            height: 80%;
            border-radius: 50%;
            position: absolute;
            top: 10%;
            left: 10%;
            transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .stone.black {
            background: radial-gradient(circle at 30% 30%, #4a4a4a, ${UITheme.board.blackStone});
            box-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }

        .stone.white {
            background: radial-gradient(circle at 30% 30%, #ffffff, ${UITheme.board.whiteStone});
            box-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .stone.placing {
            transform: scale(0);
            opacity: 0;
        }

        .stone.placed {
            transform: scale(1);
            opacity: 1;
        }

        /* 高亮效果 */
        .cell.highlighted {
            background: ${UITheme.board.highlight};
        }

        .cell.threat.attack-4 {
            background: rgba(231, 76, 60, 0.4);
        }

        .cell.threat.attack-3 {
            background: rgba(243, 156, 18, 0.3);
        }

        .stone.winning-stone {
            animation: winningPulse 1s infinite;
        }

        @keyframes winningPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); box-shadow: 0 0 20px gold; }
        }

        /* 技能覆盖层 */
        .skill-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            pointer-events: none;
        }

        .skill-name {
            font-size: 3rem;
            font-weight: bold;
            color: ${UITheme.colors.accent};
            text-shadow: 0 0 20px ${UITheme.colors.accent};
        }

        @keyframes skillName {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 0; }
        }

        /* 效果提示 */
        .effect-toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999;
        }

        .effect-toast {
            background: white;
            padding: 12px 20px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            transform: translateX(100px);
            opacity: 0;
            transition: all 0.3s ease;
        }

        .effect-toast.show {
            transform: translateX(0);
            opacity: 1;
        }

        .toast-skill { border-left: 4px solid ${UITheme.colors.accent}; }
        .toast-success { border-left: 4px solid ${UITheme.colors.success}; }
        .toast-warning { border-left: 4px solid ${UITheme.colors.warning}; }
        .toast-combo { border-left: 4px solid ${UITheme.colors.danger}; }

        /* 胜利模态框 */
        .win-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            justify-content: center;
            align-items: center;
            z-index: 1001;
        }

        .modal-content {
            background: white;
            padding: 40px;
            border-radius: 16px;
            text-align: center;
            animation: modalSlideIn 0.5s ease;
        }

        @keyframes modalSlideIn {
            from { transform: translateY(-100px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .winner-icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }

        .modal-buttons {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 30px;
        }

        /* 按钮样式 */
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-primary {
            background: ${UITheme.colors.accent};
            color: white;
        }

        .btn-primary:hover {
            background: ${UITheme.colors.accent};
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(52, 152, 219, 0.4);
        }

        .btn-secondary {
            background: ${UITheme.colors.secondary};
            color: white;
        }

        .btn-outline {
            background: transparent;
            border: 2px solid ${UITheme.colors.secondary};
            color: ${UITheme.colors.secondary};
        }

        /* 侧边面板 */
        .side-panel {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        /* 技能面板 */
        .skill-panel {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        /* 能量条 */
        .energy-bar {
            width: 100%;
            height: 24px;
            background: ${UITheme.colors.light};
            border-radius: 12px;
            overflow: hidden;
            position: relative;
        }

        .energy-fill {
            height: 100%;
            background: linear-gradient(90deg, ${UITheme.colors.accent}, ${UITheme.colors.success});
            transition: width 0.5s ease;
        }

        /* 冷却指示器 */
        .cooldown-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            font-weight: bold;
            border-radius: 8px;
        }
    `;

    document.head.appendChild(style);
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    injectCustomStyles();

    // 初始化管理器
    window.animationManager = new AnimationManager();
    window.layoutManager = new ResponsiveLayoutManager();
    window.toastManager = new EffectToastManager();
    window.soundManager = new SoundManager();
    window.settingsManager = new SettingsManager();

    console.log('UI增强系统已初始化');
});

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        UITheme,
        AnimationManager,
        ResponsiveLayoutManager,
        EffectToastManager,
        SoundManager,
        SettingsManager
    };
}
