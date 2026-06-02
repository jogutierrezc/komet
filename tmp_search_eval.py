from pathlib import Path
import re
root = Path('.')
patterns = [re.compile(r'evaluation_id=in'), re.compile(r'evaluation_responses'), re.compile(r"\.in\('evaluation_id'"), re.compile(r"\.in\(\"evaluation_id\"" )]
for path in root.rglob('*'):
    if path.is_file() and path.suffix.lower() in {'.js','.jsx','.ts','.tsx','.mjs','.json','.html'}:
        text = path.read_text(encoding='utf-8', errors='ignore')
        for pat in patterns:
            for m in pat.finditer(text):
                line = text.count('\n', 0, m.start()) + 1
                start = text.rfind('\n', 0, m.start()) + 1
                end = text.find('\n', m.start())
                if end == -1:
                    end = len(text)
                snippet = text[start:end].strip()
                print(f'{path}:{line}: {snippet}')
