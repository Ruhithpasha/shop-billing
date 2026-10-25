"""
Builds app/assets/models/mobilenet_v3_large_embedding.tflite

MobileNetV3-Large with ImageNet weights, classifier removed, global average
pooling on top: a 224x224 RGB photo in, a 960-number feature vector out.
Similar-looking products give similar vectors, which is what /match compares.

- Input:  float32 [1, 224, 224, 3], RGB, raw 0..255 values (the model rescales internally)
- Output: float32 [1, 960] (the app L2-normalises it before sending)

Run (any machine with Python 3.10+):
    python3 -m venv .venv
    .venv/bin/pip install tensorflow-cpu
    .venv/bin/python app/scripts/build_embedding_model.py
"""
import os
import tempfile

import tensorflow as tf

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "models", "mobilenet_v3_large_embedding.tflite")


def main():
    base = tf.keras.applications.MobileNetV3Large(
        input_shape=(224, 224, 3),
        include_top=False,
        pooling="avg",
        weights="imagenet",
        include_preprocessing=True,
    )
    with tempfile.TemporaryDirectory() as tmp:
        saved = os.path.join(tmp, "saved_model")
        base.export(saved, format="tf_saved_model")
        converter = tf.lite.TFLiteConverter.from_saved_model(saved)
        # float16 weights: half the file size, same accuracy for this use.
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        converter.target_spec.supported_types = [tf.float16]
        tflite = converter.convert()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as f:
        f.write(tflite)
    print(f"wrote {os.path.abspath(OUT)} ({len(tflite) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
