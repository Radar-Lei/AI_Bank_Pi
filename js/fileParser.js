/**
 * File Parser Module
 * Handles parsing of Word documents, Excel files, and images
 */

class FileParser {
    constructor() {
        this.templateContent = null;
        this.templateZip = null;
        this.financialData = null;
        this.businessInfo = null;
    }

    /**
     * Parse Word document template using PizZip and docxtemplater
     * @param {File} file - The Word document file
     * @returns {Promise<Object>} - Parsed template data
     */
    async parseWordTemplate(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    
                    // Load the document with PizZip
                    const zip = new PizZip(arrayBuffer);
                    this.templateZip = zip;
                    
                    // Create docxtemplater instance
                    const doc = new window.docxtemplater(zip, {
                        paragraphLoop: true,
                        linebreaks: true,
                        delimiters: { start: '{', end: '}' }
                    });
                    
                    // Get the full text content
                    const text = doc.getFullText();
                    this.templateContent = text;
                    
                    // Find existing placeholders (if any)
                    const placeholderRegex = /\{([^}]+)\}/g;
                    const existingPlaceholders = [];
                    let match;
                    while ((match = placeholderRegex.exec(text)) !== null) {
                        existingPlaceholders.push(match[1]);
                    }
                    
                    resolve({
                        content: text,
                        placeholders: existingPlaceholders,
                        zip: zip,
                        hasPlaceholders: existingPlaceholders.length > 0
                    });
                } catch (error) {
                    console.error('Error parsing Word template:', error);
                    reject(new Error('无法解析Word文档，请确保文件格式正确'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('读取文件失败'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Parse Excel financial statements
     * @param {File[]} files - Array of Excel files
     * @returns {Promise<Object>} - Parsed financial data
     */
    async parseExcelFiles(files) {
        const allData = {
            balanceSheet: [],      // 资产负债表
            incomeStatement: [],   // 利润表
            cashFlow: [],          // 现金流量表
            rawData: {}            // 原始数据
        };

        for (const file of files) {
            try {
                const data = await this.parseExcelFile(file);
                
                // Try to identify the type of financial statement
                const fileName = file.name.toLowerCase();
                
                // Merge data based on year
                if (data.year) {
                    allData.rawData[data.year] = data;
                }

                // Extract balance sheet data
                if (data.balanceSheet) {
                    allData.balanceSheet.push({
                        year: data.year,
                        ...data.balanceSheet
                    });
                }

                // Extract income statement data
                if (data.incomeStatement) {
                    allData.incomeStatement.push({
                        year: data.year,
                        ...data.incomeStatement
                    });
                }
            } catch (error) {
                console.error(`Error parsing ${file.name}:`, error);
            }
        }

        // Sort by year
        allData.balanceSheet.sort((a, b) => (a.year || 0) - (b.year || 0));
        allData.incomeStatement.sort((a, b) => (a.year || 0) - (b.year || 0));

        this.financialData = allData;
        return allData;
    }

    /**
     * Parse a single Excel file
     * @param {File} file - Excel file
     * @returns {Promise<Object>} - Parsed data
     */
    async parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    const result = {
                        year: this.extractYearFromFileName(file.name),
                        balanceSheet: {},
                        incomeStatement: {},
                        sheets: {}
                    };

                    // Process each sheet
                    workbook.SheetNames.forEach(sheetName => {
                        const sheet = workbook.Sheets[sheetName];
                        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                        result.sheets[sheetName] = jsonData;
                        
                        // Try to extract financial data from the sheet
                        this.extractFinancialData(jsonData, result);
                    });

                    resolve(result);
                } catch (error) {
                    console.error('Error parsing Excel:', error);
                    reject(new Error('无法解析Excel文件'));
                }
            };
            
            reader.onerror = () => reject(new Error('读取Excel文件失败'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Extract year from file name
     * @param {string} fileName - File name
     * @returns {number|null} - Year or null
     */
    extractYearFromFileName(fileName) {
        const match = fileName.match(/(\d{4})/);
        return match ? parseInt(match[1]) : null;
    }

    /**
     * Extract financial data from sheet data
     * @param {Array} sheetData - 2D array of sheet data
     * @param {Object} result - Result object to populate
     */
    extractFinancialData(sheetData, result) {
        console.log('Extracting financial data from sheet with', sheetData.length, 'rows');
        
        // Common financial terms to look for (expanded list)
        const balanceSheetTerms = {
            '资产总计': 'totalAssets',
            '资产总额': 'totalAssets',
            '资产合计': 'totalAssets',
            '资产总数': 'totalAssets',
            '总资产': 'totalAssets',
            '负债总计': 'totalLiabilities',
            '负债总额': 'totalLiabilities',
            '负债合计': 'totalLiabilities',
            '总负债': 'totalLiabilities',
            '所有者权益合计': 'ownerEquity',
            '所有者权益': 'ownerEquity',
            '股东权益合计': 'ownerEquity',
            '股东权益': 'ownerEquity',
            '净资产': 'ownerEquity',
            '实收资本': 'paidInCapital',
            '流动资产合计': 'currentAssets',
            '流动资产': 'currentAssets',
            '流动负债合计': 'currentLiabilities',
            '流动负债': 'currentLiabilities',
            '存货': 'inventory',
            '应收账款': 'accountsReceivable',
            '货币资金': 'cashAndEquivalents'
        };

        const incomeTerms = {
            '营业收入': 'revenue',
            '主营业务收入': 'revenue',
            '营业总收入': 'revenue',
            '销售收入': 'revenue',
            '净利润': 'netProfit',
            '利润总额': 'totalProfit',
            '营业利润': 'operatingProfit',
            '营业成本': 'operatingCost',
            '主营业务成本': 'operatingCost',
            '销售费用': 'sellingExpenses',
            '管理费用': 'adminExpenses',
            '财务费用': 'financialExpenses'
        };

        // Search through all cells, not just first column
        for (let i = 0; i < sheetData.length; i++) {
            const row = sheetData[i];
            if (!row || row.length === 0) continue;

            // Check each cell in the row for labels
            for (let col = 0; col < row.length; col++) {
                const cellValue = String(row[col] || '').trim();
                if (!cellValue) continue;
                
                // Check balance sheet terms
                for (const [term, key] of Object.entries(balanceSheetTerms)) {
                    if (cellValue.includes(term) && !result.balanceSheet[key]) {
                        // Look for numeric value in the same row (to the right)
                        for (let j = col + 1; j < row.length; j++) {
                            const value = this.parseNumber(row[j]);
                            if (value !== null && value !== 0) {
                                result.balanceSheet[key] = value;
                                console.log(`Found ${key}: ${value} from "${term}"`);
                                break;
                            }
                        }
                        // If not found to the right, check the row below
                        if (!result.balanceSheet[key] && i + 1 < sheetData.length) {
                            const nextRow = sheetData[i + 1];
                            if (nextRow) {
                                for (let j = 0; j < nextRow.length; j++) {
                                    const value = this.parseNumber(nextRow[j]);
                                    if (value !== null && value !== 0) {
                                        result.balanceSheet[key] = value;
                                        console.log(`Found ${key}: ${value} from next row`);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                // Check income statement terms
                for (const [term, key] of Object.entries(incomeTerms)) {
                    if (cellValue.includes(term) && !result.incomeStatement[key]) {
                        for (let j = col + 1; j < row.length; j++) {
                            const value = this.parseNumber(row[j]);
                            if (value !== null && value !== 0) {
                                result.incomeStatement[key] = value;
                                console.log(`Found ${key}: ${value} from "${term}"`);
                                break;
                            }
                        }
                        // Check next row
                        if (!result.incomeStatement[key] && i + 1 < sheetData.length) {
                            const nextRow = sheetData[i + 1];
                            if (nextRow) {
                                for (let j = 0; j < nextRow.length; j++) {
                                    const value = this.parseNumber(nextRow[j]);
                                    if (value !== null && value !== 0) {
                                        result.incomeStatement[key] = value;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        console.log('Extracted balance sheet:', result.balanceSheet);
        console.log('Extracted income statement:', result.incomeStatement);

        // Calculate derived metrics
        if (result.balanceSheet.totalAssets && result.balanceSheet.totalLiabilities) {
            result.balanceSheet.debtRatio = (
                (result.balanceSheet.totalLiabilities / result.balanceSheet.totalAssets) * 100
            ).toFixed(2);
        }

        if (result.balanceSheet.currentAssets && result.balanceSheet.currentLiabilities) {
            result.balanceSheet.currentRatio = (
                result.balanceSheet.currentAssets / result.balanceSheet.currentLiabilities
            ).toFixed(2);
            
            const quickAssets = result.balanceSheet.currentAssets - (result.balanceSheet.inventory || 0);
            result.balanceSheet.quickRatio = (
                quickAssets / result.balanceSheet.currentLiabilities
            ).toFixed(2);
        }

        if (result.incomeStatement.netProfit && result.balanceSheet.ownerEquity) {
            result.balanceSheet.roe = (
                (result.incomeStatement.netProfit / result.balanceSheet.ownerEquity) * 100
            ).toFixed(2);
        }
        
        // Calculate owner equity if we have assets and liabilities but not equity
        if (result.balanceSheet.totalAssets && result.balanceSheet.totalLiabilities && !result.balanceSheet.ownerEquity) {
            result.balanceSheet.ownerEquity = result.balanceSheet.totalAssets - result.balanceSheet.totalLiabilities;
            console.log('Calculated owner equity:', result.balanceSheet.ownerEquity);
        }
    }

    /**
     * Parse a number from various formats
     * @param {any} value - Value to parse
     * @returns {number|null} - Parsed number or null
     */
    parseNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        
        // If already a number
        if (typeof value === 'number' && !isNaN(value)) {
            return value;
        }
        
        // Try to parse string
        if (typeof value === 'string') {
            // Remove common formatting
            const cleaned = value.replace(/[,，\s元万千百]/g, '');
            const num = parseFloat(cleaned);
            if (!isNaN(num)) {
                return num;
            }
        }
        
        return null;
    }

    /**
     * Parse image file for OCR
     * @param {File} file - Image file
     * @returns {Promise<string>} - Base64 encoded image
     */
    async parseImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                resolve(e.target.result);
            };
            
            reader.onerror = () => reject(new Error('读取图片文件失败'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Process business info from OCR result
     * @param {string} ocrResult - OCR extracted text (JSON string)
     * @returns {Object} - Parsed business info
     */
    parseBusinessInfo(ocrResult) {
        try {
            // Try to extract JSON from the result
            const jsonMatch = ocrResult.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const info = JSON.parse(jsonMatch[0]);
                this.businessInfo = info;
                return info;
            }
            
            // If not JSON, try to parse as text
            return this.parseBusinessInfoFromText(ocrResult);
        } catch (error) {
            console.error('Error parsing business info:', error);
            return this.parseBusinessInfoFromText(ocrResult);
        }
    }

    /**
     * Parse business info from plain text
     * @param {string} text - Plain text from OCR
     * @returns {Object} - Parsed business info
     */
    parseBusinessInfoFromText(text) {
        const info = {};
        
        // Regular expressions for common fields
        const patterns = {
            companyName: /(?:企业名称|公司名称|名称)[：:]\s*([^\n]+)/,
            creditCode: /(?:统一社会信用代码|信用代码)[：:]\s*([A-Z0-9]+)/i,
            legalRep: /(?:法定代表人|法人代表|负责人)[：:]\s*([^\n]+)/,
            registeredCapital: /(?:注册资本|注册资金)[：:]\s*([^\n]+)/,
            establishDate: /(?:成立日期|注册日期|成立时间)[：:]\s*(\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2})/,
            registeredAddress: /(?:注册地址|住所|经营场所)[：:]\s*([^\n]+)/,
            businessScope: /(?:经营范围)[：:]\s*([^\n]+)/,
            industry: /(?:行业|所属行业)[：:]\s*([^\n]+)/,
            companyType: /(?:企业类型|公司类型)[：:]\s*([^\n]+)/
        };

        for (const [key, pattern] of Object.entries(patterns)) {
            const match = text.match(pattern);
            if (match) {
                info[key] = match[1].trim();
            }
        }

        this.businessInfo = info;
        return info;
    }

    /**
     * Get the latest financial data summary
     * @returns {Object} - Summary of financial data
     */
    getFinancialSummary() {
        if (!this.financialData) {
            console.log('No financial data available');
            return {};
        }

        console.log('Getting financial summary from:', this.financialData);
        
        const summary = {};
        const balanceSheet = this.financialData.balanceSheet || [];
        const incomeStatement = this.financialData.incomeStatement || [];
        
        // Also check rawData for any extracted values
        const rawData = this.financialData.rawData || {};
        
        // Try to get data from rawData if balanceSheet is empty
        if (balanceSheet.length === 0 && Object.keys(rawData).length > 0) {
            console.log('Using rawData for financial summary');
            // Get the most recent year's data
            const years = Object.keys(rawData).sort((a, b) => b - a);
            if (years.length > 0) {
                const latestYear = years[0];
                const latestData = rawData[latestYear];
                if (latestData.balanceSheet) {
                    summary.totalAssetsEnd = latestData.balanceSheet.totalAssets;
                    summary.totalLiabilitiesEnd = latestData.balanceSheet.totalLiabilities;
                    summary.ownerEquityEnd = latestData.balanceSheet.ownerEquity;
                    summary.debtRatioEnd = latestData.balanceSheet.debtRatio;
                    summary.currentRatioEnd = latestData.balanceSheet.currentRatio;
                    summary.quickRatioEnd = latestData.balanceSheet.quickRatio;
                }
                if (latestData.incomeStatement) {
                    summary.revenueCurrent = latestData.incomeStatement.revenue;
                    summary.netProfitCurrent = latestData.incomeStatement.netProfit;
                }
                
                // Get previous year data
                if (years.length > 1) {
                    const prevYear = years[1];
                    const prevData = rawData[prevYear];
                    if (prevData.balanceSheet) {
                        summary.totalAssetsBeginning = prevData.balanceSheet.totalAssets;
                        summary.totalLiabilitiesBeginning = prevData.balanceSheet.totalLiabilities;
                        summary.ownerEquityBeginning = prevData.balanceSheet.ownerEquity;
                        summary.debtRatioBeginning = prevData.balanceSheet.debtRatio;
                    }
                    if (prevData.incomeStatement) {
                        summary.revenueLastYear = prevData.incomeStatement.revenue;
                        summary.netProfitLastYear = prevData.incomeStatement.netProfit;
                    }
                }
            }
            
            console.log('Financial summary from rawData:', summary);
            return summary;
        }

        if (balanceSheet.length > 0) {
            const latest = balanceSheet[balanceSheet.length - 1];
            const previous = balanceSheet.length > 1 ? balanceSheet[balanceSheet.length - 2] : null;
            const lastYear = balanceSheet.length > 2 ? balanceSheet[balanceSheet.length - 3] : previous;

            // Current period end
            summary.totalAssetsEnd = latest.totalAssets;
            summary.totalLiabilitiesEnd = latest.totalLiabilities;
            summary.ownerEquityEnd = latest.ownerEquity;
            summary.debtRatioEnd = latest.debtRatio;
            summary.currentRatioEnd = latest.currentRatio;
            summary.quickRatioEnd = latest.quickRatio;

            // Beginning of year
            if (previous) {
                summary.totalAssetsBeginning = previous.totalAssets;
                summary.totalLiabilitiesBeginning = previous.totalLiabilities;
                summary.ownerEquityBeginning = previous.ownerEquity;
                summary.debtRatioBeginning = previous.debtRatio;
                summary.currentRatioBeginning = previous.currentRatio;
                summary.quickRatioBeginning = previous.quickRatio;
            }

            // Last year end
            if (lastYear) {
                summary.totalAssetsLastYear = lastYear.totalAssets;
                summary.totalLiabilitiesLastYear = lastYear.totalLiabilities;
                summary.ownerEquityLastYear = lastYear.ownerEquity;
                summary.debtRatioLastYear = lastYear.debtRatio;
                summary.currentRatioLastYear = lastYear.currentRatio;
                summary.quickRatioLastYear = lastYear.quickRatio;
            }
        }

        if (incomeStatement.length > 0) {
            const latest = incomeStatement[incomeStatement.length - 1];
            const previous = incomeStatement.length > 1 ? incomeStatement[incomeStatement.length - 2] : null;

            summary.revenueCurrent = latest.revenue;
            summary.netProfitCurrent = latest.netProfit;

            if (previous) {
                summary.revenueLastYear = previous.revenue;
                summary.netProfitLastYear = previous.netProfit;
            }
        }

        return summary;
    }

    /**
     * Get business info
     * @returns {Object} - Business info
     */
    getBusinessInfo() {
        return this.businessInfo || {};
    }

    /**
     * Get template content
     * @returns {string} - Template content
     */
    getTemplateContent() {
        return this.templateContent || '';
    }

    /**
     * Get template zip for document generation
     * @returns {PizZip} - Template zip
     */
    getTemplateZip() {
        return this.templateZip;
    }

    /**
     * Clear all parsed data
     */
    clear() {
        this.templateContent = null;
        this.templateZip = null;
        this.financialData = null;
        this.businessInfo = null;
    }
}

// Export singleton instance
const fileParser = new FileParser();

