import plugin from '../../../../lib/plugins/plugin.js'
import fs from 'node:fs'
import path from 'node:path'
import axios from 'axios'
import YAML from 'yaml'

export class xiezhen extends plugin {
  constructor() {
    super({
      name: '不羡仙写真图',
      dsc: '写真图片生成',
      event: 'message',
      priority: 99999,
      rule: [
        {
          reg: '^#(.*?)写真图$',
          fnc: 'generateXZ',
          log: false
        }
      ]
    })


    this._initPaths()
  }

  _initPaths() {
    const basePath = process.cwd()
    this.uploadDir = path.join(basePath, 'plugins/BXX-plugin/uploads/')
    

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true, mode: 0o755 })
    }
    

    this.configPath = path.join(basePath, 'plugins/BXX-plugin/data/API/TPAPI.yaml')
  }

  async generateXZ(e) {
    const character = e.msg.match(/^#(.*?)写真图$/)[1]
    if (!character) return e.reply('指令格式错误，示例：#饮月君写真图')

    try {

      const configContent = fs.readFileSync(this.configPath, 'utf8')
      const config = YAML.parse(configContent)
      const { XZAPI } = config
      
      if (!XZAPI) {
        return e.reply('写真图API未配置，请检查配置文件')
      }
      
      const response = await axios.get(`${XZAPI}?ver=${encodeURIComponent(character)}`, {
        responseType: 'arraybuffer',
        validateStatus: status => status === 200,
        timeout: 20000, 
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*' 
        }
      })

      const contentType = response.headers['content-type']
      if (!/^image\/(jpe?g|png|webp|gif)$/i.test(contentType)) {
        return e.reply('API返回了无法处理的文件格式')
      }

      const ext = contentType.split('/')[1] || 'jpg'
      const filename = `${Date.now()}_${character}.${ext}`
      const filePath = path.join(this.uploadDir, filename)


      await new Promise((resolve, reject) => {
        fs.writeFile(filePath, response.data, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })


      let retry = 3
      while (retry-- > 0) {
        try {
          await e.reply([segment.image(filePath)])
          break
        } catch (sendErr) {
          if (retry === 0) throw sendErr
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

   
      setTimeout(() => {
        fs.unlink(filePath, (err) => {
          if (err) console.warn('[写真图] 文件删除失败:', err.message)
        })
      }, 5000)
      
    } catch (err) {
      console.error('[写真图功能] 错误:', err)
      
      let errorMsg = '服务暂时不可用'
      if (err.code === 'ENOENT') {
        errorMsg = '配置文件不存在'
      } else if (err.name === 'YAMLException') {
        errorMsg = '配置文件格式错误'
      } else if (err.response) {
        errorMsg = `没有该角色的图片~ (${err.response.status})`
      } else if (err.code === 'ECONNABORTED') {
        errorMsg = '请求超时'
      } else if (err.code === 'ETIMEDOUT') {
        errorMsg = '连接超时'
      }
      
      e.reply(`[写真图失败] ${errorMsg}`)
    }
    return true
  }
}