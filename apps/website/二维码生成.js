import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import yaml from 'yaml';
import path from 'path';
import fetch from 'node-fetch';

export default class QRCodeGenerator extends plugin {
    constructor() {
        super({
            name: '不羡仙:二维码生成',
            dsc: '根据用户输入的文本生成二维码',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: '^#二维码合成\\s*(.+)$',
                    fnc: 'generateQRCode'
                }
            ]
        });
        this.uploadDir = path.join(process.cwd(), 'plugins/BXX-plugin/uploads');
        this.ensureUploadDirExists();
    }

    ensureUploadDirExists() {
        try {
            if (!fs.existsSync(this.uploadDir)) {
                fs.mkdirSync(this.uploadDir, { recursive: true });
                console.log(`[二维码生成] 创建上传目录: ${this.uploadDir}`);
            }
        } catch (err) {
            console.error('创建上传目录失败:', err);
        }
    }

    async generateQRCode(e) {
        const inputText = e.msg.replace('#二维码合成', '').trim();
        if (!inputText) {
            await e.reply('请输入要生成二维码的内容');
            return true;
        }

        const hasPermission = await this.checkPermission(e);
        if (!hasPermission) {
            await e.reply('暂无权限，只有主人才能操作');
            return true;
        }

        try {
            const [apiUrl, apiKey] = this.getApiConfig();
            if (!apiUrl) {
                await e.reply('二维码生成API地址未配置，请联系管理员');
                return true;
            }
            if (!apiKey) {
                await e.reply('二维码生成API密钥未配置，请联系管理员');
                return true;
            }

            const encodedText = encodeURIComponent(inputText);
            const requestUrl = `${apiUrl}?apikey=${apiKey}&text=${encodedText}`;
            console.log(`[二维码生成] 请求URL: ${requestUrl}`);
            const controller = new AbortController();
            const timeout = setTimeout(() => {
                controller.abort();
            }, 15000);

            const response = await fetch(requestUrl, {
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`API响应错误: ${response.status} ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 8);
            const fileName = `qrcode_${timestamp}_${randomStr}.png`;
            const filePath = path.join(this.uploadDir, fileName);
            
            fs.writeFileSync(filePath, imageBuffer);
            console.log(`[二维码生成] 二维码已保存到: ${filePath}`);
            
            await e.reply([
                segment.image(`file://${filePath}`),
                `✅ 二维码生成成功: ${inputText}`
            ]);
            
            setTimeout(() => {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`[二维码生成] 已删除临时文件: ${filePath}`);
                } catch (deleteErr) {
                    console.error('删除临时文件失败:', deleteErr);
                }
            }, 5000);

        } catch (err) {
            console.error('二维码生成失败:', err);
            let errorMsg = '⚠️ 二维码生成失败，请稍后再试';
            
            if (err.name === 'AbortError') {
                errorMsg = '⏱ 请求超时，请检查网络连接或稍后再试';
            } else if (err.message.includes('ENOTFOUND')) {
                errorMsg = '🌐 无法解析API域名，请检查网络设置';
            } else if (err.message.includes('ECONNREFUSED')) {
                errorMsg = '🚫 连接被拒绝，API服务可能不可用';
            }
            
            await e.reply(errorMsg);
        }

        return true;
    }

    getApiConfig() {
        try {
            const basePath = path.join(process.cwd(), 'plugins/BXX-plugin');
            const apiPath = path.join(basePath, 'data/API/website.yaml');
            if (!fs.existsSync(apiPath)) {
                console.error('[二维码生成] API配置文件不存在');
                return [null, null];
            }
            
            const apiContent = fs.readFileSync(apiPath, 'utf8');
            const apiConfig = yaml.parse(apiContent);
            const apiUrl = apiConfig.RWMAPI;
            const keyPath = path.join(basePath, 'data/KEY/website.yaml');
            if (!fs.existsSync(keyPath)) {
                console.error('[二维码生成] KEY配置文件不存在');
                return [apiUrl, null]; 
            }

            const keyContent = fs.readFileSync(keyPath, 'utf8');
            const keyConfig = yaml.parse(keyContent);
            const apiKey = keyConfig.RWMKEY;
            return [apiUrl, apiKey];
        } catch (err) {
            console.error('读取API配置失败:', err);
            return [null, null];
        }
    }

    async checkPermission(e) {
        try {
            const basePath = path.join(process.cwd(), 'plugins/BXX-plugin');
            const adminPath = path.join(basePath, 'config/config/admin.yaml');
            if (fs.existsSync(adminPath)) {
                const adminContent = fs.readFileSync(adminPath, 'utf8');
                const adminConfig = yaml.parse(adminContent);
                if (adminConfig.RWMALL === true) {
                    return true;
                }
            } else {
                console.error('[二维码生成权限] admin.yaml文件不存在，默认关闭所有人可用');
            }

            return e.isMaster;

        } catch (err) {
            console.error('二维码生成权限检查失败:', err);
            return e.isMaster;
        }
    }
}
