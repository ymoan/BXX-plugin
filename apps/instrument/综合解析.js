import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

export class MultiPlatformParser extends plugin {
  constructor() {
    super({
      name: '不羡仙:综合解析',
      dsc: '解析多个平台的视频/图文内容',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#综合解析\\s*(https?:\\/\\/[\\w.-]+\\/\\S*)$',
          fnc: 'parseContent'
        }
      ]
    });
    
    this.uploadDir = path.join(process.cwd(), 'plugins/BXX-plugin/uploads/');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async parseContent(e) {
    const hasPermission = await this.checkPermission(e);
    if (!hasPermission) {
      return await e.reply("暂无权限，只有主人才能操作");
    }

    const urlMatch = e.msg.match(/^#综合解析\s*(https?:\/\/[\w.-]+\/\S*)$/);
    if (!urlMatch || !urlMatch[1]) {
      return await e.reply('链接格式错误，请检查后重试（例：#综合解析 https://xxx.com/xxx）');
    }
    const contentUrl = urlMatch[1];

    try {
      const { apiUrl, apiKey } = await this.getApiConfig();
      const requestUrl = `${apiUrl}?apikey=${apiKey}&url=${encodeURIComponent(contentUrl)}`;
      const response = await axios.get(requestUrl, { timeout: 10000 });
      const result = response.data;

      if (result.code !== 1) {
        return await e.reply(result.msg || '解析失败');
      }

      await this.handleMedia(e, result.data);
    } catch (err) {
      console.error('综合解析错误:', err);
      await e.reply(`解析失败: ${err.message || '未知错误'}`);
    }
  }

  async checkPermission(e) {
    try {
      const adminPath = path.join(process.cwd(), 'plugins/BXX-plugin/config/config/admin.yaml');
      if (fs.existsSync(adminPath)) {
        const adminContent = fs.readFileSync(adminPath, 'utf8');
        const allMatch = adminContent.match(/DYJXALL:\s*(true|false)/i);
        if (allMatch && allMatch[1].toLowerCase() === 'true') {
          return true;
        }
      }

      return e.isMaster;

    } catch (err) {
      console.error('权限检查错误:', err);
      return e.isMaster;
    }
  }

  async getApiConfig() {
    try {
      const apiPath = path.join(process.cwd(), 'plugins/BXX-plugin/data/API/ZHJXAPI.yaml');
      if (!fs.existsSync(apiPath)) throw new Error('ZHJXAPI.yaml 配置文件不存在');
      
      const apiContent = fs.readFileSync(apiPath, 'utf8');
      const apiUrlMatch = apiContent.match(/ZHJXAPI:\s*"([^"]+)"/);
      if (!apiUrlMatch) throw new Error('未找到 ZHJXAPI 配置（格式需为 ZHJXAPI: "xxx"）');

      const keyPath = path.join(process.cwd(), 'plugins/BXX-plugin/data/KEY/ZHJXKEY.yaml');
      if (!fs.existsSync(keyPath)) throw new Error('ZHJXKEY.yaml 配置文件不存在');
      
      const keyContent = fs.readFileSync(keyPath, 'utf8');
      const apiKeyMatch = keyContent.match(/ZHJXKEY:\s*"([^"]+)"/);
      if (!apiKeyMatch) throw new Error('未找到 ZHJXKEY 配置（格式需为 ZHJXKEY: "xxx"）');
      
      return {
        apiUrl: apiUrlMatch[1],
        apiKey: apiKeyMatch[1]
      };
    } catch (err) {
      throw new Error('读取API配置失败: ' + err.message);
    }
  }

  async handleMedia(e, data) {
    try {
      const { description, author, time, cover_url, video_url } = data;
      let infoText = `📝 描述: ${description || '无'}\n`;
      infoText += `👤 作者: ${author || '未知'}\n`;
      if (time) infoText += `⏰ 发布时间: ${time}\n`;
      
      const msgContent = [infoText];
      if (cover_url) {
        try {
          const coverPath = path.join(this.uploadDir, `cover_${Date.now()}.jpg`);
          await this.downloadFile(cover_url, coverPath);
          msgContent.push(segment.image(`file:///${coverPath}`));
        } catch (coverErr) {
          console.error('封面下载失败:', coverErr);
          msgContent.push('❌ 封面下载失败');
        }
      }

      if (video_url) {
        try {
          const videoPath = path.join(this.uploadDir, `video_${Date.now()}.mp4`);
          await this.downloadFile(video_url, videoPath);
          msgContent.push(segment.video(`file:///${videoPath}`));
        } catch (videoErr) {
          console.error('视频下载失败:', videoErr);
          msgContent.push('❌ 视频下载失败，尝试使用原始链接');
          msgContent.push(`🔗 视频链接: ${video_url}`);
        }
      }
      
      await e.reply(msgContent);
      this.cleanUpFiles();
    } catch (err) {
      throw new Error('媒体处理失败: ' + err.message);
    }
  }

  async downloadFile(url, filePath) {
    const writer = fs.createWriteStream(filePath);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
      }
    });
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  cleanUpFiles() {
    fs.readdir(this.uploadDir, (err, files) => {
      if (err) return;
      
      const now = Date.now();
      files.forEach(file => {
        const filePath = path.join(this.uploadDir, file);
        try {
          const stat = fs.statSync(filePath);
          if (now - stat.birthtimeMs > 600000) {
            fs.unlinkSync(filePath);
          }
        } catch (cleanErr) {
          console.error('清理临时文件失败:', cleanErr);
        }
      });
    });
  }
}

export default MultiPlatformParser;
