import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import yaml from 'yaml';
import path from 'path';
import axios from 'axios';

export default class SendEmail extends plugin {
    constructor() {
        super({
            name: '发送邮件',
            dsc: '通过指令发送邮件',
            event: 'message',
            priority: 5000,
            rule: [
                { reg: /^#发邮箱\+.*\+.*\+.*$/, fnc: 'sendEmail' },
                { reg: /^#发邮箱\+.*\+.*\+.*\+.*$/, fnc: 'sendEmail' }
            ]
        });
    }

    async sendEmail(e) {
        const hasPermission = await this.checkPermission(e);
        if (!hasPermission) {
            await e.reply('暂无权限，只有主人才能操作');
            return true;
        }

        const params = this.extractParams(e.msg);
        if (!params || !params.email || !params.title || !params.content) {
            await e.reply('指令格式错误，请使用：\n#发邮箱+邮箱+标题+内容\n或\n#发邮箱+邮箱+名称+标题+内容');
            return true;
        }

        const [apiUrl, apiKey] = this.getApiConfig();
        const smtpConfig = this.getSmtpConfig();
        const missingConfigs = [];
        if (!apiUrl) missingConfigs.push('YXAPI (YXAPI.yaml)');
        if (!apiKey) missingConfigs.push('YXKEY (YXKEY.yaml)');
        if (!smtpConfig) {
            missingConfigs.push('smtp配置 (smtp.yaml)');
        } else {
            if (!smtpConfig.smtp) missingConfigs.push('smtp服务器地址 (smtp.yaml)');
            if (!smtpConfig.smtp_user) missingConfigs.push('smtp用户名 (smtp.yaml)');
            if (!smtpConfig.smtp_password) missingConfigs.push('smtp密码 (smtp.yaml)');
            if (!smtpConfig.smtp_port) missingConfigs.push('smtp端口 (smtp.yaml)');
        }
        
        if (missingConfigs.length > 0) {
            await e.reply(`缺少必要配置：${missingConfigs.join('、')}`);
            return true;
        }

        const requestParams = {
            apikey: apiKey,
            email: params.email,
            content: params.content,
            title: params.title,
            webname: params.webname || smtpConfig.webname || '',
            smtp: smtpConfig.smtp,
            smtp_user: smtpConfig.smtp_user,
            smtp_password: smtpConfig.smtp_password,
            smtp_port: smtpConfig.smtp_port
        };

        try {
            const response = await axios.post(apiUrl, new URLSearchParams(requestParams));
            const result = response.data;
            
            if (result.code === 1) {
                await e.reply('邮件发送成功');
            } else {
                await e.reply(`邮件发送失败：${result.msg || '未知错误'}`);
            }
        } catch (error) {
            console.error('发送邮件请求错误：', error);
            let errorMsg = '⚠️ 发送服务暂时不可用，请稍后再试';
            
            if (error.name === 'AbortError') errorMsg = '⏱ 请求超时，请检查网络连接或稍后再试';
            else if (error.message.includes('ENOTFOUND')) errorMsg = '🌐 无法解析API域名，请检查网络设置';
            else if (error.message.includes('ECONNREFUSED')) errorMsg = '🚫 连接被拒绝，API服务可能不可用';
            
            await e.reply(errorMsg);
        }

        return true;
    }

    async checkPermission(e) {
        try {
            const basePath = path.join(process.cwd(), 'plugins/BXX-plugin');
            const adminPath = path.join(basePath, 'config/config/admin.yaml');
            
            if (fs.existsSync(adminPath)) {
                const adminContent = fs.readFileSync(adminPath, 'utf8');
                const adminConfig = yaml.parse(adminContent);
                if (adminConfig.YXFSALL === true) {
                    return true;
                }
            } else {
                console.error('[发送邮件权限] admin.yaml文件不存在，默认关闭所有人可用');
            }

            return e.isMaster;

        } catch (err) {
            console.error('发送邮件权限检查失败:', err);
            return e.isMaster;
        }
    }

    extractParams(text) {
        if (typeof text !== 'string') return null;
        
        const cmdText = text.replace(/#发邮箱/, '').trim();
        const parts = cmdText.split('+')
            .map(part => part.trim())
            .filter(part => part);
        
        if (parts.length === 3) {
            return {
                email: parts[0],
                title: parts[1],
                content: parts[2]
            };
        } else if (parts.length === 4) {
            return {
                email: parts[0],
                webname: parts[1],
                title: parts[2],
                content: parts[3]
            };
        }
        
        return null;
    }

    getApiConfig() {
        try {
            const basePath = path.join(process.cwd(), 'plugins/BXX-plugin');
            const apiPath = path.join(basePath, 'data/API/YXAPI.yaml');
            
            if (!fs.existsSync(apiPath)) {
                console.error('[邮件配置] YXAPI.yaml文件不存在');
                return [null, null];
            }
            const apiContent = fs.readFileSync(apiPath, 'utf8');
            const apiConfig = yaml.parse(apiContent);
            const apiUrl = apiConfig.YXAPI;
            
            const keyPath = path.join(basePath, 'data/KEY/YXKEY.yaml');
            if (!fs.existsSync(keyPath)) {
                console.error('[邮件配置] YXKEY.yaml文件不存在');
                return [apiUrl, null];
            }
            const keyContent = fs.readFileSync(keyPath, 'utf8');
            const keyConfig = yaml.parse(keyContent);
            const apiKey = keyConfig.YXKEY;
            
            return [apiUrl, apiKey];
        } catch (err) {
            console.error('读取API配置失败:', err);
            return [null, null];
        }
    }

    getSmtpConfig() {
        try {
            const basePath = path.join(process.cwd(), 'plugins/BXX-plugin');
            const smtpPath = path.join(basePath, 'config/config/smtp.yaml');
            
            if (!fs.existsSync(smtpPath)) {
                console.error('[邮件配置] smtp.yaml文件不存在');
                return null;
            }
            
            const smtpContent = fs.readFileSync(smtpPath, 'utf8');
            return yaml.parse(smtpContent);
        } catch (err) {
            console.error('读取SMTP配置失败:', err);
            return null;
        }
    }
}
