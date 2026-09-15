import json

with open('vocabulary.json', encoding='utf-8') as f:
    topics = json.load(f)

meta = {
    1: {'category': 'Đời sống & Gia đình', 'icon': '👨‍👩‍👧‍👦'},
    2: {'category': 'Thời trang & Làm đẹp', 'icon': '👕'},
    3: {'category': 'Thiên nhiên & Môi trường', 'icon': '🌍'},
    4: {'category': 'Tâm lý & Tính cách', 'icon': '🧠'},
    5: {'category': 'Tâm lý & Tính cách', 'icon': '😊'},
    6: {'category': 'Đời sống & Gia đình', 'icon': '🤝'},
    7: {'category': 'Tâm lý & Tính cách', 'icon': '💖'},
    8: {'category': 'Ẩm thực & Đồ uống', 'icon': '🍲'},
    9: {'category': 'Ẩm thực & Đồ uống', 'icon': '🍹'},
    10: {'category': 'Ẩm thực & Đồ uống', 'icon': '🍎'},
    11: {'category': 'Ẩm thực & Đồ uống', 'icon': '🥦'},
    12: {'category': 'Ẩm thực & Đồ uống', 'icon': '🦐'},
    13: {'category': 'Ẩm thực & Đồ uống', 'icon': '🍜'},
    14: {'category': 'Ẩm thực & Đồ uống', 'icon': '🍳'},
    15: {'category': 'Giải trí & Sở thích', 'icon': '🎨'},
    16: {'category': 'Giải trí & Sở thích', 'icon': '🎵'},
    17: {'category': 'Thời trang & Làm đẹp', 'icon': '🛍️'},
    18: {'category': 'Du lịch & Giao thông', 'icon': '✈️'},
    19: {'category': 'Giải trí & Sở thích', 'icon': '📷'},
    20: {'category': 'Giải trí & Sở thích', 'icon': '🎪'},
    21: {'category': 'Giải trí & Sở thích', 'icon': '🎬'},
    22: {'category': 'Giáo dục & Tri thức', 'icon': '📚'},
    23: {'category': 'Thời trang & Làm đẹp', 'icon': '💄'},
    24: {'category': 'Thể thao & Hoạt động', 'icon': '🏅'},
    25: {'category': 'Thể thao & Hoạt động', 'icon': '⚽'},
    26: {'category': 'Đời sống & Gia đình', 'icon': '🏠'},
    27: {'category': 'Đời sống & Gia đình', 'icon': '🍳'},
    28: {'category': 'Lễ hội & Văn hóa', 'icon': '🧧'},
    29: {'category': 'Đời sống & Gia đình', 'icon': '☕'},
    30: {'category': 'Thiên nhiên & Môi trường', 'icon': '🐾'},
    31: {'category': 'Thiên nhiên & Môi trường', 'icon': '🌸'},
    32: {'category': 'Lễ hội & Văn hóa', 'icon': '🎄'},
    33: {'category': 'Khoa học & Nghệ thuật', 'icon': '🎨'},
    34: {'category': 'Du lịch & Giao thông', 'icon': '🚗'},
    35: {'category': 'Du lịch & Giao thông', 'icon': '🚸'},
    36: {'category': 'Nghề nghiệp & Công việc', 'icon': '💼'},
    37: {'category': 'Sức khỏe & Y tế', 'icon': '🩺'},
    38: {'category': 'Sức khỏe & Y tế', 'icon': '🩹'},
    39: {'category': 'Giáo dục & Tri thức', 'icon': '🎓'},
    40: {'category': 'Giáo dục & Tri thức', 'icon': '📐'},
    41: {'category': 'Nghề nghiệp & Công việc', 'icon': '💡'},
    42: {'category': 'Lễ hội & Văn hóa', 'icon': '🏮'},
    43: {'category': 'Lễ hội & Văn hóa', 'icon': '🥮'},
    44: {'category': 'Thể thao & Hoạt động', 'icon': '🪁'},
    45: {'category': 'Lễ hội & Văn hóa', 'icon': '🏛️'},
    46: {'category': 'Khoa học & Nghệ thuật', 'icon': '🎭'},
    47: {'category': 'Nghề nghiệp & Công việc', 'icon': '📈'},
    48: {'category': 'Đô thị & Quốc gia', 'icon': '🏙️'},
    49: {'category': 'Đô thị & Quốc gia', 'icon': '🌐'},
    50: {'category': 'Nghề nghiệp & Công việc', 'icon': '🏢'}
}

categories_order = [
    'Tất cả',
    'Đời sống & Gia đình',
    'Ẩm thực & Đồ uống',
    'Tâm lý & Tính cách',
    'Thiên nhiên & Môi trường',
    'Thời trang & Làm đẹp',
    'Du lịch & Giao thông',
    'Giải trí & Sở thích',
    'Thể thao & Hoạt động',
    'Giáo dục & Tri thức',
    'Nghề nghiệp & Công việc',
    'Sức khỏe & Y tế',
    'Lễ hội & Văn hóa',
    'Khoa học & Nghệ thuật',
    'Đô thị & Quốc gia'
]

for t in topics:
    m = meta.get(t['id'], {'category': 'Chung', 'icon': '📖'})
    t['category'] = m['category']
    t['icon'] = m['icon']
    # Format topic title neatly (capitalize first letter)
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

print(f"Successfully exported vocabulary_data.js with {len(topics)} topics!")
