/* Telegram Formatter - Rich text editor optimized for Telegram markup */

// DOM elements
const editor = document.getElementById('editor');
const output = document.getElementById('output');
const statusEl = document.getElementById('status');
const copyBtn = document.getElementById('btnCopy');
const popupMenu = document.getElementById('popupMenu');

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

  // Check if selection is already wrapped in this tag
  const parentElement = range.commonAncestorContainer.nodeType === 1 
    ? range.commonAncestorContainer 
    : range.commonAncestorContainer.parentElement;
    
  // Look for existing wrapper
  let existingWrapper = null;
  if (parentElement.tagName === tagName.toUpperCase()) {
    if (!className || parentElement.classList.contains(className)) {
      existingWrapper = parentElement;
    }
  } else {
    // Check if selection is fully within a wrapper of this type
    let current = parentElement;
    while (current && current !== editor) {
      if (current.tagName === tagName.toUpperCase()) {
        if (!className || current.classList.contains(className)) {
          existingWrapper = current;
          break;
        }
      }
      current = current.parentElement;
    }
  }
  
  if (existingWrapper) {
    // Remove existing formatting
    const text = existingWrapper.textContent;
    const textNode = document.createTextNode(text);
    existingWrapper.replaceWith(textNode);
    
    // Select the unwrapped text
    const newRange = document.createRange();
    newRange.selectNodeContents(textNode);
    selection.removeAllRanges();
    selection.addRange(newRange);
  } else {
    // Add new formatting
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
  }
  editor.focus();
}

function wrapAsBlockQuote() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  
  if (range.collapsed) return;

  // Check if selection is already in a blockquote
  const parentElement = range.commonAncestorContainer.nodeType === 1 
    ? range.commonAncestorContainer 
    : range.commonAncestorContainer.parentElement;
    
  let existingBlockquote = null;
  if (parentElement.tagName === 'BLOCKQUOTE') {
    existingBlockquote = parentElement;
  } else {
    let current = parentElement;
    while (current && current !== editor) {
      if (current.tagName === 'BLOCKQUOTE') {
        existingBlockquote = current;
        break;
      }
      current = current.parentElement;
    }
  }
  
  if (existingBlockquote) {
    // Remove blockquote formatting
    const text = existingBlockquote.textContent;
    const textNode = document.createTextNode(text);
    existingBlockquote.replaceWith(textNode);
    
    // Select the unwrapped text
    const newRange = document.createRange();
    newRange.selectNodeContents(textNode);
    selection.removeAllRanges();
    selection.addRange(newRange);
  } else {
    // Add blockquote formatting
    const blockquote = document.createElement('blockquote');
    try {
      range.surroundContents(blockquote);
    } catch {
      const contents = range.cloneContents();
      blockquote.appendChild(contents);
      range.deleteContents();
      range.insertNode(blockquote);
    }
  }
  editor.focus();
}

function toggleCode() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  // Check if we're already in a code element
  let current = selection.focusNode;
  while (current && current !== editor) {
    if (current.tagName === 'CODE') {
      // Remove code formatting
      const text = current.textContent;
      current.replaceWith(document.createTextNode(text));
      return;
    }
    current = current.parentElement;
  }
  
  // Add code formatting if not present
  try {
    exec('insertHTML', `<code>${selection.toString()}</code>`);
  } catch {
    // Fallback
    surroundInline('code');
  }
}

function toggleQuote() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  // Check if we're already in a blockquote
  let current = selection.focusNode;
  while (current && current !== editor) {
    if (current.tagName === 'BLOCKQUOTE') {
      // Remove blockquote formatting
      const text = current.textContent;
      current.replaceWith(document.createTextNode(text));
      return;
    }
    current = current.parentElement;
  }
  
  // Add blockquote formatting if not present
  try {
    exec('insertHTML', `<blockquote>${selection.toString()}</blockquote>`);
  } catch {
    // Fallback
    wrapAsBlockQuote();
  }
}

