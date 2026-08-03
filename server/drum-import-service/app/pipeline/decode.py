"""Audio decoding via ffmpeg subprocess — same technique as the standalone
script, parameterized so ffmpeg doesn't need to be on PATH (FFMPEG_BIN env
var lets the caller point at a specific binary, e.g. a winget/static-build
install that hasn't been added to PATH yet).
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import numpy as np

from .constants import SR


class DecodeError(RuntimeError):
    """Raised when ffmpeg fails to decode a given file."""


def ffmpeg_binary() -> str:
    return os.environ.get("FFMPEG_BIN", "ffmpeg")


def decode(path: Path) -> np.ndarray:
    """Decode any ffmpeg-supported audio file to mono float32 PCM at SR Hz."""
    try:
        raw = subprocess.check_output(
            [
                ffmpeg_binary(), "-v", "error", "-i", str(path),
                "-ac", "1", "-ar", str(SR), "-f", "f32le", "pipe:1",
            ],
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError as error:
        raise DecodeError(
            f"ffmpeg binary not found ({ffmpeg_binary()!r}) — set the FFMPEG_BIN "
            "environment variable to its full path if it isn't on PATH."
        ) from error
    except subprocess.CalledProcessError as error:
        stderr = error.stderr.decode("utf-8", errors="replace") if error.stderr else ""
        raise DecodeError(f"ffmpeg failed to decode {path.name}: {stderr.strip()}") from error
    return np.frombuffer(raw, dtype="<f4").copy()


def ffmpeg_available() -> tuple[bool, str | None]:
    binary = ffmpeg_binary()
    try:
        subprocess.run(
            [binary, "-version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        return True, binary
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False, None
