import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from parent directory
app.use(express.static('../'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DeepSeek API proxy
app.post('/api/deepseek/chat', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'] || process.env.DEEPSEEK_API_KEY;
        
        if (!apiKey) {
            return res.status(401).json({ error: 'API key is required' });
        }

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('DeepSeek API error:', error);
        res.status(500).json({ error: 'Failed to call DeepSeek API', details: error.message });
    }
});

// SiliconFlow OCR API proxy
app.post('/api/siliconflow/ocr', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'] || process.env.SILICONFLOW_API_KEY;
        
        if (!apiKey) {
            return res.status(401).json({ error: 'API key is required' });
        }

        const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'Qwen/Qwen3-VL-8B-Instruct',
                messages: req.body.messages,
                max_tokens: req.body.max_tokens || 4096
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('SiliconFlow OCR API error:', error);
        res.status(500).json({ error: 'Failed to call SiliconFlow OCR API', details: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║     智银派授信报告智能填写系统 - API代理服务器              ║
╠════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                  ║
║  Health check:      http://localhost:${PORT}/api/health       ║
╠════════════════════════════════════════════════════════════╣
║  API Endpoints:                                            ║
║  - POST /api/deepseek/chat    (DeepSeek Chat API)          ║
║  - POST /api/siliconflow/ocr  (SiliconFlow OCR API)        ║
╚════════════════════════════════════════════════════════════╝
    `);
});

