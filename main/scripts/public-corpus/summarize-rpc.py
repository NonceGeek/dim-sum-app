"""Summarize actual RPC verification; retain raw plans and publication evidence."""
import gzip
import json
from pathlib import Path
from statistics import median

results = Path(__file__).parent / 'results'
data = json.loads((results / 'rpc-live-verification.json').read_text())
assert len(data['checks']) == len(data['scenarios']), 'Correctness checks incomplete'
summary = []
for scenario in data['scenarios']:
    runs = [s for s in data['samples'] if s['scenario'] == scenario['label'] and s['round'] > 0]
    assert len(runs) == 3, f"Incomplete samples: {scenario['label']}"
    times = [s['executionMs'] for s in runs]
    row = {
        'scenario': scenario['label'], 'samples': len(runs),
        'median_ms': round(median(times), 3), 'min_ms': min(times), 'max_ms': max(times),
        'planning_median_ms': round(median(s['planningMs'] for s in runs), 3),
        'wall_median_ms': round(median(s['wallMs'] for s in runs), 3),
    }
    summary.append(row)
    print(f"{row['scenario']}: {row['median_ms']} ms ({row['min_ms']}–{row['max_ms']})")
output = {
    'startedAt': data['startedAt'], 'method': data['mode'], 'summary': summary,
    'checks': data['checks'],
    'limitations': 'Warm sequential samples, not concurrent load or controlled cold-cache tests. Preliminary attempts hit the 5s statement timeout; those attempts are not in these successful-run samples.',
}
(results / 'rpc-summary.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
for path in results.glob('rpc-*.json'):
    if path.name != 'rpc-summary.json':
        with gzip.open(path.with_suffix('.json.gz'), 'wt', encoding='utf-8') as handle:
            handle.write(path.read_text())
