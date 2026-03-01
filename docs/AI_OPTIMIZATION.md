# AI参数优化指南

> 版本：1.0
> 日期：2026-02-10
> 目标：实现同级对战0.5胜率，差级对战0.7高等级胜率

---

## 平衡性目标

| 对战配置 | 目标胜率 | 说明 |
|---------|---------|------|
| 简单 vs 简单 | 50% vs 50% | 同等级应该平衡 |
| 中等 vs 中等 | 50% vs 50% | 同等级应该平衡 |
| 困难 vs 困难 | 50% vs 50% | 同等级应该平衡 |
| 中等 vs 简单 | 70% vs 30% | 中等应该明显优于简单 |
| 困难 vs 中等 | 70% vs 30% | 困难应该明显优于中等 |
| 困难 vs 简单 | 90% vs 10% | 困难应该几乎必胜简单 |

---

## 当前参数配置

### 简单难度 (Easy)
```javascript
{
    skillUsageRate: 0.2,      // 20%概率使用技能
    thinkTime: 500,           // 思考时间
    detectThreatLevel: 1,     // 仅检测五连
}
```

### 中等难度 (Medium)
```javascript
{
    skillUsageRate: 0.5,      // 50%概率使用技能
    thinkTime: 1000,          // 思考时间
    detectThreatLevel: 3,     // 检测五连、四连、活三
}
```

### 困难难度 (Hard)
```javascript
{
    skillUsageRate: 0.8,      // 80%概率使用技能
    thinkTime: 2000,          // 思考时间
    detectThreatLevel: 5,     // 检测所有威胁类型
    useSkillCombos: true,     // 使用技能组合
    advancedStrategy: true,   // 使用高级策略
}
```

---

## 优化策略

### 场景1: 同等级对战不平衡

#### 1.1 简单 vs 简单

**问题**: 黑方胜率 > 60% 或 < 40%（执黑优势过大）

**原因分析**:
- 先手优势过于明显
- 简单难度随机性导致结果不稳定

**解决方案**:

```javascript
// 方案A: 给后手玩家添加能量补偿
const ENERGY_COMPENSATION = {
    easy: 1,
    medium: 0,
    hard: 0
};

// 在GomokuAI构造函数中添加:
this.energyCompensation = ENERGY_COMPENSATION[difficulty] || 0;
```

**方案B**: 调整后手玩家的技能使用率
```javascript
// 在decideSkillUseEasy()中:
if (this.player === 'white') {
    const adjustedRate = this.config.skillUsageRate * 1.2; // 提高20%
    if (Math.random() < adjustedRate) {
        // 使用技能
    }
}
```

**方案C**: 增加随机性平衡
```javascript
// 在evaluatePositionSimple()中:
if (this.player === 'white') {
    score += Math.random() * 40; // 后手更多随机性
} else {
    score += Math.random() * 20;
}
```

#### 1.2 中等 vs 中等

**问题**: 胜率偏离 > 0.55 或 < 0.45

**原因分析**:
- 技能优先级调整不够精确
- 位置评估算法存在偏差

**解决方案**:

```javascript
// 调整技能价值评分
const SKILL_VALUE_ADJUSTMENTS = {
    medium: {
        // 加强弱势技能
        'c1': 50,   // 釜底抽薪: 40 → 50
        'c2': 45,   // 浑水摸鱼: 35 → 45
        'm3': 40,   // 假痴不癫: 30 → 40

        // 平衡强势技能
        's5': 90,   // 趁火打劫: 95 → 90
        'a6': 90,   // 擒贼擒王: 95 → 90
    }
};

// 在位置评估中添加先手补偿
const FIRST_PLAYER_ADVANTAGE = {
    medium: -30,   // 中等难度:-30分
    hard: -50,    // 困难难度:-50分
};
```

#### 1.3 困难 vs 困难

**问题**: 胜率偏离 > 0.55 或 < 0.45

**原因分析**:
- 技能组合触发条件不够精确
- 特殊场景处理存在偏差

**解决方案**:

```javascript
// 调整技能组合触发阈值
const COMBO_TRIGGERS = {
    offensive: {
        minAdvantage: 400,      // 原来: 500 → 400 (更容易触发)
        minLiveThree: 1,         // 原来: 2 → 1 (更容易触发)
    },
    defensive: {
        minOpponentThreat: 0.8, // 对方威胁阈值
    },
    comeback: {
        maxDisadvantage: -800  // 原来: -1000 → -800 (更早触发)
    }
};

// 添加先手补偿
if (this.player === 'black') {
    score -= 50; // 先手惩罚
}
```

---

