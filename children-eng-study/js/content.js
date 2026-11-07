/* ========================================
   趣味英语乐园 - 拓展内容数据（v1.4.0）
   全部为英文 + Emoji 图片，不含任何中文词义
   Phonics / 绘本 / 句型 / 儿歌 / 配音 / 宠物 / 复习
   ======================================== */

// ---------- 宠物进化：按累计学习点数解锁 ----------
const PET_STAGES = [
    { emoji: '🥚', name: 'Little Egg',    min: 0 },
    { emoji: '🐣', name: 'Baby Chick',    min: 10 },
    { emoji: '🐥', name: 'Happy Bird',    min: 30 },
    { emoji: '🦜', name: 'Talking Parrot', min: 60 },
    { emoji: '🦄', name: 'Magic Unicorn',  min: 100 }
];
const PET_FEED_COST = 5;   // 喂一次消耗星星
const PET_FEED_XP = 5;     // 喂一次增加点数

// ---------- 错词间隔复习（天） ----------
const REVIEW_INTERVALS = [1, 2, 4, 7, 15];

// ---------- Phonics 自然拼读 ----------
const PHONICS_DATA = [
    {
        id: 'ph-a', sound: '/æ/', letter: 'a', emoji: '🍎',
        examples: [{ word: 'apple', emoji: '🍎' }, { word: 'ant', emoji: '🐜' }, { word: 'bag', emoji: '🎒' }],
        build: { word: 'cat', emoji: '🐱', letters: ['c', 'a', 't'] },
        choices: ['a', 'b', 'd']
    },
    {
        id: 'ph-b', sound: '/b/', letter: 'b', emoji: '⚽',
        examples: [{ word: 'ball', emoji: '⚽' }, { word: 'bear', emoji: '🐻' }, { word: 'book', emoji: '📖' }],
        build: { word: 'bag', emoji: '🎒', letters: ['b', 'a', 'g'] },
        choices: ['b', 'p', 'd']
    },
    {
        id: 'ph-c', sound: '/k/', letter: 'c', emoji: '🐱',
        examples: [{ word: 'cat', emoji: '🐱' }, { word: 'cake', emoji: '🎂' }, { word: 'car', emoji: '🚗' }],
        build: { word: 'cap', emoji: '🧢', letters: ['c', 'a', 'p'] },
        choices: ['c', 's', 't']
    },
    {
        id: 'ph-d', sound: '/d/', letter: 'd', emoji: '🐶',
        examples: [{ word: 'dog', emoji: '🐶' }, { word: 'duck', emoji: '🦆' }, { word: 'doll', emoji: '🪆' }],
        build: { word: 'dog', emoji: '🐶', letters: ['d', 'o', 'g'] },
        choices: ['d', 'b', 't']
    },
    {
        id: 'ph-e', sound: '/e/', letter: 'e', emoji: '🥚',
        examples: [{ word: 'egg', emoji: '🥚' }, { word: 'elephant', emoji: '🐘' }, { word: 'bed', emoji: '🛏️' }],
        build: { word: 'pen', emoji: '🖊️', letters: ['p', 'e', 'n'] },
        choices: ['e', 'a', 'i']
    },
    {
        id: 'ph-f', sound: '/f/', letter: 'f', emoji: '🐟',
        examples: [{ word: 'fish', emoji: '🐟' }, { word: 'flower', emoji: '🌸' }, { word: 'foot', emoji: '🦶' }],
        build: { word: 'fan', emoji: '🪭', letters: ['f', 'a', 'n'] },
        choices: ['f', 'h', 'v']
    },
    {
        id: 'ph-h', sound: '/h/', letter: 'h', emoji: '🎩',
        examples: [{ word: 'hat', emoji: '🎩' }, { word: 'hand', emoji: '✋' }, { word: 'house', emoji: '🏠' }],
        build: { word: 'hat', emoji: '🎩', letters: ['h', 'a', 't'] },
        choices: ['h', 'n', 'm']
    },
    {
        id: 'ph-m', sound: '/m/', letter: 'm', emoji: '🌙',
        examples: [{ word: 'moon', emoji: '🌙' }, { word: 'milk', emoji: '🥛' }, { word: 'monkey', emoji: '🐵' }],
        build: { word: 'map', emoji: '🗺️', letters: ['m', 'a', 'p'] },
        choices: ['m', 'n', 'w']
    },
    {
        id: 'ph-s', sound: '/s/', letter: 's', emoji: '☀️',
        examples: [{ word: 'sun', emoji: '☀️' }, { word: 'star', emoji: '⭐' }, { word: 'snake', emoji: '🐍' }],
        build: { word: 'sun', emoji: '☀️', letters: ['s', 'u', 'n'] },
        choices: ['s', 'z', 't']
    },
    {
        id: 'ph-t', sound: '/t/', letter: 't', emoji: '🐯',
        examples: [{ word: 'tiger', emoji: '🐯' }, { word: 'tree', emoji: '🌳' }, { word: 'toy', emoji: '🧸' }],
        build: { word: 'ten', emoji: '🔟', letters: ['t', 'e', 'n'] },
        choices: ['t', 'd', 'p']
    }
];

