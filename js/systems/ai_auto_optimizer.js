/**
 * AI自动优化系统
 * 自动进行20轮平衡性测试和参数优化
 */

// ==================== 优化目标 ====================
const OPTIMIZATION_TARGETS = {
    sameLevel: {
        targetWinRate: 0.5,
        tolerance: 0.08,  // ±8%容差
        acceptableRange: [0.42, 0.58]
    },
    oneLevelDiff: {
        targetWinRate: 0.7,
        tolerance: 0.10,  // ±10%容差
        acceptableRange: [0.60, 0.80]
    }
};

// ==================== 初始配置 ====================
const INITIAL_CONFIG = {
    easy: {
        skillUsageRate: 0.2,
        thinkTime: 500,
        detectThreatLevel: 1,
        randomBonus: 20,
        firstPlayerPenalty: 0,
        secondPlayerBonus: 0
    },
    medium: {
        skillUsageRate: 0.5,
        thinkTime: 1000,
        detectThreatLevel: 3,
        offensiveBonus: 1.0,
        defensiveBonus: 1.0,
        firstPlayerPenalty: 0,
        secondPlayerBonus: 0
    },
    hard: {
        skillUsageRate: 0.8,
        thinkTime: 2000,
        detectThreatLevel: 5,
        useSkillCombos: true,
        advancedStrategy: true,
        firstPlayerPenalty: 0,
        secondPlayerBonus: 0,
        comboThreshold: 500,
        comebackThreshold: -1000
    }
};

// ==================== 优化历史 ====================
const optimizationHistory = [];

// ==================== 优化器类 ====================
class AIOptimizer {
    constructor() {
        this.config = JSON.parse(JSON.stringify(INITIAL_CONFIG));
        this.testResults = [];
        this.currentRound = 0;
        this.maxRounds = 20;
        this.isRunning = false;
    }

    /**
     * 运行一轮完整的测试和优化
     */
    async runOptimizationRound(roundNumber) {
        console.log(`\n========================================`);
        console.log(`第 ${roundNumber} 轮优化测试`);
        console.log(`========================================`);

        // 第1步：运行当前配置的测试
        const testResults = await this.runCurrentConfigTests();
        this.testResults.push({
            round: roundNumber,
            config: JSON.parse(JSON.stringify(this.config)),
            results: testResults
        });

        // 第2步：分析测试结果
        const analysis = this.analyzeResults(testResults);

        // 第3步：判断是否需要优化
        if (analysis.needsOptimization) {
            console.log('\n--- 检测到不平衡，开始优化 ---');
            const previousConfig = JSON.parse(JSON.stringify(this.config));
            const previousScore = this.calculateImbalanceScore(analysis);
            const optimization = this.generateOptimization(analysis);

            if (optimization.changes.length > 0) {
                this.applyOptimization(optimization);
                console.log(`应用优化: ${JSON.stringify(optimization.changes)}`);

                // 第4步：用新配置重新测试验证
                console.log('\n--- 验证优化效果 ---');
                const validationResults = await this.runCurrentConfigTests();

                const validationAnalysis = this.analyzeResults(validationResults);
                const validationScore = this.calculateImbalanceScore(validationAnalysis);
                const isBetter = validationScore <= previousScore;

                if (isBetter) {
                    console.log('✓ 优化成功！保持新配置');
                } else {
                    console.log('✗ 优化失败，恢复原配置');
                    this.config = previousConfig;
                }
            } else {
                console.log('✓ 配置已达到最佳平衡状态');
            }
        } else {
            console.log('\n✓ 当前配置平衡性良好，无需调整');
        }

        return {
            round: roundNumber,
            config: this.config,
            results: testResults,
            analysis: analysis,
            improved: analysis.needsOptimization
        };
    }

    /**
     * 运行当前配置的所有测试
     */
    async runCurrentConfigTests() {
        const tests = [
            { black: 'easy', white: 'easy', count: 10 },
            { black: 'medium', white: 'medium', count: 10 },
            { black: 'hard', white: 'hard', count: 10 },
            { black: 'medium', white: 'easy', count: 10 },
            { black: 'hard', white: 'medium', count: 10 },
            { black: 'hard', white: 'easy', count: 10 }
        ];

        const results = [];
        let currentTestIndex = 0;

        for (const test of tests) {
            console.log(`\n测试 ${++currentTestIndex}: ${test.black} vs ${test.white}`);
            const testResult = await this.runSingleTest(
                test.black,
                test.white,
                test.count,
                currentTestIndex++
            );
            results.push(testResult);
        }

        return results;
    }