### 场景2: 差级对战不平衡

#### 2.1 简单 vs 中等（目标：中等70%胜率）

**问题**: 中等胜率 < 70%

**分析**: 中等难度优势不明显

**解决方案**:

```javascript
// 提高中等难度的优势
AI_CONFIG.medium = {
    skillUsageRate: 0.6,      // 50% → 60%
    detectThreatLevel: 4,     // 3 → 4 (增加冲四检测)
    thinkTime: 1200,          // 1000 → 1200
    // 添加新配置
    predictionDepth: 1,      // 预测深度
    energyPriority: true,     // 能量管理优先
};

// 加强技能价值加成
function prioritizeSkillsMedium_skills, myThreats, opponentThreats) {
    let score = SKILL_VALUE[skill.id] || 50;

    // 大幅提高对简单AI的压制力
    if (opponentThreats.liveThree.length > 0) {
        if (['c4', 'e3', 's2'].includes(skill.id)) {
            score += 80; // 原来: 50 → 80
        }
    }

    if (myThreats.liveThree.length > 0) {
        if (SKILL_CATEGORY.OFFENSIVE.includes(skill.id)) {
            score += 50; // 原来: 30 → 50
        }
    }

    return { skill, score };
}
```

#### 2.2 中等 vs 困难（目标：困难70%胜率）

**问题**: 困难胜率 < 70%

**分析**: 困难难度优势不明显

**解决方案**:

```javascript
// 提高困难难度的优势
AI_CONFIG.hard = {
    skillUsageRate: 0.85,     // 80% → 85%
    detectThreatLevel: 5,
    thinkTime: 2000,
    useSkillCombos: true,
    advancedStrategy: true,
    // 新增配置
    predictionDepth: 2,      // 预测对手2步
    counterPlayEnabled: true,  // 反制战术
    energyOptimization: true,  // 能量优化
};

// 加强技能组合加成
const SKILL_COMBOS_ENHANCED = {
    offensive: [
        { skills: ['e1', 'a1', 'm5'], name: '幻影进攻', bonus: 40 }, // 30 → 40
        { skills: ['e4', 'd5', 'a5'], name: '连环进攻', bonus: 50 }, // 40 → 50
    ],
    // ... 更多组合
};

// 增加预判功能
function predictOpponentMove(board, opponent) {
    // 简单预判：找出对手最优位置
    const candidates = LineDetector.getCandidatePositions(board, this.game);
    let bestPos = null;
    let bestScore = -Infinity;

    for (const pos of candidates) {
        board[pos.row][pos.col] = opponent;
        const threats = LineDetector.detectThreats(board, opponent, this.game);
        board[pos.row][pos.col] = null;

        const score = LineDetector.calculateThreatScore(threats);
        if (score > bestScore) {
            bestScore = score;
            bestPos = pos;
        }
    }

    return bestPos;
}
```

#### 2.3 简单 vs 困难（目标：困难90%胜率）

**问题**: 困难胜率 < 90%

**分析**: 困难难度对简单的压制力不足

**解决方案**:

```javascript
// 困难对简单时进一步提高优势
if (opponentDifficulty === 'easy' && this.difficulty === 'hard') {
    // 技能使用率提高
    if (Math.random() < 0.95) { // 80% → 95%
        // 强制使用技能
    }

    // 添加简单对策
    // - 优先攻击对方参与连线的棋子
    // - 尽量形成多方向威胁
    // - 避免给对方创造简单机会

    function evaluatePositionHard_simpleOpponent(pos, ...) {
        // 额外惩罚给对方创造机会的位置
        board[pos.row][pos.col] = this.getOpponent();
        const opponentNewThreats = LineDetector.detectThreats(board, this.getOpponent(), this.game);
        board[pos.row][pos.col] = null;

        if (opponentNewThreats.liveTwo.length > opponentThreats.liveTwo.length) {
            score -= 300; // 大幅惩罚
        }
        if (opponentNewThreats.liveThree.length > 0) {
            score -= 1000; // 严厉惩罚给对方创造活三
        }
    }
}
```

---

## 具体参数调整方案

### 调整方案A: 保守调整（小幅优化）