function toggleSpoiler() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  // Check if we're already in a spoiler span
  let current = selection.focusNode;
  while (current && current !== editor) {
    if (current.tagName === 'SPAN' && current.classList.contains('spoiler')) {
      // Remove spoiler formatting
      const text = current.textContent;
      current.replaceWith(document.createTextNode(text));
      return;
    }
    current = current.parentElement;
  }
  
  // Add spoiler formatting if not present
  try {
    exec('insertHTML', `<span class="spoiler">${selection.toString()}</span>`);
  } catch {
    // Fallback
    surroundInline('span', 'spoiler');
  }
}

function addLink() {
  const url = prompt('Вставьте URL');
  if (!url) return;
  exec('createLink', url);
}

function clearFormatting() {
  // Remove all formatting but keep line breaks
  function stripFormatting(node) {
    if (node.nodeType === 3) {
      // Text node - keep as is
      return node.textContent;
    }
    
    if (node.nodeType === 1) {
      // Element node
      const tagName = node.tagName.toLowerCase();
      let result = '';
      
      // Process child nodes
      for (const child of node.childNodes) {
        result += stripFormatting(child);
      }
      
      // Add line breaks for block elements
      if (tagName === 'div' || tagName === 'p' || tagName === 'blockquote' || tagName === 'br') {
        result += '\n';
      }
      
      return result;
    }
    
    return '';
  }
  
  // Get text with preserved line breaks
  const textWithBreaks = stripFormatting(editor);
  
  // Replace content preserving line structure
  const lines = textWithBreaks.split('\n');
  editor.innerHTML = '';
  
  lines.forEach((line, index) => {
    if (line.trim() || index === 0) {
      editor.appendChild(document.createTextNode(line));
    }
    if (index < lines.length - 1) {
      editor.appendChild(document.createElement('br'));
    }
  });
  
  editor.focus();
  setStatus('Форматирование убрано, структура сохранена');
}

// Clear formatting for selected text only
function clearSelectionFormatting() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  
  // Get selected content
  const selectedContent = range.extractContents();
  
  // Function to strip formatting but keep text and line breaks
  function stripFormattingFromNode(node) {
    if (node.nodeType === 3) {
      // Text node - return as is
      return document.createTextNode(node.textContent);
    }
    
    if (node.nodeType === 1) {
      const tagName = node.tagName.toLowerCase();
      
      // For block elements, preserve structure with div
      if (tagName === 'div' || tagName === 'p' || tagName === 'blockquote') {
        const div = document.createElement('div');
        for (const child of Array.from(node.childNodes)) {
          div.appendChild(stripFormattingFromNode(child));
        }
        return div;
      }
      
      // For BR, keep as is
      if (tagName === 'br') {
        return document.createElement('br');
      }
      
      // For other elements, just extract text content
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(node.childNodes)) {
        fragment.appendChild(stripFormattingFromNode(child));
      }
      return fragment;
    }
    
    return document.createTextNode('');
  }
  
  // Process the selected content
  const cleanFragment = document.createDocumentFragment();
  for (const child of Array.from(selectedContent.childNodes)) {
    cleanFragment.appendChild(stripFormattingFromNode(child));
  }
  
  // Insert the cleaned content
  range.insertNode(cleanFragment);
  
  // Restore selection
  const newRange = document.createRange();
  newRange.selectNodeContents(cleanFragment);
  selection.removeAllRanges();
  selection.addRange(newRange);
  
  setStatus('Форматирование убрано с выделенного текста');
}

function clearAllText() {
  editor.innerHTML = '';
  editor.focus();
  setStatus('Редактор очищен');
  
  // Show paste button if editor is empty
  const pasteBtn = document.getElementById('pasteBtn');
  if (pasteBtn) {
    pasteBtn.style.display = 'block';
  }
}

// Paste handling with sanitization
function sanitizeOnPaste(e) {
  e.preventDefault();
  const clipboardData = e.clipboardData || window.clipboardData;
  const html = clipboardData.getData('text/html');
  const text = clipboardData.getData('text/plain');

  if (!editor.textContent.trim()) placeCaretAtStart(editor);

  if (html && html.trim()) {
    const clean = cleanHTML(html);
    document.execCommand('insertHTML', false, clean);
  } else if (text && text.trim()) {
    document.execCommand('insertText', false, text);
  }
}

