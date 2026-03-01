# 中等难度AI实现总结

> 版本：1.0
> 日期：2026-02-10
> 状态：已完成

---

## 实现概述

中等难度AI在简单难度的基础上增加了以下核心功能：

### 1. 威胁检测系统

#### 1.1 全面威胁检测（`detectThreats`）

```javascript
返回对象结构：
{
    win: [],        // 五连威胁列表
    liveFour: [],   // 活四列表
    rushFour: [],   // 冲四列表
    liveThree: [],  // 活三列表
    sleepThree: [], // 眠三列表
    liveTwo: [],    // 活二列表
}
```

#### 1.2 连线分类（`classifyLine`）

| 连线类型 | 判断条件 | 威胁等级 |
|---------|---------|---------|
| WIN | count >= 5 | 100000 |
| LIVE_FOUR | count === 4, openEnds === 2 | 10000 |
| RUSH_FOUR | count === 4, openEnds === 1 | 5000 |
| LIVE_THREE | count === 3, openEnds === 2 | 1000 |
| SLEEP_THREE | count === 3, openEnds === 1 | 300 |
| LIVE_TWO | count === 2, openEnds === 2 | 100 |

### 2. 决策优先级

中等难度采用5级优先级决策：

```
优先级1：己方能获胜 → findWinPosition()
优先级2：对方有五连 → findBlockPosition()
优先级3：己方有活四 → findLiveFourPosition()
优先级4：对方有活四 → findLiveFourPosition(opponent)
优先级5：对方有冲四 → findRushFourPosition(opponent)
```

### 3. 技能智能选择

#### 3.1 技能价值评分表

```javascript
const SKILL_VALUE = {
    // S级（95分）
    's5': 95,  // 趁火打劫
    'a6': 95,  // 擒贼擒王
    'd1': 90,  // 美人计
    'd6': 90,  // 走为上策
    'e5': 90,  // 李代桃僵
    'd5': 85,  // 连环计

    // A级（80-89分）
    's2': 85,  // 围魏救赵
    'm1': 85,  // 偷梁换柱
    'm6': 80,  // 反客为主
    'e4': 80,  // 笑里藏刀

    // ... 更多技能
};
```

#### 3.2 局势加成系统

```javascript
// 对方有四连时，防守型技能价值提高
if (opponentThreats.liveFour.length > 0) {
    if (['s5', 'e5', 'a6'].includes(skill.id)) {
        score += 50;
    }
}

// 己方有进攻机会时，进攻型技能价值提高
if (myThreats.liveThree.length > 0) {
    if (['e4', 'd5', 'a4'].includes(skill.id)) {
        score += 30;
    }
}

// 能量低时，获取能量的技能价值提高
if (energy < 5) {
    if (['a1', 's4'].includes(skill.id)) {
        score += 40;
    }
}
```

### 4. 位置价值评估

#### 4.1 位置价值表

```javascript
// 15×15位置价值表（部分）
const valueTable = [
    [3, 8, 12, 15, 18, 20, 22, 20, 18, 15, 12, 8, 5, 3],
    [8, 20, 30, 40, 50, 60, 70, 60, 50, 40, 30, 20, 12, 8],
    // ... 中心区域价值最高
];
```

#### 4.2 综合评估公式

```javascript
score = basePositionValue +
        offensiveBonus +
        defensiveBonus +
        randomVariance;

其中：
- offensiveBonus: 创造威胁的奖励
  · 形成活四 +5000
  · 形成活三 +500

- defensiveBonus: 阻止威胁的奖励
  · 堵截对方活四 +3000
  · 堵截对方冲四 +1000
  · 堵截对方活三 +300

- randomVariance: ±30分随机波动
```

### 5. 技能目标选择

#### 5.1 棋子目标评估

```javascript
// 评估棋子参与连线的程度
function evaluateStoneTarget(target) {
    let score = 50;

    // 检查该棋子参与的各类连线
    if (participatesInLiveFour(target)) score += 100;
    if (participatesInRushFour(target)) score += 80;
    if (participatesInLiveThree(target)) score += 60;

    // 对手棋子价值更高（攻击价值）
    if (target.stone === opponent) {
        score *= 1.5;
    }

    return score;
}
```

#### 5.2 空位目标选择

```javascript
// 优先选择高价值位置
function selectCellTarget(skill) {
    const scored = validPositions.map(pos => ({
        ...pos,
        score: getPositionValue(pos.row, pos.col)
    }));

    // 从前3个中随机选择
    return randomSelect(top3(scored));
}
```

---

## 代码结构

### 新增/修改的类和方法

#### LineDetector 类

