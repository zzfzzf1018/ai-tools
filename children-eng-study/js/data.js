/* ========================================
   趣味英语乐园 - 学习数据
   基于上海小学英语教材（沪教版）
   一年级到五年级
   ======================================== */

const LEARNING_DATA = {
    // ========== 一年级 ==========
    1: {
        name: '一年级',
        emoji: '🐣',
        theme: '单词启蒙',
        units: {
            0: {
                title: 'Unit 0 字母大冒险',
                isLetterUnit: true,
                words: [
                    { word: 'Aa', cn: '字母 A', emoji: '🅰️', phonetic: '/eɪ/', sentence: 'A is for apple.', sentenceCn: 'A 代表苹果。', letterLower: 'a', letterUpper: 'A', examples: ['apple', 'ant', 'alligator'] },
                    { word: 'Bb', cn: '字母 B', emoji: '🅱️', phonetic: '/biː/', sentence: 'B is for ball.', sentenceCn: 'B 代表球。', letterLower: 'b', letterUpper: 'B', examples: ['ball', 'bear', 'book'] },
                    { word: 'Cc', cn: '字母 C', emoji: '🅲', phonetic: '/siː/', sentence: 'C is for cat.', sentenceCn: 'C 代表猫。', letterLower: 'c', letterUpper: 'C', examples: ['cat', 'car', 'cake'] },
                    { word: 'Dd', cn: '字母 D', emoji: '🅳', phonetic: '/diː/', sentence: 'D is for dog.', sentenceCn: 'D 代表狗。', letterLower: 'd', letterUpper: 'D', examples: ['dog', 'duck', 'doll'] },
                    { word: 'Ee', cn: '字母 E', emoji: '🅴', phonetic: '/iː/', sentence: 'E is for egg.', sentenceCn: 'E 代表鸡蛋。', letterLower: 'e', letterUpper: 'E', examples: ['egg', 'elephant', 'eye'] },
                    { word: 'Ff', cn: '字母 F', emoji: '🅵', phonetic: '/ef/', sentence: 'F is for fish.', sentenceCn: 'F 代表鱼。', letterLower: 'f', letterUpper: 'F', examples: ['fish', 'flower', 'foot'] },
                    { word: 'Gg', cn: '字母 G', emoji: '🅶', phonetic: '/dʒiː/', sentence: 'G is for gift.', sentenceCn: 'G 代表礼物。', letterLower: 'g', letterUpper: 'G', examples: ['gift', 'goat', 'green'] },
                    { word: 'Hh', cn: '字母 H', emoji: '🅷', phonetic: '/eɪtʃ/', sentence: 'H is for hat.', sentenceCn: 'H 代表帽子。', letterLower: 'h', letterUpper: 'H', examples: ['hat', 'house', 'hand'] },
                    { word: 'Ii', cn: '字母 I', emoji: '🅸', phonetic: '/aɪ/', sentence: 'I is for ice cream.', sentenceCn: 'I 代表冰淇淋。', letterLower: 'i', letterUpper: 'I', examples: ['ice', 'igloo', 'ink'] },
                    { word: 'Jj', cn: '字母 J', emoji: '🅹', phonetic: '/dʒeɪ/', sentence: 'J is for juice.', sentenceCn: 'J 代表果汁。', letterLower: 'j', letterUpper: 'J', examples: ['juice', 'jump', 'jacket'] },
                    { word: 'Kk', cn: '字母 K', emoji: '🅺', phonetic: '/keɪ/', sentence: 'K is for kite.', sentenceCn: 'K 代表风筝。', letterLower: 'k', letterUpper: 'K', examples: ['kite', 'king', 'kitchen'] },
                    { word: 'Ll', cn: '字母 L', emoji: '🅻', phonetic: '/el/', sentence: 'L is for lion.', sentenceCn: 'L 代表狮子。', letterLower: 'l', letterUpper: 'L', examples: ['lion', 'leg', 'lemon'] },
                    { word: 'Mm', cn: '字母 M', emoji: '🅼', phonetic: '/em/', sentence: 'M is for monkey.', sentenceCn: 'M 代表猴子。', letterLower: 'm', letterUpper: 'M', examples: ['monkey', 'milk', 'moon'] },
                    { word: 'Nn', cn: '字母 N', emoji: '🅽', phonetic: '/en/', sentence: 'N is for nose.', sentenceCn: 'N 代表鼻子。', letterLower: 'n', letterUpper: 'N', examples: ['nose', 'net', 'night'] },
                    { word: 'Oo', cn: '字母 O', emoji: '🅾️', phonetic: '/əʊ/', sentence: 'O is for orange.', sentenceCn: 'O 代表橙子。', letterLower: 'o', letterUpper: 'O', examples: ['orange', 'octopus', 'owl'] },
                    { word: 'Pp', cn: '字母 P', emoji: '🅿️', phonetic: '/piː/', sentence: 'P is for pig.', sentenceCn: 'P 代表猪。', letterLower: 'p', letterUpper: 'P', examples: ['pig', 'pen', 'pink'] },
                    { word: 'Qq', cn: '字母 Q', emoji: '🅠', phonetic: '/kjuː/', sentence: 'Q is for queen.', sentenceCn: 'Q 代表女王。', letterLower: 'q', letterUpper: 'Q', examples: ['queen', 'question', 'quilt'] },
                    { word: 'Rr', cn: '字母 R', emoji: '🅡', phonetic: '/ɑː/', sentence: 'R is for rabbit.', sentenceCn: 'R 代表兔子。', letterLower: 'r', letterUpper: 'R', examples: ['rabbit', 'red', 'rain'] },
                    { word: 'Ss', cn: '字母 S', emoji: '🅢', phonetic: '/es/', sentence: 'S is for sun.', sentenceCn: 'S 代表太阳。', letterLower: 's', letterUpper: 'S', examples: ['sun', 'snake', 'star'] },
                    { word: 'Tt', cn: '字母 T', emoji: '🅣', phonetic: '/tiː/', sentence: 'T is for tiger.', sentenceCn: 'T 代表老虎。', letterLower: 't', letterUpper: 'T', examples: ['tiger', 'tree', 'toy'] },
                    { word: 'Uu', cn: '字母 U', emoji: '🅤', phonetic: '/juː/', sentence: 'U is for umbrella.', sentenceCn: 'U 代表雨伞。', letterLower: 'u', letterUpper: 'U', examples: ['umbrella', 'up', 'unicorn'] },
                    { word: 'Vv', cn: '字母 V', emoji: '🅥', phonetic: '/viː/', sentence: 'V is for van.', sentenceCn: 'V 代表面包车。', letterLower: 'v', letterUpper: 'V', examples: ['van', 'violin', 'violet'] },
                    { word: 'Ww', cn: '字母 W', emoji: '🅦', phonetic: '/ˈdʌbljuː/', sentence: 'W is for water.', sentenceCn: 'W 代表水。', letterLower: 'w', letterUpper: 'W', examples: ['water', 'whale', 'window'] },
                    { word: 'Xx', cn: '字母 X', emoji: '🅧', phonetic: '/eks/', sentence: 'X is for box.', sentenceCn: 'X 代表盒子。', letterLower: 'x', letterUpper: 'X', examples: ['box', 'fox', 'xylophone'] },
                    { word: 'Yy', cn: '字母 Y', emoji: '🅨', phonetic: '/waɪ/', sentence: 'Y is for yellow.', sentenceCn: 'Y 代表黄色。', letterLower: 'y', letterUpper: 'Y', examples: ['yellow', 'yacht', 'yes'] },
                    { word: 'Zz', cn: '字母 Z', emoji: '🅩', phonetic: '/ziː/', sentence: 'Z is for zebra.', sentenceCn: 'Z 代表斑马。', letterLower: 'z', letterUpper: 'Z', examples: ['zebra', 'zoo', 'zero'] },
                ]
            },
            1: {
                title: 'Unit 1 打招呼',
                words: [
                    { word: 'hello', cn: '你好', emoji: '👋', phonetic: '/həˈləʊ/', sentence: 'Hello! I\'m Tom.', sentenceCn: '你好！我是汤姆。' },
                    { word: 'hi', cn: '嗨', emoji: '🖐️', phonetic: '/haɪ/', sentence: 'Hi, Alice!', sentenceCn: '嗨，爱丽丝！' },
                    { word: 'goodbye', cn: '再见', emoji: '👋', phonetic: '/ˌɡʊdˈbaɪ/', sentence: 'Goodbye, friends!', sentenceCn: '再见，朋友们！' },
                    { word: 'bye', cn: '拜拜', emoji: '✋', phonetic: '/baɪ/', sentence: 'Bye bye!', sentenceCn: '拜拜！' },
                    { word: 'morning', cn: '早上', emoji: '🌅', phonetic: '/ˈmɔːnɪŋ/', sentence: 'Good morning!', sentenceCn: '早上好！' },
                    { word: 'afternoon', cn: '下午', emoji: '☀️', phonetic: '/ˌɑːftəˈnuːn/', sentence: 'Good afternoon!', sentenceCn: '下午好！' },
                    { word: 'evening', cn: '晚上', emoji: '🌙', phonetic: '/ˈiːvnɪŋ/', sentence: 'Good evening!', sentenceCn: '晚上好！' },
                    { word: 'night', cn: '夜晚', emoji: '⭐', phonetic: '/naɪt/', sentence: 'Good night!', sentenceCn: '晚安！' },
                ]
            },
            2: {
                title: 'Unit 2 我的家人',
                words: [
                    { word: 'father', cn: '爸爸', emoji: '👨', phonetic: '/ˈfɑːðə/', sentence: 'This is my father.', sentenceCn: '这是我的爸爸。' },
                    { word: 'mother', cn: '妈妈', emoji: '👩', phonetic: '/ˈmʌðə/', sentence: 'This is my mother.', sentenceCn: '这是我的妈妈。' },
                    { word: 'brother', cn: '兄弟', emoji: '👦', phonetic: '/ˈbrʌðə/', sentence: 'I have a brother.', sentenceCn: '我有一个兄弟。' },
                    { word: 'sister', cn: '姐妹', emoji: '👧', phonetic: '/ˈsɪstə/', sentence: 'I love my sister.', sentenceCn: '我爱我的姐妹。' },
                    { word: 'grandpa', cn: '爷爷', emoji: '👴', phonetic: '/ˈɡrænpɑː/', sentence: 'My grandpa is old.', sentenceCn: '我的爷爷年纪大了。' },
                    { word: 'grandma', cn: '奶奶', emoji: '👵', phonetic: '/ˈɡrænmɑː/', sentence: 'My grandma is kind.', sentenceCn: '我的奶奶很善良。' },
                    { word: 'family', cn: '家庭', emoji: '👨‍👩‍👧‍👦', phonetic: '/ˈfæməli/', sentence: 'I love my family.', sentenceCn: '我爱我的家。' },
                    { word: 'friend', cn: '朋友', emoji: '🤝', phonetic: '/frend/', sentence: 'She is my friend.', sentenceCn: '她是我的朋友。' },
                ]
            },
            3: {
                title: 'Unit 3 认识自己',
                words: [
                    { word: 'face', cn: '脸', emoji: '😊', phonetic: '/feɪs/', sentence: 'Touch your face.', sentenceCn: '摸摸你的脸。' },
                    { word: 'eye', cn: '眼睛', emoji: '👁️', phonetic: '/aɪ/', sentence: 'Close your eyes.', sentenceCn: '闭上你的眼睛。' },
                    { word: 'ear', cn: '耳朵', emoji: '👂', phonetic: '/ɪə/', sentence: 'Touch your ear.', sentenceCn: '摸摸你的耳朵。' },
                    { word: 'nose', cn: '鼻子', emoji: '👃', phonetic: '/nəʊz/', sentence: 'Smell with your nose.', sentenceCn: '用鼻子闻。' },
                    { word: 'mouth', cn: '嘴巴', emoji: '👄', phonetic: '/maʊθ/', sentence: 'Open your mouth.', sentenceCn: '张开你的嘴巴。' },
                    { word: 'head', cn: '头', emoji: '🧑', phonetic: '/hed/', sentence: 'Touch your head.', sentenceCn: '摸摸你的头。' },
                    { word: 'hand', cn: '手', emoji: '✋', phonetic: '/hænd/', sentence: 'Shake hands.', sentenceCn: '握手。' },
                    { word: 'foot', cn: '脚', emoji: '🦶', phonetic: '/fʊt/', sentence: 'Stamp your foot.', sentenceCn: '跺跺脚。' },
                ]
            },
            4: {
                title: 'Unit 4 快乐数字',
                words: [
                    { word: 'one', cn: '一', emoji: '1️⃣', phonetic: '/wʌn/', sentence: 'I have one apple.', sentenceCn: '我有一个苹果。' },
                    { word: 'two', cn: '二', emoji: '2️⃣', phonetic: '/tuː/', sentence: 'Two eyes.', sentenceCn: '两只眼睛。' },
                    { word: 'three', cn: '三', emoji: '3️⃣', phonetic: '/θriː/', sentence: 'Three little pigs.', sentenceCn: '三只小猪。' },
                    { word: 'four', cn: '四', emoji: '4️⃣', phonetic: '/fɔː/', sentence: 'Four legs.', sentenceCn: '四条腿。' },
                    { word: 'five', cn: '五', emoji: '5️⃣', phonetic: '/faɪv/', sentence: 'Five fingers.', sentenceCn: '五根手指。' },
                    { word: 'six', cn: '六', emoji: '6️⃣', phonetic: '/sɪks/', sentence: 'Six years old.', sentenceCn: '六岁。' },
                    { word: 'seven', cn: '七', emoji: '7️⃣', phonetic: '/ˈsevn/', sentence: 'Seven days.', sentenceCn: '七天。' },
                    { word: 'eight', cn: '八', emoji: '8️⃣', phonetic: '/eɪt/', sentence: 'Eight legs.', sentenceCn: '八条腿。' },
                    { word: 'nine', cn: '九', emoji: '9️⃣', phonetic: '/naɪn/', sentence: 'Nine lives.', sentenceCn: '九条命。' },
                    { word: 'ten', cn: '十', emoji: '🔟', phonetic: '/ten/', sentence: 'Ten toes.', sentenceCn: '十个脚趾。' },
                ]
            },
            5: {
                title: 'Unit 5 可爱动物',
                words: [
                    { word: 'cat', cn: '猫', emoji: '🐱', phonetic: '/kæt/', sentence: 'I have a cat.', sentenceCn: '我有一只猫。' },
                    { word: 'dog', cn: '狗', emoji: '🐶', phonetic: '/dɒɡ/', sentence: 'The dog is cute.', sentenceCn: '这只狗很可爱。' },
                    { word: 'bird', cn: '鸟', emoji: '🐦', phonetic: '/bɜːd/', sentence: 'A bird can fly.', sentenceCn: '鸟会飞。' },
                    { word: 'fish', cn: '鱼', emoji: '🐟', phonetic: '/fɪʃ/', sentence: 'Fish can swim.', sentenceCn: '鱼会游泳。' },
                    { word: 'pig', cn: '猪', emoji: '🐷', phonetic: '/pɪɡ/', sentence: 'Pigs are pink.', sentenceCn: '猪是粉色的。' },
                    { word: 'cow', cn: '牛', emoji: '🐮', phonetic: '/kaʊ/', sentence: 'Cows eat grass.', sentenceCn: '牛吃草。' },
                    { word: 'duck', cn: '鸭子', emoji: '🦆', phonetic: '/dʌk/', sentence: 'A duck can swim.', sentenceCn: '鸭子会游泳。' },
                    { word: 'rabbit', cn: '兔子', emoji: '🐰', phonetic: '/ˈræbɪt/', sentence: 'Rabbits jump.', sentenceCn: '兔子会跳。' },
                ]
            }
        }
    },

    // ========== 二年级 ==========
    2: {
        name: '二年级',
        emoji: '🐰',
        theme: '单词乐园',
        units: {
            1: {
                title: 'Unit 1 缤纷颜色',
                words: [
                    { word: 'red', cn: '红色', emoji: '🔴', phonetic: '/red/', sentence: 'The apple is red.', sentenceCn: '苹果是红色的。' },
                    { word: 'yellow', cn: '黄色', emoji: '🟡', phonetic: '/ˈjeləʊ/', sentence: 'Bananas are yellow.', sentenceCn: '香蕉是黄色的。' },
                    { word: 'blue', cn: '蓝色', emoji: '🔵', phonetic: '/bluː/', sentence: 'The sky is blue.', sentenceCn: '天空是蓝色的。' },
                    { word: 'green', cn: '绿色', emoji: '🟢', phonetic: '/ɡriːn/', sentence: 'Grass is green.', sentenceCn: '草是绿色的。' },
                    { word: 'black', cn: '黑色', emoji: '⚫', phonetic: '/blæk/', sentence: 'A black cat.', sentenceCn: '一只黑猫。' },
                    { word: 'white', cn: '白色', emoji: '⚪', phonetic: '/waɪt/', sentence: 'Snow is white.', sentenceCn: '雪是白色的。' },
                    { word: 'pink', cn: '粉色', emoji: '🌸', phonetic: '/pɪŋk/', sentence: 'I like pink.', sentenceCn: '我喜欢粉色。' },
                    { word: 'orange', cn: '橙色', emoji: '🟠', phonetic: '/ˈɒrɪndʒ/', sentence: 'Oranges are orange.', sentenceCn: '橙子是橙色的。' },
                ]
            },
            2: {
                title: 'Unit 2 我的文具',
                words: [
                    { word: 'pen', cn: '钢笔', emoji: '🖊️', phonetic: '/pen/', sentence: 'I have a pen.', sentenceCn: '我有一支钢笔。' },
                    { word: 'pencil', cn: '铅笔', emoji: '✏️', phonetic: '/ˈpensl/', sentence: 'A red pencil.', sentenceCn: '一支红色的铅笔。' },
                    { word: 'book', cn: '书', emoji: '📖', phonetic: '/bʊk/', sentence: 'Open the book.', sentenceCn: '打开书。' },
                    { word: 'bag', cn: '书包', emoji: '🎒', phonetic: '/bæɡ/', sentence: 'My bag is heavy.', sentenceCn: '我的书包很重。' },
                    { word: 'ruler', cn: '尺子', emoji: '📏', phonetic: '/ˈruːlə/', sentence: 'Use your ruler.', sentenceCn: '用你的尺子。' },
                    { word: 'eraser', cn: '橡皮', emoji: '🧽', phonetic: '/ɪˈreɪzə/', sentence: 'An eraser.', sentenceCn: '一块橡皮。' },
                    { word: 'desk', cn: '书桌', emoji: '🪑', phonetic: '/desk/', sentence: 'On the desk.', sentenceCn: '在桌子上。' },
                    { word: 'chair', cn: '椅子', emoji: '💺', phonetic: '/tʃeə/', sentence: 'Sit on the chair.', sentenceCn: '坐在椅子上。' },
                ]
            },
            3: {
                title: 'Unit 3 美味食物',
                words: [
                    { word: 'apple', cn: '苹果', emoji: '🍎', phonetic: '/ˈæpl/', sentence: 'Eat an apple.', sentenceCn: '吃一个苹果。' },
                    { word: 'banana', cn: '香蕉', emoji: '🍌', phonetic: '/bəˈnɑːnə/', sentence: 'I like bananas.', sentenceCn: '我喜欢香蕉。' },
                    { word: 'bread', cn: '面包', emoji: '🍞', phonetic: '/bred/', sentence: 'Have some bread.', sentenceCn: '吃点面包。' },
                    { word: 'milk', cn: '牛奶', emoji: '🥛', phonetic: '/mɪlk/', sentence: 'Drink some milk.', sentenceCn: '喝点牛奶。' },
                    { word: 'rice', cn: '米饭', emoji: '🍚', phonetic: '/raɪs/', sentence: 'I eat rice.', sentenceCn: '我吃米饭。' },
                    { word: 'water', cn: '水', emoji: '💧', phonetic: '/ˈwɔːtə/', sentence: 'Water is good.', sentenceCn: '水很好。' },
                    { word: 'egg', cn: '鸡蛋', emoji: '🥚', phonetic: '/eɡ/', sentence: 'An egg.', sentenceCn: '一个鸡蛋。' },
                    { word: 'cake', cn: '蛋糕', emoji: '🎂', phonetic: '/keɪk/', sentence: 'A birthday cake.', sentenceCn: '一个生日蛋糕。' },
                ]
            },
            4: {
                title: 'Unit 4 快乐玩具',
                words: [
                    { word: 'ball', cn: '球', emoji: '⚽', phonetic: '/bɔːl/', sentence: 'Kick the ball.', sentenceCn: '踢球。' },
                    { word: 'doll', cn: '娃娃', emoji: '🪆', phonetic: '/dɒl/', sentence: 'A pretty doll.', sentenceCn: '一个漂亮的娃娃。' },
                    { word: 'car', cn: '汽车', emoji: '🚗', phonetic: '/kɑː/', sentence: 'Toy car.', sentenceCn: '玩具汽车。' },
                    { word: 'plane', cn: '飞机', emoji: '✈️', phonetic: '/pleɪn/', sentence: 'Paper plane.', sentenceCn: '纸飞机。' },
                    { word: 'kite', cn: '风筝', emoji: '🪁', phonetic: '/kaɪt/', sentence: 'Fly a kite.', sentenceCn: '放风筝。' },
                    { word: 'teddy', cn: '泰迪熊', emoji: '🧸', phonetic: '/ˈtedi/', sentence: 'My teddy bear.', sentenceCn: '我的泰迪熊。' },
                    { word: 'bike', cn: '自行车', emoji: '🚲', phonetic: '/baɪk/', sentence: 'Ride a bike.', sentenceCn: '骑自行车。' },
                    { word: 'boat', cn: '小船', emoji: '⛵', phonetic: '/bəʊt/', sentence: 'A little boat.', sentenceCn: '一艘小船。' },
                ]
            },
            5: {
                title: 'Unit 5 我爱我家',
                words: [
                    { word: 'home', cn: '家', emoji: '🏠', phonetic: '/həʊm/', sentence: 'I go home.', sentenceCn: '我回家。' },
                    { word: 'room', cn: '房间', emoji: '🚪', phonetic: '/ruːm/', sentence: 'My room.', sentenceCn: '我的房间。' },
                    { word: 'bed', cn: '床', emoji: '🛏️', phonetic: '/bed/', sentence: 'A big bed.', sentenceCn: '一张大床。' },
                    { word: 'door', cn: '门', emoji: '🚪', phonetic: '/dɔː/', sentence: 'Open the door.', sentenceCn: '开门。' },
                    { word: 'window', cn: '窗户', emoji: '🪟', phonetic: '/ˈwɪndəʊ/', sentence: 'Close the window.', sentenceCn: '关上窗户。' },
                    { word: 'kitchen', cn: '厨房', emoji: '🍳', phonetic: '/ˈkɪtʃɪn/', sentence: 'In the kitchen.', sentenceCn: '在厨房里。' },
                    { word: 'bathroom', cn: '浴室', emoji: '🛁', phonetic: '/ˈbɑːθruːm/', sentence: 'Use the bathroom.', sentenceCn: '使用浴室。' },
                    { word: 'living room', cn: '客厅', emoji: '🛋️', phonetic: '/ˈlɪvɪŋ ruːm/', sentence: 'In the living room.', sentenceCn: '在客厅里。' },
                ]
            }
        }
    },

    // ========== 三年级 ==========
    3: {
        name: '三年级',
        emoji: '🦊',
        theme: '句型花园',
        units: {
            1: {
                title: 'Unit 1 问候与介绍',
                words: [
                    { word: 'what', cn: '什么', emoji: '❓', phonetic: '/wɒt/', sentence: 'What is your name?', sentenceCn: '你叫什么名字？' },
                    { word: 'name', cn: '名字', emoji: '📝', phonetic: '/neɪm/', sentence: 'My name is Tom.', sentenceCn: '我叫汤姆。' },
                    { word: 'how', cn: '怎样', emoji: '🤔', phonetic: '/haʊ/', sentence: 'How are you?', sentenceCn: '你好吗？' },
                    { word: 'fine', cn: '好的', emoji: '😊', phonetic: '/faɪn/', sentence: 'I\'m fine, thank you.', sentenceCn: '我很好，谢谢。' },
                    { word: 'thank', cn: '感谢', emoji: '🙏', phonetic: '/θæŋk/', sentence: 'Thank you very much.', sentenceCn: '非常感谢。' },
                    { word: 'sorry', cn: '对不起', emoji: '😢', phonetic: '/ˈsɒri/', sentence: 'I\'m sorry.', sentenceCn: '对不起。' },
                    { word: 'please', cn: '请', emoji: '🙇', phonetic: '/pliːz/', sentence: 'Please help me.', sentenceCn: '请帮我。' },
                    { word: 'welcome', cn: '欢迎', emoji: '🤗', phonetic: '/ˈwelkəm/', sentence: 'You are welcome.', sentenceCn: '不客气。' },
                ]
            },
            2: {
                title: 'Unit 2 我的学校',
                words: [
                    { word: 'school', cn: '学校', emoji: '🏫', phonetic: '/skuːl/', sentence: 'I go to school.', sentenceCn: '我去学校。' },
                    { word: 'teacher', cn: '老师', emoji: '👩‍🏫', phonetic: '/ˈtiːtʃə/', sentence: 'My teacher is nice.', sentenceCn: '我的老师很好。' },
                    { word: 'student', cn: '学生', emoji: '👨‍🎓', phonetic: '/ˈstjuːdnt/', sentence: 'I am a student.', sentenceCn: '我是一个学生。' },
                    { word: 'classroom', cn: '教室', emoji: '🏬', phonetic: '/ˈklɑːsruːm/', sentence: 'In the classroom.', sentenceCn: '在教室里。' },
                    { word: 'library', cn: '图书馆', emoji: '📚', phonetic: '/ˈlaɪbrəri/', sentence: 'I read in the library.', sentenceCn: '我在图书馆看书。' },
                    { word: 'playground', cn: '操场', emoji: '🏃', phonetic: '/ˈpleɪɡraʊnd/', sentence: 'Play on the playground.', sentenceCn: '在操场上玩。' },
                    { word: 'lesson', cn: '课程', emoji: '📚', phonetic: '/ˈlesn/', sentence: 'English lesson.', sentenceCn: '英语课。' },
                    { word: 'class', cn: '班级', emoji: '👥', phonetic: '/klɑːs/', sentence: 'Class Two.', sentenceCn: '二班。' },
                ]
            },
            3: {
                title: 'Unit 3 日常生活',
                words: [
                    { word: 'morning', cn: '早晨', emoji: '🌅', phonetic: '/ˈmɔːnɪŋ/', sentence: 'Get up in the morning.', sentenceCn: '早上起床。' },
                    { word: 'breakfast', cn: '早餐', emoji: '🍳', phonetic: '/ˈbrekfəst/', sentence: 'Have breakfast.', sentenceCn: '吃早餐。' },
                    { word: 'lunch', cn: '午餐', emoji: '🍱', phonetic: '/lʌntʃ/', sentence: 'Lunch at school.', sentenceCn: '在学校吃午餐。' },
                    { word: 'dinner', cn: '晚餐', emoji: '🍽️', phonetic: '/ˈdɪnə/', sentence: 'Have dinner together.', sentenceCn: '一起吃晚餐。' },
                    { word: 'sleep', cn: '睡觉', emoji: '😴', phonetic: '/sliːp/', sentence: 'Go to sleep.', sentenceCn: '去睡觉。' },
                    { word: 'wash', cn: '洗', emoji: '🧼', phonetic: '/wɒʃ/', sentence: 'Wash your hands.', sentenceCn: '洗手。' },
                    { word: 'eat', cn: '吃', emoji: '🍽️', phonetic: '/iːt/', sentence: 'Eat healthy food.', sentenceCn: '吃健康的食物。' },
                    { word: 'drink', cn: '喝', emoji: '🥤', phonetic: '/drɪŋk/', sentence: 'Drink more water.', sentenceCn: '多喝水。' },
                ]
            },
            4: {
                title: 'Unit 4 我的爱好',
                words: [
                    { word: 'like', cn: '喜欢', emoji: '❤️', phonetic: '/laɪk/', sentence: 'I like reading.', sentenceCn: '我喜欢阅读。' },
                    { word: 'love', cn: '热爱', emoji: '💕', phonetic: '/lʌv/', sentence: 'I love my family.', sentenceCn: '我爱我的家人。' },
                    { word: 'play', cn: '玩', emoji: '🎮', phonetic: '/pleɪ/', sentence: 'Play football.', sentenceCn: '踢足球。' },
                    { word: 'read', cn: '阅读', emoji: '📖', phonetic: '/riːd/', sentence: 'Read a book.', sentenceCn: '看书。' },
                    { word: 'sing', cn: '唱歌', emoji: '🎵', phonetic: '/sɪŋ/', sentence: 'Sing a song.', sentenceCn: '唱一首歌。' },
                    { word: 'dance', cn: '跳舞', emoji: '💃', phonetic: '/dɑːns/', sentence: 'Let\'s dance.', sentenceCn: '我们跳舞吧。' },
                    { word: 'draw', cn: '画画', emoji: '🎨', phonetic: '/drɔː/', sentence: 'Draw a picture.', sentenceCn: '画一幅画。' },
                    { word: 'run', cn: '跑', emoji: '🏃', phonetic: '/rʌn/', sentence: 'Run fast.', sentenceCn: '快跑。' },
                ]
            },
            5: {
                title: 'Unit 5 身边物品',
                words: [
                    { word: 'big', cn: '大的', emoji: '🐘', phonetic: '/bɪɡ/', sentence: 'A big elephant.', sentenceCn: '一头大象。' },
                    { word: 'small', cn: '小的', emoji: '🐭', phonetic: '/smɔːl/', sentence: 'A small mouse.', sentenceCn: '一只小老鼠。' },
                    { word: 'tall', cn: '高的', emoji: '🦒', phonetic: '/tɔːl/', sentence: 'A tall tree.', sentenceCn: '一棵高树。' },
                    { word: 'short', cn: '矮的', emoji: '📏', phonetic: '/ʃɔːt/', sentence: 'A short ruler.', sentenceCn: '一把短尺子。' },
                    { word: 'long', cn: '长的', emoji: '📏', phonetic: '/lɒŋ/', sentence: 'A long snake.', sentenceCn: '一条长蛇。' },
                    { word: 'happy', cn: '开心的', emoji: '😄', phonetic: '/ˈhæpi/', sentence: 'I am happy today.', sentenceCn: '我今天很开心。' },
                    { word: 'sad', cn: '伤心的', emoji: '😢', phonetic: '/sæd/', sentence: 'Don\'t be sad.', sentenceCn: '别伤心。' },
                    { word: 'angry', cn: '生气的', emoji: '😠', phonetic: '/ˈæŋɡri/', sentence: 'He looks angry.', sentenceCn: '他看起来很生气。' },
                ]
            }
        }
    },

    // ========== 四年级 ==========
    4: {
        name: '四年级',
        emoji: '🦁',
        theme: '故事森林',
        units: {
            1: {
                title: 'Unit 1 我的房间',
                words: [
                    { word: 'bedroom', cn: '卧室', emoji: '🛏️', phonetic: '/ˈbedruːm/', sentence: 'My bedroom is clean.', sentenceCn: '我的卧室很干净。' },
                    { word: 'sofa', cn: '沙发', emoji: '🛋️', phonetic: '/ˈsəʊfə/', sentence: 'Sit on the sofa.', sentenceCn: '坐在沙发上。' },
                    { word: 'table', cn: '桌子', emoji: '🪑', phonetic: '/ˈteɪbl/', sentence: 'On the table.', sentenceCn: '在桌子上。' },
                    { word: 'lamp', cn: '台灯', emoji: '💡', phonetic: '/læmp/', sentence: 'Turn on the lamp.', sentenceCn: '打开台灯。' },
                    { word: 'clock', cn: '时钟', emoji: '🕐', phonetic: '/klɒk/', sentence: 'Look at the clock.', sentenceCn: '看看时钟。' },
                    { word: 'picture', cn: '图片', emoji: '🖼️', phonetic: '/ˈpɪktʃə/', sentence: 'A beautiful picture.', sentenceCn: '一幅美丽的画。' },
                    { word: 'wardrobe', cn: '衣柜', emoji: '🚪', phonetic: '/ˈwɔːdrəʊb/', sentence: 'In the wardrobe.', sentenceCn: '在衣柜里。' },
                    { word: 'mirror', cn: '镜子', emoji: '🪞', phonetic: '/ˈmɪrə/', sentence: 'Look in the mirror.', sentenceCn: '照镜子。' },
                ]
            },
            2: {
                title: 'Unit 2 天气季节',
                words: [
                    { word: 'sunny', cn: '晴朗的', emoji: '☀️', phonetic: '/ˈsʌni/', sentence: 'It is sunny today.', sentenceCn: '今天天气晴朗。' },
                    { word: 'rainy', cn: '下雨的', emoji: '🌧️', phonetic: '/ˈreɪni/', sentence: 'A rainy day.', sentenceCn: '下雨天。' },
                    { word: 'cloudy', cn: '多云的', emoji: '☁️', phonetic: '/ˈklaʊdi/', sentence: 'It\'s cloudy.', sentenceCn: '多云。' },
                    { word: 'snowy', cn: '下雪的', emoji: '❄️', phonetic: '/ˈsnəʊi/', sentence: 'A snowy winter.', sentenceCn: '下雪的冬天。' },
                    { word: 'windy', cn: '有风的', emoji: '🌬️', phonetic: '/ˈwɪndi/', sentence: 'It is windy.', sentenceCn: '有风。' },
                    { word: 'spring', cn: '春天', emoji: '🌸', phonetic: '/sprɪŋ/', sentence: 'Flowers bloom in spring.', sentenceCn: '春天花开了。' },
                    { word: 'summer', cn: '夏天', emoji: '🌞', phonetic: '/ˈsʌmə/', sentence: 'Go swimming in summer.', sentenceCn: '夏天去游泳。' },
                    { word: 'autumn', cn: '秋天', emoji: '🍂', phonetic: '/ˈɔːtəm/', sentence: 'Leaves fall in autumn.', sentenceCn: '秋天落叶。' },
                    { word: 'winter', cn: '冬天', emoji: '⛄', phonetic: '/ˈwɪntə/', sentence: 'Build a snowman in winter.', sentenceCn: '冬天堆雪人。' },
                ]
            },
            3: {
                title: 'Unit 3 运动健将',
                words: [
                    { word: 'football', cn: '足球', emoji: '⚽', phonetic: '/ˈfʊtbɔːl/', sentence: 'Play football.', sentenceCn: '踢足球。' },
                    { word: 'basketball', cn: '篮球', emoji: '🏀', phonetic: '/ˈbɑːskɪtbɔːl/', sentence: 'Play basketball.', sentenceCn: '打篮球。' },
                    { word: 'swim', cn: '游泳', emoji: '🏊', phonetic: '/swɪm/', sentence: 'Can you swim?', sentenceCn: '你会游泳吗？' },
                    { word: 'jump', cn: '跳', emoji: '🤸', phonetic: '/dʒʌmp/', sentence: 'Jump high.', sentenceCn: '跳高。' },
                    { word: 'skate', cn: '滑冰', emoji: '⛸️', phonetic: '/skeɪt/', sentence: 'Let\'s go skating.', sentenceCn: '我们去滑冰吧。' },
                    { word: 'tennis', cn: '网球', emoji: '🎾', phonetic: '/ˈtenɪs/', sentence: 'Play tennis.', sentenceCn: '打网球。' },
                    { word: 'volleyball', cn: '排球', emoji: '🏐', phonetic: '/ˈvɒlibɔːl/', sentence: 'Beach volleyball.', sentenceCn: '沙滩排球。' },
                    { word: 'exercise', cn: '锻炼', emoji: '🏋️', phonetic: '/ˈeksəsaɪz/', sentence: 'Exercise every day.', sentenceCn: '每天锻炼。' },
                ]
            },
            4: {
                title: 'Unit 4 职业世界',
                words: [
                    { word: 'doctor', cn: '医生', emoji: '👨‍⚕️', phonetic: '/ˈdɒktə/', sentence: 'He is a doctor.', sentenceCn: '他是一名医生。' },
                    { word: 'nurse', cn: '护士', emoji: '👩‍⚕️', phonetic: '/nɜːs/', sentence: 'A nice nurse.', sentenceCn: '一位好护士。' },
                    { word: 'driver', cn: '司机', emoji: '🚗', phonetic: '/ˈdraɪvə/', sentence: 'A bus driver.', sentenceCn: '一名公交车司机。' },
                    { word: 'farmer', cn: '农民', emoji: '👨‍🌾', phonetic: '/ˈfɑːmə/', sentence: 'Farmers grow food.', sentenceCn: '农民种粮食。' },
                    { word: 'cook', cn: '厨师', emoji: '👨‍🍳', phonetic: '/kʊk/', sentence: 'A good cook.', sentenceCn: '一位好厨师。' },
                    { word: 'pilot', cn: '飞行员', emoji: '👨‍✈️', phonetic: '/ˈpaɪlət/', sentence: 'Fly a plane.', sentenceCn: '驾驶飞机。' },
                    { word: 'artist', cn: '艺术家', emoji: '🎨', phonetic: '/ˈɑːtɪst/', sentence: 'A great artist.', sentenceCn: '一位伟大的艺术家。' },
                    { word: 'policeman', cn: '警察', emoji: '👮', phonetic: '/pəˈliːsmən/', sentence: 'A brave policeman.', sentenceCn: '一位勇敢的警察。' },
                ]
            },
            5: {
                title: 'Unit 5 旅行度假',
                words: [
                    { word: 'travel', cn: '旅行', emoji: '🧳', phonetic: '/ˈtrævl/', sentence: 'I love to travel.', sentenceCn: '我喜欢旅行。' },
                    { word: 'airport', cn: '机场', emoji: '✈️', phonetic: '/ˈeəpɔːt/', sentence: 'Go to the airport.', sentenceCn: '去机场。' },
                    { word: 'hotel', cn: '酒店', emoji: '🏨', phonetic: '/həʊˈtel/', sentence: 'Stay in a hotel.', sentenceCn: '住酒店。' },
                    { word: 'beach', cn: '海滩', emoji: '🏖️', phonetic: '/biːtʃ/', sentence: 'Play on the beach.', sentenceCn: '在海滩上玩。' },
                    { word: 'mountain', cn: '山', emoji: '⛰️', phonetic: '/ˈmaʊntɪn/', sentence: 'Climb the mountain.', sentenceCn: '爬山。' },
                    { word: 'city', cn: '城市', emoji: '🏙️', phonetic: '/ˈsɪti/', sentence: 'A big city.', sentenceCn: '一座大城市。' },
                    { word: 'village', cn: '村庄', emoji: '🏡', phonetic: '/ˈvɪlɪdʒ/', sentence: 'A quiet village.', sentenceCn: '一个安静的村庄。' },
                    { word: 'holiday', cn: '假期', emoji: '🎉', phonetic: '/ˈhɒlədeɪ/', sentence: 'Summer holiday.', sentenceCn: '暑假。' },
                ]
            }
        }
    },

    // ========== 五年级 ==========
    5: {
        name: '五年级',
        emoji: '🐉',
        theme: '魔法城堡',
        units: {
            1: {
                title: 'Unit 1 节日庆典',
                words: [
                    { word: 'Christmas', cn: '圣诞节', emoji: '🎄', phonetic: '/ˈkrɪsməs/', sentence: 'Merry Christmas!', sentenceCn: '圣诞快乐！' },
                    { word: 'Spring Festival', cn: '春节', emoji: '🧧', phonetic: '/sprɪŋ ˈfestɪvl/', sentence: 'Happy Spring Festival!', sentenceCn: '春节快乐！' },
                    { word: 'festival', cn: '节日', emoji: '🎊', phonetic: '/ˈfestɪvl/', sentence: 'A great festival.', sentenceCn: '一个很棒的节日。' },
                    { word: 'birthday', cn: '生日', emoji: '🎂', phonetic: '/ˈbɜːθdeɪ/', sentence: 'Happy birthday!', sentenceCn: '生日快乐！' },
                    { word: 'dinner', cn: '正餐', emoji: '🍽️', phonetic: '/ˈdɪnə/', sentence: 'Family dinner.', sentenceCn: '家庭晚餐。' },
                    { word: 'present', cn: '礼物', emoji: '🎁', phonetic: '/ˈpreznt/', sentence: 'Open the present.', sentenceCn: '打开礼物。' },
                    { word: 'party', cn: '派对', emoji: '🎉', phonetic: '/ˈpɑːti/', sentence: 'A birthday party.', sentenceCn: '一个生日派对。' },
                    { word: 'celebrate', cn: '庆祝', emoji: '🥳', phonetic: '/ˈselɪbreɪt/', sentence: 'Let\'s celebrate!', sentenceCn: '让我们庆祝吧！' },
                ]
            },
            2: {
                title: 'Unit 2 环境保护',
                words: [
                    { word: 'earth', cn: '地球', emoji: '🌍', phonetic: '/ɜːθ/', sentence: 'Protect the Earth.', sentenceCn: '保护地球。' },
                    { word: 'nature', cn: '自然', emoji: '🌳', phonetic: '/ˈneɪtʃə/', sentence: 'Love nature.', sentenceCn: '热爱自然。' },
                    { word: 'pollution', cn: '污染', emoji: '🏭', phonetic: '/pəˈluːʃn/', sentence: 'Stop pollution.', sentenceCn: '停止污染。' },
                    { word: 'recycle', cn: '回收', emoji: '♻️', phonetic: '/ˌriːˈsaɪkl/', sentence: 'Recycle paper.', sentenceCn: '回收纸张。' },
                    { word: 'forest', cn: '森林', emoji: '🌲', phonetic: '/ˈfɒrɪst/', sentence: 'A green forest.', sentenceCn: '一片绿色的森林。' },
                    { word: 'ocean', cn: '海洋', emoji: '🌊', phonetic: '/ˈəʊʃn/', sentence: 'The blue ocean.', sentenceCn: '蓝色的海洋。' },
                    { word: 'animal', cn: '动物', emoji: '🦋', phonetic: '/ˈænɪml/', sentence: 'Save the animals.', sentenceCn: '拯救动物。' },
                    { word: 'plant', cn: '植物', emoji: '🌱', phonetic: '/plɑːnt/', sentence: 'Plant more trees.', sentenceCn: '种更多的树。' },
                ]
            },
            3: {
                title: 'Unit 3 购物世界',
                words: [
                    { word: 'shop', cn: '商店', emoji: '🏪', phonetic: '/ʃɒp/', sentence: 'Go shopping.', sentenceCn: '去购物。' },
                    { word: 'market', cn: '市场', emoji: '🛒', phonetic: '/ˈmɑːkɪt/', sentence: 'A big market.', sentenceCn: '一个大市场。' },
                    { word: 'supermarket', cn: '超市', emoji: '🏬', phonetic: '/ˈsuːpəmɑːkɪt/', sentence: 'In the supermarket.', sentenceCn: '在超市里。' },
                    { word: 'money', cn: '钱', emoji: '💰', phonetic: '/ˈmʌni/', sentence: 'Save money.', sentenceCn: '省钱。' },
                    { word: 'price', cn: '价格', emoji: '🏷️', phonetic: '/praɪs/', sentence: 'A low price.', sentenceCn: '低价。' },
                    { word: 'cheap', cn: '便宜的', emoji: '💲', phonetic: '/tʃiːp/', sentence: 'This is cheap.', sentenceCn: '这个很便宜。' },
                    { word: 'expensive', cn: '昂贵的', emoji: '💎', phonetic: '/ɪkˈspensɪv/', sentence: 'Too expensive.', sentenceCn: '太贵了。' },
                    { word: 'change', cn: '找回零钱', emoji: '🪙', phonetic: '/tʃeɪndʒ/', sentence: 'Here is your change.', sentenceCn: '这是找你的零钱。' },
                ]
            },
            4: {
                title: 'Unit 4 未来梦想',
                words: [
                    { word: 'future', cn: '未来', emoji: '🔮', phonetic: '/ˈfjuːtʃə/', sentence: 'My future dream.', sentenceCn: '我的未来梦想。' },
                    { word: 'dream', cn: '梦想', emoji: '💭', phonetic: '/driːm/', sentence: 'Follow your dream.', sentenceCn: '追逐你的梦想。' },
                    { word: 'hope', cn: '希望', emoji: '🌟', phonetic: '/həʊp/', sentence: 'I hope so.', sentenceCn: '我希望如此。' },
                    { word: 'plan', cn: '计划', emoji: '📋', phonetic: '/plæn/', sentence: 'Make a plan.', sentenceCn: '制定计划。' },
                    { word: 'goal', cn: '目标', emoji: '🎯', phonetic: '/ɡəʊl/', sentence: 'Set a goal.', sentenceCn: '设定目标。' },
                    { word: 'astronaut', cn: '宇航员', emoji: '👨‍🚀', phonetic: '/ˈæstrənɔːt/', sentence: 'Be an astronaut.', sentenceCn: '成为一名宇航员。' },
                    { word: 'scientist', cn: '科学家', emoji: '👨‍🔬', phonetic: '/ˈsaɪəntɪst/', sentence: 'A great scientist.', sentenceCn: '一位伟大的科学家。' },
                    { word: 'inventor', cn: '发明家', emoji: '💡', phonetic: '/ɪnˈventə/', sentence: 'A clever inventor.', sentenceCn: '一位聪明的发明家。' },
                ]
            },
            5: {
                title: 'Unit 5 学习方法',
                words: [
                    { word: 'study', cn: '学习', emoji: '📚', phonetic: '/ˈstʌdi/', sentence: 'Study hard.', sentenceCn: '努力学习。' },
                    { word: 'practice', cn: '练习', emoji: '✏️', phonetic: '/ˈpræktɪs/', sentence: 'Practice every day.', sentenceCn: '每天练习。' },
                    { word: 'remember', cn: '记住', emoji: '🧠', phonetic: '/rɪˈmembə/', sentence: 'Remember the words.', sentenceCn: '记住这些单词。' },
                    { word: 'forget', cn: '忘记', emoji: '🤔', phonetic: '/fəˈɡet/', sentence: 'Don\'t forget.', sentenceCn: '别忘了。' },
                    { word: 'answer', cn: '回答', emoji: '💬', phonetic: '/ˈɑːnsə/', sentence: 'Answer the question.', sentenceCn: '回答问题。' },
                    { word: 'question', cn: '问题', emoji: '❓', phonetic: '/ˈkwestʃən/', sentence: 'Ask a question.', sentenceCn: '问一个问题。' },
                    { word: 'knowledge', cn: '知识', emoji: '📖', phonetic: '/ˈnɒlɪdʒ/', sentence: 'Knowledge is power.', sentenceCn: '知识就是力量。' },
                    { word: 'success', cn: '成功', emoji: '🏆', phonetic: '/səkˈses/', sentence: 'Wish you success.', sentenceCn: '祝你成功。' },
                ]
            }
        }
    }
};

