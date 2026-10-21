"""
Generate sample medical documents for testing document scanning.

All people, clinics and results are FICTIONAL and every document is marked
"SAMPLE DOCUMENT - FOR DEMO ONLY". The patient matches the app's sample patient
(Amina Wanjiru, born 12/03/1974), and two clinics match the app's demo directory.

Run:  python3 samples/generate_samples.py
Needs: reportlab, Pillow, and poppler's pdftoppm (for the photo sample).
"""

import math
import os
import random
import subprocess
from io import BytesIO

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4, A5
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
OUT = HERE

pdfmetrics.registerFont(TTFont("Sans", os.path.join(FONTS, "LiberationSans-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Sans-Bold", os.path.join(FONTS, "LiberationSans-Bold.ttf")))

INK = HexColor("#1d1f2b")
GREY = HexColor("#5b6070")
RULE = HexColor("#c9ccd6")
SIGNATURE_INK = HexColor("#16244f")
W, H = A4

random.seed(7)


# ---------- drawing helpers ----------

def demo_footer(c, width=W):
    c.setFont("Sans-Bold", 8)
    c.setFillColor(HexColor("#b4232a"))
    c.drawCentredString(width / 2, 22, "SAMPLE DOCUMENT - FOR DEMO ONLY - FICTIONAL PATIENT AND CLINIC")
    c.setFillColor(INK)


def letterhead(c, name, lines, accent):
    c.setFillColor(accent)
    c.rect(0, H - 14, W, 14, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont("Sans-Bold", 20)
    c.drawString(50, H - 62, name)
    c.setFont("Sans", 9.5)
    c.setFillColor(GREY)
    for i, line in enumerate(lines):
        c.drawString(50, H - 78 - i * 12, line)
    c.setFillColor(INK)
    c.setStrokeColor(RULE)
    c.setLineWidth(0.8)
    y = H - 82 - len(lines) * 12
    c.line(50, y, W - 50, y)
    return y - 22


def label_value(c, x, y, label, value, bold_value=True):
    c.setFont("Sans", 9.5)
    c.setFillColor(GREY)
    c.drawString(x, y, label)
    c.setFillColor(INK)
    c.setFont("Sans-Bold" if bold_value else "Sans", 10)
    c.drawString(x + 92, y, value)


def signature(c, x, y, scale=1.0, seed=1):
    """A handwritten-looking signature drawn as ink strokes (vector, not text)."""
    rnd = random.Random(seed)
    c.saveState()
    c.setStrokeColor(SIGNATURE_INK)
    c.setLineWidth(1.6)
    c.setLineCap(1)
    c.setLineJoin(1)
    p = c.beginPath()
    p.moveTo(x, y)
    cx, cy = x, y
    for i in range(7):
        dx = (14 + rnd.uniform(0, 10)) * scale
        up = (12 + rnd.uniform(0, 14)) * scale
        p.curveTo(cx + dx * 0.3, cy + up, cx + dx * 0.7, cy - up * 0.8, cx + dx, cy + rnd.uniform(-4, 4) * scale)
        cx += dx
    p.curveTo(cx + 10 * scale, cy + 10 * scale, cx - 70 * scale, cy - 14 * scale, x - 6 * scale, y - 6 * scale)
    c.drawPath(p, stroke=1, fill=0)
    c.restoreState()


def stamp(c, cx, cy, r, top_text, bottom_text, center_lines, rgb, angle=-12):
    """Round rubber stamp in coloured ink."""
    col = Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, alpha=0.85)
    c.saveState()
    c.translate(cx, cy)
    c.rotate(angle)
    c.setStrokeColor(col)
    c.setFillColor(col)
    c.setLineWidth(2.4)
    c.circle(0, 0, r, stroke=1, fill=0)
    c.setLineWidth(1.1)
    c.circle(0, 0, r - 7, stroke=1, fill=0)
    c.circle(0, 0, r * 0.52, stroke=1, fill=0)

    def arc_text(text, radius, start_deg, step, upright):
        c.setFont("Sans-Bold", 8)
        for i, ch in enumerate(text):
            a = math.radians(start_deg - i * step if upright else start_deg + i * step)
            c.saveState()
            c.translate(radius * math.cos(a), radius * math.sin(a))
            c.rotate(math.degrees(a) - 90 if upright else math.degrees(a) + 90)
            c.drawCentredString(0, 0, ch)
            c.restoreState()

    step = 180 / max(len(top_text), 1) * 0.9
    arc_text(top_text, r - 16, 90 + step * (len(top_text) - 1) / 2, step, True)
    step2 = 180 / max(len(bottom_text), 1) * 0.8
    arc_text(bottom_text, r - 10, 270 - step2 * (len(bottom_text) - 1) / 2, step2, False)
    c.setFont("Sans-Bold", 8.5)
    for i, line in enumerate(center_lines):
        c.drawCentredString(0, 4 - i * 10 + (len(center_lines) - 1) * 4, line)
    c.restoreState()


def table(c, x, y, cols, widths, rows, header=True):
    c.setFont("Sans-Bold", 9)
    c.setFillColor(GREY)
    if header:
        cx = x
        for col, w in zip(cols, widths):
            c.drawString(cx, y, col)
            cx += w
        y -= 6
        c.setStrokeColor(RULE)
        c.line(x, y, x + sum(widths), y)
        y -= 13
    for row in rows:
        cx = x
        flagged = row[-1] in ("H", "L")
        for i, (val, w) in enumerate(zip(row, widths)):
            c.setFillColor(HexColor("#b4232a") if flagged and i in (1, 4) else INK)
            c.setFont("Sans-Bold" if (flagged and i in (1, 4)) or i == 0 else "Sans", 9.5)
            c.drawString(cx, y, val)
            cx += w
        y -= 15
    return y


# ---------- 1. Lab report (verified) ----------

def lab_report(path):
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle("Laboratory report - Mwangaza Diagnostics")
    y = letterhead(
        c,
        "Mwangaza Diagnostics",
        ["Moi Avenue, CBD, Nairobi  |  Tel +254 700 100 103", "KMLTTB licensed medical laboratory  |  Licence No. KMPDC/DEMO/2002"],
        HexColor("#3b6fd8"),
    )
    c.setFont("Sans-Bold", 14)
    c.drawString(50, y, "LABORATORY REPORT")
    y -= 24
    label_value(c, 50, y, "Patient name:", "Amina Wanjiru")
    label_value(c, 320, y, "Lab No:", "MWD-26-104417")
    y -= 15
    label_value(c, 50, y, "Date of birth:", "12/03/1974")
    label_value(c, 320, y, "Sex:", "Female")
    y -= 15
    label_value(c, 50, y, "Requested by:", "Dr. A. Otieno, Uzima Family Clinic", False)
    y -= 15
    label_value(c, 50, y, "Collected:", "13/10/2026 08:10", False)
    label_value(c, 320, y, "Date:", "14/10/2026")
    y -= 28

    cols = ["Test", "Result", "Unit", "Reference range", "Flag"]
    widths = [170, 70, 80, 120, 40]

    def section(title, rows):
        nonlocal y
        c.setFont("Sans-Bold", 11)
        c.setFillColor(INK)
        c.drawString(50, y, title)
        y -= 16
        y = table(c, 50, y, cols, widths, rows)
        y -= 10

    section("Full Blood Count", [
        ["Haemoglobin", "11.4", "g/dL", "12.0 - 17.0", "L"],
        ["White cell count", "6.8", "x10^9/L", "4.0 - 11.0", ""],
        ["Platelets", "262", "x10^9/L", "150 - 400", ""],
        ["MCV", "79", "fL", "80 - 100", "L"],
    ])
    section("Diabetes", [
        ["HbA1c", "7.4", "%", "4.0 - 5.7", "H"],
        ["Fasting glucose", "8.1", "mmol/L", "3.9 - 5.6", "H"],
    ])
    section("Lipid Profile", [
        ["Total cholesterol", "5.6", "mmol/L", "< 5.2", "H"],
        ["LDL cholesterol", "3.6", "mmol/L", "< 3.4", "H"],
        ["HDL cholesterol", "1.2", "mmol/L", "> 1.0", ""],
        ["Triglycerides", "1.9", "mmol/L", "< 1.7", "H"],
    ])
    section("Kidney Function (U&E)", [
        ["Creatinine", "88", "umol/L", "45 - 110", ""],
        ["Urea", "5.2", "mmol/L", "2.5 - 7.8", ""],
        ["Sodium", "139", "mmol/L", "135 - 145", ""],
        ["Potassium", "4.3", "mmol/L", "3.5 - 5.1", ""],
        ["eGFR", "78", "mL/min/1.73m2", "> 60", ""],
    ])

    c.setFont("Sans-Bold", 10)
    c.drawString(50, y, "Comment:")
    c.setFont("Sans", 9.5)
    c.drawString(105, y, "HbA1c above target. Mild microcytic anaemia - suggest iron studies.")
    y -= 40

    c.setFont("Sans", 9.5)
    c.setFillColor(GREY)
    c.drawString(50, y, "Verified by:")
    c.setFillColor(INK)
    c.setFont("Sans-Bold", 10)
    c.drawString(120, y, "Grace Njeri, Medical Laboratory Technologist")
    y -= 14
    c.setFont("Sans", 9.5)
    c.drawString(120, y, "KMLTTB Reg No: LT/2231")
    y -= 34
    c.setFillColor(GREY)
    c.drawString(50, y, "Signature:")
    signature(c, 125, y + 4, 1.0, seed=3)
    c.setStrokeColor(RULE)
    c.line(120, y - 4, 290, y - 4)

    stamp(c, 450, y + 30, 52, "MWANGAZA DIAGNOSTICS", "NAIROBI", ["VERIFIED", "14 OCT 2026"], (40, 78, 200))
    demo_footer(c)
    c.showPage()
    c.save()


# ---------- 2. Clinic letter (verified) ----------

def clinic_letter(path):
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle("Clinic letter - Uzima Family Clinic")
    y = letterhead(
        c,
        "Uzima Family Clinic",
        ["Mpaka Road, Westlands, Nairobi  |  Tel +254 700 100 101", "Diabetes & Hypertension Clinic  |  Licence No. KMPDC/DEMO/2000"],
        HexColor("#7a4fc4"),
    )
    c.setFont("Sans", 10)
    c.drawString(50, y, "Date: 15/10/2026")
    y -= 24
    c.setFont("Sans-Bold", 13)
    c.drawString(50, y, "CLINIC REVIEW LETTER")
    y -= 22
    label_value(c, 50, y, "Patient name:", "Amina Wanjiru")
    y -= 15
    label_value(c, 50, y, "Date of birth:", "12/03/1974")
    y -= 15
    label_value(c, 50, y, "Clinic No:", "UFC-008812")
    y -= 26

    c.setFont("Sans", 10)
    para = [
        "Dear colleague,",
        "",
        "I reviewed Mrs Wanjiru today in the diabetes clinic. Her recent blood results show an",
        "HbA1c of 7.4% and raised LDL cholesterol. Blood pressure today was 138/86 mmHg.",
    ]
    for line in para:
        c.drawString(50, y, line)
        y -= 14
    y -= 8

    def heading(text):
        nonlocal y
        c.setFont("Sans-Bold", 11)
        c.drawString(50, y, text)
        y -= 16
        c.setFont("Sans", 10)

    def bullets(items):
        nonlocal y
        for it in items:
            c.drawString(62, y, "- " + it)
            y -= 14
        y -= 8

    heading("Diagnoses:")
    bullets(["Type 2 diabetes mellitus", "Hypertension", "Hyperlipidaemia (new)", "Iron deficiency anaemia (new)"])
    heading("Allergies:")
    bullets(["Penicillin (rash and swelling)", "Sulfa drugs (hives)"])
    heading("Current medications:")
    bullets([
        "Metformin 1 g BD (dose increased today)",
        "Amlodipine 5 mg OD",
        "Atorvastatin 40 mg nocte (dose increased)",
        "Empagliflozin 10 mg OD (new)",
        "Ferrous sulphate 200 mg OD for 3 months",
    ])
    heading("Immunisations:")
    bullets(["Influenza vaccine given 15/10/2026, batch FLU-2210"])
    heading("Plan:")
    bullets(["Repeat HbA1c and lipids in 3 months", "Review in 3 months", "Diabetic eye screening referral"])

    c.drawString(50, y, "Yours sincerely,")
    y -= 40
    signature(c, 58, y + 6, 1.1, seed=11)
    y -= 14
    c.setFont("Sans-Bold", 10)
    c.drawString(50, y, "Dr. Achieng Otieno")
    y -= 13
    c.setFont("Sans", 9.5)
    c.drawString(50, y, "Medical Officer, KMPDC Reg No: A12345")
    y -= 13
    c.setFillColor(GREY)
    c.drawString(50, y, "Signature")
    stamp(c, 430, y + 40, 50, "UZIMA FAMILY CLINIC", "WESTLANDS", ["15 OCT 2026"], (112, 52, 168), angle=8)
    demo_footer(c)
    c.showPage()
    c.save()


# ---------- 3. Handwritten note (unverified) ----------

def handwritten_note(path):
    pw, ph = 1240, 1754  # A5-ish at 150 dpi
    img = Image.new("RGB", (pw, ph), (247, 243, 232))
    # paper texture
    px = img.load()
    rnd = random.Random(5)
    for _ in range(60000):
        x, yy = rnd.randrange(pw), rnd.randrange(ph)
        v = rnd.randrange(-10, 6)
        r, g, b = px[x, yy]
        px[x, yy] = (r + v, g + v, b + v)
    d = ImageDraw.Draw(img)
    for i in range(14):
        yline = 260 + i * 92
        d.line([(80, yline), (pw - 80, yline)], fill=(196, 210, 230), width=2)
    font = ImageFont.truetype(os.path.join(FONTS, "Caveat-Medium.ttf"), 64)
    small = ImageFont.truetype(os.path.join(FONTS, "Caveat-Medium.ttf"), 52)
    ink = (28, 38, 92)
    lines = [
        ("14/10/26", 900, 150, small),
        ("Name: Amina Wanjiru", 110, 240, font),
        ("Dx: sore throat - tonsillitis", 110, 332, font),
        ("Rx: Amoxicillin 500mg TDS x5 days", 110, 424, font),
        ("     Paracetamol 1g QDS PRN", 110, 516, font),
        ("Plenty of fluids. Review if", 110, 608, font),
        ("no better in 3 days.", 110, 700, font),
        ("Dr Mwangi", 760, 880, font),
    ]
    def write(text, x, y, f):
        """Draw letter by letter with the wobble of real handwriting: uneven size, slant and baseline."""
        cx = x
        drift = 0.0
        for ch in text:
            drift += rnd.uniform(-1.6, 1.6)
            drift = max(-9, min(9, drift))
            size = int(f.size * rnd.uniform(0.86, 1.14))
            fnt = ImageFont.truetype(os.path.join(FONTS, "Caveat-Medium.ttf"), size)
            bbox = fnt.getbbox(ch)
            w = max(1, bbox[2] - bbox[0])
            hgt = max(1, bbox[3])
            tile = Image.new("L", (w + 30, hgt + 40), 0)
            ImageDraw.Draw(tile).text((10, 10), ch, font=fnt, fill=255)
            tile = tile.rotate(rnd.uniform(-9, 9), resample=Image.BICUBIC, expand=False)
            img.paste(Image.new("RGB", tile.size, ink), (int(cx) - 10, int(y + drift + rnd.uniform(-3, 3)) - 10), tile)
            cx += fnt.getlength(ch) * rnd.uniform(0.92, 1.12)

    for text, x, yy, f in lines:
        write(text, x + rnd.randint(-8, 8), yy + rnd.randint(-6, 6), f)
    img = img.rotate(1.6, resample=Image.BICUBIC, expand=False, fillcolor=(235, 231, 220))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=82)
    buf.seek(0)

    c = canvas.Canvas(path, pagesize=A5)
    c.setTitle("Scanned handwritten note")
    aw, ah = A5
    c.drawImage(ImageReader(buf), 0, 30, width=aw, height=ah - 30)
    c.setFont("Sans-Bold", 7)
    c.setFillColor(HexColor("#b4232a"))
    c.drawCentredString(aw / 2, 14, "SAMPLE DOCUMENT - FOR DEMO ONLY - FICTIONAL")
    c.showPage()
    c.save()


