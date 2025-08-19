import plugin from '../../../../lib/plugins/plugin.js'
import fs from 'fs'
import path from 'path'
import yaml from 'yaml'

export class setMaster extends plugin {
  constructor() {
    super({
      name: '[BXX-plugin] 设置主人',
      dsc: '快捷设置主人',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: '^#设置主人\\s*(\\S+):(\\S+)$',
          fnc: 'setMaster'
        }
      ]
    })
    this.configPath = path.join(process.cwd(), 'config/config/other.yaml')
  }

  async setMaster(e) {
    if (!(await this.isMaster(e.user_id))) {
      await e.reply('只有主人可以执行该命令')
      return true
    }

    const match = e.msg.match(/^#设置主人\s*(\S+):(\S+)$/)
    if (!match) {
      await e.reply('失败：设置失败！您的命令格式有误！')
      return true
    }

    const adminQQ = match[1].trim()
    const botQQ = match[2].trim()

    if (!this.isValidQQ(adminQQ) || !this.isValidQQ(botQQ)) {
      await e.reply('失败：设置失败！您提供的主人QQ或机器人QQ有误！')
      return true
    }

    try {
      await e.reply('验证成功，正在执行设置...')
      await this.updateMasterConfig(adminQQ, botQQ)
      await e.reply('成功：设置成功！')
    } catch (err) {
      console.error('设置主人失败:', err)
      await e.reply('失败：设置失败！配置文件写入错误！')
    }
    return true
  }

  isValidQQ(qq) {
    return /^(\d+|qg_\w+|stdin)$/.test(qq)
  }

  async isMaster(userId) {
    try {
      const config = await this.readConfig()
      const userIdStr = String(userId)
      
      if (config.masterQQ && config.masterQQ.includes(userIdStr)) {
        return true
      }
      
      if (config.master) {
        for (const item of config.master) {
          const parts = item.split(':')
          if (parts.length >= 2 && parts[1] === userIdStr) {
            return true
          }
        }
      }
    } catch (err) {
      console.error('读取配置文件失败:', err)
    }
    return false
  }

  async readConfig() {
    const fileContent = await fs.promises.readFile(this.configPath, 'utf8')
    return yaml.parse(fileContent)
  }

  async updateMasterConfig(adminQQ, botQQ) {
    const config = await this.readConfig()
    
    config.masterQQ = config.masterQQ || []
    config.master = config.master || []
    

    const adminQQStr = String(adminQQ)
    if (!config.masterQQ.includes(adminQQStr)) {
      config.masterQQ.push(adminQQStr)
    }
    

    const newEntry = `${botQQ}:${adminQQ}`
    if (!config.master.includes(newEntry)) {
      config.master.push(newEntry)
    }
    
    const yamlString = yaml.stringify(config)
    await fs.promises.writeFile(this.configPath, yamlString, 'utf8')
  }
}