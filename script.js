/* Telegram Formatter - Rich text editor optimized for Telegram markup */

// DOM elements
const editor = document.getElementById('editor');
const output = document.getElementById('output');
const statusEl = document.getElementById('status');
const copyBtn = document.getElementById('btnCopy');

// Utility functions
function exec(command, value = null) {
  document.execCommand(command, false, value);
  editor.focus();
}

function placeCaretAtStart(el) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.setStart(el, 0);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function setStatus(message) {
  statusEl.textContent = message || '';
}

function flashSuccess(btn) {
  btn.classList.add('success');
  setTimeout(() => btn.classList.remove('success'), 900);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Formatting functions
function surroundInline(tagName, className) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  
  // Check if there's actual text selected
  if (range.collapsed) return;

  const wrapper = document.createElement(tagName);
  if (className) wrapper.className = className;
  try {
    range.surroundContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch (e) {
    // Fallback for complex selections
    const contents = range.extractContents();
    wrapper.appendChild(contents);
    range.insertNode(wrapper);
    
    // Re-select the wrapped content
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
  editor.focus();
}

function wrapAsBlockQuote() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;

  const blockquote = document.createElement('blockquote');
  try {
    range.surroundContents(blockquote);
  } catch {
    const contents = range.cloneContents();
    blockquote.appendChild(contents);
    range.deleteContents();
    range.insertNode(blockquote);
  }
  editor.focus();
}

function toggleSpoiler() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;

  const span = document.createElement('span');
  span.className = 'spoiler';
  range.surroundContents(span);
  editor.focus();
}

function addLink() {
  const url = prompt('Вставьте URL');
  if (!url) return;
  exec('createLink', url);
}

function clearFormatting() {
  exec('removeFormat');
  const links = editor.querySelectorAll('a');
  links.forEach(a => {
    const text = document.createTextNode(a.textContent || a.href);
    a.replaceWith(text);
  });
}

// Paste handling with sanitization
function sanitizeOnPaste(e) {
  e.preventDefault();
  const clipboardData = e.clipboardData || window.clipboardData;
  const html = clipboardData.getData('text/html');
  const text = clipboardData.getData('text/plain');

  if (!editor.textContent.trim()) placeCaretAtStart(editor);

  if (html && html.trim()) {
    console.log('Pasting HTML from clipboard:', html);
    const clean = cleanHTML(html);
    console.log('Cleaned HTML:', clean);
    document.execCommand('insertHTML', false, clean);
    setStatus('Вставлено с сохранением форматирования');
  } else if (text && text.trim()) {
    document.execCommand('insertText', false, text);
    setStatus('Вставлен простой текст');
  }
}

function cleanHTML(html) {
  const allowedInline = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'STRIKE', 'CODE', 'TT', 'SPAN', 'A', 'PRE']);
  const allowedBlock = new Set(['DIV', 'P', 'BR', 'BLOCKQUOTE']);
  const template = document.createElement('template');
  template.innerHTML = html;

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT, null);
  const toRemove = [];
  while (walker.nextNode()) {
    const el = walker.currentNode;
    const tag = el.tagName;
    
    // Handle Telegram-specific classes and styles
    if (tag === 'SPAN') {
      const className = el.className;
      const style = el.style.cssText;
      
      // Convert Telegram spoiler classes
      if (className.includes('spoiler') || className.includes('tg-spoiler') || style.includes('spoiler')) {
        el.className = 'spoiler';
        el.removeAttribute('style');
        continue;
      }
      
      // Convert style-based formatting to proper tags
      if (style.includes('font-weight: bold') || style.includes('font-weight: 700')) {
        const b = document.createElement('b');
        b.innerHTML = el.innerHTML;
        el.replaceWith(b);
        continue;
      }
      
      if (style.includes('font-style: italic')) {
        const i = document.createElement('i');
        i.innerHTML = el.innerHTML;
        el.replaceWith(i);
        continue;
      }
      
      if (style.includes('text-decoration: underline')) {
        const u = document.createElement('u');
        u.innerHTML = el.innerHTML;
        el.replaceWith(u);
        continue;
      }
      
      if (style.includes('text-decoration: line-through')) {
        const s = document.createElement('s');
        s.innerHTML = el.innerHTML;
        el.replaceWith(s);
        continue;
      }
    }
    
    // Convert PRE to CODE for inline code
    if (tag === 'PRE') {
      const code = document.createElement('code');
      code.textContent = el.textContent;
      el.replaceWith(code);
      continue;
    }
    
    if (!allowedInline.has(tag) && !allowedBlock.has(tag)) {
      toRemove.push(el);
      continue;
    }
    
    // Clean attributes
    [...el.attributes].forEach(attr => {
      if (!(el.tagName === 'A' && attr.name === 'href') && 
          !(el.tagName === 'SPAN' && attr.name === 'class' && el.className === 'spoiler')) {
        el.removeAttribute(attr.name);
      }
    });
  }
  
  toRemove.forEach(el => el.replaceWith(...el.childNodes));
  return template.innerHTML;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Export to Telegram HTML
