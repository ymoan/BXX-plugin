import plugin from '../../../../lib/plugins/plugin.js';
import { exec, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const profilePath = path.join(process.cwd(), 'plugins', 'miao-plugin', 'resources', 'profile');
const repoUrl = 'https://gitcode.com/ymoan/normal-character';
const repoName = 'normal-character';
const repoPath = path.join(profilePath, repoName);

export class ImageUpdate extends plugin {
    constructor() {
        super({
            name: '不羡仙图像更新',
            dsc: '更新不羡仙角色图片资源',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: /^#*(不羡仙|BXX)(图像|图片)(强制|強制)?更新$/i,
                    fnc: 'updateImage'
                }
            ]
        });
    }

    async checkPermission() {
        if (!this.e.isMaster) {
            await this.e.reply("暂无权限，只有主人才能操作");
            return false;
        }
        return true;
    }

    checkMiaoPlugin() {
        const miaoPluginPath = path.join(process.cwd(), 'plugins', 'miao-plugin');
        if (!fs.existsSync(miaoPluginPath)) return false;

        if (!fs.existsSync(profilePath)) {
            try {
                fs.mkdirSync(profilePath, { recursive: true });
                console.log(`已自动创建profile目录：${profilePath}`);
            } catch (err) {
                console.error('创建profile目录失败:', err);
                return false;
            }
        }
        return true;
    }

    checkGitInstalled() {
        try {
            execSync('git --version', { stdio: 'ignore' });
            return true;
        } catch (err) {
            return false;
        }
    }

    async executeGitCommand(command, cwd, options = {}) {
        const { isClone = false, isPull = false } = options;
        
        return new Promise((resolve) => {
            let outputData = '';
            
            const process = exec(command, { cwd });

            process.stdout.on('data', (data) => {
                outputData += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                outputData += data.toString();
                console.log(`git输出: ${data.toString().trim()}`);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    let fileCount = 0;
                    
                    if (isPull) {
                        const changeMatch = outputData.match(/(\d+)\s+files?\s+changed/);
                        if (changeMatch) {
                            fileCount = parseInt(changeMatch[1]);
                        }
                        
                        if (fileCount === 0) {
                            const insertMatch = outputData.match(/(\d+)\s+insertions?/);
                            const deleteMatch = outputData.match(/(\d+)\s+deletions?/);
                            if (insertMatch || deleteMatch) {
                                fileCount = 1;
                            }
                        }
                    } else if (isClone) {
                        try {
                            if (fs.existsSync(repoPath)) {
                                fileCount = this.countFiles(repoPath);
                            }
                        } catch (err) {
                            console.error('统计文件数量失败:', err);
                        }
                    }
                    
                    resolve({
                        success: true,
                        message: '操作成功',
                        fileCount: fileCount,
                        output: outputData
                    });
                } else {
                    resolve({
                        success: false,
                        message: `git命令执行失败（退出码：${code}）`,
                        fileCount: 0,
                        output: outputData
                    });
                }
            });

            process.on('error', (err) => {
                resolve({
                    success: false,
                    message: `执行git命令出错：${err.message}`,
                    fileCount: 0,
                    output: outputData
                });
            });
        });
    }

    countFiles(dir) {
        let count = 0;
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    if (file === '.git') continue;
                    count += this.countFiles(filePath);
                } else {
                    count++;
                }
            }
        } catch (err) {
            console.error('统计文件失败:', err);
        }
        return count;
    }

    async pullOrCloneRepo(force = false) {
        if (!this.checkGitInstalled()) {
            return { success: false, message: '未安装git', fileCount: 0 };
        }

        try {
            if (fs.existsSync(repoPath)) {
                if (force) {
                    await this.e.reply('检测到已有仓库，执行强制更新（重置本地修改）...');
                    const resetResult = await this.executeGitCommand('git reset --hard HEAD', repoPath);
                    if (!resetResult.success) return resetResult;
                    
                    await this.executeGitCommand('git clean -fd', repoPath);
                }
                await this.e.reply('开始拉取最新仓库内容...');
                return this.executeGitCommand('git pull --stat', repoPath, { isPull: true });
            } else {
                await this.e.reply('首次安装，开始克隆仓库（可能需要几秒）...');
                return this.executeGitCommand(`git clone ${repoUrl} ${repoName}`, profilePath, { isClone: true });
            }
        } catch (err) {
            return { success: false, message: `仓库操作出错：${err.message}`, fileCount: 0 };
        }
    }

    analyzeErrorReason(message) {
        if (message.includes('未安装git')) return '没有安装git（需先安装git工具）';
        if (message.includes('timed out') || message.includes('ETIMEDOUT') || message.includes('超时')) return '网络连接超时（检查网络或稍后重试）';
        if (message.includes('not found') || message.includes('404') || message.includes('不存在')) return '仓库不存在或已被删除（确认仓库地址是否正确）';
        if (message.includes('no such file or directory') || message.includes('没有这个目录')) return '本地目录不存在（可能miao-plugin未正确安装）';
        if (message.includes('permission denied') || message.includes('权限被拒绝')) return '文件权限不足（需赋予Yunzai目录操作权限）';
        if (message.includes('could not resolve host') || message.includes('无法解析主机')) return 'DNS解析失败（检查网络DNS设置）';
        if (message.includes('Authentication failed')) return '身份验证失败（仓库可能是私有库，需配置git凭证）';
        if (message.includes('out of memory') || message.includes('磁盘空间不足')) return '磁盘空间不足（清理磁盘后重试）';
        if (message.includes('conflict') || message.includes('冲突')) return '文件冲突（使用「#不羡仙图像强制更新」重置）';
        if (message.includes('refusing to merge unrelated histories')) return '历史记录不兼容（使用强制更新可解决）';
        if (message.includes('network error') || message.includes('网络错误')) return '网络连接中断（检查网络稳定性）';
        return message;
    }

    async updateImage() {
        const hasPermission = await this.checkPermission();
        if (!hasPermission) return true;

        if (!this.checkMiaoPlugin()) {
            await this.e.reply('需要先安装miao-plugin才能使用此功能，请先安装miao-plugin后重试！');
            return true;
        }

        await this.e.reply('开始尝试更新，请耐心等待~（大文件可能需要几十秒）');
        const isForce = this.e.msg.includes('强制') || this.e.msg.includes('強制');

        const result = await this.pullOrCloneRepo(isForce);

        if (result.success) {
            if (result.fileCount > 0) {
                const isFirstInstall = !fs.existsSync(repoPath) ? false : (fs.readdirSync(repoPath).length === 0);
                const firstTip = isFirstInstall 
                    ? `图片加量包首次安装成功~共下载了${result.fileCount}个图片/文件！` 
                    : `图片加量包更新成功~报告主人，此次更新了${result.fileCount}个图片/文件~`;
                
                await this.e.reply(firstTip);
                await this.e.reply('角色图片加量包安装/更新成功！后续可通过 #不羡仙图像更新 命令再次更新');
            } else {
                await this.e.reply('已经是最新版本了，没有需要更新的文件~');
            }
        } else {
            const reason = this.analyzeErrorReason(result.message);
            const tip = fs.existsSync(repoPath) 
                ? `更新失败！【${reason}】\n建议：1.检查网络 2.使用「#不羡仙图像强制更新」重试` 
                : `角色图片加量包安装失败！原因：【${reason}】`;
            await this.e.reply(tip);
            
            console.error('Git操作失败详情:', result.output);
        }

        return true;
    }
}
