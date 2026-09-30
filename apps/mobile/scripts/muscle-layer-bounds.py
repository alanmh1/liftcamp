"""Writes assets/images/muscles/bounds.json: each muscle layer's alpha
bounding box on the 1024 canvas, [x0, y0, x1, y1] with the ends exclusive.
The info sheet zooms its body circles to these boxes.

Run again whenever a layer changes. Needs Pillow:

    python3 -m pip install pillow
    python3 apps/mobile/scripts/muscle-layer-bounds.py
"""

import json
from pathlib import Path

from PIL import Image

DIR = Path(__file__).resolve().parent.parent / "assets" / "images" / "muscles"

layers = {}
for path in sorted(DIR.glob("*.png")):
    name = path.stem
    if not (name.endswith("_primary") or name.endswith("_secondary") or name.endswith("_mask")):
        continue
    box = Image.open(path).getchannel("A").getbbox()
    if box is not None:
        layers[name] = list(box)

rows = ",\n".join(f"    {json.dumps(name)}: {json.dumps(box)}" for name, box in layers.items())
(DIR / "bounds.json").write_text('{\n  "source": 1024,\n  "layers": {\n' + rows + "\n  }\n}\n")
print(f"{len(layers)} layers")
