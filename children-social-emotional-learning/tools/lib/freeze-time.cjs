/* 视觉回归专用 preload：把页面里的时间冻结在 2026-01-15 10:00。
   只用于测试窗口（contextIsolation:false），不进入正式应用。 */
'use strict';
(function () {
  var RealDate = Date;
  var FIXED = new RealDate('2026-01-15T10:00:00').getTime();

  function FakeDate() {
    var args = Array.prototype.slice.call(arguments);
    if (args.length === 0) return new RealDate(FIXED);
    return new (Function.prototype.bind.apply(RealDate, [null].concat(args)))();
  }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = function () { return FIXED; };
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  try { window.Date = FakeDate; } catch (e) { try { Date = FakeDate; } catch (e2) {} }
})();
