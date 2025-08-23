import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import yaml from 'yaml';
import path from 'path';
import fetch from 'node-fetch';

export default class PortScanPlugin extends plugin {
    constructor() {
        super({
            name: '端口扫描',
            dsc: '执行端口扫描并返回结果',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: '^#端口扫描\\s*([\\w\\.-]+)(?::(\\d+))?$',
                    fnc: 'portScan'
                }
            ]
        });
    }

    async portScan(e) {
        const hasPermission = await this.checkPermission(e);
        if (!hasPermission) {
            await e.reply('暂无权限，只有主人才能操作');
            return true;
        }

        const input = e.msg.replace('#端口扫描', '').trim();
        const [host, port] = this.parseInput(input);
        
        if (!host) {
            await e.reply('请输入有效的域名或IP地址');
            return true;
        }
        if (!port || port < 1 || port > 65535) {
            await e.reply('端口号无效，请输入1-65535之间的端口号');
            return true;
        }

        try {
            const [apiUrl, apiKey] = this.getApiConfig();
            if (!apiUrl || !apiKey) {
                await e.reply('API配置错误，请联系管理员');
                return true;
            }

            const requestUrl = `${apiUrl}?apikey=${apiKey}&url=${encodeURIComponent(host)}&port=${port}`;
            console.log(`[端口扫描] 请求URL: ${requestUrl}`);
            const controller = new AbortController();
            const timeout = setTimeout(() => {
                controller.abort();
            }, 10000); 

            const response = await fetch(requestUrl, {
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`API响应错误: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`[端口扫描] API响应: ${JSON.stringify(data)}`);

            if (data.code === 1) {
                const status = data.data.isOpen === 1 ? '开放 ✅' : '关闭 ❌';
                await e.reply([
                    `🔍 端口扫描结果`,
                    `📍 地址: ${data.data.host}`,
                    `🚪 端口: ${data.data.port}`,
                    `📊 状态: ${status}`
                ].join('\n'));
            } else {
                await e.reply(`❌ 扫描失败: ${this.getErrorMessage(data.msg)}`);
            }
        } catch (err) {
            console.error('端口扫描错误:', err);
            let errorMsg = '⚠️ 扫描服务暂时不可用，请稍后再试';
            
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

    parseInput(input) {
        const match = input.match(/^([\w.-]+)(?::(\d+))?$/);
        if (!match) {
            return [null, null];
        }
        const host = match[1];
        const port = match[2] ? parseInt(match[2]) : 80;
        return [host, port];
    }

    getApiConfig() {
        try {
            const basePath = path.join(process.cwd(), 'plugins/BXX-plugin');
            const apiPath = path.join(basePath, 'data/API/website.yaml');
            const apiContent = fs.readFileSync(apiPath, 'utf8');
            const apiConfig = yaml.parse(apiContent);
            const apiUrl = apiConfig.DKSMAPI;
            const keyPath = path.join(basePath, 'data/KEY/website.yaml');
            const keyContent = fs.readFileSync(keyPath, 'utf8');
            const keyConfig = yaml.parse(keyContent);
            const apiKey = keyConfig.DKSMKEY;
            
            return [apiUrl, apiKey];
        } catch (err) {
            console.error('读取API配置失败:', err);
            return [null, null];
        }
    }

    getErrorMessage(code) {
        const errors = {
            100: 'API密钥为空',
            101: 'API密钥不存在',
            102: '来源地址不在白名单内',
            0: '链接不合法'
        };
        return errors[code] || `未知错误 (代码: ${code})`;
    }

    async checkPermission(e) {
        try {
            const basePath = path.join(process.cwd(), 'plugins/BXX-plugin');
            const adminPath = path.join(basePath, 'config/config/admin.yaml');
            if (fs.existsSync(adminPath)) {
                const adminContent = fs.readFileSync(adminPath, 'utf8');
                const adminConfig = yaml.parse(adminContent);
                if (adminConfig.DKSMALL === true) {
                    return true;
                }
            } else {
                console.error('[端口扫描权限] admin.yaml文件不存在，默认关闭所有人可用');
            }

            return e.isMaster;

        } catch (err) {
            console.error('端口扫描权限检查失败:', err);
            return e.isMaster;
        }
    }
}