// ---------- Emoji 绘本小剧场（3 格 + 2 个结局） ----------
const STORY_DATA = [
    {
        id: 'st-1', grade: 1, title: 'A Sunny Morning', cover: ['🌅', '👦', '🐱'],
        pages: [
            { scene: ['🌅', '👦'], text: 'Good morning!' },
            { scene: ['🐱', '🥛'], text: 'The cat wants milk.' },
            { scene: ['👦', '🥛', '🐱'], text: 'Here you are, little cat!' }
        ],
        endings: [{ text: 'The cat is happy!', emoji: '😺' }, { text: 'The cat says meow!', emoji: '🐱' }]
    },
    {
        id: 'st-2', grade: 1, title: 'My Big Family', cover: ['👨', '👩', '🐶'],
        pages: [
            { scene: ['🏠', '👨‍👩‍👧‍👦'], text: 'This is my family.' },
            { scene: ['👨', '👩'], text: 'This is my father and mother.' },
            { scene: ['🐶', '🧒'], text: 'I love my dog and my family!' }
        ],
        endings: [{ text: 'We play together!', emoji: '🎈' }, { text: 'We have dinner!', emoji: '🍽️' }]
    },
    {
        id: 'st-3', grade: 2, title: 'Colour Hunt', cover: ['🔴', '🟡', '🔵'],
        pages: [
            { scene: ['🍎', '🔴'], text: 'The apple is red.' },
            { scene: ['🍌', '🟡'], text: 'Bananas are yellow.' },
            { scene: ['🌤️', '🔵'], text: 'The sky is blue.' }
        ],
        endings: [{ text: 'I like all the colours!', emoji: '🌈' }, { text: 'Let us draw a rainbow!', emoji: '🖍️' }]
    },
    {
        id: 'st-4', grade: 2, title: 'Yummy Picnic', cover: ['🧺', '🍞', '🧃'],
        pages: [
            { scene: ['🌳', '🧺'], text: 'We have a picnic.' },
            { scene: ['🍞', '🥛'], text: 'Have some bread and milk.' },
            { scene: ['🎂', '😋'], text: 'A birthday cake! Yummy!' }
        ],
        endings: [{ text: 'Thank you, my friend!', emoji: '🤝' }, { text: 'Let us sing a song!', emoji: '🎵' }]
    },
    {
        id: 'st-5', grade: 3, title: 'A Day at School', cover: ['🏫', '📚', '🏃'],
        pages: [
            { scene: ['🌅', '🎒'], text: 'I go to school in the morning.' },
            { scene: ['📚', '👩‍🏫'], text: 'I read books with my teacher.' },
            { scene: ['🏃', '🤸'], text: 'We play on the playground.' }
        ],
        endings: [{ text: 'School is fun!', emoji: '🏫' }, { text: 'See you tomorrow!', emoji: '👋' }]
    },
    {
        id: 'st-6', grade: 3, title: 'My Hobby Show', cover: ['🎨', '🎵', '💃'],
        pages: [
            { scene: ['🎨', '🖍️'], text: 'I like drawing pictures.' },
            { scene: ['🎵', '🎤'], text: 'I can sing a song.' },
            { scene: ['💃', '👏'], text: 'Let us dance together!' }
        ],
        endings: [{ text: 'What a great show!', emoji: '🏅' }, { text: 'I am so happy!', emoji: '😄' }]
    },
    {
        id: 'st-7', grade: 4, title: 'Rainy Day Fun', cover: ['🌧️', '☂️', '🏠'],
        pages: [
            { scene: ['🌧️', '☁️'], text: 'It is rainy today.' },
            { scene: ['☂️', '🧒'], text: 'I take my umbrella.' },
            { scene: ['🏠', '📖'], text: 'I read a book at home.' }
        ],
        endings: [{ text: 'The sun comes out!', emoji: '☀️' }, { text: 'I jump in a puddle!', emoji: '💦' }]
    },
    {
        id: 'st-8', grade: 4, title: 'A Trip to the Beach', cover: ['🏖️', '🌊', '⛵'],
        pages: [
            { scene: ['🧳', '✈️'], text: 'I love to travel.' },
            { scene: ['🏖️', '🌊'], text: 'We play on the beach.' },
            { scene: ['⛵', '🐚'], text: 'A little boat on the blue ocean!' }
        ],
        endings: [{ text: 'What a happy holiday!', emoji: '🎉' }, { text: 'I want to come back!', emoji: '🏖️' }]
    },
    {
        id: 'st-9', grade: 5, title: 'Save Our Earth', cover: ['🌍', '🌱', '♻️'],
        pages: [
            { scene: ['🌍', '💚'], text: 'Protect the Earth.' },
            { scene: ['🌱', '🌳'], text: 'Plant more trees.' },
            { scene: ['♻️', '📄'], text: 'Recycle paper every day.' }
        ],
        endings: [{ text: 'The forest is green again!', emoji: '🌲' }, { text: 'Thank you, little hero!', emoji: '🦸' }]
    },
    {
        id: 'st-10', grade: 5, title: 'My Big Dream', cover: ['🚀', '⭐', '🔮'],
        pages: [
            { scene: ['🔮', '💭'], text: 'I have a dream.' },
            { scene: ['📋', '🎯'], text: 'I make a plan and set a goal.' },
            { scene: ['🚀', '👨‍🚀'], text: 'I want to be an astronaut!' }
        ],
        endings: [{ text: 'Follow your dream!', emoji: '🌟' }, { text: 'Study hard every day!', emoji: '📚' }]
    }
];

