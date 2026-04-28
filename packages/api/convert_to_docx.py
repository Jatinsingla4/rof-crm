#!/usr/bin/env python3
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import re

# Read the markdown file
with open('DEMO_QUICK_START.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Create a new Word document
doc = Document()

# Add title
title = doc.add_heading('🎯 ROF CRM Demo - Quick Start Guide', 0)
title.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

subtitle = doc.add_paragraph('For: Management & Senior Staff Demo Session')
subtitle.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
subtitle_format = subtitle.runs[0]
subtitle_format.italic = True

doc.add_paragraph()  # Spacing

# Parse the markdown content
lines = content.split('\n')
i = 0
while i < len(lines):
    line = lines[i]

    # Skip empty lines
    if not line.strip():
        i += 1
        continue

    # Handle headings
    if line.startswith('# '):
        doc.add_heading(line[2:], level=1)
    elif line.startswith('## '):
        doc.add_heading(line[3:], level=2)
    elif line.startswith('### '):
        doc.add_heading(line[4:], level=3)
    elif line.startswith('#### '):
        doc.add_heading(line[5:], level=4)

    # Handle code blocks
    elif line.startswith('```'):
        code_lines = []
        i += 1
        while i < len(lines) and not lines[i].startswith('```'):
            code_lines.append(lines[i])
            i += 1
        code_text = '\n'.join(code_lines)
        code_para = doc.add_paragraph(code_text)
        code_para.style = 'Normal'
        for run in code_para.runs:
            run.font.name = 'Courier New'
            run.font.size = Pt(9)
        # Add gray background
        shading_elm = OxmlElement('w:shd')
        shading_elm.set(qn('w:fill'), 'E7E6E6')
        code_para._element.get_or_add_pPr().append(shading_elm)

    # Handle tables
    elif line.strip().startswith('| '):
        # Parse table
        table_rows = []
        while i < len(lines) and lines[i].strip().startswith('| '):
            row = [cell.strip() for cell in lines[i].split('|')[1:-1]]
            table_rows.append(row)
            i += 1
        i -= 1  # Back up one since we'll increment at the end

        if table_rows:
            # Create table (rows + 1 for potential header)
            table = doc.add_table(rows=len(table_rows), cols=len(table_rows[0]))
            table.style = 'Light Grid Accent 1'

            for row_idx, row_data in enumerate(table_rows):
                for col_idx, cell_text in enumerate(row_data):
                    table.rows[row_idx].cells[col_idx].text = cell_text

    # Handle ordered/unordered lists
    elif line.startswith('- ') or line.startswith('* '):
        list_text = line[2:]
        para = doc.add_paragraph(list_text, style='List Bullet')
    elif re.match(r'^\d+\. ', line):
        list_text = re.sub(r'^\d+\. ', '', line)
        para = doc.add_paragraph(list_text, style='List Number')

    # Handle bold/italic inline formatting
    else:
        # Replace markdown bold and italic markers with text handling
        text = line
        para = doc.add_paragraph()

        # Simple bold/italic parsing
        current_pos = 0
        while current_pos < len(text):
            # Find next formatting marker
            bold_start = text.find('**', current_pos)
            italic_start = text.find('*', current_pos)

            # Determine which comes first
            next_marker = len(text)
            marker_type = None

            if bold_start != -1 and bold_start < next_marker:
                next_marker = bold_start
                marker_type = 'bold'
            if italic_start != -1 and italic_start < next_marker:
                next_marker = italic_start
                marker_type = 'italic'

            # Add text before marker
            if next_marker > current_pos:
                para.add_run(text[current_pos:next_marker])

            if marker_type == 'bold':
                # Find closing **
                end = text.find('**', bold_start + 2)
                if end != -1:
                    run = para.add_run(text[bold_start + 2:end])
                    run.bold = True
                    current_pos = end + 2
                else:
                    para.add_run(text[bold_start:bold_start + 2])
                    current_pos = bold_start + 2
            elif marker_type == 'italic':
                # Find closing *
                end = text.find('*', italic_start + 1)
                if end != -1 and end != italic_start + 1:  # Avoid ** matching
                    run = para.add_run(text[italic_start + 1:end])
                    run.italic = True
                    current_pos = end + 1
                else:
                    para.add_run(text[italic_start])
                    current_pos = italic_start + 1
            else:
                break

    i += 1

# Save the document
output_file = 'DEMO_QUICK_START.docx'
doc.save(output_file)
print(f'Document created successfully: {output_file}')
