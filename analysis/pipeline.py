"""
MusicDrop Audio Analysis Pipeline — Modal.com serverless GPU
Analyzes uploaded tracks: BPM, Key, Genre, Danceability, Loudness, Energy curve
"""
import modal
import json

# Define the container image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install(
        "essentia",
        "numpy<2",
        "requests",
        "fastapi[standard]",
    )
)

app = modal.App("musicdrop-analysis", image=image)


@app.function(gpu=None, timeout=120)
def analyze_track(audio_url: str) -> dict:
    """
    Download a track from R2 and run full analysis.
    Returns: { bpm, key, genre, danceability, loudness, energy_curve, tags }
    """
    import tempfile
    import requests
    import numpy as np

    # Download the audio file
    print(f"Downloading: {audio_url}")
    resp = requests.get(audio_url, timeout=60)
    resp.raise_for_status()

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        f.write(resp.content)
        audio_path = f.name

    print(f"Downloaded {len(resp.content) / 1024 / 1024:.1f} MB")

    # Load audio with Essentia
    import essentia.standard as es

    audio = es.MonoLoader(filename=audio_path, sampleRate=44100)()
    print(f"Audio loaded: {len(audio) / 44100:.1f} seconds")

    results = {}

    # 1. BPM Detection (RhythmExtractor2013)
    try:
        rhythm_extractor = es.RhythmExtractor2013(method="degara")
        bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)
        results["bpm"] = round(bpm)
        results["bpm_confidence"] = round(float(beats_confidence), 2)
        print(f"BPM: {results['bpm']} (confidence: {results['bpm_confidence']})")
    except Exception as e:
        print(f"BPM error: {e}")
        results["bpm"] = 0
        results["bpm_confidence"] = 0

    # 2. Key Detection (KeyExtractor)
    try:
        key_extractor = es.KeyExtractor()
        key, scale, key_strength = key_extractor(audio)
        results["key"] = f"{key}{('m' if scale == 'minor' else '')}"
        results["key_confidence"] = round(float(key_strength), 2)
        print(f"Key: {results['key']} (confidence: {results['key_confidence']})")
    except Exception as e:
        print(f"Key error: {e}")
        results["key"] = ""
        results["key_confidence"] = 0

    # 3. Loudness (EBU R128)
    try:
        loudness = es.LoudnessEBUR128(sampleRate=44100)
        momentary, shortterm, integrated, loudness_range = loudness(audio)
        results["loudness_lufs"] = round(float(integrated), 1)
        results["loudness_range"] = round(float(loudness_range), 1)
        print(f"Loudness: {results['loudness_lufs']} LUFS")
    except Exception as e:
        print(f"Loudness error: {e}")
        results["loudness_lufs"] = 0
        results["loudness_range"] = 0

    # 4. Danceability
    try:
        danceability_extractor = es.Danceability()
        danceability, _ = danceability_extractor(audio)
        results["danceability"] = round(float(danceability) * 100)
        print(f"Danceability: {results['danceability']}/100")
    except Exception as e:
        print(f"Danceability error: {e}")
        results["danceability"] = 0

    # 5. Energy curve (16 segments)
    try:
        segment_size = len(audio) // 16
        energy_curve = []
        for i in range(16):
            segment = audio[i * segment_size : (i + 1) * segment_size]
            rms = float(np.sqrt(np.mean(segment ** 2)))
            energy_curve.append(round(rms, 4))
        # Normalize to 0-100
        max_e = max(energy_curve) if max(energy_curve) > 0 else 1
        results["energy_curve"] = [round(e / max_e * 100) for e in energy_curve]
        print(f"Energy curve: {results['energy_curve']}")
    except Exception as e:
        print(f"Energy error: {e}")
        results["energy_curve"] = [0] * 16

    # 6. Duration
    results["duration"] = round(len(audio) / 44100)

    # 7. Replay Gain
    try:
        rg = es.ReplayGain()
        replay_gain = rg(audio)
        results["replay_gain"] = round(float(replay_gain), 1)
    except Exception as e:
        results["replay_gain"] = 0

    print(f"Analysis complete: {json.dumps(results, indent=2)}")
    return results


@app.function(gpu=None, timeout=10)
def health_check() -> dict:
    """Simple health check to verify the pipeline is running."""
    return {"status": "ok", "service": "musicdrop-analysis"}


# Web endpoint for webhook calls from MusicDrop
@app.function(gpu=None, timeout=120)
@modal.fastapi_endpoint(method="POST")
def analyze_webhook(data: dict) -> dict:
    """
    Webhook endpoint: receives { audio_url, track_id, callback_url }
    Analyzes the track and POSTs results back to callback_url.
    """
    import requests

    audio_url = data.get("audio_url")
    track_id = data.get("track_id")
    callback_url = data.get("callback_url")
    auth_token = data.get("auth_token", "")

    if not audio_url:
        return {"error": "Missing audio_url"}

    try:
        # Run analysis
        results = analyze_track.local(audio_url)
        results["track_id"] = track_id

        # Post results back to MusicDrop
        if callback_url:
            requests.post(
                callback_url,
                json=results,
                headers={"Authorization": f"Bearer {auth_token}"},
                timeout=10,
            )

        return {"status": "ok", "results": results}
    except Exception as e:
        error_msg = str(e)
        print(f"Analysis failed: {error_msg}")
        return {"error": error_msg}
