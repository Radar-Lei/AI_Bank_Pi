/**
 * Main Application Entry Point
 * Credit Report Auto-Fill System
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 智银派授信报告智能填写系统 - 启动中...');
    
    // Initialize UI controller
    uiController.init();
    
    // Check proxy server health
    checkServerHealth();
    
    console.log('✅ 系统初始化完成');
});

/**
 * Check if proxy server is running
 */
async function checkServerHealth() {
    try {
        const isHealthy = await apiService.healthCheck();
        if (!isHealthy) {
            console.warn('⚠️ 代理服务器未运行，请启动服务器');
            uiController.showToast('代理服务器未运行，请先启动服务器 (cd server && npm start)', 'warning');
        } else {
            console.log('✅ 代理服务器连接正常');
        }
    } catch (error) {
        console.warn('⚠️ 无法连接到代理服务器:', error.message);
    }
}

/**
 * Global error handler
 */
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', { message, source, lineno, colno, error });
    uiController.showToast('发生错误，请检查控制台', 'error');
    return false;
};

/**
 * Unhandled promise rejection handler
 */
window.onunhandledrejection = function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    uiController.showToast('操作失败：' + (event.reason?.message || '未知错误'), 'error');
};

/**
 * Keyboard shortcuts
 */
document.addEventListener('keydown', (e) => {
    // Escape to close modals
    if (e.key === 'Escape') {
        uiController.closeModal('settingsModal');
        uiController.closeModal('helpModal');
    }
    
    // Ctrl/Cmd + S to save settings (when modal is open)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal && !settingsModal.classList.contains('hidden')) {
            e.preventDefault();
            uiController.saveSettings();
        }
    }
});

/**
 * Utility: Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Utility: Format number with thousands separators
 */
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '';
    return Number(num).toLocaleString('zh-CN');
}

/**
 * Utility: Parse date string to formatted date
 */
function formatDateString(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    } catch {
        return dateStr;
    }
}

/**
 * Export functions for potential external use
 */
window.CreditReportApp = {
    apiService,
    fileParser,
    templateEngine,
    uiController,
    formatNumber,
    formatDateString,
    debounce
};


