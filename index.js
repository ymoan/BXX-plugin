import { readdir, stat } from 'node:fs/promises';
import { dirname, join, basename, sep } from 'node:path';
import chalk from 'chalk';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APPS_DIR = join(__dirname, 'apps');

let successCount = 0;
let failureCount = 0;
const startTime = Date.now();
const apps = {};

logger.info(`\t${chalk.cyan('不羡仙后门正在载入...')}`);

async function getJSFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const jsFiles = [];
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      const subFiles = await getJSFiles(fullPath);
      jsFiles.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const relativePath = fullPath.replace(APPS_DIR + sep, '');
      const identifier = relativePath
        .replace(/\.js$/, '')
        .replace(/\\/g, '/')  
        .split('/')
        .join('.');  
      
      jsFiles.push({
        identifier,
        filePath: fullPath
      });
    }
  }
  
  return jsFiles;
}

try {
  const jsFiles = await getJSFiles(APPS_DIR);
  
  const loadModules = jsFiles.map(async ({ identifier, filePath }) => {
    try {
      const fileUrl = pathToFileURL(filePath).href;
      const moduleExports = await import(fileUrl);
      const defaultExport = 
        moduleExports?.default || 
        moduleExports[Object.keys(moduleExports)[0]];
      
      apps[identifier] = defaultExport;
      successCount++;
    } catch (error) {
      logger.error(`不羡仙后门载入失败：${chalk.red(identifier)}`);
      logger.error(error);
      failureCount++;
    }
  });

  await Promise.allSettled(loadModules);

} catch (error) {
  logger.error(`读取文件时出错：${chalk.red(error.message)}`);
}

const endTime = Date.now();
const elapsedTime = ((endTime - startTime) / 1000).toFixed(2);

logger.info(chalk.cyan('-------------------'));
logger.info(chalk.green('不羡仙后门载入完成'));
logger.info(`成功加载：${chalk.green(successCount)} 个`);
logger.info(`加载失败：${chalk.red(failureCount)} 个`);
logger.info(`总耗时：${chalk.yellow(elapsedTime)} 秒`);
logger.info(chalk.cyan('-------------------'));

export { apps };