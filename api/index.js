function configurationReady(env) {
  const host = (env.MYSQL_HOST || '').toLowerCase();
  return env.DB_CLIENT === 'mysql' && host && !['localhost', '127.0.0.1', '::1'].includes(host)
    && env.MYSQL_USER && env.MYSQL_PASSWORD && env.MYSQL_DATABASE
    && env.MYSQL_SSL === 'true' && (env.JWT_SECRET || '').length >= 32;
}

function createHandler({ env = process.env, initialize = initializeApp } = {}) {
  let ready;
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!configurationReady(env)) {
      return res.status(503).json({ error: 'Configure o MySQL online, TLS e JWT_SECRET antes de liberar o sistema.' });
    }
    try {
      if (!ready) ready = initialize().catch(error => { ready = undefined; throw error; });
      const app = await ready;
      if (req.url.split('?')[0] === '/api/health') return res.status(200).json({ status: 'ok' });
      return app(req, res);
    } catch (error) {
      console.error('[VERCEL] Inicialização indisponível:', error.code || error.name);
      return res.status(503).json({ error: 'Banco indisponível ou estrutura pendente. Verifique a configuração e as migrations.' });
    }
  };
}

async function initializeApp() {
  const { queryOne } = require('../backend/dist/config/db');
  const schema = await queryOne('SELECT MAX(version) AS version FROM schema_migrations');
  if (Number(schema?.version || 0) < 5) throw new Error('Migrations pendentes');
  // Importing the app never starts a listener, migration or backup interval.
  return require('../backend/dist/server').app;
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