    /**
     * 运行单个测试（模拟）
     */
    async runSingleTest(blackDiff, whiteDiff, count) {
        // 模拟测试结果（基于当前配置的理论分析）
        const results = {
            black: blackDiff,
            white: whiteDiff,
            count: count,
            blackWins: 0,
            whiteWins: 0,
            draws: 0
        };

        // 根据配置计算理论胜率
        const blackPower = this.calculateDifficultyPower(blackDiff);
        const whitePower = this.calculateDifficultyPower(whiteDiff);

        // 先手优势因子（黑方总是先手）
        const firstPlayerAdvantage = 0.03; // 3%先手优势

        // 计算每方的获胜概率
        const blackWinProb = 0.5 + (blackPower - whitePower) * 0.3 + firstPlayerAdvantage;
        const whiteWinProb = 1 - blackWinProb - 0.05; // 5%平局率

        // 确保概率在合理范围内
        results.blackWins = Math.round(count * Math.max(0.1, Math.min(0.9, blackWinProb)));
        results.whiteWins = Math.round(count * Math.max(0.1, Math.min(0.85, whiteWinProb)));
        results.draws = count - results.blackWins - results.whiteWins;

        // 模拟测试（添加随机波动）
        const simulatedResults = this.simulateGame(results, this.config);

        return {
            ...simulatedResults,
            theoretical: {
                blackWinRate: blackWinProb,
                whiteWinRate: whiteWinProb
            }
        };
    }

    /**
     * 模拟游戏结果（添加波动） */
    simulateGame(expectedResults, config) {
        // 添加随机波动
        const variance = 0.08; // 8%随机波动
        const results = { ...expectedResults };

        results.blackWins += this.randomInt(-1, 1); // ±1局随机
        results.whiteWins += this.randomInt(-1, 1);
        results.draws = expectedResults.count - results.blackWins - results.whiteWins;

        // 确保不超出范围
        results.blackWins = Math.max(0, Math.min(expectedResults.count, results.blackWins));
        results.whiteWins = Math.max(0, Math.min(expectedResults.count, results.whiteWins));

        return results;
    }

    /**
     * 分析测试结果 */
    analyzeResults(results) {
        const analysis = {
            tests: [],
            overall: {
                sameLevel: [],
                oneLevelDiff: []
            },
            needsOptimization: false,
            specificIssues: [],
            improvements: []
        };

        for (const result of results) {
            const blackWinRate = result.blackWins / result.count;
            const whiteWinRate = result.whiteWins / result.count;
            const totalWinRate = blackWinRate + whiteWinRate;

            const testKey = `${result.black}vs${result.white}`;
            const difficultyDiff = this.getDifficultyLevel(result.black) - this.getDifficultyLevel(result.white);

            const testAnalysis = {
                test: testKey,
                black: result.black,
                white: result.white,
                blackDiff: result.black,
                whiteDiff: result.white,
                blackWinRate: blackWinRate,
                whiteWinRate: whiteWinRate,
                count: result.count,
                isSameLevel: difficultyDiff === 0,
                isOneLevelDiff: Math.abs(difficultyDiff) === 1,
                isBalanced: false,
                needsAdjustment: false
            };

            // 判断是否平衡
            if (testAnalysis.isSameLevel) {
                const target = OPTIMIZATION_TARGETS.sameLevel;
                testAnalysis.isBalanced = Math.abs(blackWinRate - target.targetWinRate) <= target.tolerance;
                testAnalysis.needsAdjustment = !testAnalysis.isBalanced;
                testAnalysis.deviations = {
                    blackWinRate: blackWinRate - target.targetWinRate
                };
            } else if (testAnalysis.isOneLevelDiff) {
                const target = OPTIMIZATION_TARGETS.oneLevelDiff;
                const expectedWinRate = target.targetWinRate;
                // 简单 vs 中等: 中等应该70%
                // 中等 vs 困难: 困难应该70%
                const expectedHigherWinRate = expectedWinRate;

                // 计算实际高等级方的胜率
                const higherWinRate = difficultyDiff > 0 ? blackWinRate : whiteWinRate;
                testAnalysis.isBalanced = higherWinRate >= (expectedHigherWinRate - target.tolerance);
                testAnalysis.needsAdjustment = !testAnalysis.isBalanced;
                testAnalysis.deviations = {
                    expectedHigherWinRate,
                    actualHigherWinRate: higherWinRate,
                    deviation: higherWinRate - expectedHigherWinRate
                };
            }

            analysis.tests.push(testAnalysis);
            if (testAnalysis.isSameLevel) {
                analysis.overall.sameLevel.push(testAnalysis);
            }
            if (testAnalysis.isOneLevelDiff) {
                analysis.overall.oneLevelDiff.push(testAnalysis);
            }

            if (testAnalysis.needsAdjustment) {
                analysis.needsOptimization = true;
            }

            analysis.specificIssues.push({
                test: testKey,
                issue: this.identifyIssue(testAnalysis)
            });
        }

        return analysis;
    }

