# open-pokemon-claw Nginx 生产路由建议（2026-03-13）

目标：

- 保留 Node 聚合层处理动态接口与 WebSocket
- 对静态资源施加更明确的缓存策略
- 避免所有请求都走同一条粗粒度代理规则

## 推荐路由结构

```nginx
location = /open-pokemon-claw {
    return 301 /open-pokemon-claw/;
}

# websocket：长连接，不缓存
location ^~ /open-pokemon-claw/ws/ {
    proxy_pass http://127.0.0.1:3008/ws/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600;
    proxy_send_timeout 3600;
    add_header Cache-Control "no-store" always;
}

# API：动态接口，不缓存
location ^~ /open-pokemon-claw/api/ {
    proxy_pass http://127.0.0.1:3008/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_read_timeout 3600;
    proxy_send_timeout 3600;
    add_header Cache-Control "no-store" always;
}

# hash 后的构建产物：长缓存
location ^~ /open-pokemon-claw/assets/ {
    proxy_pass http://127.0.0.1:3008/assets/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    access_log off;
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable" always;
    add_header X-Content-Type-Options "nosniff" always;
}

# vendor 和文档预览图：中长缓存
location ^~ /open-pokemon-claw/vendor/ {
    proxy_pass http://127.0.0.1:3008/vendor/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    access_log off;
    expires 7d;
    add_header Cache-Control "public, max-age=604800" always;
    add_header X-Content-Type-Options "nosniff" always;
}

location ^~ /open-pokemon-claw/docs/ {
    proxy_pass http://127.0.0.1:3008/docs/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    access_log off;
    expires 7d;
    add_header Cache-Control "public, max-age=604800" always;
    add_header X-Content-Type-Options "nosniff" always;
}

# 根页面：短缓存，便于发布后尽快拿到新 index
location ^~ /open-pokemon-claw/ {
    proxy_pass http://127.0.0.1:3008/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600;
    proxy_send_timeout 3600;
    add_header Cache-Control "public, max-age=60, stale-while-revalidate=300" always;
}
```

## 说明

### 为什么要拆开

原来所有 `/open-pokemon-claw/` 请求都走一条代理：

- 静态资源无法单独设缓存策略
- API/WS/HTML 的行为混在一起
- 不利于长期挂页和资源优化

拆开后：

- `assets/` 可以长缓存
- `api/` 明确 no-store
- `ws/` 明确走 upgrade
- 根 HTML 保持短缓存

### 为什么仍然保留 Node 提供静态资源

当前已经做成：

- 开发模式：源码直跑
- 生产模式：`dist/` 轻构建产物 + Node 动态聚合

这版先不强依赖把静态文件拷到 Nginx 本地目录，而是继续让 Node 提供 `dist/`，这样：

- 改造小
- 部署简单
- 行为一致

后续如果要继续降资源，再把 `dist/` 直接交给 Nginx `alias` 即可。
