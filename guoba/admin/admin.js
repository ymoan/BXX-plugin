import { configPaths } from '../configPaths.js'

export const adminSchemas = [
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
    }
]

export function getAdminData(readYamlConfig) {
    return {
        WZXXALL: readYamlConfig(configPaths.admin, 'WZXXALL', true),
        DKSMALL: readYamlConfig(configPaths.admin, 'DKSMALL', false),
        WSYMALL: readYamlConfig(configPaths.admin, 'WSYMALL', false),
        RWMALL: readYamlConfig(configPaths.admin, 'RWMALL', true),
        ICPALL: readYamlConfig(configPaths.admin, 'ICPALL', true),
        DYJXALL: readYamlConfig(configPaths.admin, 'DYJXALL', true),
        ZHJXALL: readYamlConfig(configPaths.admin, 'ZHJXALL', true),
        YXFSALL: readYamlConfig(configPaths.admin, 'YXFSALL', false)
    }
}

export function setAdminData(configData, writeYamlConfig) {
    return [
        writeYamlConfig(configPaths.admin, 'WZXXALL', configData.WZXXALL),
        writeYamlConfig(configPaths.admin, 'DKSMALL', configData.DKSMALL),
        writeYamlConfig(configPaths.admin, 'WSYMALL', configData.WSYMALL),
        writeYamlConfig(configPaths.admin, 'RWMALL', configData.RWMALL),
        writeYamlConfig(configPaths.admin, 'ICPALL', configData.ICPALL),
        writeYamlConfig(configPaths.admin, 'DYJXALL', configData.DYJXALL),
        writeYamlConfig(configPaths.admin, 'ZHJXALL', configData.ZHJXALL),
        writeYamlConfig(configPaths.admin, 'YXFSALL', configData.YXFSALL)
    ].every(Boolean)
}