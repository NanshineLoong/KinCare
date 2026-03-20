from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any


class DoclingUnavailableError(RuntimeError):
    pass


class DoclingParseError(RuntimeError):
    pass


@lru_cache(maxsize=4)
def _build_fast_converter(artifacts_path: str | None) -> Any:
    try:
        from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import DocumentConverter, PdfFormatOption, WordFormatOption
        from docling.pipeline.simple_pipeline import SimplePipeline
    except ModuleNotFoundError as error:
        raise DoclingUnavailableError(
            "Docling is not installed. Install backend dependencies to enable document attachments."
        ) from error

    options = PdfPipelineOptions(artifacts_path=artifacts_path)
    options.do_ocr = False
    options.do_table_structure = False
    options.do_code_enrichment = False
    options.do_formula_enrichment = False
    options.generate_page_images = False
    options.generate_picture_images = False
    options.images_scale = 1.0
    options.document_timeout = 60.0
    options.accelerator_options = AcceleratorOptions(
        device=AcceleratorDevice.CPU,
        num_threads=4,
    )
    if hasattr(options, "do_picture_classification"):
        options.do_picture_classification = False
    if hasattr(options, "do_picture_description"):
        options.do_picture_description = False
    if hasattr(options, "do_chart_extraction"):
        options.do_chart_extraction = False

    return DocumentConverter(
        allowed_formats=[
            InputFormat.PDF,
            InputFormat.IMAGE,
            InputFormat.DOCX,
        ],
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=options),
            InputFormat.DOCX: WordFormatOption(pipeline_cls=SimplePipeline),
        },
    )


@lru_cache(maxsize=4)
def _build_ocr_converter(artifacts_path: str | None) -> Any:
    try:
        from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
        from docling.document_converter import DocumentConverter, PdfFormatOption, WordFormatOption
        from docling.pipeline.simple_pipeline import SimplePipeline
    except ModuleNotFoundError as error:
        raise DoclingUnavailableError(
            "Docling is not installed. Install backend dependencies to enable document attachments."
        ) from error

    options = PdfPipelineOptions(artifacts_path=artifacts_path)
    options.do_ocr = True
    options.do_table_structure = False
    options.do_code_enrichment = False
    options.do_formula_enrichment = False
    options.generate_page_images = False
    options.generate_picture_images = False
    options.images_scale = 1.0
    options.document_timeout = 90.0
    options.accelerator_options = AcceleratorOptions(
        device=AcceleratorDevice.CPU,
        num_threads=4,
    )
    options.ocr_options = RapidOcrOptions(backend="onnxruntime")
    if hasattr(options, "do_picture_classification"):
        options.do_picture_classification = False
    if hasattr(options, "do_picture_description"):
        options.do_picture_description = False
    if hasattr(options, "do_chart_extraction"):
        options.do_chart_extraction = False

    return DocumentConverter(
        allowed_formats=[
            InputFormat.PDF,
            InputFormat.IMAGE,
            InputFormat.DOCX,
        ],
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=options),
            InputFormat.DOCX: WordFormatOption(pipeline_cls=SimplePipeline),
        },
    )


def parse_with_docling(path: Path, *, artifacts_path: str | None = None) -> dict[str, Any]:
    try:
        suffix = path.suffix.lower()
        converter = _build_ocr_converter(artifacts_path) if suffix in {
            ".png",
            ".jpg",
            ".jpeg",
            ".tif",
            ".tiff",
            ".bmp",
            ".webp",
        } else _build_fast_converter(artifacts_path)
        result = converter.convert(path)
        document = result.document
        markdown = document.export_to_markdown()
        text = document.export_to_markdown(strict_text=True)

        ocr_used = suffix in {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"}
        if suffix == ".pdf" and len(text.strip()) < 120:
            result = _build_ocr_converter(artifacts_path).convert(path)
            document = result.document
            markdown = document.export_to_markdown()
            text = document.export_to_markdown(strict_text=True)
            ocr_used = True
    except DoclingUnavailableError:
        raise
    except Exception as error:
        raise DoclingParseError(f"Failed to parse `{path.name}` with Docling.") from error

    return {
        "text": text.strip(),
        "markdown": markdown.strip(),
        "source_type": "docling",
        "ocr_used": ocr_used,
    }
