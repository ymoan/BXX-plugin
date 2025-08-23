import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import path from 'path';
export default class BXXConfig extends plugin {
    constructor() {
        super({
            name: '不羡仙设置',
            dsc: '管理不羡仙插件功能权限',
            event: 'message',
            priority: 5000,
            rule: [
                { reg: '^#不羡仙设置$', fnc: 'showConfig' },
                { reg: '^#不羡仙设置(网站信息|端口扫描|域名查询|二维码生成|备案信息|抖音解析|综合解析|邮箱发送)所有人可用(开启|关闭)$', fnc: 'updateConfig' },
                { reg: '^#老福特设置CK\\s*(.+)$', fnc: 'setLftCookie' },
                { reg: '^#不羡仙设置邮箱(SMTP端|账号|密钥|端口|名称)\\s*(.+)$', fnc: 'setSmtpConfig' },
                { reg: '^#不羡仙显示配置(admin|smtp|老福特)$', fnc: 'showConfigFile' }
            ]
        });
        this.rootPath = process.cwd();
    }
    getPluginPath(relativePath) {
        return path.resolve(this.rootPath, 'plugins/BXX-plugin', relativePath);
    }
    async showConfig(e) {
        const configPath = this.getPluginPath('config/config/admin.yaml');
        let statusMap = {};
        let fileReadSuccess = true;
        try {
            if (!fs.existsSync(configPath)) {
                e.reply(`配置文件不存在: ${configPath}`);
                return true;
            }
            const file = fs.readFileSync(configPath, 'utf8');
            const lines = file.split('\n');
            const featureKeyMap = {
                '网站信息': 'WZXXALL',
                '端口扫描': 'DKSMALL',
                '域名查询': 'WSYMALL',
                '二维码生成': 'RWMALL',
                '备案信息': 'ICPALL',
                '抖音解析': 'DYJXALL',
                '综合解析': 'ZHJXALL',
                '邮箱发送': 'YXFSALL'
            };
            for (const [feature, key] of Object.entries(featureKeyMap)) {
                const line = lines.find(line => line.trim().startsWith(`${key}:`));
                if (line) {
                    const value = line.split(':')[1]?.trim()?.toLowerCase() === 'true';
                    statusMap[feature] = value;
                } else {
                    statusMap[feature] = '未知';
                    console.warn(`在配置文件中未找到 ${feature}(${key}) 的配置`);
                }
            }
        } catch (err) {
            console.error('读取配置失败:', err);
            e.reply(`读取配置文件失败: ${err.message}`);
            fileReadSuccess = false;
        }
        if (fileReadSuccess) {
            let msg = '【不羡仙功能权限设置】\n';
            for (const [feature, status] of Object.entries(statusMap)) {
                if (status === '未知') {
                    msg += `${feature}: 未知（配置缺失）\n`;
                } else {
                    msg += `${feature}: ${status ? '开启' : '关闭'}\n`;
                }
            }
            msg += '\n【可用设置命令】\n';
            msg += '1. #不羡仙设置 [功能名] 所有人可用 [开启/关闭]\n';
            msg += '   例：#不羡仙设置网站信息所有人可用开启\n';
            msg += '2. #老福特设置CK [cookie值]\n';
            msg += '3. #不羡仙设置邮箱[SMTP端/账号/密钥/端口/名称] [内容]\n';
            msg += '   例：#不羡仙设置邮箱SMTP端 smtp.qq.com\n';
            msg += '4. #不羡仙显示配置 [admin/smtp/老福特]\n';
            msg += '   查看对应配置文件内容\n';
            e.reply(msg.trim());
        }
        return true;
    }
    
