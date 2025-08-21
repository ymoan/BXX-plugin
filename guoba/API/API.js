import { configPaths } from '../configPaths.js'

export const apiSchemas = [
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
    }
]

export function getApiData(readYamlConfig) {
    return {
        TPAPI: readYamlConfig(configPaths.tpapi, 'TPAPI', ""),
        WZXXAPI: readYamlConfig(configPaths.websiteApi, 'WZXXAPI', ""),
        DKSMAPI: readYamlConfig(configPaths.websiteApi, 'DKSMAPI', ""),
        YMCXAPI: readYamlConfig(configPaths.websiteApi, 'YMCXAPI', ""),
        RWMAPI: readYamlConfig(configPaths.websiteApi, 'RWMAPI', ""),
        ICPAPI: readYamlConfig(configPaths.websiteApi, 'ICPAPI', ""),
        ZHJXAPI: readYamlConfig(configPaths.zhjxApi, 'ZHJXAPI', ""),
        YXAPI: readYamlConfig(configPaths.yxApi, 'YXAPI', "")
    }
}

export function setApiData(configData, writeYamlConfig) {
    return [
        writeYamlConfig(configPaths.tpapi, 'TPAPI', configData.TPAPI),
        writeYamlConfig(configPaths.websiteApi, 'WZXXAPI', configData.WZXXAPI),
        writeYamlConfig(configPaths.websiteApi, 'DKSMAPI', configData.DKSMAPI),
        writeYamlConfig(configPaths.websiteApi, 'YMCXAPI', configData.YMCXAPI),
        writeYamlConfig(configPaths.websiteApi, 'RWMAPI', configData.RWMAPI),
        writeYamlConfig(configPaths.websiteApi, 'ICPAPI', configData.ICPAPI),
        writeYamlConfig(configPaths.zhjxApi, 'ZHJXAPI', configData.ZHJXAPI),
        writeYamlConfig(configPaths.yxApi, 'YXAPI', configData.YXAPI)
    ].every(Boolean)
}