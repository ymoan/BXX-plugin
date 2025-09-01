import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class ForwardInfo extends plugin {
    constructor() {
        super({
            name: '不羡仙:前瞻信息',
            dsc: '原神/星铁/绝区零前瞻信息查询',
            event: 'message',
            priority: 500,
            rule: [{
                reg: '^(#原神前瞻|#星铁前瞻|#绝区零前瞻)$',
                fnc: 'queryForwardInfo'
            }]
        });
        this.cleanupDelay = 30000;
        this.screenshotOptions = {
            quality: 70,
            maxWidth: 1000,
            maxHeightPerShot: 3000,
            viewportHeight: 1000
        };
        this.maxSingleSendCount = 3;
        this.baseDir = path.resolve(__dirname, '../../');
        this.ensureDirs();
        this.commandGameMap = {
            '#原神前瞻': '原神',
            '#星铁前瞻': '星穹铁道',
            '#绝区零前瞻': '绝区零'
        };
    }
    get apiFilePath() {
        return path.join(this.baseDir, 'data/API/QZXX.yaml');
    }
    get uploadDir() {
        return path.join(this.baseDir, 'uploads');
    }
    ensureDirs() {
        const dirs = [this.uploadDir, path.dirname(this.apiFilePath)];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    async queryForwardInfo(e) {
        this.e = e;
        const command = e.msg.trim();
        const game = this.commandGameMap[command];
        if (!game) {
            return false;
        }
        await e.reply(`获取${game}前瞻信息中...`);
        let browser = null;
        let imgPaths = [];
        let screenshotsTaken = false;
        try {
            const apiUrl = await this.parseApiConfig();
            const targetUrl = `${apiUrl}?ver=${encodeURIComponent(game)}`;
            const forwardData = await this.fetchForwardData(targetUrl);
            
            if (!forwardData || typeof forwardData !== 'object') {
                return await e.reply('API返回数据格式异常');
            }
            if (forwardData.code === '0') {
                return await e.reply('游戏名错误或暂无前瞻信息');
            }
            if (forwardData.code !== '1' || !forwardData.data || typeof forwardData.data !== 'string') {
                return await e.reply('API返回异常或前瞻链接无效');
            }

            const baseImgName = `${game}_${Date.now()}`;
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                timeout: 30000
            });
            imgPaths = await this.captureScreenshots(browser, forwardData.data, baseImgName);
            screenshotsTaken = imgPaths.length > 0;
            
            imgPaths = imgPaths.filter(path => {
                return path && typeof path === 'string' && fs.existsSync(path) && fs.statSync(path).size > 100;
            });
            if (imgPaths.length === 0) {
                return await e.reply('截图生成失败，请重试');
            }

            await this.sendResult(e, forwardData, imgPaths);
        } catch (err) {
            console.error(`${game}前瞻信息查询失败:`, err);
            try {
                await e.reply(`服务异常: ${err.message.slice(0, 50)}`);
            } catch (replyErr) {
                console.error('回复消息失败:', replyErr);
            }
        } finally {
            await this.cleanupResources(browser, imgPaths, screenshotsTaken);
        }
        return true;
    }
    async parseApiConfig() {
        if (!fs.existsSync(this.apiFilePath)) throw new Error('API配置文件不存在');
        try {
            const data = fs.readFileSync(this.apiFilePath, 'utf8');
            const apiMatch = data.match(/QZXXAPI:\s*"([^"]+)"/);
            if (!apiMatch || !apiMatch[1]) throw new Error('API配置格式错误（需包含QZXXAPI:"链接"）');
            return apiMatch[1].replace(/\/+$/, '');
        } catch (err) {
            throw new Error('读取API配置失败: ' + err.message);
        }
    }
    async fetchForwardData(url) {
        try {
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
            });
            return response.data;
        } catch (err) {
            throw new Error('请求前瞻信息API失败: ' + (err.response?.status ? `HTTP ${err.response.status}` : err.message));
        }
    }
    async captureScreenshots(browser, url, baseImgName) {
        const page = await browser.newPage();
        const imgPaths = [];
        try {
            await page.setViewport({
                width: this.screenshotOptions.maxWidth,
                height: this.screenshotOptions.viewportHeight
            });
            await page.setDefaultNavigationTimeout(60000);
            
            if (!url.startsWith('http')) {
                throw new Error('前瞻链接不是有效URL');
            }
            await page.goto(url, {
                waitUntil: ['domcontentloaded', 'networkidle2'],
                timeout: 60000
            });
            await this.waitForContent(page);
            await this.scrollPage(page);
            
            const pageHeight = await page.evaluate(() => {
                return Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight,
                    document.body.offsetHeight,
                    document.documentElement.offsetHeight,
                    document.body.clientHeight,
                    document.documentElement.clientHeight
                );
            });
            if (pageHeight <= 0) {
                throw new Error('页面高度异常，无法截图');
            }

            const totalShots = Math.ceil(pageHeight / this.screenshotOptions.maxHeightPerShot);
            console.log(`页面总高度: ${pageHeight}, 需要 ${totalShots} 张截图`);
            
            for (let i = 0; i < totalShots; i++) {
                const startY = i * this.screenshotOptions.maxHeightPerShot;
                const remainingHeight = pageHeight - startY;
                const shotHeight = Math.min(remainingHeight, this.screenshotOptions.maxHeightPerShot);
                
                await page.evaluate((y) => window.scrollTo(0, y), startY);
                await new Promise(resolve => setTimeout(resolve, 500));
                const imgPath = path.resolve(this.uploadDir, `${baseImgName}_${i + 1}.jpg`);
                if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
                
                try {
                    await page.screenshot({
                        path: imgPath,
                        type: 'jpeg',
                        quality: this.screenshotOptions.quality,
                        clip: { x: 0, y: startY, width: this.screenshotOptions.maxWidth, height: shotHeight }
                    });
                    if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 100) {
                        imgPaths.push(imgPath);
                        console.log(`已生成第 ${i + 1}/${totalShots} 张截图: ${imgPath}`);
                    } else {
                        console.warn(`第 ${i + 1} 张截图生成无效`);
                    }
                } catch (shotErr) {
                    console.error(`第 ${i + 1} 张截图失败:`, shotErr);
                }
            }
        } catch (e) {
            console.error('截图核心逻辑失败:', e);
        } finally {
            await page.close();
        }
        return imgPaths;
    }
    async waitForContent(page) {
        const maxWaitTime = 15000;
        const startTime = Date.now();
        const selectors = ['.article-title', '.content-wrapper', '.mhy-container', 'h1', 'body > div.container'];
        while (Date.now() - startTime < maxWaitTime) {
            for (const selector of selectors) {
                try {
                    await page.waitForSelector(selector, { visible: true, timeout: 2000 });
                    return;
                } catch (e) {}
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        console.warn('未检测到页面核心内容，继续截图');
    }
    async scrollPage(page) {
        try {
            const bodyHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
            const viewportHeight = this.screenshotOptions.viewportHeight;
            let currentPosition = 0;
            while (currentPosition < bodyHeight) {
                currentPosition += viewportHeight;
                currentPosition = Math.min(currentPosition, bodyHeight);
                await page.evaluate((pos) => window.scrollTo(0, pos), currentPosition);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            await page.evaluate(() => window.scrollTo(0, 0));
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.error('滚动页面时出错:', e);
        }
    }
    async createForwardMessage(imgPaths, data) {
        const forwardMessages = [];
        const botUin = String(Bot.uin).replace(/[^0-9]/g, '');
        if (!botUin) throw new Error('Bot.uin配置错误，无法获取正确QQ号');
        
        const gameName = data.name || '未知游戏';
        const version = data.version || '未知版本';
        const date = data.date || '未知日期';
        const link = data.data || '无链接';
        forwardMessages.push({
            user_id: botUin,       // 纯数字QQ号字符串
            nickname: '前瞻信息',
            message: [
                `前瞻信息获取成功！`,
                `游戏：${gameName}`,
                `版本：${version}`,
                `日期：${date}`,
                `链接：${link}`,
                `共${imgPaths.length}张截图，已合并发送`
            ].join('\n')
        });
        
        for (let i = 0; i < imgPaths.length; i++) {
            const imgPath = imgPaths[i];
            try {
                const stats = fs.statSync(imgPath);
                if (stats.size > 10 * 1024 * 1024) {
                    forwardMessages.push({
                        user_id: botUin,
                        nickname: '前瞻信息助手',
                        message: `第${i + 1}张截图较大(${Math.round(stats.size/1024/1024)}MB)，可能无法正常显示`
                    });
                } else {
                    forwardMessages.push({
                        user_id: botUin,
                        nickname: '前瞻信息助手',
                        message: segment.image(imgPath) 
                    });
                }
            } catch (fileErr) {
                console.error(`处理第${i + 1}张截图失败:`, fileErr);
                forwardMessages.push({
                    user_id: botUin,
                    nickname: '前瞻信息助手',
                    message: `第${i + 1}张截图文件异常`
                });
            }
        }
        
        if (this.e.group) {
            return await this.e.group.makeForwardMsg(forwardMessages);
        } else if (this.e.friend) {
            return await this.e.friend.makeForwardMsg(forwardMessages);
        } else {
            return await Bot.makeForwardMsg(forwardMessages);
        }
    }
    async sendResult(e, data, imgPaths) {
        try {
            const gameName = data.name || '未知游戏';
            if (imgPaths.length > this.maxSingleSendCount) {
                await e.reply(`检测到${imgPaths.length}张截图，将使用合并消息发送...`);
                const forwardMsg = await this.createForwardMessage(imgPaths, data);
                await e.reply(forwardMsg);
            } else {
                const msg = [
                    `前瞻信息获取成功！`,
                    `游戏：${gameName}`,
                    `版本：${data.version || '未知版本'}`,
                    `日期：${data.date || '未知日期'}`,
                    `链接：${data.data || '无链接'}`,
                    `共${imgPaths.length}张截图`
                ];
                await e.reply(msg.join('\n'));
                for (let i = 0; i < imgPaths.length; i++) {
                    const imgPath = imgPaths[i];
                    try {
                        const stats = fs.statSync(imgPath);
                        if (stats.size > 10 * 1024 * 1024) {
                            await e.reply(`第${i + 1}张截图较大(${Math.round(stats.size/1024/1024)}MB)，可能无法发送`);
                        } else {
                            await e.reply(`第${i + 1}/${imgPaths.length}张截图：`);
                            await e.reply(segment.image(imgPath));
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    } catch (fileErr) {
                        await e.reply(`第${i + 1}张截图文件异常`);
                    }
                }
            }
        } catch (sendErr) {
            console.error('发送消息失败:', sendErr);
            const gameName = data.name || '未知游戏';
            await e.reply('截图发送失败，但前瞻信息已获取：');
            await e.reply([
                `游戏：${gameName}`,
                `版本：${data.version || '未知版本'}`,
                `日期：${data.date || '未知日期'}`,
                `链接：${data.data || '无链接'}`
            ].join('\n'));
        }
    }
    async cleanupResources(browser, imgPaths, screenshotsTaken) {
        if (browser) {
            try {
                await browser.close();
            } catch (browserErr) {
                console.error('关闭浏览器失败:', browserErr);
            }
        }
        if (screenshotsTaken && imgPaths.length > 0) {
            setTimeout(() => {
                imgPaths.forEach(imgPath => {
                    try {
                        if (imgPath && typeof imgPath === 'string' && fs.existsSync(imgPath)) {
                            fs.unlinkSync(imgPath);
                            console.log(`已删除截图: ${imgPath}`);
                        }
                    } catch (unlinkErr) {
                        console.error(`删除截图失败 ${imgPath}:`, unlinkErr);
                    }
                });
            }, this.cleanupDelay);
        }
    }
}
