import { fingerFor, fingerNames } from '../data/lessons';

const rows = ['1234567890', 'qwertyuiop', "asdfghjkl;'", 'zxcvbnm,./'];
export function Keyboard({ target = '' }: { target?: string }) {
  const active = target === '!' ? '1' : target.toLowerCase();
  const finger = target ? fingerFor(target) : -1;
  const uppercase = /^[A-Z!]$/.test(target);
  return (
    <section className="keyboard-section" aria-label="键盘与指法提示">
      <div className="finger-hint">
        <span className={`finger-dot finger-${finger}`} />
        {target
          ? `${fingerNames[finger]} · ${target === ' ' ? '空格' : target.toUpperCase()}`
          : '双手轻轻回到基准行'}
        {uppercase && <span>＋ {finger <= 3 ? '右' : '左'}手 Shift</span>}
      </div>
      <div className="keyboard" aria-hidden="true">
        {uppercase && <div className="shift-hint">Shift {target === '!' ? '+ 1' : '+ 字母'}</div>}
        {rows.map((row, index) => (
          <div className={`key-row row-${index}`} key={row}>
            {[...row].map((key) => (
              <span
                key={key}
                className={`key finger-${fingerFor(key)} ${active === key ? 'target' : ''} ${key === 'f' || key === 'j' ? 'home-key' : ''}`}
              >
                {key.toUpperCase()}
              </span>
            ))}
          </div>
        ))}
        <div className="key-row">
          <span className={`key space-key finger-8 ${active === ' ' ? 'target' : ''}`}>空格</span>
        </div>
      </div>
      <div className="hands" aria-label="手指分工">
        {fingerNames.map((name, index) => (
          <span key={name} className={`finger-label ${index === finger ? 'selected' : ''}`}>
            <i className={`finger-dot finger-${index}`} />
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}
