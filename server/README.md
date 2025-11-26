# API代理服务器

## 配置

1. 在 `server` 目录下创建 `.env` 文件：

```bash
# 服务器端口
PORT=3000

# DeepSeek API密钥 (https://platform.deepseek.com/api_keys)
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 硅基流动 SiliconFlow API密钥 (https://cloud.siliconflow.cn/)
SILICONFLOW_API_KEY=your_siliconflow_api_key_here
```

2. 安装依赖：

```bash
cd server
npm install
```

3. 启动服务器：

```bash
npm start
```

## API端点

- `GET /api/health` - 健康检查
- `POST /api/deepseek/chat` - DeepSeek Chat API代理
- `POST /api/siliconflow/ocr` - SiliconFlow OCR API代理

## 使用方式

API密钥可以通过以下方式传递：
1. 环境变量（.env文件）
2. 请求头 `X-Api-Key`


