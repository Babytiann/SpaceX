#!/usr/bin/env python3
"""Regenerate the checked-in public-lite/ from public/, without any LFS source data.

One-time setup (Python 3.11 or newer):
  python3 -m venv .texvenv
  .texvenv/bin/pip install -r scripts/textures/requirements-lite.txt
  # Install ffmpeg (including ffprobe) with libmp3lame, e.g. brew install ffmpeg.
Run from any directory:
  .texvenv/bin/python -I scripts/textures/build-lite.py

Normal npm builds consume public-lite/ as committed; they do not run this script.
All conversions and checks finish in a temporary directory before replacing public-lite/.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public"
OUTPUT = ROOT / "public-lite"
BODY_IDS = (
    "earth", "moon", "mars", "mercury", "venus", "jupiter", "saturn", "uranus",
    "neptune", "io", "europa", "ganymede", "callisto", "titan", "enceladus", "triton",
)
SCENIC_IDS = (
    "earth-orbit", "galactic-centre", "jupiter-io", "mars-sunset", "milky-way-above",
    "moon-earthrise", "ringed-moonrise", "saturn-rings", "terra-dusk", "titan-haze",
)


def probe_audio(path):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path),
    ], text=True))


def main():
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("Regenerating public-lite requires ffmpeg and ffprobe on PATH")
    if OUTPUT.is_symlink():
        raise RuntimeError("public-lite must be a real directory, not a symlink")

    manifest = json.loads((SOURCE / "textures/manifest.json").read_text())
    manifest["bodies"] = {key: manifest["bodies"][key] for key in BODY_IDS}
    manifest.pop("galaxies", None)
    manifest.pop("galaxySprites", None)
    sky = manifest["sky"]
    sky.pop("stars", None)
    sky["sizes"].pop("stars", None)
    sky["notes"].pop("stars", None)
    manifest["profile"] = "lite"
    manifest["processing"] = "JPEG: max width 2048, Q82; height: 1024x512, decoded BOX average, original min/max"

    # These are the map slots the current renderer consumes; no wildcard copy of public/.
    images = {sky["milkyway"]}
    for body in manifest["bodies"].values():
        images.update(body[slot] for slot in ("color", "night", "clouds", "surface") if slot in body)
    height_files = {body["height"]["file"] for body in manifest["bodies"].values() if "height" in body}
    texture_files = images | height_files | {"saturn_ring.png", "manifest.json", "CREDITS.md"}
    expected = {f"textures/{name}" for name in texture_files}
    expected.update(f"scenic/{name}.jpg" for name in SCENIC_IDS)
    expected.update(("music/soundtrack.mp3", "music/CREDITS.md"))

    with tempfile.TemporaryDirectory(prefix=".public-lite-", dir=ROOT) as work:
        stage = Path(work) / "output"
        textures = stage / "textures"
        textures.mkdir(parents=True)
        sizes = {}
        for name in sorted(images):
            with Image.open(SOURCE / "textures" / name) as original:
                width = min(2048, original.width)
                size = (width, round(original.height * width / original.width))
                image = original.resize(size, Image.Resampling.LANCZOS)
                if image.mode not in ("L", "RGB"):
                    image = image.convert("RGB")
                image.save(textures / name, "JPEG", quality=82, optimize=True,
                           progressive=True, subsampling=2)
                sizes[name] = list(size)

        for body in manifest["bodies"].values():
            body["sizes"] = {slot: sizes[body[slot]] for slot in body["sizes"]}
            if "height" not in body:
                continue
            spec = body["height"]
            with Image.open(SOURCE / "textures" / spec["file"]) as original:
                rgb = np.asarray(original.convert("RGB"), dtype=np.float32)
            lo, hi = spec["minMeters"], spec["maxMeters"]
            metres = lo + (rgb[..., 0] * 256 + rgb[..., 1]) / 65535 * (hi - lo)
            # Interpolate decoded height, never the packed R/G bytes independently.
            small = np.asarray(Image.fromarray(metres).resize((1024, 512), Image.Resampling.BOX))
            values = np.clip(np.rint((small - lo) / (hi - lo) * 65535), 0, 65535).astype(np.uint16)
            packed = np.zeros(values.shape + (3,), dtype=np.uint8)
            packed[..., 0], packed[..., 1] = values >> 8, values & 255
            Image.fromarray(packed).save(textures / spec["file"], "PNG", optimize=True)
            spec.update(width=1024, height=512)

        sky["sizes"]["milkyway"] = sizes[sky["milkyway"]]
        shutil.copyfile(SOURCE / "textures/saturn_ring.png", textures / "saturn_ring.png")
        (textures / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        credits = (SOURCE / "textures/CREDITS.md").read_text().split("## Galaxies (`galaxies/`)")[0]
        credits = "\n".join(line for line in credits.splitlines()
                            if not line.startswith(("| `pluto_color.jpg`", "| `sky_stars.jpg`")))
        credits += ("\n\n## Additional changes for the lightweight build\n\n"
                    "The source credits and earlier processing above are retained from public/textures/.\n"
                    "All JPEG maps are resized to at most 2048 pixels wide with Lanczos filtering and\n"
                    "re-encoded as progressive JPEG, quality 82, with the original greyscale mode retained.\n"
                    "Height maps are decoded to metres, BOX-averaged to 1024x512 and packed back into\n"
                    "lossless R/G 16-bit PNG using the same minimum and maximum heights.\n"
                    "The Saturn ring is copied unchanged. Unused Pluto, star-map and galaxy images are omitted.\n")
        (textures / "CREDITS.md").write_text(credits)

        (stage / "scenic").mkdir()
        for name in SCENIC_IDS:
            shutil.copyfile(SOURCE / f"scenic/{name}.jpg", stage / f"scenic/{name}.jpg")

        (stage / "music").mkdir()
        source_audio = SOURCE / "music/soundtrack.mp3"
        audio = stage / "music/soundtrack.mp3"
        source_info = probe_audio(source_audio)
        # Keep attribution tags, but not cover art or unrelated opaque player metadata.
        tags = {key: value for key, value in source_info["format"].get("tags", {}).items()
                if key in ("title", "artist", "album", "album_artist", "composer", "copyright", "date", "track", "disc")}
        command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                   "-i", str(source_audio), "-map", "0:a:0", "-vn", "-map_metadata", "-1",
                   "-c:a", "libmp3lame", "-b:a", "96k", "-ar", "44100", "-ac", "2",
                   "-id3v2_version", "3", "-write_id3v1", "0"]
        for key, value in tags.items():
            command.extend(("-metadata", f"{key}={value}"))
        subprocess.run([*command, str(audio)], check=True)
        (stage / "music/CREDITS.md").write_text(
            "# Soundtrack source\n\n"
            "Source: the repository's public/music/soundtrack.mp3. Source attribution is preserved below\n"
            "and in the audio's metadata tags.\n\n"
            + "\n".join(f"- {key}: {value}" for key, value in tags.items())
            + "\n\nLightweight conversion: complete recording, MP3 96 kbps, 44.1 kHz stereo; cover art removed.\n"
        )

        info = probe_audio(audio)
        stream = info["streams"][0]
        if (len(info["streams"]) != 1 or stream["codec_name"] != "mp3"
                or stream["channels"] != 2 or stream["sample_rate"] != "44100"
                or int(stream["bit_rate"]) != 96000
                or abs(float(info["format"]["duration"]) - float(source_info["format"]["duration"])) > 0.1):
            raise RuntimeError("Soundtrack validation failed: format or complete duration changed")
        actual = {str(path.relative_to(stage)) for path in stage.rglob("*") if path.is_file()}
        if actual != expected:
            raise RuntimeError(f"Unexpected output files: {actual ^ expected}")
        texture_bytes = sum(path.stat().st_size for path in textures.iterdir())
        audio_bytes = audio.stat().st_size
        if texture_bytes > 9_000_000 or audio_bytes > 15_100_000:
            raise RuntimeError(f"Asset budget exceeded: textures={texture_bytes}, audio={audio_bytes}")

        # Replace only after every conversion and check succeeds. Restore on a failed rename.
        backup = Path(work) / "previous"
        if OUTPUT.exists():
            os.replace(OUTPUT, backup)
        try:
            os.replace(stage, OUTPUT)
        except BaseException:
            if backup.exists():
                os.replace(backup, OUTPUT)
            raise
        print(json.dumps({"output": str(OUTPUT), "files": len(actual), "textureBytes": texture_bytes,
                          "audioBytes": audio_bytes, "audioSeconds": float(info["format"]["duration"])}, indent=2))


if __name__ == "__main__":
    main()
