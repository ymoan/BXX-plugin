import { adminSchemas, getAdminData, setAdminData } from './admin/admin.js'
import { apiSchemas, getApiData, setApiData } from './API/API.js'
import { keySchemas, getKeyData, setKeyData } from './KEY/KEY.js'
import { cookieSchemas, getCookieData, setCookieData } from './Cookie/Cookie.js'
import { smtpSchemas, getSmtpData, setSmtpData } from './smtp/smtp.js'

export const allSchemas = [
    ...adminSchemas,
    ...apiSchemas,
    ...keySchemas,
    ...cookieSchemas,
    ...smtpSchemas
]

export function getAllData(readYamlConfig) {
    return {
        ...getAdminData(readYamlConfig),
        ...getApiData(readYamlConfig),
        ...getKeyData(readYamlConfig),
        ...getCookieData(readYamlConfig),
        ...getSmtpData(readYamlConfig)
    }
}

export function setAllData(configData, writeYamlConfig) {
    return [
        setAdminData(configData, writeYamlConfig),
        setApiData(configData, writeYamlConfig),
        setKeyData(configData, writeYamlConfig),
        setCookieData(configData, writeYamlConfig),
        setSmtpData(configData, writeYamlConfig)
    ].every(Boolean)
}