function exportToTelegramHTML(root) {
  const out = [];
  function walk(node) {
    if (node.nodeType === 3) {
      out.push(escapeHtml(node.nodeValue));
      return;
    }
    if (node.nodeType !== 1) return;

    const el = node;
    const tag = el.tagName;

    const openClose = (open, close) => {
      out.push(open);
      for (const child of el.childNodes) walk(child);
      out.push(close);
    };

    switch (tag) {
      case 'B':
      case 'STRONG':
        return openClose('<b>', '</b>');
      case 'I':
      case 'EM':
        return openClose('<i>', '</i>');
      case 'U':
        return openClose('<u>', '</u>');
      case 'S':
      case 'DEL':
      case 'STRIKE':
        return openClose('<s>', '</s>');
      case 'CODE':
      case 'TT':
        return openClose('<code>', '</code>');
      case 'BLOCKQUOTE':
        return openClose('<blockquote>', '</blockquote>');
      case 'SPAN':
        if (el.classList.contains('spoiler')) return openClose('<span class="tg-spoiler">', '</span>');
        for (const child of el.childNodes) walk(child);
        return;
      case 'A':
        const href = el.getAttribute('href') || '#';
        out.push(`<a href="${escapeHtml(href)}">`);
        for (const child of el.childNodes) walk(child);
        out.push('</a>');
        return;
      case 'DIV':
      case 'P':
        for (const child of el.childNodes) walk(child);
        out.push('\n');
        return;
      case 'BR':
        out.push('\n');
        return;
      default:
        for (const child of el.childNodes) walk(child);
    }
  }
  for (const child of root.childNodes) walk(child);
  return out.join('');
}

