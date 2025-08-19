import YAML from 'yaml'
import chokidar from 'chokidar'
import fs from 'node:fs'
import YamlReader from './YamlReader.js'
import _ from 'lodash'
const Path = process.cwd()
const Plugin_Name = 'BXX-plugin'
const Plugin_Path = `${Path}/plugins/${Plugin_Name}`
class Config {
  constructor() {
    this.config = {}
    this.oldConfig = {}
    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }

    this.initCfg()
  }

  /** 初始化配置~ */
  initCfg() {
    let path = `${Plugin_Path}/config/config/`
    if (!fs.existsSync(path)) fs.mkdirSync(path)
    let pathDef = `${Plugin_Path}/config/default_config/`
    const files = fs.readdirSync(pathDef).filter(file => file.endsWith('.yaml'))
    for (let file of files) {
      if (!fs.existsSync(`${path}${file}`)) {
        fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
      } else {
        const config = YAML.parse(fs.readFileSync(`${path}${file}`, 'utf8'))
        const defConfig = YAML.parse(fs.readFileSync(`${pathDef}${file}`, 'utf8'))
        const { differences, result } = this.mergeObjectsWithPriority(config, defConfig)
        if (differences) {
          fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
          for (const key in result) {
            this.modify(file.replace('.yaml', ''), key, result[key])
          }
        }
      }
      this.watch(`${path}${file}`, file.replace('.yaml', ''), 'config')
    }
  }
  /**
   * 获取配置yaml
   * @param type 默认跑配置-defSet，用户配置-config
   * @param name 名称
   */
  getYaml(type, name) {
    let file = `${Plugin_Path}/config/${type}/${name}.yaml`
    let key = `${type}.${name}`

    if (this.config[key]) return this.config[key]

    this.config[key] = YAML.parse(
      fs.readFileSync(file, 'utf8')
    )

    this.watch(file, name, type)

    return this.config[key]
  }

  /** 监听配置文件 */
  watch(file, name, type = 'default_config') {
    let key = `${type}.${name}`
    if (!this.oldConfig[key]) this.oldConfig[key] = _.cloneDeep(this.config[key])
    if (this.watcher[key]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', async path => {
      delete this.config[key]
      if (typeof Bot == 'undefined') return
      logger.mark(`[BXX-plugin][修改配置文件][${type}][${name}]`)

      if (name == 'config') {
        const oldConfig = this.oldConfig[key]
        delete this.oldConfig[key]
        const newConfig = this.getYaml(type, name)
        const object = this.findDifference(oldConfig, newConfig)
        // console.log(object);
        for (const key in object) {
          if (Object.hasOwnProperty.call(object, key)) {
            const value = object[key]
            const arr = key.split('.')
            if (arr[0] !== 'servers') continue
            let data = newConfig.servers[arr[1]]
            if (typeof data === 'undefined') data = oldConfig.servers[arr[1]]
            const target = {
              type: null,
              data
            }
            if (typeof value.newValue === 'object' && typeof value.oldValue === 'undefined') {
              target.type = 'add'
            } else if (typeof value.newValue === 'undefined' && typeof value.oldValue === 'object') {
              target.type = 'del'
            } else if (value.newValue === true && (value.oldValue === false || typeof value.oldValue === 'undefined')) {
              target.type = 'close'
            } else if (value.newValue === false && (value.oldValue === true || typeof value.oldValue === 'undefined')) {
              target.type = 'open'
            }
            await modifyWebSocket(target)
          }
        }
      }
    })

    this.watcher[key] = watcher
  }

  getCfg() {
    let config = this.getDefOrConfig('config')
    return {
      ...config,
    }
  }

  /**
   * @description: 修改设置
   * @param {String} name 文件名
   * @param {String} key 修改的key值
   * @param {String|Number} value 修改的value值
   * @param {'config'|'default_config'} type 配置文件或默认
   */
  modify(name, key, value, type = 'config') {
    let path = `${Plugin_Path}/config/${type}/${name}.yaml`
    new YamlReader(path).set(key, value)
    this.oldConfig[key] = _.cloneDeep(this.config[key])
    delete this.config[`${type}.${name}`]
  }

  /**
   * @description: 修改配置数组
   * @param {String} name 文件名
   * @param {String|Number} key key值
   * @param {String|Number} value value
   * @param {'add'|'del'} category 类别 add or del
   * @param {'config'|'default_config'} type 配置文件或默认
   */
  modifyarr(name, key, value, category = 'add', type = 'config') {
    let path = `${Plugin_Path}/config/${type}/${name}.yaml`
    let yaml = new YamlReader(path)
    if (category == 'add') {
      yaml.addIn(key, value)
    } else {
      let index = yaml.jsonData[key].indexOf(value)
      yaml.delete(`${key}.${index}`)
    }
  }

  setArr(name, key, item, value, type = 'config') {
    let path = `${Plugin_Path}/config/${type}/${name}.yaml`
    let yaml = new YamlReader(path)
    let arr = yaml.get(key).slice()
    arr[item] = value
    yaml.set(key, arr)
  }

  delServersArr(value, name = 'ws-config', type = 'config') {
    let path = `${Plugin_Path}/config/${type}/${name}.yaml`
    let yaml = new YamlReader(path)
    let key = 'servers'
    // let index = yaml.jsonData[key].indexOf(value)
    let index = yaml.jsonData[key].findIndex(item => item.name === value)
    yaml.delete(`${key}.${index}`)
  }

  /**
   * @description 对比两个对象不同的值
   * @param {*} oldObj
   * @param {*} newObj
   * @param {*} parentKey
   * @returns
   */
  findDifference(obj1, obj2, parentKey = '') {
    const result = {}
    for (const key in obj1) {
      const fullKey = parentKey ? `${parentKey}.${key}` : key
      if (_.isObject(obj1[key]) && _.isObject(obj2[key])) {
        const diff = this.findDifference(obj1[key], obj2[key], fullKey)
        if (!_.isEmpty(diff)) {
          Object.assign(result, diff)
        }
      } else if (!_.isEqual(obj1[key], obj2[key])) {
        result[fullKey] = { oldValue: obj1[key], newValue: obj2[key] }
      }
    }
    for (const key in obj2) {
      if (!Object.prototype.hasOwnProperty.call(obj1, key)) {
        const fullKey = parentKey ? `${parentKey}.${key}` : key
        result[fullKey] = { oldValue: undefined, newValue: obj2[key] }
      }
    }
    return result
  }

  mergeObjectsWithPriority(objA, objB) {
    let differences = false

    function customizer(objValue, srcValue, key, object, source, stack) {
      if (_.isArray(objValue) && _.isArray(srcValue)) {
        return objValue
      } else if (_.isPlainObject(objValue) && _.isPlainObject(srcValue)) {
        if (!_.isEqual(objValue, srcValue)) {
          return _.mergeWith({}, objValue, srcValue, customizer)
        }
      } else if (!_.isEqual(objValue, srcValue)) {
        differences = true
        return objValue !== undefined ? objValue : srcValue
      }
      return objValue !== undefined ? objValue : srcValue
    }

    let result = _.mergeWith({}, objA, objB, customizer)

    return {
      differences,
      result
    }
  }
}
export default new Config()
