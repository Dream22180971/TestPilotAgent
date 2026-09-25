"""Document text extraction: supports TXT, PDF, and DOCX formats."""

import io

from pdfplumber import open as open_pdf
from docx import Document


def parse_document(content: bytes, extension: str, filename: str = "") -> dict:
    """Parse a document and return extracted text with metadata.

    Args:
        content: Raw file bytes.
        extension: File extension including dot, e.g. '.pdf', '.docx', '.txt'.
        filename: Original filename (used for fallback).

    Returns:
        dict with keys: text (str), page_count (int, 0 for non-PDF).
    """
    ext = extension.lower()
    if ext == ".pdf":
        return _parse_pdf(content)
    elif ext == ".docx":
        return _parse_docx(content)
    else:
        return _parse_txt(content)


def _parse_pdf(content: bytes) -> dict:
    pages = []
    page_count = 0
    with open_pdf(io.BytesIO(content)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return {"text": "\n".join(pages), "page_count": page_count}


def _parse_docx(content: bytes) -> dict:
    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return {"text": "\n".join(paragraphs), "page_count": 0}


def _parse_txt(content: bytes) -> dict:
    text = content.decode("utf-8", errors="replace")
    return {"text": text, "page_count": 0}
