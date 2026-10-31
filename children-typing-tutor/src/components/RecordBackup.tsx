import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  BACKUP_MAX_BYTES,
  exportBackup,
  localDay,
  passedCount,
  readBackup,
  type Progress,
} from '../lib/progress';

export function RecordBackup({
  data,
  onImport,
}: {
  data: Progress;
  onImport: (incoming: Progress) => string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const request = useRef(0);
  const downloadUrl = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<ReturnType<typeof readBackup> | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  useEffect(
    () => () => {
      request.current++;
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
    },
    [],
  );
  useEffect(() => {
    if (pending) cancelButton.current?.focus();
    else if (!loading && restoreFocus.current) {
      importButton.current?.focus();
      restoreFocus.current = false;
    }
  }, [pending, loading]);

  function download() {
    try {
      const text = exportBackup(data);
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      downloadUrl.current = url;
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Typing-Island-backup-${localDay()}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setNotice({ text: '备份下载已发起。', error: false });
    } catch (error) {
      setNotice({
        text:
          error instanceof Error && error.message.includes('1 MiB')
            ? error.message
            : '无法生成备份文件，请重试。',
        error: true,
      });
    }
  }

  async function select(file?: File) {
    if (!file) return;
    const token = ++request.current;
    restoreFocus.current = true;
    setLoading(true);
    setPending(null);
    setNotice(null);
    try {
      if (file.size > BACKUP_MAX_BYTES) throw new Error('备份文件不能超过 1 MiB。');
      const incoming = readBackup(await file.text());
      if (token === request.current) setPending(incoming);
    } catch (error) {
      if (token === request.current)
        setNotice({
          text: error instanceof Error ? error.message : '无法读取备份文件。',
          error: true,
        });
    } finally {
      if (token === request.current) setLoading(false);
    }
  }

  return (
    <section className="record-backup" aria-label="记录备份">
      <h3>记录备份</h3>
      <div className="button-row backup-actions">
        <button className="secondary" onClick={download} disabled={loading}>
          <Download size={17} />
          导出记录
        </button>
        <button
          ref={importButton}
          className="secondary"
          onClick={() => input.current?.click()}
          disabled={loading || pending !== null}
        >
          <Upload size={17} />
          导入记录
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        aria-label="选择备份文件"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          void select(file);
        }}
      />
      {loading && <p role="status">正在读取备份…</p>}
      {pending && (
        <section className="backup-preview" aria-label="备份预览">
          <dl>
            <div>
              <dt>已完成课程</dt>
              <dd>{passedCount(pending.data)} / 20</dd>
            </div>
            <div>
              <dt>完成练习</dt>
              <dd>{pending.data.rounds} 次</dd>
            </div>
            <div>
              <dt>已记录按键</dt>
              <dd>{Object.keys(pending.data.keyStats).length} 个</dd>
            </div>
            <div>
              <dt>备份日期</dt>
              <dd>
                {pending.createdAt
                  ? new Date(pending.createdAt).toLocaleDateString('zh-CN')
                  : '原始学习记录'}
              </dd>
            </div>
          </dl>
          <p>确认后将替换当前全部记录与设置，无法撤销。请先保留当前备份。</p>
          <div className="button-row">
            <button
              ref={cancelButton}
              className="secondary"
              onClick={() => {
                setPending(null);
                setNotice(null);
              }}
            >
              取消导入
            </button>
            <button
              className="primary"
              onClick={() => {
                const error = onImport(pending.data);
                if (error) setNotice({ text: error, error: true });
                else {
                  setPending(null);
                  setNotice({ text: '记录已恢复。', error: false });
                }
              }}
            >
              确认替换记录
            </button>
          </div>
        </section>
      )}
      {notice && (
        <p
          className={`backup-notice ${notice.error ? 'backup-error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.text}
        </p>
      )}
    </section>
  );
}
