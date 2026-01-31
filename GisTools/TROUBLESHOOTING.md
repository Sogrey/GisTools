# GisTools 问题排查指南

## 🔍 快速诊断

运行以下命令快速诊断问题：

```powershell
# 1. 检查依赖
python check_deps.py

# 2. 检查端口是否被占用
netstat -ano | findstr :8000

# 3. 测试后端健康检查
curl http://localhost:8000/health
```

---

## 📋 常见问题

### 问题1：连接被拒绝

**错误信息**：`Failed to fetch` 或 `net::ERR_CONNECTION_REFUSED`

**解决方法：**
1. 确认后端已启动：
   ```powershell
   cd GisTools
   python main.py
   ```
2. 检查端口 8000 是否被占用
3. 检查防火墙设置

---

### 问题2：CORS 错误

**错误信息**：控制台显示 CORS 相关错误

**解决方法：**
检查 `GisTools/.env` 文件：
```env
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

---

### 问题3：GDAL 未安装

**后端日志显示：**
```
[WARNING] GDAL not installed, using Mock service (for testing only)
```

**解决方法：**
参考 [GDAL_INSTALL_GUIDE.md](GDAL_INSTALL_GUIDE.md) 安装 GDAL。

**快速安装（Conda 推荐）：**
```powershell
conda create -n gis python=3.11 gdal
conda activate gis
pip install -r requirements.txt
```

---

### 问题4：文件未正确保存

**后端日志显示：**
```
[服务] 错误: 无法打开文件
```

**解决方法：**
确保同目录下有以下文件：
- `hefei_xz.shp` (主文件)
- `hefei_xz.shx` (索引文件)
- `hefei_xz.dbf` (属性文件)
- `hefei_xz.prj` (投影文件，可选)

---

### 问题5：文件上传失败

**症状**：上传文件时出错

**排查步骤：**

1. **检查前端日志**（浏览器 F12 → Console）：
   ```
   [前端] 开始上传文件: xxx.shp
   [前端] 文件大小: xxxxx
   [前端] 编码: UTF-8
   [前端] 准备发送请求到: http://localhost:8000/api/xxx
   ```

2. **检查后端日志**：
   ```
   [后端] ========== 收到请求 ==========
   [后端] 请求来源: 127.0.0.1:xxxxx
   [后端] 文件名: xxx.shp
   [后端] 文件大小: xxxxx bytes
   ```

3. **确认后端服务正常**：
   访问 http://localhost:8000/docs 查看 API 文档

---

## 🔧 手动测试

### 测试 1：健康检查

```bash
curl http://localhost:8000/health
```

### 测试 2：上传转换

```bash
curl -X POST http://localhost:8000/api/shp/to-geojson \
  -F "file=@C:\path\to\file.shp" \
  -F "encoding=UTF-8"
```

---

## 📝 配置说明

编辑 `GisTools/.env` 文件修改配置：

```env
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

---

## 🚀 生产环境部署

### 使用多进程

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 使用 systemd（Linux）

创建服务文件 `/etc/systemd/system/gistools.service`：

```ini
[Unit]
Description=GisTools Backend Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/GisTools
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl enable gistools
sudo systemctl start gistools
```

---

## 🔒 安全建议

1. **限制上传文件大小**：在 `.env` 中配置 `MAX_UPLOAD_SIZE`
2. **验证文件类型**：检查文件扩展名和 Magic Number
3. **使用 HTTPS**：生产环境必须使用 HTTPS
4. **添加身份验证**：使用 JWT 或 API Key
5. **实施速率限制**：防止滥用

---

## 📊 性能优化

1. **使用多进程**：生产环境使用多个 worker
2. **增加上传大小限制**：根据需求调整 `MAX_UPLOAD_SIZE`
3. **定期清理临时文件**：设置定时任务清理 `temp/` 目录
4. **添加缓存**：对频繁访问的文件添加缓存
5. **使用 CDN**：静态资源使用 CDN 加速

---

## ❓ 需要帮助？

如果问题仍未解决，请提供：
1. 浏览器控制台的完整日志（F12 → Console）
2. 后端终端的完整日志
3. 文件名和大小
4. 使用的编码
5. 具体的错误信息
