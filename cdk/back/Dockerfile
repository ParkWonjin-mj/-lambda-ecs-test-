FROM --platform=linux/amd64 golang:1.19.4-buster AS builder

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
RUN go mod download

COPY main.go ./
COPY main.go ./en

RUN GOARCH=amd64 GOOS=linux CGO_ENABLED=0 go build -o /back

FROM --platform=linux/amd64 node:20-alpine


RUN apk --no-cache add curl

WORKDIR /

COPY --from=builder /back /back
COPY --from=builder /back /back
COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh

EXPOSE 1235

# ENTRYPOINT [ "/back" ]
ENTRYPOINT [ "/entrypoint.sh", "/back" ]