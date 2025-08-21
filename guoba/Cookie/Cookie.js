import { configPaths } from '../configPaths.js'

export const cookieSchemas = [
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
    }
]

export function getCookieData(readYamlConfig) {
    return {
        LFTCK: readYamlConfig(configPaths.lftck, 'LFTCK', "")
    }
}

export function setCookieData(configData, writeYamlConfig) {
    return [
        writeYamlConfig(configPaths.lftck, 'LFTCK', configData.LFTCK, true)
    ].every(Boolean)
}