# AI系统集成指南

## 📋 概述

本次迭代开发已将以下AI系统集成到技能五子棋app中：

| 组件 | 文件 | 功能描述 |
|------|------|----------|
| AlphaBeta搜索 | `gomoku_ai.js` | 带剪枝的博弈树搜索算法 |
| 开局库系统 | `gomoku_ai.js` | 13种专业开局定式 |
| 威胁空间搜索 | `gomoku_ai.js` | 终局必胜序列查找 |
| 技能组合系统 | `gomoku_ai.js` | 技能连击与组合加成 |
| 完整36计技能 | `ALL_36_SKILLS.js` | 36个三十六计技能完整实现 |
| 对战记录系统 | `GameRecorder.js` | 对局记录与SGF导出 |
| AI难度自适应 | `AIAdaptiveSystem.js` | 动态难度调整 |
| UI增强系统 | `UIEnhancements.js` | 动画、音效、响应式布局 |

## 🔗 文件引用关系

```
gomoku.html (主游戏)
    ├── gomoku_ai_enhanced.js (新增) ⚠️ 必须先加载
    ├── gomoku_ai.js (原AI系统)
    └── (可选) 其他扩展文件
```

## 📝 使用方法

### 1. 直接打开游戏

直接用浏览器打开 `gomoku.html` 即可游玩，新AI系统会自动集成。

### 2. 查看AI状态

在游戏控制台中可以看到AI的决策信息：

```javascript
// 在浏览器控制台输入
console.log(game.aiInstance);  // 查看AI实例
console.log(game.aiSystem);  // 查看AI系统状态
```

### 3. 测试集成状态

打开 `ai_integration_test.html` 可以运行集成测试。

## ⚙️ AI配置说明

### 难度参数

| 难度 | 搜索深度 | AlphaBeta | 开局库 | 技能使用率 |
|------|---------|-----------|--------|-----------|
| 简单 | 1层 | ❌ | ❌ | 20% |
| 中等 | 2层 | ✅ | ❌ | 50% |
| 困难 | 4层 | ✅ | ✅ | 80% |

### 修改AI参数

在 `gomoku_ai.js` 中修改 `AI_CONFIG` 对象：

```javascript
const AI_CONFIG = {
    hard: {
        searchDepth: 6,           // 增加搜索深度
        thinkTime: 3000,         // 延长思考时间
        skillUsageRate: 1.0      // 100%使用技能
    }
};
```

## 🎮 新增功能说明

### 1. AlphaBeta搜索
- 实现了带alpha-beta剪枝的博弈树搜索
- 支持可配置的搜索深度
- 包含置换表优化和历史启发

### 2. 开局库系统
- 包含13种专业开局定式（花月、浦月、瑞星等）
- 自动识别和匹配开局模式
- 支持基于历史数据的学习优化

### 3. 威胁空间搜索
- 终局必胜序列检测
- 双重威胁查找
- 关键防守位置识别

### 4. 技能组合系统
- 检测技能组合连击
- 动态组合加成计算
- 推荐最优技能组合

### 5. 完整36计技能
- 所有36个三十六计技能完整实现
- 胜战计、敌战计、攻战计、混战计、并战计、败战计
- 每个技能都有独立的能量消耗和冷却时间

## 📊 性能优化

### 搜索效率

| 难度 | 每步思考时间 | 节点数(约) |
|------|---------------|------------|
| 简单 | < 0.5s | < 100 |
| 中等 | 1-2s | 500-2000 |
| 困难 | 2-4s | 5000-20000 |

### 优化技术

- **置换表**: 缓存已计算的搜索结果
- **历史启发**: 记录导致剪枝的移动
- **杀手启发**: 记录每层的最佳移动
- **迭代加深**: 逐步增加搜索深度

## 🔧 故障排除

### 问题1: AI没有响应

检查浏览器控制台是否有错误。

### 问题2: 技能无法使用

确保 `gomoku_ai_enhanced.js` 在 `gomoku_ai.js` 之前加载。

### 问题3: 搜索速度慢

降低 `AI_CONFIG.hard.searchDepth` 的值。

## 📚 API文档

### GomokuAIEnhanced 类

```javascript
const ai = new GomokuAIEnhanced(game, 'black', 'hard');

// 获取AI决策
const decision = ai.makeDecision();
// 返回: { action: 'place' | 'skill', row, col, skillId, target }

// 开局库查询
const openingMove = ai.openingBook.query(moveHistory, player);

// 威胁空间搜索
const threatResult = ai.threatSearch.findWinningSequence(6);
```

### LineDetector 类

```javascript
// 检测获胜
const winInfo = LineDetector.detectWin(board, 'black');

// 检测威胁
const threats = LineDetector.detectThreats(board, 'black');

// 计算威胁分数
const score = LineDetector.calculateThreatScore(threats);

// 获取候选位置
const candidates = LineDetector.getCandidatePositions(board);
```

### OpeningBook 类

```javascript
const book = new OpeningBook();

// 查询开局推荐
const move = book.query(moveHistory, player);

// 获取推荐开局列表
const recommended = book.getRecommendedOpenings(5);
```

## 🚀 未来扩展方向

1. **MCTS算法**: 蒙特卡洛树搜索
2. **神经网络**: 训练策略网络
3. **残局数据库: 完整的残局库
4. **多人对战**: 在线对战功能
5. **回放系统**: 完整的对局回放
