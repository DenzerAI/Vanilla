"""Install the German-capable model once; inference must never download or upload."""
import sys, json, os
from faster_whisper import WhisperModel
root = sys.argv[2]
if sys.argv[1] == 'setup':
    from huggingface_hub import snapshot_download
    snapshot_download('Systran/faster-whisper-small', local_dir=root,
                      allow_patterns=['model.bin', 'config.json', 'tokenizer.json', 'vocabulary.*'])
    model = WhisperModel(root, device='cpu', compute_type='int8', local_files_only=True)
    print('ready')
else:
    model = WhisperModel(root, device='cpu', compute_type='int8', local_files_only=True)
    segments, _ = model.transcribe(sys.argv[3], language='de', beam_size=5,
                                    vad_filter=True, condition_on_previous_text=False)
    print(json.dumps({'text': ' '.join(s.text.strip() for s in segments)}, ensure_ascii=False))
