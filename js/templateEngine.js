/**
 * Template Engine Module
 * Handles intelligent placeholder identification and template filling
 */

class TemplateEngine {
    constructor() {
        this.templateAnalysis = null;
        this.placeholderMap = {};
        this.documentData = {};
        this.originalZip = null;
        this.documentXml = null;
    }

    /**
     * Analyze template and identify placeholders
     */
    async analyzeTemplate(templateContent) {
        try {
            const existingPlaceholders = this.findExistingPlaceholders(templateContent);
            
            this.templateAnalysis = {
                hasExistingPlaceholders: existingPlaceholders.length > 0,
                placeholders: existingPlaceholders,
                content: templateContent
            };
            
            return this.templateAnalysis;
        } catch (error) {
            console.error('Template analysis error:', error);
            return { hasExistingPlaceholders: false, placeholders: [], content: templateContent };
        }
    }

    /**
     * Find existing placeholders in template
     */
    findExistingPlaceholders(content) {
        const regex = /\{([^}]+)\}/g;
        const placeholders = [];
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            const placeholder = match[1].trim();
            if (!placeholders.includes(placeholder)) {
                placeholders.push(placeholder);
            }
        }
        
        return placeholders;
    }

    /**
     * Store the original template zip
     */
    setOriginalZip(zip) {
        this.originalZip = zip;
        try {
            this.documentXml = zip.file('word/document.xml').asText();
        } catch (e) {
            console.error('Error extracting document.xml:', e);
        }
    }

    /**
     * Set document data
     */
    setDocumentData(data) {
        this.documentData = { ...this.documentData, ...data };
    }

    /**
     * Get document data
     */
    getDocumentData() {
        return this.documentData;
    }

    /**
     * Generate filled document
     */
    generateDocument(templateZip, data) {
        try {
            const zip = templateZip.clone();
            let documentXml = zip.file('word/document.xml').asText();
            
            console.log('Original XML length:', documentXml.length);
            
            // Check if template has docxtemplater-style placeholders
            const hasPlaceholders = /\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(documentXml);
            
            if (hasPlaceholders) {
                console.log('Template has placeholders, using docxtemplater');
                return this.generateWithDocxtemplater(zip, data);
            } else {
                console.log('Template has no placeholders, using text replacement');
                return this.generateWithSmartReplacement(zip, data, documentXml);
            }
        } catch (error) {
            console.error('Document generation error:', error);
            throw new Error('生成文档失败：' + error.message);
        }
    }

    /**
     * Generate document using docxtemplater
     */
    generateWithDocxtemplater(zip, data) {
        const doc = new window.docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '{', end: '}' }
        });

        const preparedData = this.prepareDataForTemplate(data);
        doc.render(preparedData);

        return doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
    }

    /**
     * Generate document using smart text replacement
     * This handles documents without placeholders by:
     * 1. Finding and replacing text patterns
     * 2. Appending a filled data section at the end
     */
    generateWithSmartReplacement(zip, data, documentXml) {
        let modifiedXml = documentXml;
        
        // Step 1: Try to replace text in tables and form fields
        modifiedXml = this.replaceTableCells(modifiedXml, data);
        
        // Step 2: Try to replace text following labels
        modifiedXml = this.replaceLabeledContent(modifiedXml, data);
        
        // Step 3: Replace underscores and blank spaces that appear after labels
        modifiedXml = this.replaceBlankFields(modifiedXml, data);
        
        // Step 4: Append filled content section at the end of document
        modifiedXml = this.appendFilledContent(modifiedXml, data);
        
        console.log('Modified XML length:', modifiedXml.length);
        
        // Update the zip with modified content
        zip.file('word/document.xml', modifiedXml);

        return zip.generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
    }

    /**
     * Replace content in table cells
     */
    replaceTableCells(xml, data) {
        // Map labels to data fields
        const labelMap = {
            '企业名称': data.companyName,
            '客户名称': data.companyName,
            '借款人名称': data.companyName,
            '借款人': data.companyName,
            '统一社会信用代码': data.creditCode,
            '社会信用代码': data.creditCode,
            '组织机构代码': data.creditCode,
            '法定代表人': data.legalRep,
            '法人代表': data.legalRep,
            '负责人': data.legalRep,
            '注册资本': data.registeredCapital,
            '注册资金': data.registeredCapital,
            '成立日期': data.establishDate,
            '成立时间': data.establishDate,
            '注册日期': data.establishDate,
            '所属行业': data.industry,
            '行业分类': data.industry,
            '主营行业': data.industry,
            '注册地址': data.registeredAddress,
            '住所': data.registeredAddress,
            '公司地址': data.registeredAddress,
            '经营范围': data.businessScope,
            '员工人数': data.employeeCount,
            '职工人数': data.employeeCount,
            '企业规模': data.companySize,
            '资产总额': data.totalAssetsEnd,
            '资产总计': data.totalAssetsEnd,
            '负债总额': data.totalLiabilitiesEnd,
            '负债总计': data.totalLiabilitiesEnd,
            '所有者权益': data.ownerEquityEnd,
            '净资产': data.ownerEquityEnd,
            '营业收入': data.revenueCurrent,
            '净利润': data.netProfitCurrent,
            '利润总额': data.netProfitCurrent,
            '资产负债率': data.debtRatioEnd,
            '授信金额': data.creditAmount,
            '贷款金额': data.creditAmount,
            '申请金额': data.creditAmount,
            '授信期限': data.creditPeriod,
            '贷款期限': data.creditPeriod,
            '授信类型': data.creditType,
            '贷款类型': data.creditType,
            '贷款品种': data.creditType,
            '授信用途': data.creditPurpose,
            '贷款用途': data.creditPurpose,
            '资金用途': data.creditPurpose,
        };

        // For each label, try to find it in a table cell and fill the adjacent cell
        for (const [label, value] of Object.entries(labelMap)) {
            if (value) {
                // Pattern: Find table cell with label, then look for the next cell with empty/underscore content
                const tablePattern = new RegExp(
                    `(<w:tc[^>]*>.*?<w:t[^>]*>)([^<]*${this.escapeRegex(label)}[^<]*)(<\\/w:t>.*?<\\/w:tc>\\s*<w:tc[^>]*>.*?<w:t[^>]*>)([_\\s]*)(<\\/w:t>)`,
                    'gis'
                );
                
                xml = xml.replace(tablePattern, (match, p1, p2, p3, p4, p5) => {
                    // Only replace if the target cell has underscores or is mostly empty
                    if (p4.trim() === '' || /^[_\s]+$/.test(p4)) {
                        return `${p1}${p2}${p3}${this.escapeXml(String(value))}${p5}`;
                    }
                    return match;
                });
            }
        }

        return xml;
    }

    /**
     * Replace content following labels (colon-separated)
     */
    replaceLabeledContent(xml, data) {
        const labelMap = {
            '企业名称': data.companyName,
            '客户名称': data.companyName,
            '统一社会信用代码': data.creditCode,
            '法定代表人': data.legalRep,
            '注册资本': data.registeredCapital,
            '成立日期': data.establishDate,
            '所属行业': data.industry,
            '注册地址': data.registeredAddress,
            '授信金额': data.creditAmount,
            '授信期限': data.creditPeriod,
        };

        for (const [label, value] of Object.entries(labelMap)) {
            if (value) {
                // Pattern: label followed by colon and then content (potentially across w:t elements)
                // Match: "企业名称：" followed by underscores or spaces
                const colonPattern = new RegExp(
                    `(<w:t[^>]*>)(${this.escapeRegex(label)}[：:][\\s]*)(_+|[\\s]{2,}|　+)(<\\/w:t>)`,
                    'gi'
                );
                
                xml = xml.replace(colonPattern, `$1$2${this.escapeXml(String(value))}$4`);
            }
        }

        return xml;
    }

    /**
     * Replace blank fields (underscores, spaces)
     */
    replaceBlankFields(xml, data) {
        // Find patterns like "企业名称：_______" and replace the underscores
        const patterns = [
            { label: '企业名称', value: data.companyName },
            { label: '客户名称', value: data.companyName },
            { label: '法定代表人', value: data.legalRep },
            { label: '注册资本', value: data.registeredCapital },
            { label: '成立日期', value: data.establishDate },
            { label: '授信金额', value: data.creditAmount },
            { label: '授信期限', value: data.creditPeriod },
        ];

        for (const { label, value } of patterns) {
            if (value) {
                // Match underscores that follow the label (may be in same or next w:t element)
                const regex = new RegExp(
                    `(${this.escapeRegex(label)}[：:]\\s*)(_+)`,
                    'g'
                );
                xml = xml.replace(regex, `$1${this.escapeXml(String(value))}`);
            }
        }

        return xml;
    }

    /**
     * Append filled content section at the end of document
     */
    appendFilledContent(xml, data) {
        // Find the position before </w:body>
        const bodyEndPos = xml.lastIndexOf('</w:body>');
        if (bodyEndPos === -1) {
            console.warn('Could not find </w:body> in document');
            return xml;
        }

        // Create a section with all the filled data
        const filledContent = this.createFilledContentSection(data);
        
        // Insert before </w:body>
        return xml.slice(0, bodyEndPos) + filledContent + xml.slice(bodyEndPos);
    }

    /**
     * Create a section with all filled content
     */
    createFilledContentSection(data) {
        const sections = [];
        
        // Page break before our content
        sections.push(`
            <w:p>
                <w:r>
                    <w:br w:type="page"/>
                </w:r>
            </w:p>
        `);

        // Title
        sections.push(this.createParagraph('授信报告填写数据汇总', true, 'center'));
        sections.push(this.createParagraph(''));

        // Company Information Section
        if (data.companyName || data.creditCode || data.legalRep) {
            sections.push(this.createParagraph('一、企业基本信息', true));
            sections.push(this.createParagraph(''));
            
            const companyInfo = [
                { label: '企业名称', value: data.companyName },
                { label: '统一社会信用代码', value: data.creditCode },
                { label: '法定代表人', value: data.legalRep },
                { label: '注册资本', value: data.registeredCapital },
                { label: '成立日期', value: data.establishDate },
                { label: '所属行业', value: data.industry },
                { label: '企业规模', value: data.companySize },
                { label: '员工人数', value: data.employeeCount },
                { label: '注册地址', value: data.registeredAddress },
            ];

            for (const item of companyInfo) {
                if (item.value) {
                    sections.push(this.createParagraph(`${item.label}：${item.value}`));
                }
            }
            
            if (data.businessScope) {
                sections.push(this.createParagraph(`经营范围：${data.businessScope}`));
            }
            sections.push(this.createParagraph(''));
        }

        // Financial Information Section
        if (data.totalAssetsEnd || data.revenueCurrent) {
            sections.push(this.createParagraph('二、财务信息', true));
            sections.push(this.createParagraph(''));
            
            const financialInfo = [
                { label: '资产总额', value: data.totalAssetsEnd, unit: '万元' },
                { label: '负债总额', value: data.totalLiabilitiesEnd, unit: '万元' },
                { label: '所有者权益', value: data.ownerEquityEnd, unit: '万元' },
                { label: '营业收入', value: data.revenueCurrent, unit: '万元' },
                { label: '净利润', value: data.netProfitCurrent, unit: '万元' },
                { label: '资产负债率', value: data.debtRatioEnd, unit: '%' },
            ];

            for (const item of financialInfo) {
                if (item.value) {
                    sections.push(this.createParagraph(`${item.label}：${item.value}${item.unit || ''}`));
                }
            }
            sections.push(this.createParagraph(''));
        }

        // Credit Information Section
        if (data.creditType || data.creditAmount) {
            sections.push(this.createParagraph('三、授信信息', true));
            sections.push(this.createParagraph(''));
            
            const creditInfo = [
                { label: '授信类型', value: data.creditType },
                { label: '授信金额', value: data.creditAmount, unit: '万元' },
                { label: '授信期限', value: data.creditPeriod, unit: '个月' },
                { label: '授信用途', value: data.creditPurpose },
            ];

            for (const item of creditInfo) {
                if (item.value) {
                    sections.push(this.createParagraph(`${item.label}：${item.value}${item.unit || ''}`));
                }
            }
            sections.push(this.createParagraph(''));
        }

        // Text Content Sections
        const textSections = [
            { title: '四、企业基本情况', field: 'basicSituation' },
            { title: '五、实际控制人情况', field: 'controllerSituation' },
            { title: '六、经营状况分析', field: 'businessStatus' },
            { title: '七、市场分析', field: 'marketAnalysis' },
            { title: '八、财务状况概述', field: 'financialOverview' },
            { title: '九、财务指标分析', field: 'financialIndicators' },
            { title: '十、信用风险分析', field: 'creditRisk' },
            { title: '十一、市场风险分析', field: 'marketRisk' },
            { title: '十二、总体评价', field: 'overallEvaluation' },
            { title: '十三、授信建议', field: 'creditSuggestion' },
        ];

        for (const section of textSections) {
            if (data[section.field]) {
                sections.push(this.createParagraph(section.title, true));
                sections.push(this.createParagraph(''));
                
                // Split content by newlines and create paragraphs
                const lines = data[section.field].split('\n').filter(l => l.trim());
                for (const line of lines) {
                    sections.push(this.createParagraph('    ' + line)); // Indented
                }
                sections.push(this.createParagraph(''));
            }
        }

        // Report date
        sections.push(this.createParagraph(''));
        sections.push(this.createParagraph(`报告日期：${this.formatDate(new Date())}`, false, 'right'));

        return sections.join('\n');
    }

    /**
     * Create a Word XML paragraph
     */
    createParagraph(text, bold = false, align = 'left') {
        const alignMap = { left: 'left', center: 'center', right: 'right' };
        const alignment = alignMap[align] || 'left';
        
        const boldXml = bold ? '<w:b/><w:bCs/>' : '';
        const sizeXml = bold ? '<w:sz w:val="28"/><w:szCs w:val="28"/>' : '<w:sz w:val="24"/><w:szCs w:val="24"/>';
        
        return `
            <w:p>
                <w:pPr>
                    <w:jc w:val="${alignment}"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="宋体" w:hAnsi="宋体" w:eastAsia="宋体"/>
                        ${boldXml}
                        ${sizeXml}
                    </w:rPr>
                    <w:t>${this.escapeXml(text)}</w:t>
                </w:r>
            </w:p>
        `;
    }

    /**
     * Escape XML special characters
     */
    escapeXml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Escape regex special characters
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Prepare data for template
     */
    prepareDataForTemplate(data) {
        const prepared = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (value === null || value === undefined) {
                prepared[key] = '';
            } else if (typeof value === 'number') {
                prepared[key] = this.formatNumber(value);
            } else if (value instanceof Date) {
                prepared[key] = this.formatDate(value);
            } else {
                prepared[key] = String(value);
            }
        }

        prepared.currentDate = this.formatDate(new Date());
        prepared.reportDate = this.formatDate(new Date());

        return prepared;
    }

    /**
     * Format number
     */
    formatNumber(value) {
        if (isNaN(value)) return '';
        const rounded = Math.round(value * 100) / 100;
        return rounded.toLocaleString('zh-CN');
    }

    /**
     * Format date
     */
    formatDate(date) {
        if (!date) return '';
        
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return String(date);
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        return `${year}年${month}月${day}日`;
    }

    /**
     * Generate preview HTML
     */
    generatePreviewHTML(data) {
        const sections = [
            {
                title: '企业基本信息',
                items: [
                    { label: '企业名称', value: data.companyName },
                    { label: '统一社会信用代码', value: data.creditCode },
                    { label: '法定代表人', value: data.legalRep },
                    { label: '注册资本', value: data.registeredCapital },
                    { label: '成立日期', value: data.establishDate },
                    { label: '所属行业', value: data.industry },
                    { label: '注册地址', value: data.registeredAddress }
                ]
            },
            {
                title: '财务数据',
                items: [
                    { label: '资产总额', value: data.totalAssetsEnd ? `${data.totalAssetsEnd} 万元` : '' },
                    { label: '负债总额', value: data.totalLiabilitiesEnd ? `${data.totalLiabilitiesEnd} 万元` : '' },
                    { label: '所有者权益', value: data.ownerEquityEnd ? `${data.ownerEquityEnd} 万元` : '' },
                    { label: '营业收入', value: data.revenueCurrent ? `${data.revenueCurrent} 万元` : '' },
                    { label: '净利润', value: data.netProfitCurrent ? `${data.netProfitCurrent} 万元` : '' },
                    { label: '资产负债率', value: data.debtRatioEnd ? `${data.debtRatioEnd}%` : '' }
                ]
            },
            {
                title: '授信信息',
                items: [
                    { label: '授信类型', value: data.creditType },
                    { label: '授信金额', value: data.creditAmount ? `${data.creditAmount} 万元` : '' },
                    { label: '授信期限', value: data.creditPeriod ? `${data.creditPeriod} 个月` : '' },
                    { label: '授信用途', value: data.creditPurpose }
                ]
            }
        ];

        const textSections = [
            { title: '企业基本情况', content: data.basicSituation },
            { title: '经营状况', content: data.businessStatus },
            { title: '财务状况概述', content: data.financialOverview },
            { title: '信用风险分析', content: data.creditRisk },
            { title: '总体评价', content: data.overallEvaluation },
            { title: '授信建议', content: data.creditSuggestion }
        ];

        let html = `<div class="space-y-6">`;
        
        for (const section of sections) {
            html += `
                <div class="border-b border-gray-200 pb-4">
                    <h4 class="font-semibold text-gray-800 mb-3">${section.title}</h4>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        ${section.items.filter(i => i.value).map(item => `
                            <div class="text-gray-500">${item.label}：</div>
                            <div class="text-gray-800">${item.value}</div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        for (const section of textSections) {
            if (section.content) {
                html += `
                    <div class="border-b border-gray-200 pb-4">
                        <h4 class="font-semibold text-gray-800 mb-2">${section.title}</h4>
                        <p class="text-sm text-gray-700 whitespace-pre-wrap">${section.content}</p>
                    </div>
                `;
            }
        }

        html += `</div>`;
        return html;
    }

    /**
     * Clear all data
     */
    clear() {
        this.templateAnalysis = null;
        this.placeholderMap = {};
        this.documentData = {};
        this.originalZip = null;
        this.documentXml = null;
    }
}

// Export singleton instance
const templateEngine = new TemplateEngine();
