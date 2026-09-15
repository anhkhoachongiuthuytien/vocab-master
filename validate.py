import json

with open('vocabulary.json', encoding='utf-8') as f:
    data = json.load(f)

empty_w = 0
empty_m = 0
total_words = 0
for t in data:
    total_words += len(t['words'])
    for w in t['words']:
        if not w['word'].strip():
            empty_w += 1
        if not w['meaning'].strip():
            empty_m += 1

print(f"Total topics: {len(data)}")
print(f"Total words: {total_words}")
print(f"Empty words: {empty_w}, Empty meanings: {empty_m}")

for t in data:
    sample_w = ", ".join(w['word'] for w in t['words'][:3])
    print(f"[{t['id']:02d}] {t['topic']} ({len(t['words'])} từ): {sample_w}")
