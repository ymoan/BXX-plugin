import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import yaml from 'yaml';
import path from 'path';
import fetch from 'node-fetch';

export default class ICPQueryPlugin extends plugin {
    constructor() {
        super({
            name: '不羡仙:网站备案查询',
            dsc: '查询网站备案信息',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: '^#备案查询\\s*(\\S+)$',
                    fnc: 'queryICPInfo'
                }
            ]
        });
    }

    async queryICPInfo(e) {
        const domain = e.msg.replace('#备案查询', '').trim();
        if (!this.isValidDomain(domain)) {
            await e.reply('请输入有效的域名（如：qq.com）');
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
                await e.reply('备案查询API地址未配置，请联系管理员');
                return true;
            }
            if (!apiKey) {
                await e.reply('备案查询API密钥未配置，请联系管理员');
                return true;
            }
            const requestUrl = `${apiUrl}?apikey=${apiKey}&url=${encodeURIComponent(domain)}`;
            console.log(`[备案查询] 请求URL: ${requestUrl}`);
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
            const result = await response.json();
            console.log(`[备案查询] API响应: ${JSON.stringify(result)}`);
            if (result.code === 1) {
                if (!result.data || result.data.length === 0) {
                    await e.reply('未查询到该域名的备案信息');
                    return true;
                }
                const icpData = result.data[0];
                await e.reply(this.formatICPInfo(icpData, domain));
            } else {
                await e.reply(`❌ 备案查询失败: ${this.getErrorMessage(result.code || result.msg)}`);
            }
        } catch (err) {
            console.error('备案查询错误:', err);
            let errorMsg = '⚠️ 备案查询服务暂时不可用，请稍后再试';
            if (err.name === 'AbortError') {
                errorMsg = '⏱ 备案查询请求超时，请检查网络连接';
            } else if (err.message.includes('ENOTFOUND')) {
                errorMsg = '🌐 无法解析API域名，请检查网络设置';
            } else if (err.message.includes('ECONNREFUSED')) {
                errorMsg = '🚫 连接被拒绝，备案查询服务可能不可用';
            }
            await e.reply(errorMsg);
        }
        return true;
    }

    formatICPInfo(data, domain) {
        return [
            '📋 网站备案信息查询结果：',
            `🌐 查询域名: ${domain}`,
            `🏷️ 网站名称: ${data.website_name || '未知'}`,
            `🔗 网站地址: ${data.website_url || '未知'}`,
            `🏢 主办单位: ${data.icp_name || '未知'}`,
            `📌 单位性质: ${data.icp_type || '未知'}`,
            `🔢 备案号: ${data.icp_number || '未知'}`,
            `📅 审核日期: ${data.approval_date || '未知'}`
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
                console.error('[备案查询] API配置文件不存在');
                return [null, null];
            }
            const apiContent = fs.readFileSync(apiPath, 'utf8');
            const apiConfig = yaml.parse(apiContent);
            const apiUrl = apiConfig.ICPAPI;
            const keyPath = path.join(basePath, 'data/KEY/website.yaml');
            if (!fs.existsSync(keyPath)) {
                console.error('[备案查询] KEY配置文件不存在');
                return [apiUrl, null];
            }
            const keyContent = fs.readFileSync(keyPath, 'utf8');
            const keyConfig = yaml.parse(keyContent);
            const apiKey = keyConfig.ICPKEY;
            return [apiUrl, apiKey];
        } catch (err) {
            console.error('读取备案查询API配置失败:', err);
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
                if (adminConfig.ICPALL === true) {
                    return true;
                }
            } else {
                console.error('[备案查询权限] admin.yaml文件不存在，默认关闭所有人可用');
            }

            return e.isMaster;

        } catch (err) {
            console.error('备案查询权限检查失败:', err);
            return e.isMaster;
        }
    }
}
