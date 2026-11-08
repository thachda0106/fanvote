import { HealthController } from '../src/health/health.controller';

describe('HealthController', () => {
  const controller = new HealthController();

  it('healthz is always ok (datastore-independent)', () => {
    expect(controller.healthz()).toEqual({ status: 'ok' });
  });

  it('readyz reports ready with explicit checks list', () => {
    const body = controller.readyz();
    expect(body.status).toBe('ready');
    expect(Array.isArray(body.checks)).toBe(true);
  });

  it('metrics exposes prometheus exposition', async () => {
    const body = await controller.metrics();
    expect(body).toContain('# HELP');
    expect(body).toContain('# TYPE');
  });
});