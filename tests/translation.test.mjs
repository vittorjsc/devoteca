import assert from 'node:assert/strict';
import { test } from 'node:test';
import { translatedPageUrl, translatedTextUrl } from '../lib/translation.ts';

test('translation keeps the complete original link including query and anchor', () => {
  const original = 'https://github.com/microsoft/qlib?tab=readme-ov-file#introduction';
  const translated = new URL(translatedPageUrl(original));
  assert.equal(translated.origin, 'https://translate.google.com');
  assert.equal(translated.searchParams.get('u'), original);
  assert.equal(translated.searchParams.get('tl'), 'pt');
  assert.equal(translated.searchParams.get('sl'), 'auto');
  assert.equal(new URL(translatedPageUrl('https://impeccable.style/')).searchParams.get('u'), 'https://impeccable.style/');
});

test('unsafe or local links cannot become external translation requests', () => {
  for (const value of [null, '', 'invalid', 'javascript:alert(1)', 'file:///test.pdf', 'https://user:password@example.com/', 'http://127.0.0.1:5173/', 'http://localhost/', 'http://[::1]/']) {
    assert.equal(translatedPageUrl(value), null);
  }
});

test('pasted text stays text when it contains links, line breaks and query characters', () => {
  const text = 'Learn agentic AI\nhttps://example.com/?a=1&b=2\nC++ & React: 你好';
  const translated = new URL(translatedTextUrl(text));
  assert.equal(translated.searchParams.get('text'), text);
  assert.equal(translated.searchParams.has('u'), false);
  assert.equal(translated.searchParams.get('tl'), 'pt');
});

test('blank text and oversized excerpts are rejected', () => {
  assert.equal(translatedTextUrl('  \n '), null);
  assert.ok(translatedTextUrl('a'.repeat(5000)));
  assert.equal(translatedTextUrl('a'.repeat(5001)), null);
});
