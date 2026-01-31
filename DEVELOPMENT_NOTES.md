# 开发经验总结

## 项目概述
GIS 工具箱网站，提供 SHP 转 GeoJSON 等地理数据转换功能。

## 技术栈

### 前端
- Vue 3 + TypeScript
- Vite 构建工具
- 暗色科技风格主题

### 后端
- Python 3.11+
- FastAPI 框架
- GDAL (地理数据处理库)
- 支持 Mock 模式（无 GDAL 时）

## 常见问题及解决方案

### 1. Vue 组件错误：`ref is not defined`

**问题：**
```javascript
ReferenceError: ref is not defined
```

**解决：**
```typescript
import { ref, computed } from 'vue'
```

### 2. Windows 编码问题

**问题：**控制台输出包含 emoji 时，Windows PowerShell 报编码错误。

**解决：**将所有 emoji 替换为纯文本。

### 3. 上传进度一直显示 0%

**问题：**使用 `fetch` API 无法获取上传进度。

**解决：**使用 `XMLHttpRequest` 替代 `fetch`：
```javascript
const xhr = new XMLHttpRequest()
xhr.upload.onprogress = (event) => {
  if (event.lengthComputable) {
    const percent = Math.round((event.loaded * 100) / event.total)
    progress.value = percent
  }
}
```

### 4. Pydantic v2 可选字段

**问题：**`download_url: str = None` 导致验证错误。

**解决：**使用 `str | None = None` 语法：
```python
class ConversionResponse(BaseModel):
    download_url: str | None = None
```

### 5. GDAL 未安装

**解决：**
- 开发时使用 Mock 模式
- 生产环境参考 [GisTools/GDAL_INSTALL_GUIDE.md](GisTools/GDAL_INSTALL_GUIDE.md) 安装 GDAL

## 最佳实践

### 1. 路径管理

**始终使用绝对路径：**
```python
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
```

**相对路径的问题：**
- Python 运行目录不同会导致路径错误
- 不容易调试

### 2. 配置管理

**集中配置：**
```python
class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    UPLOAD_DIR: str = "..."

settings = Settings()
```

**优势：**
- 便于修改配置
- 支持环境变量覆盖
- 类型安全

### 3. 日志记录

**详细的日志帮助调试：**
```python
print(f"[后端] 文件名: {file.filename}")
print(f"[后端] 文件大小: {file.size}")
print(f"[后端] 保存路径: {output_path}")
```

**前端日志：**
```javascript
console.log('[前端] 开始上传文件:', selectedFile.value.name)
console.log('[前端] 上传进度:', percent + '%')
```

### 4. 错误处理

**前后端都有错误处理：**

后端：
```python
try:
    result = convert_file()
    return {"success": True, "data": result}
except Exception as e:
    print(f"[错误] {str(e)}")
    raise HTTPException(status_code=500, detail=str(e))
```

前端：
```javascript
try {
    const response = await uploadFile()
    // 处理成功
} catch (error) {
    console.error('[前端] 上传失败:', error)
    result.error = error.message
}
```

### 5. CORS 配置

**允许前端访问：**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 6. 文件清理

**使用 BackgroundTasks 清理临时文件：**
```python
@app.post("/convert")
async def convert(background_tasks: BackgroundTasks):
    # 处理文件
    background_tasks.add_task(
        lambda: shutil.rmtree(temp_dir, ignore_errors=True)
    )
```

---

## 调试技巧

### 1. 使用独立的测试脚本

创建专门的测试脚本验证功能：
```python
# test_download.py
import requests

response = requests.get("http://localhost:8001/api/download/test.geojson")
print(f"状态码: {response.status_code}")
print(f"内容: {response.text}")
```

### 2. 分离启动前后端

使用两个独立终端：
```bash
# 终端1 - 后端
cd GisTools
python main.py

# 终端2 - 前端
cd gis-tools
pnpm run dev
```

**优势：**
- 清楚看到两边的日志
- 便于调试问题

### 3. 添加诊断日志

在关键位置添加日志：
```python
print(f"[诊断] _BASE_DIR: {_BASE_DIR}")
print(f"[诊断] UPLOAD_DIR: {UPLOAD_DIR}")
print(f"[诊断] 文件存在: {os.path.exists(file_path)}")
```

### 4. 使用 Swagger 文档

FastAPI 自动生成 API 文档：
```
http://localhost:8001/docs
```

**用途：**
- 测试接口
- 查看请求/响应格式
- 在线调试

---

## 性能优化建议

### 1. 文件上传限制

```python
MAX_UPLOAD_SIZE: int = 104857600  # 100MB
```

### 2. 异步处理

对于大文件转换，使用后台任务：
```python
from fastapi import BackgroundTasks

@app.post("/convert")
async def convert(background_tasks: BackgroundTasks):
    # 快速返回
    background_tasks.add_task(process_file)
```

### 3. 文件过期清理

定期清理过期的文件：
```python
import time

def cleanup_old_files():
    now = time.time()
    for filename in os.listdir(UPLOAD_DIR):
        filepath = os.path.join(UPLOAD_DIR, filename)
        if os.path.getmtime(filepath) < now - 3600:  # 1小时
            os.remove(filepath)
```

---

## 部署建议

### 1. 环境变量

使用 `.env` 文件管理配置：
```bash
# .env
HOST=0.0.0.0
PORT=8001
UPLOAD_DIR=./uploads
```

### 2. 前端构建

```bash
pnpm run build
```

### 3. 后端生产部署

```bash
# 使用 gunicorn 或 uvicorn
uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4
```

### 4. Nginx 配置

反向代理前后端：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
    }
}
```

---

## 总结

1. **路径问题**是最常见的错误来源，始终使用绝对路径
2. **端口冲突**会导致奇怪的请求失败，使用 netstat 检查
3. **详细日志**是调试的关键
4. **前后端分离启动**便于问题定位
5. **Mock 模式**对开发测试很有帮助
6. **CORS 配置**不要忘记，否则跨域请求失败

遵循这些经验，可以避免大部分常见问题。
