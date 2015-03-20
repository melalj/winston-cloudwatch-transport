var AWS = require('aws-sdk'),
    cloudwatchlogs,
    _ = require('lodash'),
    async = require('async'),
    logEvents = [],
    logGroupName = '',
    logStreamName = '';

module.exports.init = function(awsLogGroupName, awsLogStreamName, awsAccessKeyId, awsSecretKey, awsRegion) {
  if (awsAccessKeyId && awsSecretKey && awsRegion) {
    cloudwatchlogs = new AWS.CloudWatchLogs({accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretKey, region: awsRegion});
  } else {
    cloudwatchlogs = new AWS.CloudWatchLogs();
  }
  logGroupName = awsLogGroupName;
  logStreamName = awsLogStreamName;
};

module.exports.add = function(log) {
  logEvents.push({
    message: [log.level, log.msg, JSON.stringify(log.meta, null, '  ')].join(' - '),
    timestamp: new Date().getTime()
  });
};

async.forever(function(next) {
  setTimeout(function() {
    upload(next);
  }, 1000);
}, console.log);

function upload(cb) {
  if (logEvents.length <= 0) return;

  token(function(err, sequenceToken) {
    if (err) return console.log(err, err.stack);

    var payload = {
      sequenceToken: sequenceToken,
      logGroupName: logGroupName,
      logStreamName: logStreamName,
      logEvents: logEvents.splice(0, 20)
    };

    cloudwatchlogs.putLogEvents(payload, function(err, data) {
      if (err) return console.log(err, err.stack);
      cb();
    });
  });
}

function token(cb) {
  cloudwatchlogs.describeLogStreams({
    logGroupName: logGroupName
  }, function(err, data) {
    if (err) return cb(err);
    var logStream = _.find(data.logStreams, function(logStream) {
      return logStream.logStreamName === logStreamName;
    });
    cb(err, logStream.uploadSequenceToken);
  });
}
