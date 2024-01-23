#!/bin/sh

## Sigterm Handler
sigterm_handler() { 
  if [ $pid -ne 0 ]; then
    echo "start shutdown..."
    sleep 30 # DNSのTTLの時間分まつ
    kill -15 "$pid"
    wait "$pid"
  fi
  exit 143; # 128 + 15 -- SIGTERM
}

## Setup signal trap
trap 'sigterm_handler' SIGTERM
trap 'sigterm_handler' SIGINT # ローカル開発用にSIGINTもトラップする

## Start Process
"$@" &
pid="$!"

## Wait forever until app dies
wait "$pid"
return_code="$?"

exit $return_code