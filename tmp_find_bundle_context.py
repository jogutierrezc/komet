from pathlib import Path
p = Path('dist/assets/index-l76hMEDi.js')
text = p.read_text(encoding='utf-8', errors='ignore')
for substr in ['async function tl','function tl','tl =','tl(s)','evaluation_responses','evaluation_id','fetchEvaluationResponses','fetchEvaluationResponsesByEvaluationIds']:
    idx = text.find(substr)
    if idx != -1:
        start = max(0, idx - 800)
        end = min(len(text), idx + 800)
        print('---', substr, 'at', idx, '---')
        print(text[start:end].replace('\n', '\\n'))
