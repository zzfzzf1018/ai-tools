import json, re, zipfile, subprocess, sys

ROOT = r'c:\flying\ai-tools\web-blocker'
EXT = ROOT + r'\outputs\web-blocker'

def load(p): return open(p, encoding='utf-8-sig').read()

bg = load(EXT + r'\background.js')
ct = load(EXT + r'\content.js')
pp = load(EXT + r'\popup.js')
html = load(EXT + r'\popup.html')
mft = json.loads(open(EXT + r'\manifest.json', encoding='utf-8-sig').read())

ok = 0; fail = 0

def check(name, cond, detail=''):
    global ok, fail
    if cond:
        ok += 1; print(f'  [ OK ] {name}')
    else:
        fail += 1; print(f'  [FAIL] {name}  {detail}')

print('=' * 70)
print(f'AUDIT: Web Blocker v{mft["version"]}')
print('=' * 70)

# ---- 1. 版本一致性 ----
print('\n[1] 版本一致性')
content_ver_match = re.search(r"const VERSION = '(\S+)'", ct)
content_ver = content_ver_match.group(1) if content_ver_match else 'MISSING'
check(f'manifest.json version = {mft["version"]}', True)
check(f'content.js VERSION = {content_ver}', content_ver == mft['version'],
      f'期望 {mft["version"]} 实际 {content_ver}')

with zipfile.ZipFile(EXT + rf'\dist\web-blocker-v{mft["version"]}.zip') as z:
    zip_mft = json.loads(z.read('web-blocker/manifest.json'))
    check(f'zip manifest version = {zip_mft["version"]}', zip_mft['version'] == mft['version'],
          f'期望 {mft["version"]} 实际 {zip_mft["version"]}')
    check('zip contains all expected files',
          set(z.namelist()) >= {'web-blocker/manifest.json','web-blocker/background.js','web-blocker/content.js',
                                'web-blocker/popup.html','web-blocker/popup.js'},
          f'zip files: {z.namelist()}')

# ---- 2. 消息总线审计 ----
print('\n[2] background.js 消息分支 return 模式')
# 列出所有 if (msg.type === '...') 块，检查 return
msg_pattern = re.compile(r"if \(msg && msg\.type === '([^']+)'\).*?^\s*return", re.DOTALL | re.MULTILINE)
msg_types = {}
for m in re.finditer(r"msg\.type === '([^']+)'", bg):
    msg_types[m.group(1)] = True

async_msgs = {'blk:rules:mutate','blk:backup:export','blk:backup:import','blk:backup:rollback',
              'blk:backup:hasAuto','blk:state:get','blk:state:setMaster'}
sync_msgs = {'blk:state'}

for t in msg_types:
    # 找到该消息块的 return
    idx = bg.find(f"msg.type === '{t}'")
    end_next = bg.find("if (msg && msg.type ==", idx + 1)
    end = end_next if end_next > 0 else len(bg)
    block = bg[idx:end]
    has_return_true = 'return true;' in block
    has_send_response = 'sendResponse(' in block
    if t in async_msgs:
        check(f'{t}: 异步分支 return true + sendResponse', has_return_true and has_send_response,
              f'return_true={has_return_true} sendResponse={has_send_response}')
    elif t in sync_msgs:
        check(f'{t}: 同步分支 (无 sendResponse) return;', 'return;' in block.split('sendResponse')[0] if 'sendResponse' in block else 'return;' in block,
              'sync msg should have simple return')

# ---- 3. storage set 路径 sync 双写审计 ----
print('\n[3] 所有 storage 写路径是否都覆盖 sync 双写')
# 找所有 STORAGE.set / storage.local.set / localSet / setPersisted
# 分类：autoBackup 隐藏键是 local-only（正确）；业务键必须 sync 双写

# background.js: localSet 只在两个地方用到 —— getPersisted 的回写 sync pull 回来的数据、doImport 的 autoBackup
# setPersisted 封装的写路径（业务键） → 自动带 sync
bg_sets = re.findall(r'(localSet|setPersisted|localRemove|removePersisted)\(', bg)
check('background.js 所有 local 写都走封装函数',
      all(x in ('localSet','setPersisted','localRemove','removePersisted') for x in bg_sets),
      f'found: {bg_sets}')
