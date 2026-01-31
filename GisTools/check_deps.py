"""
检查 Python 依赖安装情况
"""
import sys

print("=" * 60)
print("Python 环境检查")
print("=" * 60)
print(f"Python 版本: {sys.version}")
print(f"Python 路径: {sys.executable}")
print()

# 检查依赖包
packages = [
    "fastapi",
    "uvicorn",
    "python_multipart",
    "gdal",
    "pyproj",
    "shapely",
    "aiofiles",
    "pydantic",
    "pydantic_settings",
]

print("=" * 60)
print("依赖包检查")
print("=" * 60)
for pkg in packages:
    try:
        __import__(pkg)
        print(f"[OK] {pkg}")
    except ImportError:
        print(f"[MISSING] {pkg} ❌")

print()
print("=" * 60)
print("如果发现缺失的包，请运行:")
print("pip install -r requirements.txt")
print("=" * 60)