function cleanHTML(html) {
  const allowedInline = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'STRIKE', 'CODE', 'TT', 'SPAN', 'A']);
  const allowedBlock = new Set(['DIV', 'P', 'BR', 'BLOCKQUOTE']);
  const template = document.createElement('template');
  template.innerHTML = html;

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT, null);
  const toRemove = [];
  while (walker.nextNode()) {
    const el = walker.currentNode;
    const tag = el.tagName;
    if (!allowedInline.has(tag) && !allowedBlock.has(tag)) {
      toRemove.push(el);
      continue;
    }
    [...el.attributes].forEach(attr => {
      if (!(el.tagName === 'A' && attr.name === 'href')) el.removeAttribute(attr.name);
    });
    if (el.tagName === 'SPAN' && el.className !== 'spoiler') {
      el.removeAttribute('class');
    }
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
    strike: () => exec('strikeThrough'),
    code: () => toggleCode(),
    quote: () => toggleQuote(),
    spoiler: () => toggleSpoiler(),
    link: addLink,
    clear: clearFormatting,
    clearAll: clearAllText,
    clearSelection: clearSelectionFormatting
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

// Telegram Mini App integration with sticky app fix
function initializeTelegramWebApp() {
  // Apply sticky app fix immediately for all mobile platforms
  applyStickyAppFix();
  
  // Initialize SDK
  if (typeof window.telegramApps !== 'undefined' && window.telegramApps.sdk) {
    try {
      const { postEvent } = window.telegramApps.sdk;
      
      // Expand the application
      postEvent('web_app_expand');
      
      console.log('Telegram Web App initialized with new SDK');
    } catch (error) {
      console.log('Failed to initialize new SDK, falling back to old SDK');
      fallbackToOldSDK();
    }
  } else {
    fallbackToOldSDK();
  }
}

// Apply sticky app fix based on Telegram documentation
function applyStickyAppFix() {
  try {
    // Check if we have the new SDK available
    if (typeof window.telegramApps !== 'undefined' && window.telegramApps.sdk) {
      const { retrieveLaunchParams } = window.telegramApps.sdk;
      const lp = retrieveLaunchParams();
      
      console.log('Detected platform:', lp.platform);
      
      // Some versions of Telegram don't need the classes
      if (['macos', 'tdesktop', 'weba', 'web', 'webk'].includes(lp.platform)) {
        console.log('Desktop platform detected, skipping mobile fix');
        return;
      }
    }
    
    // Apply mobile fix classes for sticky behavior
    console.log('Applying sticky app fix for mobile platform');
    document.body.classList.add('mobile-body');
    
    const wrapEl = document.getElementById('wrap');
    const contentEl = document.getElementById('content');
    
    if (wrapEl) {
      wrapEl.classList.add('mobile-wrap');
    }
    
    if (contentEl) {
      contentEl.classList.add('mobile-content');
    }
    
    console.log('Sticky app fix applied successfully');
  } catch (error) {
    console.log('Error applying sticky app fix:', error);
    // Apply fix anyway on mobile devices
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      console.log('Fallback: applying mobile fix based on user agent');
      document.body.classList.add('mobile-body');
      const wrapEl = document.getElementById('wrap');
      const contentEl = document.getElementById('content');
      if (wrapEl) wrapEl.classList.add('mobile-wrap');
      if (contentEl) contentEl.classList.add('mobile-content');
    }
  }
}

