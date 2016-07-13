/*jslint white: true */

(function () {
  'use strict';

  var Limiter = require('ratelimiter'),
      Hoek = require('hoek'),
      redis = require('redis'),
      debug = require('debug')('hapi-throttling');

  /**
   * Default options
   */
  var DEFAULTS = {
    redis: {
      host: '127.0.0.1',
      port: 6379
    },
    duration: 60,
    max: 100,
    getKey: null
  };

  /**
   * Plugin registration point.
   */
  exports.register = function (server, options, next) {
    var settings = Hoek.applyToDefaults(DEFAULTS, options);

    // plug limiter into each request
    server.ext('onRequest', function (request, reply) {
      // get request key
      settings.getKey(request, reply, function (err, key) {
        if (err) {
          debug('getKey() error occured: %s', err);
          return reply();
        }

        debug('Request key: %s', key);

        var db = redis.createClient({
          host: options.redis.host,
          port: options.redis.port
        });
        var limit = new Limiter({ id: key, db: db, max: settings.max, duration: settings.duration });
        limit.get(function (err, limit) {
          if (err) {
            debug('Limiter.get() error occured: %s', err);
            return reply();
          }

          debug('remaining %s/%s %s', limit.remaining - 1, limit.total, key);

          // all good
          var response;
          if (limit.remaining) {
            response = reply();
            response.header('X-RateLimit-Limit', limit.total);
            response.header('X-RateLimit-Remaining', limit.remaining - 1);
            response.header('X-RateLimit-Reset', limit.reset);
            return response;
          }

          // not good
          var delta = (limit.reset * 1000) - Date.now() | 0;
          var after = limit.reset - (Date.now() / 1000) | 0;

          response = reply('Rate limit exceeded, retry in ' + delta + ' ms');
          response.statusCode = 429;
          response.header('Retry-After', after);
        });
      });
    });
    
    return next();
  };

  exports.register.attributes = {
    pkg: require('../package.json')
  };
}());