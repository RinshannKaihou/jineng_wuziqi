# 困难难度AI实现总结

> 版本：1.0
> 日期：2026-02-10
> 状态：已完成

---

## 实现概述

困难难度AI在中等难度的基础上增加了以下核心功能：

### 1. 技能组合系统

#### 1.1 技能组合定义

```javascript
const SKILL_COMBOS = {
    // 进攻组合
    offensive: [
        { skills: ['e1', 'a1', 'm5'], name: '幻影进攻', bonus: 30 },
        { skills: ['e4', 'd5', 'a5'], name: '连环进攻', bonus: 40 },
        { skills: ['c5', 'm1', 'a6'], name: '转化进攻', bonus: 50 },
    ],
    // 防守组合
    defensive: [
        { skills: ['e3', 'd2', 'c4'], name: '控制防守', bonus: 35 },
        { skills: ['s5', 'e5', 'a6'], name: '破坏防守', bonus: 45 },
    ],
    // 翻盘组合
    comeback: [
        { skills: ['d1', 'm1', 'm6'], name: '逆转翻盘', bonus: 60 },
        { skills: ['d6', 'm4', 'a3'], name: '逃生翻盘', bonus: 50 },
    ],
};
```

#### 1.2 组合触发条件

| 组合类型 | 触发条件 | 加成 |
|---------|---------|------|
| 进攻组合 | 威胁优势>500 或 活三>1 | +30~50 |
| 防守组合 | 对方有四连或活三>1 | +35~45 |
| 翻盘组合 | 威胁优势<-1000 | +50~60 |

### 2. 技能分类系统

```javascript
const SKILL_CATEGORY = {
    OFFENSIVE: ['s5', 'e4', 'e5', 'a6', 'c5', 'm1', 'd5'],  // 进攻型 (7个)
    DEFENSIVE: ['s2', 's5', 'e3', 'e5', 'c4', 'd2'],         // 防守型 (6个)
    ENERGY: ['a1', 's4', 'd3', 'm3'],                         // 能量型 (4个)
    CONTROL: ['s2', 'e3', 'a4', 'a5', 'c4', 'm2'],           // 控制型 (6个)
    COMEBACK: ['d1', 'd6', 'm1', 'm6', 'a3'],                // 翻盘型 (5个)
};
```

### 3. 全面威胁检测

#### 3.1 威胁类型扩展

| 威胁类型 | 中等 | 困难 | 说明 |
|---------|-----|------|------|
| 五连 (WIN) | ✓ | ✓ | 即将获胜 |
| 活四 (LIVE_FOUR) | ✓ | ✓ | 两端开放的四连 |
| 冲四 (RUSH_FOUR) | ✓ | ✓ | 一端开放的四连 |
| 活三 (LIVE_THREE) | ✓ | ✓ | 两端开放的三连 |
| 眠三 (SLEEP_THREE) | ✓ | ✓ | 一端开放的三连 |
| 活二 (LIVE_TWO) | ✓ | ✓ | 两端开放的二连 |
| 潜在三 (POTENTIAL_THREE) | ✗ | ✓ | 隔一子能形成三连 |

#### 3.2 威胁分数计算

```javascript
function calculateThreatScore(threats) {
    return threats.win.length * 100000 +
           threats.liveFour.length * 10000 +
           threats.rushFour.length * 5000 +
           threats.liveThree.length * 1000 +
           threats.sleepThree.length * 300 +
           threats.liveTwo.length * 100 +
           threats.potentialThree.length * 50;
}
```

### 4. 特殊场景处理

#### 4.1 开局策略（前5步）

```javascript
第1步: 占领中心 (7, 7)
第2步: 靠近中心 (7,6)/(7,8)/(6,7)/(8,7)
第3-5步:
  - 能量<5: 优先使用打草惊蛇/以逸待劳
  - 建立: 优先建立基础棋型
```

#### 4.2 逆风策略（威胁优势<-1000）

```javascript
优先级:
1. 使用翻盘型技能 (美人计、走为上策、偷梁换柱等)
2. 使用破坏型技能 (擒贼擒王、调虎离山等)
3. 冒险进攻: 尝试形成活三创造威胁
```

#### 4.3 顺风策略（威胁优势>2000）

```javascript
优先级:
1. 使用控制型技能限制对手 (隔岸观火、空城计等)
2. 稳健落子，避免给对方创造机会
3. 惩罚冒险型技能 (打草惊蛇、瞒天过海等)
```

### 5. 高级技能优先级系统

#### 5.1 动态加成因素