// Fallback to old SDK if new one fails
function fallbackToOldSDK() {
  if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.ready();
    
    // Hide back button if exists
    if (tg.BackButton) {
      tg.BackButton.hide();
    }
    
    console.log('Telegram Web App initialized with old SDK');
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

// Popup formatting menu functions
function showPopupMenu(x, y) {
  popupMenu.style.left = x + 'px';
  popupMenu.style.top = y + 'px';
  popupMenu.style.display = 'block';
  
  // Ensure menu stays within viewport
  const rect = popupMenu.getBoundingClientRect();
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  
  // Adjust horizontal position
  if (rect.right > viewport.width - 10) {
    popupMenu.style.left = (viewport.width - rect.width - 10) + 'px';
  }
  if (rect.left < 10) {
    popupMenu.style.left = '10px';
  }
  
  // Adjust vertical position
  if (rect.bottom > viewport.height - 10) {
    popupMenu.style.top = (y - rect.height - 10) + 'px';
  }
  if (rect.top < 10) {
    popupMenu.style.top = '10px';
  }
}

function hidePopupMenu() {
  popupMenu.style.display = 'none';
}

function handleTextSelection() {
  const selection = window.getSelection();
  
  // Hide menu if no selection or no text selected
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    hidePopupMenu();
    return;
  }
  
  const range = selection.getRangeAt(0);
  
  // Only show if selection is within editor
  if (!editor.contains(range.commonAncestorContainer)) {
    hidePopupMenu();
    return;
  }
  
  // Get selection text to check if it's meaningful
  const selectedText = selection.toString().trim();
  if (!selectedText) {
    hidePopupMenu();
    return;
  }
  
  // Calculate popup position with mobile fix consideration
  const rect = range.getBoundingClientRect();
  
  // Check if mobile fix is applied
  const isMobileFix = document.body.classList.contains('mobile-body');
  let x, y;
  
  if (isMobileFix) {
    // For mobile fix, calculate position relative to the scrollable container
    const contentEl = document.getElementById('content');
    const contentRect = contentEl ? contentEl.getBoundingClientRect() : { left: 0, top: 0 };
    const scrollTop = contentEl ? contentEl.scrollTop : 0;
    
    x = rect.left - contentRect.left + (rect.width / 2) - 120; // Center horizontally relative to content
    y = rect.bottom - contentRect.top + scrollTop + 8; // Position below selection accounting for scroll
    
    console.log('Mobile popup position:', { x, y, rectBottom: rect.bottom, contentTop: contentRect.top, scrollTop });
  } else {
    // Normal positioning for desktop
    x = rect.left + (rect.width / 2) - 120; // Center horizontally
    y = rect.top - 50; // Position above selection for desktop
  }
  
  showPopupMenu(x, y);
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

  // Text selection events for popup menu
  document.addEventListener('selectionchange', handleTextSelection);
  
  // Hide popup when clicking outside
  document.addEventListener('click', (e) => {
    if (!popupMenu.contains(e.target) && !editor.contains(e.target)) {
      hidePopupMenu();
    }
  });
  
  // Popup menu button events
  popupMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('.popup-btn');
    if (!btn) return;
    
    const action = btn.dataset.action;
    
    // Define the same actions as in handleToolbarClick
    const actions = {
      bold: () => exec('bold'),
      italic: () => exec('italic'),
      underline: () => exec('underline'),
      strike: () => exec('strikeThrough'),
      code: () => toggleCode(),
      quote: () => toggleQuote(),
      spoiler: () => toggleSpoiler(),
      link: addLink,
      clear: clearFormatting,
      clearAll: clearAllText,
      clearSelection: clearSelectionFormatting
    };
    
    if (action && actions[action]) {
      // Store current selection before it gets lost
      const selection = window.getSelection();
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
      
      // Apply formatting
      actions[action]();
      
      // Restore selection if it was lost
      if (range && selection.rangeCount === 0) {
        selection.addRange(range);
      }
      
      // Hide popup after formatting
      hidePopupMenu();
      
      // Brief feedback
      setStatus(`Применено: ${btn.title}`);
    }
  });

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
  document.addEventListener('DOMContentLoaded', () => {
    // Apply sticky fix first, before any other initialization
    applyStickyAppFix();
    initializeEventListeners();
  });
} else {
  // Apply sticky fix first, before any other initialization
  applyStickyAppFix();
  initializeEventListeners();
}