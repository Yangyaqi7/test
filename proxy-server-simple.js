const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// 启用CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'file://', 'null'],
    credentials: true
}));

// 创建简单的Dify代理
const difyProxy = createProxyMiddleware({
    target: 'https://dify.ai-role.cn',
    changeOrigin: true,
    timeout: 30000,
    pathRewrite: {
        '^/api': '/v1'
    }
});

app.use('/api', difyProxy);

// 处理所有OPTIONS请求
app.options('/api/*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.sendStatus(200);
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`代理服务器运行在 http://localhost:${PORT}`);
    console.log('请访问 http://localhost:3000/index.html');
});