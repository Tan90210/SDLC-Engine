import sys
from pathlib import Path
from pypdf import PdfReader

def extract_text(pdf_path_str):
    path = Path(pdf_path_str)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {path}")
    reader = PdfReader(str(path))
    pages = []
    for number, page in enumerate(reader.pages, start=1):
        content = page.extract_text() or ''
        content = content.strip()
        if content:
            pages.append(f"--- PAGE {number} ---\n{content}")
    return "\n\n".join(pages)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python extract-pdf-text.py <path-to-pdf>", file=sys.stderr)
        sys.exit(1)
    try:
        result = extract_text(sys.argv[1])
        # Ensure utf-8 output to stdout
        sys.stdout.buffer.write(result.encode('utf-8'))
    except Exception as e:
        sys.stderr.write(str(e) + '\n')
        sys.exit(1)