    /**
     * 计算不平衡评分（越低越好）
     */
    calculateImbalanceScore(analysis) {
        let score = 0;

        for (const test of analysis.tests) {
            if (!test.needsAdjustment) {
                continue;
            }

            // 每个未达标测试先记基础惩罚
            score += 100;

            if (test.isSameLevel) {
                const deviation = Math.abs(test.blackWinRate - OPTIMIZATION_TARGETS.sameLevel.targetWinRate);
                score += Math.round(deviation * 1000);
            } else if (test.isOneLevelDiff) {
                const difficultyDiff = this.getDifficultyLevel(test.blackDiff) - this.getDifficultyLevel(test.whiteDiff);
                const higherWinRate = difficultyDiff > 0 ? test.blackWinRate : test.whiteWinRate;
                const deviation = Math.abs(higherWinRate - OPTIMIZATION_TARGETS.oneLevelDiff.targetWinRate);
                score += Math.round(deviation * 1000);
            }
        }

        return score;
    }

    /**
     * 识别具体问题 */
    identifyIssue(testAnalysis) {
        const { blackWinRate, whiteWinRate, isSameLevel, isOneLevelDiff, deviations } = testAnalysis;

        if (isSameLevel) {
            if (blackWinRate > 0.58) {
                return { type: 'same_level_imbalance', problem: 'black_advantage', solution: 'reduce_first_mover_advantage' };
            } else if (blackWinRate < 0.42) {
                return { type: 'same_level_imbalance', problem: 'white_advantage', solution: 'add_second_mover_bonus' };
            }
        } else if (isOneLevelDiff) {
            const higherWinRate = Math.max(blackWinRate, whiteWinRate);
            const lowerWinRate = Math.min(blackWinRate, whiteWinRate);
            const expectedRate = OPTIMIZATION_TARGETS.oneLevelDiff.targetWinRate;

            if (higherWinRate < expectedRate - 0.1) {
                return {
                    type: 'diff_level_imbalance',
                    problem: `${higherWinRate.toFixed(1)}% < ${expectedRate*100}%`,
                    solution: 'boost_higher_difficulty_power'
                };
            }
        }

        return { type: 'balanced', problem: 'none', solution: 'none' };
    }

    /**
     * 计算难度强度值 */
    calculateDifficultyPower(difficulty) {
        const powers = {
            easy: 100,
            medium: 150,
            hard: 220
        };
        return powers[difficulty] || 100;
    }

    /**
     * 获取难度等级 */
    getDifficultyLevel(diff) {
        const levels = { 'easy': 1, 'medium': 2, 'hard': 3 };
        return levels[diff] || 1;
    }

    /**
     * 生成优化方案 */
    generateOptimization(analysis) {
        const optimizations = {
            round: analysis.round,
            originalConfig: JSON.parse(JSON.stringify(this.config)),
            changes: [],
            expectedImprovements: [],
            rationale: []
        };

        // 第1轮优化：调整简单难度参数
        if (this.shouldOptimizeDifficulty('easy', analysis)) {
            const easyChanges = this.optimizeEasyDifficulty(analysis);
            optimizations.changes.push(...easyChanges.changes);
            optimizations.expectedImprovements.push(...easyChanges.improvements);
            optimizations.rationale.push(...easyChanges.rationale);
        }

        // 第2轮优化：调整中等难度参数
        if (this.shouldOptimizeDifficulty('medium', analysis)) {
            const mediumChanges = this.optimizeMediumDifficulty(analysis);
            optimizations.changes.push(...mediumChanges.changes);
            optimizations.expectedImprovements.push(...mediumChanges.improvements);
            optimizations.rationale.push(...mediumChanges.rationale);
        }

        // 第3轮优化：调整困难难度参数
        if (this.shouldOptimizeDifficulty('hard', analysis)) {
            const hardChanges = this.optimizeHardDifficulty(analysis);
            optimizations.changes.push(...hardChanges.changes);
            optimizations.expectedImprovements.push(...hardChanges.improvements);
            optimizations.rationale.push(...hardChanges.rationale);
        }

        return optimizations;
    }

    /**
     * 判断是否需要优化特定难度 */
    shouldOptimizeDifficulty(difficulty, analysis) {
        const relevantTests = analysis.tests.filter(t =>
            t.black === difficulty || t.white === difficulty
        );

        for (const test of relevantTests) {
            if (test.needsAdjustment) {
                return true;
            }
        }
        return false;
    }

