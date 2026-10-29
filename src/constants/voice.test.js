import assert from 'node:assert/strict';
import test from 'node:test';
import { FILIPINO_VOICE, getGreeting } from './voice.js';

const manilaTime = (hour, minute = 0) => new Date(Date.UTC(2026, 9, 29, hour, minute) - 8 * 60 * 60 * 1000);

test('getGreeting follows Asia/Manila time period boundaries', () => {
  const cases = [
    [4, 59, FILIPINO_VOICE.greetingEvening.phrase.replace('{name}', 'Alex')],
    [5, 0, FILIPINO_VOICE.greetingMorning.phrase.replace('{name}', 'Alex')],
    [10, 59, FILIPINO_VOICE.greetingMorning.phrase.replace('{name}', 'Alex')],
    [11, 0, FILIPINO_VOICE.greetingNoon.phrase.replace('{name}', 'Alex')],
    [12, 59, FILIPINO_VOICE.greetingNoon.phrase.replace('{name}', 'Alex')],
    [13, 0, FILIPINO_VOICE.greetingAfternoon.phrase.replace('{name}', 'Alex')],
    [17, 59, FILIPINO_VOICE.greetingAfternoon.phrase.replace('{name}', 'Alex')],
    [18, 0, FILIPINO_VOICE.greetingEvening.phrase.replace('{name}', 'Alex')],
  ];

  for (const [hour, minute, expected] of cases) {
    assert.equal(getGreeting(manilaTime(hour, minute), 'Alex'), expected);
  }
});
