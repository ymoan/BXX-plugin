import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import lodash from 'lodash'

const configDir = path.resolve('./plugins/BXX-plugin/')
const lftckPath = path.join(configDir, 'data/Cookie/LFTCK.yaml')
const tpapiPath = path.join(configDir, 'data/API/TPAPI.yaml')
const adminPath = path.join(configDir, 'config/config/admin.yaml')
const websiteApiPath = path.join(configDir, 'data/API/website.yaml')
const websiteKeyPath = path.join(configDir, 'data/KEY/website.yaml')
const zhjxApiPath = path.join(configDir, 'data/API/ZHJXAPI.yaml')
const zhjxKeyPath = path.join(configDir, 'data/KEY/ZHJXKEY.yaml')
const yxApiPath = path.join(configDir, 'data/API/YXAPI.yaml')
const yxKeyPath = path.join(configDir, 'data/KEY/YXKEY.yaml')
const smtpPath = path.join(configDir, 'config/config/smtp.yaml')

function readYamlConfig(filePath, key, defaultValue = "") {
    try {
        if (!fs.existsSync(filePath)) return defaultValue
        const stats = fs.statSync(filePath)
        if (stats.size === 0) return defaultValue
        const content = fs.readFileSync(filePath, 'utf8')
        let parsed = {}
        try {
            parsed = yaml.parse(content) || {}
        } catch (parseError) {
            const keyValueMatch = content.match(new RegExp(`${key}:\\s*(.*?)(\\s*#|\\s*$)`))
            if (keyValueMatch && keyValueMatch[1]) {
                const rawValue = keyValueMatch[1].trim()
                if (rawValue.startsWith('"') && rawValue.endsWith('"')) return rawValue.slice(1, -1)
                else if (rawValue === 'true' || rawValue === 'false') return rawValue === 'true'
                else if (!isNaN(rawValue)) return Number(rawValue)
                else return rawValue
            }
            return defaultValue
        }
        if (parsed[key] !== undefined && parsed[key] !== null) return parsed[key]
        const keys = Object.keys(parsed)
        if (keys.length > 0) return parsed[keys[0]]
        const lines = content.split('\n')
        for (const line of lines) {
            if (line.trim().startsWith(`${key}:`)) {
                const parts = line.split(':')
                if (parts.length > 1) {
                    let value = parts.slice(1).join(':').trim()
                    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
                    return value
                }
            }
        }
        return defaultValue
    } catch (e) {
        return defaultValue
    }
}

function writeYamlConfig(filePath, key, value, removeComments = false) {
    try {
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        let lines = []
        let found = false
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8')
            lines = content.split('\n')
        }
        const newLines = []
        for (const line of lines) {
            if (line.trim().startsWith(`${key}:`)) {
                const indent = line.match(/^\s*/)[0] || ''
                const comment = !removeComments && line.includes('#') ? line.split('#')[1] : null
                const formattedValue = typeof value === 'string' ? `"${value}"` : value
                let newLine = `${indent}${key}: ${formattedValue}`
                if (comment) newLine += ` #${comment}`
                newLines.push(newLine)
                found = true
            } else {
                newLines.push(line)
            }
        }
        if (!found) {
            const formattedValue = typeof value === 'string' ? `"${value}"` : value
            newLines.push(`${key}: ${formattedValue}`)
        }
        fs.writeFileSync(filePath, newLines.join('\n'))
        return true
    } catch (e) {
        return false
    }
}

