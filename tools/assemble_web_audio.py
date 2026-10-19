#!/usr/bin/env python3
"""Assemble SM64 audio with wasm32 bank payloads and the existing 64-bit file header.

The browser loader currently converts the outer ALSeqData table from the
repository's 64-bit serialized format to native wasm32 entries. Keep that
outer table format unchanged, but serialize each bank's nested pointers using
the target's 32-bit layout. This avoids modifying the audio loader and leaves
tools/assemble_sound.py untouched.
"""
import assemble_sound


_original_serialize_ctl = assemble_sound.serialize_ctl


def _serialize_ctl_wasm32(bank, base_ser, is_shindou, asset_offsets):
    original_word_bytes = assemble_sound.WORD_BYTES
    assemble_sound.WORD_BYTES = 4
    try:
        return _original_serialize_ctl(bank, base_ser, is_shindou, asset_offsets)
    finally:
        assemble_sound.WORD_BYTES = original_word_bytes


assemble_sound.serialize_ctl = _serialize_ctl_wasm32

if __name__ == "__main__":
    assemble_sound.main()
