var Hapi = require('hapi');
var async = require('async');
var chai = require('chai');
chai.should();
 
describe('HAPI with globally registered plugin', function () {
  var server;
  var max = 5;
  var duration = 10000;

  beforeEach(function() {
    server = new Hapi.Server();
    server.connection({port: 8000});

    var options = {
      redis: {
        host: process.env.REDIS_HOST,
        port: 6379
      },
      getKey: function (request, reply, done) {
        done();
      },
      getLimit: function (request, reply, done) {
        done(null, {
          max: max,
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

    server.route({
      method: 'GET', 
      path: '/', 
      handler: function (request, reply) {
        reply('OK');
      }
    });
  });

  it("should disable limits if the key is not determined", function (done) {
    var options = {
      method: "GET",
      url: "/"
    };  
 
    server.inject(options, function (response) {
      response.statusCode.should.equal(200);

      response.headers.should.not.have.property('x-ratelimit-limit');
      response.headers.should.not.have.property('x-ratelimit-remaining');
      response.headers.should.not.have.property('x-ratelimit-reset');

      done();
    });
  });
 
});