// ---------- 句型换词（选图填句） ----------
const PATTERN_DATA = [
    { id: 'pt-1', pattern: 'I like ___.', options: [{ word: 'apples', emoji: '🍎' }, { word: 'bananas', emoji: '🍌' }, { word: 'milk', emoji: '🥛' }] },
    { id: 'pt-2', pattern: 'I can ___.', options: [{ word: 'swim', emoji: '🏊' }, { word: 'jump', emoji: '🤸' }, { word: 'sing', emoji: '🎵' }] },
    { id: 'pt-3', pattern: 'This is my ___.', options: [{ word: 'father', emoji: '👨' }, { word: 'mother', emoji: '👩' }, { word: 'dog', emoji: '🐶' }] },
    { id: 'pt-4', pattern: 'It is ___.', options: [{ word: 'sunny', emoji: '☀️' }, { word: 'rainy', emoji: '🌧️' }, { word: 'snowy', emoji: '❄️' }] },
    { id: 'pt-5', pattern: 'I have a ___.', options: [{ word: 'cat', emoji: '🐱' }, { word: 'ball', emoji: '⚽' }, { word: 'book', emoji: '📖' }] },
    { id: 'pt-6', pattern: "Let's ___!", options: [{ word: 'go', emoji: '🏃' }, { word: 'dance', emoji: '💃' }, { word: 'play', emoji: '🎮' }] },
    { id: 'pt-7', pattern: 'I see a ___.', options: [{ word: 'bird', emoji: '🐦' }, { word: 'fish', emoji: '🐟' }, { word: 'rabbit', emoji: '🐰' }] },
    { id: 'pt-8', pattern: '___ is fun!', options: [{ word: 'Reading', emoji: '📖' }, { word: 'Singing', emoji: '🎵' }, { word: 'Dancing', emoji: '💃' }] }
];

