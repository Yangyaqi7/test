// API配置 - 使用代理服务器
const API_CONFIG = {
    visitor: {
        url: '/api'
    },
    supervisor: {
        url: '/api'
    }
};

// 测试API连接
async function testApiConnection() {
    try {
        console.log('测试API连接...');

        // 测试代理服务器连接
        const testResponse = await fetch('http://localhost:3000/api/test', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('代理服务器测试响应:', testResponse.status);
        return testResponse.ok;

    } catch (error) {
        console.error('API连接测试失败:', error);
        return false;
    }
}

// 应用状态
let appState = {
    conversationStarted: false,
    conversationHistory: [],
    currentEvaluation: null,
    evaluationHistory: [],
    isProcessing: false,
    visitorConversationId: null,  // 来访者会话ID
    supervisorConversationId: null, // 督导会话ID
    usingSimulation: false, // 是否在使用模拟数据
    // 多维度心理状态跟踪数据
    psychometrics: {
        emotion_curve: [],        // 情绪曲线数据
        stress_curve: [],         // 压力曲线数据
        session_emotion_timeline: [], // 会话情绪时间线
        conversation_stage_curve: [], // 对话阶段曲线
        engagement_level: [],     // 参与度
        change_motivation: [],    // 改变动机
        defense_mechanism: [],    // 防御机制
        core_conflict_index: []   // 核心冲突指数
    }
};

// DOM元素
const elements = {
    chatContainer: document.getElementById('chatContainer'),
    userInput: document.getElementById('userInput'),
    startBtn: document.getElementById('startBtn'),
    sendBtn: document.getElementById('sendBtn'),
    status: document.getElementById('status'),
    evaluationContainer: document.getElementById('evaluationContainer'),
    historyList: document.getElementById('historyList'),
    historyModal: document.getElementById('historyModal'),
    modalTitle: document.getElementById('modalTitle'),
    historyContent: document.getElementById('historyContent'),
    historyToggleText: document.getElementById('historyToggleText'),
    // 心理状态分析相关元素
    emotionChart: document.getElementById('emotionChart'),
    stressChart: document.getElementById('stressChart'),
    stageProgress: document.getElementById('stageProgress'),
    emotionStatus: document.getElementById('emotionStatus'),
    stressStatus: document.getElementById('stressStatus'),
    conversationStageStatus: document.getElementById('conversationStageStatus'),
    engagementLevel: document.getElementById('engagementLevel'),
    changeMotivation: document.getElementById('changeMotivation'),
    defenseMechanism: document.getElementById('defenseMechanism'),
    coreConflictIndex: document.getElementById('coreConflictIndex'),
    defenseStatus: document.getElementById('defenseStatus'),
    defenseGauge: document.getElementById('defenseGauge'),
    defenseGaugeValue: document.getElementById('defenseGaugeValue')
};

// 调用Dify API
async function callDifyAPI(config, message, conversationId = null) {
    try {
        console.log('正在调用API:', config.url);
        console.log('发送消息:', message);
        console.log('使用会话ID:', conversationId);

        const requestBody = {
            inputs: {},
            query: message,
            response_mode: 'blocking',
            conversation_id: conversationId || '',
            user: 'counselor_user'
        };

        console.log('请求体:', requestBody);
        console.log('完整的请求URL:', config.url + '/chat-messages');

        const response = await fetch('/api/chat-messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API响应错误:', response.status, errorText);
            throw new Error(`API请求失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('API响应成功:', data);

        // 详细记录响应结构，帮助调试数据提取
        console.log('=== 响应结构分析 ===');
        console.log('响应的所有键:', Object.keys(data));

        if (data.data) {
            console.log('data中的键:', Object.keys(data.data));
            if (data.data.inputs) {
                console.log('inputs中的键:', Object.keys(data.data.inputs));
                console.log('inputs的内容:', data.data.inputs);
            }
        }

        console.log('==================');

        return {
            answer: data.answer,
            data: data.data,
            conversation_id: data.conversation_id
        };

    } catch (error) {
        console.error('API调用错误:', error);
        throw error;
    }
}

// 从 Dify API 获取当前会话的变量值
async function getSessionVars(config, conversationId) {
    try {
        console.log('正在获取会话变量:', conversationId);

        // Dify API 获取会话变量的端点 (直接通过代理转发)
        const response = await fetch(`/api/conversations/${conversationId}/variables`, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('获取会话变量失败:', response.status, errorText);
            return null;
        }

        const sessionVars = await response.json();
        console.log('获取到的会话变量:', sessionVars);

        return sessionVars;

    } catch (error) {
        console.error('获取会话变量API调用错误:', error);
        return null;
    }
}

// 来访者Agent调用
async function callVisitorAgent(message) {
    const response = await callDifyAPI(API_CONFIG.visitor, message, appState.visitorConversationId);

    // 保存会话ID以保持连续性
    if (response.conversation_id) {
        appState.visitorConversationId = response.conversation_id;
        console.log('保存来访者会话ID:', response.conversation_id);
    }

    // 优先尝试从会话变量获取真实的心理状态数据
    if (response.conversation_id) {
        console.log('尝试从会话变量获取心理状态数据...');

        // 延迟获取会话变量，确保变量已更新
        setTimeout(async () => {
            const sessionVars = await getSessionVars(API_CONFIG.visitor, response.conversation_id);

            if (sessionVars && typeof sessionVars === 'object') {
                console.log('成功获取会话变量，处理心理状态数据...');
                processPsychometricsData(sessionVars);
            } else {
                console.log('会话变量中未找到心理状态数据，回退到文本分析');
                createBasicPsychometricsFromText(response.answer || '');
            }
        }, 1000); // 延迟1秒确保变量已更新
    } else {
        // 回退方案：基于文本分析
        console.log('无会话ID，使用文本分析');
        createBasicPsychometricsFromText(response.answer || '');
    }

    return response.answer;
}

// 从DIFY响应中提取心理状态数据
function extractPsychometricsFromResponse(response) {
    try {
        console.log('完整DIFY响应:', response);

        // DIFY的响应格式可能不同，检查是否是标准流式响应
        if (response.answer && !response.data) {
            console.log('这是标准DIFY响应，没有单独的data字段');

            // 尝试从answer中解析心理状态数据
            if (response.answer && typeof response.answer === 'string') {
                // 检查answer中是否包含JSON格式的心理状态数据
                const jsonPatterns = [
                    /\{[\s\S]*?emotion[\s\S]*?\}/gi,
                    /\{[\s\S]*?stress[\s\S]*?\}/gi,
                    /\{[\s\S]*?turn[\s\S]*?value[\s\S]*?\}/gi,
                    /\{[\s\S]*?\d+[\s\S]*?\d+\.\d[\s\S]*?\}/gi
                ];

                for (const pattern of jsonPatterns) {
                    const matches = response.answer.match(pattern);
                    if (matches) {
                        console.log('找到可能的JSON数据:', matches);
                        for (const match of matches) {
                            try {
                                const cleanJson = match.replace(/[\r\n]+/g, ' ').trim();
                                console.log('尝试解析:', cleanJson);
                                const parsedData = JSON.parse(cleanJson);
                                console.log('成功解析的JSON:', parsedData);
                                processPsychometricsData(parsedData);
                                return;
                            } catch (e) {
                                console.log('JSON解析失败:', e.message);
                            }
                        }
                    }
                }
            }

            // 如果没有找到JSON数据，创建基础的心理状态数据
            console.log('未找到结构化心理状态数据，基于文本内容创建基础数据');
            createBasicPsychometricsFromText(response.answer);
            return;
        }

        // 如果有data字段，处理data中的数据
        if (response.data) {
            console.log('找到data字段，内容:', response.data);
            processPsychometricsData(response.data);
        } else {
            console.log('响应中既没有结构化数据，也没有data字段');
            console.log('响应结构:', Object.keys(response));
        }

    } catch (error) {
        console.error('提取心理状态数据失败:', error);
    }
}

// 处理心理状态数据的通用函数
function processPsychometricsData(data) {
    if (!data || typeof data !== 'object') {
        console.log('数据格式无效:', data);
        return;
    }

    console.log('处理心理状态数据:', data);

    // 提取各种曲线数据，支持多种可能的键名
    const emotionData = extractSingleCurveData(data, ['emotion_curve', 'emotion', '情绪']);
    const stressData = extractSingleCurveData(data, ['stress_curve', 'stress', '压力']);
    const timelineData = extractSingleCurveData(data, ['session_emotion_timeline', 'timeline', '时间线']);
    const stageData = extractSingleCurveData(data, ['conversation_stage_curve', 'stage', '对话阶段']);

    // 提取其他指标
    const engagementData = extractSingleCurveData(data, ['engagement_level', 'engagement', '参与度']);
    const motivationData = extractSingleCurveData(data, ['change_motivation', 'motivation', '动机']);
    const defenseData = extractSingleCurveData(data, ['defense_mechanism', 'defense', '防御']);
    const conflictData = extractSingleCurveData(data, ['core_conflict_index', 'conflict', '冲突']);

    // 添加turn轮次信息（基于对话历史长度）
    const currentTurn = Math.floor(appState.conversationHistory.filter(m => m.sender === '来访者').length / 2);

    let hasData = false;

    // 将数据添加到状态中
    if (emotionData.length > 0) {
        appState.psychometrics.emotion_curve.push(...emotionData.map(d => ({...d, turn: currentTurn})));
        hasData = true;
    }
    if (stressData.length > 0) {
        appState.psychometrics.stress_curve.push(...stressData.map(d => ({...d, turn: currentTurn})));
        hasData = true;
    }
    if (timelineData.length > 0) {
        appState.psychometrics.session_emotion_timeline.push(...timelineData.map(d => ({...d, turn: currentTurn})));
        hasData = true;
    }
    if (stageData.length > 0) {
        appState.psychometrics.conversation_stage_curve.push(...stageData.map(d => ({...d, turn: currentTurn})));
        hasData = true;
    }
    if (engagementData.length > 0) {
        appState.psychometrics.engagement_level.push(...engagementData.map(d => ({...d, turn: currentTurn})));
        hasData = true;
    }
    if (motivationData.length > 0) {
        appState.psychometrics.change_motivation.push(...motivationData.map(d => ({...d, turn: currentTurn})));
        hasData = true;
    }
    if (defenseData.length > 0) {
        appState.psychometrics.defense_mechanism.push(...defenseData.map(d => ({...d, turn: currentTurn})));
        hasData = true;
    }
    if (conflictData.length > 0) {
        appState.psychometrics.core_conflict_index.push(...conflictData.map(d => ({...d, turn: currentTurn})));
        hasData = true;
    }

    if (hasData) {
        console.log('成功提取心理状态数据:', appState.psychometrics);
        updatePsychometricsDisplay();
    } else {
        console.log('未在数据中找到心理状态变量');
        // 基于文本内容创建基础数据
        createBasicPsychometricsFromText(data.answer || '');
    }
}

// 基于文本内容创建基础心理状态数据
function createBasicPsychometricsFromText(text) {
    console.log('基于文本分析心理状态:', text.substring(0, 100));

    const currentTurn = appState.conversationHistory.filter(m => m.sender === '来访者').length / 2;

    // 简单的情绪分析
    let emotionScore = 5; // 中性
    let stressScore = 5;   // 中性

    // 积极词汇
    const positiveWords = ['开心', '高兴', '好', '棒', '满意', '愉快'];
    // 消极词汇
    const negativeWords = ['难过', '伤心', '痛苦', '难受', '生气', '失望', '担心', '焦虑', '压力', '懵', '闷'];
    // 压力相关词汇
    const stressWords = ['压力', '紧张', '焦虑', '担心', '害怕', '胸闷', '手心出汗', '懵', '闷'];

    // 计算情绪分数
    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;
    const stressCount = stressWords.filter(word => text.includes(word)).length;

    emotionScore = Math.max(0, Math.min(10, 5 + (positiveCount * 0.5) - (negativeCount * 0.3)));
    stressScore = Math.max(0, Math.min(10, 5 + (stressCount * 0.4)));

    // 创建基础数据点
    const baseData = {
        turn: currentTurn,
        value: 0,
        timestamp: new Date()
    };

    // 添加情绪数据
    appState.psychometrics.emotion_curve.push({...baseData, value: emotionScore});

    // 添加压力数据
    appState.psychometrics.stress_curve.push({...baseData, value: stressScore});

    // 添加对话阶段（基于轮次）
    const stageProgress = Math.min(currentTurn / 8, 1);
    appState.psychometrics.conversation_stage_curve.push({...baseData, value: stageProgress});

    // 添加时间线数据
    appState.psychometrics.session_emotion_timeline.push({...baseData, value: emotionScore});

    console.log('基于文本创建的基础数据:', {
        emotion: emotionScore,
        stress: stressScore,
        stage: stageProgress
    });

    updatePsychometricsDisplay();
}

// 提取单个曲线数据的通用函数
function extractSingleCurveData(data, possibleKeys) {
    for (const key of possibleKeys) {
        if (data[key] !== undefined) {
            const curveData = parseCurveData(data[key]);
            if (curveData.length > 0) {
                console.log(`从${key}提取到数据:`, curveData);
                return curveData;
            }
        }
    }
    return [];
}

// 解析曲线数据 {turn: 1, value: 0.7} 格式
function parseCurveData(data) {
    try {
        console.log('开始解析曲线数据:', data, '类型:', typeof data);

        // 如果是纯数字，直接转换为数值点
        if (typeof data === 'number') {
            return [{
                turn: 0,
                value: data,
                timestamp: new Date()
            }];
        }

        // 如果是字符串，尝试多种解析方式
        if (typeof data === 'string') {
            // 尝试解析为JSON
            try {
                data = JSON.parse(data);
            } catch (e) {
                // 如果不是JSON，尝试提取数字
                const numberMatch = data.match(/[\d.]+/);
                if (numberMatch) {
                    return [{
                        turn: 0,
                        value: parseFloat(numberMatch[0]) || 0,
                        timestamp: new Date()
                    }];
                }
                return [];
            }
        }

        // 如果是数组，处理每个元素
        if (Array.isArray(data)) {
            return data.map((item, index) => {
                let value = 0;
                let turn = index;

                if (typeof item === 'number') {
                    value = item;
                    turn = index;
                } else if (typeof item === 'object' && item !== null) {
                    value = parseFloat(item.value) || parseFloat(item.score) || parseFloat(item.level) || 0;
                    turn = parseInt(item.turn) || index;
                }

                return {
                    turn: turn,
                    value: Math.max(0, Math.min(10, value)), // 限制在0-10范围内
                    timestamp: new Date()
                };
            }).filter(item => item.value > 0); // 过滤掉无效数据
        }

        // 如果是单个对象
        if (typeof data === 'object' && data !== null) {
            const value = parseFloat(data.value) || parseFloat(data.score) || parseFloat(data.level) || parseFloat(data.emotion) || parseFloat(data.stress) || 0;

            return [{
                turn: parseInt(data.turn) || 0,
                value: Math.max(0, Math.min(10, value)),
                timestamp: new Date()
            }];
        }

        console.log('无法解析数据格式:', data);
        return [];

    } catch (error) {
        console.error('解析曲线数据失败:', error, data);
        return [];
    }
}

// 督导Agent调用
async function callSupervisorAgent(message) {
    const response = await callDifyAPI(API_CONFIG.supervisor, message, appState.supervisorConversationId);

    // 保存会话ID以保持连续性
    if (response.conversation_id) {
        appState.supervisorConversationId = response.conversation_id;
        console.log('保存督导会话ID:', response.conversation_id);
    }

    console.log('督导API原始响应:', response);

    // 尝试解析JSON格式的评价
    try {
        // 先尝试直接解析answer
        let evaluationData;
        try {
            evaluationData = JSON.parse(response.answer);
        } catch (parseError) {
            console.log('直接JSON解析失败，尝试提取JSON部分:', parseError.message);
            // 如果answer不是JSON，尝试提取其中的JSON部分
            const jsonMatch = response.answer.match(/\{[\s\S]*?[^\\]\}/);
            if (jsonMatch) {
                console.log('找到JSON片段:', jsonMatch[0]);
                evaluationData = JSON.parse(jsonMatch[0]);
            } else {
                throw parseError;
            }
        }

        console.log('解析后的督导评价:', evaluationData);

        // 确保返回的评价数据包含所有必要字段
        return {
            综合得分: evaluationData.综合得分 || evaluationData.score || 3,
            总体评价: evaluationData.总体评价 || evaluationData.evaluation || evaluationData.总体评价 || '未提供评价',
            建议: evaluationData.建议 || evaluationData.suggestion || evaluationData.建议 || '未提供具体建议'
        };

    } catch (error) {
        console.error('督导评价JSON解析失败:', error);
        console.log('原始督导回复:', response.answer);

        // 如果解析完全失败，尝试从文本中提取有用信息
        const text = response.answer;
        const scoreMatch = text.match(/(综合得分|score|得分)[：:\s]*(\d)/);
        const evaluationMatch = text.match(/(总体评价|evaluation|评价)[：:\s]*([^建议]*)/);
        const suggestionMatch = text.match(/(建议|suggestion)[：:\s]*(.*)/);

        return {
            综合得分: scoreMatch ? parseInt(scoreMatch[2]) : 3,
            总体评价: evaluationMatch ? evaluationMatch[2].trim() : text.substring(0, 100) + '...',
            建议: suggestionMatch ? suggestionMatch[2].trim() : "请继续关注来访者的需求和感受。"
        };
    }
}

// 更新状态显示
function updateStatus(message, type = 'normal') {
    elements.status.textContent = message;
    elements.status.style.backgroundColor = type === 'error' ? '#e74c3c' :
                                            type === 'processing' ? '#f39c12' : '#27ae60';
}

// 显示消息
function displayMessage(sender, content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <div class="sender">${sender}</div>
        <div class="content">${content}</div>
    `;

    elements.chatContainer.appendChild(messageDiv);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;

    // 添加到历史记录
    appState.conversationHistory.push({
        sender,
        content,
        type,
        timestamp: new Date()
    });
}

// 显示评价
function displayEvaluation(evaluation) {
    appState.currentEvaluation = evaluation;
    appState.evaluationHistory.unshift({
        ...evaluation,
        timestamp: new Date()
    });

    // 更新当前评价显示
    elements.evaluationContainer.innerHTML = `
        <div class="evaluation">
            <div class="evaluation-header">
                <div class="score">${evaluation.综合得分 || 3}</div>
                <div class="evaluation-title">督导评价</div>
            </div>
            <div class="evaluation-content">
                <strong>总体评价：</strong>${(evaluation.总体评价 || '暂无评价').replace(/"/g, '')}
            </div>
            <div class="evaluation-suggestions">
                <strong>建议：</strong>${(evaluation.建议 || '暂无建议').replace(/"/g, '')}
            </div>
        </div>
    `;

    // 更新历史评价
    updateEvaluationHistory();
}

// 更新历史评价显示
function updateEvaluationHistory() {
    if (appState.evaluationHistory.length === 0) {
        elements.historyList.innerHTML = '<div class="no-evaluation">暂无历史评价</div>';
        return;
    }

    elements.historyList.innerHTML = appState.evaluationHistory.slice(1).map((eval, index) => `
        <div class="history-item">
            <div class="evaluation-header">
                <div class="score">${eval.综合得分 || 3}</div>
                <div class="evaluation-title">评价 #${appState.evaluationHistory.length - index - 1}</div>
            </div>
            <div class="evaluation-content">
                ${(eval.总体评价 || '暂无评价').replace(/"/g, '').substring(0, 50) + (eval.总体评价 && eval.总体评价.length > 50 ? '...' : '')}
            </div>
        </div>
    `).join('');
}

// 开始新的对话
async function startNewConversation() {
    if (appState.isProcessing) return;

    try {
        appState.isProcessing = true;
        updateStatus('正在建立新的对话...', 'processing');

        // 重置会话状态
        appState.visitorConversationId = null;  // 重置来访者会话ID
        appState.supervisorConversationId = null; // 重置督导会话ID
        appState.conversationStarted = false;
        appState.currentEvaluation = null;

        // 清空对话区域和评价历史
        elements.chatContainer.innerHTML = '';
        elements.evaluationContainer.innerHTML = '<div class="no-evaluation">暂无评价信息。开始对话后，督导会对你的回复进行评价。</div>';
        elements.historyList.innerHTML = '';

        appState.conversationHistory = [];
        appState.evaluationHistory = [];

        // 显示系统消息
        displayMessage('系统', '新的对话已开始，来访者正在进入...', 'system');

        // 调用来访者Agent获取初始消息（不使用会话ID，创建新会话）
        const initialMessage = await callVisitorAgent("你好，我是一名心理咨询师，很高兴认识你。请告诉我你今天想聊些什么？");

        // 显示来访者的第一条消息
        displayMessage('来访者', initialMessage, 'visitor');

        // 启用输入
        elements.userInput.disabled = false;
        elements.sendBtn.disabled = false;
        elements.startBtn.disabled = true;
        appState.conversationStarted = true;

        updateStatus('对话进行中 - 请回复来访者');

    } catch (error) {
        console.error('开始对话失败:', error);
        updateStatus('连接失败，请重试', 'error');
        displayMessage('系统', '连接来访者失败，请检查网络连接后重试。', 'system');
    } finally {
        appState.isProcessing = false;
    }
}

// 发送消息
async function sendMessage() {
    const message = elements.userInput.value.trim();
    if (!message || appState.isProcessing) return;

    try {
        appState.isProcessing = true;
        elements.sendBtn.disabled = true;
        elements.userInput.disabled = true;

        // 显示咨询师消息
        displayMessage('我', message, 'counselor');

        // 清空输入框
        elements.userInput.value = '';

        updateStatus('督导正在评价...', 'processing');

        // 调用督导Agent评价咨询师的回复
        const evaluation = await callSupervisorAgent(message);
        displayEvaluation(evaluation);

        updateStatus('来访者正在回复...', 'processing');

        // 调用来访者Agent获取回复
        const visitorResponse = await callVisitorAgent(message);
        displayMessage('来访者', visitorResponse, 'visitor');

        updateStatus('对话进行中 - 请回复来访者');

    } catch (error) {
        console.error('发送消息失败:', error);
        updateStatus('发送失败，请重试', 'error');
        displayMessage('系统', '消息发送失败，请重试。', 'system');
    } finally {
        appState.isProcessing = false;
        elements.sendBtn.disabled = false;
        elements.userInput.disabled = false;
        elements.userInput.focus();
    }
}


// 初始化函数
async function initializeApp() {
    console.log('开始初始化应用...');

    // 检查DOM元素是否存在
    if (!elements.chatContainer) {
        console.error('chatContainer 元素未找到');
        return;
    }
    if (!elements.userInput) {
        console.error('userInput 元素未找到');
        return;
    }
    if (!elements.startBtn) {
        console.error('startBtn 元素未找到');
        return;
    }

    console.log('所有DOM元素已找到');

    // 跳过API连接测试，直接开始
    console.log('跳过API测试，开始对话...');

    // 绑定事件监听器
    if (elements.userInput) {
        elements.userInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!elements.sendBtn.disabled) {
                    sendMessage();
                }
            }
        });

        // 监听输入框变化
        elements.userInput.addEventListener('input', function() {
            console.log('输入框内容变化:', this.value);
        });

        elements.userInput.addEventListener('focus', function() {
            console.log('输入框获得焦点');
        });
    }

    console.log('心理咨询模拟系统初始化完成');
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', initializeApp);

