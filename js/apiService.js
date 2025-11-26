/**
 * API Service Module
 * Handles all API calls to DeepSeek and SiliconFlow OCR
 */

class ApiService {
    constructor() {
        this.proxyServer = localStorage.getItem('proxyServer') || 'http://localhost:3000';
        this.deepseekApiKey = localStorage.getItem('deepseekApiKey') || '';
        this.siliconflowApiKey = localStorage.getItem('siliconflowApiKey') || '';
    }

    /**
     * Update API configuration
     */
    updateConfig(config) {
        if (config.proxyServer) {
            this.proxyServer = config.proxyServer;
            localStorage.setItem('proxyServer', config.proxyServer);
        }
        if (config.deepseekApiKey) {
            this.deepseekApiKey = config.deepseekApiKey;
            localStorage.setItem('deepseekApiKey', config.deepseekApiKey);
        }
        if (config.siliconflowApiKey) {
            this.siliconflowApiKey = config.siliconflowApiKey;
            localStorage.setItem('siliconflowApiKey', config.siliconflowApiKey);
        }
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return {
            proxyServer: this.proxyServer,
            deepseekApiKey: this.deepseekApiKey,
            siliconflowApiKey: this.siliconflowApiKey
        };
    }

    /**
     * Call DeepSeek Chat API for text analysis and generation
     * @param {Array} messages - Array of message objects with role and content
     * @param {Object} options - Additional options like temperature, max_tokens
     * @returns {Promise<string>} - The assistant's response content
     */
    async callDeepSeek(messages, options = {}) {
        if (!this.deepseekApiKey) {
            throw new Error('DeepSeek API Key 未配置，请在设置中配置');
        }

        const requestBody = {
            model: options.model || 'deepseek-chat',
            messages: messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens || 4096,
            stream: false
        };

        try {
            const response = await fetch(`${this.proxyServer}/api/deepseek/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': this.deepseekApiKey
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || '';
        } catch (error) {
            console.error('DeepSeek API Error:', error);
            throw error;
        }
    }

    /**
     * Call SiliconFlow OCR API for image text extraction
     * @param {string} imageBase64 - Base64 encoded image data
     * @returns {Promise<string>} - Extracted text from image
     */
    async callOCR(imageBase64) {
        if (!this.siliconflowApiKey) {
            throw new Error('SiliconFlow API Key 未配置，请在设置中配置');
        }

        // Ensure proper base64 format with data URL prefix
        let imageUrl = imageBase64;
        if (!imageBase64.startsWith('data:')) {
            imageUrl = `data:image/jpeg;base64,${imageBase64}`;
        }

        const requestBody = {
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageUrl
                            }
                        },
                        {
                            type: 'text',
                            text: '请仔细识别图片中的所有文字内容，提取企业工商信息。请以JSON格式返回以下字段（如有）：companyName(企业名称), creditCode(统一社会信用代码), legalRep(法定代表人), registeredCapital(注册资本), establishDate(成立日期), industry(所属行业), registeredAddress(注册地址), businessScope(经营范围), companyType(企业类型), employeeCount(员工人数), companySize(企业规模)。如果某个字段在图片中找不到，请设为null。'
                        }
                    ]
                }
            ],
            max_tokens: 4096
        };

        try {
            const response = await fetch(`${this.proxyServer}/api/siliconflow/ocr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': this.siliconflowApiKey
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `OCR API请求失败: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || '';
        } catch (error) {
            console.error('SiliconFlow OCR Error:', error);
            throw error;
        }
    }

    /**
     * Analyze Word template content to identify placeholders
     * @param {string} templateContent - Raw text content from Word template
     * @returns {Promise<Object>} - Analysis result with suggested placeholders
     */
    async analyzeTemplate(templateContent) {
        const systemPrompt = `你是一个专业的银行授信报告分析助手。你的任务是分析给定的授信报告模板文本，识别其中需要填写的字段和位置。

请分析模板内容，返回一个JSON对象，包含以下结构：
{
    "fields": [
        {
            "name": "字段名称（英文，如companyName）",
            "label": "字段标签（中文，如企业名称）",
            "type": "字段类型（text/date/number/textarea）",
            "category": "分类（company/financial/credit/text）",
            "context": "在模板中出现的上下文位置描述"
        }
    ],
    "sections": [
        {
            "name": "章节名称（英文）",
            "label": "章节标题（中文）",
            "type": "章节类型（overview/analysis/risk/conclusion）"
        }
    ]
}

请确保：
1. 识别所有需要填写的数据字段（企业信息、财务数据、授信信息等）
2. 识别所有需要撰写的文本章节
3. 字段名使用驼峰命名法
4. 返回纯JSON，不要包含其他文本`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请分析以下授信报告模板：\n\n${templateContent}` }
        ];

        try {
            const response = await this.callDeepSeek(messages, { temperature: 0.3 });
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('无法解析模板分析结果');
        } catch (error) {
            console.error('Template analysis error:', error);
            throw error;
        }
    }

