const path = require('path');
const MicroService = require('ys-micro').Server;
const { FileLoader, ContextLoader } = require('ys-loader');

module.exports = class Application extends MicroService {
  constructor(app) {
    super();
    this.app = app;
    app.micro = this;
    this.logger = app.console;
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
    opt = Object.assign({
      directory: path.join(this.app.options.baseDir, 'app', 'controller'),
      call: true,
      inject: this.app,
    }, opt);
    const controllerBase = opt.directory;
    this.loadToApp(controllerBase, 'controller', opt);
    this.logger.info(`  - [${this.app.pid}]`, '[`ys-loader`:app] Controllers Loaded: ' + controllerBase);
  }

  loadMiddleware(opt = {}) {
    opt = Object.assign({
      directory: path.join(this.app.options.baseDir, 'app', 'middleware'),
      call: true,
      inject: this.app,
    }, opt);
    const middlewareBase = opt.directory;
    this.loadToApp(middlewareBase, 'middleware', opt);
    this.logger.info(`  - [${this.app.pid}]`, '[`ys-loader`:app] Middlewares Loaded: ' + middlewareBase);
  }

  loadService(opt = {}) {
    // 载入到 app.serviceClasses
    opt = Object.assign({
      call: true,
      caseStyle: 'lower',
      fieldClass: 'serviceClasses',
      directory: path.resolve(this.app.options.baseDir, 'app', 'service'),
    }, opt);
    const servicePaths = opt.directory;
    this.loadToContext(servicePaths, 'service', opt);
    this.logger.info(`  - [${this.app.pid}]`, '[`ys-loader`:context] Services Loaded: ' + servicePaths);
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