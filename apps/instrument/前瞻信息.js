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
            if (forwardData.code === '0') {
                return await e.reply('游戏名错误或暂无前瞻信息');
            }
            if (forwardData.code !== '1') {
                return await e.reply('API返回异常');
            }
            const baseImgName = `${game}_${Date.now()}`;
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            imgPaths = await this.captureScreenshots(browser, forwardData.data, baseImgName);
            screenshotsTaken = imgPaths.length > 0;
            await this.sendResult(e, forwardData, imgPaths);
        } catch (err) {
            console.error(`${game}前瞻信息查询失败:`, err);
            try {
                await e.reply(`服务异常: ${err.message}`);
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
            if (!apiMatch || !apiMatch[1]) throw new Error('API配置格式错误');
            return apiMatch[1].replace(/\/+$/, '');
        } catch (err) {
            throw new Error('读取API配置失败: ' + err.message);
        }
    }
    async fetchForwardData(url) {
        try {
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
            });
            return response.data;
        } catch (err) {
            throw new Error('请求前瞻信息API失败: ' + err.message);
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
            const totalShots = Math.ceil(pageHeight / this.screenshotOptions.maxHeightPerShot);
            console.log(`页面总高度: ${pageHeight}, 需要 ${totalShots} 张截图`);
            for (let i = 0; i < totalShots; i++) {
                const startY = i * this.screenshotOptions.maxHeightPerShot;
                const remainingHeight = pageHeight - startY;
                const shotHeight = Math.min(remainingHeight, this.screenshotOptions.maxHeightPerShot);
                await page.evaluate((y) => {
                    window.scrollTo(0, y);
                }, startY);
                await new Promise(resolve => setTimeout(resolve, 500));
                const imgPath = path.join(this.uploadDir, `${baseImgName}_${i + 1}.jpg`);
                imgPaths.push(imgPath);
                await page.screenshot({
                    path: imgPath,
                    type: 'jpeg',
                    quality: this.screenshotOptions.quality,
                    clip: {
                        x: 0,
                        y: startY,
                        width: this.screenshotOptions.maxWidth,
                        height: shotHeight
                    }
                });
                console.log(`已生成第 ${i + 1}/${totalShots} 张截图: ${imgPath}`);
            }
        } finally {
            await page.close();
        }
        return imgPaths;
    }
    async waitForContent(page) {
        const maxWaitTime = 15000;
        const startTime = Date.now();
        const selectors = [
            '.article-title',
            '.content-wrapper',
            '.mhy-container',
            'h1',
            'body > div.container'
        ];
        while (Date.now() - startTime < maxWaitTime) {
            for (const selector of selectors) {
                try {
                    await page.waitForSelector(selector, {
                        visible: true,
                        timeout: 2000
                    });
                    return;
                } catch (e) {}
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    async scrollPage(page) {
        try {
            const bodyHeight = await page.evaluate(() => {
                return Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight
                );
            });
            const viewportHeight = this.screenshotOptions.viewportHeight;
            let currentPosition = 0;
            while (currentPosition < bodyHeight) {
                currentPosition += viewportHeight;
                currentPosition = Math.min(currentPosition, bodyHeight);
                await page.evaluate((position) => {
                    window.scrollTo(0, position);
                }, currentPosition);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            await page.evaluate(() => {
                window.scrollTo(0, 0);
            });
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.error('滚动页面时出错:', e);
        }
    }
    async createForwardMessage(imgPaths, data) {
        const forwardMessages = [];
        const bot = Bot.uin;
        forwardMessages.push({
            user_id: bot,
            nickname: '前瞻信息助手',
            message: [
                `前瞻信息获取成功！`,
                `游戏：${data.name}`,
                `版本：${data.version}`,
                `日期：${data.date}`,
                `链接：${data.data}`,
                `共${imgPaths.length}张截图，已合并发送`
            ].join('\n')
        });
        for (let i = 0; i < imgPaths.length; i++) {
            const imgPath = imgPaths[i];
            if (fs.existsSync(imgPath)) {
                const stats = fs.statSync(imgPath);
                if (stats.size > 10 * 1024 * 1024) {
                    forwardMessages.push({
                        user_id: bot,
                        nickname: '前瞻信息助手',
                        message: `第${i + 1}张截图较大(${Math.round(stats.size/1024/1024)}MB)，可能无法正常显示`
                    });
                } else if (stats.size > 0) {
                    forwardMessages.push({
                        user_id: bot,
                        nickname: '前瞻信息助手',
                        message: `${segment.image(imgPath)}`
                    });
                } else {
                    forwardMessages.push({
                        user_id: bot,
                        nickname: '前瞻信息助手',
                        message: `第${i + 1}张截图生成失败`
                    });
                }
            } else {
                forwardMessages.push({
                    user_id: bot,
                    nickname: '前瞻信息助手',
                    message: `第${i + 1}张截图文件不存在`
                });
            }
        }
        if (this.e.friend) {
            return await this.e.friend.makeForwardMsg(forwardMessages);
        } else if (this.e.user_id) {
            const friend = Bot.pickFriend(this.e.user_id);
            return await friend.makeForwardMsg(forwardMessages);
        } else {
            throw new Error('无法创建合并消息，未找到合适的发送对象');
        }
    }
    async sendResult(e, data, imgPaths) {
        try {
            if (imgPaths.length > this.maxSingleSendCount) {
                await e.reply(`检测到${imgPaths.length}张截图，将使用合并消息发送...`);
                const forwardMsg = await this.createForwardMessage(imgPaths, data);
                await e.reply(forwardMsg);
            } else {
                const msg = [
                    `前瞻信息获取成功！`,
                    `游戏：${data.name}`,
                    `版本：${data.version}`,
                    `日期：${data.date}`,
                    `链接：${data.data}`,
                    `共${imgPaths.length}张截图`
                ];
                await e.reply(msg.join('\n'));
                for (let i = 0; i < imgPaths.length; i++) {
                    const imgPath = imgPaths[i];
                    if (fs.existsSync(imgPath)) {
                        const stats = fs.statSync(imgPath);
                        if (stats.size > 10 * 1024 * 1024) {
                            await e.reply(`第${i + 1}张截图较大(${Math.round(stats.size/1024/1024)}MB)，可能无法发送`);
                        } else if (stats.size > 0) {
                            await e.reply(`第${i + 1}/${imgPaths.length}张截图：`);
                            await e.reply(segment.image(imgPath));
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } else {
                            await e.reply(`第${i + 1}张截图生成失败`);
                        }
                    } else {
                        await e.reply(`第${i + 1}张截图文件不存在`);
                    }
                }
            }
        } catch (sendErr) {
            console.error('发送消息失败:', sendErr);
            await e.reply('截图发送失败，但前瞻信息已获取：');
            await e.reply([
                `游戏：${data.name}`,
                `版本：${data.version}`,
                `日期：${data.date}`,
                `链接：${data.data}`
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
                        if (fs.existsSync(imgPath)) {
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
