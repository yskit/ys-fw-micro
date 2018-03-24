const fs = require('fs');
const path = require('path');
const MicroService = require('ys-micro').Server;
const { FileLoader, ContextLoader } = require('ys-loader');

module.exports = class Application extends MicroService {
  constructor(app) {
    super();
    this.app = app;
    app.micro = this;
    this.logger = app.console;
    this._compiler = {
      controllers: [path.join(app.options.baseDir, 'app', 'controller')],
      middlewares: [path.join(app.options.baseDir, 'app', 'middleware')],
      services: [path.join(app.options.baseDir, 'app', 'service')],
    }
  }

  loadToApp(directory, property, opt = {}) {
    const target = this.app[property] = {};
    new FileLoader(Object.assign({}, {
      directory,
      target
    }, opt)).load();
  }

  loadToContext(directory, property, opt = {}) {
    new ContextLoader(Object.assign({}, {
      directory,
      property,
      inject: this,
    }, opt)).load();
  }

  loadController(opt = {}) {
    this.loadToApp(this._compiler.controllers, 'controller', {
      call: true,
      inject: this.app,
    });
    if (this.env !== 'production' && this.env !== 'product') {
      this._compiler.controllers.forEach(file => {
        const relative = './' + path.relative(this.app.options.baseDir, file);
        this.logger.info(`  - [${this.app.pid}]`, '[`ys-loader`:app] Controllers Loaded: ' + relative);
      });
    }
  }

  loadMiddleware(opt = {}) {
    this.loadToApp(this._compiler.middlewares, 'middleware', {
      call: true,
      inject: this.app,
    });
    if (this.env !== 'production' && this.env !== 'product') {
      this._compiler.middlewares.forEach(file => {
        const relative = './' + path.relative(this.app.options.baseDir, file);
        this.logger.info(`  - [${this.app.pid}]`, '[`ys-loader`:app] Middlewares Loaded: ' + relative);
      });
    }
  }

  loadService(opt = {}) {
    this.loadToContext(this._compiler.services, 'service', {
      call: true,
      caseStyle: 'lower',
      fieldClass: 'serviceClasses'
    });
    if (this.env !== 'production' && this.env !== 'product') {
      this._compiler.services.forEach(file => {
        const relative = './' + path.relative(this.app.options.baseDir, file);
        this.logger.info(`  - [${this.app.pid}]`, '[`ys-loader`:context] Services Loaded: ' + relative);
      });
    }
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
    await this.app.emit('beforeLoadFiles', this._compiler);
    for (const pluginName in this.app.plugins) {
      const plugin = this.app.plugins[pluginName];
      const pluginAppDir = path.resolve(plugin.dir, 'app');
      if (fs.existsSync(pluginAppDir)) {
        this._compiler.controllers.push(path.join(pluginAppDir, 'controller'));
        this._compiler.middlewares.push(path.join(pluginAppDir, 'middleware'));
        this._compiler.services.push(path.join(pluginAppDir, 'service'));
      }
    }
    this.loadController(this.app.options.controller);
    this.loadMiddleware(this.app.options.middleware);
    this.loadService(this.app.options.service);
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