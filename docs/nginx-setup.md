# Nginx 本地开发环境配置指南

本文档介绍如何使用 Nginx 配置本地开发环境，将域名 `search.aidimsum.com` 指向本地开发服务器（端口 3000）。

## 目录
- [安装步骤](#安装步骤)
- [配置说明](#配置说明)
- [HTTPS 配置](#https-配置)
- [WeChat 登录调试配置](#wechat-登录调试配置)
- [常用命令](#常用命令)
- [故障排除](#故障排除)
- [卸载说明](#卸载说明)

## 安装步骤

1. 安装 Nginx
```bash
brew install nginx
```

2. 创建 Nginx 服务器配置目录
```bash
sudo mkdir -p /opt/homebrew/etc/nginx/servers
```

3. 启动 Nginx 服务
```bash
brew services start nginx
```

## 配置说明

### 1. 配置 hosts 文件
```bash
sudo nano /etc/hosts
```
在文件末尾添加：
```
127.0.0.1 search.aidimsum.com
```

### 2. 配置 Nginx
```bash
echo 'server {
    listen 80;
    server_name search.aidimsum.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}' | sudo tee /opt/homebrew/etc/nginx/servers/search.aidimsum.com.conf
```

### 3. 验证配置
1. 确保本地开发服务器（端口 3000）正在运行
2. 在浏览器中访问 http://search.aidimsum.com
3. 如果遇到问题，可以查看 Nginx 错误日志：
```bash
tail -f /opt/homebrew/var/log/nginx/error.log
```

## HTTPS 配置

### 1. 生成 SSL 证书
使用 mkcert 工具生成本地开发证书：

1. 安装 mkcert
```bash
brew install mkcert
mkcert -install
```

2. 为域名生成证书
```bash
mkcert search.aidimsum.com
```
这将生成两个文件：
- `search.aidimsum.com.pem` (证书)
- `search.aidimsum.com-key.pem` (私钥)

### 2. 配置 Nginx HTTPS
```bash
echo 'server {
    listen 80;
    server_name search.aidimsum.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name search.aidimsum.com;

    ssl_certificate /path/to/search.aidimsum.com.pem;
    ssl_certificate_key /path/to/search.aidimsum.com-key.pem;
    
    # SSL 配置优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_stapling off;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}' | sudo tee /opt/homebrew/etc/nginx/servers/search.aidimsum.com.conf
```

注意：请将 `/path/to/` 替换为实际的证书文件路径。

### 3. 验证 HTTPS 配置
1. 重启 Nginx 服务：
```bash
brew services restart nginx
```

2. 在浏览器中访问 https://search.aidimsum.com
3. 确认浏览器显示安全连接（绿色锁图标）

### 4. 常见问题
1. 证书不受信任
   - 确保已运行 `mkcert -install`
   - 检查证书文件路径是否正确
   - 确认证书文件权限正确

2. 无法访问 HTTPS
   - 检查 Nginx 错误日志
   - 确认 443 端口未被占用
   - 验证 SSL 配置语法是否正确

## WeChat 登录调试配置

### 1. 前置检查
- 确保 hosts 文件配置正确（见[配置说明](#配置说明)）
- 确保 Nginx 配置正确（见[配置说明](#配置说明)）
- 确保本地开发服务器正在运行

### 2. 配置验证
1. 重启 Nginx 服务：
```bash
brew services restart nginx
```

2. 验证配置：
   - 在浏览器中访问 http://search.aidimsum.com
   - 确保能够正常访问本地开发服务器
   - 如果遇到重定向问题，检查 Nginx 错误日志：
```bash
tail -f /opt/homebrew/var/log/nginx/error.log
```

## 常用命令

### 服务管理
- 启动 Nginx 服务：
```bash
brew services start nginx
```

- 停止 Nginx 服务：
```bash
brew services stop nginx
```

- 重启 Nginx 服务：
```bash
brew services restart nginx
```

### 配置检查
- 检查 Nginx 配置是否正确：
```bash
nginx -t
```

## 故障排除

### 常见问题
1. 无法访问网站
   - 检查 hosts 文件配置是否正确
   - 确认 Nginx 服务是否正在运行
   - 验证本地开发服务器是否正在运行
   - 查看 Nginx 错误日志
   - 如果使用 HTTPS，确认证书配置正确

2. Nginx 无法启动
   - 检查配置文件语法是否正确
   - 确认端口 80/443 是否被其他程序占用
   - 验证是否有足够的权限
   - 检查 SSL 证书路径和权限

### 注意事项
1. 本地开发环境建议使用 HTTP 协议
2. 如果需要 HTTPS 支持，请参考 [HTTPS 配置](#https-配置) 章节
3. 确保本地开发服务器（端口 3000）正在运行
4. 如果修改了配置文件，需要重启 Nginx 服务才能生效

## 卸载说明

如果需要卸载 Nginx，可以执行：
```bash
brew services stop nginx
brew uninstall nginx
``` 