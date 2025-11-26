/**
 * UI Controller Module
 * Handles all UI interactions and state management
 */

class UIController {
    constructor() {
        this.currentStep = 1;
        this.files = {
            template: null,
            financial: [],
            business: null
        };
        this.toastTimeout = null;
    }

    /**
     * Initialize UI controller
     */
    init() {
        this.bindEvents();
        this.loadSettings();
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // File upload areas
        this.setupDropArea('templateDropArea', 'templateFile', this.handleTemplateUpload.bind(this));
        this.setupDropArea('financialDropArea', 'financialFile', this.handleFinancialUpload.bind(this));
        this.setupDropArea('businessDropArea', 'businessFile', this.handleBusinessUpload.bind(this));

        // Remove file buttons
        document.getElementById('removeTemplateFile')?.addEventListener('click', () => this.removeFile('template'));
        document.getElementById('removeFinancialFile')?.addEventListener('click', () => this.removeFile('financial'));
        document.getElementById('removeBusinessFile')?.addEventListener('click', () => this.removeFile('business'));

        // Navigation buttons
        document.getElementById('toStep2Btn')?.addEventListener('click', () => this.goToStep(2));
        document.getElementById('backToStep1Btn')?.addEventListener('click', () => this.goToStep(1));
        document.getElementById('toStep3Btn')?.addEventListener('click', () => this.goToStep(3));
        document.getElementById('backToStep2Btn')?.addEventListener('click', () => this.goToStep(2));
        document.getElementById('toStep4Btn')?.addEventListener('click', () => this.goToStep(4));
        document.getElementById('backToStep3Btn')?.addEventListener('click', () => this.goToStep(3));
        document.getElementById('restartBtn')?.addEventListener('click', () => this.restart());

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // AI generation buttons
        document.querySelectorAll('.ai-generate-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.generateFieldContent(e.target.dataset.field));
        });
        document.getElementById('aiGenerateAllBtn')?.addEventListener('click', () => this.generateAllContent());

        // Report generation
        document.getElementById('generateReportBtn')?.addEventListener('click', () => this.generateReport());
        document.getElementById('downloadReportBtn')?.addEventListener('click', () => this.downloadReport());

