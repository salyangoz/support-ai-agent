import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';

let request: ReturnType<typeof supertest>;

describe('POST /auth/register', () => {
  beforeAll(async () => {
    await setupTestDb();
    const mod = await import('../../src/index');
    request = supertest(mod.createApp());
  });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  it('should register a new user and return tokens', async () => {
    const res = await request
      .post('/auth/register')
      .send({ email: 'newuser@example.com', password: 'securepass123', name: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('newuser@example.com');
    expect(res.body.user.name).toBe('New User');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('should allow login after registration', async () => {
    await request
      .post('/auth/register')
      .send({ email: 'newuser@example.com', password: 'securepass123', name: 'New User' });

    const loginRes = await request
      .post('/auth/login')
      .send({ email: 'newuser@example.com', password: 'securepass123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.access_token).toBeDefined();
    expect(loginRes.body.user.email).toBe('newuser@example.com');
  });

  it('should return 409 when email is already registered', async () => {
    await request
      .post('/auth/register')
      .send({ email: 'duplicate@example.com', password: 'securepass123', name: 'First' });

    const res = await request
      .post('/auth/register')
      .send({ email: 'duplicate@example.com', password: 'otherpass123', name: 'Second' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('should return 400 when email is missing', async () => {
    const res = await request
      .post('/auth/register')
      .send({ password: 'securepass123', name: 'No Email' });
    expect(res.status).toBe(400);
  });

  it('should return 400 when password is missing', async () => {
    const res = await request
      .post('/auth/register')
      .send({ email: 'test@example.com', name: 'No Password' });
    expect(res.status).toBe(400);
  });

  it('should return 400 when name is missing', async () => {
    const res = await request
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'securepass123' });
    expect(res.status).toBe(400);
  });

  it('should return 400 when password is too short', async () => {
    const res = await request
      .post('/auth/register')
      .send({ email: 'short@example.com', password: 'short', name: 'Short Pass' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 8 characters/i);
  });
});
