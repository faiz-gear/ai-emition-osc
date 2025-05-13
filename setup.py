import os
import sys
import requests
import zipfile
import shutil
from tqdm import tqdm

def download_model():
    model_url = "https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip"
    model_zip = "vosk-model-small-cn.zip"
    model_dir = "vosk-model-small-cn"
    
    print("开始下载中文语音模型...")
    
    # 如果模型目录已存在，跳过下载
    if os.path.exists(model_dir):
        print("模型已存在，跳过下载")
        return
    
    try:
        # 下载模型
        response = requests.get(model_url, stream=True)
        total_size = int(response.headers.get('content-length', 0))
        
        with open(model_zip, 'wb') as file, tqdm(
            desc="下载进度",
            total=total_size,
            unit='iB',
            unit_scale=True,
            unit_divisor=1024,
        ) as progress_bar:
            for data in response.iter_content(chunk_size=1024):
                size = file.write(data)
                progress_bar.update(size)
        
        print("\n下载完成，正在解压...")
        
        # 解压模型
        with zipfile.ZipFile(model_zip, 'r') as zip_ref:
            zip_ref.extractall(".")
        
        # 重命名文件夹
        if os.path.exists("vosk-model-small-cn-0.22"):
            if os.path.exists(model_dir):
                shutil.rmtree(model_dir)
            os.rename("vosk-model-small-cn-0.22", model_dir)
        
        # 清理zip文件
        os.remove(model_zip)
        
        print("模型设置完成！")
        
    except Exception as e:
        print(f"下载或解压过程中出错: {str(e)}")
        if os.path.exists(model_zip):
            os.remove(model_zip)
        sys.exit(1)

if __name__ == "__main__":
    # 安装依赖
    print("安装依赖...")
    os.system("pip install -r requirements.txt")
    os.system("pip install tqdm")  # 安装进度条库
    
    # 下载模型
    download_model()
    
    print("\n设置完成！现在可以运行 python main.py 启动程序了。") 