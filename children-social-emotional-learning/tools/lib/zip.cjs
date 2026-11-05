/* 零依赖 ZIP 写入器（发布打包专用）。
   为什么不用 PowerShell 的 Compress-Archive：Windows PowerShell 5.1 底层是 .NET Framework，
   它写出的条目名用反斜杠（icons\icon-192.png）。这样的包在 Windows 上"看起来正常"，
   但在 macOS / Linux 解压会得到一个名字里带反斜杠的文件，相对路径全部失效——
   Web 版会因此找不到 sw.js 与图标，装不了也离线不了。
   这里自己按 ZIP 规范（APPNOTE 6.3）写：条目名统一 '/'，UTF-8 标志位打开。 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crcTable() {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
}
const CRC_TABLE = crcTable();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function dosTime(date) {
  const d = date instanceof Date ? date : new Date();
  const year = Math.max(1980, d.getFullYear());
  return {
    time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31),
    date: (((year - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31),
  };
}

function walk(dir, prefix, out) {
  fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .forEach((entry) => {
      const full = path.join(dir, entry.name);
      const name = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(full, name, out);
      else if (entry.isFile()) out.push({ name, path: full });
    });
  return out;
}

/* entries: 字符串路径数组（文件或目录），目录会递归展开并保留相对层级 */
function collect(entries) {
  const files = [];
  entries.forEach((p) => {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, path.basename(p), files);
    else files.push({ name: path.basename(p), path: p });
  });
  const seen = new Set();
  return files.filter((f) => {
    if (seen.has(f.name)) throw new Error('ZIP 内出现重名条目: ' + f.name);
    seen.add(f.name);
    return true;
  });
}

/* 写包；返回写入的条目名列表，便于调用方立刻自检 */
function createZip(destPath, entries) {
  const files = collect(entries);
  if (!files.length) throw new Error('ZIP 没有任何文件可打包');

  const chunks = [];
  const central = [];
  let offset = 0;

  files.forEach((file) => {
    const name = file.name.split(path.sep).join('/');
    const nameBuf = Buffer.from(name, 'utf8');
    const data = fs.readFileSync(file.path);
    const stat = fs.statSync(file.path);
    let method = 0;
    let payload = data;
    if (/\.(js|css|html|md|json|webmanifest|txt|svg)$/i.test(file.path)) {
      const deflated = zlib.deflateRawSync(data, { level: 9 });
      if (deflated.length < data.length) {
        method = 8;
        payload = deflated;
      }
    }
    const crc = crc32(data);
    const { time, date } = dosTime(stat.mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 名称
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBuf, payload);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(payload.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30); // extra
    cd.writeUInt16LE(0, 32); // comment
    cd.writeUInt16LE(0, 34); // disk
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(0o644 << 16, 38); // external attrs
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + payload.length;
  });

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  fs.writeFileSync(destPath, Buffer.concat([...chunks, centralBuf, end]));
  return files.map((f) => f.name.split(path.sep).join('/'));
}

module.exports = { createZip, collect };