    /**
     * Generate text content for a specific section
     * @param {string} fieldName - The field/section to generate content for
     * @param {Object} context - Context data including company info, financial data
     * @returns {Promise<string>} - Generated text content
     */
    async generateContent(fieldName, context) {
        const prompts = {
            basicSituation: `请根据以下企业信息，撰写一段关于企业基本情况的描述（约300字），包括企业历史沿革、组织架构、股权结构、主营业务等：`,
            controllerSituation: `请根据以下信息，撰写一段关于实际控制人情况的描述（约200字）：`,
            businessStatus: `请根据以下企业信息和财务数据，撰写一段关于企业经营状况的分析（约300字）：`,
            marketAnalysis: `请根据以下企业信息，撰写一段关于行业和市场分析的内容（约250字）：`,
            financialOverview: `请根据以下财务数据，撰写一段财务状况概述（约300字），分析资产负债结构、盈利能力、偿债能力等：`,
            financialIndicators: `请根据以下财务指标数据，撰写关键财务指标分析（约250字）：`,
            creditRisk: `请根据以下企业信息和财务数据，分析信用风险（约200字）：`,
            marketRisk: `请根据以下企业和行业信息，分析市场风险（约200字）：`,
            overallEvaluation: `请根据以下所有信息，撰写对该企业的总体评价（约300字）：`,
            creditSuggestion: `请根据以下信息，提出具体的授信建议（约250字），包括授信额度、期限、利率、担保方式等建议：`
        };

        const basePrompt = prompts[fieldName] || '请根据以下信息撰写相关内容：';
        
        const contextText = `
企业信息：
- 企业名称：${context.companyName || '未提供'}
- 成立日期：${context.establishDate || '未提供'}
- 注册资本：${context.registeredCapital || '未提供'}
- 所属行业：${context.industry || '未提供'}
- 企业规模：${context.companySize || '未提供'}
- 经营范围：${context.businessScope || '未提供'}

财务数据：
- 资产总额：${context.totalAssetsEnd || '未提供'} 万元
- 负债总额：${context.totalLiabilitiesEnd || '未提供'} 万元
- 所有者权益：${context.ownerEquityEnd || '未提供'} 万元
- 营业收入：${context.revenueCurrent || '未提供'} 万元
- 净利润：${context.netProfitCurrent || '未提供'} 万元
- 资产负债率：${context.debtRatioEnd || '未提供'}%

授信信息：
- 授信类型：${context.creditType || '未提供'}
- 授信金额：${context.creditAmount || '未提供'} 万元
- 授信期限：${context.creditPeriod || '未提供'} 个月
- 授信用途：${context.creditPurpose || '未提供'}
`;

        const systemPrompt = `你是一个专业的银行授信报告撰写助手。请根据提供的企业信息和财务数据，撰写专业、客观、符合银行授信报告规范的内容。
注意：
1. 使用专业的银行术语
2. 数据引用准确
3. 分析要有逻辑性
4. 结论要客观谨慎
5. 只返回正文内容，不要包含标题`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${basePrompt}\n${contextText}` }
        ];

        try {
            const response = await this.callDeepSeek(messages, { temperature: 0.7 });
            return response.trim();
        } catch (error) {
            console.error('Content generation error:', error);
            throw error;
        }
    }

    /**
     * Generate all text content at once
     * @param {Object} context - All context data
     * @returns {Promise<Object>} - Object with all generated content
     */
    async generateAllContent(context) {
        const fields = [
            'basicSituation',
            'controllerSituation', 
            'businessStatus',
            'marketAnalysis',
            'financialOverview',
            'financialIndicators',
            'creditRisk',
            'marketRisk',
            'overallEvaluation',
            'creditSuggestion'
        ];

        const results = {};
        
        // Generate content sequentially to avoid rate limiting
        for (const field of fields) {
            try {
                results[field] = await this.generateContent(field, context);
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Error generating ${field}:`, error);
                results[field] = '';
            }
        }

        return results;
    }

    /**
     * Health check for proxy server
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.proxyServer}/api/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

// Export singleton instance
const apiService = new ApiService();