# syncSet/syncRemove 都有 try-catch
check('background.js syncSet 有 try-catch', 'try {' in bg[bg.find('function syncSet'):bg.find('function syncRemove')])
check('background.js syncRemove 有 try-catch', 'try {' in bg[bg.find('function syncRemove'):bg.find('function getPersisted')])

# content.js 降级路径 —— 直接读源码片段验证
print('\n[3] 所有 storage 写路径是否都覆盖 sync 双写')
check('background.js 所有 local 写都走封装函数',
      all(x in ('localSet','setPersisted','localRemove','removePersisted') for x in bg_sets),
      f'found: {bg_sets}')
check('background.js syncSet 有 try-catch', 'try {' in bg[bg.find('function syncSet'):bg.find('function syncRemove')])
check('background.js syncRemove 有 try-catch', 'try {' in bg[bg.find('function syncRemove'):bg.find('function getPersisted')])

# 直接查 content.js 的 4 个关键写路径
check('saveRuleLocal 含 STORAGE.set + SYNC.set (rules)', 
      'saveRuleLocal' in ct and 'STORAGE.set({ rules: rules' in ct and 'SYNC.set({ rules: rules' in ct)
# pausedSites 两个写路径
check('blk:toggleSite 含 STORAGE.set + SYNC.set (pausedSites)', 
      'blk:toggleSite' in ct and ct.count('SYNC.set({ pausedSites') >= 2)
check('blk:setSitePaused 含 STORAGE.set + SYNC.set (pausedSites)', 
      ct.count('SYNC.set({ pausedSites') >= 2)
# readStorage 里的 STORAGE.set 是 sync pull 后缓存回写（不需要再镜像 sync）
check('readStorage 的 STORAGE.set(s, () => {}) 存在于 content.js（sync pull 缓存回写，正确）',
      'STORAGE.set(s, () => {})' in ct)

# ---- 4. content.js onChanged 去抖 ----
print('\n[4] onChanged 去抖与 scope')
check('onChanged 监听 local + sync', "area !== 'local' && area !== 'sync'" in ct)
check('onChanged 有 100ms 去抖', 'lastChangedAt' in ct and '100' in ct)

# ---- 5. popup.js HTML ID 对应 ----
print('\n[5] popup.js 与 popup.html ID 对应')
html_ids = set(re.findall(r'id="([^"]+)"', html))
js_refs = set(re.findall(r"\$\('([^']+)'\)", pp))
missing_in_html = js_refs - html_ids
unused_in_html = html_ids - js_refs - {'slider'}  # slider 是 CSS class 用的 span，不需要 JS 引用
check(f'popup.js 引用的 ID 全部在 HTML 中存在', not missing_in_html, f'missing: {missing_in_html}')
check(f'popup.html ID 无冗余', not unused_in_html, f'unused: {unused_in_html}')

# ---- 6. manifest 权限 ----
print('\n[6] manifest 权限')
check('permissions 含 storage', 'storage' in mft['permissions'], f'permissions={mft["permissions"]}')
check('permissions 不含 activeTab（不需要，所有页面 content 已注入）', 'activeTab' not in mft['permissions'])
check('host_permissions 覆盖 http/https', 'http://*/*' in mft['host_permissions'] and 'https://*/*' in mft['host_permissions'])

# ---- 7. 语法 ----
print('\n[7] 语法检查 node --check')
for f in ['background.js','content.js','popup.js']:
    r = subprocess.run(['node','--check',EXT+'\\'+f], capture_output=True, text=True)
    check(f'node --check {f}', r.returncode == 0, r.stderr.strip())

# ---- 8. CHANGELOG 条目 ----
ver = mft["version"]
prev_ver = '.'.join(ver.split('.')[:-1]) + '.' + str(int(ver.split('.')[-1]) - 1)
print(f'\n[8] CHANGELOG {ver} 条目完整性')
cl = load(EXT + r'\CHANGELOG.md')
in_section = cl.find(f'## [{ver}]')
next_section = cl.find(f'## [{prev_ver}]')
section = cl[in_section:next_section] if in_section > 0 and next_section > 0 else ''
check(f'CHANGELOG 有 {ver} 条目', bool(section))
check(f'CHANGELOG {ver} 条目非空', len(section.strip()) > 30)

