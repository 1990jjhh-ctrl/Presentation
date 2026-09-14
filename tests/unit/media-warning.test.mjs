import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaWarning } from '../../scripts/shared.mjs';

const MB = 1024 * 1024;

test('no warning at or below 25 MB', () => {
  assert.equal(mediaWarning([{ file: 'a.mp4', bytes: 20 * MB }, { file: 'b.png', bytes: 5 * MB }]), null);
});

test('warning lists the total and the five largest files', () => {
  const sizes = [
    { file: 'one.mp4', bytes: 9 * MB },
    { file: 'two.mp4', bytes: 8 * MB },
    { file: 'three.mp4', bytes: 7 * MB },
    { file: 'four.png', bytes: 2 * MB },
    { file: 'five.png', bytes: 1 * MB },
    { file: 'six.svg', bytes: 0.5 * MB },
  ];
  assert.equal(mediaWarning(sizes), [
    'Warning: embedded media totals 27.5 MB (limit 25.0 MB). Largest files:',
    '   9.0 MB  one.mp4',
    '   8.0 MB  two.mp4',
    '   7.0 MB  three.mp4',
    '   2.0 MB  four.png',
    '   1.0 MB  five.png',
  ].join('\n'));
});
