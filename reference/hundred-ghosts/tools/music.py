#!/usr/bin/env python3
"""Original instrumental electronic track for the post video. No samples, no lyrics: every sound is made here.
Needs numpy.  usage: python3 tools/music.py video/music.wav
150 BPM, 16 bars (25.6 s), the same grid as the cuts in post.html (1 beat = 12 frames at 30 fps).
  bars 1-3   build: filtered chords open up, plucks, snare roll, riser          (shot 1)
  bar  4     DROP: four-on-the-floor kick, clap, rolling bass, pumping chords    (gameplay)
  bars 6-12  + lead line                                                         (system, comparisons)
  bars 13-15 finale: lead an octave up, more top end                             (end card)
  bar  16    last hit, long tail
"""
import sys, wave
import numpy as np

SR = 44100; BPM = 150; BEAT = 60.0 / BPM; BAR = 4 * BEAT; BARS = 16
N = int(SR * (BARS * BAR + 1.2))
rng = np.random.default_rng(11)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12.0)
bus = lambda: np.zeros(N)


def put(b, t, x, g=1.0):
    i = int(t * SR)
    if i >= N or i < 0: return
    n = min(len(x), N - i); b[i:i + n] += x[:n] * g


def saw(f, n, detune=(0.0,), phase=None):
    out = np.zeros(n); t = np.arange(n) / SR
    for k, d in enumerate(detune):
        ff = f * 2 ** (d / 1200.0); ph = (t * ff + (rng.random() if phase is None else phase)) % 1.0
        out += 2 * ph - 1
    return out / len(detune)


def adsr(n, a=0.005, d=0.1, s=0.7, r=0.05):
    a, d, r = int(a * SR), int(d * SR), int(r * SR); e = np.full(n, s)
    a = min(a, n); e[:a] = np.linspace(0, 1, a, endpoint=False)
    d2 = min(d, n - a); e[a:a + d2] = np.linspace(1, s, d2, endpoint=False)
    r = min(r, n); e[n - r:] *= np.linspace(1, 0, r)
    return e


def lowpass(x, cutoff, poles=2):
    """one-pole low-pass, run 'poles' times; cutoff is a number or an array (Hz)"""
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = (1 - np.exp(-2 * np.pi * c / SR)).tolist(); y = x.tolist()
    for _ in range(poles):
        z = 0.0
        for i in range(len(y)):
            z += a[i] * (y[i] - z); y[i] = z
    return np.array(y)


def highpass(x, cutoff): return x - lowpass(x, cutoff, 1)


def conv(x, ir):  # FFT convolution, same length as x
    n = len(x) + len(ir) - 1; m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:len(x)]


def reverb_ir(seconds, bright=5000):
    n = int(seconds * SR); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 6.0 / seconds); ir[:int(0.012 * SR)] = 0
    ir = lowpass(ir, bright, 1); return ir / np.sqrt((ir ** 2).sum())  # unit energy


def delay(x, time, fb=0.4, taps=4):
    out = x.copy(); d = int(time * SR)
    for k in range(1, taps + 1):
        out[k * d:] += x[:-k * d] * fb ** k
    return out


# ---------- drums ----------
def kick():
    n = int(0.32 * SR); t = np.arange(n) / SR
    f = 46 + 150 * np.exp(-t * 34); ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 9)
    click = highpass(rng.standard_normal(n), 3000) * np.exp(-t * 400) * 0.25
    return np.tanh((body + click) * 2.2) * 0.9


def clap():
    n = int(0.3 * SR); t = np.arange(n) / SR; x = rng.standard_normal(n)
    e = np.zeros(n)
    for off in (0.0, 0.011, 0.023):  # three fast bursts, then the tail
        k = int(off * SR); e[k:] += np.exp(-(t[:n - k]) * 110) * 0.6
    k = int(0.03 * SR); e[k:] += np.exp(-(t[:n - k]) * 22)
    return highpass(lowpass(x * e, 5200, 1), 900) * 0.8


def hat(open_=False):
    n = int((0.22 if open_ else 0.04) * SR); t = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 7000) * np.exp(-t * (16 if open_ else 110)) * (0.32 if open_ else 0.2)


def snare():
    n = int(0.16 * SR); t = np.arange(n) / SR
    return (highpass(rng.standard_normal(n), 1500) * np.exp(-t * 26) * 0.6 + np.sin(2 * np.pi * 185 * t) * np.exp(-t * 34) * 0.5)


