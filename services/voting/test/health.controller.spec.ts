import { HealthController } from '../src/health/health.controller';

describe('HealthController', () => {
  const db = { ping: jest.fn().mockResolvedValue(true) };
  const res = { status: jest.fn().mockReturnThis() };
  const controller = new HealthController(db as never);

  it('healthz is always ok (datastore-independent)', () => {
    expect(controller.healthz()).toEqual({ status: 'ok' });
  });

  it('readyz reports ready when pg ping succeeds', async () => {
    const body = await controller.readyz(res as never);
    expect(body.status).toBe('ready');
    expect(body.checks).toEqual([{ name: 'postgres', ok: true }]);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('readyz reports degraded + 503 when pg ping fails', async () => {
    db.ping.mockResolvedValueOnce(false);
    const body = await controller.readyz(res as never);
    expect(body.status).toBe('degraded');
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('metrics exposes prometheus exposition', async () => {
    const body = await controller.metrics();
    expect(body).toContain('# HELP');
    expect(body).toContain('# TYPE');
  });
});