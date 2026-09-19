# GisTools 部署指南

本文档介绍如何部署 GisTools 的前端和后端服务。

## 📋 部署架构

```
┌─────────────┐
│   前端      │  GitHub Pages
│  (Vue 3)   │  https://yourname.github.io/gis-tools/
└──────┬──────┘
       │
       │ HTTPS
       │
       ↓
┌─────────────┐
│   后端      │  Docker + VPS
│  (FastAPI)  │  https://api.yourdomain.com
│   + GDAL    │  :8001
└─────────────┘
```

***

## 🚀 前端部署（GitHub Pages）

前端自动部署到 GitHub Pages，无需手动操作。

### 工作流

* 文件：`.github/workflows/deploy.yml`
* 触发：推送到 `main` 分支
* 部署位置：GitHub Pages

### 环境变量

需要在 GitHub 仓库设置中配置：

**Settings → Pages → Build and deployment → Build:**

```
Source: GitHub Actions
```

### 访问地址

```
https://<your-username>.github.io/gis-tools/
```

***

## 🔧 后端部署（Docker + VPS）

后端需要部署到支持 Docker 的服务器。

### 方案一：使用 GitHub Actions 自动部署

#### 1. 配置 GitHub Secrets

在 GitHub 仓库中设置以下 Secrets（Settings → Secrets and variables → Actions）：

**Docker Hub 相关：**

```
DOCKER_USERNAME=your-docker-username
DOCKER_PASSWORD=your-docker-password
```

**服务器相关：**

```
SERVER_HOST=your-server-ip
SERVER_USER=your-server-user
SSH_PRIVATE_KEY=your-ssh-private-key
```

#### 2. 生成 SSH 密钥

在本地生成 SSH 密钥对：

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions
```

将公钥添加到服务器：

```bash
ssh-copy-id -i ~/.ssh/github_actions.pub user@server-ip
```

将私钥添加到 GitHub Secrets：

```bash
cat ~/.ssh/github_actions
```

#### 3. 部署流程

推送代码到 `main` 分支后，自动执行：

1. ✅ 测试代码（依赖检查、代码规范）
2. ✅ 构建 Docker 镜像
3. ✅ 推送到 Docker Hub
4. ✅ 部署到服务器

***

### 方案二：手动部署 Docker

#### 1. 构建镜像

```bash
cd GisTools
docker build -t gistools-backend:latest .
```

#### 2. 运行容器

```bash
docker run -d \
  --name gistools-backend \
  --restart unless-stopped \
  -p 8001:8001 \
  -e HOST=0.0.0.0 \
  -e PORT=8001 \
  -e ALLOWED_ORIGINS=https://yourname.github.io \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/temp:/app/temp \
  gistools-backend:latest
```

#### 3. 查看日志

```bash
docker logs -f gistools-backend
```

***

### 方案三：使用 Docker Compose（推荐用于本地）

#### 1. 启动所有服务

```bash
docker-compose up -d
```

#### 2. 查看服务状态

```bash
docker-compose ps
```

#### 3. 停止服务

```bash
docker-compose down
```

***

## 🖥️ 服务器部署（VPS/云服务器）

### 1. 准备服务器

**推荐的云服务提供商：**

* 腾讯云
* 阿里云
* 阿里云 ECS
* AWS EC2
* DigitalOcean Droplet

**最低配置：**

* CPU: 1 核
* 内存: 512MB - 1GB
* 存储: 20GB
* 操作系统: Ubuntu 20.04/22.04 LTS

### 2. 安装 Docker

```bash
# 更新系统
sudo apt-get update && sudo apt-get upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
```

### 3. 配置防火墙

```bash
# 允许 SSH
sudo ufw allow 22/tcp

# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 允许后端端口（如果直接暴露）
sudo ufw allow 8001/tcp

# 启用防火墙
sudo ufw enable
```

### 4. 使用 Nginx 反向代理

#### 安装 Nginx

```bash
sudo apt-get install -y nginx
```

#### 配置 Nginx

创建配置文件 `/etc/nginx/sites-available/gistools`：

```nginx
# API 服务
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 上传文件大小限制
        client_max_body_size 100M;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:8001/health;
        access_log off;
    }
}
```

#### 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/gistools /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. 配置 HTTPS（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d api.yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

***

## 🔐 环境变量配置

创建 `.env` 文件：

```env
# 服务器配置
HOST=0.0.0.0
PORT=8000

# CORS 配置
ALLOWED_ORIGINS=https://yourname.github.io,https://yourdomain.com

# 文件上传限制（字节）
MAX_UPLOAD_SIZE=104857600  # 100MB

# 日志级别
LOG_LEVEL=INFO
```

***

## 📊 监控和维护

### 1. 查看容器状态

```bash
docker ps
docker stats gistools-backend
```

### 2. 查看日志

```bash
# 实时日志
docker logs -f gistools-backend

# 最近 100 行
docker logs --tail 100 gistools-backend
```

### 3. 更新镜像

```bash
docker pull your-docker-username/gistools-backend:latest
docker stop gistools-backend
docker rm gistools-backend
docker run -d --name gistools-backend [参数] your-docker-username/gistools-backend:latest
```

### 4. 备份数据

```bash
# 备份上传目录
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz ./GisTools/uploads

# 上传到云存储
aws s3 cp uploads-backup-*.tar.gz s3://your-backup-bucket/
```

***

## 🚨 故障排查

### 问题1：容器无法启动

```bash
# 查看容器日志
docker logs gistools-backend

# 检查端口占用
sudo netstat -tulpn | grep 8001
```

### 问题2：GDAL 相关错误

确保 Dockerfile 中正确安装了 GDAL：

```dockerfile
RUN apt-get install -y gdal-bin libgdal-dev
```

### 问题3：CORS 错误

检查 `.env` 中的 `ALLOWED_ORIGINS` 是否包含前端域名。

### 问题4：文件上传失败

检查 Nginx 配置中的 `client_max_body_size` 设置。

***

## 📈 性能优化

### 1. 使用多 Worker

```bash
docker run -d \
  --name gistools-backend \
  -p 8000:8000 \
  your-image \
  uvicorn app.main:app --host 0.0.0.0 --workers 4
```

### 2. 配置缓存

使用 Redis 缓存频繁访问的数据。

### 3. CDN 加速

将静态文件上传到 CDN（如腾讯云 COS、阿里云 OSS）。

***

## 🔗 相关文档

* [GisTools/GDAL\_INSTALL\_GUIDE.md](GisTools/GDAL_INSTALL_GUIDE.md) - GDAL 安装指南
* [GisTools/TROUBLESHOOTING.md](GisTools/TROUBLESHOOTING.md) - 问题排查
* [GisTools/ARCHITECTURE.md](GisTools/ARCHITECTURE.md) - 系统架构

***

## 📞 技术支持

如果遇到部署问题，请提供：

1. 服务器操作系统和版本
2. Docker 版本
3. 容器日志输出
4. 错误信息截图