    async updateConfig(e) {
        if (!e.isMaster) {
            await e.reply("暂无权限，只有主人才能操作");
            return true; 
        }
        
        const match = e.msg.match(/^#不羡仙设置(.+?)所有人可用(开启|关闭)$/);
        if (!match) return false;
        const feature = match[1];
        const action = match[2] === '开启';
        const featureKeyMap = {
            '网站信息': 'WZXXALL',
            '端口扫描': 'DKSMALL',
            '域名查询': 'WSYMALL',
            '二维码生成': 'RWMALL',
            '备案信息': 'ICPALL',
            '抖音解析': 'DYJXALL',
            '综合解析': 'ZHJXALL',
            '邮箱发送': 'YXFSALL'
        };
        const key = featureKeyMap[feature];
        if (!key) {
            e.reply(`未知功能: ${feature}`);
            return true;
        }
        const configPath = this.getPluginPath('config/config/admin.yaml');
        try {
            if (!fs.existsSync(configPath)) {
                e.reply(`配置文件不存在: ${configPath}`);
                return true;
            }
            let lines = fs.readFileSync(configPath, 'utf8').split('\n');
            let found = false;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith(`${key}:`)) {
                    lines[i] = `${key}: ${action}`;
                    found = true;
                    break;
                }
            }
            if (!found) {
                lines.push(`${key}: ${action}`);
            }
            fs.writeFileSync(configPath, lines.join('\n'));
            e.reply(`不羡仙${feature}所有人可用${action ? '开启' : '关闭'}设置成功`);
        } catch (err) {
            console.error('更新配置失败:', err);
            e.reply(`配置更新失败: ${err.message}`);
        }
        return true;
    }
    
    async setLftCookie(e) {
        if (!e.isMaster) {
            await e.reply("暂无权限，只有主人才能操作");
            return true; 
        }
        
        const ck = e.msg.replace(/^#老福特设置CK\s*/, '').trim();
        if (!ck) {
            e.reply('请提供有效的Cookie');
            return true;
        }
        const ckPath = this.getPluginPath('data/Cookie/LFTCK.yaml');
        try {
            if (!fs.existsSync(path.dirname(ckPath))) {
                fs.mkdirSync(path.dirname(ckPath), { recursive: true });
            }
            let lines = [];
            if (fs.existsSync(ckPath)) {
                lines = fs.readFileSync(ckPath, 'utf8').split('\n');
            }
            if (lines.length < 2) {
                lines = [
                    '# 老福特Cookie',
                    `LFTCK: "${ck}"`
                ];
            } else {
                lines[1] = `LFTCK: "${ck}"`;
            }
            fs.writeFileSync(ckPath, lines.join('\n'));
            e.reply('老福特Cookie设置成功');
        } catch (err) {
            console.error('设置Cookie失败:', err);
            e.reply(`Cookie设置失败: ${err.message}`);
        }
        return true;
    }
    
    async setSmtpConfig(e) {
        if (!e.isMaster) {
            await e.reply("暂无权限，只有主人才能操作");
            return true; 
        }
        
        const match = e.msg.match(/^#不羡仙设置邮箱(SMTP端|账号|密钥|端口|名称)\s*(.+)$/);
        if (!match) {
            e.reply('格式错误，请使用：#不羡仙设置邮箱[SMTP端/账号/密钥/端口/名称] + 内容');
            return true;
        }
        const [, configType, content] = match;
        const configMap = {
            'SMTP端': { key: 'smtp' },
            '账号': { key: 'smtp_user' },
            '密钥': { key: 'smtp_password' },
            '端口': { key: 'smtp_port' },
            '名称': { key: 'webname' }
        };
        const configInfo = configMap[configType];
        if (!configInfo) {
            e.reply(`未知的配置项：${configType}`);
            return true;
        }
        const smtpPath = this.getPluginPath('config/config/smtp.yaml');
        try {
            if (!fs.existsSync(smtpPath)) {
                e.reply('smtp配置文件不存在');
                return true;
            }
            let lines = fs.readFileSync(smtpPath, 'utf8').split('\n');
            let found = false;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith(`${configInfo.key}:`)) {
                    lines[i] = `${configInfo.key}: ${content.trim()}`;
                    found = true;
                    break;
                }
            }
            if (!found) {
                lines.push(`${configInfo.key}: ${content.trim()}`);
            }
            fs.writeFileSync(smtpPath, lines.join('\n'));
            e.reply(`不羡仙邮箱${configType}设置成功`);
        } catch (err) {
            console.error('设置SMTP配置失败:', err);
            e.reply(`SMTP配置设置失败: ${err.message}`);
        }
        return true;
    }
    
    async showConfigFile(e) {
        if (!e.isMaster) {
            await e.reply("暂无权限，只有主人才能操作");
            return true; 
        }
        
        const match = e.msg.match(/^#不羡仙显示配置(admin|smtp|老福特)$/);
        if (!match) {
            e.reply('格式错误，请使用：#不羡仙显示配置 [admin/smtp/老福特]');
            return true;
        }
        const configType = match[1];
        let configPath, fileName;
        switch(configType) {
            case 'admin':
                configPath = this.getPluginPath('config/config/admin.yaml');
                fileName = 'admin.yaml';
                break;
            case 'smtp':
                configPath = this.getPluginPath('config/config/smtp.yaml');
                fileName = 'smtp.yaml';
                break;
            case '老福特':
                configPath = this.getPluginPath('data/Cookie/LFTCK.yaml');
                fileName = 'LFTCK.yaml';
                break;
            default:
                e.reply('未知的配置类型');
                return true;
        }
        try {
            if (!fs.existsSync(configPath)) {
                e.reply(`${fileName}配置文件不存在`);
                return true;
            }
            const content = fs.readFileSync(configPath, 'utf8');
            let msg = `【${fileName}配置文件内容】\n`;
            if (content.length > 1000) {
                msg += content.substring(0, 1000) + '\n...(内容过长，已截断)';
            } else {
                msg += content;
            }
            e.reply(msg);
        } catch (err) {
            console.error('读取配置文件失败:', err);
            e.reply(`读取${fileName}失败: ${err.message}`);
        }
        return true;
    }
}
