"""Build the zadar mark TTF at U+E100 from the Figma 24px variant (node 278:578).

ONE monochrome glyph (dome + visor + smile in a single contour set), so it
inherits the header's beacon colour and renders as one balanced unit. We tried a
COLR duotone (faded dome via a separate colour layer), but Ghostty constrains
each COLR layer to the cell *independently* — it refits the dome and face layers
separately, which shifts the face out of the arch ("eyes on the left"). A single
glyph has no layers to misalign, so it stays balanced everywhere. SVG: 24x24, y-down.

Note: terminals that constrain PUA/icon glyphs to the cell (Ghostty) decide the
mark's *rendered* size; SC only governs the size on terminals that don't.
"""
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib.tables.O_S_2f_2 import Panose

# the three filled paths, verbatim from the 24px variant (Body=dome, Subtract=visor, Vector=smile)
BODY = "M22.033 23.0175V10.3479C22.033 5.86252 17.6957 1.96636 12.0003 1.96625C6.30491 1.96625 1.96758 5.86245 1.96758 10.3479V23.0128C1.96758 23.5557 1.52702 23.996 0.983791 23.996C0.440564 23.996 0 23.5557 0 23.0128L0 10.3479C0 4.49056 5.52886 0 12.0003 0C18.4717 0.000111428 24 4.49063 24 10.3479V23.0175C23.9999 23.5602 23.5594 24 23.0162 24C22.4731 23.9999 22.0331 23.5602 22.033 23.0175Z"
VISOR = "M13.4121 0C15.3936 1.51767e-05 16.9998 1.60643 17 3.58789C17 5.56954 15.3938 7.17674 13.4121 7.17676H3.58789C1.60642 7.17653 0 5.56941 0 3.58789C0.000226628 1.60656 1.60656 0.000226104 3.58789 0H13.4121ZM13.8037 3.96582C10.8667 1.02878 6.10502 1.02879 3.16797 3.96582C2.84172 4.29207 2.84185 4.82114 3.16797 5.14746C3.49427 5.47376 4.0233 5.47377 4.34961 5.14746C6.63404 2.86306 10.3376 2.86303 12.6221 5.14746C12.9484 5.47364 13.4774 5.47373 13.8037 5.14746C14.1297 4.82116 14.1298 4.29202 13.8037 3.96582Z"
SMILE = "M8.30682 3.32813C7.8663 3.77961 7.15204 3.7796 6.71153 3.32813C5.38978 1.97351 3.24741 1.97352 1.92567 3.32813C1.48515 3.77961 0.770899 3.7796 0.330388 3.32813C-0.110124 2.87667 -0.110135 2.14465 0.330388 1.69317C2.53317 -0.564396 6.10405 -0.564385 8.30682 1.69317C8.74733 2.14464 8.74734 2.87665 8.30682 3.32813Z"

UPM, ADV = 1000, 600
SC = 36.6                          # 24-unit art → font units
EX = round(ADV / 2 - SC * 12)      # centre the art on the advance
OY = 788                           # baseline offset for the y-flip
T = (SC, 0, 0, -SC, EX, OY)
VISOR_P = (1, 0, 0, 1, 3.506, 7.6246)    # visor placement (its rounded-rect box)
SMILE_P = (1, 0, 0, -1, 7.685, 21.667)   # smile: flip-Y into its box

def draw(pen):
    parse_path(BODY, TransformPen(pen, T))
    parse_path(VISOR, TransformPen(TransformPen(pen, T), VISOR_P))
    parse_path(SMILE, TransformPen(TransformPen(pen, T), SMILE_P))

tt = TTGlyphPen(None); draw(Cu2QuPen(tt, max_err=1.0)); glyph = tt.glyph()
empty = TTGlyphPen(None).glyph()

fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder([".notdef", "space", "zadar.mark"])
fb.setupCharacterMap({0x0020: "space", 0xE100: "zadar.mark"})
fb.setupGlyf({".notdef": empty, "space": empty, "zadar.mark": glyph})
fb.setupHorizontalMetrics({".notdef": (ADV, 0), "space": (ADV, 0), "zadar.mark": (ADV, EX)})
fb.setupHorizontalHeader(ascent=800, descent=-200)
fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=900, usWinDescent=200, xAvgCharWidth=ADV,
            panose=Panose(bFamilyType=2, bSerifStyle=0, bWeight=5, bProportion=9, bContrast=0,
                          bStrokeVariation=0, bArmStyle=0, bLetterForm=0, bMidline=0, bXHeight=0))
fb.setupNameTable({"familyName": "Zadar Mark", "styleName": "Regular",
                   "fullName": "Zadar Mark", "psName": "ZadarMark-Regular"})
fb.setupPost(isFixedPitch=1)
fb.font["head"].fontRevision = 2.6                                       # bump so OS font caches refresh
fb.save("/tmp/zadar-mark/ZadarMark.ttf")
print("built zadar mark (mono) —", glyph.numberOfContours, "contours")
