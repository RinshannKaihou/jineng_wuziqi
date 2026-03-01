# 三十六计 · 技能五子棋

一个基于三十六计设计的技能五子棋游戏。

## 文件说明

| 文件 | 说明 |
|------|------|
| `gomoku.html` | 主游戏文件，包含游戏UI和主逻辑 |
| `js/core/ALL_36_SKILLS.js` | **36个技能完整实现** |
| `js/core/SKILL_TEMPLATE.js` | **技能代码模板**，提供可直接复制的代码模板 |
| `js/core/gomoku_ai.js` | **AI系统核心**，包含简单/中等/困难难度实现 |
| `js/systems/AIAdaptiveSystem.js` | AI难度自适应系统 |
| `js/systems/GameRecorder.js` | 对局记录与SGF导出系统 |
| `js/systems/UIEnhancements.js` | UI增强系统（动画、音效） |
| `docs/技能清单.md` | **技能规范文档**，定义所有技能的属性与效果 |
| `docs/AI_LOGIC.md` | AI决策逻辑完整设计文档 |
| `docs/AI_INTEGRATION_README.md` | AI系统集成指南 |
| `docs/36计.rtf` | 原始设计方案文档 |

## 快速开始

1. 直接用浏览器打开 `gomoku.html` 即可游玩
2. 每局随机选择 6-10 个技能作为本局技能池
3. 技能为双方共享，CD公用，能量独立

## 编辑技能

### 方式一：修改现有技能

1. 打开 `docs/技能清单.md` 查看技能定义
2. 打开 `js/core/ALL_36_SKILLS.js` 找到对应的技能类
3. 修改 `constructor` 中的属性或 `use` 方法中的逻辑
4. 刷新浏览器测试

### 方式二：添加新技能

1. 复制 `js/core/SKILL_TEMPLATE.js` 中的模板
2. 在 `js/core/ALL_36_SKILLS.js` 的末尾添加新技能类
3. 在文件末尾的 `ALL_SKILLS` 数组中添加注册：
   ```javascript
   const ALL_SKILLS = [
       // ... 其他技能
       YourSkillClass,  // 添加你的技能
   ];
   ```
4. 刷新浏览器测试

### 示例：添加一个简单的能量转移技能

```javascript
// 1. 在 gomoku.html 中添加技能类
class StealEnergy extends Skill {
    constructor() {
        super({
            id: 'steal_energy',
            name: '偷取能量',
            icon: '💰',
            cost: 2,
            cooldown: 3,
            category: '混战计',
            description: '从对手处偷取1点能量',
            targetType: SkillTargetType.NONE
        });
    }
    use(game, target, player) {
        const opponent = game.getOpponent(player);
        if (game.getPlayerEnergy(opponent) < 1) {
            game.showEffect(7, 7, '❌ 对手能量不足');
            return false;
        }
        game.consumeEnergy(opponent, 1);
        game.addEnergy(player, 1);
        game.showEffect(7, 7, '💰 偷取1点能量!');
        return true;
    }
}

// 2. 在 registerAllSkills() 中添加
this.skillManager.register(StealEnergy);
```

## 技能属性说明

| 属性 | 类型 | 说明 | 范围 |
|------|------|------|------|
| id | string | 唯一标识符 | 字母数字下划线 |
| name | string | 显示名称 | 任意中文 |
| icon | string | 表情图标 | 单个emoji |
| cost | number | 能量消耗 | 1-8 |
| cooldown | number | 冷却回合 | 1-9 |
| category | string | 计策分类 | 胜战计/敌战计/攻战计/混战计/并战计/败战计 |
| description | string | 效果描述 | 任意中文 |
| targetType | string | 目标类型 | 'none' / 'cell' / 'stone' |
| range | number | 影响半径 | 0表示单格，1表示3x3 |

## 游戏特性

- 🎲 **随机技能池**：每局6-10个随机技能，增加重玩价值
- 🎯 **重玩功能**：使用相同技能组重新开始
- ⚡ **能量系统**：每落子+1能量，上限10点
- 🔄 **共享CD**：技能双方共享，一方使用双方进入CD
- 🤖 **AI对战系统**：支持简单/中等/困难三种难度
  - AlphaBeta搜索算法
  - 开局库系统
  - 威胁空间搜索
  - 技能组合系统
  - AI难度自适应

## 注意事项

- 所有技能必须使用唯一的 `id`
- 包含落子的技能需要手动调用 `game.switchPlayer()`
- 纯效果技能不要调用 `game.switchPlayer()`，由主逻辑处理
- 修改技能代码（ALL_36_SKILLS.js）后需要刷新浏览器生效
- 修改AI参数需要刷新浏览器生效
- 主游戏逻辑在 `gomoku.html` 中，技能代码在 `js/core/` 目录下

## 技术栈

- 纯 HTML + CSS + JavaScript
- 模块化代码结构（js/core/、js/systems/）
- 无需构建工具，直接打开即可运行
- 响应式设计，支持移动端

## 项目结构

```
jineng_wuziqi_ai/
├── gomoku.html              # 主游戏文件
├── js/
│   ├── core/               # 核心代码
│   │   ├── ALL_36_SKILLS.js    # 36个技能实现
│   │   ├── SKILL_TEMPLATE.js    # 技能模板
│   │   └── gomoku_ai.js       # AI系统
│   └── systems/            # 系统模块
│       ├── AIAdaptiveSystem.js  # AI自适应
│       ├── GameRecorder.js      # 对局记录
│       └── UIEnhancements.js   # UI增强
├── docs/                   # 文档
│   ├── 技能清单.md
│   ├── AI_LOGIC.md
│   ├── AI_INTEGRATION_README.md
│   └── 36计.rtf
└── tests/                  # 测试文件
```
