# 生成「网页屏蔽器」扩展图标 v2：捂眼小幽灵（扁平、单层底色、干净剪影）
import math
import os
from PIL import Image, ImageDraw

S = 512
BG = (108, 92, 231, 255)
INK = (74, 58, 176, 255)      # 五官 / 描边
GHOST = (255, 255, 255, 255)
PAW = (255, 190, 208, 255)    # 捂眼的小爪
PAW_DK = (232, 150, 176, 255)
BLUSH = (255, 208, 220, 255)
STAR = (255, 230, 109, 255)

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

d.rounded_rectangle([0, 0, S - 1, S - 1], radius=116, fill=BG)


def star(cx, cy, r, color):
    pts = []
    for k in range(8):
        ang = k * math.pi / 4
        rad = r if k % 2 == 0 else r * 0.34
        pts.append((cx + rad * math.cos(ang), cy - rad * math.sin(ang)))
    d.polygon(pts, fill=color)


# 幽灵身体：圆头 + 直身 + 三足裙摆
L, R = 122, 390
HEAD_TOP, HIP = 116, 356
d.ellipse([L, HEAD_TOP, R, HEAD_TOP + (R - L)], fill=GHOST)
d.rectangle([L, (HEAD_TOP + R - L) / 2, R, HIP], fill=GHOST)

foot_r = (R - L) / 6.0
for cx in (L + foot_r, S / 2, R - foot_r):
    d.ellipse([cx - foot_r, HIP - foot_r, cx + foot_r, HIP + foot_r], fill=GHOST)
for cx in (L + 2 * foot_r, R - 2 * foot_r):  # 裙摆缺口
    d.ellipse([cx - 26, HIP - 30, cx + 26, HIP + 22], fill=BG)

# 捂眼的两只爪子：宽圆掌 + 指缝只画在下缘，避免看成眼镜
for cx in (200, 312):
    d.rounded_rectangle([cx - 54, 190, cx + 54, 262], radius=36, fill=PAW, outline=INK, width=6)
    for i in (-1, 0, 1):
        x = cx + i * 26
        d.line([x, 236, x, 258], fill=PAW_DK, width=7)

# 腮红 + 微笑
for cx in (150, 362):
    d.ellipse([cx - 24, 272, cx + 24, 300], fill=BLUSH)
d.pieslice([S / 2 - 26, 276, S / 2 + 26, 322], start=15, end=165, fill=INK)

# 星星
star(424, 106, 32, STAR)
star(92, 404, 15, STAR)

out = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "outputs", "web-blocker", "icons"))
os.makedirs(out, exist_ok=True)
for size in (16, 32, 48, 128, 512):
    (img.resize((size, size), Image.LANCZOS) if size != S else img).save(
        os.path.join(out, f"icon-{size}.png"), "PNG", optimize=True
    )

# 多尺寸对照图
ims = [Image.open(os.path.join(out, f"icon-{s}.png")).convert("RGBA") for s in (16, 32, 48, 128)]
canvas = Image.new("RGBA", (16 + 32 + 48 + 128 + 40, 128), (255, 255, 255, 255))
x = 0
for im in ims:
    canvas.alpha_composite(im, (x, 128 - im.height))
    x += im.width + 12
canvas.resize((canvas.width * 3, canvas.height * 3), Image.NEAREST).save(os.path.join(out, "preview-sizes.png"))
print("icons written to", out)
