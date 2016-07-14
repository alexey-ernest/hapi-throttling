/*jslint white: true */

(function () {
  'use strict';

  var Boom = require('boom'),
      debug = require('debug')('hapi-throttling'),
      Hoek = require('hoek'),
      Limiter = require('ratelimiter'),
      redis = require('redis');

  /**
   * Default options
   */
  var DEFAULTS = {
    redis: {
      host: '127.0.0.1',
      port: 6379
    },
    getKey: null,
    getLimit: null
  };

  /**
   * Constants
   */
  var PLUGIN_NAME = 'hapi-throttling';
  var HEADER_X_RATE_LIMIT_LIMIT = 'X-RateLimit-Limit';
  var HEADER_X_RATE_LIMIT_REMAINING = 'X-RateLimit-Remaining';
  var HEADER_X_RATE_LIMIT_RESET = 'X-RateLimit-Reset';
  var HEADER_RETRY_AFTER = 'Retry-After';

  /**
   * Plugin registration point.
   */
  exports.register = function (server, options, next) {
    var settings = Hoek.applyToDefaults(DEFAULTS, options);
    var redisClient = redis.createClient({host: options.redis.host, port: options.redis.port});

    // Before auth
    server.ext('onPreAuth', function(request, reply) {
      // get request key
      settings.getKey(request, reply, function (err, key) {
        if (err) {
          return reply(err);
        }

        debug('Request key: %s', key);

        settings.getLimit(request, reply, function (err, requestLimit) {
          if (err) {
            return reply(err);
          }

          debug('Limit: %s', JSON.stringify(requestLimit));

          var limiter = new Limiter({ id: key, db: redisClient, max: requestLimit.max, duration: requestLimit.duration });
          var error = null;
          limiter.get(function(err, limit) {
            if (err) {
              return reply(err);
            }

            debug('Remaining %s/%s %s', limit.remaining - 1, limit.total, key);

            // save plugin data for subsequent lifecycle handlers
            request.plugins[PLUGIN_NAME] = {
              total: limit.total,
              remaining: limit.remaining - 1,
              reset: limit.reset
            };

            if (limit.remaining <= 0) {
              // abort request with error
              var delta = (limit.reset * 1000) - Date.now() | 0;
              var after = limit.reset - (Date.now() / 1000) | 0;

              error = Boom.tooManyRequests('Rate limit exceeded, retry in ' + delta + ' ms');
              error.output.headers[HEADER_X_RATE_LIMIT_LIMIT] = limit.total;
              error.output.headers[HEADER_X_RATE_LIMIT_REMAINING] = 0;
              error.output.headers[HEADER_X_RATE_LIMIT_RESET] = limit.reset;
              error.output.headers[HEADER_RETRY_AFTER] = after;
              error.reformat();

              return reply(error);
            } else {
              return reply.continue();
            }
          });
        });
      });
    });

    // After handler
    server.ext('onPostHandler', function(request, reply) {
      var response;
      if (request.plugins[PLUGIN_NAME]) {
        response = request.response;
        if (!response.isBoom) {
          response.headers[HEADER_X_RATE_LIMIT_LIMIT] = request.plugins[PLUGIN_NAME].total;
          response.headers[HEADER_X_RATE_LIMIT_REMAINING] = request.plugins[PLUGIN_NAME].remaining;
          response.headers[HEADER_X_RATE_LIMIT_RESET] = request.plugins[PLUGIN_NAME].reset;
        }
      }

      reply.continue();
    });

    next();
  };

  exports.register.attributes = {
    pkg: require('../package.json')
  };
}());