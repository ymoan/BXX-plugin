import plugin from '../../../../lib/plugins/plugin.js'
import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import { fileURLToPath } from 'url'

export class uninstall extends plugin {
  constructor() {
    super({
      name: '不羡仙:一键卸崽',
      dsc: '一键删除Yunzai框架目录',
      event: 'message',
      priority: 100,
      rule: [
        { reg: '^#一键卸崽$', fnc: 'startUninstall' },
        { reg: '^#卸崽取消$', fnc: 'cancelUninstall' },
        { reg: '^我已知晓该操作风险$', fnc: 'confirmUninstall' }
      ]
    })
    this.configPath = path.join(process.cwd(), 'config/config/other.yaml')
    this.targetPath = path.resolve(fileURLToPath(import.meta.url), '../../../../../')
  }

  static pendingUninstall = new Map()

  getUserId(e) { return e.sender?.user_id || e.user_id }
  isAdmin() {
    if (process.platform !== 'win32') return true
    try {
      const { execSync } = require('child_process')
      execSync('fsutil dirty query %systemdrive%', { stdio: 'ignore' })
      return true
    } catch (err) { return false }
  }

  resolveWinPath(targetPath) {
    if (process.platform === 'win32' && !targetPath.startsWith('\\\\?\\')) {
      return '\\\\?\\' + path.resolve(targetPath).replace(/\\/g, '\\\\')
    }
    return targetPath
  }

  async startUninstall(e) {
    if (!e.isMaster) {
      await e.reply("暂无权限，只有主人才能操作");
      return true;
    }

    const userId = this.getUserId(e)
    if (!this.isAdmin()) e.reply('⚠️ 检测到当前进程无管理员权限，部分文件可能无法删除\n将尝试删除允许的文件和文件夹')
    if (uninstall.pendingUninstall.has(userId)) return e.reply('您已有一个卸崽操作在进行中，请完成确认或取消') && true

    const winPath = this.resolveWinPath(this.targetPath)
    const timeout = setTimeout(() => {
      uninstall.pendingUninstall.delete(userId)
      e.reply('⏱️ 一键卸崽任务已超时（50秒未确认），操作自动结束')
    }, 50000)

    uninstall.pendingUninstall.set(userId, { winPath, timeout })

    await e.reply([
      '⚠️ 警告：您即将执行【#一键卸崽】功能',
      `这将会尝试删除Yunzai框架目录：${this.targetPath} 下的所有文件和文件夹！`,
      '此操作可能导致Yunzai机器人完全无法运行！',
      '无法删除的文件将被保留。',
      '',
      '请发送以下内容进行确认：',
      '【我已知晓该操作风险】',
      '',
      '⏱️ 请在50秒内完成确认，否则操作将自动结束',
      '🚫 如误操作该命令请发送 #卸崽取消 即可取消'
    ].join('\n'))

    return true
  }

  async confirmUninstall(e) {
    const userId = this.getUserId(e)
    const userState = uninstall.pendingUninstall.get(userId)

    if (!userState) return e.reply('您尚未开始卸崽流程，请先发送 #一键卸崽 启动') && false

    clearTimeout(userState.timeout)
    uninstall.pendingUninstall.delete(userId)

    try {
      await e.reply('确认成功，开始执行删除操作...')
      const { deletedCount, failedPaths } = await this.deleteDirectory(userState.winPath)
      if (deletedCount > 0) await e.reply(`✅ 操作完成！已成功删除 ${deletedCount} 个文件/文件夹`)
      else await e.reply('⚠️ 没有删除任何文件，可能所有文件都被保护或已不存在')
      if (failedPaths.length > 0) await e.reply(`❌ 以下 ${failedPaths.length} 个文件/文件夹无法删除（权限不足或被占用）：\n${failedPaths.slice(0, 5).join('\n')}${failedPaths.length > 5 ? '\n...等' : ''}`)
    } catch (err) { await e.reply(`❌ 删除过程中出错: ${err.message}`) }

    return true
  }

  async deleteDirectory(dirPath) {
    let deletedCount = 0
    let failedPaths = []
    const removeReadOnly = (path) => {
      try {
        const stats = fs.statSync(path)
        if (stats.isFile() && (stats.mode & 0o444) === 0o444) {
          fs.chmodSync(path, 0o666)
        }
      } catch (err) {
        console.warn(`无法修改文件属性: ${path}`, err.message)
      }
    }
    const traverseAndDelete = async (currentPath) => {
      try {
        if (!fs.existsSync(currentPath)) return { deleted: 0, failed: [] }
        const files = fs.readdirSync(currentPath)
        for (const file of files) {
          const fullPath = path.join(currentPath, file)
          
          try {
            removeReadOnly(fullPath)
            const stats = fs.statSync(fullPath)
            
            if (stats.isDirectory()) {
              const { deleted, failed } = await traverseAndDelete(fullPath)
              deletedCount += deleted
              failedPaths = [...failedPaths, ...failed]
            } else {
              fs.unlinkSync(fullPath)
              deletedCount++
            }
          } catch (err) {
            console.warn(`无法删除文件/文件夹: ${fullPath}`, err.message)
            failedPaths.push(fullPath)
          }
        }
        try {
          fs.rmdirSync(currentPath)
          deletedCount++
        } catch (err) {
          if (err.code !== 'ENOTEMPTY') {
            console.warn(`无法删除目录: ${currentPath}`, err.message)
            failedPaths.push(currentPath)
          }
        }
      } catch (err) {
        console.warn(`遍历目录失败: ${currentPath}`, err.message)
        failedPaths.push(currentPath)
      }
      return { deleted: deletedCount, failed: failedPaths }
    }
    await traverseAndDelete(dirPath)
    return { deletedCount, failedPaths }
  }

  async cancelUninstall(e) {
    if (!e.isMaster) {
      await e.reply("暂无权限，只有主人才能操作");
      return true;
    }

    const userId = this.getUserId(e)
    const userState = uninstall.pendingUninstall.get(userId)
    if (!userState) return e.reply('当前没有进行中的卸崽操作') && true
    clearTimeout(userState.timeout)
    uninstall.pendingUninstall.delete(userId)
    await e.reply('已成功取消卸崽操作')
    return true
  }
}
