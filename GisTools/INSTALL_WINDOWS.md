# Windows 环境下 GDAL 安装指南

## 方式一：使用预编译的 wheel 包（推荐）

### 1. 下载 GDAL wheel

访问 https://www.lfd.uci.edu/~gohlke/pythonlibs/#gdal

根据你的 Python 版本和系统下载对应的 whl 文件：
- Python 3.11 + Windows 64位：下载 `GDAL‑3.11.1‑cp311‑cp311‑win_amd64.whl`

### 2. 安装 wheel

```bash
cd GisTools
pip install GDAL‑3.11.1‑cp311‑cp311‑win_amd64.whl
```

### 3. 安装其他依赖

```bash
pip install -r requirements.txt
```

## 方式二：使用 OSGeo4W（完整安装）

### 1. 下载 OSGeo4W

访问 https://trac.osgeo.org/osgeo4w/

下载 OSGeo4W 网络安装器：osgeo4w-setup-x86_64.exe

### 2. 安装 GDAL

1. 运行安装程序
2. 选择 "Express Install"
3. 选择 "Command Line Utilities"
4. 在列表中选择 GDAL 及其依赖
5. 完成安装

### 3. 配置环境变量

将以下路径添加到系统 PATH：
```
C:\OSGeo4W\bin
```

### 4. 安装 Python GDAL 绑定

```bash
pip install gdal
```

## 方式三：使用 Conda（最简单）

### 1. 安装 Miniconda 或 Anaconda

### 2. 创建环境并安装 GDAL

```bash
conda create -name gistools python=3.11
conda activate gistools
conda install -c conda-forge gdal
```

### 3. 安装其他依赖

```bash
pip install -r requirements.txt
```

## 验证安装

运行以下命令验证 GDAL 是否正确安装：

```python
python -c "from osgeo import ogr; print('GDAL 版本:', ogr.__version__)"
```

如果输出版本号，说明安装成功。

## 常见问题

### 问题1：找不到 GDAL DLL

**解决方案**：
1. 确保已添加 OSGeo4W\bin 到 PATH
2. 或设置环境变量：
   ```bash
   set GDAL_DATA=C:\OSGeo4W\share\gdal
   set PATH=C:\OSGeo4W\bin;%PATH%
   ```

### 问题2：ImportError: DLL load failed

**解决方案**：
1. 确保 Visual C++ Redistributable 已安装
2. 下载：https://aka.ms/vs/17/release/vc_redist.x64.exe

### 问题3：pip install gdal 失败

**解决方案**：
使用方式一下载对应的 wheel 文件安装。

## 推荐方案

对于 Windows 开发环境，推荐使用 **方式三（Conda）**，最简单可靠。
