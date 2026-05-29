#!/usr/bin/env python3
"""
Build complete legal HTML templates from extracted source documents.
Applies substitutions for merge field placeholders.
"""

import re
import os

# Read extracted source files
print("Reading extracted text files...")
with open('/tmp/ats_raw.txt', 'r', encoding='utf-8') as f:
    ats_raw = f.read()

with open('/tmp/conveyance_raw.txt', 'r', encoding='utf-8') as f:
    conv_raw = f.read()

print(f"[OK] ATS raw: {len(ats_raw):,} chars, {ats_raw.count(chr(10)):,} lines")
print(f"[OK] Conv raw: {len(conv_raw):,} chars, {conv_raw.count(chr(10)):,} lines")

# Define substitutions for ATS
ats_subs = {
    'Aaditya Ashok Jadhav': '{{allottee_name}}',
    'S/o Ashok Vasudev Jadhav': '{{allottee_relation}} {{allottee_relative_name}}',
    'B-601, Satyam Apartment, Sector 18A': '{{allottee_address}}',
    '406524255520': '{{allottee_aadhaar}}',
    'AKIPJ3703F': '{{allottee_pan}}',
    'B-608': '{{flat_no}}',
    'Tower B': '{{tower_name}}',
    '6th Floor': '{{floor_no}}',
    'Type-B': '{{unit_type}}',
    '645.55': '{{carpet_area}}',
    '645.549': '{{carpet_area}}',
    '104.787': '{{balcony_area}}',
    'B52': '{{parking_no}}',
    'Rs. 26,32,196': 'Rs. {{total_price}}',
    'Rs. 1,31,600': 'Rs. {{booking_amount}}',
    'ROF ALANTE': '{{project_name}}',
    '6th day of March,': '{{agreement_day}} day of {{agreement_month}},',
    '2025': '{{agreement_year}}',
    'Nani Resorts and Floriculture Private Limited': '{{promoter_name}}',
    'U55101DL1999PTC098037': '{{promoter_cin}}',
    'AABCN4603L': '{{promoter_pan}}',
    'M-18, Greater Kailash, Part-II, New Delhi-110048': '{{promoter_address}}',
    'MRA Infrastructure Development LLP': '{{land_owner_name}}',
    'AAO-7853': '{{land_owner_llpin}}',
    'ABLFM2142D': '{{land_owner_pan}}',
    'RC/REP/HARERA/GGM/381/113/2019/75': '{{harera_reg_no}}',
}

# Define substitutions for Conveyance
conv_subs = {
    'B-1506': '{{property_no}}',
    'Tower B': '{{tower_name}}',
    '15Th Floor': '{{floor_no}}',
    '645.786': '{{carpet_area}}',
    '91.063': '{{balcony_area}}',
    'Rs. 26,28,676': 'Rs. {{consideration}}',
    'Nani Resorts and Floriculture Private Limited': '{{promoter_name}}',
    'U55101DL1999PTC098037': '{{promoter_cin}}',
    'AABCN4603L': '{{promoter_pan}}',
    'M-18, Greater Kailash, Part-II, New Delhi-110048': '{{promoter_address}}',
}

def apply_subs(text, subs):
    for old, new in subs.items():
        text = text.replace(old, new)
    return text

def text_to_html(raw_text, doc_type):
    """Convert extracted text to proper HTML with styling"""

    html_head = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>''' + ('Agreement for Sale' if doc_type == 'ats' else 'Conveyance Deed') + '''</title>
