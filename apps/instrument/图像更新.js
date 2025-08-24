import plugin from '../../../../lib/plugins/plugin.js';
import { exec, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const profilePath = path.join(process.cwd(), 'plugins', 'miao-plugin', 'resources', 'profile');
const repoUrl = 'https://gitcode.com/ymoan_bxx/normal-character/';
const repoName = 'normal-character';
const repoPath = path.join(profilePath, repoName);
const branch = 'master';

export class ImageUpdate extends plugin {
    constructor() {
        super({
            name: '不羡仙图像管理',
            dsc: '安装和更新不羡仙角色图片资源',
            event: 'message',
            priority: 100,
            rule: [
                { reg: /^#*(不羡仙|BXX)(图像|图片)安装$/i, fnc: 'installImage' },
                { reg: /^#*(不羡仙|BXX)(图像|图片)(强制|強制)?更新$/i, fnc: 'updateImage' }
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
            let hasWarnings = false;
            const process = exec(command, { cwd });

            process.stdout.on('data', (data) => {
                outputData += data.toString();
                if (data.toString().includes('warning:')) hasWarnings = true;
            });
            
            process.stderr.on('data', (data) => {
                outputData += data.toString();
                console.log(`git输出: ${data.toString().trim()}`);
                if (data.toString().includes('warning:')) hasWarnings = true;
            });

            process.on('close', (code) => {
                const hasCriticalWarning = outputData.includes('remote HEAD refers to nonexistent ref');
                if (code === 0 && !hasCriticalWarning) {
                    let fileCount = 0;
                    if (isPull) {
                        const changeMatch = outputData.match(/(\d+)\s+files?\s+changed/);
                        if (changeMatch) fileCount = parseInt(changeMatch[1]);
                        if (fileCount === 0) {
                            const insertMatch = outputData.match(/(\d+)\s+insertions?/);
                            const deleteMatch = outputData.match(/(\d+)\s+deletions?/);
                            if (insertMatch || deleteMatch) fileCount = 1;
                        }
                    } else if (isClone) {
                        try {
                            if (fs.existsSync(repoPath)) fileCount = this.countFiles(repoPath);
                        } catch (err) { console.error('统计文件数量失败:', err); }
                    }
                    resolve({ success: true, hasWarnings, message: '操作成功', fileCount, output: outputData });
                } else {
                    resolve({
                        success: false,
                        hasWarnings,
                        message: hasCriticalWarning ? '远程仓库引用错误，无法检出文件' : `git命令执行失败（退出码：${code}）`,
                        fileCount: 0,
                        output: outputData
                    });
                }
            });

            process.on('error', (err) => {
                resolve({ success: false, hasWarnings: false, message: `执行git命令出错：${err.message}`, fileCount: 0, output: outputData });
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
                } else count++;
            }
        } catch (err) { console.error('统计文件失败:', err); }
        return count;
    }

    async cloneRepo() {
        if (!this.checkGitInstalled()) return { success: false, message: '未安装git', fileCount: 0 };
        try {
            if (fs.existsSync(repoPath)) return { success: false, message: '仓库已存在，无需重新安装，可使用更新命令', fileCount: 0 };
            await this.e.reply(`首次安装，开始克隆${branch}分支仓库（可能需要几秒）...`);
            const result = await this.executeGitCommand(
                `git clone -b ${branch} ${repoUrl} ${repoName}`,
                profilePath,
                { isClone: true }
            );
            if (result.success && result.fileCount === 0) {
                return { success: false, message: '克隆成功但未获取到任何文件，可能仓库为空或引用错误', fileCount: 0, output: result.output };
            }
            return result;
        } catch (err) {
            return { success: false, message: `克隆仓库出错：${err.message}`, fileCount: 0 };
        }
    }

    async pullRepo(force = false) {
        if (!this.checkGitInstalled()) return { success: false, message: '未安装git', fileCount: 0 };
        try {
            if (!fs.existsSync(repoPath)) return { success: false, message: '仓库不存在，请先使用安装命令', fileCount: 0 };
            if (force) {
                await this.e.reply(`检测到已有仓库，执行强制更新${branch}分支（重置本地修改）...`);
                const resetResult = await this.executeGitCommand(`git reset --hard origin/${branch}`, repoPath);
                if (!resetResult.success) return resetResult;
                await this.executeGitCommand('git clean -fd', repoPath);
            }
            await this.e.reply(`开始拉取${branch}分支最新内容...`);
            return this.executeGitCommand(`git pull origin ${branch} --stat`, repoPath, { isPull: true });
        } catch (err) {
            return { success: false, message: `拉取更新出错：${err.message}`, fileCount: 0 };
        }
    }

    analyzeErrorReason(message) {
        if (message.includes('remote HEAD refers to nonexistent ref')) return '仓库引用错误，可能master分支不存在或URL不正确';
        if (message.includes('未安装git')) return '没有安装git（需先安装git工具）';
        if (message.includes('timed out') || message.includes('ETIMEDOUT') || message.includes('超时')) return '网络连接超时（检查网络或稍后重试）';
        if (message.includes('not found') || message.includes('404') || message.includes('不存在')) return '仓库或分支不存在（确认仓库地址和分支是否正确）';
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

    async installImage() {
        const hasPermission = await this.checkPermission();
        if (!hasPermission) return true;
        if (!this.checkMiaoPlugin()) {
            await this.e.reply('需要先安装miao-plugin才能使用此功能，请先安装miao-plugin后重试！');
            return true;
        }
        await this.e.reply('开始尝试安装不羡仙图像资源，请耐心等待~（大文件可能需要几十秒）');
        const result = await this.cloneRepo();
        if (result.success) {
            if (result.fileCount > 0) {
                await this.e.reply(`图片资源安装成功~共下载了${result.fileCount}个图片/文件！`);
                await this.e.reply('后续可通过 #不羡仙图像更新 命令获取最新资源');
            } else {
                await this.e.reply('安装过程完成，但未检测到任何文件，可能仓库为空');
            }
        } else {
            const reason = this.analyzeErrorReason(result.message);
            await this.e.reply(`图像资源安装失败！原因：【${reason}】`);
            console.error('安装失败详情:', result.output);
        }
        return true;
    }

    async updateImage() {
        const hasPermission = await this.checkPermission();
        if (!hasPermission) return true;
        if (!this.checkMiaoPlugin()) {
            await this.e.reply('需要先安装miao-plugin才能使用此功能，请先安装miao-plugin后重试！');
            return true;
        }
        await this.e.reply('开始尝试更新不羡仙图像资源，请耐心等待~（大文件可能需要几十秒）');
        const isForce = this.e.msg.includes('强制') || this.e.msg.includes('強制');
        const result = await this.pullRepo(isForce);
        if (result.success) {
            if (result.fileCount > 0) {
                await this.e.reply(`图片资源更新成功~此次更新了${result.fileCount}个图片/文件~`);
                await this.e.reply('后续可通过 #不羡仙图像更新 命令再次更新');
            } else {
                await this.e.reply('已经是最新版本了，没有需要更新的文件~');
            }
            if (result.hasWarnings) await this.e.reply('注意：更新过程中出现警告信息，建议检查仓库状态');
        } else {
            const reason = this.analyzeErrorReason(result.message);
            const tip = `更新失败！【${reason}】\n${isForce ? '已尝试强制更新仍失败，请检查仓库地址或网络' : '建议使用「#不羡仙图像强制更新」重试'}`;
            await this.e.reply(tip);
            console.error('更新失败详情:', result.output);
        }
        return true;
    }
}
