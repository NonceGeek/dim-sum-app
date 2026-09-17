"""Summarize the read-only benchmark; exclude the first observed/warmup round."""
import gzip
import json
from pathlib import Path
from statistics import median

root = Path(__file__).parent
results = root / 'results'
data = json.loads((results / 'benchmark.json').read_text())
variants = ['direct_sql', 'existing_rpc_public_scope', 'staged_public_sql']
summary = []
for scenario in data['scenarios']:
    row = {'scenario': scenario['label'], 'keyword': scenario['keyword'], 'datasets': scenario['datasets']}
    for variant in variants:
        runs = [s for s in data['samples'] if s['scenario'] == scenario['label'] and s['variant'] == variant and s['round'] > 0]
        times = [s['executionMs'] for s in runs if 'executionMs' in s]
        row[variant] = {
            'successful_runs': len(times),
            'timeouts_or_errors': len([s for s in runs if 'error' in s]),
            'median_ms': round(median(times), 3) if times else None,
            'min_ms': min(times) if times else None,
            'max_ms': max(times) if times else None,
            'planning_median_ms': round(median(s['planningMs'] for s in runs if 'planningMs' in s), 3) if times else None,
            'wall_median_ms': round(median(s['wallMs'] for s in runs if 'executionMs' in s), 3) if times else None,
        }
    summary.append(row)
output = {'startedAt': data['startedAt'], 'method': data['mode'], 'summary': summary, 'checks': data['checks']}
(results / 'benchmark-summary.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
for path in results.glob('*.json'):
    if path.name == 'benchmark-summary.json':
        continue
    with gzip.open(path.with_suffix('.json.gz'), 'wt', encoding='utf-8') as handle:
        handle.write(path.read_text())
print('| 查询 | 当前直接 SQL | 原 RPC＋公开范围 | 分阶段候选 SQL |')
print('|---|---:|---:|---:|')
for row in summary:
    cells = [f"{row[v]['median_ms']:.1f} ms" if row[v]['median_ms'] is not None else '超时/未完成' for v in variants]
    print('| ' + row['keyword'] + ('（指定语料集）' if row['datasets'] else '') + ' | ' + ' | '.join(cells) + ' |')
print('Result equality:', data['checks'])
