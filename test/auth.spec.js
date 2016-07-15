var Hapi = require('hapi');
var async = require('async');
var chai = require('chai');
chai.should();
 
describe('HAPI with auth', function () {
  var server;
  var max = 5;
  var duration = 10000;
  var user;

  beforeEach(function() {
    user = {
      name: 'user',
      password: 'password',
      id: new Date().getTime()
    };

    var users = {};
    users[user.name] = user;

    server = new Hapi.Server();
    server.connection({port: 8000});

    var options = {
      redis: {
        host: process.env.REDIS_HOST,
        port: 6379
      },
      getKey: function (request, reply, done) {
        done(null, request.auth.credentials.id);
      },
      getLimit: function (request, reply, done) {
        done(null, {
          max: max,
          duration: duration
        });
      }
    };

    server.register([{
      register: require('../'),
      options: options
    }, {
      register: require('./basic-auth')
    }], function (err) {
      if (err) {
        throw err;
      }

      // register simple strategy
      server.auth.strategy('simple', 'basic', { 
        validateFunc: function (username, password, callback) {
          var u = users[username];
          if (!u) {
            return callback(null, false);
          }
          callback(null, true, { id: u.id, name: u.name });
        } 
      });
    });

    server.route({
      method: 'GET', 
      path: '/admin', 
      config: { 
        auth: 'simple',
        handler: function (request, reply) {
          reply('OK');
        },
      }
    });
  });

  it('should responds 401 with X-RateLimit-* headers for unauthenticated user', function (done) {
    var options = {
      method: 'GET',
      url: '/admin'
    };  
 
    server.inject(options, function (response) {
      response.statusCode.should.equal(401);
      done();
    });
  });

  it('should responds 200 with X-RateLimit-* headers for authenticated user', function (done) {
    function basicHeader (username, password) {
      return 'Basic ' + (new Buffer(username + ':' + password, 'utf8')).toString('base64');
    }    

    var options = {
      method: 'GET',
      url: '/admin',
      headers: {
        authorization: basicHeader(user.name, user.password)
      }
    };  

    server.inject(options, function (response) {
      response.statusCode.should.equal(200);

      response.headers.should.have.property('x-ratelimit-limit');
      response.headers['x-ratelimit-limit'].should.equal(max);

      response.headers.should.have.property('x-ratelimit-remaining');
      response.headers['x-ratelimit-remaining'].should.equal(max - 1);

      response.headers.should.have.property('x-ratelimit-reset');
      var reset = +response.headers['x-ratelimit-reset'];
      (reset - (Date.now() + duration)/1000 <= 0).should.be.true;

      done();
    });
  });
 
});