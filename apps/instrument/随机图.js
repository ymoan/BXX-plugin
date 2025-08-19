import plugin from '../../../../lib/plugins/plugin.js'
import fs from 'node:fs'
import path from 'node:path'
import axios from 'axios'
import YAML from 'yaml'

export class randomImage extends plugin {
  constructor() {
    super({
      name: '不羡仙随机图',
      dsc: '随机角色图片',
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: '^#随机图$',
          fnc: 'getRandomImage',
          log: false
        }
      ]
    })

    this.uploadDir = this._initPath('uploads')
    this.apiConfigPath = this._initPath('config') 
  }

  _initPath(dirType) {
    const basePath = process.cwd()
    const paths = {
      uploads: path.join(basePath, 'plugins/BXX-plugin/uploads/'),
      config: path.join(basePath, 'plugins/BXX-plugin/data/API/TPAPI.yaml')
    }
    

    if (dirType === 'uploads' && !fs.existsSync(paths.uploads)) {
      fs.mkdirSync(paths.uploads, { recursive: true, mode: 0o755 })
    }
    
    return paths[dirType]
  }

  async getRandomImage(e) {
    try {

      const configContent = fs.readFileSync(this.apiConfigPath, 'utf8')
      const config = YAML.parse(configContent)
      const { XZAPI } = config
      
      if (!XZAPI) return e.reply('未配置图片API')
      
      const response = await axios.get(XZAPI, {
        responseType: 'arraybuffer',
        timeout: 15000,
        validateStatus: status => status === 200,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      const contentType = response.headers['content-type']
      if (!/^image\/(jpe?g|png|webp|gif)/i.test(contentType)) {
        return e.reply('返回了无效的图片格式')
      }

      const imagePath = await this._saveImage(response.data, contentType)
      await e.reply([segment.image(imagePath)])
      

      setTimeout(() => {
        fs.unlink(imagePath, err => {
          if (err) console.warn('[随机图] 清理文件失败:', err.message)
        })
      }, 5000)

    } catch (err) {
      console.error('[随机图功能] 错误:', err)
      this._handleError(e, err)
    }
    return true
  }

  async _saveImage(data, contentType) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { 
        recursive: true,
        mode: 0o755 
      })
    }

    const ext = contentType.split('/')[1] || 'jpg'
    const filename = `random_${Date.now()}.${ext}`
    const savePath = path.join(this.uploadDir, filename)


    await new Promise((resolve, reject) => {
      fs.writeFile(savePath, data, err => {
        if (err) reject(err)
        else resolve()
      })
    })
    
    return savePath
  }

  _handleError(e, err) {
    const errorMap = {
      ECONNABORTED: '请求超时，请稍后重试',
      ENOTFOUND: '无法连接服务器',
      ERR_BAD_REQUEST: '无效的API请求',
      YAMLException: '配置文件格式错误'
    }

    let message = errorMap[err.code] || 
      (err.response?.status ? `服务器错误 (${err.response.status})` : '服务暂时不可用')
    

    if (err.name === 'YAMLException') {
      message = '配置文件格式错误，请检查YAML语法'
    }
    
    e.reply(`[随机图] ${message}`)
  }
}