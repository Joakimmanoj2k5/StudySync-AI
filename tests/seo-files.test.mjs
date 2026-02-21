import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('robots.txt includes sitemap', () => {
  const robots = fs.readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
  assert.match(robots, /Sitemap:\s*https:\/\/learnusingai\.me\/sitemap\.xml/);
});

test('sitemap includes production URL', () => {
  const sitemap = fs.readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/learnusingai\.me\/<\/loc>/);
});
