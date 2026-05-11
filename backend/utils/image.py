from io import BytesIO
from PIL import Image


def compress_image(image_data: bytes, max_size: int = 1024, quality: int = 85) -> bytes:
    img = Image.open(BytesIO(image_data))
    if img.mode != "RGB":
        img = img.convert("RGB")

    w, h = img.size
    if w > max_size or h > max_size:
        if w > h:
            new_w = max_size
            new_h = int(h * (max_size / w))
        else:
            new_h = max_size
            new_w = int(w * (max_size / h))
        img = img.resize((new_w, new_h), Image.LANCZOS)

    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=quality, optimize=True)
    return buffer.getvalue()


def create_thumbnail(image_data: bytes, max_size: int = 200) -> bytes:
    img = Image.open(BytesIO(image_data))
    if img.mode != "RGB":
        img = img.convert("RGB")

    img.thumbnail((max_size, max_size), Image.LANCZOS)

    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=60, optimize=True)
    return buffer.getvalue()