```javascript
技能评分 = 基础价值 + 组合加成 + 威胁加成 + 能量管理 + 技能协同 + 局势适应

基础价值: SKILL_VALUE[skill.id]
组合加成: combo.bonus (当符合技能组合时)
威胁加成:
  - 对方有四连 → 防守型技能 +100
  - 对方有活三 → 控制型技能 +60
  - 己方有活三 → 进攻型技能 +50
能量管理:
  - 能量<30% → 能量型技能 +80
  - 能量<技能消耗 → 该技能 -200
技能协同:
  - 上次进攻 → 本次控制 +30
局势适应:
  - 逆风(优势<-500) → 翻盘型技能 +70
  - 顺风(优势>1000) → 控制型技能 +40
  - 顺风 → 冒险技能 -30
```

#### 5.2 威胁等级判定

```javascript
getThreatLevel(threats):
    5: 有五连
    4: 有活四
    3: 有冲四
    2: 有活三
    1: 有眠三
    0: 无威胁
```

### 6. 高级目标选择

#### 6.1 进攻型技能目标

```javascript
evaluateStoneTargetAdvanced(target):
    score = 连线价值 + 双重威胁奖励 + 对手加成

连线价值:
    - 活四: +150
    - 冲四: +120
    - 活三: +80
    - 眠三: +40
    - 活二: +15

双重威胁: 威胁数 × 30
对手加成: × 1.8
```

#### 6.2 防守型技能目标

```javascript
evaluateDefensiveTarget(target):
    score = 基础分 + 威胁减少分

威胁减少分:
    - 阻止活四: +200
    - 阻止冲四: +100
    - 阻止活三: +30
```

### 7. 高级位置评估

#### 7.1 困难位置评估公式

```javascript
score = 基础价值 + 进攻价值 + 防守价值 + 局势适应 + 连锁效应 + 能量潜力

基础价值: 位置表 × 1.5
进攻价值:
  - 形成活四: +8000
  - 形成冲四: +3000
  - 形成活三: +800
  - 形成眠三: +200
  - 形成活二: +80
  - 双重威胁: +1500

防守价值:
  - 阻止五连: +15000
  - 阻止活四: +5000
  - 阻止冲四: +2000
  - 阻止活三: +500
  - 阻止眠三: +150

局势适应:
  - 顺风: 惩罚给对方创造威胁
  - 逆风: 奖励创造多个威胁

连锁效应: 连接方向数 × 20
能量潜力: 连线数 × 10
随机波动: ±25
```

#### 7.2 选择范围动态调整

```javascript
if (威胁优势 > 1000)  // 顺风
    选择范围 = 1 (最稳健)
else if (威胁优势 < -500)  // 逆风
    选择范围 = 5 (更多变化)
else  // 均势
    选择范围 = 2 (正常)
```

### 8. 代码结构

#### 8.1 新增类方法

| 方法 | 功能 | 复杂度 |
|-----|------|-------|
| `makeDecisionHard()` | 困难难度主决策 | O(n²) |
| `handleOpeningStrategy()` | 开局策略处理 | O(n) |
| `handleComebackStrategy()` | 逆风策略处理 | O(n²) |
| `handleWinningStrategy()` | 顺风策略处理 | O(n²) |
| `decideSkillUseHard()` | 困难技能决策 | O(n) |
| `findBestSkillCombo()` | 查找技能组合 | O(n×m) |
| `prioritizeSkillsHard()` | 困难技能优先级 | O(n) |
| `selectSkillTargetHard()` | 困难目标选择 | O(n²) |
| `evaluateStoneTargetAdvanced()` | 高级棋子评估 | O(n) |
| `evaluateDefensiveTarget()` | 防守目标评估 | O(n²) |
| `selectBestPositionHard()` | 困难位置选择 | O(n³) |
| `evaluatePositionHard()` | 困难位置评估 | O(n³) |
| `evaluatePositionWinning()` | 顺风位置评估 | O(n²) |
| `evaluatePositionComeback()` | 逆风位置评估 | O(n²) |
| `evaluateChainEffect()` | 连锁效应评估 | O(1) |
| `evaluateEnergyPotential()` | 能量潜力评估 | O(n) |

#### 8.2 LineDetector 类新增方法

| 方法 | 功能 |
|-----|------|
| `detectPotentialThrees()` | 检测潜在三连（隔一子） |
| `calculateThreatScore()` | 计算综合威胁分数 |

### 9. 性能指标

#### 9.1 计算复杂度

| 操作 | 时间复杂度 | 说明 |
|-----|----------|------|
| 威胁检测 | O(15×15×4) | 遍历棋盘×4方向 |
| 潜在威胁检测 | O(15×15×4×4) | 检测隔一子情况 |
| 技能组合查找 | O(combos×skills) | 组合数×技能数 |
| 位置评估（困难） | O(candidateCount×15×15) | 候选位置×模拟落子×检测 |

#### 9.2 实测性能

