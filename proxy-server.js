const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;

// 启用CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'file://', 'null'],
    credentials: true
}));

// JSON中间件
app.use(express.json());

// 代理Dify API请求
app.use('/api', createProxyMiddleware({
    target: 'http://dify.ai-role.cn',
    changeOrigin: true,
    secure: false,
    timeout: 30000, // 30秒超时
    pathRewrite: {
        '^/api': '/v1'
    },
    onProxyReq: (proxyReq, req, res) => {
        // 简化日志输出，避免特殊字符
        console.log(`[REQUEST] ${req.method} ${req.url}`);

        // 确保Authorization头被正确传递
        if (req.headers.authorization) {
            proxyReq.setHeader('Authorization', req.headers.authorization);
        }

        // 设置其他必要的头
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Accept', 'application/json');

        // 设置User-Agent
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        // 设置连接保持
        proxyReq.setHeader('Connection', 'keep-alive');
    },
    onProxyRes: (proxyRes, req, res) => {
        // 简化响应日志
        console.log(`[RESPONSE] ${proxyRes.statusCode} ${req.url}`);

        // 处理流式响应
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    },
    onError: (err, req, res) => {
        console.error('代理错误:', err);
        console.error('请求URL:', req.url);
        console.error('请求方法:', req.method);

        // 尝试返回更详细的错误信息
        if (!res.headersSent) {
            res.status(502).json({
                error: '代理服务器错误',
                message: err.message,
                code: err.code,
                url: req.url,
                method: req.method,
                timestamp: new Date().toISOString()
            });
        }
    }
}));

// 测试端点
app.get('/api/test', (req, res) => {
    console.log('收到API测试请求');
    res.json({
        status: 'ok',
        message: '代理服务器运行正常',
        timestamp: new Date().toISOString()
    });
});

// 处理所有OPTIONS请求（CORS预检）
app.options('/api/*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Content-Length');
    res.sendStatus(200);
});

// 静态文件服务
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`代理服务器运行在 http://localhost:${PORT}`);
    console.log('请访问 http://localhost:3000/index.html');
});