// 成就徽章数据
const BADGES_DATA = [
    { id: 'first_word', name: '初学乍练', icon: '🌱', desc: '学习第一个单词', condition: 'words >= 1' },
    { id: 'word_10', name: '小试牛刀', icon: '📖', desc: '学习10个单词', condition: 'words >= 10' },
    { id: 'word_50', name: '勤学苦练', icon: '📚', desc: '学习50个单词', condition: 'words >= 50' },
    { id: 'word_100', name: '博览群书', icon: '🎓', desc: '学习100个单词', condition: 'words >= 100' },
    { id: 'speak_10', name: '敢说敢讲', icon: '🎤', desc: '朗读10次', condition: 'speak >= 10' },
    { id: 'speak_50', name: '能说会道', icon: '🗣️', desc: '朗读50次', condition: 'speak >= 50' },
    { id: 'game_win', name: '初露锋芒', icon: '🏅', desc: '完成第一个游戏', condition: 'games >= 1' },
    { id: 'game_10', name: '游戏达人', icon: '🎮', desc: '完成10个游戏', condition: 'games >= 10' },
    { id: 'day_3', name: '坚持不懈', icon: '📅', desc: '连续学习3天', condition: 'days >= 3' },
    { id: 'day_7', name: '一周之星', icon: '⭐', desc: '连续学习7天', condition: 'days >= 7' },
    { id: 'grade_complete', name: '完美通关', icon: '🏆', desc: '完成一个年级', condition: 'grade_complete' },
    { id: 'grade_5', name: '毕业啦', icon: '🎊', desc: '完成所有年级', condition: 'all_complete' },
];