// Telegram MarkdownV2 escaping
function mdEscape(text) {
  return text.replace(/[\\_\*\[\]\(\)~`>#+\-=\|{}\.!]/g, r => `\\${r}`);
}

function exportToMarkdownV2(root) {
  const out = [];
  function walk(node) {
    if (node.nodeType === 3) {
      out.push(mdEscape(node.nodeValue));
      return;
    }
    if (node.nodeType !== 1) return;

    const el = node;
    const openClose = (open, close) => {
      out.push(open);
      for (const child of el.childNodes) walk(child);
      out.push(close);
    };

    switch (el.tagName) {
      case 'B':
      case 'STRONG':
        return openClose('*', '*');
      case 'I':
      case 'EM':
        return openClose('_', '_');
      case 'U':
        return openClose('__', '__');
      case 'S':
      case 'DEL':
      case 'STRIKE':
        return openClose('~', '~');
      case 'CODE':
      case 'TT':
        return openClose('`', '`');
      case 'BLOCKQUOTE':
        const inner = exportToMarkdownV2(el).split('\n').map(l => (l.trim() ? '> ' + l : '>')).join('\n');
        out.push(inner);
        return;
      case 'SPAN':
        if (el.classList.contains('spoiler')) return openClose('||', '||');
        for (const child of el.childNodes) walk(child);
        return;
      case 'A':
        const href = el.getAttribute('href') || '#';
        out.push('[');
        for (const child of el.childNodes) walk(child);
        out.push(`](${mdEscape(href)})`);
        return;
      case 'DIV':
      case 'P':
        for (const child of el.childNodes) walk(child);
        out.push('\n');
        return;
      case 'BR':
        out.push('\n');
        return;
      default:
        for (const child of el.childNodes) walk(child);
    }
  }
  for (const child of root.childNodes) walk(child);
  return out.join('');
}

// Export to Calculator format
function exportToCalculator(root) {
  const htmlResult = exportToTelegramHTML(root);
  
  // Replace line breaks with calculator string concatenation format
  let calcResult = htmlResult;
  
  // Handle multiple consecutive line breaks first (from most to least)
  calcResult = calcResult.replace(/\n{7,}/g, (match) => {
    const count = match.length;
    return "' + '" + Array(count).fill("\\n").join("' + '") + "' + '";
  });
  calcResult = calcResult.replace(/\n{6}/g, "' + '\\n' + '\\n' + '\\n' + '\\n' + '\\n' + '\\n' + '");
  calcResult = calcResult.replace(/\n{5}/g, "' + '\\n' + '\\n' + '\\n' + '\\n' + '\\n' + '");
  calcResult = calcResult.replace(/\n{4}/g, "' + '\\n' + '\\n' + '\\n' + '\\n' + '");
  calcResult = calcResult.replace(/\n{3}/g, "' + '\\n' + '\\n' + '\\n' + '");
  calcResult = calcResult.replace(/\n{2}/g, "' + '\\n' + '\\n' + '");
  calcResult = calcResult.replace(/\n/g, "' + '\\n' + '");
  
  // Wrap in single quotes
  return `'${calcResult}'`;
}

// Export functions
function exportHTML() {
  const clone = editor.cloneNode(true);
  const result = exportToTelegramHTML(clone);
  output.value = result;
  copyToClipboard(result).then(ok => {
    setStatus(ok ? 'Экспорт в HTML: скопировано в буфер обмена' : 'Экспорт в HTML: не удалось скопировать');
    flashSuccess(document.getElementById('btnExportHtml'));
  });
}

function exportMD() {
  const clone = editor.cloneNode(true);
  const result = exportToMarkdownV2(clone);
  output.value = result;
  copyToClipboard(result).then(ok => {
    setStatus(ok ? 'Экспорт в MarkdownV2: скопировано в буфер обмена' : 'Экспорт в MarkdownV2: не удалось скопировать');
    flashSuccess(document.getElementById('btnExportMd'));
  });
}

function exportCalculator() {
  const clone = editor.cloneNode(true);
  const result = exportToCalculator(clone);
  output.value = result;
  copyToClipboard(result).then(ok => {
    setStatus(ok ? 'Экспорт в Калькулятор: скопировано в буфер обмена' : 'Экспорт в Калькулятор: не удалось скопировать');
    flashSuccess(document.getElementById('btnExportCalc'));
  });
}

// Event handlers
function handleToolbarClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  
  const actions = {
    bold: () => exec('bold'),
    italic: () => exec('italic'),
    underline: () => exec('underline'),
    strike: () => surroundInline('s'),
    code: () => surroundInline('code'),
    quote: wrapAsBlockQuote,
    spoiler: toggleSpoiler,
    link: addLink,
    clear: clearFormatting
  };
  
  const action = actions[btn.dataset.action];
  if (action) action();
}

// Theme management
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  const themeToggle = document.getElementById('themeToggle');
  
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
    localStorage.setItem('theme', theme);
  }
  
  setTheme(savedTheme);
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  });
}

// Telegram Mini App integration
function initializeTelegramWebApp() {
  if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    
    // Expand to full screen
    tg.expand();
    
    // Ready signal
    tg.ready();
    
    // Optional: Hide back button if shown
    tg.BackButton.hide();
    
    console.log('Telegram Web App initialized');
  }
}

// Paste button functionality
function initializePasteButton() {
  const pasteBtn = document.getElementById('pasteBtn');
  
  function togglePasteButton() {
    const isEmpty = !editor.textContent.trim();
    pasteBtn.style.display = isEmpty ? 'block' : 'none';
  }
  
  // Show/hide paste button based on editor content
  togglePasteButton();
  editor.addEventListener('input', togglePasteButton);
  editor.addEventListener('focus', togglePasteButton);
  editor.addEventListener('blur', togglePasteButton);
  
  // Handle paste button click
  pasteBtn.addEventListener('click', async () => {
    // Focus editor first
    editor.focus();
    placeCaretAtStart(editor);
    
    // Try execCommand paste directly (works in many cases without permission)
    try {
      const success = document.execCommand('paste');
      if (success) {
        setTimeout(() => {
          if (editor.textContent.trim()) {
            togglePasteButton();
            setStatus('Текст вставлен успешно');
          } else {
            setStatus('Буфер обмена пуст или нет доступа');
          }
        }, 50);
        return;
      }
    } catch (err) {
      // Continue to clipboard API
    }
    
    // Try clipboard API
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        document.execCommand('insertText', false, text);
        togglePasteButton();
        setStatus('Текст вставлен из буфера обмена');
      } else {
        setStatus('Буфер обмена пуст');
      }
    } catch (err) {
      // Final fallback - just focus and show hint
      setStatus('Для вставки используйте Ctrl+V или долгое нажатие в поле');
    }
  });
}

// Event listeners
function initializeEventListeners() {
  // Initialize Telegram Web App
  initializeTelegramWebApp();
  
  // Initialize theme
  initializeTheme();
  
  // Initialize paste button
  initializePasteButton();
  
  // Editor events
  editor.addEventListener('click', (e) => {
    const spoiler = e.target.closest('.spoiler');
    if (spoiler) spoiler.classList.toggle('revealed');
  });

  editor.addEventListener('mousedown', (e) => {
    if (editor.textContent.trim() === '') {
      e.preventDefault();
      editor.focus();
      placeCaretAtStart(editor);
    }
  });

  editor.addEventListener('focus', () => {
    if (editor.textContent.trim() === '') placeCaretAtStart(editor);
  });

  editor.addEventListener('blur', () => {
    if (editor.textContent.trim() === '') editor.innerHTML = '';
  });

  editor.addEventListener('paste', sanitizeOnPaste);

  // Button events
  document.querySelector('.toolbar').addEventListener('click', handleToolbarClick);
  document.getElementById('btnExportHtml').addEventListener('click', exportHTML);
  document.getElementById('btnExportMd').addEventListener('click', exportMD);
  document.getElementById('btnExportCalc').addEventListener('click', exportCalculator);
  
  copyBtn.addEventListener('click', async () => {
    if (!output.value) return;
    const ok = await copyToClipboard(output.value);
    setStatus(ok ? 'Скопировано из результата в буфер обмена' : 'Не удалось скопировать');
    flashSuccess(copyBtn);
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEventListeners);
} else {
  initializeEventListeners();
}