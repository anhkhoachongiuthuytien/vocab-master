import fitz
import json
import re

def get_cell_text(page, bbox):
    d = json.loads(page.get_text('rawjson', clip=bbox))
    lines_out = []
    for b in d.get('blocks', []):
        for l in b.get('lines', []):
            line_str = ''
            chars = []
            for s in l.get('spans', []):
                chars.extend(s.get('chars', []))
            for i, c in enumerate(chars):
                if i > 0:
                    gap = c['bbox'][0] - chars[i-1]['bbox'][2]
                    if gap > 1.8 and chars[i-1]['c'] != ' ' and c['c'] != ' ':
                        line_str += ' '
                line_str += c['c']
            if line_str.strip():
                lines_out.append(line_str.strip())
    return ' '.join(lines_out).strip()

def extract_all():
    doc = fitz.open('[studocu.com] - 1000 Từ Vựng Tiếng Anh Theo Chủ Đề Thông Dụng - Tài Liệu Học Tập.pdf')
    all_topics = {}
    current_topic_id = None

    for pno in range(7, len(doc)):
        page = doc[pno]
        tabs = page.find_tables()
        tables = list(tabs.tables) if tabs else []
        
        headings = []
        for b in page.get_text('blocks'):
            txt = b[4].strip()
            m = re.match(r'^(\d+)[\.\s]+Từ\s*vựng\s*về\s*(.+)$', txt, re.IGNORECASE)
            if m:
                t_id = int(m.group(1))
                t_name = m.group(2).strip()
                headings.append((b[1], t_id, t_name, b))
                
        headings.sort(key=lambda x: x[0])
        tables.sort(key=lambda t: t.bbox[1])
        
        events = []
        for h in headings:
            events.append(('heading', h[0], h))
        for t in tables:
            events.append(('table', t.bbox[1], t))
        events.sort(key=lambda x: x[1])
        
        for ev_type, y0, ev_obj in events:
            if ev_type == 'heading':
                t_id, t_name = ev_obj[1], ev_obj[2]
                t_clean_name = get_cell_text(page, ev_obj[3][:4])
                m_c = re.search(r'Từ\s*vựng\s*về\s*(.+)', t_clean_name, re.IGNORECASE)
                title = m_c.group(1).strip() if m_c else t_name
                current_topic_id = t_id
                if t_id not in all_topics:
                    all_topics[t_id] = {'id': t_id, 'topic': title, 'words': []}
            elif ev_type == 'table':
                if current_topic_id is None:
                    continue
                t = ev_obj
                for r in t.rows:
                    cells = [get_cell_text(page, c) for c in r.cells]
                    if len(cells) >= 3:
                        w, p, m = cells[0].strip(), cells[1].strip(), cells[2].strip()
                        # Clean header rows or junk
                        if 'Từ vựng' in w or 'Phát âm' in p or 'Nghĩa' in m or 'Từvựng' in w:
                            continue
                        if not w and not m:
                            continue
                        # Sometimes word has newline or extra spaces
                        w = re.sub(r'\s+', ' ', w)
                        p = re.sub(r'\s+', ' ', p)
                        m = re.sub(r'\s+', ' ', m)
                        all_topics[current_topic_id]['words'].append({
                            'word': w,
                            'phonetic': p,
                            'meaning': m
                        })

    print(f"Total topics: {len(all_topics)}")
    total_words = sum(len(t['words']) for t in all_topics.values())
    print(f"Total words: {total_words}")
    
    # Save to json
    topics_list = [all_topics[k] for k in sorted(all_topics.keys())]
    with open('vocabulary.json', 'w', encoding='utf-8') as f:
        json.dump(topics_list, f, ensure_ascii=False, indent=2)
    print("Saved vocabulary.json successfully!")

if __name__ == '__main__':
    extract_all()