// ---------- 韵律儿歌（逐行朗读 + 拍手） ----------
const CHANT_DATA = [
    {
        id: 'ch-1', title: 'Colour Chant', cover: '🌈',
        lines: [
            { text: 'Red, red, apple red!', emoji: '🍎' },
            { text: 'Yellow, yellow, banana yellow!', emoji: '🍌' },
            { text: 'Blue, blue, sky blue!', emoji: '🌤️' },
            { text: 'Colours, colours, I love colours!', emoji: '🌈' }
        ]
    },
    {
        id: 'ch-2', title: 'Animal Chant', cover: '🐾',
        lines: [
            { text: 'Cat, cat, meow meow meow!', emoji: '🐱' },
            { text: 'Dog, dog, woof woof woof!', emoji: '🐶' },
            { text: 'Duck, duck, quack quack quack!', emoji: '🦆' },
            { text: 'Animals, animals, I love you!', emoji: '🐾' }
        ]
    },
    {
        id: 'ch-3', title: 'Number Chant', cover: '🔢',
        lines: [
            { text: 'One, two, touch my shoe!', emoji: '👟' },
            { text: 'Three, four, open the door!', emoji: '🚪' },
            { text: 'Five, six, pick up sticks!', emoji: '🥢' },
            { text: 'Seven, eight, nine, ten! Hooray!', emoji: '🎉' }
        ]
    },
    {
        id: 'ch-4', title: 'Body Chant', cover: '😊',
        lines: [
            { text: 'Head, head, nod your head!', emoji: '🧑' },
            { text: 'Hands, hands, clap your hands!', emoji: '👏' },
            { text: 'Eyes, eyes, close your eyes!', emoji: '👁️' },
            { text: 'Feet, feet, stamp your feet!', emoji: '🦶' }
        ]
    },
    {
        id: 'ch-5', title: 'Weather Chant', cover: '🌤️',
        lines: [
            { text: 'Sunny, sunny, what a day!', emoji: '☀️' },
            { text: 'Rainy, rainy, drip drop drip!', emoji: '🌧️' },
            { text: 'Windy, windy, fly my kite!', emoji: '🪁' },
            { text: 'Snowy, snowy, build a snowman!', emoji: '⛄' }
        ]
    },
    {
        id: 'ch-6', title: 'Good Morning', cover: '🌅',
        lines: [
            { text: 'Good morning, good morning!', emoji: '🌅' },
            { text: 'Wash your hands, wash your face!', emoji: '🧼' },
            { text: 'Have some bread, drink some milk!', emoji: '🥛' },
            { text: 'Off to school, hooray hooray!', emoji: '🏫' }
        ]
    }
];

// ---------- 小配音员场景 ----------
const DUB_SCENES = [
    { id: 'db-1', scene: ['🌳', '🐦', '☀️'], prompt: 'What can you see?', sample: 'I can see a bird.' },
    { id: 'db-2', scene: ['🍎', '🍌', '🧺'], prompt: 'What do you like?', sample: 'I like apples.' },
    { id: 'db-3', scene: ['🏖️', '🌊', '⛵'], prompt: 'Where do you want to go?', sample: 'I want to go to the beach.' },
    { id: 'db-4', scene: ['👨‍👩‍👧‍👦', '🏠', '❤️'], prompt: 'Who do you love?', sample: 'I love my family.' },
    { id: 'db-5', scene: ['🚀', '⭐', '🌙'], prompt: 'What is your dream?', sample: 'I want to be an astronaut.' },
    { id: 'db-6', scene: ['⚽', '🏀', '🤸'], prompt: 'What can you do?', sample: 'I can play football.' }
];

// 常用工具：稳定的洗牌与日期加减
const PlayLab = {
    shuffle: function(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    },
    // 使用本地日期而非 UTC：UTC+8 的凌晨用 toISOString 会算成前一天，
    // 导致「今日复习」和复习排期的跨天判断整体偏移一天
    formatDate: function(d) {
        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, '0'),
            String(d.getDate()).padStart(2, '0')
        ].join('-');
    },
    today: function() {
        return PlayLab.formatDate(new Date());
    },
    addDays: function(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return PlayLab.formatDate(d);
    },
    // 找出某个存档键对应的单词数据
    findWord: function(key) {
        const parts = String(key).split('-');
        if (parts.length < 3) return null;
        const gradeData = LEARNING_DATA[parts[0]];
        if (!gradeData || !gradeData.units[parts[1]]) return null;
        const word = parts.slice(2).join('-');
        return gradeData.units[parts[1]].words.find(w => w.word === word) || null;
    },
    // 词级匹配率（用于跟读真实评分）
    matchRate: function(heard, target) {
        const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean);
        const targetWords = norm(target);
        const heardSet = new Set(norm(heard));
        if (!targetWords.length) return 0;
        const hit = targetWords.filter(w => heardSet.has(w)).length;
        return hit / targetWords.length;
    }
};
