import plugin from '../../../../lib/plugins/plugin.js'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class ImageUpdate extends plugin {
    constructor() {
        super({
            name: '不羡仙图像更新',
            dsc: '不羡仙图像资源安装与更新',
            event: 'message',
            priority: -10,
            rule: [
                {
                    reg: /^#不羡仙图像(强制)?(安装|更新)$/i,
                    fnc: 'imageUpdate'
                }
            ]
        })
        this.repoUrl = 'https://github.com/ymoan/normal-character.git'// 装不上请在https前加“https://ghfast.top/”
        // this.repoUrl = 'https://gitcode.com/ymoan/normal-character.git'国内gitcode源可替换
        this.profilePath = path.join(process.cwd(), 'plugins', 'miao-plugin', 'resources', 'profile')
        this.repoPath = path.join(this.profilePath, 'normal-character')
    }

    async imageUpdate(e) {
        if (!e.isMaster) {
            await e.reply("暂无权限，只有主人才能操作")
            return true
        }

        const isForce = e.msg.includes('强制')
        const isInstall = e.msg.includes('安装')

        if (!fs.existsSync(path.join(process.cwd(), 'plugins', 'miao-plugin'))) {
            await e.reply('需要先安装喵喵才能使用此功能，请先安装miao-plugin后重试')
            return true
        }

        if (!fs.existsSync(this.profilePath)) {
            fs.mkdirSync(this.profilePath, { recursive: true })
        }

        if (isInstall) {
            await e.reply('开始尝试安装不羡仙角色图像资源，请耐心等待~')
            return await this.installImage(e, isForce)
        } else {
            await e.reply('开始尝试更新不羡仙角色图像资源，请耐心等待~')
            return await this.updateImage(e, isForce)
        }
    }

    async installImage(e, isForce) {
        try {
            if (fs.existsSync(this.repoPath)) {
                if (!isForce) {
                    await e.reply('检测到已安装角色图像资源，请使用 #不羡仙图像更新 来更新内容！')
                    return true
                } else {
                    await this.forceRemoveDir(this.repoPath)
                }
            }

            await execAsync(`git clone ${this.repoUrl} "${this.repoPath}"`, { 
                timeout: 1200000 
            })

            if (!fs.existsSync(this.repoPath)) {
                throw new Error('克隆后目录不存在，可能克隆失败')
            }

            const files = fs.readdirSync(this.repoPath)
            if (files.length === 0 || (files.length === 1 && files[0] === '.git')) {
                throw new Error('克隆的仓库为空')
            }

            const fileCount = this.countFiles(this.repoPath)
            await e.reply(`不羡仙角色图像资源安装成功~共下载了${fileCount}个图片！后续可通过 #不羡仙图像更新 命令获取最新内容！`)
            
        } catch (error) {
            await this.handleError(e, error, '安装')
        }
        return true
    }

    async updateImage(e, isForce) {
        try {
            if (!fs.existsSync(this.repoPath)) {
                await e.reply('检测到尚未安装图像资源，请使用 #不羡仙图像安装 安装图像资源')
                return true
            }

            if (isForce) {
                await this.forceRemoveDir(this.repoPath)
                return await this.installImage(e, true)
            }

            const { stdout } = await execAsync('git pull', { 
                cwd: this.repoPath,
                timeout: 1200000 
            })

            if (stdout.includes('Already up to date') || stdout.includes('已经是最新的')) {
                await e.reply('不羡仙角色图像已是最新版，暂无更新内容~')
            } else {
                const changeCount = this.extractChangeCount(stdout)
                await e.reply(`不羡仙角色图片加量包更新成功~报告主人，更新成功，此次更新了${changeCount}个图片/文件~`)
                await e.reply('不羡仙角色图片加量包安装成功！您后续也可以通过 #不羡仙图像更新 命令来更新图像')
            }
            
        } catch (error) {
            if (isForce) {
                await this.handleError(e, error, '强制更新')
            } else {
                await e.reply('更新失败！可能原因：仓库文件冲突。请使用「#不羡仙图像强制更新」重试！')
            }
        }
        return true
    }

    async forceRemoveDir(dirPath) {
        if (fs.existsSync(dirPath)) {
            try {
                if (process.platform === 'win32') {
                    await execAsync(`rmdir /s /q "${dirPath}"`)
                } else {
                    await execAsync(`rm -rf "${dirPath}"`)
                }
            } catch (error) {
                fs.rmSync(dirPath, { recursive: true, force: true })
            }
        }
    }

    async handleError(e, error, operation) {
        let reason = '未知错误'
        
        if (error.message.includes('timeout')) {
            reason = '网络超时'
        } else if (error.message.includes('exists')) {
            reason = '文件已存在'
        } else if (error.message.includes('not found') || error.message.includes('找不到')) {
            reason = '资源不存在'
        } else if (error.message.includes('git')) {
            reason = 'Git操作失败'
        } else if (error.message.includes('空')) {
            reason = '仓库内容为空'
        } else {
            reason = error.message
        }

        await e.reply(`不羡仙图像资源${operation}失败！原因：${reason}`)
        if (operation === '安装' && fs.existsSync(this.repoPath)) {
            try {
                await this.forceRemoveDir(this.repoPath)
            } catch (cleanError) {
                console.error('清理失败目录时出错:', cleanError)
            }
        }
    }

    countFiles(dir) {
        let count = 0
        const files = fs.readdirSync(dir)
        
        for (const file of files) {
            if (file === '.git') continue
            
            const filePath = path.join(dir, file)
            const stat = fs.statSync(filePath)
            
            if (stat.isDirectory()) {
                count += this.countFiles(filePath)
            } else {
                count++
            }
        }
        return count
    }

    extractChangeCount(gitOutput) {
        const changesMatch = gitOutput.match(/(\d+) files? changed/)
        if (changesMatch && changesMatch[1]) {
            return changesMatch[1]
        }
        
        const insertMatch = gitOutput.match(/(\d+) insertion/)
        if (insertMatch && insertMatch[1]) {
            return insertMatch[1]
        }
        return '（反正就是更新了，具体是多少个没统计到）'
    }
}
