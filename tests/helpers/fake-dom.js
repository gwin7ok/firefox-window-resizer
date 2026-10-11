// 画面スクリプト（popup.js / settings.js / preset-editor.js）のテスト用の、最小限の DOM。
// 実際のブラウザの DOM とは異なり、テストに必要な範囲（要素の生成・追加・検索・イベント）だけを実装している。

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toLowerCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.id = '';
    this._className = '';
    this._textContent = '';
    this.value = '';
    this.title = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.draggable = false;
    this.offsetWidth = 0;
    this.scrollWidth = 0;
    this.scrollHeight = 0;
    this.offsetHeight = 0;
    const self = this;
    this.classList = {
      contains: (c) => self._classes().includes(c),
      add: (c) => { if (!self._classes().includes(c)) self.className = (self._className + ' ' + c).trim(); },
      remove: (c) => { self.className = self._classes().filter((x) => x !== c).join(' '); },
    };
  }

  _classes() { return this._className.split(/\s+/).filter(Boolean); }

  get className() { return this._className; }
  set className(v) { this._className = String(v); }

  get textContent() {
    return this.children.length ? this.children.map((c) => c.textContent).join('') : this._textContent;
  }
  set textContent(v) { this._textContent = String(v); this.children = []; }

  set innerHTML(_v) { this.children = []; this._textContent = ''; }
  get innerHTML() { return ''; }

  get firstChild() { return this.children[0] || null; }
  get lastElementChild() { return this.children[this.children.length - 1] || null; }
  get nextElementSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.children;
    return siblings[siblings.indexOf(this) + 1] || null;
  }

  // <select> の選択肢
  get options() { return this.children.filter((c) => c.tagName === 'option'); }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, ref) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    const index = ref ? this.children.indexOf(ref) : -1;
    if (index < 0) this.children.push(child); else this.children.splice(index, 0, child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  // select.remove(index) / element.remove()
  remove(index) {
    if (typeof index === 'number' && this.tagName === 'select') {
      const target = this.options[index];
      if (target) this.removeChild(target);
      return;
    }
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  contains(node) {
    if (node === this) return true;
    return this.children.some((c) => c.contains(node));
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  getBoundingClientRect() { return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }; }
  focus() {}

  // セレクタは「.class」「tag」「.a, .b」の単純な形式だけを扱う
  _matches(selector) {
    return selector.split(',').map((s) => s.trim()).some((sel) => {
      if (sel.startsWith('.')) return this._classes().includes(sel.slice(1));
      if (sel.startsWith('#')) return this.id === sel.slice(1);
      return this.tagName === sel.toLowerCase();
    });
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node._matches && node._matches(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const out = [];
    const walk = (el) => {
      el.children.forEach((c) => { if (c._matches(selector)) out.push(c); walk(c); });
    };
    walk(this);
    return out;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }

  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }

  // イベントを発火し、リスナーの完了（Promise）を待つ
  async dispatch(type, event = {}) {
    const ev = Object.assign({ type, target: this, preventDefault() {} }, event);
    const results = (this.listeners[type] || []).map((fn) => fn(ev));
    await Promise.all(results);
    return ev;
  }
}

class FakeDocument {
  constructor() {
    this.listeners = {};
    this.byId = {};
    this.body = new FakeElement('body', this);
    this.documentElement = new FakeElement('html', this);
  }

  createElement(tag) { return new FakeElement(tag, this); }
  createTextNode(text) { const e = new FakeElement('#text', this); e.textContent = text; return e; }

  // テスト用: HTML に最初から存在する要素を登録する
  register(id, tag = 'div') {
    const el = this.createElement(tag);
    el.id = id;
    this.byId[id] = el;
    return el;
  }

  getElementById(id) { return this.byId[id] || null; }
  querySelector(selector) { return this.body.querySelector(selector) || Object.values(this.byId).find((e) => e._matches(selector)) || null; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }

  async dispatch(type) {
    await Promise.all((this.listeners[type] || []).map((fn) => fn({ type })));
  }
}

module.exports = { FakeElement, FakeDocument };
