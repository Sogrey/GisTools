# GDAL 安装指南 (Windows)

## 推荐方法：使用 OSGeo4W

### 1. 下载并安装 OSGeo4W

1. 访问：https://trac.osgeo.org/osgeo4w/
2. 下载：`osgeo4w-setup-x86_64.exe`
3. 运行安装器，选择 **Express Install**
4. 在软件包选择界面，勾选：
   - ✅ `gdal`
   - ✅ `gdal-python` (如果有)
   - ✅ `python3`

5. 安装路径默认：`C:\Users\{UserName}\AppData\Local\Programs\OSGeo4W\`
   - 实际安装路径：`C:\Users\Administrator\AppData\Local\Programs\OSGeo4W`

### 2. 配置系统环境变量

打开 **系统属性 → 高级 → 环境变量**，添加以下变量：

**系统变量 - 新建：**
- `GDAL_HOME` = `C:\Users\Administrator\AppData\Local\Programs\OSGeo4W`
- `GDAL_DATA` = `C:\Users\Administrator\AppData\Local\Programs\OSGeo4W\share\gdal`

**系统变量 - PATH - 编辑：**
在 PATH 的最前面添加：
```
C:\Users\Administrator\AppData\Local\Programs\OSGeo4W\bin;
```

> 💡 **提示**：如果你的用户名不是 `Administrator`，请替换为你的实际用户名。

### 3. 在虚拟环境中使用 GDAL

#### 方式一：使用 OSGeo4W 的 Python GDAL（推荐）

OSGeo4W 安装时已经包含了 Python GDAL 绑定，直接使用即可：

```powershell
# 进入项目目录
cd D:\github\gis\gis-tools\GisTools

# 激活虚拟环境
.venv\Scripts\Activate.ps1

# 设置 GDAL 环境变量
$env:GDAL_HOME = "C:\Users\Administrator\AppData\Local\Programs\OSGeo4W"
$env:GDAL_DATA = "C:\Users\Administrator\AppData\Local\Programs\OSGeo4W\share\gdal"

# 添加 GDAL bin 到 PATH（临时）
$env:PATH = "C:\Users\Administrator\AppData\Local\Programs\OSGeo4W\bin;$env:PATH"

# 安装其他依赖（不安装 GDAL，使用 OSGeo4W 的）
pip install -r requirements.txt --ignore-installed GDAL
```

#### 方式二：使用 OSGeo4W Shell（最简单）

直接使用 OSGeo4W 提供的 Python 环境：

```powershell
# 打开 OSGeo4W Shell（开始菜单 → OSGeo4W → OSGeo4W Shell）

# 在 OSGeo4W Shell 中
cd D:\github\gis\gis-tools\GisTools

# OSGeo4W 的 Python 已经包含了 GDAL
pip install -r requirements.txt --ignore-installed GDAL
python main.py
```

#### 方式三：手动设置环境变量

如果你想在虚拟环境中使用 GDAL：

```powershell
# 进入项目目录
cd D:\github\gis\gis-tools\GisTools

# 激活虚拟环境
.venv\Scripts\Activate.ps1

# 设置 GDAL 环境变量
$env:GDAL_HOME = "C:\Users\Administrator\AppData\Local\Programs\OSGeo4W"
$env:GDAL_DATA = "C:\Users\Administrator\AppData\Local\Programs\OSGeo4W\share\gdal"

# 添加 GDAL bin 到 PATH（临时）
$env:PATH = "C:\Users\Administrator\AppData\Local\Programs\OSGeo4W\bin;$env:PATH"

# 安装依赖（不安装 GDAL，直接使用 OSGeo4W 的）
pip install -r requirements.txt --ignore-installed GDAL
```

#### 方式四：使用自动设置脚本（推荐）

项目中提供了自动设置脚本 `setup_gdal_env.ps1`，它会自动配置所有环境变量：

```powershell
# 进入项目目录
cd D:\github\gis\gis-tools\GisTools

# 激活虚拟环境
.venv\Scripts\Activate.ps1

# 运行环境变量设置脚本
.\setup_gdal_env.ps1

