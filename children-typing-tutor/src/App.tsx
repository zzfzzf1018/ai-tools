import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Cloud as CloudCheck,
  Compass,
  Flag,
  Flower2,
  Gamepad2,
  Keyboard as KeyboardIcon,
  Leaf,
  LockKeyhole,
  Map,
  Medal,
  Settings,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { chapters, knownKeys, lessons, practiceText, type Lesson } from './data/lessons';
import {
  award,
  defaultProgress,
  loadProgress,
  localDay,
  passedCount,
  saveProgress,
  STORAGE_KEY,
  type Progress,
} from './lib/progress';
import { accuracy, createSessionId, type Session } from './lib/typing';
import { TypingExercise, type Activity } from './components/TypingExercise';
import { Keyboard } from './components/Keyboard';

const storage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};
type View = 'learn' | 'practice' | 'games' | 'progress';
const nav = [
  { id: 'learn', title: '学习地图', icon: Map },
  { id: 'practice', title: '自由练习', icon: KeyboardIcon },
  { id: 'games', title: '趣味乐园', icon: Gamepad2 },
  { id: 'progress', title: '我的成长', icon: Trophy },
] as const;
const chapterIcons = [Compass, Sprout, Leaf, Flower2, Flag];

export function App() {
  const [initial] = useState(() => loadProgress(storage));
  const [progress, setProgress] = useState(initial.data);
  const [warning, setWarning] = useState(initial.warning);
  const saved = useRef(initial.data);
  const [view, setView] = useState<View>('learn');
  const [intro, setIntro] = useState<Lesson | null>(null);
  const [introStep, setIntroStep] = useState(0);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [completedId, setCompletedId] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const settingsPanel = useRef<HTMLElement>(null);
  const [reset, setReset] = useState(false);
  const [kind, setKind] = useState<'letters' | 'words' | 'sentences'>('letters');
  const [limit, setLimit] = useState(0);
  const [offline, setOffline] = useState(
    location.protocol === 'file:'
      ? '桌面离线版'
      : import.meta.env.DEV
        ? '网页练习版'
        : 'serviceWorker' in navigator && 'caches' in window
          ? '准备离线资源'
          : '在线学习中',
  );
  const [updateReady, setUpdateReady] = useState(false);
  const updateApp = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const passed = passedCount(progress);
  const nextLesson = lessons[Math.min(passed, lessons.length - 1)];
  const totalStars = Object.values(progress.lessons).reduce((sum, lesson) => sum + lesson.stars, 0);
  const today = progress.days[localDay()] ?? 0;
  const busy = activity !== null || intro !== null;
  const unfinished = intro !== null || (activity !== null && activity.id !== completedId);

  useEffect(() => {
    if (saved.current === progress) return;
    const error = saveProgress(storage, progress);
    setWarning(error);
    saved.current = progress;
  }, [progress]);

  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== STORAGE_KEY && event.key !== null))
        return;
      const current = loadProgress(storage);
      saved.current = current.data;
      setProgress(current.data);
      setWarning(current.warning);
    };
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, []);

  useEffect(() => {
    if (
      location.protocol === 'file:' ||
      import.meta.env.DEV ||
      !('serviceWorker' in navigator) ||
      !('caches' in window)
    )
      return;
    let disposed = false;
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (disposed) return;
        const checkOffline = async () => {
          const entry = await caches.match(new URL('index.html', location.href).href, {
            ignoreSearch: true,
          });
          if (!disposed) setOffline(entry ? '已可离线学习' : '在线学习中');
        };
        updateApp.current = registerSW({
          onOfflineReady: () => {
            void checkOffline().catch(() => {
              if (!disposed) setOffline('在线学习中');
            });
          },
          onNeedRefresh: () => {
            if (!disposed) setUpdateReady(true);
          },
          onRegisteredSW: () => {
            void navigator.serviceWorker.ready.then(checkOffline).catch(() => {
              if (!disposed) setOffline('在线学习中');
            });
          },
          onRegisterError: () => {
            if (!disposed) setOffline('在线学习中');
          },
        });
      })
      .catch(() => {
        if (!disposed) setOffline('在线学习中');
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!unfinished) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [unfinished]);

  useEffect(() => {
    if (!settings) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    settingsPanel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [settings]);

  useEffect(() => {
    if (settings && !settingsPanel.current?.contains(document.activeElement))
      settingsPanel.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [settings, reset]);

  function navigate(target: View) {
    if (unfinished && !window.confirm('离开后，这次未完成的练习将重新开始。确定离开吗？')) return;
    setActivity(null);
    setIntro(null);
    setView(target);
  }
  function openLesson(lesson: Lesson) {
    if (lesson.id > passed + 1) return;
    setIntro(lesson);
    setIntroStep(0);
    setActivity(null);
  }
  function startLesson(lesson: Lesson, phase: 'guided' | 'checkpoint') {
    setIntro(null);
    setActivity({
      id: createSessionId(),
      title: lesson.title,
      text: phase === 'guided' ? lesson.guided : lesson.checkpoint,
      lessonId: lesson.id,
      phase,
    });
  }
  function complete(session: Session) {
    setCompletedId(session.id);
    if (activity?.phase === 'guided') return;
    const percent = accuracy(session);
    if (percent === null) return;
    setProgress((previous) =>
      award(previous, {
        id: session.id,
        accuracy: percent,
        seconds: session.elapsed / 1000,
        lessonId: activity?.lessonId,
        game: !!activity?.game,
      }),
    );
  }
  function nextActivity() {
    if (activity?.lessonId && activity.phase === 'guided')
      startLesson(lessons[activity.lessonId - 1], 'checkpoint');
    else {
      setActivity(null);
      setIntro(null);
    }
  }
  function startPractice() {
    const base = practiceText(kind);
    setActivity({
      id: createSessionId(),
      title: `${kind === 'letters' ? '字母' : kind === 'words' ? '单词' : '短句'}练习`,
      text: limit ? Array.from({ length: 60 }, () => base).join(' ') : base,
      limit,
    });
  }
  function startGame(game: 'trail' | 'balloons') {
    const text = practiceText(game === 'trail' ? 'letters' : 'words', knownKeys(passed));
    setActivity({
      id: createSessionId(),
      title: game === 'trail' ? '兔兔去旅行' : '放飞单词气球',
      text,
      game,
    });
  }
  function toggleSetting(key: keyof Progress['settings']) {
    setProgress((previous) => ({
      ...previous,
      settings: { ...previous.settings, [key]: !previous.settings[key] },
    }));
  }

  return (
    <div className={`app ${progress.settings.reducedMotion ? 'reduce-motion' : ''}`}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate('learn');
          }}
        >
          <span className="brand-mark">
            <Sprout size={28} strokeWidth={2.5} />
          </span>
          <span>
            打字小岛<small>TYPING ISLAND</small>
          </span>
        </a>
        <div className="sidebar-label">我的小小冒险</div>
        <nav aria-label="主导航">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={21} />
              <span>{item.title}</span>
              {view === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-friend">
          <img src="./assets/bunny.svg" alt="小岛伙伴兔兔" />
          <strong>慢慢来，也很棒。</strong>
          <p>兔兔一直陪着你</p>
          <div className="friend-leaves">
            <Leaf size={17} />
            <span>每天一点点进步</span>
          </div>
        </div>
        <button className="nav-item settings-link" onClick={() => setSettings(true)}>
          <Settings size={20} />
          小岛设置
        </button>
        <div className="privacy">
          <ShieldCheck size={14} />
          无广告 · 不需要注册
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            我的小岛 <ChevronRight size={14} />
            <span>{nav.find((item) => item.id === view)?.title}</span>
          </div>
          <div className="topbar-right">
            <span className="offline-status">
              <CloudCheck size={16} />
              {offline}
            </span>
            {updateReady && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  void updateApp.current?.(true);
                }}
              >
                更新版本
              </button>
            )}
            <button
              className="icon-button"
              title={progress.settings.sound ? '关闭声音' : '开启声音'}
              aria-label={progress.settings.sound ? '关闭声音' : '开启声音'}
              onClick={() => toggleSetting('sound')}
            >
              {progress.settings.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button
              className="avatar"
              title="小岛设置"
              aria-label="小岛设置"
              onClick={() => setSettings(true)}
            >
              <Sprout size={23} />
            </button>
          </div>
        </header>
        {warning && (
          <div className="save-warning" role="alert">
            {warning}
          </div>
        )}
        <main>
          {busy && (
            <button className="back-button" onClick={() => navigate(view)}>
              <ArrowLeft size={17} />
              返回{nav.find((item) => item.id === view)?.title}
            </button>
          )}
          {activity ? (
            <TypingExercise
              key={activity.id}
              activity={activity}
              sound={progress.settings.sound}
              onComplete={complete}
              onNext={nextActivity}
              onRetry={() => {
                if (window.confirm('要重新开始这次练习吗？'))
                  setActivity({ ...activity, id: createSessionId() });
              }}
            />
          ) : intro ? (
            <section className="lesson-intro">
              <div className="lesson-intro-copy">
                <span className="eyebrow">
                  LESSON {String(intro.id).padStart(2, '0')} · {chapters[intro.chapter]}
                </span>
                <h1>{intro.title}</h1>
                <p className="intro-instruction">
                  {intro.id === 1
                    ? [
                        intro.instruction,
                        intro.tip,
                        '让左手找到键盘左边，右手找到右边。准备好了，我们一起找 F 和 J！',
                      ][introStep]
                    : intro.instruction}
                </p>
                <p className="intro-tip">
                  <Sparkles size={18} />
                  {intro.id === 1 ? '放轻松，这一课不计分，也不计时。' : intro.tip}
                </p>
                <div className="lesson-steps">
                  <span className="selected">认识按键</span>
                  <ChevronRight size={15} />
                  <span>跟着练</span>
                  <ChevronRight size={15} />
                  <span>自己试试</span>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    if (intro.id !== 1) startLesson(intro, 'guided');
                    else if (introStep < 2) setIntroStep(introStep + 1);
                    else {
                      setProgress((previous) =>
                        award(previous, {
                          id: createSessionId(),
                          accuracy: 100,
                          seconds: 0,
                          lessonId: 1,
                        }),
                      );
                      setIntro(lessons[1]);
                      setIntroStep(0);
                    }
                  }}
                >
                  {intro.id === 1
                    ? ['坐好啦，下一步', '找到空格了', '出发，去找 F 和 J'][introStep]
                    : '开始跟练'}
                  <ArrowRight size={18} />
                </button>
              </div>
              <img className="intro-mascot" src="./assets/bunny.svg" alt="兔兔老师" />
              <Keyboard target={intro.keys[0] ?? ''} />
            </section>
          ) : (
            <>
              {view === 'learn' && (
                <>
                  <section className="page-heading">
                    <div>
                      <div className="eyebrow">LET'S GROW, LITTLE EXPLORER</div>
                      <h1>今天，也要前进一小步。</h1>
                      <p>你好，小小探险家！兔兔在小岛等你。</p>
                    </div>
                    <span className="date-badge">
                      <Leaf size={17} />
                      新的冒险日
                    </span>
                  </section>
                  <div className="dashboard-grid">
                    <div className="learning-content">
                      <section className="map-section">
                        <div className="section-title">
                          <h2>
                            <Map size={19} />
                            我的学习地图
                          </h2>
                          <span>已解锁 {Math.min(20, passed + 1)} / 20 课</span>
                        </div>
                        <div className="island-map">
                          <img
                            className="island-art"
                            src="./assets/island.svg"
                            alt="有小屋、树林和花园的学习小岛"
                          />
                          <div className="map-chapters">
                            {chapters.map((chapter, index) => {
                              const first = lessons.find((lesson) => lesson.chapter === index)!;
                              const available = first.id <= passed + 1;
                              const Icon = chapterIcons[index];
                              return (
                                <button
                                  key={chapter}
                                  className={`map-stop stop-${index} ${available ? 'available' : ''}`}
                                  disabled={!available}
                                  onClick={() => openLesson(first)}
                                >
                                  <span className="stop-icon">
                                    {available ? <Icon size={25} /> : <LockKeyhole size={21} />}
                                  </span>
                                  <strong>{chapter}</strong>
                                  <small>
                                    {index === 0 ? '从这里出发' : `第 ${first.id} 课起`}
                                  </small>
                                </button>
                              );
                            })}
                          </div>
                          <img
                            className="map-bunny"
                            src="./assets/bunny.svg"
                            alt="等待出发的兔兔"
                          />
                        </div>
                        <div className="continue-strip">
                          <div>
                            <span className="tiny-label">
                              {passed === 20 ? '再次出发' : '下一站'}
                            </span>
                            <strong>
                              {String(nextLesson.id).padStart(2, '0')} · {nextLesson.title}
                            </strong>
                          </div>
                          <button className="primary" onClick={() => openLesson(nextLesson)}>
                            {passed ? '继续学习' : '开始冒险'}
                            <ArrowRight size={18} />
                          </button>
                        </div>
                      </section>
                      <section className="course-section">
                        <div className="section-title">
                          <h2>
                            <BookOpen size={19} />
                            小岛课程
                          </h2>
                          <span>准确率达到 85% 解锁下一课</span>
                        </div>
                        {chapters.map((chapter, chapterIndex) => (
                          <div className="chapter-group" key={chapter}>
                            <h3>
                              <span>{String(chapterIndex + 1).padStart(2, '0')}</span>
                              {chapter}
                            </h3>
                            <div className="lesson-grid">
                              {lessons
                                .filter((lesson) => lesson.chapter === chapterIndex)
                                .map((lesson) => {
                                  const available = lesson.id <= passed + 1;
                                  const result = progress.lessons[lesson.id];
                                  return (
                                    <button
                                      key={lesson.id}
                                      className={`lesson-tile ${lesson.id === passed + 1 ? 'next-lesson' : ''}`}
                                      disabled={!available}
                                      onClick={() => openLesson(lesson)}
                                    >
                                      <span
                                        className={`lesson-number ${result?.stars ? 'completed' : ''}`}
                                      >
                                        {result?.stars ? (
                                          <Check size={17} />
                                        ) : available ? (
                                          String(lesson.id).padStart(2, '0')
                                        ) : (
                                          <LockKeyhole size={15} />
                                        )}
                                      </span>
                                      <span className="lesson-info">
                                        <strong>{lesson.title}</strong>
                                        <small>
                                          {result
                                            ? `${Math.floor(result.accuracy)}% 准确率`
                                            : lesson.id === 1
                                              ? '轻松认识键盘'
                                              : '示范 · 跟练 · 小测'}
                                        </small>
                                      </span>
                                      <span
                                        className="tile-stars"
                                        aria-label={`${result?.stars ?? 0}颗星`}
                                      >
                                        {[1, 2, 3].map((star) => (
                                          <Star
                                            size={10}
                                            key={star}
                                            fill={
                                              star <= (result?.stars ?? 0) ? 'currentColor' : 'none'
                                            }
                                          />
                                        ))}
                                      </span>
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        ))}
                      </section>
                    </div>
                    <aside className="growth-sidebar">
                      <section className="daily-goal">
                        <span className="eyebrow">A LITTLE EVERY DAY</span>
                        <h2>
                          今天的小目标
                          <Target size={20} />
                        </h2>
                        <div
                          className="goal-ring"
                          style={
                            { '--goal': `${Math.min(today / 3, 1) * 100}%` } as React.CSSProperties
                          }
                        >
                          <span>
                            <strong>
                              {Math.min(today, 3)}
                              <small>/3</small>
                            </strong>
                            <span>次练习</span>
                          </span>
                        </div>
                        <p>
                          {today >= 3
                            ? '今天的目标完成啦！休息一下吧。'
                            : '不比快，认真完成就很棒。'}
                        </p>
                        <div className="goal-days">
                          {'一二三四五六日'.split('').map((day, index) => (
                            <span
                              key={day}
                              className={
                                (new Date().getDay() + 6) % 7 === index && today > 0 ? 'today' : ''
                              }
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      </section>
                      <section className="pocket">
                        <h2>
                          <Star size={19} />
                          星星口袋
                        </h2>
                        <strong>
                          {totalStars}
                          <small> / 60</small>
                        </strong>
                        <p>每一点进步，都闪闪发亮。</p>
                      </section>
                      <section className="little-tip">
                        <span className="tip-icon">
                          <Sprout size={23} />
                        </span>
                        <h3>兔兔的小提醒</h3>
                        <p>手指轻轻弯，肩膀放松。练累了，看看窗外的绿色吧。</p>
                      </section>
                      <div className="keyboard-note">
                        <KeyboardIcon size={18} />
                        <span>使用电脑键盘，和手指一起学习。</span>
                      </div>
                    </aside>
                  </div>
                </>
              )}

              {view === 'practice' && (
                <>
                  <PageHeading
                    eyebrow="MAKE A LITTLE PROGRESS"
                    title="手指，来热热身。"
                    text="选一份喜欢的练习，按自己的节奏出发。"
                  />
                  <section className="practice-setup">
                    <div>
                      <h2>今天练什么？</h2>
                      <div className="segmented" aria-label="练习内容">
                        {(['letters', 'words', 'sentences'] as const).map((value) => (
                          <button
                            key={value}
                            aria-pressed={kind === value}
                            onClick={() => setKind(value)}
                          >
                            {value === 'letters' ? '字母' : value === 'words' ? '单词' : '短句'}
                          </button>
                        ))}
                      </div>
                      <h3>练习时长</h3>
                      <div className="segmented" aria-label="练习时长">
                        {[0, 60, 180].map((value) => (
                          <button
                            key={value}
                            aria-pressed={limit === value}
                            onClick={() => setLimit(value)}
                          >
                            {value ? `${value / 60} 分钟` : '不限时'}
                          </button>
                        ))}
                      </div>
                      <p className="practice-sample">{practiceText(kind).slice(0, 70)}</p>
                      <button className="primary" onClick={startPractice}>
                        <PlayIcon />
                        开始练习
                        <ArrowRight size={17} />
                      </button>
                    </div>
                    <img src="./assets/bunny.svg" alt="准备练习的兔兔" />
                  </section>
                  <section className="practice-advice">
                    <Sprout size={23} />
                    <div>
                      <h3>第一次来小岛？</h3>
                      <p>先从学习地图出发，和兔兔认识键盘与手指。</p>
                      <button className="text-button" onClick={() => navigate('learn')}>
                        去学习地图
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </section>
                </>
              )}

              {view === 'games' && (
                <>
                  <PageHeading
                    eyebrow="A PLAYFUL LITTLE BREAK"
                    title="字母，也爱玩游戏。"
                    text="带上学过的按键，和兔兔来一场轻松冒险。"
                  />
                  <div className="game-grid">
                    <section className="game-card">
                      <div className="game-cover trail-cover">
                        <img
                          className="game-cover-scene"
                          src="./assets/island.svg"
                          alt="小岛探险路线"
                        />
                        <img className="game-cover-bunny" src="./assets/bunny.svg" alt="旅行兔兔" />
                      </div>
                      <div className="game-copy">
                        <span className="eyebrow">LETTER ADVENTURE</span>
                        <h2>兔兔去旅行</h2>
                        <p>一步一个字母，陪兔兔走到小屋。</p>
                        <button className="primary" onClick={() => startGame('trail')}>
                          出发去旅行
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    </section>
                    <section className="game-card">
                      <div className="game-cover balloon-cover">
                        <div className="balloon balloon-one">
                          <span>A</span>
                        </div>
                        <div className="balloon balloon-two">
                          <span>B</span>
                        </div>
                        <div className="balloon balloon-three">
                          <span>C</span>
                        </div>
                        <img src="./assets/bunny.svg" alt="等待气球的兔兔" />
                      </div>
                      <div className="game-copy">
                        <span className="eyebrow">WORD BALLOONS</span>
                        <h2>放飞单词气球</h2>
                        <p>敲出小小单词，让气球飞向天空。</p>
                        <button className="primary coral" onClick={() => startGame('balloons')}>
                          一起放气球
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    </section>
                  </div>
                  <p className="soft-note">
                    <ShieldCheck size={17} />
                    只使用已解锁课程的按键，没有倒计时，也不会扣生命。
                  </p>
                </>
              )}

              {view === 'progress' && (
                <>
                  <PageHeading
                    eyebrow="LOOK HOW FAR YOU'VE GROWN"
                    title="每一小步，都算数。"
                    text="这是你的成长足迹，不用和别人比较。"
                  />
                  <div className="growth-stats">
                    <Stat icon={<BookOpen />} value={`${passed} / 20`} label="完成课程" />
                    <Stat icon={<Star />} value={String(totalStars)} label="收集星星" />
                    <Stat
                      icon={<KeyboardIcon />}
                      value={String(progress.rounds)}
                      label="完成练习"
                    />
                    <Stat
                      icon={<Target />}
                      value={`${Math.floor(progress.seconds / 60)}`}
                      label="累计练习 / 分钟"
                    />
                  </div>
                  <section className="badges-section">
                    <div className="section-title">
                      <h2>
                        <Medal size={20} />
                        我的小岛勋章
                      </h2>
                      <span>每枚勋章只领取一次</span>
                    </div>
                    <div className="badge-grid">
                      {[
                        {
                          title: '勇敢启航',
                          text: '完成键盘认识课',
                          active: passed >= 1,
                          icon: Compass,
                        },
                        {
                          title: '手指归位',
                          text: '完成基准键小岛',
                          active: passed >= 7,
                          icon: Sprout,
                        },
                        {
                          title: '字母探险家',
                          text: '学完全部字母',
                          active: passed >= 16,
                          icon: Leaf,
                        },
                        {
                          title: '游戏好伙伴',
                          text: '完成一次趣味挑战',
                          active: progress.games >= 1,
                          icon: Gamepad2,
                        },
                        {
                          title: '星光收藏家',
                          text: '收集 15 颗星星',
                          active: totalStars >= 15,
                          icon: Star,
                        },
                        {
                          title: '小小打字家',
                          text: '完成全部 20 课',
                          active: passed === 20,
                          icon: Trophy,
                        },
                      ].map((badge) => (
                        <div key={badge.title} className={`badge ${badge.active ? 'earned' : ''}`}>
                          <span className="badge-icon">
                            <badge.icon size={32} />
                          </span>
                          <h3>{badge.title}</h3>
                          <p>{badge.text}</p>
                          <small>{badge.active ? '已获得' : '等待点亮'}</small>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="history-section">
                    <h2>最近的学习足迹</h2>
                    {Object.keys(progress.days).length ? (
                      <div className="history-list">
                        {Object.entries(progress.days)
                          .sort(([first], [second]) => second.localeCompare(first))
                          .slice(0, 7)
                          .map(([day, rounds]) => (
                            <div key={day}>
                              <span>{day}</span>
                              <span>{rounds} 次练习</span>
                              <span className="history-stars">
                                <Star size={15} fill="currentColor" />
                                认真练习的一天
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <Sprout size={32} />
                        <p>第一枚脚印，等你来留下。</p>
                        <button className="text-button" onClick={() => navigate('learn')}>
                          开始第一课
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}
          <footer>
            <Sprout size={14} />
            小小手指，慢慢长大。<span>Typing Island</span>
          </footer>
        </main>
      </div>
      {settings && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setSettings(false);
            setReset(false);
          }}
        >
          <section
            ref={settingsPanel}
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label="小岛设置"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Tab') {
                const controls = [
                  ...event.currentTarget.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), input:not(:disabled)',
                  ),
                ];
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
              if (event.key === 'Escape') {
                setSettings(false);
                setReset(false);
              }
            }}
          >
            <div className="section-title">
              <h2>
                <Settings size={20} />
                小岛设置
              </h2>
              <button
                className="icon-button"
                title="关闭设置"
                aria-label="关闭设置"
                onClick={() => {
                  setSettings(false);
                  setReset(false);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <label className="setting-row">
              <span>
                <strong>轻柔按键音</strong>
                <small>正确按键时播放提示音</small>
              </span>
              <input
                type="checkbox"
                checked={progress.settings.sound}
                onChange={() => toggleSetting('sound')}
              />
            </label>
            <label className="setting-row">
              <span>
                <strong>减少动态效果</strong>
                <small>让小岛安静一点</small>
              </span>
              <input
                type="checkbox"
                checked={progress.settings.reducedMotion}
                onChange={() => toggleSetting('reducedMotion')}
              />
            </label>
            <p className="settings-privacy">
              <ShieldCheck size={19} />
              学习记录只保存在当前设备。清理浏览器数据会丢失记录，网页版与桌面版暂不同步。
            </p>
            <div className="reset-section">
              {reset ? (
                <>
                  <p>将清除全部课程记录、星星和设置，无法撤销。</p>
                  <div className="button-row">
                    <button className="secondary" onClick={() => setReset(false)}>
                      取消
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        setProgress(defaultProgress());
                        setActivity(null);
                        setIntro(null);
                        setReset(false);
                        setSettings(false);
                        setView('learn');
                      }}
                    >
                      确认清除记录
                    </button>
                  </div>
                </>
              ) : (
                <button className="text-button danger-text" onClick={() => setReset(true)}>
                  重新开始整个小岛
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PageHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <section className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </section>
  );
}
function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="growth-stat">
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}
function PlayIcon() {
  return <KeyboardIcon size={18} />;
}
