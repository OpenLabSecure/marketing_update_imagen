#!/usr/bin/env python3
import base64

# PNG de 1x1 pixel blanco (base64)
png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
png_data = base64.b64decode(png_base64)

with open("test.png", "wb") as f:
    f.write(png_data)

print("test.png creado (1x1 pixel)")