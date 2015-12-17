var _ = require('lodash');
var winston = require('winston');


var logGroupName = "testing";
var logStreamName = "testing";

winston.transports.Cloudwatch_1 = new require('../lib/winston-cloudwatch-transport', {
    name: "cloudwatch_1",
    logGroupName: logGroupName,
    logStreamName: logStreamName
});

//winston.transports.Cloudwatch_2 = new require('../lib/winston-cloudwatch-transport', {
//    name: "cloudwatch_2",
//    logGroupName: logGroupName,
//    logStreamName: logStreamName
//});

winston.loggers.add('default', {
    console: {
        level: 'fatal'
    },
    cloudwatch_1: {
        name: "cloudwatch_1",
        logGroupName: logGroupName,
        logStreamName: logStreamName,
        level: 'silly'
    },
    //cloudwatch_2: {
    //    name: "cloudwatch_2",
    //    logGroupName: logGroupName,
    //    logStreamName: logStreamName,
    //    level: 'silly'
    //}
});
var logger_default = winston.loggers.get("default");

var testMessage = "I am a test message.  I am a test message.  I am a test message.";


var log = function(){
    var time =  Date.now();

    logger_default.silly(testMessage + time.toString());
};

setInterval(log, 7);