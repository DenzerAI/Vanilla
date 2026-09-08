"""Copy into jobs/<job-id>/main.py; select Python in the job editor."""
import json
import sys
from pathlib import Path

request = json.load(sys.stdin)
values = request['input'].get('values', [])
if not isinstance(values, list) or not all(type(v) in (int, float) for v in values):
    raise ValueError('values must be a list of numbers')
result = {'count': len(values), 'sum': sum(values)}
output = Path(request['output']) / 'summary.json'
output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({**result, 'file': str(output)}))
