from pathlib import Path
from pathlib import Path
base = Path('dist/assets')
with open('bundle_eval_lines.txt', 'w', encoding='utf-8') as f:
    for path in base.glob('*.js'):
        text = path.read_text(encoding='utf-8', errors='ignore')
        if 'evaluation_responses' in text or '.in(' in text or 'fetchEvaluationResponses' in text:
            f.write(f'FILE {path}\n')
            for substr in ['evaluation_responses','evaluation_id=in(','evaluation_id','fetchEvaluationResponsesByEvaluationIds','fetchEvaluationResponses','.in(']:
                idx = text.find(substr)
                if idx != -1:
                    f.write(f'  {substr} at {idx}\n')
print('done')
