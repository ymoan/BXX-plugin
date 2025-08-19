import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class LFTParse extends plugin {
  constructor() {
    super({
      name: '老福特解析',
      dsc: '解析Lofter文章并下载图片~',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#老福特解析\\s*(https?://[\\w./-]+)',
          fnc: 'parseLofter'
        }
      ]
    });


    this.baseDir = path.resolve(__dirname, '../../');
    

    this.ensureDirs();
  }

  get uploadDir() {
    return path.join(this.baseDir, 'uploads');
  }

  get cookiePath() {
    return path.join(this.baseDir, 'data/Cookie/LFTCK.yaml');
  }

  ensureDirs() {
    const dirs = [
      this.uploadDir,
      path.dirname(this.cookiePath)
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async parseLofter(e) {
    const lofterUrl = e.msg.match(/https?:\/\/[^\s]+/)[0];
    await e.reply('开始解析老福特文章，请稍候...');

    try {

      const cookieStr = await this.readCookies();
      if (!cookieStr) {
        return await e.reply('老福特Cookie未配置，请检查Cookie文件');
      }


      const isValid = await this.validateCookie(cookieStr);
      if (!isValid) {
        return await e.reply('老福特Cookie已失效，请更新Cookie');
      }


      const imageUrls = await this.fetchImages(lofterUrl, cookieStr);
      if (!imageUrls || imageUrls.length === 0) {
        return await e.reply('未找到可下载的图片');
      }


      const imagePaths = await this.downloadImages(imageUrls);
      

      await this.sendImages(e, imagePaths);
      
    } catch (err) {
      console.error('老福特解析错误:', err);
      await e.reply(`解析失败: ${err.message}`);
    } finally {

      this.cleanupImages();
    }
  }

  async readCookies() {
    if (!fs.existsSync(this.cookiePath)) {
      return null;
    }

    try {
      const fileContent = fs.readFileSync(this.cookiePath, 'utf8');
      

      const lines = fileContent.split('\n');
      for (const line of lines) {

        if (line.trim().startsWith('#')) continue;
        

        if (line.includes('LFTCK:')) {

          const value = line.split('LFTCK:')[1].trim();

          return value.replace(/^['"]|['"]$/g, '');
        }
      }
      
      return null;
    } catch (err) {
      console.error('读取Cookie失败:', err);
      return null;
    }
  }

  async validateCookie(cookieStr) {
    try {
      const response = await axios.get('https://www.lofter.com', {
        headers: {
          'Cookie': cookieStr,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });


      if (response.headers.location && response.headers.location.includes('/login')) {
        return false;
      }
      

      if (response.data.includes('id="loginBtn"') || response.data.includes('class="login"')) {
        return false;
      }
      
      return true;
    } catch (err) {

      if (err.response && err.response.status === 302) {
        return !err.response.headers.location.includes('/login');
      }
      return false;
    }
  }

  async fetchImages(url, cookieStr) {
    try {
      const response = await axios.get(url, {
        headers: {
          'Cookie': cookieStr,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });


      const debugPath = path.join(this.uploadDir, 'debug.html');
      fs.writeFileSync(debugPath, response.data);
      console.log('页面已保存到:', debugPath);


      const imageUrls = [];
      

      const cdnRegex = /(https?:\/\/imglf\d?\.lf\d+\.net\/[^\s"']+)/gi;
      let match;
      while ((match = cdnRegex.exec(response.data)) !== null) {
        let imgUrl = match[1];
        

        if (imgUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {

          imgUrl = imgUrl.split('?')[0];
          imageUrls.push(imgUrl);
        }
      }
      
 
      if (imageUrls.length === 0) {
        const base64Regex = /<img[^>]+src="data:image\/[^;]+;base64,([^"]+)"[^>]*>/gi;
        let base64Match;
        while ((base64Match = base64Regex.exec(response.data)) !== null) {
          const base64Data = base64Match[1];
          if (base64Data) {
            imageUrls.push(`data:image/jpeg;base64,${base64Data}`);
          }
        }
      }
      

      return [...new Set(imageUrls)];
    } catch (err) {
      throw new Error('获取图片失败: ' + err.message);
    }
  }

  async downloadImages(urls) {
    const paths = [];
    
    for (const [index, url] of urls.entries()) {
      try {

        if (url.startsWith('data:image')) {
          const matches = url.match(/^data:image\/(\w+);base64,(.+)$/);
          if (!matches) continue;
          
          const ext = matches[1] === 'jpeg' ? '.jpg' : `.${matches[1]}`;
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          
          const imagePath = path.join(this.uploadDir, `lft_base64_${Date.now()}_${index}${ext}`);
          fs.writeFileSync(imagePath, buffer);
          paths.push(imagePath);
          continue;
        }
        

        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          headers: {
            'Referer': 'https://www.lofter.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 10000
        });
        

        const contentType = response.headers['content-type'];
        let ext = '.jpg';
        if (contentType) {
          if (contentType.includes('png')) ext = '.png';
          else if (contentType.includes('gif')) ext = '.gif';
          else if (contentType.includes('webp')) ext = '.webp';
        }
        
        const imagePath = path.join(this.uploadDir, `lft_${Date.now()}_${index}${ext}`);
        fs.writeFileSync(imagePath, response.data);
        paths.push(imagePath);
      } catch (err) {
        console.error(`下载图片失败 [${url}]:`, err);
      }
    }
    
    return paths;
  }

  async sendImages(e, imagePaths) {
    if (imagePaths.length === 0) {
      await e.reply('没有成功下载的图片');
      return;
    }


    for (const imgPath of imagePaths) {
      try {
        await e.reply(segment.image(imgPath));

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error('发送图片失败:', err);
      }
    }
  }

  cleanupImages() {
    try {
      const files = fs.readdirSync(this.uploadDir);
      for (const file of files) {
        if (file.startsWith('lft_') || file.startsWith('debug')) {
          const filePath = path.join(this.uploadDir, file);
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      console.error('清理图片失败:', err);
    }
  }
}