export function supportGuoba() {
    return {
        pluginInfo: {
            name: 'BXX-plugin',
            title: '不羡仙插件',
            author: '@不羡仙',
            authorLink: 'https://gitcode.com/ymoan/',
            link: 'https://gitcode.com/ymoan/BXX-plugin',
            isV3: true,
            isV2: false,
            description: 'Yunzai论坛：https://yunz.cc/——交流群：872488071——所有功能仅供娱乐请勿违规使用',
            showInMenu: 'auto',
            icon: 'mdi:rocket-launch',
            iconColor: '#00a2ffff'
        },
        configInfo: {
            schemas: [
                {
                    label: '权限配置',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    field: 'WZXXALL',
                    label: '网站信息所有人可用',
                    component: 'Switch',
                    componentProps: { checkedChildren: '开启', unCheckedChildren: '关闭', style: { width: 'fit-content' } }
                },
                {
                    field: 'DKSMALL',
                    label: '端口扫描所有人可用',
                    component: 'Switch',
                    componentProps: { checkedChildren: '开启', unCheckedChildren: '关闭', style: { width: 'fit-content' } }
                },
                {
                    field: 'WSYMALL',
                    label: '域名查询所有人可用',
                    component: 'Switch',
                    componentProps: { checkedChildren: '开启', unCheckedChildren: '关闭', style: { width: 'fit-content' } }
                },
                {
                    field: 'RWMALL',
                    label: '二维码生成所有人可用',
                    component: 'Switch',
                    componentProps: { checkedChildren: '开启', unCheckedChildren: '关闭', style: { width: 'fit-content' } }
                },
                {
                    field: 'ICPALL',
                    label: '备案信息所有人可用',
                    component: 'Switch',
                    componentProps: { checkedChildren: '开启', unCheckedChildren: '关闭', style: { width: 'fit-content' } }
                },
                {
                    field: 'DYJXALL',
                    label: '抖音解析所有人可用',
                    component: 'Switch',
                    componentProps: { checkedChildren: '开启', unCheckedChildren: '关闭', style: { width: 'fit-content' } }
                },
                {
                    field: 'ZHJXALL',
                    label: '综合解析所有人可用',
                    component: 'Switch',
                    componentProps: { checkedChildren: '开启', unCheckedChildren: '关闭', style: { width: 'fit-content' } }
                },
                {
                    field: 'YXFSALL',
                    label: '发送邮件所有人可用',
                    component: 'Switch',
                    componentProps: { checkedChildren: '开启', unCheckedChildren: '关闭', style: { width: 'fit-content' } }
                },
                
                {
                    label: 'API 配置',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    field: 'TPAPI',
                    label: '图片API 配置',
                    component: 'Input',
                    required: false,
                    componentProps: { placeholder: '输入API地址' }
                },
                {
                    field: 'WZXXAPI',
                    label: '网站信息API',
                    component: 'Input',
                    required: false,
                    componentProps: { placeholder: '输入API地址' }
                },
                {
                    field: 'DKSMAPI',
                    label: '端口扫描API',
                    component: 'Input',
                    required: false,
                    componentProps: { placeholder: '输入API地址' }
                },
                {
                    field: 'YMCXAPI',
                    label: '域名查询API',
                    component: 'Input',
                    required: false,
                    componentProps: { placeholder: '输入API地址' }
                },
                {
                    field: 'RWMAPI',
                    label: '二维码生成API',
                    component: 'Input',
                    required: false,
                    componentProps: { placeholder: '输入API地址' }
                },
                {
                    field: 'ICPAPI',
                    label: '备案查询API',
                    component: 'Input',
                    required: false,
                    componentProps: { placeholder: '输入API地址' }
                },
                {
                    field: 'ZHJXAPI',
                    label: '综合解析API',
                    component: 'Input',
                    required: false,
                    componentProps: { placeholder: '输入API地址' }
                },
                {
                    field: 'YXAPI',
                    label: '发送邮件API',
                    component: 'Input',
                    required: false,
                    componentProps: { placeholder: '输入API地址' }
                },
                
                {
                    label: 'KEY 配置',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    field: 'WZXXKEY',
                    label: '网站信息KEY',
                    component: 'InputPassword',
                    required: false,
                    componentProps: { placeholder: '输入KEY值', showPassword: true }
                },
                {
                    field: 'DKSMKEY',
                    label: '端口扫描KEY',
                    component: 'InputPassword',
                    required: false,
                    componentProps: { placeholder: '输入KEY值', showPassword: true }
                },
                {
                    field: 'YMCXKEY',
                    label: '域名查询KEY',
                    component: 'InputPassword',
                    required: false,
                    componentProps: { placeholder: '输入KEY值', showPassword: true }
                },
                {
                    field: 'RWMKEY',
                    label: '二维码生成KEY',
                    component: 'InputPassword',
                    required: false,
                    componentProps: { placeholder: '输入KEY值', showPassword: true }
                },
                {
                    field: 'ICPKEY',
                    label: '备案查询KEY',
                    component: 'InputPassword',
                    required: false,
                    componentProps: { placeholder: '输入KEY值', showPassword: true }
                },
                {
                    field: 'ZHJXKEY',
                    label: '综合解析KEY',
                    component: 'InputPassword',
                    required: false,
                    componentProps: { placeholder: '输入KEY值', showPassword: true }
                },
                {
                    field: 'YXKEY',
                    label: '发送邮件KEY',
                    component: 'InputPassword',
                    required: false,
                    componentProps: { placeholder: '输入KEY值', showPassword: true }
                },
                
                {
                    label: 'Cookie 配置',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    field: 'LFTCK',
                    label: '老福特Cookie',
                    component: 'InputPassword',
                    required: false,
                    componentProps: { placeholder: '在此输入Cookie值', showPassword: true }
                },
                
                {
                    label: '邮箱配置',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    field: 'smtp',
                    label: 'SMTP服务器地址',
                    component: 'Input',
                    required: false,
                    componentProps: { placeholder: '例如: smtp.qq.com' }
                },
                {
                    field: 'smtp_user',
                    label: '邮箱账号',
                    component: 'Input',
                    required: false,
                    componentProps: { placeholder: '输入发件邮箱账号' }
                },
                {
                    field: 'smtp_password',
                    label: '邮箱密钥',
                    component: 'InputPassword',
                    required: false,
                    componentProps: { placeholder: '输入邮箱授权码/密码', showPassword: true }
                },
                {
                    field: 'smtp_port',
                    label: '发件端口',
                    component: 'InputNumber',
                    required: false,
                    componentProps: { placeholder: '例如: 465', min: 1, max: 65535 }
                },
                {
                    field: 'webname',
                    label: '发件名称',
                    component: 'Input',
                    required: false,
                    componentProps: { placeholder: '显示的发件人名称' }
                }
            ],
            getConfigData() {
                return {
                    WZXXALL: readYamlConfig(adminPath, 'WZXXALL', true),
                    DKSMALL: readYamlConfig(adminPath, 'DKSMALL', false),
                    WSYMALL: readYamlConfig(adminPath, 'WSYMALL', false),
                    RWMALL: readYamlConfig(adminPath, 'RWMALL', true),
                    ICPALL: readYamlConfig(adminPath, 'ICPALL', true),
                    DYJXALL: readYamlConfig(adminPath, 'DYJXALL', true),
                    ZHJXALL: readYamlConfig(adminPath, 'ZHJXALL', true),
                    YXFSALL: readYamlConfig(adminPath, 'YXFSALL', false),
                    TPAPI: readYamlConfig(tpapiPath, 'TPAPI', ""),
                    WZXXAPI: readYamlConfig(websiteApiPath, 'WZXXAPI', ""),
                    DKSMAPI: readYamlConfig(websiteApiPath, 'DKSMAPI', ""),
                    YMCXAPI: readYamlConfig(websiteApiPath, 'YMCXAPI', ""),
                    RWMAPI: readYamlConfig(websiteApiPath, 'RWMAPI', ""),
                    ICPAPI: readYamlConfig(websiteApiPath, 'ICPAPI', ""),
                    ZHJXAPI: readYamlConfig(zhjxApiPath, 'ZHJXAPI', ""),
                    YXAPI: readYamlConfig(yxApiPath, 'YXAPI', ""),
                    WZXXKEY: readYamlConfig(websiteKeyPath, 'WZXXKEY', ""),
                    DKSMKEY: readYamlConfig(websiteKeyPath, 'DKSMKEY', ""),
                    YMCXKEY: readYamlConfig(websiteKeyPath, 'YMCXKEY', ""),
                    RWMKEY: readYamlConfig(websiteKeyPath, 'RWMKEY', ""),
                    ICPKEY: readYamlConfig(websiteKeyPath, 'ICPKEY', ""),
                    ZHJXKEY: readYamlConfig(zhjxKeyPath, 'ZHJXKEY', ""),
                    YXKEY: readYamlConfig(yxKeyPath, 'YXKEY', ""),
                    LFTCK: readYamlConfig(lftckPath, 'LFTCK', ""),
                    smtp: readYamlConfig(smtpPath, 'smtp', ""),
                    smtp_user: readYamlConfig(smtpPath, 'smtp_user', ""),
                    smtp_password: readYamlConfig(smtpPath, 'smtp_password', ""),
                    smtp_port: readYamlConfig(smtpPath, 'smtp_port', 465),
                    webname: readYamlConfig(smtpPath, 'webname', "")
                }
            },
            setConfigData(configData) {
                const results = [
                    writeYamlConfig(adminPath, 'WZXXALL', configData.WZXXALL),
                    writeYamlConfig(adminPath, 'DKSMALL', configData.DKSMALL),
                    writeYamlConfig(adminPath, 'WSYMALL', configData.WSYMALL),
                    writeYamlConfig(adminPath, 'RWMALL', configData.RWMALL),
                    writeYamlConfig(adminPath, 'ICPALL', configData.ICPALL),
                    writeYamlConfig(adminPath, 'DYJXALL', configData.DYJXALL),
                    writeYamlConfig(adminPath, 'ZHJXALL', configData.ZHJXALL),
                    writeYamlConfig(adminPath, 'YXFSALL', configData.YXFSALL),
                    writeYamlConfig(tpapiPath, 'TPAPI', configData.TPAPI),
                    writeYamlConfig(websiteApiPath, 'WZXXAPI', configData.WZXXAPI),
                    writeYamlConfig(websiteApiPath, 'DKSMAPI', configData.DKSMAPI),
                    writeYamlConfig(websiteApiPath, 'YMCXAPI', configData.YMCXAPI),
                    writeYamlConfig(websiteApiPath, 'RWMAPI', configData.RWMAPI),
                    writeYamlConfig(websiteApiPath, 'ICPAPI', configData.ICPAPI),
                    writeYamlConfig(zhjxApiPath, 'ZHJXAPI', configData.ZHJXAPI),
                    writeYamlConfig(yxApiPath, 'YXAPI', configData.YXAPI),
                    writeYamlConfig(websiteKeyPath, 'WZXXKEY', configData.WZXXKEY),
                    writeYamlConfig(websiteKeyPath, 'DKSMKEY', configData.DKSMKEY),
                    writeYamlConfig(websiteKeyPath, 'YMCXKEY', configData.YMCXKEY),
                    writeYamlConfig(websiteKeyPath, 'RWMKEY', configData.RWMKEY),
                    writeYamlConfig(websiteKeyPath, 'ICPKEY', configData.ICPKEY),
                    writeYamlConfig(zhjxKeyPath, 'ZHJXKEY', configData.ZHJXKEY),
                    writeYamlConfig(yxKeyPath, 'YXKEY', configData.YXKEY),
                    writeYamlConfig(lftckPath, 'LFTCK', configData.LFTCK, true),
                    writeYamlConfig(smtpPath, 'smtp', configData.smtp),
                    writeYamlConfig(smtpPath, 'smtp_user', configData.smtp_user),
                    writeYamlConfig(smtpPath, 'smtp_password', configData.smtp_password),
                    writeYamlConfig(smtpPath, 'smtp_port', configData.smtp_port),
                    writeYamlConfig(smtpPath, 'webname', configData.webname)
                ]
                return results.every(Boolean)
            }
        }
    }
}
