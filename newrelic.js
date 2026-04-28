'use strict';

exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'snapflow-unknown'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  agent_enabled: process.env.NEW_RELIC_ENABLED !== 'false',

  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
  },

  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*',
    ],
  },

  distributed_tracing: { enabled: true },
  transaction_tracer: { enabled: true },
  error_collector: { enabled: true },

  application_logging: {
    forwarding: { enabled: true },
    metrics: { enabled: true },
    local_decorating: { enabled: false },
  },
};
