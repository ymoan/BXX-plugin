import { configPaths } from '../configPaths.js'

export const smtpSchemas = [
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
]

export function getSmtpData(readYamlConfig) {
    return {
        smtp: readYamlConfig(configPaths.smtp, 'smtp', ""),
        smtp_user: readYamlConfig(configPaths.smtp, 'smtp_user', ""),
        smtp_password: readYamlConfig(configPaths.smtp, 'smtp_password', ""),
        smtp_port: readYamlConfig(configPaths.smtp, 'smtp_port', 465),
        webname: readYamlConfig(configPaths.smtp, 'webname', "")
    }
}

export function setSmtpData(configData, writeYamlConfig) {
    return [
        writeYamlConfig(configPaths.smtp, 'smtp', configData.smtp),
        writeYamlConfig(configPaths.smtp, 'smtp_user', configData.smtp_user),
        writeYamlConfig(configPaths.smtp, 'smtp_password', configData.smtp_password),
        writeYamlConfig(configPaths.smtp, 'smtp_port', configData.smtp_port),
        writeYamlConfig(configPaths.smtp, 'webname', configData.webname)
    ].every(Boolean)
}