/* 一年级 · 数学奇妙岛课程内容（沪教版） */
window.CONTENT_GRADE_1 = {
  grade: 1,
  title: "一年级",
  emoji: "🐣",
  subtitle: "糖果乐园 · 数与形的启蒙",
  theme: "candy",
  semesters: [
    {
      id: "g1s1",
      title: "一年级上",
      units: [
        {
          id: "g1u1",
          title: "数字小镇",
          icon: "🔢",
          subtitle: "数一数、比一比、分一分",
          lessons: [
            {
              id: "g1l1",
              icon: "🍎",
              title: "数一数 1~10",
              concept: "10 以内数的认识",
              story: {
                scenes: [
                  { emoji: "🤖🐣", text: "闪闪和小伙伴来到了数字小镇。镇上的苹果树结满了果子，红彤彤的真好看！", sparkle: "我们一起数一数吧！" },
                  { emoji: "🍎🍎🍎🍎🍎", text: "数数的小秘诀是：用一个手指点一个，嘴里念一个数，一个也不能漏，一个也不能重复哦。", sparkle: "点一个，数一个：1、2、3、4、5" },
                  { emoji: "🔢✨", text: "点到最后一个苹果时，念出来的数，就是苹果的总数！这就是『点数法』。", sparkle: "最后一个数是几，就有几个！" }
                ]
              },
              explore: {
                type: "count-click",
                title: "果园点数大挑战",
                instruction: "👆 点一个苹果数一个数，全部点完看看是几个？",
                item: "🍎",
                count: 8,
                wrapup: "一共 8 个！最后一个数是 8，说明总数就是 8。"
              },
              games: [
                {
                  id: "g1l1-g1",
                  title: "第 1 关 · 数果子",
                  icon: "🍒",
                  questions: [
                    { id: "q1", type: "choice", visual: { emoji: "🍓🍓🍓🍓🍓🍓" }, prompt: "一共有几颗草莓？", options: ["5", "6", "7"], answer: "6", hints: ["一个一个点着数：🍓是1、🍓是2、🍓是3……", "数到最后一个，念的是几呀？", "一共是 6 颗哦。"] },
                    { id: "q2", type: "choice", visual: { emoji: "🐤🐤🐤🐤" }, prompt: "几只小黄鸭在游泳？", options: ["3", "4", "5"], answer: "4", hints: ["用手指点一只数一只：1、2、3、4", "最后一个是 4", "一共 4 只。"] },
                    { id: "q3", type: "input", visual: { emoji: "🎈🎈🎈🎈🎈🎈🎈" }, prompt: "数一数，有几个气球？输入数字吧！", answer: "7", hints: ["从左往右一个一个数", "念出来的最后一个数就是总数", "是 7 个。"] },
                    { id: "q4", type: "choice", visual: { emoji: "🐟🐟🐟🐟🐟🐟🐟🐟🐟" }, prompt: "水里有几条小鱼？", options: ["8", "9", "10"], answer: "9", hints: ["别着急，一个一个点着数", "小心别数漏了中间那条！", "一共 9 条。"] }
                  ]
                },
                {
                  id: "g1l1-g2",
                  title: "第 2 关 · 按数取物",
                  icon: "🧺",
                  questions: [
                    { id: "q5", type: "choice", prompt: "闪闪说：请给我 5 个西瓜！哪个筐是对的？", options: ["🍉", "🍉🍉🍉🍉🍉", "🍉🍉🍉🍉🍉🍉🍉"], answer: "🍉🍉🍉🍉🍉", hints: ["数一数每个筐里有几个", "要正好 5 个，不多也不少", "中间那筐正好 5 个。"] },
                    { id: "q6", type: "input", visual: { emoji: "🍭🍭🍭🍭" }, prompt: "棒棒糖有几根？再添上 2 根，一共有几根？", answer: "6", hints: ["先数现有：4 根，再接着往后数 2 个：5、6", "4 添上 2 是几？", "是 6 根。"] },
                    { id: "q7", type: "sequence", prompt: "把数字从小到大排一排！", items: ["2", "5", "1", "4"], answer: ["1", "2", "4", "5"], hints: ["先找最小的数放第一", "1 最小，然后是 2，接着 4，最后 5", "顺序是 1、2、4、5。"] }
                  ]
                },
                {
                  id: "g1l1-g3",
                  title: "第 3 关 · 数字魔法",
                  icon: "🪄",
                  questions: [
                    { id: "q8", type: "choice", prompt: "哪个数排在 6 的后面？", options: ["5", "7", "8"], answer: "7", hints: ["从小数到大：1、2、3、4、5、6、接下来是几？", "6 后面再数一个", "是 7。"] },
                    { id: "q9", type: "input", prompt: "9 的前面一个数是几？", answer: "8", hints: ["倒着数：9、然后是几？", "9 的邻居，比 9 小 1", "是 8。"] },
                    { id: "q10", type: "choice", visual: { emoji: "🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳" }, prompt: "山坡上一共有几棵树？", options: ["9", "10", "11"], answer: "10", hints: ["数到 9 之后如果还有，继续数", "最后一棵是第 10 棵", "一共 10 棵。"] },
                    { id: "q11", type: "input", prompt: "从 3 数到 8，一共数了几个数？（含 3 和 8）", answer: "6", hints: ["慢慢数：3、4、5、6、7、8，数了几个数？", "可以用手指记：数一个伸一根手指", "一共 6 个数。"] }
                  ]
                }
              ]
            },
            {
              id: "g1l2",
              icon: "⚖️",
              title: "比多少 比大小",
              concept: "比较与排序",
              story: {
                scenes: [
                  { emoji: "🐰🐢", text: "数字小镇运动会开始啦！小兔和小龟比赛吃萝卜干，谁吃得多呢？", sparkle: "怎么比才公平？" },
                  { emoji: "🐰🥕🥕🥕 🐢🥕🥕", text: "把两队的萝卜一一对应排整齐：一个对一个。小兔的排完了还有剩，小兔吃得多！", sparkle: "一一对应，多出来的就是多的" },
                  { emoji: "🔢↔️", text: "数也可以比：排在数轴右边的数更大！7 在 5 的右边，所以 7 比 5 大。", sparkle: "数轴上，右边的是大哥哥" }
                ]
              },
              explore: {
                type: "number-line",
                title: "数轴赛跑",
                instruction: "🚀 把小火箭滑到 8，看看 8 站在哪些数的右边？",
                min: 0, max: 10, step: 1, target: 8, marker: "🚀", start: 2,
                wrapup: "8 在 0~7 的右边，所以 8 比它们都大！数轴右边 = 更大。"
              },
              games: [
                {
                  id: "g1l2-g1",
                  title: "第 1 关 · 谁多谁少",
                  icon: "🍗",
                  questions: [
                    { id: "q1", type: "choice", visual: { emoji: "🐱🐟🐟🐟 🐶🐟🐟" }, prompt: "小猫和小狗的鱼，谁的多？", options: ["小猫多", "小狗多", "一样多"], answer: "小猫多", hints: ["一条对一条地比一比", "小猫 3 条，小狗 2 条，谁剩下了？", "小猫多 1 条。"] },
                    { id: "q2", type: "choice", prompt: "7 和 4 比，哪个大？", options: ["7", "4", "一样大"], answer: "7", hints: ["在数轴上找一找，谁站在右边？", "7 在 4 的右边", "7 大。"] },
                    { id: "q3", type: "input", visual: { emoji: "🐝🐝🐝🐝🐝" }, prompt: "有 5 只蜜蜂，飞走 2 只，还剩几只？", answer: "3", hints: ["5 只飞走 2 只：5、然后往回数 2 个：4、3", "5 减 2", "还剩 3 只。"] },
                    { id: "q4", type: "choice", prompt: "比 6 大、比 9 小的数是哪个？", options: ["5", "7", "9"], answer: "7", hints: ["先想 6 后面的数，再想 9 前面的数", "7 和 8 都可以，看选项里是谁", "是 7。"] }
                  ]
                },
                {
                  id: "g1l2-g2",
                  title: "第 2 关 · 排队整整齐齐",
                  icon: "🚏",
                  questions: [
                    { id: "q5", type: "sequence", prompt: "把数字从大到小排一排！", items: ["3", "6", "8"], answer: ["8", "6", "3"], hints: ["这次从最大的开始", "最大的是 8，然后 6，最后 3", "8、6、3。"] },
                    { id: "q6", type: "choice", prompt: "小动物排队：🐷在🐵前面，🐵在🐶前面。谁排最前？", options: ["🐶", "🐵", "🐷"], answer: "🐷", hints: ["前面 = 队伍的开头", "🐷在🐵前面，所以🐷更靠前", "是🐷。"] },
                    { id: "q7", type: "input", prompt: "小明前面有 2 人，后面有 3 人，这一队一共有几人？（小明也在队里哦）", answer: "6", hints: ["前面 2 人 + 小明 1 人 + 后面 3 人", "2 + 1 + 3", "一共 6 人。"] }
                  ]
                },
                {
                  id: "g1l2-g3",
                  title: "第 3 关 · 多多少 少多少",
                  icon: "📏",
                  questions: [
                    { id: "q8", type: "input", visual: { emoji: "🍪🍪🍪🍪🍪🍪 🍪🍪🍪" }, prompt: "左边 6 块饼干，右边 3 块，左边比右边多几块？", answer: "3", hints: ["一一对应配对后，看左边多出来几个", "6 比 3 多几个？6、5、4 往回数到 3，数了几步？", "多 3 块。"] },
                    { id: "q9", type: "choice", prompt: "要有 10 颗星，现在只有 7 颗，还差几颗？", options: ["2", "3", "4"], answer: "3", hints: ["从 7 接着数到 10：8、9、10，数了几个？", "10 - 7", "差 3 颗。"] },
                    { id: "q10", type: "choice", prompt: "哪个式子表示『5 比 2 多 3』？", options: ["5 - 2 = 3", "5 + 2 = 7", "2 + 3 = 4"], answer: "5 - 2 = 3", hints: ["多的部分 = 大数减小数", "5 里去掉 2，剩多少？", "5 - 2 = 3。"] }
                  ]
                }
              ]
            },
            {
              id: "g1l3",
              icon: "🍕",
              title: "分一分 平均分",
              concept: "平均分（除法萌芽）",
              story: {
                scenes: [
                  { emoji: "🐻🐻🐻 🍕", text: "三只小熊去野餐，带了一盒 6 块的披萨。怎么分才不吵架呢？", sparkle: "每只小熊想要一样多！" },
                  { emoji: "🍕➡️🐻 🍕➡️🐻 🍕➡️🐻", text: "一块一块轮流分：你一块、我一块、它一块……分完每只小熊都拿到 2 块，谁都一样多！", sparkle: "每份一样多，就叫『平均分』" },
                  { emoji: "🤖✨", text: "闪闪说：平均分藏在生活里——分蛋糕、发碗筷、排座位，都要『每份一样多』！", sparkle: "你来试试公平地分一分吧！" }
                ]
              },
              explore: {
                type: "drag-group",
                title: "野餐大厨",
                instruction: "🍩 把 12 个甜甜圈平均分给 3 个小伙伴，拖进他们的盘子里！",
                item: "🍩", total: 12, groups: 3, groupLabels: ["小熊盘", "小兔盘", "小狐盘"],
                wrapup: "每个盘子 4 个，一样多！12 平均分成 3 份，每份 4 个。"
              },
              games: [
                {
                  id: "g1l3-g1",
                  title: "第 1 关 · 公平小厨师",
                  icon: "👩‍🍳",
                  questions: [
                    { id: "q1", type: "choice", visual: { emoji: "🍬🍬🍬🍬 🍬🍬🍬🍬" }, prompt: "8 颗糖平均分给 2 个小朋友，每人几颗？", options: ["3", "4", "5"], answer: "4", hints: ["一颗给我一颗给你，轮流分", "分完后数一数每人的", "每人 4 颗。"] },
                    { id: "q2", type: "input", visual: { emoji: "🍗🍗🍗🍗🍗🍗🍗🍗🍗🍗" }, prompt: "10 个鸡腿平均分给 5 只小猫，每只几条？", answer: "2", hints: ["轮流一条一条分", "每只小猫拿到几条？", "每只 2 条。"] },
                    { id: "q3", type: "choice", prompt: "哪种分法是『平均分』？", options: ["5 颗分给一人，0 颗给另一人", "每人 3 颗", "一人 4 颗另一人 2 颗"], answer: "每人 3 颗", hints: ["平均分 = 每份一样多", "看看哪个选项每份数量相同", "每人 3 颗才是平均分。"] },
                    { id: "q4", type: "input", visual: { emoji: "🌈🌈🌈🌈🌈🌈🌈🌈🌈" }, prompt: "9 朵小花插进 3 个花瓶，每个花瓶一样多，每瓶几朵？", answer: "3", hints: ["轮流一朵一朵插", "3 个花瓶，每瓶几朵加起来是 9？", "每瓶 3 朵。"] }
                  ]
                },
                {
                  id: "g1l3-g2",
                  title: "第 2 关 · 分不完怎么办",
                  icon: "🤔",
                  questions: [
                    { id: "q5", type: "choice", visual: { emoji: "🧁🧁🧁🧁🧁" }, prompt: "5 个蛋糕平均分给 2 个人，会出现什么情况？", options: ["每人分不到一样多", "正好每人 2 个", "每人 3 个"], answer: "每人分不到一样多", hints: ["试着轮流分：你一个我一个……", "分到最后一层时还剩几个？", "剩 1 个没法平均，分不出一样多。"] },
                    { id: "q6", type: "input", prompt: "15 块饼干，每人分 3 块，可以分给几个人？", answer: "5", hints: ["3 块 + 3 块 + 3 块……一直加到 15", "数一数几个 3 是 15", "5 个 3 是 15，可以分给 5 人。"] },
                    { id: "q7", type: "choice", prompt: "12 支铅笔平均装盒，哪种装法每盒一样多？", options: ["装 2 盒每盒 6 支", "装 5 盒", "装 8 盒每盒 2 支"], answer: "装 2 盒每盒 6 支", hints: ["检验：盒数 × 每盒支数 = 12 才对", "2 × 6 = 12 ✓，其他呢？", "只有 2 盒每盒 6 支成立。"] }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: "g1s2",
      title: "一年级下",
      units: [
        {
          id: "g1u4",
          title: "加减小高手",
          icon: "➕",
          subtitle: "20 以内加减法",
          lessons: [
            {
              id: "g1l4",
              icon: "🧊",
              title: "凑十法 进位加",
              concept: "20 以内进位加法",
              story: {
                scenes: [
                  { emoji: "🐧🐟🐟🐟🐟🐟🐟🐟🐟 🐟🐟🐟", text: "小企鹅抓了 8 条鱼，妈妈又送来 5 条。一共几条？8 + 5 超过 10 了，有点难数……", sparkle: "别怕，有个魔法叫『凑十』！" },
                  { emoji: "📦✨", text: "先从 5 条里拿 2 条，把 8 条装满一个十格箱：8 + 2 = 10。箱子满啦！", sparkle: "先凑成一个十！" },
                  { emoji: "📦➕🐟🐟🐟", text: "10 条再加剩下的 3 条：10 + 3 = 13。看，凑十让加法变简单了！", sparkle: "8 + 5 = 8 + 2 + 3 = 13" }
                ]
              },
              explore: {
                type: "ten-frame",
                title: "装满十格箱",
                instruction: "👆 点一点，把箱子剩下的格子装满，凑成 10！",
                start: 7, target: 10, item: "🐟", fillItem: "🐟",
                wrapup: "7 + 3 = 10！先凑十，再加剩下的，算得又快又准。"
              },
              games: [
                {
                  id: "g1l4-g1",
                  title: "第 1 关 · 凑十热身",
                  icon: "🧊",
                  questions: [
                    { id: "q1", type: "input", prompt: "8 + ? = 10", answer: "2", hints: ["8 再添几就满 10？", "从 8 数到 10，还差几步？", "差 2。"] },
                    { id: "q2", type: "input", prompt: "9 + ? = 10", answer: "1", hints: ["9 只差一点点就满了", "10 比 9 大几？", "差 1。"] },
                    { id: "q3", type: "choice", prompt: "计算 9 + 4 时，先把 9 凑成 10，需要从 4 里拿几个？", options: ["1", "2", "3"], answer: "1", hints: ["9 添 1 就满 10", "从 4 里借几给 9？", "拿 1 个。"] }
                  ]
                },
                {
                  id: "g1l4-g2",
                  title: "第 2 关 · 凑十实战",
                  icon: "⚔️",
                  questions: [
                    { id: "q4", type: "input", visual: { emoji: "🐤🐤🐤🐤🐤🐤🐤🐤🐤 + 🐤🐤🐤" }, prompt: "9 + 3 = ?", answer: "12", hints: ["9 + 1 = 10，10 再加剩下的 2", "3 可以分成 1 和 2", "9 + 3 = 12。"] },
                    { id: "q5", type: "input", prompt: "8 + 5 = ?", answer: "13", hints: ["8 + 2 = 10，10 + 3 = ?", "5 分成 2 和 3", "等于 13。"] },
                    { id: "q6", type: "input", prompt: "7 + 6 = ?", answer: "13", hints: ["7 + 3 = 10，10 + 3 = ?", "6 分成 3 和 3", "等于 13。"] },
                    { id: "q7", type: "input", prompt: "6 + 6 = ?", answer: "12", hints: ["6 + 4 = 10，10 + 2 = ?", "6 分成 4 和 2", "等于 12。"] }
                  ]
                },
                {
                  id: "g1l4-g3",
                  title: "第 3 关 · 生活应用",
                  icon: "🛒",
                  questions: [
                    { id: "q8", type: "input", visual: { emoji: "🚌" }, prompt: "车上有 9 人，又上来 4 人，现在几人？", answer: "13", hints: ["9 + 4，先凑十", "9 + 1 = 10，10 + 3 = ?", "13 人。"] },
                    { id: "q9", type: "input", prompt: "小明做了 8 朵花，小红做了 6 朵，两人一共几朵？", answer: "14", hints: ["8 + 6，先凑十：8 + 2 = 10", "10 + 4 = ?", "14 朵。"] },
                    { id: "q10", type: "dragdrop", template: "5 + 8 = ⬜，因为 5 + ⬜ = 10，10 + 3 = ⬜", answer: ["13", "5", "13"], bank: ["13", "5", "15", "3", "10"], hints: ["8 可以分成 5 和 3", "5 + 5 = 10，10 + 3 = 13", "三个空都是 13、5、13。"] }
                  ]
                }
              ]
            },
            {
              id: "g1l5",
              icon: "💰",
              title: "认识人民币",
              concept: "元角分与等价换算",
              story: {
                scenes: [
                  { emoji: "🏪🤖", text: "闪闪带你逛小卖部！这里的商品要用人民币买：纸币有 1 元、5 元、10 元……硬币还有 1 角、5 角。", sparkle: "钱里的数学可不少！" },
                  { emoji: "💴➕🪙", text: "1 元 = 10 角。就像 10 个小格凑成一长条。买 5 角的棒棒糖，付 1 元要找回 5 角。", sparkle: "元和角是好朋友：10 角 = 1 元" },
                  { emoji: "🧮✨", text: "付钱时，我们用『凑』的方法：买 8 元的东西，可以付 5 元 + 2 元 + 1 元。组合方式不止一种哦！", sparkle: "一样的钱，可以有不同的组合" }
                ]
              },
              explore: {
                type: "balance",
                title: "钱钱天平",
                instruction: "👆 点击砝码放上天平，让左边和 8 元一样重（等价）！",
                leftLabel: "左边（元）", rightLabel: "目标：8 元",
                rightValue: 8, weights: [1, 2, 5],
                wrapup: "5 + 2 + 1 = 8！同样的 8 元，也能用 5 + 1 + 1 + 1 组合出来。"
              },
              games: [
                {
                  id: "g1l5-g1",
                  title: "第 1 关 · 元与角",
                  icon: "🪙",
                  questions: [
                    { id: "q1", type: "input", prompt: "1 元 = ? 角", answer: "10", hints: ["元是大哥，角是小弟", "10 个 1 角硬币才等于 1 元", "等于 10 角。"] },
                    { id: "q2", type: "choice", prompt: "买 6 角的橡皮，付 1 元，应找回几角？", options: ["2 角", "4 角", "6 角"], answer: "4 角", hints: ["付 10 角买 6 角的东西", "10 - 6 = ?", "找回 4 角。"] },
                    { id: "q3", type: "input", prompt: "5 角 + 5 角 = ? 元", answer: "1", hints: ["两个 5 角合起来", "5 + 5 = 10 角，10 角 = ?", "等于 1 元。"] }
                  ]
                },
                {
                  id: "g1l5-g2",
                  title: "第 2 关 · 购物小达人",
                  icon: "🛍️",
                  questions: [
                    { id: "q4", type: "input", visual: { emoji: "✏️2元 📒5元" }, prompt: "买一支铅笔和一本本子，一共要几元？", answer: "7", hints: ["把两样东西的价钱合起来", "2 + 5 = ?", "7 元。"] },
                    { id: "q5", type: "choice", prompt: "买 7 元的贴纸，付了 10 元，找回几元？", options: ["2 元", "3 元", "4 元"], answer: "3 元", hints: ["付的钱减去商品的价钱", "10 - 7 = ?", "找回 3 元。"] },
                    { id: "q6", type: "choice", prompt: "8 元的酸奶，用哪种付法刚好？（都有 5 元、2 元、1 元纸币若干）", options: ["5 + 2 + 1", "5 + 5", "2 + 2 + 2"], answer: "5 + 2 + 1", hints: ["算一算每种组合等于几元", "哪个组合正好等于 8？", "5 + 2 + 1 = 8。"] },
                    { id: "q7", type: "input", prompt: "一本故事书 12 元，你有 10 元，还差几元？", answer: "2", hints: ["书价减去你有的钱", "12 - 10 = ?", "差 2 元。"] }
                  ]
                }
              ]
            },
            {
              id: "g1l6",
              icon: "🕐",
              title: "认识钟表",
              concept: "整时与半时",
              story: {
                scenes: [
                  { emoji: "🕰️🏰", text: "时钟城堡里住着时针哥哥（短针）和分针弟弟（长针）。他们每天绕着圈跑，告诉我们时间。", sparkle: "短针看『时』，长针看『分』" },
                  { emoji: "🕐", text: "分针稳稳指着 12 时，就是『整点』！时针指着几，就是『几点整』。看：时针指 3，分针指 12 → 3 点整！", sparkle: "分针指 12，先读时针" },
                  { emoji: "🕧", text: "分针指着 6 时，是『半点』——走了一半！时针指在 4 和 5 中间，就是 4 点半。", sparkle: "分针指 6，时针过几就是几点半" }
                ]
              },
              explore: {
                type: "number-line",
                title: "拨一拨时针",
                instruction: "🕰️ 把时针从 3 点拨到 8 点，感受它走了多远！",
                min: 1, max: 12, step: 1, target: 8, marker: "🕰️", start: 3,
                wrapup: "从 3 走到 8，时针走了 5 大格，经过 5 个小时！钟面就是一圈 12 格的数轴。"
              },
              games: [
                {
                  id: "g1l6-g1",
                  title: "第 1 关 · 整点辨认",
                  icon: "🕐",
                  questions: [
                    { id: "q1", type: "choice", prompt: "分针指着 12，时针指着 5，是几点？", options: ["5 点整", "12 点整", "5 点半"], answer: "5 点整", hints: ["分针指 12 → 整点", "时针指几就是几点", "5 点整。"] },
                    { id: "q2", type: "choice", prompt: "分针指着 6，时针在 9 和 10 中间，是几点？", options: ["9 点半", "10 点半", "9 点整"], answer: "9 点半", hints: ["分针指 6 → 半点", "时针过了 9 还没到 10", "9 点半。"] },
                    { id: "q3", type: "input", prompt: "动画片 6 点开播，你 4 点吃完饭，还要等几小时？", answer: "2", hints: ["从 4 到 6，钟面上走了几大格？", "5、6，数一数", "等 2 小时。"] }
                  ]
                },
                {
                  id: "g1l6-g2",
                  title: "第 2 关 · 一天的安排",
                  icon: "📅",
                  questions: [
                    { id: "q4", type: "sequence", prompt: "把一天的事按时间先后排一排！", items: ["7点起床", "12点午饭", "8点上学"], answer: ["7点起床", "8点上学", "12点午饭"], hints: ["先比小时数：7、8、12 谁最早？", "起床 → 上学 → 午饭", "7点、8点、12点。"] },
                    { id: "q5", type: "choice", prompt: "1 小时后是 3 点整，现在是几点？", options: ["1 点", "2 点", "4 点"], answer: "2 点", hints: ["往回倒 1 小时", "3 的前面一个数", "2 点。"] },
                    { id: "q6", type: "choice", prompt: "现在 2 点半，再过半小时是几点？", options: ["3 点", "3 点半", "2 点"], answer: "3 点", hints: ["半点 + 半点 = 整点", "2 点半 → 3 点前分针走一半", "3 点整。"] }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};
