"""Delivery of public build assets. User files and APIs never enter this path."""
from email.utils import parsedate_to_datetime
import mimetypes
import re

from starlette.responses import FileResponse, Response


def asset_response(request, directory, target):
    hashed = bool(re.fullmatch(r"assets/.+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+", target.relative_to(directory).as_posix()))
    headers = {"Cache-Control": "public, max-age=31536000, immutable" if hashed else "no-cache"}
    # HTML, login and version metadata always come from the current installation.
    if target.suffix not in {".js", ".mjs", ".css", ".svg", ".woff2", ".ttf", ".png"}:
        return FileResponse(target, headers={"Cache-Control": "no-store"})
    media_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    encodings = {}
    for item in request.headers.get("accept-encoding", "").lower().split(","):
        parts = item.strip().split(";")
        try:
            quality = next((float(p.strip()[2:]) for p in parts[1:] if p.strip().startswith("q=")), 1.0)
        except ValueError:
            quality = 0
        encodings[parts[0]] = quality if 0 <= quality <= 1 else 0
    headers["Vary"] = "Accept-Encoding"
    if "range" not in request.headers:
        for encoding, extension in sorted((("br", ".br"), ("gzip", ".gz")), key=lambda pair: encodings.get(pair[0], encodings.get("*", 0)), reverse=True):
            candidate = target.with_name(target.name + extension)
            if encodings.get(encoding, encodings.get("*", 0)) > 0 and candidate.is_file() and candidate.resolve().is_relative_to(directory):
                target = candidate
                headers["Content-Encoding"] = encoding
                break
    response = FileResponse(target, media_type=media_type, headers=headers, stat_result=target.stat())
    etag = request.headers.get("if-none-match")
    if etag is not None:
        unchanged = any(value.strip().removeprefix("W/") in {"*", response.headers["etag"]} for value in etag.split(","))
    else:
        try:
            unchanged = parsedate_to_datetime(request.headers["if-modified-since"]) >= parsedate_to_datetime(response.headers["last-modified"])
        except (KeyError, ValueError, TypeError):
            unchanged = False
    if unchanged:
        return Response(status_code=304, headers={key: value for key, value in response.headers.items() if key in {"etag", "cache-control", "vary", "last-modified"}})
    return response
