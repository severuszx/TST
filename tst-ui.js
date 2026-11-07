// The Slow Tide 站内弹窗，替代浏览器 prompt / confirm / alert
(function () {
  var overlay = null, pending = null;

  function ensureStyle() {
    if (document.getElementById('tstUiStyle')) return;
    var s = document.createElement('style');
    s.id = 'tstUiStyle';
    s.textContent = [
      '.tstui-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9998;display:flex;align-items:center;justify-content:center;padding:18px;}',
      '.tstui-box{width:min(440px,100%);background:var(--card,#fff);color:var(--text,#16181d);border:1px solid var(--border,#e2e4e8);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.22);padding:18px;font-family:inherit;}',
      '.tstui-title{font-size:16px;font-weight:700;margin-bottom:6px;}',
      '.tstui-desc{font-size:13px;line-height:1.6;color:var(--text-secondary,#60646c);margin-bottom:12px;white-space:pre-wrap;}',
      '.tstui-field{margin-bottom:10px;}',
      '.tstui-label{font-size:13px;font-weight:600;margin-bottom:5px;display:block;}',
      '.tstui-input{width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border,#dcdfe4);border-radius:8px;background:var(--bg,#fff);color:var(--text,#16181d);font-size:14px;font-family:inherit;outline:none;}',
      '.tstui-input:focus{border-color:var(--accent,#3b82f6);}',
      '.tstui-err{font-size:12px;color:#d33;min-height:16px;margin:-4px 0 6px;}',
      '.tstui-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:8px;}',
      '.tstui-btn{padding:8px 16px;border-radius:8px;border:1px solid var(--border,#dcdfe4);background:var(--card,#fff);color:var(--text,#16181d);font-size:14px;font-family:inherit;cursor:pointer;}',
      '.tstui-btn.primary{background:var(--accent,#16181d);border-color:var(--accent,#16181d);color:#fff;}',
      '.tstui-btn.danger{background:#c83232;border-color:#c83232;color:#fff;}',
      '.tstui-btn:disabled{opacity:.55;cursor:default;}'
    ].join('');
    document.head.appendChild(s);
  }

  function settle(v) {
    var p = pending;
    pending = null;
    if (p) { try { p(v); } catch (e) {} }
  }

  function close() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    settle(null);
  }

  function open(opts) {
    ensureStyle();
    if (overlay) close();
    overlay = document.createElement('div');
    overlay.className = 'tstui-mask';
    var box = document.createElement('div');
    box.className = 'tstui-box';
    overlay.appendChild(box);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });

    var title = document.createElement('div');
    title.className = 'tstui-title';
    title.textContent = opts.title || '提示';
    box.appendChild(title);
    if (opts.desc) {
      var d = document.createElement('div');
      d.className = 'tstui-desc';
      d.textContent = opts.desc;
      box.appendChild(d);
    }

    var fields = opts.fields || [];
    var inputs = {};
    fields.forEach(function (f) {
      var wrap = document.createElement('div');
      wrap.className = 'tstui-field';
      var lab = document.createElement('label');
      lab.className = 'tstui-label';
      lab.textContent = f.label || f.name;
      wrap.appendChild(lab);
      var inp;
      if ((f.type || 'text') === 'textarea') {
        inp = document.createElement('textarea');
        inp.rows = f.rows || 6;
      } else {
        inp = document.createElement('input');
        inp.type = f.type || 'text';
      }
      inp.className = 'tstui-input';
      inp.value = f.value || '';
      inp.placeholder = f.placeholder || '';
      if (f.maxlength) inp.maxLength = f.maxlength;
      wrap.appendChild(inp);
      box.appendChild(wrap);
      inputs[f.name] = inp;
    });

    var err = document.createElement('div');
    err.className = 'tstui-err';
    box.appendChild(err);

    var actions = document.createElement('div');
    actions.className = 'tstui-actions';
    var cancel = document.createElement('button');
    cancel.className = 'tstui-btn';
    cancel.type = 'button';
    cancel.textContent = opts.cancelText || '取消';
    cancel.onclick = close;
    actions.appendChild(cancel);

    var ok = document.createElement('button');
    ok.className = 'tstui-btn ' + (opts.danger ? 'danger' : 'primary');
    ok.type = 'button';
    ok.textContent = opts.okText || '确定';
    ok.onclick = function () {
      var vals = {};
      for (var k in inputs) vals[k] = inputs[k].value;
      if (opts.validate) {
        var v = opts.validate(vals);
        if (typeof v === 'string' && v) { err.textContent = v; return; }
        if (v === false) return;
      }
      close();
      settle(opts.singleValue ? vals[fields[0].name] : (fields.length ? vals : true));
      if (opts.onDone) { try { opts.onDone(vals); } catch (e) {} }
    };
    actions.appendChild(ok);
    box.appendChild(actions);

    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); ok.click(); }
    });

    document.body.appendChild(overlay);
    var first = fields.length ? inputs[fields[0].name] : null;
    if (first) { try { first.focus(); } catch (e) {} }
  }

  function promiseOpen(opts) {
    return new Promise(function (resolve) { pending = resolve; open(opts); });
  }

  window.TSTUI = {
    form: function (opts) { open(opts); },
    alert: function (text, title) {
      return promiseOpen({ title: title || '提示', desc: text, okText: '知道了', cancelText: '关闭' });
    },
    confirm: function (text, opts) {
      opts = opts || {};
      return promiseOpen({ title: opts.title || '确认', desc: text, okText: opts.okText || '确定', cancelText: opts.cancelText || '取消', danger: opts.danger !== false });
    },
    ask: function (opts) {
      opts = opts || {};
      return promiseOpen({ title: opts.title || '请输入', desc: opts.desc || '', okText: opts.okText || '确定', fields: [{ name: 'v', label: opts.label || '', type: opts.type || 'text', value: opts.value || '', placeholder: opts.placeholder || '', maxlength: opts.maxlength }], singleValue: true });
    },
    close: close
  };
})();
