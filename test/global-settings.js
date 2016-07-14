var Hapi = require('hapi');
var async = require('async');
var chai = require('chai');
chai.should();
 
describe('HAPI with globally registered plugin', function () {
  var server;
  var key;
  var max = 5;
  var duration = 10000;

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
        done(null, key);
      },
      getLimit: function (request, reply, done) {
        done(null, {
          max: max,
          duration: duration
        });
      }
    };

    server.register({
      register: require('./'),
      options: options
    }, function (err) {
      if (err) {
        throw err;
      }
    });

    server.route({
      method: 'GET', 
      path: '/', 
      handler: function (request, reply) {
        reply('OK');
      }
    });
  });

  it("should responds 200 with X-RateLimit-* headers", function (done) {
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

      response.headers.should.have.property('x-ratelimit-reset');
      var reset = +response.headers['x-ratelimit-reset'];
      (reset - (Date.now() + duration)/1000 <= 0).should.be.true;

      done();
    });
  });

  it("should responds 429 if limit excedeed with X-RateLimit-* and Retry-After headers", function (done) {
    var options = {
      method: "GET",
      url: "/"
    };

    function makeRequest(callback) {
      server.inject(options, function (response) {
        callback(null, response);
      });  
    }

    var i;
    var requests = [];
    for (i = 0; i <= max; i++) {
      requests.push(makeRequest);
    }

    async.series(requests, function (err, responses) {
      if (err) return done(err);
      var response = responses.pop();

      response.statusCode.should.equal(429);

      response.headers.should.have.property('x-ratelimit-limit');
      response.headers['x-ratelimit-limit'].should.equal(max);

      response.headers.should.have.property('x-ratelimit-remaining');
      response.headers['x-ratelimit-remaining'].should.equal(0);

      response.headers.should.have.property('x-ratelimit-reset');
      var reset = +response.headers['x-ratelimit-reset'];
      (reset - (Date.now() + duration)/1000 <= 0).should.be.true;

      response.headers.should.have.property('retry-after');
      var delta = reset - Date.now()/1000 | 0;
      response.headers['retry-after'].should.equal(delta);

      done();
    });
  });
 
});