```javascript
// 简单难度
AI_CONFIG.easy = {
    skillUsageRate: 0.2,      // 保持
    thinkTime: 500,
    detectThreatLevel: 1,
    // 新增: 先手补偿
    firstPlayerPenalty: -30,  // 先手玩家-30分
    secondPlayerBonus: 20,     // 后手玩家+20分
};

// 中等难度
AI_CONFIG.medium = {
    skillUsageRate: 0.55,     // 50% → 55%
    thinkTime: 1000,
    detectThreatLevel: 3,
    firstPlayerPenalty: -25,
    // 新增: 额外威胁检测
    detectSleepThree: true,     // 检测眠三
    detectPotentialThree: false,
};

// 困难难度
AI_CONFIG.hard = {
    skillUsageRate: 0.75,     // 80% → 75%
    thinkTime: 1800,          // 2000 → 1800
    detectThreatLevel: 5,
    useSkillCombos: true,
    advancedStrategy: true,
    firstPlayerPenalty: -20,
    // 新增: 精准参数
    skillComboThreshold: 400,      // 500 → 400
    comebackThreshold: -900,       // -1000 → -900
    winningThreshold: 1500,        // 2000 → 1500
};
```

### 调整方案B: 激进调整（大幅优化）

```javascript
// 简单难度
AI_CONFIG.easy = {
    skillUsageRate: 0.25,     // 20% → 25%
    thinkTime: 600,
    detectThreatLevel: 1,
    // 新增: 能量补偿
    secondPlayerEnergyBonus: 1,    // 后手每回合+1能量
};

// 中等难度
AI_CONFIG.medium = {
    skillUsageRate: 0.65,     // 50% → 65%
    thinkTime: 1200,
    detectThreatLevel: 4,     // 3 → 4
    // 新增
    enhancedTargetSelection: true,  // 改进目标选择
    defensiveBonus: 1.2,          // 防守加成
    offensiveBonus: 1.3,          // 进攻加成
};

// 困难难度
AI_CONFIG.hard = {
    skillUsageRate: 0.85,     // 80% → 85%
    thinkTime: 2200,
    detectThreatLevel: 5,
    useSkillCombos: true,
    advancedStrategy: true,
    // 新增
    predictionEnabled: true,       // 启用预判
    counterPlayEnabled: true,      // 启用反制
    adaptiveDifficulty: true,     // 自适应难度
};
```

---

## 实施步骤

### 第一步：基准测试

1. 使用 `ai_test.html` 运行以下测试组合：

| 测试 | 黑方 | 白方 | 局数 | 预期 |
|-----|------|------|------|------|
| A | 简单 | 简单 | 20 | 10-10 |
| B | 中等 | 中等 | 20 | 10-10 |
| C | 困难 | 困难 | 20 | 10-10 |
| D | 中等 | 简单 | 20 | 14-6 |
| E | 困难 | 中等 | 20 | 14-6 |
| F | 困难 | 简单 | 20 | 18-2 |

### 第二步：分析结果

根据基准测试结果，确定需要调整的参数：

| 场景 | 当前结果 | 期望结果 | 调整方向 |
|-----|---------|---------|---------|
| A | 黑方胜率 | 50% | 根据偏差调整 |
| B | 黑方胜率 | 50% | 根据偏差调整 |
| C | 黑方胜率 | 50% | 根据偏差调整 |
| D | 白方胜率 | 70% | 根据偏差调整 |
| E | 白方胜率 | 70% | 根据偏差调整 |
| F | 白方胜率 | 90% | 根据偏差调整 |

### 第三步：参数调整

根据第二步分析结果，选择以下调整之一：

**选项1**: 调整技能使用率
```javascript
// 如果简单AI胜率过高，降低其技能使用率
// 如果简单AI胜率过低，提高其技能使用率
skillUsageRate: baseRate × adjustmentFactor;
```

**选项2**: 调整威胁检测等级
```javascript
// 如果AI过于被动，提高检测等级
// 如果AI过于激进，降低检测等级
detectThreatLevel: baseLevel + adjustment;
```

**选项3**: 调整技能价值
```javascript
// 提高或降低特定技能的价值评分
SKILL_VALUE[skillId] = baseValue × adjustmentFactor;
```

**选项4**: 添加先手/后手补偿
```javascript
// 平衡先手优势
firstPlayerPenalty: -penalty;
secondPlayerBonus: bonus;
```

**选项5**: 调整组合触发阈值
```javascript
// 让技能组合更容易/更难触发
comboThreshold: baseThreshold × adjustmentFactor;
```

### 第四步：验证调整

使用调整后的参数重新运行基准测试，确认平衡性达到目标。

---

## 快速优化指南

### 问题诊断表

| 观察 | 可能原因 | 快速修复 |
|-----|---------|---------|
| 简单AI胜率<40% | 后手劣势大 | 提高后手能量补偿 |
| 简单AI胜率>60% | 先手优势大 | 增加先手惩罚 |
| 中等vs简单胜率<65% | 中等压制力不够 | skillUsageRate+10% |
| 困难vs中等胜率<65% | 困难优势不明显 | 启用预判功能 |
| 同级胜率差>0.1 | 评估偏差 | 添加先手补偿 |