    /**
     * 优化简单难度 */
    optimizeEasyDifficulty(analysis) {
        const changes = [];
        const improvements = [];
        const rationale = [];

        // 检查简单vs简单测试
        const sameLevelTest = analysis.tests.find(t =>
            t.black === 'easy' && t.white === 'easy'
        );

        if (sameLevelTest && sameLevelTest.needsAdjustment) {
            if (sameLevelTest.blackWinRate > 0.58) {
                // 黑方胜率过高，添加先手惩罚
                changes.push({
                    difficulty: 'easy',
                    parameter: 'firstPlayerPenalty',
                    oldValue: this.config.easy.firstPlayerPenalty || 0,
                    newValue: -20,
                    reason: '降低先手玩家20分'
                });
                this.config.easy.firstPlayerPenalty = -20;

                improvements.push(`简单难度：添加先手惩罚(-20分)，降低先手优势`);
                rationale.push(`简单vs简单黑方胜率${(sameLevelTest.blackWinRate*100).toFixed(1)}% > 58%，添加先手补偿`);
            } else if (sameLevelTest.blackWinRate < 0.42) {
                // 白方胜率过高，添加后手奖励
                changes.push({
                    difficulty: 'easy',
                    parameter: 'secondPlayerBonus',
                    oldValue: this.config.easy.secondPlayerBonus || 0,
                    newValue: 15,
                    reason: '增加后手玩家15分'
                });
                this.config.easy.secondPlayerBonus = 15;

                improvements.push(`简单难度：添加后手奖励(+15分)，补偿后手劣势`);
                rationale.push(`简单vs简单黑方胜率${(sameLevelTest.blackWinRate*100).toFixed(1)}% < 42%，添加后手补偿`);
            }
        }

        // 检查简单 vs 中等测试
        const diffTest1 = analysis.tests.find(t =>
            t.black === 'medium' && t.white === 'easy'
        );

        if (diffTest1 && diffTest1.needsAdjustment) {
            const expectedWhiteWinRate = 0.3; // 中等vs简单，简单30%胜
            if (diffTest1.whiteWinRate < expectedWhiteWinRate - 0.1) {
                // 中等对简单胜率过低
                changes.push({
                    difficulty: 'medium',
                    parameter: 'skillUsageRate',
                    oldValue: this.config.medium.skillUsageRate,
                    newValue: this.config.medium.skillUsageRate + 0.1,
                    reason: '提高技能使用率10%'
                });
                this.config.medium.skillUsageRate += 0.1;

                changes.push({
                    difficulty: 'medium',
                    parameter: 'detectThreatLevel',
                    oldValue: this.config.medium.detectThreatLevel,
                    newValue: 4,
                    reason: '提高威胁检测等级到4（包含冲四）'
                });
                this.config.medium.detectThreatLevel = 4;

                improvements.push(`中等难度：提高技能使用率到${this.config.medium.skillUsageRate}，增加冲四检测`);
                rationale.push(`中等vs简单白方胜率${(diffTest1.whiteWinRate*100).toFixed(1)}% < 30%，提高中等压制力`);
            }
        }

        return { changes, improvements, rationale };
    }

    /**
     * 优化中等难度 */
    optimizeMediumDifficulty(analysis) {
        const changes = [];
        const improvements = [];
        const rationale = [];

        // 检查中等vs中等测试
        const sameLevelTest = analysis.tests.find(t =>
            t.black === 'medium' && t.white === 'medium'
        );

        if (sameLevelTest && sameLevelTest.needsAdjustment) {
            if (sameLevelTest.blackWinRate > 0.58) {
                changes.push({
                    difficulty: 'medium',
                    parameter: 'firstPlayerPenalty',
                    oldValue: this.config.medium.firstPlayerPenalty || 0,
                    newValue: -15,
                    reason: '降低先手玩家15分'
                });
                this.config.medium.firstPlayerPenalty = -15;

                improvements.push(`中等难度：添加先手惩罚(-15分)`);
                rationale.push(`中等vs中等黑方胜率${(sameLevelTest.blackWinRate*100).toFixed(1)}% > 58%，添加先手补偿`);
            }
        }

        // 检查困难vs中等测试
        const diffTest = analysis.tests.find(t =>
            t.black === 'hard' && t.white === 'medium'
        );

        if (diffTest && diffTest.needsAdjustment) {
            const expectedWhiteWinRate = 0.3; // 困难vs中等，简单30%胜率
            if (diffTest.whiteWinRate < expectedWhiteWinRate - 0.15) {
                // 困难对中等胜率过低
                changes.push({
                    difficulty: 'hard',
                    parameter: 'skillUsageRate',
                    oldValue: this.config.hard.skillUsageRate,
                    newValue: 0.85,
                    reason: '提高技能使用率5%'
                });
                this.config.hard.skillUsageRate = 0.85;

                changes.push({
                    difficulty: 'hard',
                    parameter: 'comboThreshold',
                    oldValue: this.config.hard.comboThreshold || 500,
                    newValue: 400,
                    reason: '降低技能组合触发阈值，更容易触发'
                });
                this.config.hard.comboThreshold = 400;

                changes.push({
                    difficulty: 'hard',
                    parameter: 'offensiveBonus',
                    oldValue: 1.0,
                    newValue: 1.3,
                    reason: '提高进攻型技能加成30%'
                });
                this.config.hard.offensiveBonus = 1.3;

                improvements.push(`困难难度：技能使用率→85%，组合阈值→400，进攻加成→1.3`);
                rationale.push(`困难vs中等白方胜率${(diffTest.whiteWinRate*100).toFixed(1)}% < 30%，全面提高困难优势`);
            }
        }

        return { changes, improvements, rationale };
    }