# 安装依赖（不安装 GDAL）
pip install -r requirements.txt --ignore-installed GDAL
```

脚本会自动：
- ✅ 检测 OSGeo4W 安装路径
- ✅ 设置 GDAL_HOME、GDAL_DATA 环境变量
- ✅ 添加 GDAL bin 到 PATH
- ✅ 验证 GDAL 是否可用
- ✅ 给出下一步操作提示

> ⚠️ **重要提示**：不要使用 `pip install GDAL --no-binary GDAL` 命令，这会尝试从源码编译 GDAL，通常会因为缺少 C 编译器或头文件而失败。直接使用 OSGeo4W 提供的 GDAL 即可。

### 4. 验证安装

```powershell
python -c "from osgeo import gdal; print(gdal.__version__)"
```

如果成功输出版本号，说明安装成功！

---

## 替代方法：使用 Conda（推荐）

如果你愿意安装 Anaconda 或 Miniconda，这是最简单的方法：

### 安装 Miniconda

1. 下载：https://docs.conda.io/en/latest/miniconda.html
2. 安装完成后，创建新环境：

```powershell
# 创建专门用于 GIS 项目的环境
conda create -n gis python=3.11 gdal

# 激活环境
conda activate gis

# 进入项目目录
cd D:\github\gis\gis-tools\GisTools

# 安装其他依赖
pip install -r requirements.txt
```

---

## 替代方法：使用预编译的 wheel 包

如果你不想安装 OSGeo4W 或 conda，可以尝试使用第三方提供的预编译包：

```powershell
# 使用 Gohlke 的预编译包（如果可用）
# 访问：https://www.lfd.uci.edu/~gohlke/pythonlibs/#gdal
# 下载对应 Python 版本的 .whl 文件，然后：

pip install GDAL-3.4.3-cp311-cp311-win_amd64.whl
```

---

## 故障排除

### 错误：找不到 gdal.h

**原因**：缺少 GDAL 的 C++ 库
**解决**：必须先安装 OSGeo4W 或使用 conda

### 错误：DLL 加载失败

**原因**：PATH 环境变量未正确设置
**解决**：确保 `C:\OSGeo4W\bin` 在 PATH 的最前面

### 错误：找不到 gdal_data 目录

**原因**：GDAL_DATA 环境变量未设置
**解决**：设置 `GDAL_DATA = C:\OSGeo4W\share\gdal`

---

## 项目中使用

安装完成后，重启后端服务：

```powershell
cd D:\github\gis\gis-tools\GisTools
.venv\Scripts\Activate.ps1
python main.py
```

现在系统应该会自动检测到 GDAL 并使用真实模式而不是 Mock 模式。

---

## 推荐顺序

**最简单** → **最复杂**

1. **Conda**（如果可以安装）
2. **OSGeo4W**（Windows 最常用的方案）
3. **预编译 wheel**（依赖第三方，可能版本不匹配）
4. **从源码编译**（最复杂，不推荐）

---

## 验证转换功能

安装 GDAL 后，测试转换功能：

1. 访问：http://localhost:5173/GisTools/tools/shp2geojson
2. 上传 `hefei_xz.shp` 文件
3. 转换成功后，检查日志是否显示：
   ```
   [INFO] GDAL 3.4.3 is installed
   [INFO] Using GDAL service for GeoJSON
   ```
   而不是：
   ```
   [WARNING] GDAL not installed, using Mock service
   ```

如果看到 "Using GDAL service"，说明 GDAL 已成功安装并启用！

### 快速测试命令

#### 在虚拟环境中（方式一）

```powershell
# 激活虚拟环境
cd D:\github\gis\gis-tools\GisTools
.venv\Scripts\Activate.ps1

# 运行设置脚本
.\setup_gdal_env.ps1

# 安装其他依赖（忽略 GDAL）
pip install -r requirements.txt --ignore-installed GDAL

# 验证所有依赖
python check_deps.py

# 启动后端
python main.py
```

#### 在 OSGeo4W Shell 中（方式二，推荐）

```powershell
# 打开 OSGeo4W Shell
# 开始菜单 → OSGeo4W → OSGeo4W Shell

# 进入项目目录
cd D:\github\gis\gis-tools\GisTools

# 安装依赖（忽略 GDAL）
pip install -r requirements.txt --ignore-installed GDAL

# 验证所有依赖
python check_deps.py

# 启动后端
python main.py
```

如果所有检查都通过，后端将在 http://localhost:8001 启动，并显示：
```
[INFO] GDAL 3.x.x is installed
[INFO] GisTools backend service starting...
```