        // Settings modal
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.openModal('settingsModal'));
        document.getElementById('closeSettingsBtn')?.addEventListener('click', () => this.closeModal('settingsModal'));
        document.getElementById('cancelSettingsBtn')?.addEventListener('click', () => this.closeModal('settingsModal'));
        document.getElementById('saveSettingsBtn')?.addEventListener('click', () => this.saveSettings());

        // Help modal
        document.getElementById('helpBtn')?.addEventListener('click', () => this.openModal('helpModal'));
        document.getElementById('closeHelpBtn')?.addEventListener('click', () => this.closeModal('helpModal'));

        // Close modals on background click
        ['settingsModal', 'helpModal'].forEach(modalId => {
            document.getElementById(modalId)?.addEventListener('click', (e) => {
                if (e.target.id === modalId) this.closeModal(modalId);
            });
        });
    }

    /**
     * Setup drag and drop area
     */
    setupDropArea(dropAreaId, fileInputId, handler) {
        const dropArea = document.getElementById(dropAreaId);
        const fileInput = document.getElementById(fileInputId);

        if (!dropArea || !fileInput) return;

        // Click to select file
        dropArea.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                if (fileInput.multiple) {
                    handler(Array.from(fileInput.files));
                } else {
                    handler(fileInput.files[0]);
                }
            }
        });

        // Drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.remove('dragover');
            });
        });

        dropArea.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                if (fileInput.multiple) {
                    handler(files);
                } else {
                    handler(files[0]);
                }
            }
        });
    }

    /**
     * Handle template file upload
     */
    async handleTemplateUpload(file) {
        this.showLoading('正在解析模板...');
        
        try {
            const result = await fileParser.parseWordTemplate(file);
            this.files.template = file;
            
            // Update UI
            document.getElementById('templateFileName').textContent = file.name;
            document.getElementById('templateFileInfo').classList.remove('hidden');
            
            // Store the zip in template engine for later use
            templateEngine.setOriginalZip(result.zip);
            
            // Analyze template
            await templateEngine.analyzeTemplate(result.content);
            
            this.hideLoading();
            const msg = result.hasPlaceholders 
                ? `模板解析成功，发现 ${result.placeholders.length} 个占位符`
                : '模板解析成功，将使用智能填充模式';
            this.showToast(msg, 'success');
            this.updateNavigationState();
        } catch (error) {
            this.hideLoading();
            this.showToast(error.message, 'error');
        }
    }

    /**
     * Handle financial file upload
     */
    async handleFinancialUpload(files) {
        this.showLoading('正在解析财务报表...');
        
        try {
            const result = await fileParser.parseExcelFiles(files);
            this.files.financial = files;
            
            // Update UI
            const fileNames = files.map(f => f.name).join(', ');
            document.getElementById('financialFileName').textContent = 
                files.length > 1 ? `${files[0].name} 等 ${files.length} 个文件` : files[0].name;
            document.getElementById('financialFileInfo').classList.remove('hidden');
            
            this.hideLoading();
            this.showToast(`成功解析 ${files.length} 个财务报表`, 'success');
            this.updateNavigationState();
        } catch (error) {
            this.hideLoading();
            this.showToast(error.message, 'error');
        }
    }

    /**
     * Handle business info file upload
     */
    async handleBusinessUpload(file) {
        this.showLoading('正在处理工商信息...');
        
        try {
            // Convert image to base64 and store
            this.businessImageBase64 = await fileParser.parseImageToBase64(file);
            this.files.business = file;
            
            // Update UI immediately
            document.getElementById('businessFileName').textContent = file.name;
            document.getElementById('businessFileInfo').classList.remove('hidden');
            
            // Try OCR if API key is configured
            const config = apiService.getConfig();
            if (config.siliconflowApiKey) {
                this.setLoadingProgress(30);
                this.showLoading('正在调用OCR识别工商信息...');
                
                try {
                    const ocrResult = await apiService.callOCR(this.businessImageBase64);
                    this.setLoadingProgress(80);
                    const businessInfo = fileParser.parseBusinessInfo(ocrResult);
                    
                    console.log('OCR extracted business info:', businessInfo);
                    
                    this.hideLoading();
                    const fieldCount = Object.keys(businessInfo).filter(k => businessInfo[k]).length;
                    if (fieldCount > 0) {
                        this.showToast(`工商信息识别成功，提取了 ${fieldCount} 个字段`, 'success');
                    } else {
                        this.showToast('OCR识别完成，但未能提取到结构化数据', 'warning');
                    }
                } catch (ocrError) {
                    console.error('OCR error:', ocrError);
                    this.hideLoading();
                    this.showToast('OCR识别失败：' + ocrError.message, 'error');
                }
            } else {
                this.hideLoading();
                this.showToast('文件已上传。请点击右上角设置按钮配置 SiliconFlow API Key 以启用自动识别', 'warning');
            }
            
            this.updateNavigationState();
        } catch (error) {
            this.hideLoading();
            this.showToast('处理文件失败：' + error.message, 'error');
            this.updateNavigationState();
        }
    }

    /**
     * Remove uploaded file
     */
    removeFile(type) {
        switch (type) {
            case 'template':
                this.files.template = null;
                document.getElementById('templateFile').value = '';
                document.getElementById('templateFileInfo').classList.add('hidden');
                break;
            case 'financial':
                this.files.financial = [];
                document.getElementById('financialFile').value = '';
                document.getElementById('financialFileInfo').classList.add('hidden');
                break;
            case 'business':
                this.files.business = null;
                document.getElementById('businessFile').value = '';
                document.getElementById('businessFileInfo').classList.add('hidden');
                break;
        }
        this.updateNavigationState();
    }

    /**
     * Update navigation button states
     */
    updateNavigationState() {
        const toStep2Btn = document.getElementById('toStep2Btn');
        const allFilesUploaded = this.files.template && 
                                  this.files.financial.length > 0 && 
                                  this.files.business;
        
        if (toStep2Btn) {
            toStep2Btn.disabled = !allFilesUploaded;
        }
    }

    /**
     * Navigate to a step
     */
    goToStep(step) {
        // Hide all step contents
        for (let i = 1; i <= 4; i++) {
            const content = document.getElementById(`step${i}-content`);
            if (content) {
                content.classList.remove('active');
            }
        }

        // Show target step content
        const targetContent = document.getElementById(`step${step}-content`);
        if (targetContent) {
            targetContent.classList.add('active');
        }

        // Update step indicators
        this.updateStepIndicators(step);
        
        // Step-specific actions
        if (step === 2) {
            this.populateStep2Form();
        } else if (step === 4) {
            document.getElementById('generationResult').classList.add('hidden');
        }

        this.currentStep = step;
    }

    /**
     * Update step indicators
     */
    updateStepIndicators(currentStep) {
        for (let i = 1; i <= 4; i++) {
            const indicator = document.getElementById(`step${i}-indicator`);
            if (!indicator) continue;

            indicator.classList.remove('bg-gradient-to-br', 'from-primary-500', 'to-primary-600', 
                                       'text-white', 'bg-gray-200', 'text-gray-500',
                                       'bg-success');

            if (i < currentStep) {
                // Completed step
                indicator.classList.add('bg-success', 'text-white');
                indicator.innerHTML = '<i class="fa fa-check"></i>';
            } else if (i === currentStep) {
                // Current step
                indicator.classList.add('bg-gradient-to-br', 'from-primary-500', 'to-primary-600', 'text-white');
                indicator.textContent = i;
            } else {
                // Future step
                indicator.classList.add('bg-gray-200', 'text-gray-500');
                indicator.textContent = i;
            }
        }

        // Update progress lines
        for (let i = 1; i <= 3; i++) {
            const line = document.getElementById(`line${i}-${i+1}`);
            if (line) {
                line.style.width = currentStep > i ? '100%' : '0%';
            }
        }
    }

    /**
     * Populate Step 2 form with extracted data
     */
    populateStep2Form() {
        // Get business info
        const businessInfo = fileParser.getBusinessInfo();
        const financialSummary = fileParser.getFinancialSummary();
        
        console.log('Populating Step 2 form...');
        console.log('Business Info:', businessInfo);
        console.log('Financial Summary:', financialSummary);

        // Populate company info
        const companyFields = ['companyName', 'creditCode', 'legalRep', 'registeredCapital', 
                              'establishDate', 'industry', 'registeredAddress', 'businessScope',
                              'companySize', 'employeeCount'];
        
        let filledCompanyFields = 0;
        companyFields.forEach(field => {
            const element = document.getElementById(field);
            if (element && businessInfo[field]) {
                element.value = businessInfo[field];
                filledCompanyFields++;
            }
        });

        // Populate financial info
        const financialFields = ['totalAssetsLastYear', 'totalAssetsBeginning', 'totalAssetsEnd',
                                'totalLiabilitiesLastYear', 'totalLiabilitiesBeginning', 'totalLiabilitiesEnd',
                                'ownerEquityLastYear', 'ownerEquityBeginning', 'ownerEquityEnd',
                                'revenueLastYear', 'revenueCurrent',
                                'netProfitLastYear', 'netProfitCurrent',
                                'debtRatioLastYear', 'debtRatioBeginning', 'debtRatioEnd'];

        let filledFinancialFields = 0;
        financialFields.forEach(field => {
            const element = document.getElementById(field);
            if (element && financialSummary[field] !== undefined && financialSummary[field] !== null) {
                element.value = financialSummary[field];
                filledFinancialFields++;
            }
        });
        
        console.log(`Filled ${filledCompanyFields} company fields, ${filledFinancialFields} financial fields`);
        
        // Show a message about what was filled
        if (filledCompanyFields === 0 && Object.keys(businessInfo).length === 0) {
            this.showToast('提示：请在设置中配置 SiliconFlow API Key 以启用工商信息自动识别', 'warning');
        }
        if (filledFinancialFields > 0) {
            this.showToast(`已从财务报表自动填充 ${filledFinancialFields} 个字段`, 'success');
        }
    }

    /**
     * Switch tab in Step 3
     */
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('hidden', content.id !== `tab-${tabName}`);
        });
    }

    /**
     * Generate content for a single field
     */
    async generateFieldContent(fieldName) {
        const context = this.collectAllData();
        const btn = document.querySelector(`[data-field="${fieldName}"]`);
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 生成中...';
        }

        try {
            const content = await apiService.generateContent(fieldName, context);
            const textarea = document.getElementById(fieldName);
            if (textarea) {
                textarea.value = content;
            }
            this.showToast('内容生成成功', 'success');
        } catch (error) {
            this.showToast('内容生成失败：' + error.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa fa-magic"></i> AI生成';
            }
        }
    }

    /**
     * Generate all content using AI
     */
    async generateAllContent() {
        const context = this.collectAllData();
        const btn = document.getElementById('aiGenerateAllBtn');
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 正在生成...';
        }

        this.showLoading('正在使用AI生成报告内容...', true);

        try {
            const results = await apiService.generateAllContent(context);
            
            // Fill in all text areas
            for (const [fieldName, content] of Object.entries(results)) {
                const textarea = document.getElementById(fieldName);
                if (textarea && content) {
                    textarea.value = content;
                }
            }

            this.hideLoading();
            this.showToast('所有内容生成成功', 'success');
        } catch (error) {
            this.hideLoading();
            this.showToast('内容生成失败：' + error.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa fa-magic"></i> AI智能生成全部';
            }
        }
    }

    /**
     * Collect all data from forms
     */
    collectAllData() {
        const data = {};

        // Company info
        const companyFields = ['companyName', 'creditCode', 'legalRep', 'registeredCapital', 
                              'establishDate', 'industry', 'registeredAddress', 'businessScope',
                              'companySize', 'employeeCount'];
        companyFields.forEach(field => {
            const element = document.getElementById(field);
            if (element) data[field] = element.value;
        });

        // Financial info
        const financialFields = ['totalAssetsLastYear', 'totalAssetsBeginning', 'totalAssetsEnd',
                                'totalLiabilitiesLastYear', 'totalLiabilitiesBeginning', 'totalLiabilitiesEnd',
                                'ownerEquityLastYear', 'ownerEquityBeginning', 'ownerEquityEnd',
                                'revenueLastYear', 'revenueCurrent',
                                'netProfitLastYear', 'netProfitCurrent',
                                'debtRatioLastYear', 'debtRatioBeginning', 'debtRatioEnd'];
        financialFields.forEach(field => {
            const element = document.getElementById(field);
            if (element) data[field] = element.value;
        });

        // Credit info
        const creditFields = ['creditType', 'creditAmount', 'creditPeriod', 'creditPurpose'];
        creditFields.forEach(field => {
            const element = document.getElementById(field);
            if (element) data[field] = element.value;
        });

        // Text content
        const textFields = ['basicSituation', 'controllerSituation', 'businessStatus', 'marketAnalysis',
                           'financialOverview', 'financialIndicators', 'creditRisk', 'marketRisk',
                           'overallEvaluation', 'creditSuggestion'];
        textFields.forEach(field => {
            const element = document.getElementById(field);
            if (element) data[field] = element.value;
        });

        // Report options
        data.reportTitle = document.getElementById('reportTitle')?.value || '企业授信调查报告';
        data.reportFormat = document.getElementById('reportFormat')?.value || 'docx';

        return data;
    }

    /**
     * Generate final report
     */
    async generateReport() {
        const btn = document.getElementById('generateReportBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 生成中...';
        }

        this.showLoading('正在生成报告...');

        try {
            const data = this.collectAllData();
            templateEngine.setDocumentData(data);

            // Generate preview
            const previewHtml = templateEngine.generatePreviewHTML(data);
            document.getElementById('reportPreview').innerHTML = previewHtml;

            // Generate document using the template
            const templateZip = fileParser.getTemplateZip();
            if (templateZip) {
                console.log('Using template zip to generate document...');
                console.log('Data to fill:', data);
                this.generatedDocument = templateEngine.generateDocument(templateZip, data);
                console.log('Document generated successfully');
            } else {
                throw new Error('模板文件未加载，请重新上传模板');
            }

            // Show success
            document.getElementById('generationResult').classList.remove('hidden');
            
            this.hideLoading();
            this.showToast('报告生成成功，数据已填充到模板中', 'success');
        } catch (error) {
            console.error('Report generation error:', error);
            this.hideLoading();
            this.showToast('报告生成失败：' + error.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa fa-file-text-o"></i> 生成报告';
            }
        }
    }

    /**
     * Download generated report
     */
    downloadReport() {
        if (!this.generatedDocument) {
            this.showToast('请先生成报告', 'warning');
            return;
        }

        const data = this.collectAllData();
        const fileName = `${data.companyName || '企业'}_授信调查报告_${this.formatDate(new Date())}.docx`;
        
        saveAs(this.generatedDocument, fileName);
        this.showToast('报告下载成功', 'success');
    }

    /**
     * Format date for filename
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    /**
     * Restart the process
     */
    restart() {
        // Clear file parser data
        fileParser.clear();
        templateEngine.clear();
        
        // Reset files
        this.files = { template: null, financial: [], business: null };
        
        // Reset file inputs
        ['templateFile', 'financialFile', 'businessFile'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        
        // Hide file info
        ['templateFileInfo', 'financialFileInfo', 'businessFileInfo'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.classList.add('hidden');
        });
        
        // Reset forms
        document.querySelectorAll('input[type="text"], input[type="date"], textarea, select').forEach(el => {
            el.value = '';
        });
        
        // Hide generation result
        document.getElementById('generationResult')?.classList.add('hidden');
        
        // Reset preview
        document.getElementById('reportPreview').innerHTML = `
            <div class="text-center text-gray-400 py-12">
                <i class="fa fa-file-text-o text-5xl mb-4"></i>
                <p>点击"生成报告"按钮后将显示报告预览</p>
            </div>
        `;
        
        // Go to step 1
        this.goToStep(1);
        this.showToast('已重置，可以重新开始', 'success');
    }

    /**
     * Show loading overlay
     */
    showLoading(text = '处理中...', showProgress = false) {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        const progress = document.getElementById('loadingProgress');
        
        if (loadingText) loadingText.textContent = text;
        if (progress) progress.style.width = '0%';
        if (overlay) overlay.classList.remove('hidden');
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('hidden');
    }

    /**
     * Set loading progress
     */
    setLoadingProgress(percent) {
        const progress = document.getElementById('loadingProgress');
        if (progress) progress.style.width = `${percent}%`;
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        // Clear existing timeout
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }

        // Remove existing toasts
        container.innerHTML = '';

        // Create toast element
        const toast = document.createElement('div');
        
        const colors = {
            success: 'bg-success',
            error: 'bg-danger',
            warning: 'bg-warning',
            info: 'bg-primary-500'
        };

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        toast.className = `toast ${colors[type] || colors.info} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3`;
        toast.innerHTML = `
            <i class="fa ${icons[type] || icons.info}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto hide
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * Open modal
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('hidden');
    }

    /**
     * Close modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const config = apiService.getConfig();
        
        const deepseekInput = document.getElementById('deepseekApiKey');
        const siliconflowInput = document.getElementById('siliconflowApiKey');
        const proxyInput = document.getElementById('proxyServer');
        
        if (deepseekInput) deepseekInput.value = config.deepseekApiKey || '';
        if (siliconflowInput) siliconflowInput.value = config.siliconflowApiKey || '';
        if (proxyInput) proxyInput.value = config.proxyServer || 'http://localhost:3000';
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        const deepseekKey = document.getElementById('deepseekApiKey')?.value || '';
        const siliconflowKey = document.getElementById('siliconflowApiKey')?.value || '';
        const proxyServer = document.getElementById('proxyServer')?.value || 'http://localhost:3000';
        
        apiService.updateConfig({
            deepseekApiKey: deepseekKey,
            siliconflowApiKey: siliconflowKey,
            proxyServer: proxyServer
        });
        
        this.closeModal('settingsModal');
        this.showToast('设置已保存', 'success');
    }
}

// Export singleton instance
const uiController = new UIController();