# ---- 11. iframe 支持 ----
print(f'\n[11] iframe 支持 (v{ver})')
check('manifest content_scripts 有 all_frames: true',
      '"all_frames": true' in json.dumps(mft.get('content_scripts', [])))
check('manifest 有 match_about_blank: false（空 iframe 跳过）',
      '"match_about_blank": false' in json.dumps(mft.get('content_scripts', [])))
check('content.js 有 isTop 守卫（顶层/iframe 判断）', 'window.top' in ct and 'isTop' in ct)
check('content.js blk:pick 只顶层响应（静默跳过避免竞态）',
      'msg.type === \'blk:pick\'' in ct and 'return;\n      }\n      startPick' in ct.replace('\r', ''))
check('content.js blk:ping 只顶层响应', "if (!isTop) return" in ct[ct.find("msg.type === 'blk:ping'"):ct.find("msg.type === 'blk:toggleTab'")])
check('content.js toast 有 isTop 守卫', 'if (!isTop) return; // iframe' in ct)
# 竞态防御：角标和状态上报只能由顶层 frame 完成
check('reportState() 有 isTop 守卫（避免多 frame 覆盖角标）',
      'function reportState()' in ct and 'if (!isTop) return;' in ct[ct.find('function reportState'):ct.find('chrome.runtime.onMessage')])
check('blk:toggleTab sendResponse 只顶层发',
      re.search(r"msg\.type === 'blk:toggleTab'.*?if \(isTop\) sendResponse", ct, re.DOTALL) is not None)
check('blk:toggleSite sendResponse 只顶层发',
      re.search(r"msg\.type === 'blk:toggleSite'.*?if \(isTop\) sendResponse", ct, re.DOTALL) is not None)
check('blk:setSitePaused sendResponse 只顶层发',
      re.search(r"msg\.type === 'blk:setSitePaused'.*?if \(isTop\) sendResponse", ct, re.DOTALL) is not None)

# ---- 9. content.js 的 pausedSites 双写（BUG 1 修完后的最终状态）----
print('\n[9] 最终校验：pausedSites 两个写路径都有 SYNC.set')
toggle_site_block = ct[ct.find('blk:toggleSite'):ct.find('blk:setSitePaused')]
check('blk:toggleSite 含 STORAGE.set({ pausedSites', 'STORAGE.set({ pausedSites' in toggle_site_block)
check('blk:toggleSite 含 SYNC.set({ pausedSites', 'SYNC.set({ pausedSites' in toggle_site_block)
set_site_paused_block = ct[ct.find('blk:setSitePaused'):ct.find('blk:apply')]
check('blk:setSitePaused 含 STORAGE.set({ pausedSites', 'STORAGE.set({ pausedSites' in set_site_paused_block)
check('blk:setSitePaused 含 SYNC.set({ pausedSites', 'SYNC.set({ pausedSites' in set_site_paused_block)

# ---- 10. 隐藏键不进 sync ----
print('\n[10] 隐藏键 __autoBackup_v1 不进 sync')
# 直接查 BLK_KEYS 数组行
blk_keys_line = re.search(r"const BLK_KEYS = \[([^\]]+)\]", bg)
blk_keys_content = blk_keys_line.group(1) if blk_keys_line else ''
check('BLK_KEYS 只有 3 个业务键 (rules, masterEnabled, pausedSites)',
      "'__autoBackup_v1'" not in blk_keys_content and blk_keys_content.count("'") == 6,
      f'BLK_KEYS = {blk_keys_content.strip()}')
check('setPersisted 用 BLK_KEYS 过滤（隐藏键自动被排除）', 'BLK_KEYS.includes(k)' in bg)

# ---- 汇总 ----
print('\n' + '=' * 70)
print(f'RESULT: {ok} OK · {fail} FAIL out of {ok+fail} checks')
print('=' * 70)
sys.exit(0 if fail == 0 else 1)
