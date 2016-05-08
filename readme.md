# Traffic

A lightweight and configurable http reverse proxy

## 503 pages

when a service becomes unavailable traffic will attempt to serve `/var/503.html`. If that file doesn't exist it will serve a built int 503 page

## Options

round-robin: tbd

ip-hashing: tbd

rate-limiting: tbd

blacklist: tbd

logs -> rethinkdb: tbd

storing routing table in rethinkdb

docker events

## Api Interface

#### POST `/add/:host/:downstream`

#### POST `/del/:host`

#### POST `/flush`

#### POST `/info`

## Using with Docker

first you pull and start the container

```
# get it
docker pull bhurlow/traffic

# run it 
docker run -d \
  -p 80:3000 \
  -p 3500:3500 \
  bhurlow/traffic
```

then you add routes using the api 

```
curl -X POST \
 <docker-host-ip>:3500/add/hi.example.com/192.168.99.100:3500
```
