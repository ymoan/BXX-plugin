import plugin from '../../../../lib/plugins/plugin.js'
import fs from 'fs'
import path from 'path'
import yaml from 'yaml'

export class delMaster extends plugin {
  constructor() {
    super({
      name: '不羡仙:删除主人',
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
    if (!e.isMaster) {
      await e.reply("暂无权限，只有主人才能操作");
      return true; 
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