# ---------- 4. Discharge summary from an unlisted hospital (unverified) ----------

def discharge_summary(path):
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle("Discharge summary - Bahari Ridge Hospital")
    y = letterhead(
        c,
        "Bahari Ridge Hospital",
        ["Ridge Road, Kilifi  |  Tel +254 700 999 000"],
        HexColor("#2a9d8f"),
    )
    c.setFont("Sans-Bold", 14)
    c.drawString(50, y, "DISCHARGE SUMMARY")
    y -= 24
    label_value(c, 50, y, "Patient name:", "Amina Wanjiru")
    y -= 15
    label_value(c, 50, y, "Date of birth:", "12/03/1974")
    y -= 15
    label_value(c, 50, y, "Admitted:", "02/09/2026", False)
    y -= 15
    label_value(c, 50, y, "Date:", "05/09/2026")
    y -= 28

    def heading(text):
        nonlocal y
        c.setFont("Sans-Bold", 11)
        c.drawString(50, y, text)
        y -= 16
        c.setFont("Sans", 10)

    heading("Diagnosis:")
    c.drawString(62, y, "- Malaria (P. falciparum), treated")
    y -= 22
    heading("Discharge medications:")
    for line in ["Artemether-lumefantrine 80/480 mg BD for 3 days", "Paracetamol 1 g TDS PRN"]:
        c.drawString(62, y, "- " + line)
        y -= 14
    y -= 8
    heading("Follow up:")
    c.drawString(62, y, "- Review in 2 weeks at your local clinic")
    y -= 40
    c.setFont("Sans", 9.5)
    c.setFillColor(GREY)
    c.drawString(50, y, "Signature:")
    signature(c, 125, y + 4, 0.9, seed=21)
    y -= 16
    c.setFillColor(INK)
    c.setFont("Sans-Bold", 10)
    c.drawString(50, y, "Dr. K. Baya, Medical Officer")
    demo_footer(c)
    c.showPage()
    c.save()


