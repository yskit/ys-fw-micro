module.exports = class Agent {
  constructor(app) {
    this.app = app;
    this.logger = app.console;
  }

  async created() {}
  async destroy() {}
}