import { configPaths } from '../configPaths.js'

export const keySchemas = [
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
    }
]

export function getKeyData(readYamlConfig) {
    return {
        WZXXKEY: readYamlConfig(configPaths.websiteKey, 'WZXXKEY', ""),
        DKSMKEY: readYamlConfig(configPaths.websiteKey, 'DKSMKEY', ""),
        YMCXKEY: readYamlConfig(configPaths.websiteKey, 'YMCXKEY', ""),
        RWMKEY: readYamlConfig(configPaths.websiteKey, 'RWMKEY', ""),
        ICPKEY: readYamlConfig(configPaths.websiteKey, 'ICPKEY', ""),
        ZHJXKEY: readYamlConfig(configPaths.zhjxKey, 'ZHJXKEY', ""),
        YXKEY: readYamlConfig(configPaths.yxKey, 'YXKEY', "")
    }
}

export function setKeyData(configData, writeYamlConfig) {
    return [
        writeYamlConfig(configPaths.websiteKey, 'WZXXKEY', configData.WZXXKEY),
        writeYamlConfig(configPaths.websiteKey, 'DKSMKEY', configData.DKSMKEY),
        writeYamlConfig(configPaths.websiteKey, 'YMCXKEY', configData.YMCXKEY),
        writeYamlConfig(configPaths.websiteKey, 'RWMKEY', configData.RWMKEY),
        writeYamlConfig(configPaths.websiteKey, 'ICPKEY', configData.ICPKEY),
        writeYamlConfig(configPaths.zhjxKey, 'ZHJXKEY', configData.ZHJXKEY),
        writeYamlConfig(configPaths.yxKey, 'YXKEY', configData.YXKEY)
    ].every(Boolean)
}