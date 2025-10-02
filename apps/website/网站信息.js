import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

export default class extends plugin {
    constructor() {
        super({
            name: '不羡仙:网站信息查询',
            dsc: '获取网站标题、描述和Logo',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: '^#网站信息\\s*[\\+\\s]*(https?:\\/\\/[^\\s]+)',
                    fnc: 'getWebsiteInfo'
                }
            ]
        });
    }

    async getWebsiteInfo(e) {
        let url = e.match?.[1];
        if (!url) {
            const urlRegex = /(https?:\/\/[^\s]+)/;
            const match = e.msg.match(urlRegex);
            url = match?.[0];
        }
        
        if (!url) {
            await e.reply('未检测到有效链接，请使用格式: #网站信息+链接');
            return true;
        }

        if (!(await this.checkPermission(e))) {
            await e.reply('暂无权限，只有主人才能操作');
            return true;
        }

        try {
            const { apiUrl, apiKey } = await this.getApiConfig();
            if (!apiUrl || !apiKey) {
                await e.reply('网站信息API配置不完整，请检查配置');
                return true;
            }

            const apiFullUrl = `${apiUrl}?apikey=${apiKey}&url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiFullUrl, { timeout: 15000 });
            const res = response.data;

            if (res.code !== 1) {
                return await this.handleApiError(res, e);
            }

            await this.sendWebsiteInfo(e, res.data, url);
        } catch (err) {
            console.error('网站信息查询失败:', err.message);
            await e.reply('网站信息查询失败，请稍后重试或检查链接有效性');
        }
        return true;
    }

    async checkPermission(e) {
        const adminPath = path.join(
            process.cwd(), 
            'plugins/BXX-plugin/config/config/admin.yaml'
        );
        
        try {
            if (fs.existsSync(adminPath)) {
                const adminConfig = fs.readFileSync(adminPath, 'utf8');
                const wzxxAllMatch = adminConfig.match(/WZXXALL:\s*(true|false)/i); 
                if (wzxxAllMatch && wzxxAllMatch[1].toLowerCase() === 'true') {
                    return true;
                }
            }
            
            return e.isMaster;
        } catch (err) {
            console.error('权限检查失败:', err.message);
            return e.isMaster;
        }
    }

    async getApiConfig() {
        const apiPath = path.join(
            process.cwd(), 
            'plugins/BXX-plugin/data/API/website.yaml'
        );
        const keyPath = path.join(
            process.cwd(), 
            'plugins/BXX-plugin/data/KEY/website.yaml'
        );

        try {
            let apiUrl = null, apiKey = null;
            
            if (fs.existsSync(apiPath)) {
                const apiConfig = fs.readFileSync(apiPath, 'utf8');
                const apiMatch = apiConfig.match(/WZXXAPI:\s*["']?([^"'\s#]+)["']?/i);
                apiUrl = apiMatch ? apiMatch[1].trim() : null;
            }
            
            if (fs.existsSync(keyPath)) {
                const keyConfig = fs.readFileSync(keyPath, 'utf8');
                const keyMatch = keyConfig.match(/WZXXKEY:\s*["']?([^"'\s#]+)["']?/i);
                apiKey = keyMatch ? keyMatch[1].trim() : null;
            }
            
            return { apiUrl, apiKey };
        } catch (err) {
            console.error('读取API配置失败:', err.message);
            return { apiUrl: null, apiKey: null };
        }
    }

    async handleApiError(res, e) {
        const errorMap = {
            100: 'API密钥未配置',
            101: 'API密钥无效',
            102: '来源地址不在白名单',
            0: '链接不合法或无法访问'
        };
        
        const errorMsg = errorMap[res.code] || `未知错误 (代码: ${res.code})`;
        await e.reply(`网站信息获取失败: ${errorMsg}\n${res.msg || ''}`);
        return true;
    }

    async sendWebsiteInfo(e, data, url) {
        const uploadDir = path.join(
            process.cwd(), 
            'plugins/BXX-plugin/uploads'
        );
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const logoUrl = data.favicon || '';
        let logoPath = '';
        
        if (logoUrl) {
            try {
                let validUrl = logoUrl;
                if (!validUrl.startsWith('http')) {
                    validUrl = validUrl.startsWith('//') ? 
                        'https:' + validUrl : 
                        new URL(url).origin + (validUrl.startsWith('/') ? validUrl : '/' + validUrl);
                }
                
                const extMatch = validUrl.match(/\.(\w+)(\?|$)/);
                const ext = extMatch ? `.${extMatch[1]}` : '.png';

                logoPath = path.join(uploadDir, `website_logo_${Date.now()}${ext}`);
                const response = await axios.get(validUrl, {
                    responseType: 'arraybuffer',
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                
                fs.writeFileSync(logoPath, response.data);
            } catch (err) {
                console.error('Logo处理失败:', err.message);
                logoPath = '';
            }
        }

        let msg = [
            `🖥️ 网站标题: ${data.title || '无'}`,
            `🔍 关键词: ${data.keywords || '无'}`,
            `📝 描述: ${data.description || '无'}`,
            `🔗 源链接: ${url}`
        ];

        if (logoPath && fs.existsSync(logoPath)) {
            msg.push(segment.image(`file:///${logoPath}`));
            setTimeout(() => {
                fs.unlink(logoPath, (err) => {
                    if (err) console.error('临时文件删除失败:', err.message);
                });
            }, 5000);
        } else {
            msg.push('⚠️ 网站Logo获取失败');
        }

        await e.reply(msg);
    }
}
