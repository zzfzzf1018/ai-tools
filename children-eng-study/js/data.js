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
                title: 'Unit 0 Alphabet Adventure',
                isLetterUnit: true,
                words: [
                    { word: 'Aa', emoji: '🅰️', phonetic: '/eɪ/', sentence: 'A is for apple.', letterLower: 'a', letterUpper: 'A', examples: ['apple', 'ant', 'alligator'] },
                    { word: 'Bb', emoji: '🅱️', phonetic: '/biː/', sentence: 'B is for ball.', letterLower: 'b', letterUpper: 'B', examples: ['ball', 'bear', 'book'] },
                    { word: 'Cc', emoji: '🅲', phonetic: '/siː/', sentence: 'C is for cat.', letterLower: 'c', letterUpper: 'C', examples: ['cat', 'car', 'cake'] },
                    { word: 'Dd', emoji: '🅳', phonetic: '/diː/', sentence: 'D is for dog.', letterLower: 'd', letterUpper: 'D', examples: ['dog', 'duck', 'doll'] },
                    { word: 'Ee', emoji: '🅴', phonetic: '/iː/', sentence: 'E is for egg.', letterLower: 'e', letterUpper: 'E', examples: ['egg', 'elephant', 'eye'] },
                    { word: 'Ff', emoji: '🅵', phonetic: '/ef/', sentence: 'F is for fish.', letterLower: 'f', letterUpper: 'F', examples: ['fish', 'flower', 'foot'] },
                    { word: 'Gg', emoji: '🅶', phonetic: '/dʒiː/', sentence: 'G is for gift.', letterLower: 'g', letterUpper: 'G', examples: ['gift', 'goat', 'green'] },
                    { word: 'Hh', emoji: '🅷', phonetic: '/eɪtʃ/', sentence: 'H is for hat.', letterLower: 'h', letterUpper: 'H', examples: ['hat', 'house', 'hand'] },
                    { word: 'Ii', emoji: '🅸', phonetic: '/aɪ/', sentence: 'I is for ice cream.', letterLower: 'i', letterUpper: 'I', examples: ['ice', 'igloo', 'ink'] },
                    { word: 'Jj', emoji: '🅹', phonetic: '/dʒeɪ/', sentence: 'J is for juice.', letterLower: 'j', letterUpper: 'J', examples: ['juice', 'jump', 'jacket'] },
                    { word: 'Kk', emoji: '🅺', phonetic: '/keɪ/', sentence: 'K is for kite.', letterLower: 'k', letterUpper: 'K', examples: ['kite', 'king', 'kitchen'] },
                    { word: 'Ll', emoji: '🅻', phonetic: '/el/', sentence: 'L is for lion.', letterLower: 'l', letterUpper: 'L', examples: ['lion', 'leg', 'lemon'] },
                    { word: 'Mm', emoji: '🅼', phonetic: '/em/', sentence: 'M is for monkey.', letterLower: 'm', letterUpper: 'M', examples: ['monkey', 'milk', 'moon'] },
                    { word: 'Nn', emoji: '🅽', phonetic: '/en/', sentence: 'N is for nose.', letterLower: 'n', letterUpper: 'N', examples: ['nose', 'net', 'night'] },
                    { word: 'Oo', emoji: '🅾️', phonetic: '/əʊ/', sentence: 'O is for orange.', letterLower: 'o', letterUpper: 'O', examples: ['orange', 'octopus', 'owl'] },
                    { word: 'Pp', emoji: '🅿️', phonetic: '/piː/', sentence: 'P is for pig.', letterLower: 'p', letterUpper: 'P', examples: ['pig', 'pen', 'pink'] },
                    { word: 'Qq', emoji: '🅠', phonetic: '/kjuː/', sentence: 'Q is for queen.', letterLower: 'q', letterUpper: 'Q', examples: ['queen', 'question', 'quilt'] },
                    { word: 'Rr', emoji: '🅡', phonetic: '/ɑː/', sentence: 'R is for rabbit.', letterLower: 'r', letterUpper: 'R', examples: ['rabbit', 'red', 'rain'] },
                    { word: 'Ss', emoji: '🅢', phonetic: '/es/', sentence: 'S is for sun.', letterLower: 's', letterUpper: 'S', examples: ['sun', 'snake', 'star'] },
                    { word: 'Tt', emoji: '🅣', phonetic: '/tiː/', sentence: 'T is for tiger.', letterLower: 't', letterUpper: 'T', examples: ['tiger', 'tree', 'toy'] },
                    { word: 'Uu', emoji: '🅤', phonetic: '/juː/', sentence: 'U is for umbrella.', letterLower: 'u', letterUpper: 'U', examples: ['umbrella', 'up', 'unicorn'] },
                    { word: 'Vv', emoji: '🅥', phonetic: '/viː/', sentence: 'V is for van.', letterLower: 'v', letterUpper: 'V', examples: ['van', 'violin', 'violet'] },
                    { word: 'Ww', emoji: '🅦', phonetic: '/ˈdʌbljuː/', sentence: 'W is for water.', letterLower: 'w', letterUpper: 'W', examples: ['water', 'whale', 'window'] },
                    { word: 'Xx', emoji: '🅧', phonetic: '/eks/', sentence: 'X is for box.', letterLower: 'x', letterUpper: 'X', examples: ['box', 'fox', 'xylophone'] },
                    { word: 'Yy', emoji: '🅨', phonetic: '/waɪ/', sentence: 'Y is for yellow.', letterLower: 'y', letterUpper: 'Y', examples: ['yellow', 'yacht', 'yes'] },
                    { word: 'Zz', emoji: '🅩', phonetic: '/ziː/', sentence: 'Z is for zebra.', letterLower: 'z', letterUpper: 'Z', examples: ['zebra', 'zoo', 'zero'] },
                ]
            },
            1: {
                title: 'Unit 1 Greetings',
                words: [
                    { word: 'hello', emoji: '👋', phonetic: '/həˈləʊ/', sentence: 'Hello! I\'m Tom.' },
                    { word: 'hi', emoji: '🖐️', phonetic: '/haɪ/', sentence: 'Hi, Alice!' },
                    { word: 'goodbye', emoji: '👋', phonetic: '/ˌɡʊdˈbaɪ/', sentence: 'Goodbye, friends!' },
                    { word: 'bye', emoji: '✋', phonetic: '/baɪ/', sentence: 'Bye bye!' },
                    { word: 'morning', emoji: '🌅', phonetic: '/ˈmɔːnɪŋ/', sentence: 'Good morning!' },
                    { word: 'afternoon', emoji: '☀️', phonetic: '/ˌɑːftəˈnuːn/', sentence: 'Good afternoon!' },
                    { word: 'evening', emoji: '🌙', phonetic: '/ˈiːvnɪŋ/', sentence: 'Good evening!' },
                    { word: 'night', emoji: '⭐', phonetic: '/naɪt/', sentence: 'Good night!' },
                ]
            },
            2: {
                title: 'Unit 2 My Family',
                words: [
                    { word: 'father', emoji: '👨', phonetic: '/ˈfɑːðə/', sentence: 'This is my father.' },
                    { word: 'mother', emoji: '👩', phonetic: '/ˈmʌðə/', sentence: 'This is my mother.' },
                    { word: 'brother', emoji: '👦', phonetic: '/ˈbrʌðə/', sentence: 'I have a brother.' },
                    { word: 'sister', emoji: '👧', phonetic: '/ˈsɪstə/', sentence: 'I love my sister.' },
                    { word: 'grandpa', emoji: '👴', phonetic: '/ˈɡrænpɑː/', sentence: 'My grandpa is old.' },
                    { word: 'grandma', emoji: '👵', phonetic: '/ˈɡrænmɑː/', sentence: 'My grandma is kind.' },
                    { word: 'family', emoji: '👨‍👩‍👧‍👦', phonetic: '/ˈfæməli/', sentence: 'I love my family.' },
                    { word: 'friend', emoji: '🤝', phonetic: '/frend/', sentence: 'She is my friend.' },
                ]
            },
            3: {
                title: 'Unit 3 My Body',
                words: [
                    { word: 'face', emoji: '😊', phonetic: '/feɪs/', sentence: 'Touch your face.' },
                    { word: 'eye', emoji: '👁️', phonetic: '/aɪ/', sentence: 'Close your eyes.' },
                    { word: 'ear', emoji: '👂', phonetic: '/ɪə/', sentence: 'Touch your ear.' },
                    { word: 'nose', emoji: '👃', phonetic: '/nəʊz/', sentence: 'Smell with your nose.' },
                    { word: 'mouth', emoji: '👄', phonetic: '/maʊθ/', sentence: 'Open your mouth.' },
                    { word: 'head', emoji: '🧑', phonetic: '/hed/', sentence: 'Touch your head.' },
                    { word: 'hand', emoji: '✋', phonetic: '/hænd/', sentence: 'Shake hands.' },
                    { word: 'foot', emoji: '🦶', phonetic: '/fʊt/', sentence: 'Stamp your foot.' },
                ]
            },
            4: {
                title: 'Unit 4 Numbers',
                words: [
                    { word: 'one', emoji: '1️⃣', phonetic: '/wʌn/', sentence: 'I have one apple.' },
                    { word: 'two', emoji: '2️⃣', phonetic: '/tuː/', sentence: 'Two eyes.' },
                    { word: 'three', emoji: '3️⃣', phonetic: '/θriː/', sentence: 'Three little pigs.' },
                    { word: 'four', emoji: '4️⃣', phonetic: '/fɔː/', sentence: 'Four legs.' },
                    { word: 'five', emoji: '5️⃣', phonetic: '/faɪv/', sentence: 'Five fingers.' },
                    { word: 'six', emoji: '6️⃣', phonetic: '/sɪks/', sentence: 'Six years old.' },
                    { word: 'seven', emoji: '7️⃣', phonetic: '/ˈsevn/', sentence: 'Seven days.' },
                    { word: 'eight', emoji: '8️⃣', phonetic: '/eɪt/', sentence: 'Eight legs.' },
                    { word: 'nine', emoji: '9️⃣', phonetic: '/naɪn/', sentence: 'Nine lives.' },
                    { word: 'ten', emoji: '🔟', phonetic: '/ten/', sentence: 'Ten toes.' },
                ]
            },
            5: {
                title: 'Unit 5 Animals',
                words: [
                    { word: 'cat', emoji: '🐱', phonetic: '/kæt/', sentence: 'I have a cat.' },
                    { word: 'dog', emoji: '🐶', phonetic: '/dɒɡ/', sentence: 'The dog is cute.' },
                    { word: 'bird', emoji: '🐦', phonetic: '/bɜːd/', sentence: 'A bird can fly.' },
                    { word: 'fish', emoji: '🐟', phonetic: '/fɪʃ/', sentence: 'Fish can swim.' },
                    { word: 'pig', emoji: '🐷', phonetic: '/pɪɡ/', sentence: 'Pigs are pink.' },
                    { word: 'cow', emoji: '🐮', phonetic: '/kaʊ/', sentence: 'Cows eat grass.' },
                    { word: 'duck', emoji: '🦆', phonetic: '/dʌk/', sentence: 'A duck can swim.' },
                    { word: 'rabbit', emoji: '🐰', phonetic: '/ˈræbɪt/', sentence: 'Rabbits jump.' },
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
                title: 'Unit 1 Colours',
                words: [
                    { word: 'red', emoji: '🔴', phonetic: '/red/', sentence: 'The apple is red.' },
                    { word: 'yellow', emoji: '🟡', phonetic: '/ˈjeləʊ/', sentence: 'Bananas are yellow.' },
                    { word: 'blue', emoji: '🔵', phonetic: '/bluː/', sentence: 'The sky is blue.' },
                    { word: 'green', emoji: '🟢', phonetic: '/ɡriːn/', sentence: 'Grass is green.' },
                    { word: 'black', emoji: '⚫', phonetic: '/blæk/', sentence: 'A black cat.' },
                    { word: 'white', emoji: '⚪', phonetic: '/waɪt/', sentence: 'Snow is white.' },
                    { word: 'pink', emoji: '🌸', phonetic: '/pɪŋk/', sentence: 'I like pink.' },
                    { word: 'orange', emoji: '🟠', phonetic: '/ˈɒrɪndʒ/', sentence: 'Oranges are orange.' },
                ]
            },
            2: {
                title: 'Unit 2 School Things',
                words: [
                    { word: 'pen', emoji: '🖊️', phonetic: '/pen/', sentence: 'I have a pen.' },
                    { word: 'pencil', emoji: '✏️', phonetic: '/ˈpensl/', sentence: 'A red pencil.' },
                    { word: 'book', emoji: '📖', phonetic: '/bʊk/', sentence: 'Open the book.' },
                    { word: 'bag', emoji: '🎒', phonetic: '/bæɡ/', sentence: 'My bag is heavy.' },
                    { word: 'ruler', emoji: '📏', phonetic: '/ˈruːlə/', sentence: 'Use your ruler.' },
                    { word: 'eraser', emoji: '🧽', phonetic: '/ɪˈreɪzə/', sentence: 'An eraser.' },
                    { word: 'desk', emoji: '🪑', phonetic: '/desk/', sentence: 'On the desk.' },
                    { word: 'chair', emoji: '💺', phonetic: '/tʃeə/', sentence: 'Sit on the chair.' },
                ]
            },
            3: {
                title: 'Unit 3 Yummy Food',
                words: [
                    { word: 'apple', emoji: '🍎', phonetic: '/ˈæpl/', sentence: 'Eat an apple.' },
                    { word: 'banana', emoji: '🍌', phonetic: '/bəˈnɑːnə/', sentence: 'I like bananas.' },
                    { word: 'bread', emoji: '🍞', phonetic: '/bred/', sentence: 'Have some bread.' },
                    { word: 'milk', emoji: '🥛', phonetic: '/mɪlk/', sentence: 'Drink some milk.' },
                    { word: 'rice', emoji: '🍚', phonetic: '/raɪs/', sentence: 'I eat rice.' },
                    { word: 'water', emoji: '💧', phonetic: '/ˈwɔːtə/', sentence: 'Water is good.' },
                    { word: 'egg', emoji: '🥚', phonetic: '/eɡ/', sentence: 'An egg.' },
                    { word: 'cake', emoji: '🎂', phonetic: '/keɪk/', sentence: 'A birthday cake.' },
                ]
            },
            4: {
                title: 'Unit 4 Toys',
                words: [
                    { word: 'ball', emoji: '⚽', phonetic: '/bɔːl/', sentence: 'Kick the ball.' },
                    { word: 'doll', emoji: '🪆', phonetic: '/dɒl/', sentence: 'A pretty doll.' },
                    { word: 'car', emoji: '🚗', phonetic: '/kɑː/', sentence: 'Toy car.' },
                    { word: 'plane', emoji: '✈️', phonetic: '/pleɪn/', sentence: 'Paper plane.' },
                    { word: 'kite', emoji: '🪁', phonetic: '/kaɪt/', sentence: 'Fly a kite.' },
                    { word: 'teddy', emoji: '🧸', phonetic: '/ˈtedi/', sentence: 'My teddy bear.' },
                    { word: 'bike', emoji: '🚲', phonetic: '/baɪk/', sentence: 'Ride a bike.' },
                    { word: 'boat', emoji: '⛵', phonetic: '/bəʊt/', sentence: 'A little boat.' },
                ]
            },
            5: {
                title: 'Unit 5 My Home',
                words: [
                    { word: 'home', emoji: '🏠', phonetic: '/həʊm/', sentence: 'I go home.' },
                    { word: 'room', emoji: '🚪', phonetic: '/ruːm/', sentence: 'My room.' },
                    { word: 'bed', emoji: '🛏️', phonetic: '/bed/', sentence: 'A big bed.' },
                    { word: 'door', emoji: '🚪', phonetic: '/dɔː/', sentence: 'Open the door.' },
                    { word: 'window', emoji: '🪟', phonetic: '/ˈwɪndəʊ/', sentence: 'Close the window.' },
                    { word: 'kitchen', emoji: '🍳', phonetic: '/ˈkɪtʃɪn/', sentence: 'In the kitchen.' },
                    { word: 'bathroom', emoji: '🛁', phonetic: '/ˈbɑːθruːm/', sentence: 'Use the bathroom.' },
                    { word: 'living room', emoji: '🛋️', phonetic: '/ˈlɪvɪŋ ruːm/', sentence: 'In the living room.' },
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
                title: 'Unit 1 Hello & Names',
                words: [
                    { word: 'what', emoji: '❓', phonetic: '/wɒt/', sentence: 'What is your name?' },
                    { word: 'name', emoji: '📝', phonetic: '/neɪm/', sentence: 'My name is Tom.' },
                    { word: 'how', emoji: '🤔', phonetic: '/haʊ/', sentence: 'How are you?' },
                    { word: 'fine', emoji: '😊', phonetic: '/faɪn/', sentence: 'I\'m fine, thank you.' },
                    { word: 'thank', emoji: '🙏', phonetic: '/θæŋk/', sentence: 'Thank you very much.' },
                    { word: 'sorry', emoji: '😢', phonetic: '/ˈsɒri/', sentence: 'I\'m sorry.' },
                    { word: 'please', emoji: '🙇', phonetic: '/pliːz/', sentence: 'Please help me.' },
                    { word: 'welcome', emoji: '🤗', phonetic: '/ˈwelkəm/', sentence: 'You are welcome.' },
                ]
            },
            2: {
                title: 'Unit 2 My School',
                words: [
                    { word: 'school', emoji: '🏫', phonetic: '/skuːl/', sentence: 'I go to school.' },
                    { word: 'teacher', emoji: '👩‍🏫', phonetic: '/ˈtiːtʃə/', sentence: 'My teacher is nice.' },
                    { word: 'student', emoji: '👨‍🎓', phonetic: '/ˈstjuːdnt/', sentence: 'I am a student.' },
                    { word: 'classroom', emoji: '🏬', phonetic: '/ˈklɑːsruːm/', sentence: 'In the classroom.' },
                    { word: 'library', emoji: '📚', phonetic: '/ˈlaɪbrəri/', sentence: 'I read in the library.' },
                    { word: 'playground', emoji: '🏃', phonetic: '/ˈpleɪɡraʊnd/', sentence: 'Play on the playground.' },
                    { word: 'lesson', emoji: '📚', phonetic: '/ˈlesn/', sentence: 'English lesson.' },
                    { word: 'class', emoji: '👥', phonetic: '/klɑːs/', sentence: 'Class Two.' },
                ]
            },
            3: {
                title: 'Unit 3 Daily Life',
                words: [
                    { word: 'morning', emoji: '🌅', phonetic: '/ˈmɔːnɪŋ/', sentence: 'Get up in the morning.' },
                    { word: 'breakfast', emoji: '🍳', phonetic: '/ˈbrekfəst/', sentence: 'Have breakfast.' },
                    { word: 'lunch', emoji: '🍱', phonetic: '/lʌntʃ/', sentence: 'Lunch at school.' },
                    { word: 'dinner', emoji: '🍽️', phonetic: '/ˈdɪnə/', sentence: 'Have dinner together.' },
                    { word: 'sleep', emoji: '😴', phonetic: '/sliːp/', sentence: 'Go to sleep.' },
                    { word: 'wash', emoji: '🧼', phonetic: '/wɒʃ/', sentence: 'Wash your hands.' },
                    { word: 'eat', emoji: '🍽️', phonetic: '/iːt/', sentence: 'Eat healthy food.' },
                    { word: 'drink', emoji: '🥤', phonetic: '/drɪŋk/', sentence: 'Drink more water.' },
                ]
            },
            4: {
                title: 'Unit 4 Hobbies',
                words: [
                    { word: 'like', emoji: '❤️', phonetic: '/laɪk/', sentence: 'I like reading.' },
                    { word: 'love', emoji: '💕', phonetic: '/lʌv/', sentence: 'I love my family.' },
                    { word: 'play', emoji: '🎮', phonetic: '/pleɪ/', sentence: 'Play football.' },
                    { word: 'read', emoji: '📖', phonetic: '/riːd/', sentence: 'Read a book.' },
                    { word: 'sing', emoji: '🎵', phonetic: '/sɪŋ/', sentence: 'Sing a song.' },
                    { word: 'dance', emoji: '💃', phonetic: '/dɑːns/', sentence: 'Let\'s dance.' },
                    { word: 'draw', emoji: '🎨', phonetic: '/drɔː/', sentence: 'Draw a picture.' },
                    { word: 'run', emoji: '🏃', phonetic: '/rʌn/', sentence: 'Run fast.' },
                ]
            },
            5: {
                title: 'Unit 5 Describing Things',
                words: [
                    { word: 'big', emoji: '🐘', phonetic: '/bɪɡ/', sentence: 'A big elephant.' },
                    { word: 'small', emoji: '🐭', phonetic: '/smɔːl/', sentence: 'A small mouse.' },
                    { word: 'tall', emoji: '🦒', phonetic: '/tɔːl/', sentence: 'A tall tree.' },
                    { word: 'short', emoji: '📏', phonetic: '/ʃɔːt/', sentence: 'A short ruler.' },
                    { word: 'long', emoji: '📏', phonetic: '/lɒŋ/', sentence: 'A long snake.' },
                    { word: 'happy', emoji: '😄', phonetic: '/ˈhæpi/', sentence: 'I am happy today.' },
                    { word: 'sad', emoji: '😢', phonetic: '/sæd/', sentence: 'Don\'t be sad.' },
                    { word: 'angry', emoji: '😠', phonetic: '/ˈæŋɡri/', sentence: 'He looks angry.' },
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
                title: 'Unit 1 My Room',
                words: [
                    { word: 'bedroom', emoji: '🛏️', phonetic: '/ˈbedruːm/', sentence: 'My bedroom is clean.' },
                    { word: 'sofa', emoji: '🛋️', phonetic: '/ˈsəʊfə/', sentence: 'Sit on the sofa.' },
                    { word: 'table', emoji: '🪑', phonetic: '/ˈteɪbl/', sentence: 'On the table.' },
                    { word: 'lamp', emoji: '💡', phonetic: '/læmp/', sentence: 'Turn on the lamp.' },
                    { word: 'clock', emoji: '🕐', phonetic: '/klɒk/', sentence: 'Look at the clock.' },
                    { word: 'picture', emoji: '🖼️', phonetic: '/ˈpɪktʃə/', sentence: 'A beautiful picture.' },
                    { word: 'wardrobe', emoji: '🚪', phonetic: '/ˈwɔːdrəʊb/', sentence: 'In the wardrobe.' },
                    { word: 'mirror', emoji: '🪞', phonetic: '/ˈmɪrə/', sentence: 'Look in the mirror.' },
                ]
            },
            2: {
                title: 'Unit 2 Weather & Seasons',
                words: [
                    { word: 'sunny', emoji: '☀️', phonetic: '/ˈsʌni/', sentence: 'It is sunny today.' },
                    { word: 'rainy', emoji: '🌧️', phonetic: '/ˈreɪni/', sentence: 'A rainy day.' },
                    { word: 'cloudy', emoji: '☁️', phonetic: '/ˈklaʊdi/', sentence: 'It\'s cloudy.' },
                    { word: 'snowy', emoji: '❄️', phonetic: '/ˈsnəʊi/', sentence: 'A snowy winter.' },
                    { word: 'windy', emoji: '🌬️', phonetic: '/ˈwɪndi/', sentence: 'It is windy.' },
                    { word: 'spring', emoji: '🌸', phonetic: '/sprɪŋ/', sentence: 'Flowers bloom in spring.' },
                    { word: 'summer', emoji: '🌞', phonetic: '/ˈsʌmə/', sentence: 'Go swimming in summer.' },
                    { word: 'autumn', emoji: '🍂', phonetic: '/ˈɔːtəm/', sentence: 'Leaves fall in autumn.' },
                    { word: 'winter', emoji: '⛄', phonetic: '/ˈwɪntə/', sentence: 'Build a snowman in winter.' },
                ]
            },
            3: {
                title: 'Unit 3 Sports',
                words: [
                    { word: 'football', emoji: '⚽', phonetic: '/ˈfʊtbɔːl/', sentence: 'Play football.' },
                    { word: 'basketball', emoji: '🏀', phonetic: '/ˈbɑːskɪtbɔːl/', sentence: 'Play basketball.' },
                    { word: 'swim', emoji: '🏊', phonetic: '/swɪm/', sentence: 'Can you swim?' },
                    { word: 'jump', emoji: '🤸', phonetic: '/dʒʌmp/', sentence: 'Jump high.' },
                    { word: 'skate', emoji: '⛸️', phonetic: '/skeɪt/', sentence: 'Let\'s go skating.' },
                    { word: 'tennis', emoji: '🎾', phonetic: '/ˈtenɪs/', sentence: 'Play tennis.' },
                    { word: 'volleyball', emoji: '🏐', phonetic: '/ˈvɒlibɔːl/', sentence: 'Beach volleyball.' },
                    { word: 'exercise', emoji: '🏋️', phonetic: '/ˈeksəsaɪz/', sentence: 'Exercise every day.' },
                ]
            },
            4: {
                title: 'Unit 4 Jobs',
                words: [
                    { word: 'doctor', emoji: '👨‍⚕️', phonetic: '/ˈdɒktə/', sentence: 'He is a doctor.' },
                    { word: 'nurse', emoji: '👩‍⚕️', phonetic: '/nɜːs/', sentence: 'A nice nurse.' },
                    { word: 'driver', emoji: '🚗', phonetic: '/ˈdraɪvə/', sentence: 'A bus driver.' },
                    { word: 'farmer', emoji: '👨‍🌾', phonetic: '/ˈfɑːmə/', sentence: 'Farmers grow food.' },
                    { word: 'cook', emoji: '👨‍🍳', phonetic: '/kʊk/', sentence: 'A good cook.' },
                    { word: 'pilot', emoji: '👨‍✈️', phonetic: '/ˈpaɪlət/', sentence: 'Fly a plane.' },
                    { word: 'artist', emoji: '🎨', phonetic: '/ˈɑːtɪst/', sentence: 'A great artist.' },
                    { word: 'policeman', emoji: '👮', phonetic: '/pəˈliːsmən/', sentence: 'A brave policeman.' },
                ]
            },
            5: {
                title: 'Unit 5 Travel',
                words: [
                    { word: 'travel', emoji: '🧳', phonetic: '/ˈtrævl/', sentence: 'I love to travel.' },
                    { word: 'airport', emoji: '✈️', phonetic: '/ˈeəpɔːt/', sentence: 'Go to the airport.' },
                    { word: 'hotel', emoji: '🏨', phonetic: '/həʊˈtel/', sentence: 'Stay in a hotel.' },
                    { word: 'beach', emoji: '🏖️', phonetic: '/biːtʃ/', sentence: 'Play on the beach.' },
                    { word: 'mountain', emoji: '⛰️', phonetic: '/ˈmaʊntɪn/', sentence: 'Climb the mountain.' },
                    { word: 'city', emoji: '🏙️', phonetic: '/ˈsɪti/', sentence: 'A big city.' },
                    { word: 'village', emoji: '🏡', phonetic: '/ˈvɪlɪdʒ/', sentence: 'A quiet village.' },
                    { word: 'holiday', emoji: '🎉', phonetic: '/ˈhɒlədeɪ/', sentence: 'Summer holiday.' },
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
                title: 'Unit 1 Festivals',
                words: [
                    { word: 'Christmas', emoji: '🎄', phonetic: '/ˈkrɪsməs/', sentence: 'Merry Christmas!' },
                    { word: 'Spring Festival', emoji: '🧧', phonetic: '/sprɪŋ ˈfestɪvl/', sentence: 'Happy Spring Festival!' },
                    { word: 'festival', emoji: '🎊', phonetic: '/ˈfestɪvl/', sentence: 'A great festival.' },
                    { word: 'birthday', emoji: '🎂', phonetic: '/ˈbɜːθdeɪ/', sentence: 'Happy birthday!' },
                    { word: 'dinner', emoji: '🍽️', phonetic: '/ˈdɪnə/', sentence: 'Family dinner.' },
                    { word: 'present', emoji: '🎁', phonetic: '/ˈpreznt/', sentence: 'Open the present.' },
                    { word: 'party', emoji: '🎉', phonetic: '/ˈpɑːti/', sentence: 'A birthday party.' },
                    { word: 'celebrate', emoji: '🥳', phonetic: '/ˈselɪbreɪt/', sentence: 'Let\'s celebrate!' },
                ]
            },
            2: {
                title: 'Unit 2 Our Earth',
                words: [
                    { word: 'earth', emoji: '🌍', phonetic: '/ɜːθ/', sentence: 'Protect the Earth.' },
                    { word: 'nature', emoji: '🌳', phonetic: '/ˈneɪtʃə/', sentence: 'Love nature.' },
                    { word: 'pollution', emoji: '🏭', phonetic: '/pəˈluːʃn/', sentence: 'Stop pollution.' },
                    { word: 'recycle', emoji: '♻️', phonetic: '/ˌriːˈsaɪkl/', sentence: 'Recycle paper.' },
                    { word: 'forest', emoji: '🌲', phonetic: '/ˈfɒrɪst/', sentence: 'A green forest.' },
                    { word: 'ocean', emoji: '🌊', phonetic: '/ˈəʊʃn/', sentence: 'The blue ocean.' },
                    { word: 'animal', emoji: '🦋', phonetic: '/ˈænɪml/', sentence: 'Save the animals.' },
                    { word: 'plant', emoji: '🌱', phonetic: '/plɑːnt/', sentence: 'Plant more trees.' },
                ]
            },
            3: {
                title: 'Unit 3 Shopping',
                words: [
                    { word: 'shop', emoji: '🏪', phonetic: '/ʃɒp/', sentence: 'Go shopping.' },
                    { word: 'market', emoji: '🛒', phonetic: '/ˈmɑːkɪt/', sentence: 'A big market.' },
                    { word: 'supermarket', emoji: '🏬', phonetic: '/ˈsuːpəmɑːkɪt/', sentence: 'In the supermarket.' },
                    { word: 'money', emoji: '💰', phonetic: '/ˈmʌni/', sentence: 'Save money.' },
                    { word: 'price', emoji: '🏷️', phonetic: '/praɪs/', sentence: 'A low price.' },
                    { word: 'cheap', emoji: '💲', phonetic: '/tʃiːp/', sentence: 'This is cheap.' },
                    { word: 'expensive', emoji: '💎', phonetic: '/ɪkˈspensɪv/', sentence: 'Too expensive.' },
                    { word: 'change', emoji: '🪙', phonetic: '/tʃeɪndʒ/', sentence: 'Here is your change.' },
                ]
            },
            4: {
                title: 'Unit 4 Dreams',
                words: [
                    { word: 'future', emoji: '🔮', phonetic: '/ˈfjuːtʃə/', sentence: 'My future dream.' },
                    { word: 'dream', emoji: '💭', phonetic: '/driːm/', sentence: 'Follow your dream.' },
                    { word: 'hope', emoji: '🌟', phonetic: '/həʊp/', sentence: 'I hope so.' },
                    { word: 'plan', emoji: '📋', phonetic: '/plæn/', sentence: 'Make a plan.' },
                    { word: 'goal', emoji: '🎯', phonetic: '/ɡəʊl/', sentence: 'Set a goal.' },
                    { word: 'astronaut', emoji: '👨‍🚀', phonetic: '/ˈæstrənɔːt/', sentence: 'Be an astronaut.' },
                    { word: 'scientist', emoji: '👨‍🔬', phonetic: '/ˈsaɪəntɪst/', sentence: 'A great scientist.' },
                    { word: 'inventor', emoji: '💡', phonetic: '/ɪnˈventə/', sentence: 'A clever inventor.' },
                ]
            },
            5: {
                title: 'Unit 5 Learning',
                words: [
                    { word: 'study', emoji: '📚', phonetic: '/ˈstʌdi/', sentence: 'Study hard.' },
                    { word: 'practice', emoji: '✏️', phonetic: '/ˈpræktɪs/', sentence: 'Practice every day.' },
                    { word: 'remember', emoji: '🧠', phonetic: '/rɪˈmembə/', sentence: 'Remember the words.' },
                    { word: 'forget', emoji: '🤔', phonetic: '/fəˈɡet/', sentence: 'Don\'t forget.' },
                    { word: 'answer', emoji: '💬', phonetic: '/ˈɑːnsə/', sentence: 'Answer the question.' },
                    { word: 'question', emoji: '❓', phonetic: '/ˈkwestʃən/', sentence: 'Ask a question.' },
                    { word: 'knowledge', emoji: '📖', phonetic: '/ˈnɒlɪdʒ/', sentence: 'Knowledge is power.' },
                    { word: 'success', emoji: '🏆', phonetic: '/səkˈses/', sentence: 'Wish you success.' },
                ]
            }
        }
    }
};


/* ========================================
   全英文沉浸模式（v1.3.0）
   - 词库中不再保留任何中文词义字段
   - 每个单元补充英文主题、图标与「句子小剧场」句子
   - 每个单词关卡默认 5 个单词，保证年级全部词库都被拆进关卡
   ======================================== */

const WORDS_PER_LEVEL = 5;

const UNIT_META = {
    1: {
        0: ['Alphabet Adventure', '🔤'], 1: ['Greetings', '👋'],
        2: ['My Family', '👨‍👩‍👧‍👦'], 3: ['My Body', '😊'],
        4: ['Numbers', '🔢'], 5: ['Animals', '🐾']
    },
    2: {
        1: ['Colours', '🎨'], 2: ['School Things', '🎒'],
        3: ['Yummy Food', '🍎'], 4: ['Toys', '🧸'], 5: ['My Home', '🏠']
    },
    3: {
        1: ['Hello & Names', '🤝'], 2: ['My School', '🏫'],
        3: ['Daily Life', '⏰'], 4: ['Hobbies', '🎵'], 5: ['Describing Things', '📏']
    },
    4: {
        1: ['My Room', '🛏️'], 2: ['Weather & Seasons', '🌤️'],
        3: ['Sports', '⚽'], 4: ['Jobs', '👩‍⚕️'], 5: ['Travel', '🧳']
    },
    5: {
        1: ['Festivals', '🎉'], 2: ['Our Earth', '🌍'],
        3: ['Shopping', '🛒'], 4: ['Dreams', '🚀'], 5: ['Learning', '📚']
    }
};

// 为每个单元生成英文主题、图标和句子小剧场（句子全部来自该单元单词的英文例句）
Object.keys(LEARNING_DATA).forEach(grade => {
    const units = LEARNING_DATA[grade].units;
    Object.keys(units).forEach(unitKey => {
        const unit = units[unitKey];
        const meta = (UNIT_META[grade] && UNIT_META[grade][unitKey]) || ['English Words', '📗'];
        unit.topic = meta[0];
        unit.icon = meta[1];
        unit.title = 'Unit ' + unitKey + ' ' + meta[0];

        const seen = new Set();
        unit.sentences = [];
        unit.words.forEach(w => {
            if (!w.sentence || seen.has(w.sentence)) return;
            seen.add(w.sentence);
            const decor = unit.words
                .filter(x => x.emoji !== w.emoji)
                .slice(0, 2)
                .map(x => x.emoji);
            unit.sentences.push({
                text: w.sentence,
                word: w.word,
                emoji: w.emoji,
                scene: [w.emoji].concat(decor)
            });
        });
        unit.sentences = unit.sentences.slice(0, 5);
    });
});

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

/* ========================================
   句子小剧场 - 共享「听句子 + 看图 + 词块拼句」组件
   学习页的句子关与游戏页的句子游戏共用，全部内容只有英文与图片
   ======================================== */
const SentenceLab = {
    escapeHtml: function(str) {
        return String(str).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    },

    tokens: function(text) {
        return String(text).trim().split(/\s+/).filter(Boolean);
    },

    shuffle: function(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    },

    // 汇总某年级全部单元的英文句子
    pool: function(grade) {
        const gradeData = LEARNING_DATA[grade] || LEARNING_DATA[1];
        const out = [];
        Object.keys(gradeData.units).forEach(unitKey => {
            (gradeData.units[unitKey].sentences || []).forEach(s => {
                out.push(Object.assign({}, s, { unit: unitKey }));
            });
        });
        return out;
    },

    // 按闯关轮次轮换取句子，多闯几关即可覆盖整个年级的句子
    pick: function(grade, count, round) {
        const all = this.pool(grade);
        if (!all.length) return [];
        const offset = ((round || 0) * count) % all.length;
        const rotated = all.slice(offset).concat(all.slice(0, offset));
        return rotated.slice(0, Math.min(count, all.length));
    },

    // 句子「小剧场」表情场景
    sceneHtml: function(sentence, extraCls) {
        const list = (sentence && sentence.scene && sentence.scene.length)
            ? sentence.scene
            : [sentence ? sentence.emoji : '💬'];
        return list.map((emoji, i) =>
            `<span class="scene-emoji ${extraCls || ''}" style="animation-delay:${i * 0.18}s">${emoji}</span>`
        ).join('');
    },

    // 渲染词块拼句：按英文顺序点词块，全部正确后回调 onSolved
    renderPuzzle: function(opts) {
        const tokens = this.tokens(opts.text);
        const slotsEl = opts.slotsEl;
        const tilesEl = opts.tilesEl;
        if (!slotsEl || !tilesEl) return null;

        slotsEl.innerHTML = tokens
            .map((_, i) => `<span class="sent-slot" data-slot="${i}"></span>`)
            .join('');
        tilesEl.innerHTML = this.shuffle(tokens).map(t =>
            `<button type="button" class="sent-tile" data-token="${this.escapeHtml(t)}">${this.escapeHtml(t)}</button>`
        ).join('');

        const slots = Array.from(slotsEl.querySelectorAll('.sent-slot'));
        const tiles = Array.from(tilesEl.querySelectorAll('.sent-tile'));
        let cursor = 0;
        let solved = false;

        tiles.forEach(btn => {
            btn.addEventListener('click', () => {
                if (solved || btn.disabled) return;
                if (btn.dataset.token === tokens[cursor]) {
                    btn.disabled = true;
                    btn.classList.add('used');
                    slots[cursor].textContent = btn.dataset.token;
                    slots[cursor].classList.add('filled');
                    cursor++;
                    if (opts.onProgress) opts.onProgress(cursor, tokens.length);
                    if (cursor === tokens.length) {
                        solved = true;
                        slots.forEach(s => s.classList.add('solved'));
                        if (opts.onSolved) opts.onSolved();
                    }
                } else {
                    btn.classList.remove('shake');
                    void btn.offsetWidth;  // 强制重播抖动动画
                    btn.classList.add('shake');
                    if (opts.onWrong) opts.onWrong();
                }
            });
        });

        return {
            isSolved: () => solved,
            progress: () => cursor + '/' + tokens.length
        };
    }
};
