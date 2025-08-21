import fs from 'fs'
import yaml from 'yaml'
import path from 'path'

function needsQuotes(str) {
    return /[\s:#"]/.test(str)
}

function formatValueForYaml(value) {
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false' 
    } else if (typeof value === 'number') {
        return String(value)  
    } else if (typeof value === 'string') {
        return needsQuotes(value) ? `"${value.replace(/"/g, '\\"')}"` : value
    } else {
        return ''
    }
}

export function readYamlConfig(filePath, key, defaultValue = "") {
    try {
        if (!fs.existsSync(filePath)) return defaultValue
        const stats = fs.statSync(filePath)
        if (stats.size === 0) return defaultValue
        const content = fs.readFileSync(filePath, 'utf8')
        let parsed = {}
        try {
            parsed = yaml.parse(content) || {}
        } catch (parseError) {
            const keyRegex = new RegExp(`^\\s*${key}:\\s*(.*?)(\\s*#|\\s*$)`, 'm')
            const keyValueMatch = content.match(keyRegex)
            if (keyValueMatch && keyValueMatch[1]) {
                const rawValue = keyValueMatch[1].trim()
                if (rawValue === 'true') return true
                if (rawValue === 'false') return false
                if (!isNaN(rawValue)) return Number(rawValue)
                if (rawValue.startsWith('"') && rawValue.endsWith('"')) return rawValue.slice(1, -1)
                return rawValue
            }
            return defaultValue
        }
        if (parsed[key] !== undefined && parsed[key] !== null) {
            return parsed[key]
        }
        return defaultValue
    } catch (e) {
        console.error(`读取配置失败[${filePath}][${key}]`, e)
        return defaultValue
    }
}

export function writeYamlConfig(filePath, key, value, removeComments = false) {
    try {
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        if (!fs.existsSync(filePath)) {
            const initContent = `# 配置文件（请勿修改行数和顺序）\n${key}: ${formatValueForYaml(value)}\n`
            fs.writeFileSync(filePath, initContent)
            return true
        }
        const content = fs.readFileSync(filePath, 'utf8')
        const lines = content.split('\n')
        let found = false
        const newLines = []
        const keyRegex = new RegExp(`^(\\s*)${key}:(\\s|#|$)`)
        for (const line of lines) {
            if (keyRegex.test(line) && !found) {
                const indent = line.match(/^\s*/)[0] || ''
                const commentMatch = line.match(/#(.*)$/)
                const comment = !removeComments && commentMatch ? ` #${commentMatch[1]}` : ''
                newLines.push(`${indent}${key}: ${formatValueForYaml(value)}${comment}`)
                found = true
            } else {
                newLines.push(line)
            }
        }
        if (!found) {
            console.warn(`未找到键[${key}]，不新增行（保护行数结构）`)
            return false
        }
        const newContent = newLines.join('\n')
        if (newContent !== content) {
            fs.writeFileSync(filePath, newContent)
        }
        return true
    } catch (e) {
        console.error(`写入配置失败[${filePath}][${key}]`, e)
        return false
    }
}