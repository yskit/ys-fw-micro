const fs = require('fs');
const path = require('path');
const Loader = require('./loader');
const MicroService = require('ys-micro').Server;
const toString = Object.prototype.toString;

module.exports = class Application extends MicroService {
  constructor(app) {
    super();
    this.app = app;
    app.micro = this;
    this.logger = app.console;
    this.loader = new Loader(this);
    this.context.error = (...args) => this.error(...args);
  }

  error(message, code) {
    let err;
    if (message instanceof Error || toString.call(message) === '[object Error]') {
      err = message;
    } else {
      err = new Error(message);
    }
    if (code) err.code = code;
    return err;
  }

  async createServer() {
    const options = this.app.options;
    const _port = options.port;
    const port = options.socket ? options.clusterPort : _port;
    await new Promise((resolve, reject) => {
      const server = this.listen(port, err => {
        if (err) return reject(err);
        this.server = server;
        this.app.console.info(
          '[%d] [WORKER] Start service on `%s:%d`', 
          this.app.pid, 
          '127.0.0.1', 
          port
        );
        resolve();
      });
    });
  }

  async created() {
    await this.app.emit('beforeLoadFiles', this.loader);
    for (const pluginName in this.app.plugins) {
      const plugin = this.app.plugins[pluginName];
      const pluginAppDir = path.resolve(plugin.dir, 'app');
      if (fs.existsSync(pluginAppDir)) {
        this.loader.controller.push(path.join(pluginAppDir, 'controller'));
        this.loader.middleware.push(path.join(pluginAppDir, 'middleware'));
        this.loader.service.push(path.join(pluginAppDir, 'service'));
      }
    }
    this.loader.loadController();
    this.loader.loadMiddleware();
    this.loader.loadService();
    await this.app.emit('serverWillStart', this);
    await this.createServer();
    await this.app.emit('serverDidStarted', this);
  }

  async destroy() {
    if (this.server) {
      await this.app.emit('serverWillStop', this);
      this.server.close();
      await this.app.emit('serverDidStoped', this);
    }
  }
}