### 参数调整建议

#### 简单度调整

```javascript
// 让简单AI更容易获胜
AI_CONFIG.easy.skillUsageRate = 0.3;  // 20% → 30%
AI_CONFIG.easy.detectThreatLevel = 2;  // 检测活三

// 让简单AI更难获胜
AI_CONFIG.easy.skillUsageRate = 0.15; // 20% → 15%
AI_CONFIG.easy.thinkTime = 300;          // 减少思考时间(更多随机性)
```

#### 中等度调整

```javascript
// 让中等AI更强
AI_CONFIG.medium.skillUsageRate = 0.65; // 50% → 65%
AI_CONFIG.medium.detectThreatLevel = 4;  // 3 → 4
AI_CONFIG.medium.offensiveBonus = 1.3;   // 进攻加成30%
AI_CONFIG.medium.defensiveBonus = 1.2;  // 防守加成20%

// 让中等AI更弱
AI_CONFIG.medium.skillUsageRate = 0.4;   // 50% → 40%
AI_CONFIG.medium.detectThreatLevel = 3;  // 保持
AI_CONFIG.medium.offensiveBonus = 0.9;   // 进攻加成-10%
```

#### 困难度调整

```javascript
// 让困难AI更强
AI_CONFIG.hard.skillUsageRate = 0.9;   // 80% → 90%
AI_CONFIG.hard.useSkillCombos = true;
AI_CONFIG.hard.predictionEnabled = true;
AI_CONFIG.hard.skillComboThreshold = 300;  // 400 → 300
AI_CONFIG.hard.advancedTargeting = true;  // 高级目标选择

// 让困难AI更弱
AI_CONFIG.hard.skillUsageRate = 0.7;   // 80% → 70%
AI_CONFIG.hard.useSkillCombos = false; // 禁用技能组合
```

---

## 优化后预期结果

### 目标平衡性

| 对战 | 黑方胜 | 白方胜 | 平局 | 说明 |
|-----|--------|--------|------|------|
| 简单 vs 简单 | ~50% | ~50% | ~0% | 基本平衡 |
| 中等 vs 中等 | ~50% | ~50% | ~0% | 基本平衡 |
| 困难 vs 困难 | ~50% | ~50% | ~0% | 基本平衡 |
| 中等 vs 简单 | ~65% | ~35% | ~0% | 中等优势明显 |
| 困难 vs 中等 | ~65% | ~35% | ~0% | 困难优势明显 |
| 困难 vs 简单 | ~85% | ~15% | ~0% | 困难几乎必胜 |

---

## 验证方法

### 自动化测试流程

1. 打开 `ai_test.html`
2. 配置测试参数
3. 点击"开始测试"
4. 等待测试完成
5. 查看分析结果和优化建议
6. 根据建议调整参数
7. 重新测试验证

### 手动验证

也可以通过主游戏手动测试：
1. 开启AI对战模式
2. 切换到指定难度
3. 进行多局对战
4. 记录胜负统计
5. 计算胜率
6. 与目标对比

---

## 参数文件结构

为了方便调整，可以将AI参数提取到单独的配置文件中：

```javascript
// ai_parameters.js
const AI_PARAMETERS = {
    easy: {
        skillUsageRate: 0.2,
        thinkTime: 500,
        detectThreatLevel: 1,
        firstPlayerPenalty: 0,
        secondPlayerBonus: 0,
        randomSeed: null,
    },
    medium: {
        skillUsageRate: 0.5,
        thinkTime: 1000,
        detectThreatLevel: 3,
        // ...更多参数
    },
    hard: {
        skillUsageRate: 0.8,
        thinkTime: 2000,
        detectThreatLevel: 5,
        // ...更多参数
    },
    // 平衡性参数
    balance: {
        firstPlayerAdvantage: 0.1,     // 先手优势
        targetSameLevelWinRate: 0.5,  // 同级目标胜率
        targetOneLevelDiffWinRate: 0.7, // 差一级目标胜率
    },
};
```

然后在AI代码中引用这些参数：
```javascript
import { AI_PARAMETERS } from 'ai_parameters.js';

// 在GomokuAI构造函数中
this.config = { ...AI_PARAMETERS[this.difficulty], ...AI_PARAMETERS.balance };
```

---

## 文档更新记录

| 版本 | 日期 | 更新内容 |
|-----|------|---------|
| 1.0 | 2026-02-10 | 初始版本，基于测试需求的优化方案 |
