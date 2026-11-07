#!/usr/bin/env python3
"""部署前门禁：拦 </html> 后的垃圾、重复 DOCTYPE、内联脚本语法错误、sitemap 死链。"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
HTML_FILES = [ROOT / "index.html", ROOT / "login.html", ROOT / "404.html"]
ADMIN_FILES = [ROOT / "_upload" / "admin.html", ROOT / "_admin_clean.html", ROOT / "_admin_pure.html"]
errors = []


def strip_text_plain(html: str) -> str:
    return re.sub(r'<script[^>]*type=["\']text/plain["\'][^>]*>.*?</script>', "", html, flags=re.I | re.S)


def check_trailing(name: str, html: str):
    ends = list(re.finditer(r"</html\s*>", html, re.I))
    if not ends:
        errors.append(f"{name}: 缺少 </html>")
        return
    tail = html[ends[-1].end():].strip()
    if tail.startswith("</script>"):
        tail = tail[len("</script>"):].strip()
    if tail:
        errors.append(f"{name}: </html> 后仍有 {len(tail)} 字符内容：{tail[:60]!r}")


def check_doctype(name: str, html: str):
    clean = strip_text_plain(html)
    n = len(re.findall(r"<!DOCTYPE", clean, re.I))
    if n != 1:
        errors.append(f"{name}: DOCTYPE 数量为 {n}（应为 1，已忽略 text/plain 内嵌模板）")


def check_inline_scripts(name: str, html: str):
    blocks = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", strip_text_plain(html), re.S | re.I)
    for i, body in enumerate(blocks):
        if not body.strip():
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
            f.write(body)
            tmp = f.name
        r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
        if r.returncode != 0:
            errors.append(f"{name}: 内联脚本 #{i} 语法错误：{r.stderr.strip().splitlines()[-1]}")
        Path(tmp).unlink(missing_ok=True)


def check_sitemap():
    sm = ROOT / "sitemap.xml"
    if not sm.exists():
        return
    text = sm.read_text(encoding="utf-8")
    locs = re.findall(r"<loc>([^<]+)</loc>", text)
    for loc in locs:
        path = re.sub(r"^https?://[^/]+", "", loc).split("#")[0].split("?")[0] or "/"
        if path == "/":
            continue
        target = ROOT / path.lstrip("/")
        if not target.exists():
            # 子页允许由 _redirects 301 到锚点
            redirects = (ROOT / "_redirects").read_text(encoding="utf-8") if (ROOT / "_redirects").exists() else ""
            if path not in redirects and path.lstrip("/") not in redirects:
                errors.append(f"sitemap: {loc} 在本地不存在，且 _redirects 没有对应规则")


def main():
    for p in HTML_FILES:
        if not p.exists():
            continue
        html = p.read_text(encoding="utf-8")
        check_trailing(p.name, html)
        check_doctype(p.name, html)
        if p.name == "index.html":
            check_inline_scripts(p.name, html)
    for p in ADMIN_FILES:
        if p.exists():
            html = p.read_text(encoding="utf-8")
            check_trailing(str(p.relative_to(ROOT)), html)
    check_sitemap()
    if errors:
        print("PREDEPLOY FAILED")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print("PREDEPLOY OK")


if __name__ == "__main__":
    main()
