/* 心晴岛 · 儿童社会情绪学习课程内容数据
   普通浏览器脚本，仅定义全局变量 window.SEL_DATA，不引用任何外部资源。 */

window.SEL_DATA = {

  /* ---------- 情绪卡片：8 种以上，face 取自白名单 ---------- */
  emotions: [
    {
      id: 'happy', name: '开心', emoji: '😊', color: '#FFC94A', face: 'happy',
      body: '嘴角往上翘，身体轻得想跳一下',
      cues: ['眼睛亮亮的', '想笑', '说话声音变脆'],
      words: ['高兴', '愉快', '兴冲冲'],
      strategy: 'expression'
    },
    {
      id: 'sad', name: '难过', emoji: '😢', color: '#7FB3E8', face: 'sad',
      body: '眼皮沉下来，胸口像压了块小湿毛巾',
      cues: ['想低着头', '不太想说话', '鼻子酸酸的'],
      words: ['难过', '失落', '闷闷的'],
      strategy: 'expression'
    },
    {
      id: 'angry', name: '生气', emoji: '😠', color: '#FF7A6B', face: 'angry',
      body: '脸热热的，拳头不自觉攥紧',
      cues: ['心跳变快', '声音想变大', '眉头皱起来'],
      words: ['生气', '火大', '气鼓鼓'],
      strategy: 'distance'
    },
    {
      id: 'scared', name: '害怕', emoji: '😨', color: '#A78BDA', face: 'scared',
      body: '手心冒汗，脚像被钉在地上',
      cues: ['睁大眼睛', '想往大人身后躲', '呼吸变浅'],
      words: ['害怕', '发慌', '心里发毛'],
      strategy: 'breathing'
    },
    {
      id: 'surprised', name: '惊讶', emoji: '😲', color: '#FF9F68', face: 'surprised',
      body: '眼睛一下睁圆，嘴巴张成小 O',
      cues: ['愣住半秒', '轻轻「诶」一声', '眉毛抬高高'],
      words: ['惊讶', '意外', '没料到'],
      strategy: 'awareness'
    },
    {
      id: 'calm', name: '平静', emoji: '😌', color: '#7FD1B9', face: 'calm',
      body: '呼吸慢下来，肩膀松松地落着',
      cues: ['想安静坐着', '声音平平的', '手不慌不忙'],
      words: ['平静', '踏实', '安安稳稳'],
      strategy: 'awareness'
    },
    {
      id: 'proud', name: '自豪', emoji: '😎', color: '#FFD86B', face: 'proud',
      body: '背不自觉挺直，下巴轻轻抬起来',
      cues: ['想给人看看', '嘴角压不住', '心里亮堂堂'],
      words: ['自豪', '得意', '有成就感'],
      strategy: 'expression'
    },
    {
      id: 'jealous', name: '羡慕', emoji: '🍋', color: '#9BD770', face: 'jealous',
      body: '眼睛老往别人那边瞟，心里痒痒的',
      cues: ['总忍不住比较', '有点想也拥有', '嘴上说「没什么」'],
      words: ['羡慕', '眼馋', '也想试试'],
      strategy: 'coping'
    },
    {
      id: 'worried', name: '担心', emoji: '😟', color: '#F2A65A', face: 'worried',
      body: '心里悬着，像有只小鼓一直轻轻敲',
      cues: ['反复想同一件事', '忍不住问「要是…怎么办」', '手有点闲不住'],
      words: ['担心', '挂心', '放不下'],
      strategy: 'breathing'
    },
    {
      id: 'lonely', name: '孤单', emoji: '🥺', color: '#B0A6D8', face: 'lonely',
      body: '身边空空的，手不知道往哪儿放',
      cues: ['想找人又没开口', '看着别人玩', '觉得时间变慢'],
      words: ['孤单', '冷清', '想有人陪'],
      strategy: 'expression'
    }
  ],

  /* ---------- 五块策略肌肉，id 固定 ---------- */
  strategies: [
    {
      id: 'awareness', muscle: '觉察', name: '给情绪起名字', emoji: '🔍',
      desc: '心里那团模糊糊的感觉，一说名字就清楚了。',
      steps: ['停下来，感觉一下身体哪儿有动静', '从情绪卡片里挑一个最像的词', '小声说：「我现在有点____」'],
      seconds: 60
    },
    {
      id: 'breathing', muscle: '呼吸', name: '吹泡泡呼吸', emoji: '🫧',
      desc: '把气慢慢吹长，身体就跟着松下来。',
      steps: ['吸气 4 秒，肚子像气球鼓起来', '轻轻停 2 秒，托住气球', '呼气 6 秒，噗——把气放掉'],
      seconds: 60
    },
    {
      id: 'coping', muscle: '应对', name: '冷静小工具箱', emoji: '🧰',
      desc: '攒几件随手能用的小事，难受时不用临时想。',
      steps: ['喝一口水，或抱一抱软软的东西', '数到 10，或把感觉画成一团颜色', '挑一件不伤人也不伤物的小事做'],
      seconds: 90
    },
    {
      id: 'distance', muscle: '距离', name: '先退一步', emoji: '🌊',
      desc: '离开现场一小会儿，火苗就烧得慢了。',
      steps: ['说一句「我先去待一下」', '往旁边走两步，或去冷静角', '等手不抖、气变匀了再回来'],
      seconds: 60
    },
    {
      id: 'expression', muscle: '表达', name: '好好说出来', emoji: '💬',
      desc: '把感觉、事情、想要的小改变，分三句讲清楚。',
      steps: ['我觉得…（说出心里什么感觉）', '因为…（说清刚才发生了什么）', '我希望…（说一个小小的请求）'],
      seconds: 90
    }
  ],

  /* ---------- 五座岛，顺序固定，共 19 关 ---------- */
  islands: [
    {
      id: 'awareness', name: '情绪侦探岛', skill: '自我认知', subtitle: '认出心里的小天气',
      color: '#FF8FA3', emoji: '🔍', unlockAt: 0,
      desc: '跟着团团拿起放大镜，认出脸上、身体里那些藏不住的小信号，给每一种心情起个名字。',
      levels: [
        {
          id: 'aw-1', title: '表情大侦探', type: 'match',
          intro: '团团把放大镜递给你：「快看，脸上的小天气藏不住啦，咱们来认一认！」',
          teach: '眉毛、眼睛、嘴角凑在一起，就是一张心情地图；先看这几处，就能猜出大概的情绪。',
          tip: '在家可以和孩子玩「演一个、猜一个」，轮流做鬼脸，说说从哪儿看出来的。',
          data: {
            instruction: '把表情和它的名字连起来',
            pairs: [
              { left: { id: 'p1', label: '', emoji: '😊', face: 'happy' }, right: { id: 'p1', label: '开心', emoji: '😊' } },
              { left: { id: 'p2', label: '', emoji: '😢', face: 'sad' }, right: { id: 'p2', label: '难过', emoji: '😢' } },
              { left: { id: 'p3', label: '', emoji: '😠', face: 'angry' }, right: { id: 'p3', label: '生气', emoji: '😠' } },
              { left: { id: 'p4', label: '', emoji: '😨', face: 'scared' }, right: { id: 'p4', label: '害怕', emoji: '😨' } }
            ]
          },
          reward: { stars: 3, sticker: 'st-magnifier' }
        },
        {
          id: 'aw-2', title: '心情分分类', type: 'classify',
          intro: '团团把一桌小卡片推过来：「有的住在身体里，有的发生在外面，帮它们回各自的家吧。」',
          teach: '「事情」是外面发生的，「感觉」是身体里升起的；先把两者分开，情绪就好认多了。',
          tip: '孩子闹情绪时，先一起说清「刚才发生了什么」，再问「身体里哪儿有感觉」。',
          data: {
            instruction: '把卡片放到正确的篮子里',
            buckets: [
              { id: 'inside', label: '身体里的感觉', emoji: '💛' },
              { id: 'outside', label: '外面发生的事', emoji: '📋' }
            ],
            items: [
              { id: 'i1', text: '心咚咚跳', emoji: '🫀', bucket: 'inside' },
              { id: 'i2', text: '他拿走了我的橡皮', emoji: '📋', bucket: 'outside' },
              { id: 'i3', text: '脸热热的', emoji: '🌡️', bucket: 'inside' },
              { id: 'i4', text: '下课铃响了', emoji: '🔔', bucket: 'outside' },
              { id: 'i5', text: '鼻子酸酸的', emoji: '😢', bucket: 'inside' },
              { id: 'i6', text: '卷子发下来了', emoji: '📄', bucket: 'outside' }
            ],
            explain: ['感觉住在身体里，事情发生在外面，先把它们分开，心情就好认了', '同一件事，不同的人身体里的感觉也可能不一样，没有标准答案']
          },
          reward: { stars: 3, sticker: 'st-cloud' }
        },
        {
          id: 'aw-3', title: '给它起个名字', type: 'choice',
          intro: '团团歪着头：「心里那团模糊糊的，一起个名字，它就变得清楚啦。」',
          teach: '给感觉起名字叫「命名情绪」；名字一说出口，脑子里那片雾就会散开一点。',
          tip: '平时多备几个情绪词（委屈、失落、踏实），孩子卡住时递一个给他试试。',
          data: {
            prompt: '放学排队时，好友今天一直没和你说话，你心里有点空落落的。想弄清这股感觉，下面哪一步最能帮到你？',
            scene: 'school',
            options: [
              { id: 'a', text: '先在心里给它起个名字：我有点孤单', emoji: '🫧', good: true,
                outcome: '名字一冒出来，那团空落落就变得具体了，没那么模糊。',
                feedback: '团团拍手：「给感觉起名字，就像给小云朵贴上标签，一下就认出来啦。」' },
              { id: 'b', text: '停一下，感受身体：胸口是不是轻轻的、闷闷的', emoji: '💓', good: true,
                outcome: '你发现自己的肩膀有点往下垂，原来身体早就悄悄告诉你了。',
                feedback: '团团凑近：「身体常常比嘴巴先说话，摸摸它，也是认出情绪的好路子。」' },
              { id: 'c', text: '马上认定他不喜欢我了，转身就走', emoji: '🚶', good: false,
                outcome: '你走开了，可那点空落落还跟着，也没弄明白它从哪来。',
                feedback: '团团歪头：「走开也行呀，只是那点空落落还跟着，要不要再回头看看它从哪来？」' }
            ]
          },
          reward: { stars: 3, sticker: 'st-rainbow' }
        },
        {
          id: 'aw-4', title: '心里能装几种', type: 'slider',
          intro: '团团摊开一张彩虹图：「谁说心里一次只能住一种天气呀？」',
          teach: '几种心情可以同时待着，开心里掺一点不舍也很正常，不用只挑一个。',
          tip: '别急着替孩子定「你就是开心」，可以问「还有没有别的一点点」。',
          data: {
            prompt: '今天一天里，你被表扬过、也和小伙伴闹过别扭、还吃到了喜欢的点心。现在静静数一数，心里同时能浮起几种不一样的感觉？把小圆点拖到合适的数。',
            minLabel: '就一种',
            maxLabel: '好几种叠在一起',
            answer: { min: 3, max: 5 },
            hint: '心情可以像彩虹一层叠一层，开心和一点点委屈同时待着也很常见。能数出好几层，说明你观察得特别细。'
          },
          reward: { stars: 3, sticker: 'st-magnifier' }
        }
      ]
    },

    {
      id: 'management', name: '冷静能量岛', skill: '自我管理', subtitle: '给火苗留个出口',
      color: '#7FC8F8', emoji: '🫧', unlockAt: 3,
      desc: '吹泡泡、数到十、先退一步——小火苗带你攒一箱子让身体慢下来的小工具。',
      levels: [
        {
          id: 'ma-1', title: '和团团吹泡泡', type: 'breathe',
          intro: '团团噘起嘴：「先和我吹三个泡泡，把那股劲儿慢慢放出去。」',
          teach: '吸气 4 秒、停 2 秒、呼气 6 秒；呼气比吸气长，身体会慢慢松下来。',
          tip: '孩子激动时别催他讲道理，先陪着一起吹几口「看不见的泡泡」。',
          data: {
            title: '和团团一起吹泡泡', pattern: 'balloon', cycles: 3, inhale: 4, hold: 2, exhale: 6,
            cues: ['吸气…肚子像小气球慢慢鼓起来', '停一下…托着气球别让它跑', '呼气…噗——把气轻轻放掉，肩膀也松下来']
          },
          reward: { stars: 3, sticker: 'st-bubble' }
        },
        {
          id: 'ma-2', title: '冷静四小步', type: 'order',
          intro: '团团数着脚指头：「停一下、吸一口、慢慢吐、再开口——一步都别跳哦。」',
          teach: '让身体先冷下来，再想怎么说话；顺序反过来，话常常比脑子跑得快。',
          tip: '把「停—吸—吐—说」写成小卡片贴在桌角，用的时候照着指就行。',
          data: {
            instruction: '把团团让自己冷静下来的步骤排成顺序',
            items: [
              { id: 's1', text: '先停下来，脚轻轻踩住地面', emoji: '🦶' },
              { id: 's2', text: '吸一口气，数到 4', emoji: '🫧' },
              { id: 's3', text: '慢慢呼气，数到 6', emoji: '🌬️' },
              { id: 's4', text: '再想想，现在想怎么说', emoji: '💬' }
            ],
            answer: ['s1', 's2', 's3', 's4']
          },
          reward: { stars: 3, sticker: 'st-toolbox' }
        },
        {
          id: 'ma-3', title: '滑梯前的深呼吸', type: 'story',
          intro: '团团拉拉你的袖子：「操场上有人插队了，故事怎么走，这回你说了算。」',
          teach: '被插队时，先稳住身体再开口，比立刻推回去更容易让事情顺起来。',
          tip: '排队起争执，先蹲下来陪孩子缓两口气，再一起想那句话怎么说。',
          data: { storyId: 'story-1' },
          reward: { stars: 3, sticker: 'st-wave' }
        },
        {
          id: 'ma-4', title: '积木倒啦', type: 'choice',
          intro: '团团指着塌掉的积木塔：「哗啦一声火窜上来了，先拿哪个工具？」',
          teach: '「离开一下」和「把气放出声」都能给身体降温；工具箱里不止一把工具。',
          tip: '在家设一个「冷静角」，放水杯、软球，允许孩子先去待一会儿再回来。',
          data: {
            prompt: '积木搭到最高一层，哗啦一下全倒了，你练了好久呢。火一下子窜上来，下面哪一步能帮你先稳住？',
            scene: 'home',
            options: [
              { id: 'a', text: '先离开两步，去喝口水，等手不抖了再回来', emoji: '🚶', good: true,
                outcome: '你走开数了几口气的工夫，回来时那股火小了一点，还能重新搭。',
                feedback: '团团竖起大拇指：「先退一步给身体留点空档，火苗就烧得慢啦。」' },
              { id: 'b', text: '对着积木喊一句「哎呀！」，然后慢慢吐口气', emoji: '🗣️', good: true,
                outcome: '声音出去，气也跟着出去，你发现自己还能笑一下。',
                feedback: '团团跟着「哎呀」一声：「把那股劲儿放出声，又不伤着谁，挺顺手的！」' },
              { id: 'c', text: '把剩下的积木全扫到地上', emoji: '🧱', good: false,
                outcome: '积木滚得到处都是，你还得一块块捡，心里那团火反而更乱了。',
                feedback: '团团把散落的积木拢一拢：「手比脑子快的时候东西容易遭殃，先让手停两秒，再决定也不迟。」' }
            ]
          },
          reward: { stars: 3, sticker: 'st-toolbox' }
        }
      ]
    },

    {
      id: 'social', name: '同理望远镜岛', skill: '社会认知', subtitle: '看懂别人的小天气',
      color: '#9AD9C0', emoji: '🔭', unlockAt: 8,
      desc: '咕咕老师架起望远镜：不说话也能看见别人的心情，先猜一猜，再轻轻靠过去。',
      levels: [
        {
          id: 'so-1', title: '看看他的样子', type: 'match',
          intro: '团团踮脚架起望远镜：「不说话也能看出心情哦，凑近瞧瞧这些小线索。」',
          teach: '低头、攥拳、眼睛发亮都是线索；不用等对方开口，也能先猜到一点他的感受。',
          tip: '看动画时按暂停，问问「他现在什么感觉，你从哪儿看出来的」。',
          data: {
            instruction: '看看小伙伴的样子，连上他可能的心情',
            pairs: [
              { left: { id: 'p1', label: '小宇把卷子折成小小一块，低着头', emoji: '📄', face: 'sad' }, right: { id: 'p1', label: '难过', emoji: '😢' } },
              { left: { id: 'p2', label: '同桌眼睛亮亮的，举着画跑过来', emoji: '🖼️', face: 'happy' }, right: { id: 'p2', label: '开心', emoji: '😊' } },
              { left: { id: 'p3', label: '他攥着拳头，脸涨得红红的', emoji: '✊', face: 'angry' }, right: { id: 'p3', label: '生气', emoji: '😠' } },
              { left: { id: 'p4', label: '她躲在门后，声音小小的', emoji: '🚪', face: 'scared' }, right: { id: 'p4', label: '害怕', emoji: '😨' } },
              { left: { id: 'p5', label: '他一个人坐在长椅上，不说话', emoji: '🪑', face: 'lonely' }, right: { id: 'p5', label: '孤单', emoji: '🥺' } }
            ]
          },
          reward: { stars: 3, sticker: 'st-telescope' }
        },
        {
          id: 'so-2', title: '轻轻走过去', type: 'choice',
          intro: '团团放轻脚步：「小美今天好安静，咱们怎么过去，才不吓着她？」',
          teach: '先说你看见的，再把「要不要说」留给对方，陪伴就不会变成追问。',
          tip: '教孩子一句万能开头：「我陪你待一会儿，你想说的时候我在。」',
          data: {
            prompt: '课间，你看见平时爱笑的小美一个人趴在栏杆上，望着操场不说话。想过去陪陪她，哪种开口方式更让人舒服？',
            scene: 'school',
            options: [
              { id: 'a', text: '走过去轻轻说「你看起来有点安静，我陪你站一会儿好吗」', emoji: '🫂', good: true,
                outcome: '小美没抬头，却往你这边挪了半步，肩膀松了一点。',
                feedback: '团团小声说：「先说出你看见的，再把要不要说留给她，这样最不压人。」' },
              { id: 'b', text: '把刚折的纸小船递过去，什么也没多问', emoji: '⛵', good: true,
                outcome: '她接过去捏了捏，过了一会儿小声说了句「谢谢」。',
                feedback: '团团把纸船往前推了推：「不说话的陪伴，有时候比一串问题更让人松口气。」' },
              { id: 'c', text: '大声说「别闷着啦，快讲讲你怎么了」', emoji: '📣', good: false,
                outcome: '小美把脸转得更远了，周围几个人也看了过来。',
                feedback: '团团放轻了声音：「问得太急，对方反而想缩起来；慢一点，空间就留出来了。」' }
            ]
          },
          reward: { stars: 3, sticker: 'st-heart' }
        },
        {
          id: 'so-3', title: '趴在桌上的小宇', type: 'story',
          intro: '团团压低声音：「小宇把卷子折得好小，这个故事，由你陪他走完。」',
          teach: '安慰不一定要想出漂亮话，安静陪着、把空间留给对方，常常更管用。',
          tip: '家里有人低落时，带着孩子一起递杯水、坐一会儿，不必急着劝。',
          data: { storyId: 'story-2' },
          reward: { stars: 3, sticker: 'st-telescope' }
        },
        {
          id: 'so-4', title: '几个人几种心情', type: 'slider',
          intro: '团团转了转望远镜：「一张手抄报里，好像藏着好几份心情呢。」',
          teach: '同一件事里，每个人揣着的感觉可能都不一样；多想一层，就多懂一点同伴。',
          tip: '分工起分歧时，挨个问一句「你刚才希望的是什么」，别只盯输赢。',
          data: {
            prompt: '小组做手抄报，明明说他想全用蓝色，可你想用橙色。先别急着定，猜一猜：这件事里，可能有几种不一样的心情在同时打转？',
            minLabel: '就一种',
            maxLabel: '好几种',
            answer: { min: 3, max: 5 },
            hint: '你有一点想被听见，明明有一点怕方案被改，旁边同学也许在观望——同一件事里，常常住着好几个人的心情。'
          },
          reward: { stars: 3, sticker: 'st-heart' }
        }
      ]
    },

    {
      id: 'relationship', name: '友谊桥梁岛', skill: '人际关系', subtitle: '把话好好搭过去',
      color: '#FFB27A', emoji: '🌉', unlockAt: 14,
      desc: '轮流、商量、把「我觉得…」说出口，和小伙伴一块儿把小小桥梁搭稳。',
      levels: [
        {
          id: 're-1', title: '把话好好说出口', type: 'order',
          intro: '团团攥着小纸条：「我觉得…因为…我希望…三句连起来，魔法就出现啦。」',
          teach: '「我觉得…因为…我希望…」把感觉、事情、请求分开说，对方更容易接住，也不容易吵起来。',
          tip: '冲突后别急着评理，用这三句轮流说一轮，孩子会慢慢习惯这个句式。',
          data: {
            instruction: '想把心里的话好好说出口，把这几步排成顺序',
            items: [
              { id: 's1', text: '我觉得…（说出自己的感觉）', emoji: '💛' },
              { id: 's2', text: '因为…（说清发生了什么）', emoji: '📎' },
              { id: 's3', text: '我希望…（说出想要的小改变）', emoji: '🌱' },
              { id: 's4', text: '然后停下来，听听对方怎么说', emoji: '👂' }
            ],
            answer: ['s1', 's2', 's3', 's4']
          },
          reward: { stars: 3, sticker: 'st-bridge' }
        },
        {
          id: 're-2', title: '小房子塌了一角', type: 'choice',
          intro: '团团扶着歪掉的墙角：「心里疼，话又不想伤人，这句该怎么讲？」',
          teach: '说出「我」的感觉和想要的小改变，比指责对方更容易一起把事情补好。',
          tip: '东西被弄坏时，先接住孩子的「心疼」，再一起想「怎么补」。',
          data: {
            prompt: '小组做模型，同桌不小心把你刚粘好的小房子碰塌了一角，他愣在那儿。这块是你忙了一中午的，心里有点疼。怎么说，既表达自己，又不把关系弄僵？',
            scene: 'group',
            options: [
              { id: 'a', text: '「我觉得有点心疼，因为这是我粘了好久的，我希望我们一起把它补回去」', emoji: '🛠️', good: true,
                outcome: '他马上蹲下来帮你扶住墙角，两个人边补边商量怎么更牢。',
                feedback: '团团扶稳墙角：「感觉、原因、想补的地方都说到，对方就知道该往哪儿使劲啦。」' },
              { id: 'b', text: '先吸口气，说「没事，我知道你不是故意的，我们重来」', emoji: '🫧', good: true,
                outcome: '他松了口气，主动去拿胶水，模型后来比原来还稳。',
                feedback: '团团松了口气：「看见他不是故意的，关系就留出转圜的地方了。」' },
              { id: 'c', text: '一把把他的材料也推乱', emoji: '😤', good: false,
                outcome: '两个人都僵住了，模型谁来补也没人提，那股心疼变成了闷气。',
                feedback: '团团把两堆材料分开摆：「手快过嘴，事情容易越滚越大；先让手停一下，话才有机会被听见。」' }
            ]
          },
          reward: { stars: 3, sticker: 'st-handshake' }
        },
        {
          id: 're-3', title: '靠近还是推远', type: 'classify',
          intro: '团团摆出两个小篮子：「有的小动作让心贴贴，有的悄悄把人推远。」',
          teach: '关系常是被一件件小事拉近或推远的；说到做到、一起想办法，属于「靠近」那一篮。',
          tip: '和孩子复盘一天：哪件小事让你俩更近了，不用评好坏，只描述。',
          data: {
            instruction: '把卡片放到正确的篮子里',
            buckets: [
              { id: 'close', label: '让心靠近', emoji: '🤝' },
              { id: 'far', label: '把人推远', emoji: '🧊' }
            ],
            items: [
              { id: 'i1', text: '轮流玩，说到做到', emoji: '🔄', bucket: 'close' },
              { id: 'i2', text: '抢过来说「都得听我的」', emoji: '📢', bucket: 'far' },
              { id: 'i3', text: '弄坏了东西，说「我们一起修」', emoji: '🛠️', bucket: 'close' },
              { id: 'i4', text: '给同学起外号，还一直叫', emoji: '🏷️', bucket: 'far' },
              { id: 'i5', text: '他难过时，安静递张纸巾', emoji: '🧻', bucket: 'close' },
              { id: 'i6', text: '答应保密，转头讲给全班听', emoji: '🤫', bucket: 'far' }
            ],
            explain: ['让人靠近的，多半是「说到做到、一起想办法、留点空间」这些小事', '推远人的常常不是大事，而是一次次没被接住的小瞬间；发现了，随时可以重新来过']
          },
          reward: { stars: 3, sticker: 'st-bridge' }
        }
      ]
    },

    {
      id: 'decision', name: '智慧灯塔岛', skill: '负责任决策', subtitle: '拿不准时先亮灯',
      color: '#B7A6E8', emoji: '🗼', unlockAt: 20,
      desc: '停一下、想几个办法、选更稳妥的；灯塔亮着，拿不准的事也能慢慢看清楚。',
      levels: [
        {
          id: 'de-1', title: '高台上的招手', type: 'story',
          intro: '团团拉住你：「有人喊你跳高台，拒绝和求助，都在这故事里等你选。」',
          teach: '心里发紧就是身体在提醒；拿不准时，可以拒绝、走开，再找可信的大人。',
          tip: '和孩子约好：任何让他「不舒服、要保密、别告诉大人」的事，都可以回来讲。',
          data: { storyId: 'story-3' },
          reward: { stars: 3, sticker: 'st-lighthouse' }
        },
        {
          id: 'de-2', title: '灯塔的方盒子', type: 'breathe',
          intro: '团团学灯塔守夜人压低声音：「决定之前，先沿着方盒子走四圈，灯就亮了。」',
          teach: '方盒子呼吸是吸 4、停 4、呼 4；脑子乱的时候，先让节奏稳下来再选。',
          tip: '遇到要做选择的事（比如报不报名），先陪孩子安静呼吸几轮，再聊选项。',
          data: {
            title: '智慧灯塔的方盒子呼吸', pattern: 'box', cycles: 4, inhale: 4, hold: 4, exhale: 4,
            cues: ['吸气…沿着盒子的一条边，慢慢走四步', '停一停…在拐角站住，数四下', '呼气…沿着下一条边，轻轻走四步', '再停一停…回到起点，准备下一圈']
          },
          reward: { stars: 3, sticker: 'st-compass' }
        },
        {
          id: 'de-3', title: '亮闪闪的弹窗', type: 'choice',
          intro: '团团盯着平板上蹦出来的小窗口：「它喊『快点快点』，咱们偏要慢半拍。」',
          teach: '「再不点就没了」是催人快跑的小把戏；先停手、找大人，主动权就回来了。',
          tip: '和孩子约定：弹窗、要填信息、要保密的页面，一律先叫大人一起看。',
          data: {
            prompt: '你在平板上看动画，忽然跳出一个亮闪闪的窗口：「点这里，免费领限量皮肤！」旁边还挤着一行小字，你有点想点，又有点拿不准。这时候怎么做更稳妥？',
            scene: 'online',
            options: [
              { id: 'a', text: '先不点，把平板拿去问家里大人「这个能点吗」', emoji: '🙋', good: true,
                outcome: '大人过来一看，原来是要填好多信息的页面，关掉就好了。',
                feedback: '团团把平板举高一点：「拿不准就先停手、找大人一起看，等于给自个儿留了盏灯。」' },
              { id: 'b', text: '关掉弹窗，回去继续看原来的动画', emoji: '❎', good: true,
                outcome: '窗口消失了，动画正好演到最有趣那段，你也没少什么。',
                feedback: '团团点点头：「不点也是一种决定，而且常常是省事又安心的那个。」' },
              { id: 'c', text: '赶紧点进去，怕晚了就领不到', emoji: '👆', good: false,
                outcome: '页面一层套一层，跳出来好几个要填的框，你有点慌，不知道按了什么。',
                feedback: '团团伸手挡了挡：「『再不点就没了』是催人快跑的小把戏，慢半拍、先问一句，主动权就回你手里啦。」' }
            ]
          },
          reward: { stars: 3, sticker: 'st-lighthouse' }
        },
        {
          id: 'de-4', title: '小火苗的四步', type: 'order',
          intro: '团团在沙滩上画了四个脚印：「停、想、选、回头看，一步一个。」',
          teach: '停一下→想几个办法→选更稳妥的→回头看看，决定就不只是「碰运气」了。',
          tip: '让孩子把「我还有别的办法吗」当成口头禅，选完再随口聊一句感受。',
          data: {
            instruction: '遇到拿不准的事，把做决定的四步排成顺序',
            items: [
              { id: 's1', text: '先停下来，不马上动手', emoji: '✋' },
              { id: 's2', text: '想一想：有哪几个办法，各自会怎样', emoji: '🤔' },
              { id: 's3', text: '选一个更稳妥、也更不伤人的', emoji: '✅' },
              { id: 's4', text: '做完回头看看：感觉怎么样，下次还这样吗', emoji: '🔭' }
            ],
            answer: ['s1', 's2', 's3', 's4']
          },
          reward: { stars: 3, sticker: 'st-compass' }
        }
      ]
    }
  ],

  /* ---------- 三个分支故事：3 层，n1 → n2/n3 → n4..n6 结局 ---------- */
  stories: [
    {
      id: 'story-1', title: '操场上被插队', cover: '🛝', start: 'n1',
      nodes: {
        n1: {
          speaker: '团团', emotion: 'angry',
          text: '下课啦，你排在滑梯队伍里，前面就剩两个人。忽然有个同学从旁边挤到你前面，还回头冲你笑。你的小脸一下子热热的，手也攥了起来。',
          choices: [
            { text: '用力把他推开，喊「别插队！」', next: 'n2', good: false,
              feedback: '推一下，两个人都晃了半步，队伍乱成一团，老师赶紧跑过来。先让自己停两秒，那句话反而会更有分量。',
              effect: { skill: 'management', delta: 1 } },
            { text: '吸一口气，轻轻拍他说「我排在你前面哦，一起排队吧」', next: 'n3', good: true,
              feedback: '你把话说得清清楚楚，他愣了一下，退回后面去了，轮到你时滑得特别顺。',
              effect: { skill: 'management', delta: 2 } },
            { text: '憋着不吭声，转身去玩别的', next: 'n2', good: false,
              feedback: '你走开了，可那团热热的气还留在胸口。情绪没消失，它可以被好好说出来。',
              effect: { skill: 'awareness', delta: 1 } }
          ]
        },
        n2: {
          speaker: '咕咕老师', emotion: 'angry',
          text: '咕咕老师飞下来，蹲在你旁边：「老师看见啦，你气得手都攥紧了。要不要先吹三个泡泡，再决定下一步？」',
          choices: [
            { text: '跟着吹泡泡，等心跳慢下来再回去排队', next: 'n4', good: true,
              feedback: '三口气吹完，手松开了，你回到队伍尾巴，还能边等边和同学聊天。',
              effect: { skill: 'management', delta: 2 } },
            { text: '还是气鼓鼓，直接冲回队伍理论', next: 'n5', good: false,
              feedback: '声音越说越大，谁也没听清谁。先让身体冷下来，话才容易被听见。',
              effect: { skill: 'management', delta: 1 } }
          ]
        },
        n3: {
          speaker: '小火苗', emotion: 'calm',
          text: '他退回去以后，旁边一个更小的同学凑过来：「刚才谢谢你没吵架，我有点不敢说。」你忽然觉得胸口松松的。',
          choices: [
            { text: '告诉他「下次也可以慢慢说，我陪你」', next: 'n6', good: true,
              feedback: '他用力点点头，两个人一起排到了最后，还约好明天再玩。',
              effect: { skill: 'relationship', delta: 2 } },
            { text: '笑着说「没事啦」，继续去玩滑梯', next: 'n5', good: true,
              feedback: '你跑向滑梯，风从耳边过去，那点气早就散啦。',
              effect: { skill: 'relationship', delta: 1 } }
          ]
        },
        n4: {
          speaker: '团团', emotion: 'calm', ending: true, choices: [],
          text: '你回到队伍尾巴，慢慢等着，滑梯一次比一次顺。那股热热的气，早被三口泡泡带走了。',
          moral: '生气时先让身体冷下来，再回去说话，事情往往就顺了。'
        },
        n5: {
          speaker: '咕咕老师', emotion: 'calm', ending: true, choices: [],
          text: '后来你们还是一起玩到了下课。回头想想，那句话要是晚两秒说，也许会更轻、更稳。',
          moral: '话出口前留一个呼吸的空档，声音就不必那么大。'
        },
        n6: {
          speaker: '小火苗', emotion: 'proud', ending: true, choices: [],
          text: '你陪那个小同学一起排到了最后，两个人还约好明天再玩。被插队那点气，变成了交到一个新朋友。',
          moral: '把「我排在你前面哦」说清楚，既护住自己，也给别人留了台阶。'
        }
      }
    },
    {
      id: 'story-2', title: '趴在桌上的小宇', cover: '🎒', start: 'n1',
      nodes: {
        n1: {
          speaker: '团团', emotion: 'sad',
          text: '午休后，你看见同桌小宇趴在桌上，眼睛红红的，数学卷子被折成小小一块塞进抽屉。你想过去，又怕说错话，脚步停在过道中间。',
          choices: [
            { text: '装作没看见，自己去走廊玩', next: 'n2', good: false,
              feedback: '你玩了一圈回来，小宇还是趴着。留下来陪一会儿，常常比走开更暖一点。',
              effect: { skill: 'social', delta: 1 } },
            { text: '坐到旁边轻轻问「你看起来有点难过，要不要说说」', next: 'n3', good: true,
              feedback: '小宇抬起头，小声说「我考砸了」，肩膀松了一点点。被看见，本身就是一种接住。',
              effect: { skill: 'social', delta: 2 } },
            { text: '大声说「这有什么好难过的，下次考好就行」', next: 'n2', good: false,
              feedback: '小宇把头埋得更低了。难过不用被赶走，先被接住就好。',
              effect: { skill: 'social', delta: 1 } }
          ]
        },
        n2: {
          speaker: '咕咕老师', emotion: 'worried',
          text: '咕咕老师轻轻落在桌角：「其实不用想出最漂亮的话，光是安静地陪着，也算一种帮忙哦。」',
          choices: [
            { text: '折回座位，把纸巾悄悄推过去，陪他坐着', next: 'n4', good: true,
              feedback: '你什么也没多问，小宇却慢慢把卷子摊开了。不说话的陪伴，也能稳稳托住人。',
              effect: { skill: 'social', delta: 2 } },
            { text: '去告诉老师「小宇趴着不太开心」', next: 'n5', good: true,
              feedback: '老师过来蹲下问了问，小宇点点头。找可信的大人一起帮忙，也是很稳的一步。',
              effect: { skill: 'relationship', delta: 1 } }
          ]
        },
        n3: {
          speaker: '小火苗', emotion: 'calm',
          text: '小宇小声说：「我怕家里人失望。」你想起自己上次考砸，心里也这样沉过，就没急着接话。',
          choices: [
            { text: '说「我上次也这样，后来一起看了看错的题」', next: 'n6', good: true,
              feedback: '小宇抬起眼睛：「你也考砸过呀？」两个人一起笑了一下，卷子没那么吓人了。',
              effect: { skill: 'social', delta: 2 } },
            { text: '安静把椅子挪近一点，等他想说再说', next: 'n5', good: true,
              feedback: '你不催他，过了一会儿他自己开了口。把时间留给对方，也是一种照顾。',
              effect: { skill: 'relationship', delta: 1 } }
          ]
        },
        n4: {
          speaker: '团团', emotion: 'calm', ending: true, choices: [],
          text: '你什么也没多问，小宇却慢慢把卷子摊开了，还指了指那道错题。午后的教室安安静静。',
          moral: '陪着，是一种不用说话也够暖的安慰。'
        },
        n5: {
          speaker: '咕咕老师', emotion: 'calm', ending: true, choices: [],
          text: '老师蹲下来问了几句，又找来大人一起想办法；小宇点点头，肩膀慢慢放下来了。',
          moral: '自己拿不准时，找可信的大人一起帮忙，也是很稳的一步。'
        },
        n6: {
          speaker: '小火苗', emotion: 'proud', ending: true, choices: [],
          text: '「你也考砸过呀？」小宇抬起眼睛，两个人一起笑了一下，那张卷子没那么吓人了。',
          moral: '说一句「我也这样过」，比讲一堆道理更容易让人松口气。'
        }
      }
    },
    {
      id: 'story-3', title: '高台上的招手', cover: '🛴', start: 'n1',
      nodes: {
        n1: {
          speaker: '团团', emotion: 'scared',
          text: '放学路过小广场，几个大孩子站在高台上冲你招手：「从这儿跳下来才好玩，不敢就是胆小鬼！」你抬头看看，台阶比你还高半头，心里有点发紧。',
          choices: [
            { text: '咬咬牙爬上去，闭眼往下跳', next: 'n2', good: false,
              feedback: '落地时脚崴了一下，疼得你坐在地上。身体在轻轻提醒你：这件事它不太愿意。',
              effect: { skill: 'decision', delta: 1 } },
            { text: '说「我不跳，这个太高了」，然后往旁边走开', next: 'n3', good: true,
              feedback: '你声音不大，但很稳，有个大孩子嘀咕了一句，也没再追。',
              effect: { skill: 'decision', delta: 2 } },
            { text: '不吭声，站在原地不知道怎么办', next: 'n2', good: false,
              feedback: '你没说好也没说不好，那点发紧还悬着。拿不准时，可以先离开，再找人商量。',
              effect: { skill: 'awareness', delta: 1 } }
          ]
        },
        n2: {
          speaker: '咕咕老师', emotion: 'scared',
          text: '咕咕老师落在路灯上：「心里发紧的时候，不用立刻做决定。先退开两步，再去找一个你信得过的大人，好不好？」',
          choices: [
            { text: '退到长椅边，给妈妈打电话说清楚这里的事', next: 'n4', good: true,
              feedback: '妈妈很快过来，你指着高台把经过讲了一遍。说清楚，比硬撑着安心多了。',
              effect: { skill: 'decision', delta: 2 } },
            { text: '拉住路过的保安叔叔，请他陪你走开', next: 'n5', good: true,
              feedback: '叔叔陪你绕了另一条路回家。找大人帮忙，不是告状，是照顾好自己。',
              effect: { skill: 'relationship', delta: 1 } }
          ]
        },
        n3: {
          speaker: '小火苗', emotion: 'proud',
          text: '走开几步，你回头看见他们也没再跳，倒是一个小一点的孩子跟着你过来：「我也不太想跳。」',
          choices: [
            { text: '跟他说「不想就可以不跳，我们一起去找别的好玩的」', next: 'n6', good: true,
              feedback: '两个人跑去玩跷跷板，笑得比刚才还响。拒绝之后，还能顺手给同伴一个台阶。',
              effect: { skill: 'relationship', delta: 2 } },
            { text: '把刚才的事告诉了值班的阿姨', next: 'n5', good: true,
              feedback: '阿姨去提醒那几个孩子别在台子上闹。让大人知道，也是在帮大家。',
              effect: { skill: 'decision', delta: 1 } }
          ]
        },
        n4: {
          speaker: '团团', emotion: 'calm', ending: true, choices: [],
          text: '妈妈很快过来，你指着高台把经过讲了一遍，然后绕了另一条路回家，脚步轻轻的。',
          moral: '心里发紧时，先走开、再找可信的大人说清楚，就是照顾好自己。'
        },
        n5: {
          speaker: '咕咕老师', emotion: 'calm', ending: true, choices: [],
          text: '值班的阿姨去提醒了那几个孩子别在台子上闹，你顺着平路回了家，心里那点发紧散了。',
          moral: '让大人知道，不是告状，是帮大家都平平安安。'
        },
        n6: {
          speaker: '小火苗', emotion: 'proud', ending: true, choices: [],
          text: '两个人跑去玩跷跷板，笑得比刚才还响。原来不想跳，也可以一起找到别的好玩的。',
          moral: '拒绝之后，再给同伴一个台阶，大家都轻松。'
        }
      }
    }
  ],

  /* ---------- 贴纸 12 枚，island 为岛屿 id ---------- */
  stickers: [
    { id: 'st-magnifier', name: '小侦探放大镜', emoji: '🔍', desc: '把藏起来的小情绪照得清清楚楚', island: 'awareness' },
    { id: 'st-cloud', name: '心情小云朵', emoji: '☁️', desc: '心里的小天气，今天也来看过了', island: 'awareness' },
    { id: 'st-rainbow', name: '情绪彩虹', emoji: '🌈', desc: '好几种心情，可以一起挂着', island: 'awareness' },
    { id: 'st-bubble', name: '泡泡呼吸家', emoji: '🫧', desc: '三口气，把劲儿轻轻放掉', island: 'management' },
    { id: 'st-toolbox', name: '冷静工具箱', emoji: '🧰', desc: '攒了一箱子让身体慢下来的小工具', island: 'management' },
    { id: 'st-wave', name: '退一步海浪', emoji: '🌊', desc: '先退开两步，火苗就烧得慢了', island: 'management' },
    { id: 'st-telescope', name: '同理望远镜', emoji: '🔭', desc: '不说话，也能看见别人的心情', island: 'social' },
    { id: 'st-heart', name: '暖心创可贴', emoji: '💗', desc: '安静陪着，也是一种接住', island: 'social' },
    { id: 'st-bridge', name: '友谊小桥', emoji: '🌉', desc: '把「我觉得…」好好搭过去', island: 'relationship' },
    { id: 'st-handshake', name: '拉钩小手', emoji: '🤝', desc: '说好轮流，就一起照着做', island: 'relationship' },
    { id: 'st-lighthouse', name: '智慧灯塔', emoji: '🗼', desc: '拿不准的时候，先亮一盏灯', island: 'decision' },
    { id: 'st-compass', name: '选择小罗盘', emoji: '🧭', desc: '停、想、选、回头看，一步步来', island: 'decision' },
    /* 下面 3 枚不是关卡奖励，而是「说一说」开口里程碑解锁，见 expression.badges */
    { id: 'st-voice-first', name: '开口第一句', emoji: '🌱', desc: '第一次把心里的话大声说出来', island: 'relationship' },
    { id: 'st-voice-five', name: '勇气小话筒', emoji: '🎤', desc: '已经说过 5 次啦，声音越来越稳', island: 'relationship' },
    { id: 'st-voice-many', name: '心里话小达人', emoji: '💬', desc: '把感觉、事情、愿望连起来说了 15 次', island: 'relationship' }
  ],

  /* ---------- 每日签到原因：每个情绪 4 个 6-10 岁生活化场景 ---------- */
  checkinReasons: {
    happy: ['今天被老师表扬了字写得工整', '下课和好朋友一起跳皮筋，笑个不停', '晚饭吃到了最爱的番茄鸡蛋', '养的小豆子冒出了新芽'],
    sad: ['养的小金鱼不动了', '最好的朋友今天没和我一起玩', '画了很久的画被不小心撕破', '想去的公园因为下雨没去成'],
    angry: ['排队时有人插到我前面', '弟弟没问一声就拿走了我的彩笔', '搭好的积木被碰倒了', '明明说好轮流，他却一直占着'],
    scared: ['夜里关了灯，衣柜好像有影子', '第一次一个人去楼下拿快递', '操场上有只大狗朝我跑过来', '打雷的时候轰隆一声'],
    surprised: ['一打开门，大家喊「生日快乐」', '抽屉里冒出一份没想过的小礼物', '平时安静的同桌突然唱了首歌', '种的向日葵一夜之间长高一大截'],
    calm: ['洗完热水澡，窝在沙发上听雨', '拼图拼到最后一块，正好对上', '午休后教室安安静静，只听见风扇', '和团团一起慢慢吹完泡泡'],
    proud: ['自己系好了鞋带，没让大人帮忙', '把不会的题想了很久，终于做出来', '第一次独自上台念完一段课文', '教妹妹学会了拍皮球'],
    jealous: ['同桌的新水壶会变色，大家围过去看', '好朋友和别的同学玩得特别开心', '哥哥被允许晚睡半小时', '别人上台领奖，我在下面拍手'],
    worried: ['明天要默写，还有几个字没记牢', '妈妈比平时晚了好久来接我', '不小心把杯子摔裂，怕被问起', '小组作业轮到我讲，怕忘词'],
    lonely: ['生病请假，一整天没见到同学', '搬了新家，附近还不认识谁', '分组时大家很快凑好，我站着没动', '想加入游戏，却没敢开口']
  },

  /* ---------- 家长建议：每个能力 3 条，只给可操作的生活做法 ---------- */
  parentTips: {
    awareness: [
      '每天留两分钟聊聊「今天身体里有过哪种感觉」，只描述、不评价。',
      '把情绪词写成小卡片贴在冰箱上，孩子卡住时让他随手挑一张。',
      '自己也有情绪时，当着孩子说出来：「我现在有点急，先去吹两口气。」'
    ],
    management: [
      '设一个固定的「冷静角」，放水杯、软球、沙漏，允许孩子先待一会儿。',
      '把 4-6 呼吸画成泡泡图，睡前一起吹三轮，当游戏不当任务。',
      '孩子激动时先陪他稳住身体，等手不抖了再一起想那句话怎么说。'
    ],
    social: [
      '看动画或读绘本时按暂停，猜一猜「他现在什么感觉，从哪儿看出来」。',
      '家里有人低落，带孩子一起递杯水、安静坐一会儿，不必急着劝。',
      '遇到分歧，挨个问一句「你刚才希望的是什么」，让每个人都被听见。'
    ],
    relationship: [
      '把「我觉得…因为…我希望…」贴在桌角，冲突后轮流用这三句说一轮。',
      '玩具或作品被弄坏，先接住那句「心疼」，再一起商量「怎么补」。',
      '每天随口聊一件「今天哪件小事让你和谁更近了」，只描述不打分。'
    ],
    decision: [
      '约定好：弹窗、要填信息、让「别告诉大人」的事，一律先叫大人一起看。',
      '把「我还有别的办法吗」变成全家口头禅，选之前先列两三个选项。',
      '选完不急着评判结果，隔天聊一句「回头看，感觉怎么样」。'
    ]
  },

  /* ---------- 角色化语音 ----------
     同一套本机中文语音，用音高/语速区分三位伙伴；不加载任何音频文件、不联网。 */
  voiceRoles: {
    cloud: { name: '团团', emoji: '☁️', pitch: 1.18, rate: 0.95 },
    owl: { name: '咕咕老师', emoji: '🦉', pitch: 0.92, rate: 0.86 },
    fox: { name: '小火苗', emoji: '🔥', pitch: 1.32, rate: 1.08 }
  },

  /* ---------- 没有中文语音时给家长的可操作指引 ---------- */
  voiceHelp: {
    missing: '这台电脑还没检测到中文语音，朗读可能听不见，或会用别的口音念中文。',
    steps: [
      'Windows：设置 → 时间和语言 → 语言和区域，添加「中文(简体，中国)」，再到「语音」里安装中文语音包。',
      'macOS：系统设置 → 辅助功能 → 朗读内容 → 系统声音，挑选一个中文声音。',
      '装好后重新打开心晴岛，点下面的「试听一句」确认。朗读全部在本机完成，不会联网。'
    ]
  },

  /* ---------- 说一说 · 勇气小话筒 ----------
     只用「听示范 → 自己开口 → 自己确认」的方式鼓励口头表达：
     不申请麦克风、不录音、不联网，也不保存孩子说过的任何一句话。 */
  expression: {
    dailyStarCap: 3,
    frames: [
      { id: 'feel', emoji: '💛', label: '我觉得…', hint: '说出心里那团感觉的名字', example: '我觉得有点委屈' },
      { id: 'because', emoji: '📎', label: '因为…', hint: '说清刚才发生了什么', example: '因为我的画被碰坏了' },
      { id: 'hope', emoji: '🌱', label: '我希望…', hint: '说一个小小的请求', example: '我希望下次先问一声' }
    ],
    audiences: ['团团', '镜子里的自己', '家里的毛绒玩具', '妈妈或爸爸', '好朋友', '老师'],
    cheers: [
      '你把心里的话说出来了，真勇敢！',
      '团团听见啦，说出来以后，心里是不是轻了一点？',
      '声音大一点小一点都没关系，说出来就很了不起。',
      '你会说「我觉得」了，这是在好好照顾自己呢。',
      '三句话连起来说，别人就更容易听懂你啦。',
      '哪怕只说给自己听，也算一次很棒的练习。',
      '你刚才停了一下才说，那份认真团团看见啦。',
      '下一次想说的时候，勇气小话筒还在这里等你。'
    ],
    /* 独立练习页的情境卡：生活化的小事，不评价孩子的说法。
       demo = 对同伴说（更短更直接）；demoAdult = 对大人说（带称呼、把需要什么帮助讲清楚）。 */
    prompts: [
      { id: 'ex-1', emoji: '🖍️', scene: '弟弟没问一声，就拿走了你最喜欢的彩笔', feeling: '生气', who: '弟弟',
        demo: '我觉得有点生气，因为彩笔被拿走时没人问我，我希望下次先用完跟我说一声。',
        demoAdult: '妈妈，我觉得有点生气，因为弟弟没问一声就拿走了我的彩笔，我希望你陪我一起跟他说，下次先问一声。', frame: 'hope' },
      { id: 'ex-2', emoji: '🧩', scene: '分组的时候，大家很快就凑好了，你还站着', feeling: '孤单', who: '小组同学',
        demo: '我觉得有点孤单，因为刚才没人叫我一起，我希望下一轮能加进你们组。',
        demoAdult: '老师，我觉得有点孤单，因为分组时大家很快凑好了、没人叫我，我希望下次分组时帮我找一个小组。', frame: 'because' },
      { id: 'ex-3', emoji: '🍋', scene: '好朋友今天一直和别的同学玩，没来找你', feeling: '羡慕', who: '好朋友',
        demo: '我觉得有点羡慕，因为今天没和你一起玩，我希望明天课间能一起跳皮筋。',
        demoAdult: '妈妈，我觉得有点羡慕，因为好朋友今天一直和别的同学玩，我希望你听我说完，再陪我想想明天怎么开口约他。', frame: 'feel' },
      { id: 'ex-4', emoji: '🧱', scene: '搭了很久的积木，被跑过来的小朋友碰倒了', feeling: '生气', who: '那个小朋友',
        demo: '我觉得很心疼，因为积木搭了很久，我希望你帮我一起扶起来。',
        demoAdult: '老师，我觉得很心疼，因为积木搭了很久被碰倒了，我希望你先陪我缓一缓，再帮我们说清楚怎么一起扶起来。', frame: 'hope' },
      { id: 'ex-5', emoji: '🎤', scene: '明天轮到你上台念一段课文', feeling: '担心', who: '妈妈',
        demo: '我觉得有点担心，因为怕站在台上忘词，我希望今晚陪我念两遍。',
        demoAdult: '妈妈，我觉得有点担心，因为明天要上台念课文、怕忘词，我希望今晚你陪我念两遍。', frame: 'feel' },
      { id: 'ex-6', emoji: '🥺', scene: '杯子摔裂了，大人以为是家里的小狗碰的', feeling: '委屈', who: '爸爸',
        demo: '我觉得有点委屈，因为杯子是我不小心碰到的，我希望先把事情说清楚。',
        demoAdult: '爸爸，我觉得有点委屈，因为杯子是我不小心碰裂的，小狗没有碰，我希望你先听我把经过讲完。', frame: 'because' },
      { id: 'ex-7', emoji: '🛝', scene: '大家玩得很热闹，你想加入却还没开口', feeling: '紧张', who: '一起玩的同学',
        demo: '我觉得有点紧张，因为还不熟悉这个游戏，我希望你们告诉我怎么玩。',
        demoAdult: '老师，我觉得有点紧张，因为我想加入游戏却还不知道怎么开口，我希望你陪我走过去问一句。', frame: 'feel' },
      { id: 'ex-8', emoji: '🖼️', scene: '画了很久的画，被妹妹撕了一个角', feeling: '难过', who: '妹妹',
        demo: '我觉得很难过，因为那张画我画了很久，我希望以后想看先来问我。',
        demoAdult: '妈妈，我觉得很难过，因为那张画我画了很久、被妹妹撕了一个角，我希望你先抱抱我，再和妹妹说想看先问我。', frame: 'hope' },
      { id: 'ex-9', emoji: '🎁', scene: '收到一份礼物，其实并不是你想要的', feeling: '为难', who: '送礼物的人',
        demo: '我觉得有点为难，因为想说谢谢又不想装作很喜欢，我希望先好好收下它。',
        demoAdult: '妈妈，我觉得有点为难，因为收到礼物想说谢谢、又不想装作很喜欢，我希望你告诉我这样可以怎么说。', frame: 'because' },
      { id: 'ex-10', emoji: '🏃', scene: '接力赛没跑好，班里输了', feeling: '难过', who: '队友',
        demo: '我觉得有点难过，因为最后一棒没接稳，我希望下次我们先多练几次交接。',
        demoAdult: '老师，我觉得有点难过，因为接力赛最后一棒没接稳，我希望下次练习时多给我们几次交接的机会。', frame: 'hope' },
      { id: 'ex-11', emoji: '⏰', scene: '放学时妈妈比平时晚了好久还没来', feeling: '担心', who: '妈妈',
        demo: '我觉得很担心，因为等的时间比平时长，我希望下次晚了能让人告诉我一声。',
        demoAdult: '妈妈，我觉得很担心，因为今天等的时间比平时长，我希望下次晚到时能让老师告诉我一声。', frame: 'because' },
      { id: 'ex-12', emoji: '📱', scene: '爸爸一直在看手机，你想让他陪你拼拼图', feeling: '失落', who: '爸爸',
        demo: '我觉得有点失落，因为今天还没一起玩，我希望现在陪我拼十分钟拼图。',
        demoAdult: '爸爸，我觉得有点失落，因为今天还没一起玩，我希望你现在放下手机，陪我拼十分钟拼图。', frame: 'hope' }
    ],
    /* 关卡里的「说一说」话题：每关一条，两种示范都可直接用语音念给孩子听 */
    levelPrompts: {
      'aw-1': { scene: '你刚认出了好几张心情脸', who: '团团',
        demo: '我觉得认出心情有点像当小侦探，因为眉毛和嘴角会偷偷给线索，我希望心里乱乱的时候也能先找找线索。',
        demoAdult: '妈妈，我觉得认出心情像当小侦探，因为眉毛和嘴角会偷偷给线索，我希望你和我一起玩「演一个、猜一个」。' },
      'aw-2': { scene: '你刚把「身体里的感觉」和「外面发生的事」分开', who: '团团',
        demo: '我觉得胸口闷闷的，因为刚才积木倒了，我希望先安静坐一小会儿。',
        demoAdult: '爸爸，我觉得胸口闷闷的，因为刚才积木倒了，我希望你先问我身体里哪儿有感觉，再一起说发生了什么。' },
      'aw-3': { scene: '你刚给一团说不清的感觉起了名字', who: '团团',
        demo: '我觉得有点孤单，因为好朋友今天没和我一起玩，我希望明天能一起跳皮筋。',
        demoAdult: '妈妈，我觉得有点孤单，因为好朋友今天没和我一起玩，我希望你听我说完，别急着替我出主意。' },
      'aw-4': { scene: '你发现心里可以同时住着好几种感觉', who: '团团',
        demo: '我觉得又开心又有一点点不舍，因为今天被表扬了、也和伙伴闹了别扭，我希望两种感觉都可以留着。',
        demoAdult: '妈妈，我觉得又开心又有一点点不舍，因为今天被表扬了、也和伙伴闹了别扭，我希望你别只挑一种，让我把两种都说说。' },
      'ma-1': { scene: '你刚刚跟着泡泡慢慢呼吸了三轮', who: '小火苗',
        demo: '我觉得身体慢下来了，因为呼气比吸气长一点，我希望着急的时候也能先吹三个泡泡。',
        demoAdult: '爸爸，我觉得身体慢下来了，因为呼气比吸气长一点，我希望我着急时你陪我一起吹三个泡泡，不催我讲道理。' },
      'ma-2': { scene: '你把「停、吸、吐、说」排好了顺序', who: '团团',
        demo: '我觉得说话前先停一下很有用，因为身体稳了话才不会跑太快，我希望生气时试试这四步。',
        demoAdult: '妈妈，我觉得说话前先停一下很有用，因为身体稳了话才不会跑太快，我希望生气时你提醒我「停、吸、吐、说」。' },
      'ma-3': { scene: '你陪故事里的小朋友走过了滑梯前的紧张', who: '故事里的小朋友',
        demo: '我觉得有点紧张，因为滑梯看起来好高，我希望你陪我一起深吸一口气再决定。',
        demoAdult: '老师，我觉得有点紧张，因为滑梯看起来好高，我希望你陪我站在旁边深吸一口气，再让我自己决定。' },
      'ma-4': { scene: '积木倒啦，你选了一个让自己慢下来的做法', who: '一起玩的人',
        demo: '我觉得有点心疼，因为搭了很久才搭好，我希望我们先一起把积木扶起来。',
        demoAdult: '妈妈，我觉得有点心疼，因为积木搭了很久才搭好，我希望你先接住我这句话，再一起想怎么扶起来。' },
      'so-1': { scene: '你从表情里读出了别人的心情', who: '团团',
        demo: '我觉得他可能有点难过，因为他一直低着头没说话，我希望先安静陪他坐一会儿。',
        demoAdult: '妈妈，我觉得他可能有点难过，因为他一直低着头没说话，我希望你和我一起猜猜，再想想怎么安静陪他。' },
      'so-2': { scene: '你想轻轻走过去陪一个不太开心的人', who: '那位同学',
        demo: '我觉得你今天安静了好多，因为平时下课你总爱笑，我希望需要的时候可以陪你坐坐。',
        demoAdult: '老师，我觉得那位同学今天安静了好多，因为平时下课总爱笑，我希望你告诉我，先陪着坐一会儿合不合适。' },
      'so-3': { scene: '小宇趴在桌上，你猜了猜他怎么了', who: '小宇',
        demo: '我觉得你可能需要一点安静，因为你把头埋在胳膊里，我希望想聊的时候随时叫我。',
        demoAdult: '老师，我觉得小宇可能需要一点安静，因为他把头埋在胳膊里，我希望你和我一起留意他，等他想聊再开口。' },
      'so-4': { scene: '同一件事，几个人心里的天气各不相同', who: '团团',
        demo: '我觉得大家的感觉可以不一样，因为每个人在意的事不同，我希望先问问别人怎么想。',
        demoAdult: '妈妈，我觉得大家的感觉可以不一样，因为每个人在意的事不同，我希望你听我说完，也问问别人怎么想。' },
      're-1': { scene: '你把三句话排成了好好说话的顺序', who: '好朋友',
        demo: '我觉得有点着急，因为说好的轮流还没轮到我，我希望下一把换我先来。',
        demoAdult: '妈妈，我觉得有点着急，因为说好的轮流还没轮到我，我希望你别替我说，让我自己把这三句讲一遍。' },
      're-2': { scene: '小房子塌了一角，你要开口说点什么', who: '一起搭房子的伙伴',
        demo: '我觉得有点可惜，因为我们搭了很久，我希望一起把这一角补回去。',
        demoAdult: '爸爸，我觉得有点可惜，因为小房子我们搭了很久，我希望你先听我说完，再陪我们商量怎么补那一角。' },
      're-3': { scene: '你分清了哪些做法让人靠近、哪些把人推远', who: '团团',
        demo: '我觉得好好说一句话会把人拉近，因为对方才听得懂我的意思，我希望下次先说「我觉得」。',
        demoAdult: '妈妈，我觉得好好说一句话会把人拉近，因为对方才听得懂我的意思，我希望下次有分歧时全家轮流用「我觉得」说一轮。' },
      'de-1': { scene: '高台上有人招手，你做了让自己安心的选择', who: '妈妈',
        demo: '我觉得有点发紧，因为那个高台看着有点悬，我希望你陪我走另一条平路回家。',
        demoAdult: '妈妈，我觉得有点发紧，因为那个高台看着有点悬，我希望你先陪我走另一条平路，再听我把经过讲完。' },
      'de-2': { scene: '你用方盒子呼吸给自己留了想一想的时间', who: '小火苗',
        demo: '我觉得现在能慢慢想了，因为四拍吸气让身体稳住，我希望拿不准时先数四下。',
        demoAdult: '爸爸，我觉得现在能慢慢想了，因为四拍吸气让身体稳住，我希望拿不准时你别催我，陪我数四下。' },
      'de-3': { scene: '亮闪闪的弹窗跳出来，你决定先叫大人', who: '爸爸',
        demo: '我觉得有点拿不准，因为这个弹窗一直催我点，我希望你陪我一起看一看。',
        demoAdult: '爸爸，我觉得有点拿不准，因为这个弹窗一直催我点，我希望你陪我一起看一看，我们再决定。' },
      'de-4': { scene: '你走完了小火苗的四个决定步骤', who: '团团',
        demo: '我觉得先列出办法再选更安心，因为能看见还有别条路，我希望着急时也能停、想、选、回头看。',
        demoAdult: '妈妈，我觉得先把办法列出来再选更安心，因为能看见还有别条路，我希望你问我一句「还有别的办法吗」。' }
    },
    badges: [
      { id: 'st-voice-first', at: 1, title: '开口第一句', text: '第一次把心里的话说出来，勇气发芽啦 🌱' },
      { id: 'st-voice-five', at: 5, title: '勇气小话筒', text: '说过 5 次啦，声音越来越稳 🎤' },
      { id: 'st-voice-many', at: 15, title: '心里话小达人', text: '三句话连起来说了 15 次 💬' }
    ]
  }
};
