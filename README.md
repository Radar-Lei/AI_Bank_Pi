# 智银派授信报告智能填写系统

基于AI的银行授信报告自动生成工具，利用DeepSeek API和SiliconFlow OCR实现智能信息提取和报告生成。

## 功能特点

- **智能OCR识别**: 自动识别工商信息截图中的企业信息
- **财务数据提取**: 解析Excel财务报表，自动提取关键财务指标
- **模板智能分析**: 使用LLM分析Word模板，识别需要填写的字段
- **AI内容生成**: 基于提取的数据自动生成报告文本内容
- **报告自动填充**: 将数据填充到Word模板生成最终报告

## 系统架构

```
用户浏览器 (前端)
    ├── 文件上传与解析 (docxtemplater, xlsx.js)
    ├── UI交互 (4步骤向导)
    └── 数据处理逻辑
         ↓
代理服务器 (Node.js Express - 仅转发API)
         ↓
    ┌────────────────┬────────────────┐
    │  DeepSeek API  │ SiliconFlow OCR│
    │  (文本分析)     │  (图片识别)     │
    └────────────────┴────────────────┘
```

## 快速开始

### 1. 安装代理服务器依赖

```bash
cd server
npm install
```

### 2. 配置API密钥

在 `server` 目录下创建 `.env` 文件：

```env
PORT=3000
DEEPSEEK_API_KEY=your_deepseek_api_key_here
SILICONFLOW_API_KEY=your_siliconflow_api_key_here
```

或者在前端界面的设置中配置API密钥。

### 3. 启动代理服务器

```bash
cd server
npm start
```

### 4. 打开前端页面

使用浏览器打开 `index.html` 文件，或使用本地服务器：

```bash
# 使用 Python
python -m http.server 8080

# 或使用 Node.js
npx serve .
```

然后访问 `http://localhost:8080`

## 使用流程

### 步骤1: 上传材料

上传以下三种文件：
- **授信报告模板** (Word文档 .docx)
- **财务报表** (Excel表格 .xlsx/.xls，可多选)
- **工商信息截图** (图片 .jpg/.png 或 PDF)

### 步骤2: 信息确认

系统会自动提取信息并填充到表单中，请确认或修改：
- 企业基本信息（名称、信用代码、法人等）
- 财务数据（资产、负债、收入等）
- 授信信息（类型、金额、期限等）

### 步骤3: 文本填写

填写或使用AI生成报告的详细文本内容：
- 企业概况
- 经营分析
- 财务分析
- 风险分析
- 结论与建议

### 步骤4: 生成报告

预览并下载最终的授信报告文档。

## API配置说明

### DeepSeek API

用于文本分析和内容生成。

- 获取API密钥: https://platform.deepseek.com/api_keys
- 文档: https://api-docs.deepseek.com/zh-cn/

### SiliconFlow OCR

用于工商信息截图的文字识别。

- 获取API密钥: https://cloud.siliconflow.cn/
- 使用模型: deepseek-ai/DeepSeek-OCR

## 项目结构

```
AI_Bank_Pi/
├── index.html              # 主页面
├── js/
│   ├── app.js              # 主应用逻辑
│   ├── fileParser.js       # 文件解析模块
│   ├── apiService.js       # API调用封装
│   ├── templateEngine.js   # 模板处理引擎
│   └── uiController.js     # UI控制器
├── server/
│   ├── proxy.js            # API代理服务器
│   ├── package.json        # 服务器依赖
│   └── README.md           # 服务器说明
├── input/                  # 测试输入文件
│   ├── 2022年报表.xls
│   ├── 2023年报表.xls
│   ├── 2024年报表.xls
│   ├── 2025年报表.xls
│   └── 工商信息截图.jpg
└── template/               # 模板文件
    └── J1模板：公司授信业务调查报告...docx
```

## 技术栈

### 前端
- Tailwind CSS - UI样式框架
- docxtemplater + PizZip - Word文档处理
- SheetJS (xlsx) - Excel解析
- FileSaver.js - 文件下载

### 后端
- Node.js + Express - API代理服务器
- dotenv - 环境变量管理

### AI服务
- DeepSeek API - 文本分析和生成
- SiliconFlow DeepSeek-OCR - 图像文字识别

## 注意事项

1. **API密钥安全**: 
   - 不要在前端代码中硬编码API密钥
   - 建议通过代理服务器的环境变量配置

2. **文件格式**:
   - Word模板必须是 .docx 格式
   - 建议使用高清的工商信息截图以提高OCR准确率

3. **网络要求**:
   - 需要能够访问DeepSeek和SiliconFlow的API服务

## 许可证

MIT License

