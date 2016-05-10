# Traffic

A lightweight and configurable http reverse proxy

features include:

- storing requests in a datastore (optional)
- custom error pages
- docker aware routing
- SSL

## Virtual Hosts

requests are forwarded to containers on the docker host started with the `VIRTUAL_HOST` env var

## Basic Auth

containers started on a docker host with the `BASIC_AUTH` env var will require basic auth specified in the var value, e.g. `BASIC_AUTH=foo:bar`

## 503 pages

when a service becomes unavailable traffic will attempt to serve `/var/503.html`. If that file doesn't exist it will serve a built-in 503 page

## Options

#### supported

- saving requests into rethinkdb with `RETHINK_HOST`

#### pending:

- round-robin: tbd

- ip-hashing: tbd

- rate-limiting: tbd

- blacklist: tbd

- logs -> rethinkdb: tbd

- storing routing table in rethinkdb

- docker events

- service alerts?

## Api Interface

#### POST `/add/:host/:downstream`

#### POST `/del/:host`

#### POST `/flush`

#### POST `/info`

## Using with Docker

first you pull and start the container

```bash
# get it
docker pull bhurlow/traffic

# run it 
# open up two ports, one for the proxy
# another for the api interface
docker run -d \
  -p 80:3000 \
  -p 3500:3500 \
  bhurlow/traffic
```

then you add routes using the api 

```bash
curl -X POST \
 <docker-host-ip>:3500/add/hi.example.com/192.168.99.100:3500
```
