# winston-cloudwatch-transport <br />

Send logs to Amazon Cloudwatch using Winston.

## Installation

```
npm install winston winston-cloudwatch-transport
```

## Configuration


### By File
AWS configuration works using `~/.aws/credentials` as written in [AWS JavaScript SDK guide](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html#Setting_AWS_Credentials).

### By Environment Variables

``` 
AWS_ACCESS_KEY_ID = <Your AWS Access key>
AWS_SECRET_KEY = <Your AWS Secret Key>
AWS_REGION = <Region containing your CloudWatch Log Group>
```

## Usage

### Options
 * logGroupName
 * logStreamName 
 * name - _Optional_ Defaults to "cloudwatch" + logGroupName + logStreamName
 * level - _Optional_ Defaults to debug
 * awsAccessKeyId - _Optional if provided by environment variable AWS_ACCESS_KEY_ID or ~/.aws/credentials/_
 * awsSecretKey - _Optional if provided by environment variable AWS_SECRET_KEY or ~/.aws/credentials/_
 * awsRegion - _Optional if provided by environment variable AWS_REGION_

#### Example
``` js
var winston = require('winston');

winston.transports.<Transport Name> = new require('winston-cloudwatch-transport', {
    logGroupName: <Log Group Name>,
    logStreamName: <Log Stream Name>
});
```
