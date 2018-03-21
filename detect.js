const fs = require('fs');
const path = require('path');
module.exports = options => {
  if (!options.port) options.port = 7070;
  const appDir = path.resolve(options.baseDir, 'app');
  if (!fs.existsSync(appDir)) {
    throw new Error(`miss '${appDir}' dir when framework detecting`);
  }
}