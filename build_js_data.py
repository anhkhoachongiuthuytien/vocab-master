import json

with open('vocabulary.json', encoding='utf-8') as f:
    topics = json.load(f)

icon_map = {
    1: 'users',
    2: 'shirt',
    3: 'globe',
    4: 'brain',
    5: 'smile',
    6: 'users',
    7: 'heart',
    8: 'utensils',
    9: 'coffee',
    10: 'apple',
    11: 'leaf',
    12: 'fish',
    13: 'soup',
    14: 'utensils',
    15: 'palette',
    16: 'music',
    17: 'shopping-bag',
    18: 'plane',
    19: 'camera',
    20: 'film',
    21: 'film',
    22: 'book',
    23: 'sparkles',
    24: 'trophy',
    25: 'target',
    26: 'home',
    27: 'flame',
    28: 'gift',
    29: 'coffee',
    30: 'paw',
    31: 'flower',
    32: 'gift',
    33: 'palette',
    34: 'car',
    35: 'alert',
    36: 'briefcase',
    37: 'activity',
    38: 'pill',
    39: 'graduation',
    40: 'book',
    41: 'brain',
    42: 'lantern',
    43: 'lantern',
    44: 'flag',
    45: 'landmark',
    46: 'palette',
    47: 'briefcase',
    48: 'building',
    49: 'globe',
    50: 'building'
}

category_map = {
    1: 'Đời sống & Gia đình',
    2: 'Thời trang & Mua sắm',
    3: 'Thiên nhiên & Môi trường',
    4: 'Tâm lý & Tính cách',
    5: 'Tâm lý & Tính cách',
    6: 'Đời sống & Gia đình',
    7: 'Tâm lý & Tính cách',
    8: 'Ẩm thực & Ăn uống',
    9: 'Ẩm thực & Ăn uống',
    10: 'Ẩm thực & Ăn uống',
    11: 'Ẩm thực & Ăn uống',
    12: 'Ẩm thực & Ăn uống',
    13: 'Ẩm thực & Ăn uống',
    14: 'Ẩm thực & Ăn uống',
    15: 'Giải trí & Sở thích',
    16: 'Giải trí & Sở thích',
    17: 'Thời trang & Mua sắm',
    18: 'Du lịch & Giao thông',
    19: 'Giải trí & Sở thích',
    20: 'Giải trí & Sở thích',
    21: 'Giải trí & Sở thích',
    22: 'Giáo dục & Tri thức',
    23: 'Thời trang & Mua sắm',
    24: 'Thể thao & Hoạt động',
    25: 'Thể thao & Hoạt động',
    26: 'Đời sống & Gia đình',
    27: 'Đời sống & Gia đình',
    28: 'Lễ hội & Văn hóa',
    29: 'Đời sống & Gia đình',
    30: 'Thiên nhiên & Môi trường',
    31: 'Thiên nhiên & Môi trường',
    32: 'Lễ hội & Văn hóa',
    33: 'Giải trí & Sở thích',
    34: 'Du lịch & Giao thông',
    35: 'Du lịch & Giao thông',
    36: 'Nghề nghiệp & Công sở',
    37: 'Sức khỏe & Y tế',
    38: 'Sức khỏe & Y tế',
    39: 'Giáo dục & Tri thức',
    40: 'Giáo dục & Tri thức',
    41: 'Nghề nghiệp & Công sở',
    42: 'Lễ hội & Văn hóa',
    43: 'Lễ hội & Văn hóa',
    44: 'Thể thao & Hoạt động',
    45: 'Lễ hội & Văn hóa',
    46: 'Giải trí & Sở thích',
    47: 'Nghề nghiệp & Công sở',
    48: 'Đô thị & Quốc tế',
    49: 'Đô thị & Quốc tế',
    50: 'Nghề nghiệp & Công sở'
}

categories_order = [
    'Tất cả',
    'Đời sống & Gia đình',
    'Ẩm thực & Ăn uống',
    'Tâm lý & Tính cách',
    'Thiên nhiên & Môi trường',
    'Thời trang & Mua sắm',
    'Du lịch & Giao thông',
    'Giải trí & Sở thích',
    'Thể thao & Hoạt động',
    'Giáo dục & Tri thức',
    'Nghề nghiệp & Công sở',
    'Sức khỏe & Y tế',
    'Lễ hội & Văn hóa',
    'Đô thị & Quốc tế'
]

for t in topics:
    t['category'] = category_map.get(t['id'], 'Chung')
    t['iconName'] = icon_map.get(t['id'], 'book')
    # Remove emoji icon
    if 'icon' in t:
        del t['icon']
    
    title = t['topic'].strip()
    if title:
        t['title'] = title[0].upper() + title[1:]
    else:
        t['title'] = f"Chủ đề {t['id']}"

    for idx, w in enumerate(t['words']):
        w['id'] = f"{t['id']}_{idx+1}"
        w['topicId'] = t['id']
        w['topicName'] = t['title']

js_content = '/**\n * 1000 Từ Vựng Tiếng Anh Theo Chủ Đề\n * Trích xuất từ tài liệu [studocu.com]\n * Tự động tạo bởi build_js_data.py\n */\n\n'
js_content += 'window.VOCAB_CATEGORIES = ' + json.dumps(categories_order, ensure_ascii=False, indent=2) + ';\n\n'
js_content += 'window.VOCABULARY_DATA = ' + json.dumps(topics, ensure_ascii=False, indent=2) + ';\n'

with open('vocabulary_data.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Successfully exported vocabulary_data.js with {len(topics)} topics, clean SVG icon names, NO emojis!")