def crash(seconds=1.6):
    n = int(seconds * SR); t = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 4500) * np.exp(-t * 3.0) * 0.4


def riser(seconds):
    n = int(seconds * SR); p = np.linspace(0, 1, n)
    x = lowpass(rng.standard_normal(n), 300 + 9000 * p ** 2, 1)
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (p * 2.0)) / SR) * 0.25
    return (x * 0.5 + tone) * p ** 2


def boom():  # sub drop on a cut
    n = int(0.9 * SR); t = np.arange(n) / SR
    f = 38 + 70 * np.exp(-t * 9); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)


KICK, CLAP, HAT, OHAT, SNARE = kick(), clap(), hat(), hat(True), snare()

# ---------- harmony: E minor, bars cycle Em C G D ----------
CH = [('Em', 40, [52, 59, 64, 67]), ('C', 36, [48, 55, 60, 64]), ('G', 43, [55, 59, 62, 67]), ('D', 38, [50, 57, 62, 66])]
# lead hook: (midi, start beat in bar, length in beats)
HOOK = [[(71, 0, 1.5), (76, 1.5, .5), (79, 2, 2)], [(79, 0, 1.5), (76, 1.5, .5), (72, 2, 2)],
        [(74, 0, 1.5), (79, 1.5, .5), (83, 2, 2)], [(81, 0, 1.5), (78, 1.5, .5), (74, 2, 1), (78, 3, 1)]]
DROP = 3            # bar index where the beat comes in (cut 1, beat 12)
LASTBAR = BARS - 1

drums, kickbus, bass, pad, pluck, lead, fx = bus(), bus(), bus(), bus(), bus(), bus(), bus()

for b in range(BARS):
    t0 = b * BAR; name, root, tones = CH[b % 4]
    build, last, finale = b < DROP, b == LASTBAR, b >= 12

    # chords: 7 detuned saws for each note. Held in the build, short pumping stabs after the drop.
    if not last:
        if build:
            n = int(BAR * SR); x = sum(saw(hz(m), n, (-18, -11, -5, 0, 5, 11, 18)) for m in tones) / len(tones)
            put(pad, t0, x * adsr(n, 0.05, 0.2, 0.9, 0.08), 1.1)
            put(bass, t0, np.sin(2 * np.pi * hz(root) * np.arange(n) / SR) * adsr(n, 0.02, 0.2, 0.9, 0.1), 0.28)  # held sub under the build
        else:
            for s in range(8):  # eighth-note stabs, louder off the beat
                n = int(BEAT / 2 * 0.95 * SR); x = sum(saw(hz(m + (12 if finale and s % 2 else 0)), n, (-16, -9, -4, 0, 4, 9, 16)) for m in tones) / len(tones)
                put(pad, t0 + s * BEAT / 2, x * adsr(n, 0.004, 0.09, 0.55, 0.03), 0.5 if s % 2 else 0.34)

    # plucks: sixteenth-note arpeggio over two octaves
    if not last:
        seq = tones + [m + 12 for m in tones]
        for s in range(16):
            m = seq[(s * 3 + b) % len(seq)] + 12
            n = int(BEAT / 4 * 1.6 * SR); x = saw(hz(m), n, (-6, 6)) * np.exp(-np.arange(n) / SR * 22)
            put(pluck, t0 + s * BEAT / 4, x, 0.26 if not build else 0.2 + 0.06 * b)

    if last:  # the final hit: one big chord, a kick, a boom and a crash, then only the tail
        n = int(BAR * 0.95 * SR)
        x = sum(saw(hz(m), n, (-16, -9, -4, 0, 4, 9, 16)) for m in [52, 59, 64, 67, 71, 76]) / 6
        put(pad, t0, x * adsr(n, 0.004, 0.5, 0.35, 0.9), 0.75)
        put(kickbus, t0, KICK, 1.0); put(fx, t0, boom(), 0.7); put(fx, t0, crash(2.2), 0.9)
        n2 = int(BAR * 0.9 * SR); put(lead, t0, saw(hz(88), n2, (-7, 0, 7)) * adsr(n2, 0.01, 0.6, 0.3, 0.8), 0.3)
        continue

    # bass: rolling sixteenths (rests on each beat, where the kick is)
    if not build:
        for s in range(16):
            if s % 4 == 0: continue
            n = int(BEAT / 4 * 0.9 * SR); f = hz(root + (12 if s % 4 == 3 and b % 2 else 0))
            x = saw(f, n, (0,), 0.0) * 0.7 + np.sign(np.sin(2 * np.pi * f / 2 * np.arange(n) / SR)) * 0.45
            put(bass, t0 + s * BEAT / 4, x * adsr(n, 0.003, 0.05, 0.75, 0.02), 0.6)

    # lead hook from bar 6; an octave up and doubled in the finale
    if b >= 5:
        for m, st, ln in HOOK[b % 4]:
            n = int(ln * BEAT * 0.97 * SR); mm = m + (12 if finale else 0)
            x = saw(hz(mm), n, (-9, 0, 9)) * adsr(n, 0.008, 0.15, 0.8, 0.06)
            put(lead, t0 + st * BEAT, x, 0.34)
            if finale: put(lead, t0 + st * BEAT, saw(hz(mm - 12), n, (-7, 7)) * adsr(n, 0.008, 0.15, 0.8, 0.06), 0.2)

    # drums
    for q in range(4):
        tb = t0 + q * BEAT
        if build:
            if b == 0 and q == 0: put(kickbus, tb, KICK, 0.8)
            if b == 1 and q % 2 == 0: put(kickbus, tb, KICK, 0.8)
            if b == 2:  # snare roll: 8ths, then 16ths, then 32nds into the drop
                div = (2, 2, 4, 8)[q]
                for k in range(div): put(drums, tb + k * BEAT / div, SNARE, 0.35 + 0.5 * (q * div + k) / 32)
        else:
            put(kickbus, tb, KICK, 1.0)
            if q % 2 == 1: put(drums, tb, CLAP, 0.9)
            put(drums, tb + BEAT / 2, OHAT, 0.8)
            for k in (1, 3): put(drums, tb + k * BEAT / 4, HAT, 0.7 if finale or b >= 7 else 0.45)

