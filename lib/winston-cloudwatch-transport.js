var AWS = require('aws-sdk');
var _ = require('lodash');
var util = require('util');
var winston = require('winston');
var CircularJSON = require('circular-json');
var backoff = require('backoff');

var LIMITS = {
    EVENT_SIZE: 256000,
    BATCH_SIZE: 1000000
};

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

    if (options.awsAccessKeyId && options.awsSecretKey && options.awsRegion) {
        this.cloudWatchLogs = new AWS.CloudWatchLogs({
            accessKeyId: options.awsAccessKeyId,
            secretAccessKey: options.awsSecretKey,
            region: options.awsRegion
        });
    } else if (options.awsRegion && !options.awsAccessKeyId && !options.awsSecretKey) {
        // Amazon SDK will automatically pull access credentials from IAM Role when running on EC2 but region still needs to be configured
        this.cloudWatchLogs = new AWS.CloudWatchLogs({region: options.awsRegion});
    } else {
        this.cloudWatchLogs = new AWS.CloudWatchLogs();
    }

    /* store payloads */
    var payloadQueue = [];


    this.add = function (message) {
        var messageSize = CircularJSON.stringify(message).length;

        if (messageSize > LIMITS.EVENT_SIZE) {
            //For now return, in the future we need to try to split the object
            console.warn('Rejecting message, message is to over the EVENT_SIZE Limit');
            return;
        }

        var payload = {messages: [], size: 0, locked: false};

        /*  If the queue is empty, or
         *  if the new message would put the batch over max size limit or
         *  if the batch is locked, insert a new batch
         *  Otherwise, use the last batch */
        if (payloadQueue.length == 0 ||
            (payloadQueue[payloadQueue.length - 1].size + messageSize > LIMITS.BATCH_SIZE) ||
            payloadQueue[payloadQueue.length - 1].locked)
            payloadQueue.push(payload);
        else
            payload = payloadQueue[payloadQueue.length - 1];

        payload.size = payload.size + messageSize;
        payload.messages.push(message)

        if(payloadQueue.length > 254){
            payloadQueue.shift();

            payloadQueue = _.takeRight(payloadQueue, 128);
            console.warn('Payload queue too large, cutting in half!');
        }
    };


    var findLogStream = function (callback) {
        function next(nextToken) {
            var params = {
                logStreamNamePrefix: self.logStreamName,
                logGroupName: self.logGroupName
            };

            if (nextToken)
                params.nextToken = nextToken;

            self.cloudWatchLogs.describeLogStreams(params, function (err, data) {
                if (err)
                    return callback(err);
                var matches = _.find(data.logStreams, function (logStream) {
                    return (logStream.logStreamName === self.logStreamName);
                });

                if (matches) {
                    return callback(null, matches);
                } else if (!data.nextToken) {
                    return callback(new Error('LogGroup and/or LogStream does not exist.'));
                } else {
                    next(data.nextToken);
                }
            })
        }

        next();
    };

    var getToken = function getToken(callback) {
        findLogStream(function (err, logStream) {
            if (err) {
                return callback(err);
            } else {
                return callback(null, logStream.uploadSequenceToken);
            }
        });
    };


    var upload = function (payload, callback) {
        getToken(function (err, sequenceToken) {
            if (err) {
                callback(err);
            } else {
                var batch = {
                    logGroupName: self.logGroupName,
                    logStreamName: self.logStreamName,
                    logEvents: payload.messages
                };
                if (sequenceToken) batch.sequenceToken = sequenceToken;

                self.cloudWatchLogs.putLogEvents(batch, function (err, data) {
                    return callback(err);
                });
            }
        })
    };


    var fb = backoff.fibonacci({
        randomisationFactor: 0.8675309,
        initialDelay: 100,
        maxDelay: 10000
    });



    fb.on('ready', function (number, delay) {

        if (payloadQueue.length > 0) {

            if (!payloadQueue[0].locked)
                payloadQueue[0].locked = true;


            upload(payloadQueue[0],
                function (err) {
                    if (err && err.code) {
                        if (err.code != "ThrottlingException" &&
                            err.code != "InvalidSequenceTokenException" &&
                            err.code != "ResourceNotFoundException" &&
                            err.code != "OperationAbortedException") {
                            //Only dump the error if it's an exception we're not expecting.
                            console.log(err.stack || err);
                        }

                        if(err.code == "ResourceNotFoundException" && number == 0){
                            console.error('LogGroup and/or LogStream does not exist.');
                        }
                        fb.backoff();
                    } else {
                        payloadQueue.shift();

                        fb.reset();
                        fb.backoff();
                    }
                });

        } else {
            fb.reset();
            fb.backoff();
        }
    });

    fb.backoff();

};

util.inherits(Transport, winston.Transport);

Transport.prototype.log = function (level, msg, meta, callback) {
    var log = {level: level, msg: msg, meta: meta};
    this.add({message: CircularJSON.stringify(log, null, '  '), timestamp: Date.now()});

    // do not wait, just return right away
    callback(null, true);
};

module.exports = Transport;
