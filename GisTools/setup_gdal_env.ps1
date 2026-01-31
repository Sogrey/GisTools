# GDAL 环境变量设置脚本
# 在 GisTools 目录下运行此脚本，自动配置 GDAL 环境

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GDAL 环境变量设置" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 OSGeo4W 是否已安装
$osgeo4wPath = "C:\Users\Administrator\AppData\Local\Programs\OSGeo4W"

if (-not (Test-Path $osgeo4wPath)) {
    Write-Host "[错误] OSGeo4W 未安装或路径不正确" -ForegroundColor Red
    Write-Host "期望路径: $osgeo4wPath" -ForegroundColor Yellow
    Write-Host "请修改脚本中的路径，或先安装 OSGeo4W" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] OSGeo4W 安装路径: $osgeo4wPath" -ForegroundColor Green
Write-Host ""

# 设置环境变量
$env:GDAL_HOME = $osgeo4wPath
$env:GDAL_DATA = "$osgeo4wPath\share\gdal"
$env:PATH = "$osgeo4wPath\bin;$env:PATH"

Write-Host "[OK] 环境变量已设置:" -ForegroundColor Green
Write-Host "  GDAL_HOME = $env:GDAL_HOME" -ForegroundColor Gray
Write-Host "  GDAL_DATA = $env:GDAL_DATA" -ForegroundColor Gray
Write-Host "  PATH 已添加 GDAL bin" -ForegroundColor Gray
Write-Host ""

# 检查 GDAL 是否可用
Write-Host "检查 GDAL..." -ForegroundColor Cyan

$gdalCheck = & python -c "from osgeo import gdal; print(gdal.__version__)" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] GDAL 已安装，版本: $gdalCheck" -ForegroundColor Green
    Write-Host ""
    Write-Host "可以安装其他依赖了！" -ForegroundColor Green
    Write-Host "运行: pip install -r requirements.txt --ignore-installed GDAL" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "安装完成后，启动后端服务:" -ForegroundColor Yellow
    Write-Host "运行: python main.py" -ForegroundColor Yellow
} else {
    Write-Host "[错误] GDAL Python 绑定未找到" -ForegroundColor Red
    Write-Host ""
    Write-Host "正在尝试安装 GDAL Python 绑定..." -ForegroundColor Yellow

    # 首先尝试安装 GDAL
    & pip install GDAL==3.11.1 2>&1 | Write-Host

    $gdalCheck = & python -c "from osgeo import gdal; print(gdal.__version__)" 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] GDAL 安装成功，版本: $gdalCheck" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "GDAL 安装失败。请手动执行以下步骤：" -ForegroundColor Red
        Write-Host ""
        Write-Host "方案 1: 使用 OSGeo4W Shell（推荐）：" -ForegroundColor Cyan
        Write-Host "  1. 打开开始菜单 → OSGeo4W → OSGeo4W Shell" -ForegroundColor Gray
        Write-Host "  2. 在 OSGeo4W Shell 中激活虚拟环境：" -ForegroundColor Gray
        Write-Host "     cd /d d:/github/gis/gis-tools/GisTools" -ForegroundColor Gray
        Write-Host "     ..\\.venv\\Scripts\\activate" -ForegroundColor Gray
        Write-Host "  3. 安装依赖（跳过 GDAL 编译）：" -ForegroundColor Gray
        Write-Host "     pip install -r requirements.txt --ignore-installed GDAL" -ForegroundColor Gray
        Write-Host ""
        Write-Host "方案 2: 手动下载 wheel 文件：" -ForegroundColor Cyan
        Write-Host "  访问 https://www.lfd.uci.edu/~gohlke/pythonlibs/#gdal" -ForegroundColor Gray
        Write-Host "  下载对应版本的 GDAL wheel 文件，然后：" -ForegroundColor Gray
        Write-Host "  pip install GDAL‑<version>‑cp<version>‑cp<version>‑win_amd64.whl" -ForegroundColor Gray
        Write-Host ""
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