// 切换评价历史显示
function toggleEvaluationHistory() {
    const historyList = elements.historyList;
    const toggleText = elements.historyToggleText;

    if (historyList.classList.contains('collapsed')) {
        historyList.classList.remove('collapsed');
        toggleText.textContent = '收起';
    } else {
        historyList.classList.add('collapsed');
        toggleText.textContent = '展开';
    }
}

// 显示完整历史记录弹窗
function showAllHistory() {
    elements.historyModal.style.display = 'block';
    showEvaluationHistoryFull();
}

// 显示对话历史
function showConversationHistory() {
    elements.historyModal.style.display = 'block';
    elements.modalTitle.textContent = '对话历史';
    switchHistoryTab('conversation');
    displayConversationHistory();
}

// 关闭历史记录弹窗
function closeHistoryModal() {
    elements.historyModal.style.display = 'none';
}

// 切换历史记录标签页
function switchHistoryTab(tab) {
    // 更新标签按钮状态
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // 显示对应内容
    if (tab === 'conversation') {
        elements.modalTitle.textContent = '对话历史';
        displayConversationHistory();
    } else {
        elements.modalTitle.textContent = '督导评价历史';
        displayEvaluationHistoryFull();
    }
}

// 显示完整对话历史
function displayConversationHistory() {
    let html = '';

    if (appState.conversationHistory.length === 0) {
        html = '<div class="no-evaluation">暂无对话记录</div>';
    } else {
        html = '<div class="conversation-history">';

        // 按时间分组显示对话
        let currentTime = null;
        let currentGroup = [];

        appState.conversationHistory.forEach((message, index) => {
            const messageTime = new Date(message.timestamp).toLocaleString();

            if (messageTime !== currentTime) {
                // 如果有上一组，先输出
                if (currentGroup.length > 0) {
                    html += '<div class="history-group">';
                    html += `<div class="history-timestamp">📅 ${currentTime}</div>`;
                    currentGroup.forEach(msg => {
                        html += `<div class="history-message ${msg.type}">
                            <strong>${msg.sender}:</strong> ${msg.content}
                        </div>`;
                    });
                    html += '</div>';
                    currentGroup = [];
                }
                currentTime = messageTime;
            }

            currentGroup.push(message);
        });

        // 输出最后一组
        if (currentGroup.length > 0) {
            html += '<div class="history-group">';
            html += `<div class="history-timestamp">📅 ${currentTime}</div>`;
            currentGroup.forEach(msg => {
                html += `<div class="history-message ${msg.type}">
                    <strong>${msg.sender}:</strong> ${msg.content}
                </div>`;
            });
            html += '</div>';
        }

        html += '</div>';
    }

    elements.historyContent.innerHTML = html;
}

