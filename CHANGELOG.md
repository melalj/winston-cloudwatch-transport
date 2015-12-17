### 1.0.5

* Suppressing OperationAborted error, no need to dump it.  We're able to retry the request
* Removing async, it was unused.

### 1.0.4

* Replaced testing limits with actual values.

### 1.0.3

* Corrected package.json error
* Rewrote sending logic
    *  Now based off size of payload vs number of items
    *  Retries on failures using backoff with jitter.
    *  Put an upper limit on the maximum amount of payloads so that if the queue builds up it won't compromise application integrity
       
### 1.0.2

* Dropped cycle
* Added circular-json 

### 1.0.0

* Rewrite to support multiple cloudwatch transports inside single winston instance
* Upgrade winston dependency to 2.1.1+
* Upgrade lodash dependency to 3.10.1+
* Upgrade aws-sdk dependancy to 2.2.19+
* Added cycle to safely stringify objects


[winston-cloudwatch]:
<https://github.com/lazywithclass/winston-cloudwatch>
Forked from 
[winston-cloudwatch]