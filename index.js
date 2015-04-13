var util = require('util'),
    winston = require('winston'),
    AWS = require('aws-sdk'),
    sizeof = require('object-sizeof'),
    _ = require('lodash');

var CloudWatch = winston.transports.CloudWatch = function(options) {
  this.name = options.name || 'CloudWatch';
  this.level = options.level || 'info';
  this.logEvents = [];
  this.options = options;

  if (options.awsProfile && options.awsRegion) {
    // TODO document this feature
    AWS.config.credentials = new AWS.SharedIniFileCredentials({profile: options.awsProfile});
    this.cloudwatchlogs = new AWS.CloudWatchLogs({region: options.awsRegion});
  } else if (options.awsAccessKeyId && options.awsSecretKey && options.awsRegion) {
    this.cloudwatchlogs = new AWS.CloudWatchLogs({
      accessKeyId: options.awsAccessKeyId,
      secretAccessKey: options.awsSecretKey,
      region: options.awsRegion
    });
  } else {
    this.cloudwatchlogs = new AWS.CloudWatchLogs();
  }

  this.throttledUpload = _.throttle(this.upload.bind(this), 2000);
};

util.inherits(CloudWatch, winston.Transport);

CloudWatch.prototype.log = function(level, msg, meta, callback) {
  var log = { level: level, msg: msg, meta: meta };
  this.logEvents.push({
    message: [log.level, log.msg, JSON.stringify(log.meta, null, '  ')].join(' - '),
    timestamp: new Date().getTime()
  });
  this.throttledUpload();
  // do not wait, just return right away
  callback(null, true);
};

CloudWatch.prototype.getSequencetoken = function(cb) {
  var thisLogStreamName = this.options.logStreamName;
  this.cloudwatchlogs.describeLogStreams({
    logGroupName: this.options.logGroupName
  }, function(err, data) {
    if (err) return cb(err);

    var logStream = _.find(data.logStreams, function(logStream) {
      return logStream.logStreamName === thisLogStreamName;
    });
    if (!logStream) throw Exception("Log stream '" + this.options.logStreamName +"' not found");

    cb(err, logStream.uploadSequenceToken);
  }.bind(this));
};

CloudWatch.prototype.upload = function() {
  if (this.logEvents.length <= 0) return;

  this.getSequencetoken(function(err, sequenceToken) {
    if (err) return console.log(err, err.stack);

    var payload = {
      sequenceToken: sequenceToken,
      logGroupName: this.options.logGroupName,
      logStreamName: this.options.logStreamName,
      logEvents: this.createBatch()
    };
    this.cloudwatchlogs.putLogEvents(payload, function(err, data) {
      if (err) return console.log(err, err.stack);
    });
  }.bind(this));
};

// AWS enforces a limit of 32kb batch size per request
CloudWatch.prototype.createBatch = function() {
  var batch = [], batchSize = 0;
  while(this.logEvents.length > 0) {
    var item = this.logEvents[0];
    batchSize += sizeof(item);
    if (batchSize < 32000) {
      batch.push(this.logEvents.shift());
    } else {
      break;
    }
  }
  if (this.options.verbose) {
    console.log([new Date(), ' ', sizeof(batch), 'b', ' ', this.logEvents.length].join(''));
  }
  return batch;
};

module.exports = CloudWatch;