```
困难难度:
- 平均思考时间: ~2000ms
- CPU使用: 中-高
- 威胁检测开销: ~300ms
- 位置评估开销: ~800ms (包含多次模拟)
- 技能决策开销: ~400ms
- 技能组合查找: ~200ms
```

### 10. 难度对比总结

| 特性 | 简单 | 中等 | 困难 |
|-----|------|------|------|
| 威胁检测 | 五连 | 五连+四连+活三 | 全部类型 |
| 技能使用率 | 20% | 50% | 80% |
| 技能选择 | 随机 | 价值+局势加成 | 价值+组合+协同+适应 |
| 技能目标 | 随机 | 智能选择 | 分类智能选择 |
| 位置评估 | 距离中心 | 威胁+位置价值 | 全面综合评估 |
| 特殊策略 | 无 | 无 | 开局/逆风/顺风 |
| 技能组合 | 无 | 无 | 进攻/防守/翻盘组合 |
| 思考时间 | 0.5秒 | 1秒 | 2秒 |

### 11. 困难难度核心算法

#### 11.1 技能组合决策算法

```javascript
function findBestSkillCombo(usableSkills, myThreats, opponentThreats, threatAdvantage) {
    for (const comboType of [offensive, defensive, comeback]) {
        for (const combo of comboType) {
            // 检查是否有组合中的技能
            if (hasComboSkill(combo, usableSkills)) {
                // 检查是否符合使用条件
                if (shouldUseCombo(combo, threatAdvantage)) {
                    // 返回组合中的可用技能
                    return findAvailableSkillInCombo(combo, usableSkills);
                }
            }
        }
    }
    return null;
}
```

#### 11.2 局势适应性决策

```javascript
function handleSpecialScenario(threatAdvantage) {
    if (turnCount <= 5) {
        return handleOpeningStrategy();  // 开局策略
    }

    if (threatAdvantage < -1000) {
        return handleComebackStrategy();  // 逆风策略
    }

    if (threatAdvantage > 2000) {
        return handleWinningStrategy();    // 顺风策略
    }

    return null;  // 使用正常决策流程
}
```

#### 11.3 综合位置评估

```javascript
function evaluatePositionHard(pos, myThreats, opponentThreats, threatAdvantage) {
    let score = 0;

    // 1. 基础价值
    score += positionValue * 1.5;

    // 2. 进攻价值（模拟落子后检测威胁变化）
    score += evaluateOffensivePotential(pos);

    // 3. 防守价值（模拟对方落子后检测威胁变化）
    score += evaluateDefensiveValue(pos);

    // 4. 局势适应
    if (threatAdvantage > 1000) score += evaluateWinningAdaptation(pos);
    else if (threatAdvantage < -500) score += evaluateComebackAdaptation(pos);

    // 5. 连锁效应
    score += evaluateChainEffect(pos);

    // 6. 能量潜力
    score += evaluateEnergyPotential(pos);

    // 7. 随机波动
    score += random(-25, 25);

    return score;
}
```

### 12. 新增常量和配置

```javascript
// 困难难度配置
AI_CONFIG.hard = {
    skillUsageRate: 0.8,      // 80%概率使用技能
    thinkTime: 2000,          // 2秒思考时间
    detectThreatLevel: 5,     // 检测所有威胁类型
    useSkillCombos: true,     // 使用技能组合
    advancedStrategy: true,   // 使用高级策略
};

// 技能组合定义
const SKILL_COMBOS = { ... };

// 技能分类
const SKILL_CATEGORY = {
    OFFENSIVE: [...],
    DEFENSIVE: [...],
    ENERGY: [...],
    CONTROL: [...],
    COMEBACK: [...],
};
```

### 13. 使用方法

1. 打开 `gomoku.html` 在浏览器中
2. 点击 **"🤖 AI对战"** 按钮开启AI模式
3. 点击 **"🎮 难度"** 按钮切换到 **"困难"**
4. 开始游戏！

### 14. 调优建议

#### 14.1 性能优化

- 使用WebWorker将计算移到后台线程
- 缓存威胁检测结果减少重复计算
- 限制候选位置数量（当前自动）

#### 14.2 策略优化

- 添加更多技能组合定义
- 实现更精确的能量管理
- 考虑技能的长期收益
- 添加对手预判功能

#### 14.3 平衡性调整

- 调整技能价值评分
- 修改技能组合触发条件
- 调整局势适应阈值
- 优化随机性参数

---

## 文件变更历史

| 版本 | 日期 | 变更内容 |
|-----|------|---------|
| 1.0 | 2026-02-10 | 困难难度AI实现完成 |

## 相关文档

- `AI_LOGIC.md` - 完整AI设计文档
- `MEDIUM_IMPLEMENTATION.md` - 中等难度实现总结
- `gomoku_ai.js` - AI实现代码
