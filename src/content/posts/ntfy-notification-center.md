---
title: 搭建个人通知中心
description: 自建开源消息推送服务：使用 ntfy 搭建个人通知中心
pubDate: 2025-08-12 13:10:05
tags: []
---

最近在使用 qbittorrent 监控 rss 追番，想要使用消息推送提醒我更新了，首先想到用 Server 酱来推送消息，但是免费账户限制太死了，所以生出了自部署推送服务的想法。

于是在服务器上使用 Docker 部署了 [ntfy](https://github.com/binwiederhier/ntfy) ，使用体验不错，记录一下部署过程。

### docker-compose.yml

```yaml
version: '3'

networks:
  app-network:
    name: ntfy-network

services:
  ntfy:
    image: binwiederhier/ntfy:latest
    container_name: ntfy
    command: serve
    restart: always
    environment:
      - TZ=Asia/Shanghai
    ports:
      - 127.0.0.1:40265:80
    volumes:
      - ./data/cache/ntfy:/var/cache/ntfy
      - ./data/lib/ntfy:/var/lib/ntfy
      - ./data/ntfy:/etc/ntfy
    user: "0:0"
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "wget -q --tries=1 http://localhost:80/v1/health -O - | grep -q 'healthy.*true' || exit 1"]
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 40s
```

> 注意：如果你使用以上配置进行部署需要自行配置反向代理，或者修改 `ports` 配置为 40265:80

### 配置文件（位于 `./data/ntfy/server.yml`）

这个配置服务我只用来推送一些非敏感信息，所以没有加鉴权相关配置，web-push 相关配置用于启用 PWA 实现桌面端推送

```yml
# 基础设置
base-url: 

web-push-public-key: 
web-push-private-key: 
web-push-file: /var/cache/ntfy/webpush.db
web-push-email-address:

# 消息缓存
cache-file: "/var/cache/ntfy/cache.db"
cache-duration: "96h"
```

配置中留空部分需要填写，参考[官方文档](https://docs.ntfy.sh/config/#web-push)

配置完成后仅用一条 curl 命令即可推送/接受消息，用起来很方便，官方提供[全平台客户端](https://ntfy.sh/)
