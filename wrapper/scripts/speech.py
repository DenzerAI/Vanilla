import sys, wave
from piper import PiperVoice
voice = PiperVoice.load(sys.argv[1])
with wave.open(sys.argv[2], 'wb') as output:
    voice.synthesize_wav(sys.stdin.read(), output)
