import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import path from 'path';

export default class BXXConfig extends plugin {
    constructor() {
        super({
            name: '不羡仙:设置',
            dsc: '管理不羡仙插件所有功能权限及配置',
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

        this.paths = {
            admin: path.resolve(process.cwd(), 'plugins/BXX-plugin/config/config/admin.yaml'),
            smtp: path.resolve(process.cwd(), 'plugins/BXX-plugin/config/config/smtp.yaml'),
            lftCK: path.resolve(process.cwd(), 'plugins/BXX-plugin/data/Cookie/LFTCK.yaml')
        };

        this.allFeatures = {
            '网站信息': 'WZXXALL',
            '端口扫描': 'DKSMALL',
            '域名查询': 'WSYMALL',
            '二维码生成': 'RWMALL',
            '备案信息': 'ICPALL',
            '抖音解析': 'DYJXALL',
            '综合解析': 'ZHJXALL',
            '邮箱发送': 'YXFSALL'
        };

        this.smtpConfigMap = {
            'SMTP端': 'smtp',
            '账号': 'smtp_user',
            '密钥': 'smtp_password',
            '端口': 'smtp_port',
            '名称': 'webname'
        };
    }

    ensureDir(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    readConfig(filePath) {
        if (!fs.existsSync(filePath)) return {};
        return fs.readFileSync(filePath, 'utf8').split('\n').reduce((config, line) => {
            line = line.trim();
            if (!line || line.startsWith('#')) return config;
            const [key, ...valueParts] = line.split(':').map(item => item.trim());
            config[key] = valueParts.join(':').replace(/["']/g, '');
            return config;
        }, {});
    }

    writeConfig(filePath, config) {
        this.ensureDir(filePath);
        const lines = [];
        Object.entries(config).forEach(([key, value]) => {
            lines.push(`${key}: ${value}`);
        });
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    }

    async showConfig(e = this.e) {
        if (!e.isMaster) {
            await e.reply("暂无权限，只有主人才能操作");
            return true;
        }
        const adminConfig = this.readConfig(this.paths.admin);
        let msg = '【不羡仙所有功能权限】\n';
        Object.entries(this.allFeatures).forEach(([feature, key]) => {
            const status = adminConfig[key] === 'true' ? '开启' : '关闭';
            msg += `${feature}: ${status}\n`;
        });
        msg += '\n【可用命令】\n';
        msg += '1. #不羡仙设置 [功能名] 所有人可用 [开启/关闭]\n';
        msg += '2. #老福特设置CK [cookie值]\n';
        msg += '3. #不羡仙设置邮箱[SMTP端/账号/密钥/端口/名称] [内容]\n';
        msg += '4. #不羡仙显示配置 [admin/smtp/老福特]\n';
        await e.reply(msg.trim());
    }

    async updateConfig(e = this.e) {
        if (!e.isMaster) {
            await e.reply("暂无权限，只有主人才能操作");
            return true;
        }
        const match = e.msg.match(/^#不羡仙设置(.+?)所有人可用(开启|关闭)$/);
        if (!match) return false;
        const [, feature, action] = match;
        const key = this.allFeatures[feature];
        if (!key) {
            await e.reply(`未知功能: ${feature}`);
            return true;
        }
        const adminConfig = this.readConfig(this.paths.admin);
        adminConfig[key] = action === '开启';
        this.writeConfig(this.paths.admin, adminConfig);
        await e.reply(`【${feature}】所有人可用已${action}`);
    }

    async setLftCookie(e = this.e) {
        if (!e.isMaster) {
            await e.reply("暂无权限，只有主人才能操作");
            return true;
        }
        const ck = e.msg.replace(/^#老福特设置CK\s*/, '').trim();
        if (!ck) {
            await e.reply('请提供有效的Cookie（格式：#老福特设置CK [值]）');
            return true;
        }
        this.writeConfig(this.paths.lftCK, { LFTCK: ck });
        await e.reply('老福特Cookie设置成功');
    }

    async setSmtpConfig(e = this.e) {
        if (!e.isMaster) {
            await e.reply("暂无权限，只有主人才能操作");
            return true;
        }
        const match = e.msg.match(/^#不羡仙设置邮箱(SMTP端|账号|密钥|端口|名称)\s*(.+)$/);
        if (!match) {
            await e.reply('格式错误（例：#不羡仙设置邮箱SMTP端 smtp.qq.com）');
            return true;
        }
        const [, type, content] = match;
        const key = this.smtpConfigMap[type];
        if (!key) {
            await e.reply(`未知配置项: ${type}`);
            return true;
        }
        const smtpConfig = this.readConfig(this.paths.smtp);
        smtpConfig[key] = content;
        this.writeConfig(this.paths.smtp, smtpConfig);
        await e.reply(`邮箱【${type}】设置成功`);
    }

    async showConfigFile(e = this.e) {
        if (!e.isMaster) {
            await e.reply("暂无权限，只有主人才能操作");
            return true;
        }
        const match = e.msg.match(/^#不羡仙显示配置(admin|smtp|老福特)$/);
        if (!match) {
            await e.reply('格式错误（例：#不羡仙显示配置admin）');
            return true;
        }
        const [, type] = match;
        const filePath = this.paths[type === '老福特' ? 'lftCK' : type];
        if (!fs.existsSync(filePath)) {
            await e.reply(`${type}配置文件不存在`);
            return true;
        }
        const content = fs.readFileSync(filePath, 'utf8').slice(0, 1000);
        await e.reply(`【${type}配置文件】\n${content}${content.length >= 1000 ? '...(内容过长已截断)' : ''}`);
    }
}
