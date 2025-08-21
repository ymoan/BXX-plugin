import path from 'path'

const configDir = path.resolve('./plugins/BXX-plugin/')

export const configPaths = {
    lftck: path.join(configDir, 'data/Cookie/LFTCK.yaml'),
    tpapi: path.join(configDir, 'data/API/TPAPI.yaml'),
    admin: path.join(configDir, 'config/config/admin.yaml'),
    websiteApi: path.join(configDir, 'data/API/website.yaml'),
    websiteKey: path.join(configDir, 'data/KEY/website.yaml'),
    zhjxApi: path.join(configDir, 'data/API/ZHJXAPI.yaml'),
    zhjxKey: path.join(configDir, 'data/KEY/ZHJXKEY.yaml'),
    yxApi: path.join(configDir, 'data/API/YXAPI.yaml'),
    yxKey: path.join(configDir, 'data/KEY/YXKEY.yaml'),
    smtp: path.join(configDir, 'config/config/smtp.yaml')
}