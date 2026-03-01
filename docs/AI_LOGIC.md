# 技能五子棋 - AI操作逻辑文档

> 版本：1.0
> 日期：2026-02-10
> 作者：AI系统设计文档

---

## 目录

1. [AI决策框架概述](#1-ai决策框架概述)
2. [局面评估体系](#2-局面评估体系)
3. [基础五子棋策略](#3-基础五子棋策略)
4. [技能使用策略](#4-技能使用策略)
5. [决策流程](#5-决策流程)
6. [难度分级设计](#6-难度分级设计)
7. [特殊场景处理](#7-特殊场景处理)
8. [参数配置](#8-参数配置)

---

## 1. AI决策框架概述

### 1.1 决策架构

```
                    ┌─────────────────┐
                    │   AI决策周期     │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  局面评估    │  │  威胁检测    │  │  机会识别    │
    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │                 │                 │
           └─────────────────┼─────────────────┘
                             ▼
                    ┌─────────────────┐
                    │  行动决策树     │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ 使用技能     │  │  普通落子    │  │  特殊操作    │
    └──────────────┘  └──────────────┘  └──────────────┘
```

### 1.2 决策输入

| 输入类型 | 数据来源 | 说明 |
|---------|---------|------|
| 棋盘状态 | `game.board[15][15]` | 当前棋盘布局 |
| 当前玩家 | `game.currentPlayer` | AI执黑/白 |
| 能量值 | `game.playerEnergy[player]` | 当前可用能量 |
| 可用技能 | `game.currentSkillPool` | 本局技能池 |
| 技能冷却 | `skill.currentCooldown` | 各技能冷却状态 |
| 特殊状态 | 多个状态变量 | 封印、限制区域等 |

### 1.3 决策输出

```
输出格式：{ action: string, params: object }

示例：
- 普通落子：{ action: 'place', row: 7, col: 7 }
- 使用技能：{ action: 'skill', skillId: 's1', target: {row: 5, col: 5} }
- 跳过回合：{ action: 'skip' }
```

---

## 2. 局面评估体系

### 2.1 评估维度

#### 2.1.1 威胁等级评分

```javascript
威胁等级 = max(己方威胁, 对手威胁)

威胁类型          分数      说明
─────────────────────────────────
五连（活五）      100000   即将获胜
五连（冲四）      50000    一端被堵的五连
活四              10000    两端都空的四连
冲四              5000     一端被堵的四连
活三              1000     两端都空的三连
眠三              300      一端被堵的三连
活二              100      两端都空的二连
单子              10       单颗棋子
```

#### 2.1.2 位置价值评分

```javascript
位置价值表（基于棋盘位置的重要性）：

     A  B  C  D  E  F  G  H  I  J  K  L  M  N  O
   ┌────────────────────────────────────────────┐
 1 │  3  8 12 15 18 20 22 20 18 15 12  8  5  3 │
 2 │  8 20 30 40 50 60 70 60 50 40 30 20 12  8 │
 3 │ 12 30 50 70 90 110120110 90 70 50 30 12 │
 4 │ 15 40 70 100130150160150130100 70 40 15 │
 5 │ 18 50 90 130160180200180160130 90 50 18 │
 6 │ 20 60 110150180220240220180150110 60 20 │
 7 │ 22 70 120160200240280240200160120 70 22 │
 8 │ 20 60 110150180220240220180150110 60 20 │
 9 │ 18 50 90 130160180200180160130 90 50 18 │
10 │ 15 40 70 100130150160150130100 70 40 15 │
11 │ 12 30 50 70 90 110120110 90 70 50 30 12 │
12 │  8 20 30 40 50 60 70 60 50 40 30 20 12 │
13 │  3  8 12 15 18 20 22 20 18 15 12  8  5  3 │
   └────────────────────────────────────────────┘
```

#### 2.1.3 综合局面评分

```javascript
总评分 = α×己方威胁 + β×位置价值 + γ×能量优势 + δ×技能优势

其中：
- α = 1000（威胁权重最高）
- β = 1（位置价值）
- γ = 500（能量优势）
- δ = 200×可用高价值技能数（技能优势）
```

### 2.2 连线模式识别

```javascript
// 连线模式定义
const Patterns = {
    // 己方模式
    MY_WIN: 'my_win',           // 己方五连
    MY_LIVE_FOUR: 'my_live4',   // 己方活四
    MY_RUSH_FOUR: 'my_rush4',   // 己方冲四
    MY_LIVE_THREE: 'my_live3',  // 己方活三
    MY_SLEEP_THREE: 'my_sleep3',// 己方眠三
    MY_LIVE_TWO: 'my_live2',    // 己方活二

    // 对方模式
    OP_WIN: 'op_win',           // 对方五连
    OP_LIVE_FOUR: 'op_live4',   // 对方活四
    OP_RUSH_FOUR: 'op_rush4',   // 对方冲四
    OP_LIVE_THREE: 'op_live3',  // 对方活三
    OP_SLEEP_THREE: 'op_sleep3',// 对方眠三
};
```

---

## 3. 基础五子棋策略

### 3.1 落子优先级规则

```
优先级从高到低：

1. 【必胜】己方有五连 → 完成五连获胜
2. 【必救】对方有五连 → 堵截对方五连
3. 【进攻】己方有活四 → 形成五连（必胜）
4. 【防守】对方有活四 → 必须堵截（必救）
5. 【进攻】己方有冲四 → 延伸形成五连
6. 【防守】对方有冲四 → 尽量堵截
7. 【进攻】己方有活三 → 形成活四或冲四
8. 【防守】对方有活三 → 考虑堵截
9. 【布局】选择高价值位置 → 中心区域、星位点
10.【随机】选择空位 → 随机选择合法位置
```

### 3.2 连线检测算法

```javascript
function detectLines(board, player) {
    const lines = [];
    const directions = [
        [0, 1],   // 水平
        [1, 0],   // 垂直
        [1, 1],   // 主对角线
        [1, -1]   // 副对角线
    ];

    for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
            if (board[row][col] !== player) continue;

            for (let [dr, dc] of directions) {
                const line = countLine(board, row, col, dr, dc, player);
                if (line.count >= 2) {
                    lines.push({
                        start: {row, col},
                        direction: {dr, dc},
                        count: line.count,
                        openEnds: line.openEnds
                    });
                }
            }
        }
    }
    return lines;
}
```

### 3.3 最佳落子位置选择

```javascript
function selectBestPosition(game, player) {
    // 1. 检查必胜/必救位置
    const criticalMove = findCriticalMove(game, player);
    if (criticalMove) return criticalMove;

    // 2. 评估所有候选位置
    const candidates = getCandidatePositions(game);

    // 3. 对每个位置评分
    const scored = candidates.map(pos => ({
        ...pos,
        score: evaluatePosition(game, pos, player)
    }));

    // 4. 返回最高分位置
    return scored.sort((a, b) => b.score - a.score)[0];
}
```

---

## 4. 技能使用策略

### 4.1 技能分类与优先级

#### 4.1.1 技能价值评级

```
┌─────────────┬──────────┬────────────────────────────────┐
│ 评级        │ 分数范围 │ 技能示例                      │
├─────────────┼──────────┼────────────────────────────────┤
│ S级（必用） │ 90-100   │ 趁火打劫、擒贼擒王            │
│ A级（高优） │ 70-89    │ 围魏救赵、笑里藏刀            │
│ B级（中优） │ 50-69    │ 瞒天过海、无中生有            │
│ C级（普通） │ 30-49    │ 浑水摸鱼、假痴不癫            │
│ D级（低优） │ 10-29    │ 打草惊蛇、以逸待劳            │
└─────────────┴──────────┴────────────────────────────────┘
```

#### 4.1.2 按使用场景分类

| 场景 | 推荐技能 | 使用条件 |
|-----|---------|---------|
| **对方有四连** | 趁火打劫、李代桃僵 | 能量充足 |
| **对方有活四** | 围魏救赵、擒贼擒王 | 紧急防守 |
| **己方有进攻机会** | 笑里藏刀、连环计 | 能量充足 |
| **需要布局** | 无中生有、树上开花 | 前期 |
| **逆风翻盘** | 美人计、走为上策 | 局势落后 |
| **控制节奏** | 隔岸观火、空城计 | 限制对手 |

### 4.2 技能使用决策树

```
                          ┌──────────────┐
                          │  AI回合开始  │
                          └──────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
             ┌──────────┐  ┌──────────┐  ┌──────────┐
             │对方有五连?│  │对方有四连?│  │己方有机会?│
             └────┬─────┘  └────┬─────┘  └────┬─────┘
                  │是          │是          │是
                  ▼            ▼            ▼
             ┌──────────┐  ┌──────────┐  ┌──────────┐
             │使用紧急   │  │使用破坏   │  │使用进攻   │
             │防守技能   │  │技能       │  │技能       │
             └──────────┘  └──────────┘  └──────────┘
                  │            │            │
                  └────────────┼────────────┘
                               ▼
                    ┌──────────────────┐
                    │  检查技能可用性   │
                    │  - 能量是否足够   │
                    │  - CD是否完毕     │
                    │  - 目标是否有效   │
                    └────────┬─────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
             ┌──────────┐      ┌──────────┐
             │ 使用技能  │      │ 普通落子  │
             └──────────┘      └──────────┘
```

### 4.3 各技能详细策略

#### 4.3.1 胜战计（压制型）

| 技能 | 使用时机 | 目标选择 | 备注 |
|-----|---------|---------|------|
| 瞒天过海 | 己方棋子位置不利 | 选择参与连线最少的己方棋子 | 跳到进攻关键位置 |
| 围魏救赵 | 对方有三连 | 自动标记对方威胁最大的三连 | 强制对方防守 |
| 借刀杀人 | 对方有关键棋子 | 选择对方高价值棋子 + 己方低价值棋子 | 换子赚便宜 |
| 以逸待劳 | 能量不足/前期 | 无需目标 | 跳过回合计能量 |
| 趁火打劫 | **对方有四连** | 自动选择对方四连中的棋子 | 优先级极高 |
| 声东击西 | 需要布局 | 选择两个关键位置 | 制造威胁 |

#### 4.3.2 敌战计（对抗型）

| 技能 | 使用时机 | 目标选择 | 备注 |
|-----|---------|---------|------|
| 无中生有 | 前期/需要制造威胁 | 选择空旷区域 | 3回合后消失 |
| 暗度陈仓 | 迷惑对手 | 选择参与连线的己方棋子 | 伪装效果 |
| 隔岸观火 | 对方能量高 | 无需目标 | 封印对方技能 |
| 笑里藏刀 | 有进攻机会 | 选择对方棋子附近 | 落子+转化 |
| 李代桃僵 | **对方有四连** | 牺牲己方弱棋 + 删除对方四连 | 优先级高 |
| 顺手牵羊 | 对方刚落子 | 选择对方刚落的子 | 干扰对方布局 |

#### 4.3.3 攻战计（进攻型）

| 技能 | 使用时机 | 目标选择 | 备注 |
|-----|---------|---------|------|
| 打草惊蛇 | 能量不足 | 无需目标 | 快速获取能量 |
| 借尸还魂 | 对方刚用强力技能 | 无需目标 | 复制技能 |
| 调虎离山 | 对方有关键棋子 | 选择对方连线最多的棋子 | 破坏对方布局 |
| 欲擒故纵 | 需要限制对手 | 选择3个有利位置 | 强制对方落子 |
| 抛砖引玉 | 有进攻计划 | 选择关键位置 | 引导对方落子 |
| 擒贼擒王 | **对方有强棋** | 自动选择对方关键棋子 | 破坏性极强 |

#### 4.3.4 混战计（乱局型）

| 技能 | 使用时机 | 目标选择 | 备注 |
|-----|---------|---------|------|
| 釜底抽薪 | 对方有孤立棋子 | 选择对方未参与连线的棋子 | 削弱对方 |
| 浑水摸鱼 | 需要调整阵型 | 选择可移动的己方棋子 + 相邻空位 | 微调位置 |
| 金蝉脱壳 | 棋子位置不利 | 选择需要移动的己方棋子 + 目标位置 | 传送效果 |
| 关门捉贼 | 需要限制对手 | 选择限制区域的中心 | 区域3×3 |
| 远交近攻 | 布局/进攻 | 自动计算最远位置 + 删除对方棋子 | 远距离进攻 |
| 假途伐虢 | 对方有相邻棋子 | 选择对方两颗相邻棋子之间 | 阻断连线 |

#### 4.3.5 并战计（转化型）

| 技能 | 使用时机 | 目标选择 | 备注 |
|-----|---------|---------|------|
| 偷梁换柱 | 对方有连线多的棋子 | 选择对方参与连线最多的棋子 | 转化为己方 |
| 指桑骂槐 | 有进攻机会 | 选择对方棋子密集区域 | 削弱周围棋子 |
| 假痴不癫 | 落子位置孤立 | 选择孤立位置落子 | 落后时使用 |
| 上屋抽梯 | 对方有三连/四连 | 选择对方连线中的棋子 + 相邻位置 | 破坏连线 |
| 树上开花 | 需要制造威胁 | 选择中心位置的己方棋子 | 放置4个临时子 |
| 反客为主 | 双方都有连线多的棋子 | 自动选择双方关键棋子交换 | 扭转局势 |

#### 4.3.6 败战计（翻盘型）

| 技能 | 使用时机 | 目标选择 | 备注 |
|-----|---------|---------|------|
| 美人计 | **逆风局** | 选择对方棋子密集位置 | 使对方棋子中立 |
| 空城计 | 需要保护区域 | 选择保护区域的中心 | 双方都不能落子 |
| 反间计 | 对方有未展示技能 | 无需目标 | 查看并延长CD |
| 苦肉计 | 落子位置关键 | 选择关键位置落子 | 永久免疫 |
| 连环计 | 有进攻机会 | 无需目标 | 连落两子 |
| 走为上策 | **逆风局** | 选择需要移动的己方棋子 + 目标位置 | 移动+免疫 |

### 4.4 技能组合策略

```
常用技能组合：

1. 进攻组合：
   无中生有 → 假痴不癫 → 树上开花
   （制造威胁 → 获取能量 → 扩大优势）

2. 防守组合：
   隔岸观火 → 空城计 → 围魏救赵
   （封印技能 → 保护区域 → 强制防守）

3. 翻盘组合：
   美人计 → 偷梁换柱 → 反客为主
   （削弱对手 → 转化棋子 → 扭转局势）

4. 控制组合：
   抛砖引玉 → 欲擒故纵 → 关门捉贼
   （引导落子 → 限制选择 → 区域控制）
```

---

## 5. 决策流程

### 5.1 主决策流程

```javascript
function makeDecision(game, aiPlayer) {
    // ========== 第一步：局势分析 ==========
    const situation = analyzeSituation(game, aiPlayer);

    // ========== 第二步：紧急情况处理 ==========
    if (situation.opponentHasWin) {
        return handleEmergency(game, aiPlayer);  // 对方有五连
    }

    // ========== 第三步：技能决策 ==========
    const skillDecision = decideSkillUse(game, aiPlayer, situation);
    if (skillDecision.shouldUse) {
        return {
            action: 'skill',
            skillId: skillDecision.skillId,
            target: skillDecision.target
        };
    }

    // ========== 第四步：普通落子 ==========
    const bestMove = selectBestPosition(game, aiPlayer);
    return {
        action: 'place',
        row: bestMove.row,
        col: bestMove.col
    };
}
```

### 5.2 局势分析函数

```javascript
function analyzeSituation(game, player) {
    const opponent = getOpponent(player);

    return {
        // 威胁检测
        myThreats: detectThreats(game, player),
        opponentThreats: detectThreats(game, opponent),

        // 能量状态
        myEnergy: game.getPlayerEnergy(player),
        opponentEnergy: game.getPlayerEnergy(opponent),
        energyAdvantage: game.getPlayerEnergy(player) - game.getPlayerEnergy(opponent),

        // 技能状态
        usableSkills: getUsableSkills(game, player),
        opponentUsableSkills: getUsableSkills(game, opponent),

        // 棋盘控制
        myStones: countStones(game, player),
        opponentStones: countStones(game, opponent),
        controlCenter: controlCenter(game, player),

        // 特殊状态
        isSealed: isSkillSealed(game, player),
        restrictedArea: getRestrictedArea(game, player),
    };
}
```

### 5.3 技能决策函数

```javascript
function decideSkillUse(game, player, situation) {
    const usableSkills = situation.usableSkills;

    // 按优先级排序技能
    const prioritizedSkills = prioritizeSkills(usableSkills, situation);

    // 检查每个技能的使用条件
    for (const skill of prioritizedSkills) {
        if (shouldUseSkill(game, player, skill, situation)) {
            return {
                shouldUse: true,
                skillId: skill.id,
                target: selectSkillTarget(game, player, skill, situation)
            };
        }
    }

    return { shouldUse: false };
}
```

---

## 6. 难度分级设计

### 6.1 简单难度 (Easy)

```
特点：
- 随机落子为主
- 技能使用随机
- 基本防守逻辑

决策参数：
- 威胁检测：仅检测五连
- 技能使用率：20%
- 思考时间：< 0.5秒
- 技能优先级：不考虑
```

### 6.2 中等难度 (Medium)

```
特点：
- 基本攻守逻辑
- 合理使用技能
- 局面评估简单
- 威胁响应准确

决策参数：
- 威胁检测：五连、四连、活三
- 技能使用率：50%
- 思考时间：< 1秒
- 技能优先级：考虑高价值技能

决策优先级：
1. 己方能获胜 → 完成五连
2. 对方有五连 → 堵截五连
3. 己方有活四 → 形成五连（必胜）
4. 对方有活四 → 堵截活四
5. 对方有冲四 → 尽量堵截
6. 考虑使用技能
7. 普通落子（考虑位置价值和威胁创造）

技能选择策略：
- 基础价值：按技能预设价值评分
- 局势加成：
  · 对方有四连时，防守型技能+50分
  · 己方有活三时，进攻型技能+30分
  · 能量低时，能量获取技能+40分
- 目标选择：
  · 棋子目标：优先选择参与连线的棋子
  · 空位目标：优先选择高价值位置

位置评估策略：
- 基础分：位置价值表（中心区域高）
- 进攻价值：该位置能创造的威胁（活四+5000，活三+500）
- 防守价值：该位置能阻止的威胁（堵活四+3000，堵冲四+1000）
- 随机性：±30分波动
```

#### 中等难度核心算法

**威胁检测算法：**
```javascript
// 全面威胁检测
function detectAllThreats(board, player) {
    return {
        win: detectFiveInRow(board, player),
        liveFour: detectOpenFour(board, player),
        rushFour: detectClosedFour(board, player),
        liveThree: detectOpenThree(board, player),
        sleepThree: detectClosedThree(board, player),
    };
}
```

**技能优先级调整：**
```javascript
// 根据局势动态调整技能价值
function adjustSkillValue(skill, situation) {
    let value = skill.baseValue;

    if (situation.opponentHasFour) {
        if (skill.isDefensive) value += 50;
    }
    if (situation.myHasThree) {
        if (skill.isOffensive) value += 30;
    }
    if (situation.myEnergy < 5) {
        if (skill.givesEnergy) value += 40;
    }

    return value;
}
```

**位置评估函数：**
```javascript
// 综合评估位置价值
function evaluatePosition(pos, situation) {
    let score = positionValueTable[pos.row][pos.col];

    // 进攻价值
    if (createsLiveFour(pos)) score += 5000;
    if (createsLiveThree(pos)) score += 500;

    // 防守价值
    if (blocksOpponentFour(pos)) score += 3000;
    if (blocksOpponentThree(pos)) score += 300;

    return score + random(-15, 15);
}
```

### 6.3 困难难度 (Hard)

```
特点：
- 深度攻守逻辑
- 精准技能使用
- 局面评估全面
- 技能组合运用

决策参数：
- 威胁检测：所有连线模式
- 技能使用率：80%
- 思考时间：< 2秒
- 技能优先级：完整考虑
- 技能组合：考虑连招
```

### 6.4 专家难度 (Expert)

```
特点：
- 预判对手行动
- 复杂技能组合
- 长期战略规划
- 动态调整策略

决策参数：
- 威胁检测：所有模式 + 潜在威胁
- 技能使用率：95%（有效使用）
- 思考时间：< 3秒
- 技能优先级：完整考虑
- 技能组合：复杂连招
- 预判深度：2-3步
```

---

## 7. 特殊场景处理

### 7.1 开局策略

```
开局5步内的特殊逻辑：

1. 优先占领中心区域（中心5×5区域）
2. 避免使用消耗型技能
3. 优先使用能量获取技能（打草惊蛇、以逸待劳）
4. 建立基础棋型（活二、活三）
```

### 7.2 收官策略

```
棋盘接近满时的特殊逻辑：

1. 优先完成己方连线
2. 优先破坏对方连线
3. 不使用布局型技能（无中生有、树上开花）
4. 优先使用即时效果技能
```

### 7.3 逆风策略

```
落后时的特殊逻辑：

1. 检测落后程度（威胁差 > 2个等级）
2. 优先使用翻盘型技能（败战计）
3. 制造混乱局面（混战计）
4. 转化对方棋子（并战计）
5. 冒险进攻（高风险高回报）
```

### 7.4 顺风策略

```
领先时的特殊逻辑：

1. 保持优势，稳健落子
2. 防止对方翻盘
3. 使用控制型技能限制对手
4. 避免冒险操作
5. 扩大领先优势
```

### 7.5 特殊状态处理

| 状态 | 处理方式 |
|-----|---------|
| 技能被封印 | 仅使用普通落子，调整策略 |
| 落子区域受限 | 在允许区域内选择最佳位置 |
| 被强制落子 | 在指定位置中选择最有利的 |
| 对方有中立棋子 | 中立棋子区域不参与连线计算 |
| 己方棋子被削弱 | 调整连线评估，忽略被削弱棋子 |

---

## 8. 参数配置

### 8.1 评估权重参数

```javascript
const AI_CONFIG = {
    // 威胁等级权重
    threatWeights: {
        WIN: 100000,        // 五连
        LIVE_FOUR: 10000,   // 活四
        RUSH_FOUR: 5000,    // 冲四
        LIVE_THREE: 1000,   // 活三
        SLEEP_THREE: 300,   // 眠三
        LIVE_TWO: 100,      // 活二
        SINGLE: 10,         // 单子
    },

    // 综合评估权重
    evaluationWeights: {
        threat: 1000,       // 威胁权重
        position: 1,        // 位置权重
        energy: 500,        // 能量权重
        skill: 200,         // 技能权重
    },

    // 技能使用率（按难度）
    skillUsageRate: {
        easy: 0.2,
        medium: 0.5,
        hard: 0.8,
        expert: 0.95,
    },

    // 技能价值评分
    skillValue: {
        // 胜战计
        's1': 60,   // 瞒天过海
        's2': 85,   // 围魏救赵
        's3': 70,   // 借刀杀人
        's4': 20,   // 以逸待劳
        's5': 95,   // 趁火打劫
        's6': 55,   // 声东击西

        // 敌战计
        'e1': 50,   // 无中生有
        'e2': 45,   // 暗度陈仓
        'e3': 75,   // 隔岸观火
        'e4': 80,   // 笑里藏刀
        'e5': 90,   // 李代桃僵
        'e6': 40,   // 顺手牵羊

        // 攻战计
        'a1': 25,   // 打草惊蛇
        'a2': 65,   // 借尸还魂
        'a3': 60,   // 调虎离山
        'a4': 50,   // 欲擒故纵
        'a5': 55,   // 抛砖引玉
        'a6': 95,   // 擒贼擒王

        // 混战计
        'c1': 40,   // 釜底抽薪
        'c2': 35,   // 浑水摸鱼
        'c3': 50,   // 金蝉脱壳
        'c4': 60,   // 关门捉贼
        'c5': 65,   // 远交近攻
        'c6': 45,   // 假途伐虢

        // 并战计
        'm1': 85,   // 偷梁换柱
        'm2': 55,   // 指桑骂槐
        'm3': 30,   // 假痴不癫
        'm4': 70,   // 上屋抽梯
        'm5': 60,   // 树上开花
        'm6': 80,   // 反客为主

        // 败战计
        'd1': 90,   // 美人计
        'd2': 50,   // 空城计
        'd3': 40,   // 反间计
        'd4': 70,   // 苦肉计
        'd5': 85,   // 连环计
        'd6': 90,   // 走为上策
    },
};
```

### 8.2 搜索深度参数

```javascript
const SEARCH_CONFIG = {
    // 搜索深度（按难度）
    searchDepth: {
        easy: 1,
        medium: 2,
        hard: 3,
        expert: 4,
    },

    // 候选位置数量
    candidateCount: {
        easy: 5,
        medium: 10,
        hard: 15,
        expert: 20,
    },

    // 思考时间限制（毫秒）
    thinkTime: {
        easy: 500,
        medium: 1000,
        hard: 2000,
        expert: 3000,
    },
};
```

---

## 附录A：连线检测算法详解

### A.1 连线计数函数

```javascript
function countLine(board, row, col, dr, dc, player) {
    let count = 1;
    let openEnds = 0;

    // 正向计数
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
    }
    // 检查正向端点是否开放
    if (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === null) {
        openEnds++;
    }

    // 反向计数
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
    }
    // 检查反向端点是否开放
    if (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === null) {
        openEnds++;
    }

    return { count, openEnds };
}
```

### A.2 威胁类型判断

```javascript
function getThreatType(count, openEnds) {
    if (count >= 5) return 'WIN';
    if (count === 4) {
        if (openEnds === 2) return 'LIVE_FOUR';
        if (openEnds === 1) return 'RUSH_FOUR';
    }
    if (count === 3) {
        if (openEnds === 2) return 'LIVE_THREE';
        if (openEnds === 1) return 'SLEEP_THREE';
    }
    if (count === 2 && openEnds === 2) return 'LIVE_TWO';
    if (count === 1) return 'SINGLE';
    return 'NONE';
}
```

---

## 附录B：技能目标选择算法

### B.1 技能目标选择器

```javascript
function selectSkillTarget(game, player, skill, situation) {
    switch (skill.id) {
        // 需要选择棋子的技能
        case 's1': // 瞒天过海
        case 's3': // 借刀杀人
        case 'e2': // 暗度陈仓
            return selectBestStoneTarget(game, player, skill);

        // 需要选择位置的技能
        case 'e1': // 无中生有
        case 'e4': // 笑里藏刀
        case 'a4': // 欲擒故纵
            return selectBestPositionTarget(game, player, skill);

        // 自动目标的技能
        case 's2': // 围魏救赵
        case 's5': // 趁火打劫
        case 'a6': // 擒贼擒王
            return selectAutoTarget(game, player, skill);

        // 无需目标的技能
        default:
            return null;
    }
}
```

### B.2 棋子目标选择

```javascript
function selectBestStoneTarget(game, player, skill) {
    const targets = [];
    for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
            // 根据技能要求筛选目标
            if (isValidTarget(game, row, col, player, skill)) {
                targets.push({
                    row, col,
                    score: evaluateTarget(game, row, col, player, skill)
                });
            }
        }
    }
    // 返回最高分目标
    return targets.sort((a, b) => b.score - a.score)[0];
}
```

---

## 文档修订历史

| 版本 | 日期 | 修订内容 | 作者 |
|-----|------|---------|------|
| 1.0 | 2026-02-10 | 初始版本，完整AI逻辑设计 | AI系统 |

---

## 版权声明

本文档为技能五子棋项目的AI设计文档，仅供项目内部使用。
