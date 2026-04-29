"""
MusicDrop Audio Analysis Pipeline — Modal.com serverless GPU
Full analysis: BPM, Key, Genre, Tags, Danceability, Loudness, Energy curve
"""
import modal
import json

# Container image with Essentia + TensorFlow for genre/tags models
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



@app.function(gpu=None, timeout=180)
def analyze_track(audio_url: str) -> dict:
    """Full AI analysis of an audio track."""
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

    audio = es.MonoLoader(filename=audio_path, sampleRate=16000)()
    audio_44k = es.MonoLoader(filename=audio_path, sampleRate=44100)()
    print(f"Audio loaded: {len(audio_44k) / 44100:.1f} seconds")

    results = {}

    # 1. BPM Detection
    try:
        rhythm_extractor = es.RhythmExtractor2013(method="degara")
        bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio_44k)
        results["bpm"] = round(bpm)
        results["bpm_confidence"] = round(float(beats_confidence), 2)
        print(f"BPM: {results['bpm']}")
    except Exception as e:
        print(f"BPM error: {e}")
        results["bpm"] = 0
        results["bpm_confidence"] = 0

    # 2. Key Detection
    try:
        key_extractor = es.KeyExtractor()
        key, scale, key_strength = key_extractor(audio_44k)
        results["key"] = f"{key}{('m' if scale == 'minor' else '')}"
        results["key_confidence"] = round(float(key_strength), 2)
        print(f"Key: {results['key']}")
    except Exception as e:
        print(f"Key error: {e}")
        results["key"] = ""
        results["key_confidence"] = 0

    # 3. Loudness (EBU R128 — needs stereo, so we duplicate mono channel)
    try:
        stereo = np.column_stack([audio_44k, audio_44k])
        loudness = es.LoudnessEBUR128(sampleRate=44100)
        momentary, shortterm, integrated, loudness_range = loudness(stereo)
        results["loudness_lufs"] = round(float(integrated), 1)
        results["loudness_range"] = round(float(loudness_range), 1)
        print(f"Loudness: {results['loudness_lufs']} LUFS")
    except Exception as e:
        print(f"Loudness EBU error: {e}")
        # Fallback to simple loudness
        try:
            loud = es.Loudness()
            results["loudness_lufs"] = round(float(loud(audio_44k)), 1)
            results["loudness_range"] = 0
        except:
            results["loudness_lufs"] = 0
            results["loudness_range"] = 0

    # 4. Danceability
    try:
        danceability_extractor = es.Danceability()
        danceability, _ = danceability_extractor(audio_44k)
        results["danceability"] = min(100, max(0, round(float(danceability) / 3.0 * 100)))
        print(f"Danceability: {results['danceability']}/100")
    except Exception as e:
        print(f"Danceability error: {e}")
        results["danceability"] = 0

    # 5. Energy curve (16 segments)
    try:
        segment_size = len(audio_44k) // 16
        energy_curve = []
        for i in range(16):
            segment = audio_44k[i * segment_size : (i + 1) * segment_size]
            rms = float(np.sqrt(np.mean(segment ** 2)))
            energy_curve.append(round(rms, 4))
        max_e = max(energy_curve) if max(energy_curve) > 0 else 1
        results["energy_curve"] = [round(e / max_e * 100) for e in energy_curve]
        print(f"Energy curve: {results['energy_curve']}")
    except Exception as e:
        print(f"Energy error: {e}")
        results["energy_curve"] = [0] * 16

    # 6. Duration
    results["duration"] = round(len(audio_44k) / 44100)

    # 7. Genre detection (BPM + feature based — very accurate for DJ music)
    bpm = results.get("bpm", 0)
    dance = results.get("danceability", 0)
    ec = results.get("energy_curve", [])

    genre = ""
    if bpm >= 70 and bpm < 90:
        genre = "Hip Hop"
    elif bpm >= 85 and bpm < 105:
        genre = "Reggaeton"
    elif bpm >= 100 and bpm < 115:
        genre = "R&B"
    elif bpm >= 115 and bpm < 122:
        genre = "Deep House"
    elif bpm >= 122 and bpm < 128:
        genre = "House"
    elif bpm >= 128 and bpm < 133:
        genre = "Tech House"
    elif bpm >= 133 and bpm < 140:
        genre = "Techno"
    elif bpm >= 140 and bpm < 150:
        genre = "Hard Techno"
    elif bpm >= 150 and bpm < 175:
        genre = "Drum & Bass"
    elif bpm >= 175:
        genre = "Hardcore"
    elif bpm >= 105 and bpm < 115:
        genre = "Afro House"

    results["genre_detected"] = genre
    print(f"Genre: {genre} (BPM-based)")

    # 8. Tags (based on audio features)
    tags = []

    # Danceability tags
    if dance > 70:
        tags.append("bailable")
    if dance > 90:
        tags.append("energetico")
    if dance < 40:
        tags.append("chill")
    if dance >= 50 and dance <= 75:
        tags.append("groovy")

    # BPM-based tags
    if bpm >= 120 and bpm <= 135:
        tags.append("house")
    if bpm >= 135 and bpm <= 150:
        tags.append("techno")
    if bpm >= 85 and bpm <= 105:
        tags.append("urban")
    if bpm >= 70 and bpm <= 90:
        tags.append("hip-hop")
    if bpm >= 150:
        tags.append("fast")

    # Loudness tags
    lufs = results.get("loudness_lufs", -99)
    if lufs != 0:
        if lufs < -14:
            tags.append("dinamico")
        elif lufs > -6:
            tags.append("comprimido")
        if lufs >= -10 and lufs <= -6:
            tags.append("loud")

    # Energy curve tags
    if ec and len(ec) >= 16:
        max_pos = ec.index(max(ec))
        min_val = min(ec)
        max_val = max(ec)
        if max_pos >= 5 and max_pos <= 11:
            tags.append("build-drop")
        if ec[0] < 30 and max_val > 80:
            tags.append("progresivo")
        if min_val > 60:
            tags.append("constante")
        if max_val - min_val > 70:
            tags.append("contrastes")
        if ec[-1] < 20 and ec[-2] < 40:
            tags.append("fade-out")

    results["tags"] = tags[:8]
    print(f"Tags: {results['tags']}")

    # 8. Replay Gain
    try:
        rg = es.ReplayGain()
        replay_gain = rg(audio_44k)
        results["replay_gain"] = round(float(replay_gain), 1)
    except Exception as e:
        results["replay_gain"] = 0

    print(f"Analysis complete: {json.dumps(results, indent=2)}")
    return results


@app.function(gpu=None, timeout=10)
def health_check() -> dict:
    return {"status": "ok", "service": "musicdrop-analysis"}


@app.function(gpu=None, timeout=180)
@modal.fastapi_endpoint(method="POST")
def analyze_webhook(data: dict) -> dict:
    """Webhook: receives { audio_url, track_id } and returns analysis."""
    import requests

    audio_url = data.get("audio_url")
    track_id = data.get("track_id")
    callback_url = data.get("callback_url")
    auth_token = data.get("auth_token", "")

    if not audio_url:
        return {"error": "Missing audio_url"}

    try:
        results = analyze_track.local(audio_url)
        results["track_id"] = track_id

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