<style>
body {
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.8;
  margin: 2.5cm;
  color: #000;
  text-align: justify;
}
h1 {
  text-align: center;
  font-size: 16pt;
  font-weight: bold;
  text-transform: uppercase;
  margin: 25px 0;
}
h2 {
  font-size: 13pt;
  font-weight: bold;
  text-transform: uppercase;
  margin-top: 20px;
  margin-bottom: 10px;
}
h3 {
  font-size: 12pt;
  font-weight: bold;
  margin-top: 15px;
  margin-bottom: 8px;
}
.clause {
  margin: 10px 0;
  text-align: justify;
}
.sub-clause {
  margin: 8px 0 8px 30px;
  text-align: justify;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 15px 0;
}
table td, table th {
  border: 1px solid #000;
  padding: 8px;
  text-align: left;
  vertical-align: top;
}
table th {
  background: #f0f0f0;
  font-weight: bold;
}
.indent {
  margin-left: 30px;
}
.indent2 {
  margin-left: 60px;
}
.recital {
  margin: 10px 0 10px 20px;
  text-align: justify;
}
.centered { text-align: center; }
@media print {
  body { margin: 2.5cm; }
}
</style>
</head>
<body>'''

    html_lines = [html_head]

    lines = raw_text.split('\n')

    for line in lines:
        stripped = line.strip()

        if not stripped:
            continue

        # Skip page markers
        if stripped.startswith('--- PAGE'):
            continue

        # ALL CAPS headings
        if (stripped.isupper() and
            3 < len(stripped) < 100 and
            ' ' in stripped):
            html_lines.append(f'<h2>{stripped}</h2>')

        # Numbered clause (1. 2. 3.)
        elif re.match(r'^(\d{1,2}|[A-Z])\.\s+[A-Z]', stripped):
            if re.match(r'^[A-Z]\.\s', stripped):
                html_lines.append(f'<p class="recital"><strong>{stripped}</strong></p>')
            else:
                html_lines.append(f'<p><strong>{stripped}</strong></p>')

        # Sub-clause (1.1, 1.2, etc)
        elif re.match(r'^\d{1,2}\.\d{1,2}', stripped):
            html_lines.append(f'<p class="sub-clause">{stripped}</p>')

        # Lettered items
        elif re.match(r'^[a-z]\)\s', stripped):
            html_lines.append(f'<p class="indent">{stripped}</p>')

        # Regular paragraphs
        else:
            html_lines.append(f'<p class="clause">{stripped}</p>')

    # Add closing
    if doc_type == 'ats':
        html_lines.append('<p>{{payment_plan_rows}}</p>')

    html_lines.append('</body></html>')

    return '\n'.join(html_lines)

print("\nApplying substitutions...")
ats_with_subs = apply_subs(ats_raw, ats_subs)
conv_with_subs = apply_subs(conv_raw, conv_subs)

print("Converting to HTML...")
ats_html = text_to_html(ats_with_subs, 'ats')
conv_html = text_to_html(conv_with_subs, 'conveyance')

# Create output directory
output_dir = r"D:\Desktop\Grapes\ROF Project\rof-crm\packages\api\src\templates\legal"
os.makedirs(output_dir, exist_ok=True)

# Write files
ats_path = os.path.join(output_dir, 'ats_rof_alante.html')
conv_path = os.path.join(output_dir, 'conveyance_rof_alante.html')

with open(ats_path, 'w', encoding='utf-8') as f:
    f.write(ats_html)

with open(conv_path, 'w', encoding='utf-8') as f:
    f.write(conv_html)

print(f"\n[DONE] ATS HTML written: {len(ats_html):,} bytes")
print(f"   Location: {ats_path}")
print(f"[DONE] Conveyance HTML written: {len(conv_html):,} bytes")
print(f"   Location: {conv_path}")

# Find all placeholders
ats_placeholders = sorted(set(re.findall(r'\{\{(\w+)\}\}', ats_html)))
conv_placeholders = sorted(set(re.findall(r'\{\{(\w+)\}\}', conv_html)))

print(f"\n[INFO] ATS Placeholders ({len(ats_placeholders)}):")
for p in ats_placeholders:
    print(f"   - {{{{ {p} }}}}")

print(f"\n[INFO] Conveyance Placeholders ({len(conv_placeholders)}):")
for p in conv_placeholders:
    print(f"   - {{{{ {p} }}}}")

print("\n[COMPLETE] HTML template generation complete!")
