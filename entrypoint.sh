#!/bin/sh
#sleep infinity
cat /etc/cron/crontab | sed '/..*/{s/$/ >> \/proc\/1\/fd\/1 2\>\/proc\/1\/fd\/2/}' > /etc/cron/crontabREDIR
crontab /etc/cron/crontabREDIR
cron  -f