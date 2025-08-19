import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

export class DouyinParser extends plugin {
  constructor() {
    super({
      name: '抖音解析',
      dsc: '解析抖音视频/图集内容',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#抖音解析\\s*(https?:\\/\\/[\\w.-]+\\/\\S*)$',
          fnc: 'parseDouyin'
        }
      ]
    });
    
    this.uploadDir = path.join(process.cwd(), 'plugins/BXX-plugin/uploads/');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async parseDouyin(e) {
    const hasPermission = await this.checkPermission(e);
    if (!hasPermission) {
      return await e.reply('暂无权限，只有主人才能操作此功能');
    }

    const dyUrl = e.msg.match(/^#抖音解析\s*(https?:\/\/[\w.-]+\/\S*)$/)[1];
    if (!dyUrl) {
      return await e.reply('链接格式错误，请检查后重试');
    }

    try {
      const { apiUrl, apiKey } = await this.getApiConfig();
      const requestUrl = `${apiUrl}?apikey=${apiKey}&url=${encodeURIComponent(dyUrl)}`;
      const response = await axios.get(requestUrl, { timeout: 10000 });
      const result = response.data;

      if (result.code !== 1) {
        const errorMsg = this.handleError(result.msg);
        return await e.reply(errorMsg);
      }

      if (result.type === 'video') {
        await this.handleVideo(e, result.data);
      } else if (result.type === 'image') {
        await this.handleImages(e, result.data);
      } else {
        await e.reply(`未知的媒体类型: ${result.type}`);
      }
    } catch (err) {
      console.error('抖音解析错误:', err);
      await e.reply(`解析失败: ${err.message || '未知错误'}`);
    }
  }

  async checkPermission(e) {
    try {
      const adminPath = path.join(process.cwd(), 'plugins/BXX-plugin/config/config/admin.yaml');
      const adminContent = fs.readFileSync(adminPath, 'utf8');
      const dyjxAllMatch = adminContent.match(/DYJXALL:\s*(true|false)/);
      if (dyjxAllMatch && dyjxAllMatch[1] === 'true') {
        return true;
      }

      const otherPath = path.join(process.cwd(), 'config/config/other.yaml');
      const otherContent = fs.readFileSync(otherPath, 'utf8');
      const userId = e.user_id.toString();
      const masterQQMatch = otherContent.match(/masterQQ:\s*([\s\S]*?)(?=\n\S|$)/);
      if (masterQQMatch) {
        const masterQQList = masterQQMatch[1].split('\n')
          .map(line => line.trim().replace(/-/g, '').replace(/"/g, ''))
          .filter(item => item);
        
        if (masterQQList.includes(userId)) {
          return true;
        }
      }
      const masterMatch = otherContent.match(/master:\s*([\s\S]*?)(?=\n\S|$)/);
      if (masterMatch) {
        const masterList = masterMatch[1].split('\n')
          .map(line => line.trim().replace(/-/g, '').replace(/"/g, ''))
          .filter(item => item);
        
        if (masterList.some(item => item.startsWith(`${userId}:`))) {
          return true;
        }
      }
      
      return false;
    } catch (err) {
      console.error('权限检查错误:', err);
      return false;
    }
  }

  async getApiConfig() {
    try {
      const apiPath = path.join(process.cwd(), 'plugins/BXX-plugin/data/API/DYAPI.yaml');
      const apiContent = fs.readFileSync(apiPath, 'utf8');
      const apiUrlMatch = apiContent.match(/DYJXAPI:\s*"([^"]+)"/);
      if (!apiUrlMatch) throw new Error('未找到DYJXAPI配置');

      const keyPath = path.join(process.cwd(), 'plugins/BXX-plugin/data/KEY/DYKEY.yaml');
      const keyContent = fs.readFileSync(keyPath, 'utf8');
      const apiKeyMatch = keyContent.match(/DYJXKEY:\s*"([^"]+)"/);
      if (!apiKeyMatch) throw new Error('未找到DYJXKEY配置');
      
      return {
        apiUrl: apiUrlMatch[1],
        apiKey: apiKeyMatch[1]
      };
    } catch (err) {
      throw new Error('读取API配置失败: ' + err.message);
    }
  }

  handleError(errorCode) {
    const errors = {
      '100': 'API密钥不能为空',
      '101': 'API密钥不存在',
      '102': '当前来源地址不在白名单内',
      '0': '链接不合法或格式错误'
    };
    
    return errors[errorCode] || `解析失败: ${errorCode}`;
  }

  async handleVideo(e, data) {
    try {
      const videoUrl = data.url;
      const title = data.title || '抖音视频';
      const videoPath = path.join(this.uploadDir, `dy_${Date.now()}.mp4`);
      await this.downloadFile(videoUrl, videoPath);
      await e.reply([
        `标题: ${title}`,
        segment.video(`file:///${videoPath}`)
      ]);
      
      fs.unlinkSync(videoPath);
    } catch (err) {
      throw new Error('视频处理失败: ' + err.message);
    }
  }

  async handleImages(e, data) {
    try {
      const title = data.title || '抖音图集';
      const images = data.images || [];
      
      if (images.length === 0) {
        return await e.reply('未获取到图片内容');
      }
      
      const maxImages = Math.min(images.length, 9);
      const imagePaths = [];
      for (let i = 0; i < maxImages; i++) {
        const img = images[i];
        const imgPath = path.join(this.uploadDir, `dy_img_${Date.now()}_${i}.jpg`);
        await this.downloadFile(img.url, imgPath);
        imagePaths.push(imgPath);
      }
      
      const msg = [`标题: ${title} (共${images.length}张图片，显示前${maxImages}张)`];
      for (const imgPath of imagePaths) {
        msg.push(segment.image(`file:///${imgPath}`));
      }
      
      await e.reply(msg);
      
      for (const imgPath of imagePaths) {
        fs.unlinkSync(imgPath);
      }
    } catch (err) {
      throw new Error('图片处理失败: ' + err.message);
    }
  }

  async downloadFile(url, filePath) {
    const writer = fs.createWriteStream(filePath);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000
    });
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }
}

export default DouyinParser;