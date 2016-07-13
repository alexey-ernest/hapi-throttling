/*jslint white: true */

var Hapi = require('hapi');

var server = new Hapi.Server();
server.connection({port: 8000});

// register plugins
server.register({
  register: require('./'),
  options: {
    redis: {
      host: '192.168.99.100',
      port: 6379
    },
    getKey: function (request, reply, done) {
      done(null, request.info.remoteAddress);
    },
    max: 5,
    duration: 60000
  }
}, function (err) {
  if (err) {
      throw err;
  }
});

// register routes
server.route({
  method: 'GET', 
  path: '/', 
  handler: function (request, reply) {
    reply('OK');
  }
});

// start the server
server.start(function (err) {
  if (err) {
    throw err;
  }
  console.log('Server running at:', server.info.uri);
});