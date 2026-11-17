"""Google Play Developer API ile .aab yukler ve bir test izine tamamlanmis surum olarak yayinlar.

`eas submit` EAS'in ucretsiz kuyrugunda saatlerce bekleyebildigi icin (2026-11-17)
dogrudan Google'in API'si kullanilir. Yalnizca `cryptography` ister (JWT imzasi).

Kullanim:
  python3 -I scripts/play-upload.py <service-account.json> <bundle.aab> <versionName> [track] [notlar.txt]
  track varsayilan "alpha" (kapali test). Notlar dosyasi tr-TR "Yenilikler" metnidir.
Anahtar yalnizca bu surecte okunur; hicbir deger ekrana basilmaz.
"""
import base64
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

PACKAGE = "com.bagajpark"
API = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{PACKAGE}"
UPLOAD = f"https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{PACKAGE}"



def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def token(sa: dict) -> str:
    now = int(time.time())
    header = b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = b64(json.dumps({
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/androidpublisher",
        "aud": sa["token_uri"],
        "iat": now,
        "exp": now + 3600,
    }).encode())
    key = serialization.load_pem_private_key(sa["private_key"].encode(), password=None)
    sig = key.sign(f"{header}.{claims}".encode(), padding.PKCS1v15(), hashes.SHA256())
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": f"{header}.{claims}.{b64(sig)}",
    }).encode()
    with urllib.request.urlopen(urllib.request.Request(sa["token_uri"], data=body), timeout=30) as r:
        return json.load(r)["access_token"]


def call(method: str, url: str, tok: str, body=None, ctype="application/json", timeout=60):
    data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {tok}")
    if data is not None:
        req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors="replace")[:800]
        print(f"HTTP {e.code} {method} {url.split('/applications/')[-1]}: {msg}")
        raise SystemExit(1)


def main():
    sa_path, aab_path, version_name = sys.argv[1], sys.argv[2], sys.argv[3]
    track_name = sys.argv[4] if len(sys.argv) > 4 else "alpha"
    notes = None
    if len(sys.argv) > 5:
        with open(sys.argv[5], encoding="utf-8") as f:
            notes = f.read().strip()[:500]  # Play siniri 500 karakter
    with open(sa_path) as f:
        sa = json.load(f)
    tok = token(sa)
    print("token alindi")

    edit = call("POST", f"{API}/edits", tok, {})
    eid = edit["id"]
    print("edit acildi")

    with open(aab_path, "rb") as f:
        bundle = f.read()
    print(f"yukleniyor: {len(bundle) / 1e6:.1f} MB")
    up = call("POST", f"{UPLOAD}/edits/{eid}/bundles?uploadType=media", tok, bundle,
              ctype="application/octet-stream", timeout=900)
    vc = str(up["versionCode"])
    print(f"bundle yuklendi: versionCode {vc}")

    release = {"name": f"{vc} ({version_name})", "versionCodes": [vc], "status": "completed"}
    if notes:
        release["releaseNotes"] = [{"language": "tr-TR", "text": notes}]
    call("PUT", f"{API}/edits/{eid}/tracks/{track_name}", tok, {"track": track_name, "releases": [release]})
    print(f"{track_name} izine eklendi")

    call("POST", f"{API}/edits/{eid}:commit", tok, None)
    print("commit tamam: surum incelemeye gonderildi")


if __name__ == "__main__":
    main()
