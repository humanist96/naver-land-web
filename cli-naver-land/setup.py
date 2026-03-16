#!/usr/bin/env python3
"""
setup.py for cli-anything-naver-land

Install with: pip install -e .
"""

from setuptools import setup, find_namespace_packages

setup(
    name="cli-anything-naver-land",
    version="1.0.0",
    author="cli-anything contributors",
    author_email="",
    description="CLI for Naver Land — Search apartments for sale/rent nationwide (전국) via Naver Real Estate API",
    long_description="Interactive CLI tool for searching Naver Land real estate listings across all 17 Korean provinces/cities with filtering, export, and REPL support.",
    long_description_content_type="text/plain",
    url="https://github.com/humanist96/cli-anything-naver-land",
    packages=find_namespace_packages(include=["cli_anything.*"]),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Office/Business",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.9",
    install_requires=[
        "click>=8.0.0,<9",
        "requests>=2.28.0,<3",
        "prompt-toolkit>=3.0.0,<4",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0,<9",
            "pytest-cov>=4.0.0,<6",
        ],
        "excel": [
            "openpyxl>=3.0.0,<4",
        ],
    },
    entry_points={
        "console_scripts": [
            "cli-anything-naver-land=cli_anything.naver_land.naver_land_cli:main",
        ],
    },
    include_package_data=True,
    zip_safe=False,
)
