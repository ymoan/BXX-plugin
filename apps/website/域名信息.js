import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import yaml from 'yaml';
import path from 'path';
import fetch from 'node-fetch';

export default class DomainInfoPlugin extends plugin {
    constructor() {
        super({
            name: '域名信息查询',
            dsc: '查询域名WHOIS信息',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: '^#域名信息\\s*(\\S+)$',
                    fnc: 'queryDomainInfo'
                }
            ]
        });
    }

    async queryDomainInfo(e) {
        const hasPermission = await this.checkPermission(e);
        if (!hasPermission) {
            await e.reply('暂无权限，只有主人才能操作');
            return true;
        }

        const domain = e.msg.replace('#域名信息', '').trim();
        if (!this.isValidDomain(domain)) {
            await e.reply('请输入有效的域名（如：yunz.cc）');
            return true;
        }

        try {
            const [apiUrl, apiKey] = this.getApiConfig();
            if (!apiUrl) {
                await e.reply('API地址未配置，请联系管理员');
                return true;
            }
            if (!apiKey) {
                await e.reply('API密钥未配置，请联系管理员');
                return true;
            }

            const requestUrl = `${apiUrl}?apikey=${apiKey}&url=${encodeURIComponent(domain)}`;
            console.log(`[域名信息] 请求URL: ${requestUrl}`);
            
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

            const data = await response.json();
            console.log(`[域名信息] API响应: ${JSON.stringify(data)}`);

            if (data.code === 1) {
                await e.reply(this.formatDomainInfo(data.data, domain));
            } else {
                await e.reply(`❌ 查询失败: ${this.getErrorMessage(data.msg || data.code)}`);
            }
        } catch (err) {
            console.error('域名信息查询错误:', err);
            let errorMsg = '⚠️ 查询服务暂时不可用，请稍后再试';
            
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

    formatDomainInfo(data, domain) {
        return [
            '🔍 域名信息查询结果',
            `🌐 域名: ${domain}`,
            `🏢 注册商: ${data.register || '未知'}`,
            `📧 联系人邮箱: ${data.email || '未公开'}`,
            `📅 注册时间: ${data.regtime || '未知'}`,
            `⏳ 过期时间: ${data.expirytime || '未知'}`,
            `📊 状态: ${data.info || '未知'}`,
            `🌍 DNS服务器: ${data.dns || '无记录'}`
        ].join('\n');
    }

    isValidDomain(domain) {
        return /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(domain);
    }

    getApiConfig() {
        try {
            const basePath = path.join(process.cwd(), 'plugins/BXX-plugin');
            const apiPath = path.join(basePath, 'data/API/website.yaml');
            
            if (!fs.existsSync(apiPath)) {
                console.error('[域名信息] API配置文件不存在');
                return [null, null];
            }
            
            const apiContent = fs.readFileSync(apiPath, 'utf8');
            const apiConfig = yaml.parse(apiContent);
            const apiUrl = apiConfig.YMCXAPI;
            
            const keyPath = path.join(basePath, 'data/KEY/website.yaml');
            if (!fs.existsSync(keyPath)) {
                console.error('[域名信息] KEY配置文件不存在');
                return [apiUrl, null]; 
            }
            
            const keyContent = fs.readFileSync(keyPath, 'utf8');
            const keyConfig = yaml.parse(keyContent);
            const apiKey = keyConfig.YMCXKEY || keyConfig.YMCXAPI;
            
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
            0: '域名格式不合法'
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
                if (adminConfig.YMCXALL === true) {
                    return true;
                }
            } else {
                console.error('[域名信息权限] admin.yaml文件不存在，默认关闭所有人可用');
            }

            return e.isMaster;

        } catch (err) {
            console.error('域名信息权限检查失败:', err);
            return e.isMaster;
        }
    }
}
