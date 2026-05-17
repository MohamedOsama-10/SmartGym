# app/utils/cloudinary_upload.py
"""
Cloudinary file upload utility.
Replaces all local file storage with persistent Cloudinary storage.
"""

import cloudinary
import cloudinary.uploader
import os

cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME", "dfpab5tba"),
    api_key=os.environ.get("CLOUDINARY_API_KEY", "136762841611314"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET", "9k_CDzN1SbTrNWHUoXe6sYorXmk"),
    secure=True
)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_IMAGE_SIZE_MB = 10


def validate_image(file) -> None:
    """
    Validate that an uploaded file is an acceptable image.
    Raises ValueError if the file is invalid.
    """
    content_type = getattr(file, "content_type", None)
    if content_type and content_type not in ALLOWED_IMAGE_TYPES:
        raise ValueError(
            f"Invalid file type '{content_type}'. "
            f"Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )
    if hasattr(file, "size") and file.size is not None:
        if file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024:
            raise ValueError(f"File too large. Maximum size is {MAX_IMAGE_SIZE_MB}MB.")


def upload_file(file, folder: str, public_id: str = None, content_type: str = None) -> str:
    """
    Upload a file to Cloudinary and return the secure URL.
    Args:
        file: File-like object or bytes
        folder: Cloudinary folder e.g. 'avatars', 'profiles', 'gyms', 'chat'
        public_id: Optional custom public ID
        content_type: Optional MIME type hint (ignored by Cloudinary but kept for API compat)
    Returns:
        Secure HTTPS URL string
    """
    upload_options = {
        "folder": f"gym_system/{folder}",
        "resource_type": "auto",
        "overwrite": True,
    }
    if public_id:
        upload_options["public_id"] = os.path.splitext(public_id)[0]

    if hasattr(file, 'read'):
        data = file.read()
    else:
        data = file

    result = cloudinary.uploader.upload(data, **upload_options)
    return result["secure_url"]


def delete_file(url: str) -> bool:
    """
    Delete a file from Cloudinary by its URL.
    Returns True if deleted, False if not found or error.
    """
    try:
        parts = url.split("/upload/")
        if len(parts) < 2:
            return False
        path = parts[1]
        if path.startswith("v") and "/" in path:
            path = path.split("/", 1)[1]
        public_id = os.path.splitext(path)[0]
        cloudinary.uploader.destroy(public_id)
        return True
    except Exception:
        return False
