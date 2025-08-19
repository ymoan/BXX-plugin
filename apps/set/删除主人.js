import plugin from '../../../../lib/plugins/plugin.js'
import fs from 'fs'
import path from 'path'
import yaml from 'yaml'

export class delMaster extends plugin {
  constructor() {
    super({
      name: '[BXX-plugin] 删除主人',
      dsc: '快捷删除主人',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: '^#删除主人\\s*(\\S+):(\\S+)$',
          fnc: 'delMaster'
        }
      ]
    })
    this.configPath = path.join(process.cwd(), 'config/config/other.yaml')
  }

  async delMaster(e) {
    // 验证主人权限
    if (!(await this.isMaster(e.user_id))) {
      await e.reply('只有主人可以执行该命令')
      return true
    }

    const match = e.msg.match(/^#删除主人\s*(\S+):(\S+)$/)
    if (!match) {
      await e.reply('失败：删除失败！您的命令格式有误！')
      return true
    }

    const adminQQ = match[1].trim()
    const botQQ = match[2].trim()

    if (!this.isValidQQ(adminQQ) || !this.isValidQQ(botQQ)) {
      await e.reply('失败：删除失败！您提供的主人QQ或机器人QQ有误！')
      return true
    }

    try {
      await e.reply('验证成功，正在执行删除...')
      const result = await this.removeMasterConfig(adminQQ, botQQ)
      if (result) {
        await e.reply('成功：删除成功！')
      } else {
        await e.reply('失败：未找到匹配的主人条目！')
      }
    } catch (err) {
      console.error('删除主人失败:', err)
      await e.reply('失败：删除失败！配置文件写入错误！')
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


  async removeMasterConfig(adminQQ, botQQ) {
    const config = await this.readConfig()
    let found = false
    

    if (config.masterQQ) {
      const index = config.masterQQ.indexOf(adminQQ)
      if (index !== -1) {
        config.masterQQ.splice(index, 1)
        found = true
      }
    }
    

    if (config.master) {
      const newMaster = []
      const targetEntry = `${botQQ}:${adminQQ}`
      
      for (const item of config.master) {

        if (item.startsWith(`${botQQ}:${adminQQ}:`) || item === targetEntry) {
          found = true
          continue
        }
        newMaster.push(item)
      }
      

      if (newMaster.length !== config.master.length) {
        config.master = newMaster
      }
    }
    

    if (!found) return false
    

    const yamlString = yaml.stringify(config)
    await fs.promises.writeFile(this.configPath, yamlString, 'utf8')
    return true
  }
}