# ---------- 5. Photo of the lab report (image upload) ----------

def lab_photo(pdf_path, jpg_path):
    base = jpg_path[:-4]
    subprocess.run(["pdftoppm", "-r", "150", "-png", "-singlefile", pdf_path, base], check=True)
    img = Image.open(base + ".png").convert("RGB")
    os.remove(base + ".png")
    # warm indoor light, slight tilt and softness like a phone photo
    r, g, b = img.split()
    r = r.point(lambda v: min(255, int(v * 1.0 + 4)))
    b = b.point(lambda v: int(v * 0.93))
    img = Image.merge("RGB", (r, g, b))
    img = img.rotate(-0.7, resample=Image.BICUBIC, expand=True, fillcolor=(120, 112, 100))
    img = img.filter(ImageFilter.GaussianBlur(0.4))
    img.save(jpg_path, quality=86)


if __name__ == "__main__":
    lab = os.path.join(OUT, "01-lab-report-mwangaza-VERIFIED.pdf")
    lab_report(lab)
    clinic_letter(os.path.join(OUT, "02-clinic-letter-uzima-VERIFIED.pdf"))
    handwritten_note(os.path.join(OUT, "03-handwritten-note-UNVERIFIED.pdf"))
    discharge_summary(os.path.join(OUT, "04-discharge-summary-unlisted-hospital-UNVERIFIED.pdf"))
    lab_photo(lab, os.path.join(OUT, "05-lab-report-photo.jpg"))
    print("Samples written to", OUT)
