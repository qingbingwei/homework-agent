"""
Command line tool to validate Office document XML files against XSD schemas and tracked changes.

Usage:
    python3.11 validate.py <path> [--original <original_file>] [--auto-repair] [--author NAME]

The first argument can be either:
- An unpacked directory containing the Office document XML files
- A packed Office file (.docx/.pptx/.xlsx) which will be unpacked to a temp directory

Auto-repair fixes:
- paraId/durableId values that exceed OOXML limits
- Missing xml:space="preserve" on w:t elements with whitespace
"""

import argparse
import sys
import tempfile
import zipfile
from pathlib import Path

from validators import DOCXSchemaValidator, PPTXSchemaValidator, RedliningValidator

OFFICE_EXTENSIONS = {".docx", ".pptx", ".xlsx"}


def main():
    args = parse_args()
    path = Path(args.path)
    assert path.exists(), f"Error: {path} does not exist"

    original_file = resolve_original_file(args.original)
    file_extension = (original_file or path).suffix.lower()
    assert file_extension in OFFICE_EXTENSIONS, (
        f"Error: Cannot determine file type from {path}. Use --original or provide a .docx/.pptx/.xlsx file."
    )

    unpacked_dir = unpack_if_needed(path)
    validators = validators_for(file_extension, unpacked_dir, original_file, args.verbose, args.author)

    if args.auto_repair:
        total_repairs = sum(v.repair() for v in validators)
        if total_repairs:
            print(f"Auto-repaired {total_repairs} issue(s)")

    success = all(v.validate() for v in validators)
    if success:
        print("All validations PASSED!")

    sys.exit(0 if success else 1)


def parse_args():
    parser = argparse.ArgumentParser(description="Validate Office document XML files")
    parser.add_argument(
        "path",
        help="Path to unpacked directory or packed Office file (.docx/.pptx/.xlsx)",
    )
    parser.add_argument(
        "--original",
        required=False,
        default=None,
        help="Path to original file (.docx/.pptx/.xlsx). If omitted, all XSD errors are reported and redlining validation is skipped.",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose output",
    )
    parser.add_argument(
        "--auto-repair",
        action="store_true",
        help="Automatically repair common issues (hex IDs, whitespace preservation)",
    )
    parser.add_argument(
        "--author",
        default="Assistant",
        help="Author name for redlining validation (default: Assistant)",
    )
    return parser.parse_args()


def resolve_original_file(original_path):
    if not original_path:
        return None

    original_file = Path(original_path)
    assert original_file.is_file(), f"Error: {original_file} is not a file"
    assert original_file.suffix.lower() in OFFICE_EXTENSIONS, (
        f"Error: {original_file} must be a .docx, .pptx, or .xlsx file"
    )
    return original_file


def unpack_if_needed(path):
    if path.is_file() and path.suffix.lower() in [".docx", ".pptx", ".xlsx"]:
        temp_dir = tempfile.mkdtemp()
        with zipfile.ZipFile(path, "r") as zf:
            zf.extractall(temp_dir)
        return Path(temp_dir)

    assert path.is_dir(), f"Error: {path} is not a directory or Office file"
    return path


def validators_for(file_extension, unpacked_dir, original_file, verbose, author):
    if file_extension == ".docx":
        validators = [DOCXSchemaValidator(unpacked_dir, original_file, verbose=verbose)]
        if original_file:
            validators.append(
                RedliningValidator(unpacked_dir, original_file, verbose=verbose, author=author)
            )
        return validators

    if file_extension == ".pptx":
        return [PPTXSchemaValidator(unpacked_dir, original_file, verbose=verbose)]

    print(f"Error: Validation not supported for file type {file_extension}")
    sys.exit(1)


if __name__ == "__main__":
    main()
