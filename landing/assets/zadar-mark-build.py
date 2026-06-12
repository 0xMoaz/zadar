"""Build the zadar mark TTF at U+E000 from the Figma source paths (node 278:512).
Visor + smile are filled paths taken verbatim; the dome is a 4.8-wide round-cap
stroke, expanded here by sampling + normal offset. SVG space: 50x48 y-down."""
import math
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib.tables.O_S_2f_2 import Panose

UPM, ADV = 1000, 600
S = 16.0                         # 50 svg units → 800 font units: cap-height scale.
# Art is wider than the 600 advance — it bleeds ~100 units per side, which is
# safe because the mark is always set off by spaces (header: "<mark> zadar").
BASE = (S, 0, 0, -S, -100, 748)  # y-flip, centered on the advance, slight descent

VISOR = "M36.291 14.0352C40.9261 14.0352 44.6834 17.7927 44.6836 22.4277C44.6836 27.0629 40.9262 30.8213 36.291 30.8213H33.3711C33.2642 30.4875 33.0803 30.1731 32.8154 29.9082C28.3755 25.4683 21.1782 25.4683 16.7383 29.9082C16.4734 30.1731 16.2895 30.4875 16.1826 30.8213H13.3125C8.67747 30.8211 4.91992 27.0628 4.91992 22.4277C4.92011 17.7928 8.6776 14.0354 13.3125 14.0352H36.291ZM39.2441 22.9395C31.2522 14.9475 18.2967 14.9475 10.3047 22.9395C9.41687 23.8273 9.41699 25.2664 10.3047 26.1543C11.1926 27.0422 12.6326 27.0422 13.5205 26.1543C19.7366 19.9387 29.8123 19.9386 36.0283 26.1543C36.9162 27.0422 38.3562 27.0422 39.2441 26.1543C40.1316 25.2664 40.1317 23.8272 39.2441 22.9395Z"
SMILE = "M17.0566 39.7568C21.3382 44.1447 28.276 44.1447 32.5576 39.7568C33.3189 38.9766 33.3188 37.708 32.5576 36.9277C31.8005 36.1518 30.5764 36.1519 29.8193 36.9277C27.0519 39.764 22.5623 39.764 19.7949 36.9277C19.0378 36.1519 17.8137 36.1518 17.0566 36.9277C16.2954 37.708 16.2953 38.9766 17.0566 39.7568Z"

def cubic(p0, c1, c2, p1, n):
    pts = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        pts.append((u*u*u*p0[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t*t*t*p1[0],
                    u*u*u*p0[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t*t*t*p1[1]))
    return pts

def dome_polygon(r=2.4):
    # centerline: right post up, dome across, left post down
    pts = [(47.2004, 43.4696 - i/12*(43.4696-22.574)) for i in range(12)]
    pts += cubic((47.2004,22.574),(47.2004,12.0517),(37.1702,3.51953),(24.8003,3.51953),48)[:-1]
    pts += cubic((24.8003,3.51953),(12.4306,3.51953),(2.40039,12.0517),(2.40039,22.574),48)
    pts += [(2.40039, 22.574 + (i+1)/12*(43.4611-22.574)) for i in range(12)]
    def normal(i):
        a, b = pts[max(0,i-1)], pts[min(len(pts)-1,i+1)]
        dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx,dy) or 1
        return (-dy/L, dx/L)
    left  = [(p[0]+normal(i)[0]*r, p[1]+normal(i)[1]*r) for i,p in enumerate(pts)]
    right = [(p[0]-normal(i)[0]*r, p[1]-normal(i)[1]*r) for i,p in enumerate(pts)]
    def cap(center, n_from, steps=14):
        a0 = math.atan2(n_from[1]-center[1], n_from[0]-center[0])
        return [(center[0]+r*math.cos(a0+math.pi*i/steps),
                 center[1]+r*math.sin(a0+math.pi*i/steps)) for i in range(1,steps)]
    poly = left + cap(pts[-1], left[-1]) + right[::-1] + cap(pts[0], right[0])
    return poly

def draw(pen, svgpen_mode=False):
    # dome (stroke expanded to polygon)
    tp = TransformPen(pen, BASE)
    poly = dome_polygon()
    tp.moveTo(poly[0])
    for p in poly[1:]: tp.lineTo(p)
    tp.closePath()
    # visor — inset horizontally about its center so it clears the dome posts
    # (the Figma source uses a background-colored knockout ring instead)
    sx, cx = 0.905, 24.8
    visor_m = (S*sx, 0, 0, -S, S*cx*(1-sx) - 100, 748)
    parse_path(VISOR, TransformPen(pen, visor_m))
    parse_path(SMILE, TransformPen(pen, BASE))

# --- glyph (cubics → quadratics for TTF)
tt = TTGlyphPen(None)
draw(Cu2QuPen(tt, max_err=1.0))
glyph = tt.glyph()

empty = TTGlyphPen(None).glyph()
fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder([".notdef", "space", "zadar.mark"])
fb.setupCharacterMap({0x0020: "space", 0xE000: "zadar.mark"})
fb.setupGlyf({".notdef": empty, "space": empty, "zadar.mark": glyph})
fb.setupHorizontalMetrics({".notdef": (ADV, 0), "space": (ADV, 0), "zadar.mark": (ADV, -100)})
fb.setupHorizontalHeader(ascent=800, descent=-200)
fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200,
            xAvgCharWidth=ADV, panose=Panose(bFamilyType=2, bSerifStyle=0, bWeight=5,
            bProportion=9, bContrast=0, bStrokeVariation=0, bArmStyle=0,
            bLetterForm=0, bMidline=0, bXHeight=0))
fb.setupNameTable({"familyName": "Zadar Mark", "styleName": "Regular",
                   "fullName": "Zadar Mark", "psName": "ZadarMark-Regular"})
fb.setupPost(isFixedPitch=1)
fb.save("/tmp/zadar-mark/ZadarMark.ttf")

# --- SVG preview from the same draw()
sp = SVGPathPen(None)
draw(sp)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 0 800 800" width="240" height="320">
<rect width="600" height="800" fill="white"/>
<g transform="translate(0,800) scale(1,-1)"><path d="{sp.getCommands()}" fill="black"/></g></svg>'''
open("/tmp/zadar-mark/preview.svg", "w").write(svg)
print("built")
