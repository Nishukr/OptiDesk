#!/usr/bin/env python
"""Validate the generated .docx: OOXML child ordering + content completeness.

Word silently offers to "repair" a file whose element children violate the
schema sequence, so every element type this build touches by hand is checked.
"""
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
DOCX = r"D:\OptiDesk\OptiDesk-Architecture.docx"
MD = r"D:\OptiDesk\ARCHITECTURE.md"

SEQ = {
    "tblPr": "tblStyle tblpPr tblOverlap bidiVisual tblStyleRowBandSize"
             " tblStyleColBandSize tblW jc tblCellSpacing tblInd tblBorders shd"
             " tblLayout tblCellMar tblLook tblCaption tblDescription tblPrChange",
    "tcPr": "cnfStyle tcW gridSpan hMerge vMerge tcBorders shd noWrap tcMar"
            " textDirection tcFitText vAlign hideMark headers tcPrChange",
    "trPr": "cnfStyle divId gridBefore gridAfter wBefore wAfter cantSplit"
            " trHeight tblHeader tblCellSpacing jc hidden ins del trPrChange",
    "rPr": "rStyle rFonts b bCs i iCs caps smallCaps strike dstrike outline"
           " shadow emboss imprint noProof snapToGrid vanish webHidden color"
           " spacing w kern position sz szCs highlight u effect bdr shd fitText"
           " vertAlign rtl cs em lang eastAsianLayout specVanish oMath rPrChange",
    "pPr": "pStyle keepNext keepLines pageBreakBefore framePr widowControl numPr"
           " suppressLineNumbers pBdr shd tabs suppressAutoHyphens kinsoku"
           " wordWrap overflowPunct topLinePunct autoSpaceDE autoSpaceDN bidi"
           " adjustRightInd snapToGrid spacing ind contextualSpacing"
           " mirrorIndents suppressOverlap jc textDirection textAlignment"
           " textboxTightWrap outlineLvl divId cnfStyle rPr sectPr pPrChange",
}
SEQ = {k: v.split() for k, v in SEQ.items()}


def check_order(root):
    bad = []
    for tag, order in SEQ.items():
        for el in root.iter(W + tag):
            seen = -1
            for child in el:
                name = child.tag.replace(W, "")
                if name not in order:
                    continue
                idx = order.index(name)
                if idx < seen:
                    bad.append("%s: %s out of sequence" % (tag, name))
                    break
                seen = idx
    return bad
def text_of(root):
    return "".join(t.text or "" for t in root.iter(W + "t"))


def main():
    if not zipfile.is_zipfile(DOCX):
        print("FAIL: not a zip")
        return 1
    zf = zipfile.ZipFile(DOCX)
    problems = zf.testzip()
    if problems:
        print("FAIL: corrupt member %s" % problems)
        return 1
    parts = zf.namelist()
    doc = ET.fromstring(zf.read("word/document.xml"))
    media = [p for p in parts if p.startswith("word/media/")]

    bad = check_order(doc)
    for part in ("word/styles.xml", "word/footer1.xml", "word/settings.xml"):
        if part in parts:
            bad += check_order(ET.fromstring(zf.read(part)))

    body = text_of(doc)
    tables = len(list(doc.iter(W + "tbl")))
    drawings = len(list(doc.iter(W + "drawing")))
    rows = len(list(doc.iter(W + "tr")))

    md = open(MD, encoding="utf-8").read()
    # Every heading in the source must appear in the document text.
    heads = re.findall(r"^#{2,3}\s+(.*)$", md, re.M)
    plain = [re.sub(r"[`*]", "", h).strip() for h in heads]
    missing = [h for h in plain if h not in body]

    # Spot-check load-bearing strings from across the document.
    probes = [
        "MANUAL_STATUSES", "confirmedByCustomerAt", "gemini-embedding-001",
        "STAFF_PATH", "whsec_", "TOP_K", "clerkId", "sparse",
        "DELETE /api/admin/tickets/:id", "express.raw", "escalate()",
        "npm run train", "USE_ATLAS_VECTOR", "body_not_raw",
        "staff_email_conflict", "reopenedCount", "sentimentScore",
    ]
    lost = [p for p in probes if p not in body]

    print("parts=%d  media=%d  tables=%d  rows=%d  images=%d  chars=%d"
          % (len(parts), len(media), tables, rows, drawings, len(body)))
    print("schema-order problems : %s" % (bad[:5] if bad else "none"))
    print("missing headings      : %s" % (missing if missing else "none"))
    print("missing key strings   : %s" % (lost if lost else "none"))
    ok = not bad and not missing and not lost and drawings == 7
    print("RESULT: %s" % ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
