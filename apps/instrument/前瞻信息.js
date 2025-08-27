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
            maxHeight: 8000
        };

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
        const command = e.msg.trim();
        const game = this.commandGameMap[command];
        if (!game) {
            return false;
        }

        await e.reply(`获取${game}前瞻信息中...`);
        let browser = null;
        let imgPath = null;
        let screenshotTaken = false;

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
            
            imgPath = path.join(this.uploadDir, `${game}_${Date.now()}.jpg`);
            
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            await this.captureScreenshot(browser, forwardData.data, imgPath);
            screenshotTaken = true;
            
            await this.sendResult(e, forwardData, imgPath);
        } catch (err) {
            console.error(`${game}前瞻信息查询失败:`, err);
            try {
                await e.reply(`服务异常: ${err.message}`);
            } catch (replyErr) {
                console.error('回复消息失败:', replyErr);
            }
        } finally {
            await this.cleanupResources(browser, imgPath, screenshotTaken);
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

    async captureScreenshot(browser, url, imgPath) {
        const page = await browser.newPage();
        try {
            await page.setViewport({ 
                width: this.screenshotOptions.maxWidth, 
                height: 800 
            });
            await page.setDefaultNavigationTimeout(60000);
            
            await page.goto(url, {
                waitUntil: ['domcontentloaded', 'networkidle2'],
                timeout: 60000
            });
            
            await this.waitForContent(page);
            await this.scrollPage(page);
            await page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 });
            
            const pageHeight = await page.evaluate(() => {
                return Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight
                );
            });
            
            const captureHeight = Math.min(pageHeight, this.screenshotOptions.maxHeight);
            
            await page.screenshot({
                path: imgPath,
                type: 'jpeg',
                quality: this.screenshotOptions.quality,
                clip: {
                    x: 0,
                    y: 0,
                    width: this.screenshotOptions.maxWidth,
                    height: captureHeight
                }
            });
        } finally {
            await page.close();
        }
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
            
            const limitedHeight = Math.min(bodyHeight, this.screenshotOptions.maxHeight);
            const viewportHeight = 800;
            let currentPosition = 0;
            
            while (currentPosition < limitedHeight) {
                currentPosition += viewportHeight;
                await page.evaluate((position) => {
                    window.scrollTo(0, position);
                }, currentPosition);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            await page.evaluate(() => {
                window.scrollTo(0, 0);
            });
        } catch (e) {}
    }

    async sendResult(e, data, imgPath) {
        const msg = [
            `前瞻信息获取成功！`,
            `游戏：${data.name}`,
            `版本：${data.version}`,
            `日期：${data.date}`,
            `链接：${data.data}`
        ];
        
        await e.reply(msg.join('\n'));
        
        try {
            if (fs.existsSync(imgPath)) {
                const stats = fs.statSync(imgPath);
                if (stats.size > 10 * 1024 * 1024) {
                    await e.reply(`截图较大(${Math.round(stats.size/1024/1024)}MB)，可能无法发送，建议直接访问链接查看`);
                } else if (stats.size > 0) {
                    await e.reply(segment.image(imgPath));
                } else {
                    await e.reply('截图生成失败，但前瞻信息已获取');
                }
            } else {
                await e.reply('截图生成失败，但前瞻信息已获取');
            }
        } catch (sendErr) {
            console.error('发送截图失败:', sendErr);
            await e.reply('截图发送失败，但前瞻信息已获取');
        }
    }

    async cleanupResources(browser, imgPath, screenshotTaken) {
        if (browser) {
            try { 
                await browser.close(); 
            } catch (browserErr) { 
                console.error('关闭浏览器失败:', browserErr); 
            }
        }
        
        if (imgPath && screenshotTaken && fs.existsSync(imgPath)) {
            setTimeout(() => {
                try {
                    if (fs.existsSync(imgPath)) {
                        fs.unlinkSync(imgPath);
                    }
                } catch (unlinkErr) {
                    console.error('删除截图失败:', unlinkErr);
                }
            }, this.cleanupDelay);
        }
    }
}