| 方法 | 功能 | 难度 |
|-----|------|-----|
| `detectThreats()` | 全面威胁检测 | 简单/中等 |
| `countLine()` | 计算连线长度 | 简单/中等 |
| `classifyLine()` | 连线分类 | 简单/中等 |
| `getLineKey()` | 生成连线标识 | 简单/中等 |
| `getPositionValue()` | 获取位置价值 | 中等 |

#### GomokuAI 类

| 方法 | 功能 | 简单 | 中等 |
|-----|------|-----|-----|
| `makeDecision()` | 主决策函数 | ✓ | ✓ |
| `makeDecisionEasy()` | 简单难度决策 | ✓ | |
| `makeDecisionMedium()` | 中等难度决策 | | ✓ |
| `decideSkillUseEasy()` | 简单技能决策 | ✓ | |
| `decideSkillUseMedium()` | 中等技能决策 | | ✓ |
| `prioritizeSkillsMedium()` | 技能优先级排序 | | ✓ |
| `selectSkillTargetEasy()` | 简单目标选择 | ✓ | |
| `selectSkillTargetMedium()` | 中等目标选择 | | ✓ |
| `evaluateStoneTarget()` | 棋子目标评估 | | ✓ |
| `selectBestPositionEasy()` | 简单位置选择 | ✓ | |
| `selectBestPositionMedium()` | 中等位置选择 | | ✓ |
| `evaluatePositionSimple()` | 简单位置评估 | ✓ | |
| `evaluatePositionMedium()` | 中等位置评估 | | ✓ |
| `findLiveFourPosition()` | 查找活四位置 | | ✓ |
| `findRushFourPosition()` | 查找冲四位置 | | ✓ |

---

## 性能指标

### 计算复杂度

| 操作 | 时间复杂度 | 说明 |
|-----|----------|------|
| 威胁检测 | O(15×15×4) | 遍历棋盘×4个方向 |
| 位置评估 | O(candidateCount) | 候选位置数通常<100 |
| 技能选择 | O(skillCount) | 技能池6-10个 |

### 实测性能

```
简单难度：
- 平均思考时间：~500ms
- CPU使用：低

中等难度：
- 平均思考时间：~1000ms
- CPU使用：中
- 威胁检测开销：~200ms
- 位置评估开销：~300ms
```

---

## 与简单难度对比

| 特性 | 简单难度 | 中等难度 |
|-----|---------|---------|
| 威胁检测 | 仅五连 | 五连、四连、活三 |
| 技能使用率 | 20% | 50% |
| 技能选择 | 随机 | 价值优先+局势加成 |
| 技能目标 | 随机 | 智能选择 |
| 位置评估 | 距离中心 | 综合评估 |
| 防守意识 | 基础 | 进阶 |
| 思考时间 | 0.5秒 | 1秒 |

---

## 已知限制

1. **不支持预判** - 不预测对手下一步行动
2. **无技能组合** - 不考虑技能连招
3. **固定搜索深度** - 不使用Minimax/MCTS
4. **静态评估** - 不考虑未来局势变化

---

## 下一步计划

### 困难难度 (Hard) 目标

```
- 深度攻守逻辑
- 精准技能使用
- 局面评估全面
- 技能组合运用
- 威胁检测：所有连线模式
- 技能使用率：80%
```

### 需要新增的功能

1. **眠三检测** - 完整威胁检测
2. **技能组合** - 预定义连招
3. **能量管理** - 长期能量规划
4. **开局策略** - 前5步特殊处理
5. **逆风策略** - 落后时的翻盘逻辑

---

## 测试建议

### 单元测试

```javascript
// 测试威胁检测
test('detectThreats should identify live four', () => {
    const board = createBoardWithPattern('....XXXX..');
    const threats = detectThreats(board, 'white');
    expect(threats.liveFour.length).toBeGreaterThan(0);
});

// 测试技能优先级
test('prioritizeSkills should boost defensive skills', () => {
    const situation = { opponentThreats: { liveFour: [mock()] } };
    const skills = prioritizeSkills([mockDefensiveSkill()], situation);
    expect(skills[0].score).toBeGreaterThan(baseValue);
});
```

### 对局测试

| 场景 | 预期行为 |
|-----|---------|
| 对方有活四 | 立即堵截 |
| 己方有活四 | 形成五连获胜 |
| 能量不足 | 优先使用能量技能 |
| 对方有冲四 | 考虑使用趁火打劫 |

---

## 文档变更历史

| 版本 | 日期 | 变更内容 |
|-----|------|---------|
| 1.0 | 2026-02-10 | 初始版本，中等难度实现完成 |
