var Hapi = require('hapi');
var async = require('async');
var chai = require('chai');
chai.should();
 
describe('HAPI with route-specific settings', function () {
  var server;
  var key;
  var max = 5;
  var max2 = 10;
  var duration = 10000;
  var path = '/test';

  beforeEach(function() {
    key = new Date().getTime();

    server = new Hapi.Server();
    server.connection({port: 8000});

    var options = {
      redis: {
        host: process.env.REDIS_HOST,
        port: 6379
      },
      getKey: function (request, reply, done) {
        done(null, key + ':' + request.route.path);
      },
      getLimit: function (request, reply, done) {
        var limit;
        if (request.route.path === path) {
          limit = max2;
        } else {
          limit = max;
        }
        done(null, {
          max: limit,
          duration: duration
        });
      }
    };

    server.register({
      register: require('../'),
      options: options
    }, function (err) {
      if (err) {
        throw err;
      }
    });

    server.route([{
      method: 'GET', 
      path: '/', 
      handler: function (request, reply) {
        reply('OK');
      }
    }, {
      method: 'GET', 
      path: '/test', 
      handler: function (request, reply) {
        reply('OK');
      }
    }]);
  });

  it("should responds with default X-RateLimit-Limit header", function (done) {
    var options = {
      method: "GET",
      url: "/"
    };  
 
    server.inject(options, function (response) {
      response.statusCode.should.equal(200);

      response.headers.should.have.property('x-ratelimit-limit');
      response.headers['x-ratelimit-limit'].should.equal(max);

      response.headers.should.have.property('x-ratelimit-remaining');
      response.headers['x-ratelimit-remaining'].should.equal(max - 1);

      done();
    });
  });

  it("should responds with specific X-RateLimit-Limit header", function (done) {
    var options = {
      method: "GET",
      url: path
    };  
 
    server.inject(options, function (response) {
      response.statusCode.should.equal(200);

      response.headers.should.have.property('x-ratelimit-limit');
      response.headers['x-ratelimit-limit'].should.equal(max2);

      response.headers.should.have.property('x-ratelimit-remaining');
      response.headers['x-ratelimit-remaining'].should.equal(max2 - 1);

      done();
    });
  });
 
});