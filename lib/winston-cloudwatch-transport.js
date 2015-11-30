var AWS = require('aws-sdk');
var _ = require('lodash');
var util = require('util');
var winston = require('winston');
var CircularJSON = require('circular-json');
/**
 * @param {Object} options
 * @param {string} [options.name]
 * @param {string} [options.level]
 * @param {string} [options.awsAccessKeyId]
 * @param {string} [options.awsSecretKey]
 * @param {string} [options.awsRegion]
 * @param {string} options.logGroupName
 * @param {string} options.logStreamName
 * @param {boolean} [options.jsonMessage]
 */
var Transport = function (options) {
  var self = this;
  this.name = _.capitalize(options.name || "cloudwatch_" + options.logGroupName + "_" + options.logStreamName);
  this.level = options.level || 'debug';
  this.logGroupName = options.logGroupName;
  this.logStreamName = options.logStreamName;
  this.jsonMessage = options.jsonMessage;
  this.cloudWatchLogs = null;
  this.logEvents = [];
  this.intervalId = null;
  this.lastFree = null;

  if (options.awsAccessKeyId && options.awsSecretKey && options.awsRegion) {
    this.cloudWatchLogs = new AWS.CloudWatchLogs({
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretKey,
      region: awsRegion
    });
  } else if (options.awsRegion && !options.awsAccessKeyId && !options.awsSecretKey) {
    // Amazon SDK will automatically pull access credentials from IAM Role when running on EC2 but region still needs to be configured
    this.cloudWatchLogs = new AWS.CloudWatchLogs({region: options.awsRegion});
  } else {
    this.cloudWatchLogs = new AWS.CloudWatchLogs();
  }

  var findLogStream = function (cb) {
    function next(token) {
      var params = {
        logStreamNamePrefix: self.logStreamName,
        logGroupName: self.logGroupName
      };
      self.cloudWatchLogs.describeLogStreams(params, function (err, data) {
        if (err) return cb(err);
        var matches = _.find(data.logStreams, function (logStream) {
          return (logStream.logStreamName === self.logStreamName);
        });
        if (matches) {
          cb(null, matches);
        } else if (!data.nextToken) {
          cb(new Error('Stream not found'));
        } else {
          next(data.nextToken);
        }
      })
    }

    next();
  };

  this.token = function (cb) {
    findLogStream(function (err, logStream) {
      if (err) {
        return cb(err);
      }
      cb(null, logStream.uploadSequenceToken);
    });
  };
};

util.inherits(Transport, winston.Transport);

Transport.prototype.log = function (level, msg, meta, callback) {
  var log = {level: level, msg: msg, meta: meta};
  this.add(log);

  // do not wait, just return right away
  callback(null, true);
};

Transport.prototype.add = function (log) {
  var self = this;
  this.logEvents.push({
    message: this.jsonMessage ? CircularJSON.stringify(log, null, '  ') : [log.level, log.msg, CircularJSON.stringify(log.meta, null, '  ')].join(' - '),
    timestamp: new Date().getTime()
  });

  this.lastFree = new Date().getTime();


  var upload = function () {
    if (new Date().getTime() - 2000 > self.lastFree) {
      self.token(function (err, sequenceToken) {
        if (err) {
          return console.log(err, err.stack);
        }

        if (self.logEvents.length <= 0) {
          return;
        }

        var payload = {
          logGroupName: self.logGroupName,
          logStreamName: self.logStreamName,
          logEvents: self.logEvents.splice(0, 20)
        };
        if (sequenceToken) payload.sequenceToken = sequenceToken;

        self.cloudWatchLogs.putLogEvents(payload, function (err, data) {
          if (err) return console.log(err, err.stack);
          self.lastFree = new Date().getTime();
        });
      });
    }
  }
  if (!this.intervalId) {
    this.intervalId = setInterval(upload, 1000);
  }
};

module.exports = Transport;