// 显示完整督导评价历史
function displayEvaluationHistoryFull() {
    let html = '';

    if (appState.evaluationHistory.length === 0) {
        html = '<div class="no-evaluation">暂无督导评价记录</div>';
    } else {
        html = '<div class="evaluation-history-full">';

        appState.evaluationHistory.forEach((evaluation, index) => {
            const time = new Date(evaluation.timestamp).toLocaleString();
            html += `<div class="full-evaluation">
                <div class="evaluation-header">
                    <div class="score">${evaluation.综合得分 || 3}</div>
                    <div class="evaluation-title">评价 #${appState.evaluationHistory.length - index}</div>
                    <div class="evaluation-time">${time}</div>
                </div>
                <div class="evaluation-content">
                    <strong>总体评价：</strong>${(evaluation.总体评价 || '暂无评价').replace(/"/g, '')}
                </div>
                <div class="evaluation-suggestions">
                    <strong>建议：</strong>${(evaluation.建议 || '暂无建议').replace(/"/g, '')}
                </div>
            </div>`;
        });

        html += '</div>';
    }

    elements.historyContent.innerHTML = html;
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', initializeApp);

// 确保在页面完全加载后也执行初始化
window.addEventListener('load', function() {
    console.log('页面完全加载');
    // 如果DOM加载时初始化失败，再次尝试
    if (!elements.userInput || !elements.chatContainer) {
        console.log('重新初始化...');
        setTimeout(initializeApp, 100);
    }
});

// 心理状态图表渲染
function updatePsychometricsDisplay() {
    updateEmotionChart();
    updateStressChart();
    updateSessionEmotionTimeline();
    updateConversationStageChart();
}

// 更新情绪曲线
function updateEmotionChart() {
    if (!elements.emotionChart) return;

    const emotionData = appState.psychometrics.emotion_curve;
    if (emotionData.length === 0) {
        elements.emotionChart.innerHTML = '<div class="chart-placeholder">等待对话数据...</div>';
        return;
    }

    // 按turn排序
    emotionData.sort((a, b) => a.turn - b.turn);

    // 创建SVG图表
    const width = elements.emotionChart.clientWidth || 300;
    const height = 150;
    const padding = 20;

    const maxValue = Math.max(...emotionData.map(d => d.value), 1);
    const minValue = Math.min(...emotionData.map(d => d.value), 0);
    const valueRange = maxValue - minValue || 1;

    const xStep = (width - 2 * padding) / Math.max(emotionData.length - 1, 1);
    const yScale = (height - 2 * padding) / valueRange;

    // 生成路径点
    const pathPoints = emotionData.map((point, index) => {
        const x = padding + index * xStep;
        const y = height - padding - (point.value - minValue) * yScale;
        return `${x},${y}`;
    }).join(' ');

    // 创建平滑曲线
    const smoothPath = createSmoothPath(pathPoints);

    // 获取最新值
    const latestValue = emotionData[emotionData.length - 1].value;
    const emotionLevel = latestValue > 0.6 ? '积极' : latestValue < 0.4 ? '消极' : '平静';

    if (elements.emotionStatus) {
        elements.emotionStatus.textContent = `${emotionLevel} (${(latestValue * 10).toFixed(1)}/10)`;
    }

    const svg = `
        <svg width="${width}" height="${height}" style="border: 1px solid #ddd; border-radius: 4px;">
            <!-- 网格线 -->
            ${createGridLines(width, height, padding)}

            <!-- 坐标轴 -->
            <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#666" stroke-width="1" />
            <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#666" stroke-width="1" />

            <!-- 情绪曲线 -->
            <path d="${smoothPath}"
                  fill="none"
                  stroke="url(#emotionGradient)"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round" />

            <!-- 渐变定义 -->
            <defs>
                <linearGradient id="emotionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#e74c3c;stop-opacity:1" />
                    <stop offset="50%" style="stop-color:#f39c12;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#27ae60;stop-opacity:1" />
                </linearGradient>
            </defs>

            <!-- 数据点 -->
            ${emotionData.map((point, index) => {
                const x = padding + index * xStep;
                const y = height - padding - (point.value - minValue) * yScale;
                const color = point.value > 0.6 ? '#27ae60' : point.value < 0.4 ? '#e74c3c' : '#f39c12';
                return `
                    <circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="white" stroke-width="2">
                        <title>Turn ${point.turn}: ${point.value.toFixed(2)}</title>
                    </circle>
                `;
            }).join('')}

            <!-- 最新值标签 -->
            ${emotionData.length > 0 ? `
                <text x="${width - padding}" y="${height - padding - (latestValue - minValue) * yScale - 10}"
                      text-anchor="end" fill="#2c3e50" font-size="12" font-weight="bold">
                    ${(latestValue * 10).toFixed(1)}
                </text>
            ` : ''}
        </svg>
    `;

    elements.emotionChart.innerHTML = svg;
}

// 更新压力曲线
function updateStressChart() {
    if (!elements.stressChart) return;

    const stressData = appState.psychometrics.stress_curve;
    if (stressData.length === 0) {
        elements.stressChart.innerHTML = '<div class="chart-placeholder">等待对话数据...</div>';
        return;
    }

    // 按turn排序
    stressData.sort((a, b) => a.turn - b.turn);

    const width = elements.stressChart.clientWidth || 300;
    const height = 150;
    const padding = 20;

    const maxValue = Math.max(...stressData.map(d => d.value), 1);
    const minValue = Math.min(...stressData.map(d => d.value), 0);
    const valueRange = maxValue - minValue || 1;

    const xStep = (width - 2 * padding) / Math.max(stressData.length - 1, 1);
    const yScale = (height - 2 * padding) / valueRange;

    // 生成路径点
    const pathPoints = stressData.map((point, index) => {
        const x = padding + index * xStep;
        const y = height - padding - (point.value - minValue) * yScale;
        return `${x},${y}`;
    }).join(' ');

    const smoothPath = createSmoothPath(pathPoints);

    // 获取最新值
    const latestValue = stressData[stressData.length - 1].value;
    const stressLevel = latestValue > 0.7 ? '高压力' : latestValue > 0.4 ? '中等压力' : '低压力';

    if (elements.stressStatus) {
        elements.stressStatus.textContent = `${stressLevel} (${(latestValue * 10).toFixed(1)}/10)`;
    }

    const svg = `
        <svg width="${width}" height="${height}" style="border: 1px solid #ddd; border-radius: 4px;">
            ${createGridLines(width, height, padding)}

            <!-- 坐标轴 -->
            <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#666" stroke-width="1" />
            <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#666" stroke-width="1" />

            <!-- 压力曲线 -->
            <path d="${smoothPath}"
                  fill="none"
                  stroke="url(#stressGradient)"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round" />

            <defs>
                <linearGradient id="stressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#27ae60;stop-opacity:1" />
                    <stop offset="50%" style="stop-color:#f39c12;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#e74c3c;stop-opacity:1" />
                </linearGradient>
            </defs>

            <!-- 数据点和区域填充 -->
            ${stressData.map((point, index) => {
                const x = padding + index * xStep;
                const y = height - padding - (point.value - minValue) * yScale;
                const color = point.value > 0.7 ? '#e74c3c' : point.value > 0.4 ? '#f39c12' : '#27ae60';
                return `
                    <circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="white" stroke-width="2">
                        <title>Turn ${point.turn}: ${point.value.toFixed(2)}</title>
                    </circle>
                `;
            }).join('')}

            <!-- 最新值标签 -->
            ${stressData.length > 0 ? `
                <text x="${width - padding}" y="${height - padding - (latestValue - minValue) * yScale - 10}"
                      text-anchor="end" fill="#2c3e50" font-size="12" font-weight="bold">
                    ${(latestValue * 10).toFixed(1)}
                </text>
            ` : ''}
        </svg>
    `;

    elements.stressChart.innerHTML = svg;
}

// 更新会话情绪时间线
function updateSessionEmotionTimeline() {
    const timelineData = appState.psychometrics.session_emotion_timeline;
    // 时间线数据可以在emotionChart中合并显示，或者创建专门的视图
    console.log('会话情绪时间线数据:', timelineData);
}

// 更新对话阶段曲线
function updateConversationStageChart() {
    if (!elements.conversationStageStatus || !elements.stageProgress) return;

    const stageData = appState.psychometrics.conversation_stage_curve;
    if (stageData.length === 0) {
        elements.conversationStageStatus.textContent = '初期接触';
        elements.stageProgress.innerHTML = '';
        return;
    }

    // 按turn排序并获取最新阶段
    stageData.sort((a, b) => a.turn - b.turn);
    const latestStage = stageData[stageData.length - 1];

    // 阶段名称映射
    const stageNames = [
        '初期接触', '建立关系', '问题探索', '深入分析',
        '目标设定', '策略实施', '巩固阶段', '准备结束', '总结回顾'
    ];

    const currentStageIndex = Math.floor(latestStage.value * (stageNames.length - 1));
    const currentStageName = stageNames[currentStageIndex];

    if (elements.conversationStageStatus) {
        elements.conversationStageStatus.textContent = currentStageName;
    }

    // 创建阶段进度条
    const progressHTML = stageNames.map((stage, index) => {
        const isActive = index <= currentStageIndex;
        const isCurrent = index === currentStageIndex;
        return `
            <div class="stage-item ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}"
                 title="${stage}">
                <div class="stage-dot"></div>
                <div class="stage-label">${stage}</div>
            </div>
        `;
    }).join('');

    elements.stageProgress.innerHTML = progressHTML;
}

// 创建平滑曲线路径
function createSmoothPath(points) {
    if (!points) return '';

    const pointArray = points.split(' ').map(point => {
        const [x, y] = point.split(',').map(Number);
        return { x, y };
    });

    if (pointArray.length < 2) return points;

    let path = `M ${pointArray[0].x},${pointArray[0].y}`;

    for (let i = 1; i < pointArray.length; i++) {
        const xMid = (pointArray[i].x + pointArray[i - 1].x) / 2;
        const yMid = (pointArray[i].y + pointArray[i - 1].y) / 2;
        const cpX1 = xMid;
        const cpY1 = pointArray[i - 1].y;
        const cpX2 = xMid;
        const cpY2 = pointArray[i].y;

        path += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${pointArray[i].x},${pointArray[i].y}`;
    }

    return path;
}

// 创建网格线
function createGridLines(width, height, padding) {
    const gridLines = [];
    const horizontalLines = 5;
    const verticalLines = 5;

    // 水平网格线
    for (let i = 0; i <= horizontalLines; i++) {
        const y = padding + (height - 2 * padding) * i / horizontalLines;
        gridLines.push(`<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#f0f0f0" stroke-width="1" />`);
    }

    // 垂直网格线
    for (let i = 0; i <= verticalLines; i++) {
        const x = padding + (width - 2 * padding) * i / verticalLines;
        gridLines.push(`<line x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}" stroke="#f0f0f0" stroke-width="1" />`);
    }

    return gridLines.join('');
}

// 点击弹窗外部关闭弹窗
window.onclick = function(event) {
    if (event.target === elements.historyModal) {
        closeHistoryModal();
    }
}
