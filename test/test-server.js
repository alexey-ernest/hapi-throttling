/*jslint white: true */

var Hapi = require('hapi');

var server = new Hapi.Server();
server.connection({port: 8000});

// register plugins
server.register({
  register: require('../'),
  options: {
    redis: {
      host: '192.168.99.100',
      port: 6379
    },
    getKey: function (request, reply, done) {
      var key = request.info.remoteAddress + ':' + request.route.path;
      done(null, key);
    },
    getLimit: function (request, reply, done) {
      var max;
      if (request.route.path === '/test1') {
        max = 5;
      } else {
        max = 10;
      }

      done(null, {
        max: max,
        duration: 60000
      });
    }
  }
}, function (err) {
  if (err) {
      throw err;
  }
});

// register routes
server.route([{
  method: 'GET', 
  path: '/test1', 
  handler: function (request, reply) {
    reply('test1');
  }
}, {
  method: 'GET',
  path: '/test2',
  handler: function(request, reply) {
    reply('test2');
  }
}]);

// start the server
server.start(function (err) {
  if (err) {
    throw err;
  }
  console.log('Server running at:', server.info.uri);
});