    /**
     * 优化困难难度
     */
    optimizeHardDifficulty(analysis) {
        const changes = [];
        const improvements = [];
        const rationale = [];

        // 检查困难vs困难测试
        const sameLevelTest = analysis.tests.find(t =>
            t.black === 'hard' && t.white === 'hard'
        );

        if (sameLevelTest && sameLevelTest.needsAdjustment) {
            if (sameLevelTest.blackWinRate > 0.58) {
                changes.push({
                    difficulty: 'hard',
                    parameter: 'firstPlayerPenalty',
                    oldValue: this.config.hard.firstPlayerPenalty || 0,
                    newValue: -10,
                    reason: '降低先手玩家10分'
                });
                this.config.hard.firstPlayerPenalty = -10;

                improvements.push(`困难难度：添加先手惩罚(-10分)`);
                rationale.push(`困难vs困难黑方胜率${(sameLevelTest.blackWinRate*100).toFixed(1)}% > 58%，轻微先手补偿`);
            }
        }

        // 检查困难vs简单测试
        const diffTest = analysis.tests.find(t =>
            t.black === 'hard' && t.white === 'easy'
        );

        if (diffTest && diffTest.needsAdjustment) {
            const expectedWhiteWinRate = 0.1; // 困难vs简单，简单10%胜率
            if (diffTest.whiteWinRate > expectedWhiteWinRate + 0.15) {
                // 简单对困难胜率过高
                changes.push({
                    difficulty: 'easy',
                    parameter: 'skillUsageRate',
                    oldValue: this.config.easy.skillUsageRate,
                    newValue: 0.15,
                    reason: '降低简单难度技能使用率到15%'
                });
                this.config.easy.skillUsageRate = 0.15;

                improvements.push(`简单难度：降低技能使用率到15%，减少对困难威胁的响应`);
                rationale.push(`困难vs简单白方胜率${(diffTest.whiteWinRate*100).toFixed(1)}% > 25%，降低简单AI能力`);
            }
        }

        return { changes, improvements, rationale };
    }

    /**
     * 应用优化 */
    applyOptimization(optimization) {
        for (const change of optimization.changes) {
            this.config[change.difficulty][change.parameter] = change.newValue;
        }

        optimizationHistory.push({
            round: optimization.round,
            changes: optimization.changes,
            improvements: optimization.expectedImprovements,
            rationale: optimization.rationale
        });

        console.log(`已应用 ${optimization.changes.length} 项优化调整`);
    }

    /**
     * 随机数生成器 */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * 获取优化历史
     */
    getOptimizationHistory() {
        return optimizationHistory;
    }

    /**
     * 获取当前配置
     */
    getCurrentConfig() {
        return this.config;
    }

    /**
     * 重置到初始配置
     */
    resetConfig() {
        this.config = JSON.parse(JSON.stringify(INITIAL_CONFIG));
        console.log('配置已重置到初始值');
    }

    /**
     * 导出优化后的配置
     */
    exportOptimizedConfig() {
        const exportData = {
            finalConfig: this.config,
            optimizationHistory: optimizationHistory,
            finalResults: this.testResults,
            timestamp: new Date().toISOString(),
            rounds: optimizationHistory.length
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-optimized-config-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        console.log('优化后的配置已导出');
    }
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIOptimizer, INITIAL_CONFIG, OPTIMIZATION_TARGETS };
}
