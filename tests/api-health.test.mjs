import test from 'node:test';
import assert from 'node:assert/strict';
import healthHandler from '../api/health.js';

test('health endpoint returns ok payload', () => {
  const req = { method: 'GET' };
  const res = {
    payload: null,
    json(data) {
      this.payload = data;
      return this;
    },
  };

  healthHandler(req, res);

  assert.equal(res.payload.status, 'ok');
  assert.equal(typeof res.payload.timestamp, 'string');
  assert.ok(!Number.isNaN(Date.parse(res.payload.timestamp)));
});
