// T1.2 smoke: 10 RPS through the gateway against one real route per service,
// plus forged-JWT rejection and an analytics burst that must hit the edge
// rate limit (60/min on the analytics route).
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const EVENT_ID = 'e2e00000-0000-4000-8000-000000000001';

http.setResponseCallback(http.expectedStatuses(200, 201, 400, 401, 404, 429));

export const rateLimited = new Counter('rate_limited_requests');

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-arrival-rate',
      exec: 'smokeFlow',
      rate: 10,
      timeUnit: '1s',
      duration: '10s',
      preAllocatedVUs: 10,
      maxVUs: 30,
    },
    burst: {
      executor: 'shared-iterations',
      exec: 'burstFlow',
      vus: 15,
      iterations: 120,
      startTime: '15s',
    },
  },
  thresholds: {
    'http_req_failed{scenario:smoke}': ['rate<0.01'],
    'checks{scenario:smoke}': ['rate>0.99'],
    rate_limited_requests: ['count>0'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/v1/identity/auth/test-token`,
    JSON.stringify({ sub: 'k6-smoke' }),
    { headers: { 'content-type': 'application/json' }, tags: { name: 'mint-token' } },
  );
  check(res, { 'mock IdP mints a token': (r) => r.status === 200 });
  const token = res.json('accessToken') || '';
  const forged = `${token.slice(0, -4)}AAAA`;
  return { token, forged };
}

const json = { headers: { 'content-type': 'application/json' } };

export function smokeFlow(data) {
  const target = __ITER % 4;
  if (target === 0) {
    const res = http.get(`${BASE_URL}/api/v1/identity/users/me`, {
      headers: { authorization: `Bearer ${data.token}` },
      tags: { name: 'identity-me' },
    });
    check(res, { 'identity /users/me 200': (r) => r.status === 200 && r.json('id') === 'k6-smoke' });
  } else if (target === 1) {
    const res = http.get(`${BASE_URL}/api/v1/votes/events`, { tags: { name: 'vote-events' } });
    check(res, { 'vote catalog 200': (r) => r.status === 200 && Array.isArray(r.json('items')) });
  } else if (target === 2) {
    const res = http.get(`${BASE_URL}/api/v1/commerce/events/${EVENT_ID}/inventory`, {
      tags: { name: 'commerce-inventory' },
    });
    check(res, { 'commerce inventory 200': (r) => r.status === 200 && r.json('eventId') === EVENT_ID });
  } else {
    const res = http.get(`${BASE_URL}/api/v1/analytics/events/${EVENT_ID}/activity`, {
      tags: { name: 'analytics-activity' },
    });
    check(res, { 'analytics activity 200': (r) => r.status === 200 && Array.isArray(r.json('items')) });
  }

  if (__ITER % 10 === 9) {
    const res = http.get(`${BASE_URL}/api/v1/identity/users/me`, {
      headers: { authorization: `Bearer ${data.forged}` },
      tags: { name: 'forged-token' },
    });
    check(res, { 'forged JWT rejected with 401': (r) => r.status === 401 });
  }
}

export function burstFlow() {
  const res = http.get(`${BASE_URL}/api/v1/analytics/events/${EVENT_ID}/activity`, {
    tags: { name: 'analytics-burst' },
  });
  if (res.status === 429) {
    rateLimited.add(1);
  }
}
