import os
import sys
import zipfile
import shutil
from pathlib import Path

import requests
from tqdm import tqdm


MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip"
MODEL_ZIP = "vosk-model-small-cn.zip"
MODEL_DIR = "vosk-model-small-cn"


def _download(url: str, out_path: Path) -> None:
    response = requests.get(url, stream=True, timeout=60)
    response.raise_for_status()

    total_size = int(response.headers.get("content-length", 0))
    with open(out_path, "wb") as file, tqdm(
        desc="下载进度",
        total=total_size,
        unit="iB",
        unit_scale=True,
        unit_divisor=1024,
    ) as progress_bar:
        for data in response.iter_content(chunk_size=1024 * 32):
            size = file.write(data)
            progress_bar.update(size)


def download_model() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    model_dir = repo_root / MODEL_DIR
    model_zip = repo_root / MODEL_ZIP

    if model_dir.exists():
        print(f"模型已存在，跳过下载: {model_dir}")
        return

    print("开始下载中文语音模型（Vosk）...")

    try:
        _download(MODEL_URL, model_zip)
        print("\n下载完成，正在解压...")

        with zipfile.ZipFile(model_zip, "r") as zip_ref:
            zip_ref.extractall(repo_root)

        extracted_dir = repo_root / "vosk-model-small-cn-0.22"
        if extracted_dir.exists():
            extracted_dir.rename(model_dir)

        print(f"模型设置完成: {model_dir}")
    finally:
        if model_zip.exists():
            model_zip.unlink()


if __name__ == "__main__":
    try:
        download_model()
    except Exception as exc:
        print(f"下载或解压过程中出错: {exc}")
        sys.exit(1)

