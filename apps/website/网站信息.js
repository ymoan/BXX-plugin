import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

export default class extends plugin {
    constructor() {
        super({
            name: '网站信息查询',
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
        console.log(`收到命令: ${e.msg}`);
        console.log(`匹配结果: ${JSON.stringify(e.match)}`);
        
        let url = null;
        if (e.match && e.match[1]) {
            url = e.match[1];
        } else {
            const urlRegex = /(https?:\/\/[^\s]+)/;
            const match = e.msg.match(urlRegex);
            if (match && match[0]) {
                url = match[0];
            }
        }
        
        if (!url) {
            await e.reply('未检测到有效链接，请使用格式: #网站信息+链接');
            return true;
        }

        console.log(`提取链接: ${url}`);
        
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
            console.log(`请求API: ${apiFullUrl}`);
            const response = await axios.get(apiFullUrl, { timeout: 15000 });
            const res = response.data;
            console.log(`API响应: ${JSON.stringify(res)}`);

            if (res.code !== 1) {
                return await this.handleApiError(res, e);
            }

            await this.sendWebsiteInfo(e, res.data, url);
        } catch (err) {
            console.error(`网站信息查询失败: ${err}`);
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
                    console.log('权限检查: 所有人可用（WZXXALL为true）');
                    return true;
                }
            } else {
                console.error('[网站信息权限] admin.yaml文件不存在，默认关闭所有人可用');
            }

            console.log(`权限检查: 验证主人权限（e.isMaster=${e.isMaster}）`);
            return e.isMaster;

        } catch (err) {
            console.error('网站信息权限检查失败:', err);
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
                const apiMatch = apiConfig.match(/WZXXAPI:\s*"([^"]+)"/);
                apiUrl = apiMatch ? apiMatch[1] : null;
            }
            
            if (fs.existsSync(keyPath)) {
                const keyConfig = fs.readFileSync(keyPath, 'utf8');
                const keyMatch = keyConfig.match(/WZXXKEY:\s*"([^"]+)"/);
                apiKey = keyMatch ? keyMatch[1] : null;
            }
            
            return { apiUrl, apiKey };
        } catch (err) {
            console.error('读取API配置失败:', err);
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
                    if (validUrl.startsWith('//')) {
                        validUrl = 'https:' + validUrl;
                    } else {
                        const baseUrl = new URL(url).origin;
                        validUrl = baseUrl + (validUrl.startsWith('/') ? validUrl : '/' + validUrl);
                    }
                }
                
                console.log(`处理后的Logo URL: ${validUrl}`);
                
                const ext = path.extname(validUrl) || '.png';
                logoPath = path.join(uploadDir, `website_logo_${Date.now()}${ext}`);
                
                const response = await axios.get(validUrl, {
                    responseType: 'arraybuffer',
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                
                fs.writeFileSync(logoPath, response.data);
                console.log(`Logo保存到: ${logoPath}`);
            } catch (err) {
                console.error('Logo下载失败:', err);
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
        } else {
            msg.push('⚠️ 网站Logo获取失败');
        }

        await e.reply(msg);
        console.log('网站信息已发送');
        if (logoPath && fs.existsSync(logoPath)) {
            setTimeout(() => {
                fs.unlink(logoPath, (err) => {
                    if (err) console.error('删除临时文件失败:', err);
                    else console.log(`临时文件已删除: ${logoPath}`);
                });
            }, 5000);
        }
    }
}
