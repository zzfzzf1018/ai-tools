/* 心晴岛 · 内联 SVG 美术。所有图形本地生成，不加载任何图片文件。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};
  var U = window.SEL.utils;
  var seq = 0;
  function nid(p) { seq++; return (p || 'g') + seq; }

  function svg(inner, w, h, viewBox, extra) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (viewBox || '0 0 100 100') + '" ' +
      'width="' + (w || 100) + '" height="' + (h || w || 100) + '" ' +
      'role="img" aria-hidden="true" ' + (extra || '') + '>' + inner + '</svg>';
  }

  function grad(c1, c2) {
    var id = nid('lg');
    return {
      id: id,
      def: '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>'
    };
  }

  /* ---------- 情绪脸 ---------- */
  var FACE_COLORS = {
    happy: ['#FFE08A', '#FFC94A'], sad: ['#A9D6F5', '#79B9E8'],
    angry: ['#FFB0A0', '#FF7E72'], scared: ['#DCC9F7', '#B9A0E8'],
    surprised: ['#FFD9A0', '#FFB45C'], calm: ['#BEEBD2', '#8AD6A6'],
    proud: ['#FFD3E0', '#FF9FBB'], jealous: ['#CDE7A8', '#A6CE6A'],
    worried: ['#D8DEF0', '#AEB9DC'], lonely: ['#CFE3EC', '#9CC2D4']
  };

  var FACE_PARTS = {
    happy: {
      eyes: '<path d="M30 44 Q37 34 44 44" /><path d="M56 44 Q63 34 70 44" />',
      mouth: '<path d="M34 62 Q50 80 66 62" fill="none" />',
      blush: true
    },
    sad: {
      eyes: '<path d="M30 46 Q37 40 44 46" /><path d="M56 46 Q63 40 70 46" />' +
            '<path d="M34 50 Q37 58 40 52" fill="#fff" opacity=".85"/>',
      mouth: '<path d="M36 72 Q50 58 64 72" fill="none" />',
      brows: '<path d="M30 34 L43 38" /><path d="M70 34 L57 38" />'
    },
    angry: {
      eyes: '<path d="M30 46 L44 50" /><path d="M70 46 L56 50" />',
      mouth: '<path d="M36 70 Q50 60 64 70" fill="none" />',
      brows: '<path d="M28 32 L45 40" /><path d="M72 32 L55 40" />'
    },
    scared: {
      eyes: '<circle cx="37" cy="45" r="8" fill="#fff"/><circle cx="63" cy="45" r="8" fill="#fff"/>' +
            '<circle cx="37" cy="46" r="3.4"/><circle cx="63" cy="46" r="3.4"/>',
      mouth: '<ellipse cx="50" cy="67" rx="7" ry="9" fill="#fff"/>',
      brows: '<path d="M28 34 Q37 28 45 33" /><path d="M55 33 Q63 28 72 34" />'
    },
    surprised: {
      eyes: '<circle cx="37" cy="44" r="7" fill="#fff"/><circle cx="63" cy="44" r="7" fill="#fff"/>' +
            '<circle cx="37" cy="44" r="3"/><circle cx="63" cy="44" r="3"/>',
      mouth: '<circle cx="50" cy="67" r="9" fill="#fff"/>',
      brows: '<path d="M29 31 Q37 25 45 30" /><path d="M55 30 Q63 25 71 31" />'
    },
    calm: {
      eyes: '<path d="M30 46 Q37 52 44 46" /><path d="M56 46 Q63 52 70 46" />',
      mouth: '<path d="M38 64 Q50 72 62 64" fill="none" />',
      blush: true
    },
    proud: {
      eyes: '<path d="M30 44 Q37 38 44 44" /><path d="M56 44 Q63 38 70 44" />',
      mouth: '<path d="M34 62 Q50 78 66 60" fill="none" />',
      brows: '<path d="M30 33 Q37 29 44 32" /><path d="M56 32 Q63 29 70 33" />',
      blush: true
    },
    jealous: {
      eyes: '<path d="M30 44 L44 47" /><path d="M56 47 L70 44" />',
      mouth: '<path d="M38 68 L62 66" fill="none" />',
      brows: '<path d="M30 35 L44 38" /><path d="M70 35 L56 38" />'
    },
    worried: {
      eyes: '<circle cx="37" cy="46" r="4"/><circle cx="63" cy="46" r="4"/>',
      mouth: '<path d="M36 68 Q43 63 50 68 Q57 73 64 68" fill="none" />',
      brows: '<path d="M28 34 Q36 31 44 38" /><path d="M72 34 Q64 31 56 38" />'
    },
    lonely: {
      eyes: '<path d="M30 47 Q37 51 44 47" /><path d="M56 47 Q63 51 70 47" />',
      mouth: '<path d="M44 68 Q50 71 56 68" fill="none" />',
      brows: '<path d="M31 37 L43 39" /><path d="M69 37 L57 39" />'
    }
  };

  function face(key, size, color) {
    var parts = FACE_PARTS[key] || FACE_PARTS.calm;
    var cs = FACE_COLORS[key] || FACE_COLORS.calm;
    var g = grad(color || cs[0], cs[1]);
    var inner = g.def +
      '<circle cx="50" cy="50" r="46" fill="url(#' + g.id + ')" stroke="#3A2E2B" stroke-width="3"/>' +
      '<circle cx="34" cy="24" r="12" fill="#fff" opacity=".25"/>' +
      (parts.blush ? '<ellipse cx="26" cy="57" rx="8" ry="5" fill="#FF8FA3" opacity=".55"/>' +
        '<ellipse cx="74" cy="57" rx="8" ry="5" fill="#FF8FA3" opacity=".55"/>' : '') +
      '<g stroke="#3A2E2B" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="#3A2E2B">' +
      (parts.brows || '') + parts.eyes +
      '</g>' +
      '<g stroke="#3A2E2B" stroke-width="3.4" stroke-linecap="round" fill="#3A2E2B">' + parts.mouth + '</g>';
    return svg(inner, size || 100, size || 100, '0 0 100 100');
  }

  /* ---------- 伙伴角色 ---------- */
  function buddy(kind, emotion, size) {
    var s = size || 120;
    if (kind === 'owl') return owl(s);
    if (kind === 'fox') return fox(s);
    return cloud(s, emotion || 'happy');
  }

  function cloud(s, emotion) {
    var f = FACE_PARTS[emotion] || FACE_PARTS.happy;
    var g = grad('#FFFFFF', '#DFEFFA');
    var inner = g.def +
      '<ellipse cx="55" cy="90" rx="30" ry="6" fill="#3A2E2B" opacity=".08"/>' +
      '<path d="M22 70 Q8 70 8 57 Q8 45 21 44 Q22 27 38 25 Q48 12 63 22 Q80 17 84 34 Q98 38 95 53 Q94 70 78 70 Z" ' +
        'fill="url(#' + g.id + ')" stroke="#3A2E2B" stroke-width="3" stroke-linejoin="round"/>' +
      '<g transform="translate(0,6) scale(.82) translate(11,10)">' +
        '<g stroke="#3A2E2B" stroke-width="3.6" stroke-linecap="round" fill="#3A2E2B">' +
        (f.brows || '') + f.eyes + '</g>' +
        '<g stroke="#3A2E2B" stroke-width="3.4" stroke-linecap="round" fill="#3A2E2B">' + f.mouth + '</g>' +
      '</g>' +
      '<ellipse cx="24" cy="61" rx="7" ry="4.5" fill="#FF8FA3" opacity=".5"/>' +
      '<ellipse cx="80" cy="61" rx="7" ry="4.5" fill="#FF8FA3" opacity=".5"/>' +
      '<path d="M26 72 Q20 80 27 82" stroke="#3A2E2B" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M78 72 Q84 80 77 82" stroke="#3A2E2B" stroke-width="3" fill="none" stroke-linecap="round"/>';
    return svg(inner, s, s, '0 0 110 100');
  }

  function owl(s) {
    var g = grad('#C9A277', '#A87C4E');
    var inner = g.def +
      '<ellipse cx="55" cy="92" rx="30" ry="5" fill="#3A2E2B" opacity=".08"/>' +
      '<path d="M25 32 L20 16 L38 26 Z" fill="#A87C4E" stroke="#3A2E2B" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M75 32 L80 16 L62 26 Z" fill="#A87C4E" stroke="#3A2E2B" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M20 44 Q20 22 50 22 Q80 22 80 44 L80 72 Q80 88 50 88 Q20 88 20 72 Z" fill="url(#' + g.id + ')" stroke="#3A2E2B" stroke-width="3"/>' +
      '<ellipse cx="50" cy="68" rx="20" ry="16" fill="#F6E5C8" opacity=".8"/>' +
      '<circle cx="38" cy="45" r="14" fill="#fff" stroke="#3A2E2B" stroke-width="2.5"/>' +
      '<circle cx="62" cy="45" r="14" fill="#fff" stroke="#3A2E2B" stroke-width="2.5"/>' +
      '<circle cx="39" cy="46" r="6" fill="#3A2E2B"/><circle cx="61" cy="46" r="6" fill="#3A2E2B"/>' +
      '<circle cx="41" cy="44" r="2" fill="#fff"/><circle cx="63" cy="44" r="2" fill="#fff"/>' +
      '<path d="M44 58 L56 58 L50 66 Z" fill="#FFC94A" stroke="#3A2E2B" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M28 80 L28 88 M72 80 L72 88" stroke="#3A2E2B" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M28 30 Q50 24 72 30" stroke="#3A2E2B" stroke-width="2" fill="none" opacity=".35"/>';
    return svg(inner, s, s, '0 0 110 100');
  }

  function fox(s) {
    var g = grad('#FFB36B', '#F58B4C');
    var inner = g.def +
      '<ellipse cx="55" cy="92" rx="30" ry="5" fill="#3A2E2B" opacity=".08"/>' +
      '<path d="M78 70 Q102 66 96 46 Q90 34 78 44 Z" fill="#F58B4C" stroke="#3A2E2B" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M92 46 Q100 52 96 60 Q88 58 88 48 Z" fill="#fff" stroke="#3A2E2B" stroke-width="2"/>' +
      '<path d="M24 34 L20 12 L38 27 Z" fill="#F58B4C" stroke="#3A2E2B" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M76 34 L80 12 L62 27 Z" fill="#F58B4C" stroke="#3A2E2B" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M20 48 Q20 26 50 26 Q80 26 80 48 L80 70 Q80 86 50 86 Q20 86 20 70 Z" fill="url(#' + g.id + ')" stroke="#3A2E2B" stroke-width="3"/>' +
      '<path d="M50 62 Q34 56 30 72 Q40 86 50 84 Q60 86 70 72 Q66 56 50 62 Z" fill="#FFF3E2"/>' +
      '<path d="M30 47 Q37 42 44 47" stroke="#3A2E2B" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M56 47 Q63 42 70 47" stroke="#3A2E2B" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="50" cy="69" rx="5" ry="4" fill="#3A2E2B"/>' +
      '<path d="M50 73 Q50 79 44 79 M50 73 Q50 79 56 79" stroke="#3A2E2B" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="28" cy="60" rx="6" ry="4" fill="#FF8FA3" opacity=".5"/>' +
      '<ellipse cx="72" cy="60" rx="6" ry="4" fill="#FF8FA3" opacity=".5"/>';
    return svg(inner, s, s, '0 0 110 100');
  }

  /* ---------- 场景插画（8 种） ---------- */
  function person(x, y, scale, shirt, hair) {
    scale = scale || 1;
    return '<g transform="translate(' + x + ',' + y + ') scale(' + scale + ')">' +
      '<ellipse cx="0" cy="44" rx="13" ry="4" fill="#3A2E2B" opacity=".10"/>' +
      '<path d="M-11 42 L-11 20 Q0 12 11 20 L11 42 Z" fill="' + (shirt || '#66C4EE') + '" stroke="#3A2E2B" stroke-width="2"/>' +
      '<circle cx="0" cy="7" r="11" fill="#FFE0BD" stroke="#3A2E2B" stroke-width="2"/>' +
      '<path d="M-11 5 Q-9 -6 0 -6 Q9 -6 11 5 Q4 0 -4 2 Z" fill="' + (hair || '#5C4033') + '"/>' +
      '<circle cx="-4" cy="8" r="1.6" fill="#3A2E2B"/><circle cx="4" cy="8" r="1.6" fill="#3A2E2B"/>' +
      '<path d="M-4 14 Q0 17 4 14" stroke="#3A2E2B" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '</g>';
  }

  function scene(key) {
    var sky = grad('#DDF3FF', '#FFF3D6');
    var base = sky.def +
      '<rect x="0" y="0" width="480" height="200" fill="url(#' + sky.id + ')"/>' +
      '<circle cx="412" cy="36" r="24" fill="#FFD671" opacity=".9"/>' +
      '<ellipse cx="70" cy="30" rx="34" ry="12" fill="#fff" opacity=".7"/>' +
      '<ellipse cx="95" cy="26" rx="22" ry="14" fill="#fff" opacity=".7"/>' +
      '<path d="M0 150 Q120 138 240 150 T480 148 L480 200 L0 200 Z" fill="#BFE6B8"/>' +
      '<path d="M0 168 Q140 158 260 170 T480 166 L480 200 L0 200 Z" fill="#A8D9A0" opacity=".7"/>';
    var art = '';
    switch (key) {
      case 'school':
        art = '<rect x="120" y="58" width="240" height="96" rx="8" fill="#FFF1D6" stroke="#3A2E2B" stroke-width="3"/>' +
          '<path d="M110 58 L240 24 L370 58 Z" fill="#FF8FA3" stroke="#3A2E2B" stroke-width="3" stroke-linejoin="round"/>' +
          '<rect x="222" y="112" width="38" height="42" rx="4" fill="#C48F6A" stroke="#3A2E2B" stroke-width="2"/>' +
          '<g fill="#8ED3F2" stroke="#3A2E2B" stroke-width="2">' +
          '<rect x="145" y="78" width="34" height="28" rx="3"/><rect x="196" y="78" width="34" height="28" rx="3"/>' +
          '<rect x="282" y="78" width="34" height="28" rx="3"/><rect x="332" y="78" width="26" height="28" rx="3"/></g>' +
          '<rect x="392" y="52" width="4" height="102" fill="#8A7466"/>' +
          '<path d="M396 54 L440 64 L396 78 Z" fill="#FFC94A" stroke="#3A2E2B" stroke-width="2"/>' +
          person(66, 112, 1.05, '#FF9BB0') + person(410, 112, 1.05, '#9ED5F5');
        break;
      case 'playground':
        art = '<path d="M60 152 L92 76 L112 76 L112 152" fill="none" stroke="#3A2E2B" stroke-width="4" stroke-linejoin="round"/>' +
          '<path d="M92 76 L160 152" stroke="#FF8FA3" stroke-width="12" stroke-linecap="round"/>' +
          '<path d="M92 76 L112 76" stroke="#FFC94A" stroke-width="7" stroke-linecap="round"/>' +
          '<path d="M60 152 L112 152" stroke="#3A2E2B" stroke-width="5" stroke-linecap="round"/>' +
          '<path d="M210 150 L210 88 Q210 70 232 70 Q254 70 254 88 L254 150" fill="none" stroke="#3A2E2B" stroke-width="4"/>' +
          '<path d="M210 112 L254 112" stroke="#66C4EE" stroke-width="5"/>' +
          '<circle cx="330" cy="132" r="22" fill="#FFC94A" stroke="#3A2E2B" stroke-width="3"/>' +
          '<path d="M310 126 Q330 140 350 126 M330 110 L330 154" stroke="#E59B2A" stroke-width="2" fill="none"/>' +
          person(140, 108, .9, '#B9A0E8') + person(280, 108, .9, '#7FD3A1') + person(400, 108, 1, '#FF9BB0');
        break;
      case 'home':
        art = '<rect x="96" y="60" width="190" height="96" rx="6" fill="#FFF1D6" stroke="#3A2E2B" stroke-width="3"/>' +
          '<path d="M82 62 L191 24 L300 62 Z" fill="#FF8FA3" stroke="#3A2E2B" stroke-width="3" stroke-linejoin="round"/>' +
          '<rect x="140" y="98" width="46" height="42" rx="4" fill="#8ED3F2" stroke="#3A2E2B" stroke-width="2"/>' +
          '<path d="M163 98 L163 140 M140 119 L186 119" stroke="#3A2E2B" stroke-width="2"/>' +
          '<rect x="212" y="106" width="46" height="50" rx="4" fill="#C48F6A" stroke="#3A2E2B" stroke-width="2"/>' +
          '<rect x="340" y="98" width="90" height="54" rx="14" fill="#B9A0E8" stroke="#3A2E2B" stroke-width="3"/>' +
          '<rect x="348" y="82" width="74" height="30" rx="12" fill="#CDB8EC" stroke="#3A2E2B" stroke-width="2"/>' +
          person(330, 106, .95, '#FFC94A');
        break;
      case 'birthday':
        art = '<rect x="186" y="104" width="108" height="52" rx="8" fill="#FFD9E5" stroke="#3A2E2B" stroke-width="3"/>' +
          '<rect x="186" y="88" width="108" height="20" rx="9" fill="#FFF3C9" stroke="#3A2E2B" stroke-width="2.5"/>' +
          '<path d="M212 88 L212 76 M240 88 L240 72 M268 88 L268 76" stroke="#FF8FA3" stroke-width="4" stroke-linecap="round"/>' +
          '<circle cx="212" cy="72" r="4" fill="#FFC94A"/><circle cx="240" cy="68" r="4" fill="#FFC94A"/><circle cx="268" cy="72" r="4" fill="#FFC94A"/>' +
          '<g stroke="#3A2E2B" stroke-width="1.6" opacity=".55"><path d="M110 154 Q96 100 84 44"/><path d="M370 154 Q386 100 398 44"/></g>' +
          '<circle cx="84" cy="38" r="20" fill="#FF8FA3" stroke="#3A2E2B" stroke-width="2"/>' +
          '<circle cx="398" cy="38" r="20" fill="#66C4EE" stroke="#3A2E2B" stroke-width="2"/>' +
          '<circle cx="130" cy="52" r="16" fill="#FFC94A" stroke="#3A2E2B" stroke-width="2"/>' +
          '<circle cx="352" cy="56" r="16" fill="#7FD3A1" stroke="#3A2E2B" stroke-width="2"/>' +
          person(64, 110, .9, '#B9A0E8') + person(420, 110, .9, '#FF9BB0');
        break;
      case 'group':
        art = '<rect x="130" y="106" width="220" height="16" rx="6" fill="#C48F6A" stroke="#3A2E2B" stroke-width="2.5"/>' +
          '<rect x="146" y="122" width="10" height="34" fill="#A87C4E"/><rect x="324" y="122" width="10" height="34" fill="#A87C4E"/>' +
          '<rect x="188" y="94" width="46" height="14" rx="2" fill="#fff" stroke="#3A2E2B" stroke-width="2"/>' +
          '<rect x="246" y="94" width="46" height="14" rx="2" fill="#FFF1C9" stroke="#3A2E2B" stroke-width="2"/>' +
          person(160, 66, .92, '#FF8FA3') + person(240, 62, .92, '#66C4EE') + person(320, 66, .92, '#7FD3A1');
        break;
      case 'park':
        art = '<rect x="60" y="96" width="10" height="62" rx="3" fill="#A87C4E"/>' +
          '<circle cx="65" cy="76" r="36" fill="#8ED3A1" stroke="#3A2E2B" stroke-width="3"/>' +
          '<circle cx="45" cy="66" r="20" fill="#A6DEB4"/><circle cx="86" cy="64" r="18" fill="#A6DEB4"/>' +
          '<rect x="340" y="118" width="110" height="12" rx="5" fill="#C48F6A" stroke="#3A2E2B" stroke-width="2"/>' +
          '<rect x="348" y="130" width="8" height="26" fill="#A87C4E"/><rect x="434" y="130" width="8" height="26" fill="#A87C4E"/>' +
          '<g fill="#FF8FA3"><circle cx="180" cy="146" r="5"/><circle cx="210" cy="152" r="4"/><circle cx="290" cy="144" r="5"/></g>' +
          person(230, 106, 1, '#FFC94A') + person(300, 108, .9, '#B9A0E8');
        break;
      case 'classroom':
        art = '<rect x="130" y="40" width="220" height="76" rx="6" fill="#5B8F6E" stroke="#3A2E2B" stroke-width="3"/>' +
          '<path d="M160 62 L230 62 M160 78 L270 78 M160 94 L200 94" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>' +
          '<rect x="126" y="116" width="10" height="8" fill="#A87C4E"/><rect x="344" y="116" width="10" height="8" fill="#A87C4E"/>' +
          '<g><rect x="86" y="124" width="90" height="12" rx="4" fill="#C48F6A" stroke="#3A2E2B" stroke-width="2"/>' +
          '<rect x="94" y="136" width="7" height="22" fill="#A87C4E"/><rect x="162" y="136" width="7" height="22" fill="#A87C4E"/>' +
          '<rect x="304" y="124" width="90" height="12" rx="4" fill="#C48F6A" stroke="#3A2E2B" stroke-width="2"/>' +
          '<rect x="312" y="136" width="7" height="22" fill="#A87C4E"/><rect x="380" y="136" width="7" height="22" fill="#A87C4E"/></g>' +
          person(126, 84, .82, '#FF9BB0') + person(350, 84, .82, '#9ED5F5');
        break;
      case 'online':
      default:
        art = '<rect x="150" y="44" width="180" height="112" rx="12" fill="#FAFAFF" stroke="#3A2E2B" stroke-width="4"/>' +
          '<rect x="162" y="56" width="156" height="88" rx="4" fill="#DDF3FF"/>' +
          '<rect x="220" y="156" width="40" height="10" rx="4" fill="#BFC7D6" stroke="#3A2E2B" stroke-width="2"/>' +
          '<rect x="196" y="76" width="88" height="46" rx="8" fill="#fff" stroke="#FF8FA3" stroke-width="3"/>' +
          '<path d="M212 92 L268 92 M212 104 L246 104" stroke="#7A665E" stroke-width="3" stroke-linecap="round"/>' +
          '<circle cx="266" cy="108" r="9" fill="#FFC94A" stroke="#3A2E2B" stroke-width="2"/>' +
          person(98, 108, .95, '#FFC94A') + person(392, 108, .95, '#7FD3A1');
        break;
    }
    return svg(base + art, 480, 200, '0 0 480 200', 'style="display:block;width:100%;height:auto"');
  }

  /* ---------- 情绪花 ---------- */
  function flower(color, petal, w) {
    var n = 5 + (Number(petal || 0) % 3);
    var c = color || '#FFC94A';
    var petals = '';
    for (var i = 0; i < n; i++) {
      var a = (360 / n) * i;
      petals += '<ellipse cx="50" cy="26" rx="12" ry="20" fill="' + c + '" stroke="#3A2E2B" stroke-width="2.2" ' +
        'transform="rotate(' + a + ' 50 50)" opacity=".95"/>';
    }
    var inner =
      '<path d="M50 52 Q48 76 50 94" stroke="#5FA972" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M50 76 Q34 66 30 78 Q40 88 50 80 Z" fill="#8AD6A6" stroke="#3A2E2B" stroke-width="2"/>' +
      '<path d="M50 84 Q66 72 72 84 Q62 94 50 88 Z" fill="#8AD6A6" stroke="#3A2E2B" stroke-width="2"/>' +
      petals +
      '<circle cx="50" cy="50" r="15" fill="#FFF3C9" stroke="#3A2E2B" stroke-width="2.5"/>' +
      '<circle cx="45" cy="48" r="2" fill="#3A2E2B"/><circle cx="55" cy="48" r="2" fill="#3A2E2B"/>' +
      '<path d="M45 55 Q50 60 55 55" stroke="#3A2E2B" stroke-width="2" fill="none" stroke-linecap="round"/>';
    return svg(inner, w || 90, (w || 90) * 1.05, '0 0 100 105');
  }

  function brandMark(size) {
    var g = grad('#FFFFFF', '#DDF3FF');
    return '<span class="brand-mark">' + svg(g.def +
      '<path d="M8 62 Q2 62 2 52 Q2 43 11 42 Q12 30 24 29 Q32 19 43 26 Q56 22 59 35 Q70 38 68 49 Q67 62 55 62 Z" ' +
      'fill="url(#' + g.id + ')" stroke="#3A2E2B" stroke-width="2.5"/>' +
      '<circle cx="27" cy="45" r="2.4" fill="#3A2E2B"/><circle cx="45" cy="45" r="2.4" fill="#3A2E2B"/>' +
      '<path d="M29 52 Q36 59 43 52" stroke="#3A2E2B" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<circle cx="60" cy="14" r="8" fill="#FFC94A"/>', size || 44, size || 44, '0 0 74 74') + '</span>';
  }

  /* ---------- 家长雷达图 ---------- */
  function radar(values, labels) {
    var cx = 130, cy = 122, R = 82;
    labels = labels || [];
    values = values || [];
    var n = labels.length;
    if (!n) return svg('', 260, 250, '0 0 260 250');
    function pt(i, r) {
      var a = -Math.PI / 2 + (Math.PI * 2 / n) * i;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }
    function poly(radii, fill, stroke, width) {
      var pts = radii.map(function (r, i) { return pt(i, r).map(function (v) { return v.toFixed(1); }).join(','); }).join(' ');
      return '<polygon points="' + pts + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + width + '" stroke-linejoin="round"/>';
    }
    var grid = '';
    [0.33, 0.66, 1].forEach(function (f) {
      grid += poly(labels.map(function () { return R * f; }), 'none', '#EADBC8', 1.5);
    });
    labels.forEach(function (_l, i) {
      var p = pt(i, R);
      grid += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#EADBC8" stroke-width="1.5"/>';
    });
    var max = Math.max(0, Math.max.apply(null, values.concat([0])));
    var hasData = max > 0;
    /* 没有任何练习记录时不要把五个点顶到 6 像素处画出一个"小五边形"——
       那会让家长误以为孩子已经练过。直接画中心点，并在页面上给出文字说明。 */
    var dataPts = values.map(function (v) { return hasData ? (v / max) * R : 0; });
    var body = grid + (hasData
      ? poly(dataPts, 'rgba(255,143,163,.35)', '#FF8FA3', 3)
      : '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#E9D9C8" stroke="#fff" stroke-width="2"/>');
    if (hasData) dataPts.forEach(function (r, i) {
      var p = pt(i, r);
      body += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4.5" fill="#FF8FA3" stroke="#fff" stroke-width="2"/>';
    });
    labels.forEach(function (l, i) {
      var p = pt(i, R + 22);
      body += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="middle" ' +
        'font-size="12" font-weight="700" fill="#7A665E">' + U.esc(l) + '</text>';
    });
    return svg(body, 260, 250, '0 0 260 250');
  }

  /* ---------- 情绪强度折线（家长端） ----------
     points: [{ date, count, avg }]，avg 为 null 表示那天没有签到。
     断点不连线，避免把「没记录」画成 0 或直接跳过造成误读。 */
  function lineChart(points, opts) {
    opts = opts || {};
    var W = 560, H = 230, L = 38, R = 18, T = 20, B = 34;
    var pts = points || [];
    var n = pts.length;
    if (!n) return svg('', W, H, '0 0 ' + W + ' ' + H);
    var innerW = W - L - R, innerH = H - T - B;
    function x(i) { return L + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1)); }
    function y(v) { return T + innerH - ((v - 1) / 4) * innerH; }

    var body = '';
    for (var v = 1; v <= 5; v++) {
      body += '<line x1="' + L + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - R) + '" y2="' + y(v).toFixed(1) +
        '" stroke="#F0E1CE" stroke-width="1.5"' + (v === 1 ? '' : ' stroke-dasharray="4 6"') + '/>';
      body += '<text x="' + (L - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="#9A8578">' + v + '</text>';
    }

    /* 连续有记录的一段画一条折线 + 一层浅色面积 */
    var run = [];
    function flush() {
      if (run.length < 1) { run = []; return; }
      if (run.length >= 2) {
        var d = run.map(function (p, k) { return (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
        var area = d + ' L' + run[run.length - 1][0].toFixed(1) + ' ' + y(1).toFixed(1) +
          ' L' + run[0][0].toFixed(1) + ' ' + y(1).toFixed(1) + ' Z';
        body += '<path d="' + area + '" fill="rgba(255,143,163,.16)"/>';
        body += '<path d="' + d + '" fill="none" stroke="#FF8FA3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
      }
      run = [];
    }
    pts.forEach(function (p, i) {
      if (typeof p.avg === 'number') run.push([x(i), y(p.avg)]);
      else flush();
    });
    flush();
    pts.forEach(function (p, i) {
      if (typeof p.avg !== 'number') return;
      body += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.avg).toFixed(1) + '" r="4" fill="#fff" stroke="#FF8FA3" stroke-width="2.5"/>';
    });

    /* 横轴只标首、中、尾，窄屏也不会挤成一团 */
    [0, Math.floor((n - 1) / 2), n - 1].filter(function (v, i, a) { return a.indexOf(v) === i && v >= 0; }).forEach(function (i) {
      var label = String(pts[i].date || '').slice(5).replace('-', '/');
      body += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="' + (i === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle')) +
        '" font-size="11" fill="#9A8578">' + U.esc(label) + '</text>';
    });
    if (opts.caption) {
      body += '<text x="' + (L + 4) + '" y="' + (T - 6) + '" font-size="11" fill="#9A8578">' + U.esc(opts.caption) + '</text>';
    }
    return svg(body, W, H, '0 0 ' + W + ' ' + H, 'style="max-width:100%;height:auto"');
  }

  window.SEL.art = {
    face: face, buddy: buddy, scene: scene, flower: flower,
    brandMark: brandMark, radar: radar, lineChart: lineChart, person: person, svg: svg
  };
})();