# ---------- cut accents (beats; the same grid as post.html) ----------
for cb, big in ((12, True), (20, False), (30, False), (39, False), (48, True)):
    tc = cb * BEAT
    put(fx, tc - (4 if big else 2) * BEAT, riser((4 if big else 2) * BEAT), 0.5 if big else 0.28)
    put(fx, tc, crash(), 1.0 if big else 0.6)
    if big: put(fx, tc, boom(), 0.8)
    if cb != 12:
        for k in range(4): put(drums, tc - BEAT + k * BEAT / 4, SNARE, 0.3 + 0.12 * k)

# ---------- bus processing ----------
t = np.arange(N) / SR; beats = t / BEAT
# chord filter: opens during the build, wide after the drop
cut = np.where(beats < DROP * 4, 350 + 5200 * np.clip(beats / (DROP * 4), 0, 1) ** 2.2, 7500.0)
pad = lowpass(pad, cut, 2)
# side-chain: everything tonal ducks on each kick after the drop (the "pump")
ph = (beats % 1.0)
duck = np.where((beats >= DROP * 4) & (beats < LASTBAR * 4), 1 - 0.78 * np.exp(-ph * 7.5), 1.0)
pad *= duck; bass = lowpass(bass, 950, 2) * (0.35 + 0.65 * duck); pluck = lowpass(pluck, 4200, 1) * (0.5 + 0.5 * duck)
lead = lowpass(lead, 6000, 1) * (0.6 + 0.4 * duck)
IR = reverb_ir(1.6)
pluck_w = delay(pluck, BEAT * 0.75, 0.38, 3)
lead_w = delay(lead, BEAT * 0.75, 0.42, 4)
verb = conv(lead_w * 0.6 + drums * 0.35 + pad * 0.25 + pluck_w * 0.3, IR) * 0.22

mono = kickbus * 1.0 + bass * 0.95
side_l = pad * 0.62 + pluck_w * 0.8 + lead_w * 0.85 + drums * 0.8 + fx * 0.75 + verb
# stereo: short Haas delay on the wide layers
d = int(0.012 * SR); wide = pad * 0.25 + pluck_w * 0.3 + verb * 0.5
L = mono + side_l + wide
R = mono + side_l + np.concatenate([np.zeros(d), wide[:-d]]) - wide * 0.0
mix = np.stack([L, R])
mix = np.tanh(mix / np.abs(mix).max() * 1.9)             # glue and loudness
end = int(SR * BARS * BAR); fade = np.ones(N); fade[end:] = np.linspace(1, 0, N - end) ** 2
mix = mix / np.abs(mix).max() * 0.89 * fade
path = sys.argv[1] if len(sys.argv) > 1 else 'music.wav'
with wave.open(path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype('<i2').tobytes())
print('wrote', path, round(N / SR, 2), 's')
