import { PrismaClient } from '@prisma/client';

// Report only aggregate state. Never print credentials, tokens or follower IDs.
const db = new PrismaClient({ log: [] });
let stage = 'configuration';
try {
  const appid = process.env.WECHAT_SERVICE_APPID;
  const secret = process.env.WECHAT_SERVICE_SECRET;
  if (!appid || !secret || !process.env.DATABASE_URL) throw new Error();
  stage = 'database';
  const followers = await db.wechatServiceFollower.count({ where: { appId: appid } });
  const pending = await db.wechatServiceFollower.count({ where: { appId: appid, needsSync: true } });
  console.log(JSON.stringify({ database: 'ok', followers, pending }));
  stage = 'wechat';
  const response = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credential', appid, secret, force_refresh: false }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  const ok = response.ok && typeof data.access_token === 'string' && data.access_token.length > 0;
  const rejectedIp = typeof data.errmsg === 'string'
    ? data.errmsg.match(/invalid ip\s+(\d{1,3}(?:\.\d{1,3}){3})/i)?.[1] : undefined;
  console.log(JSON.stringify({ wechat: ok ? 'ok' : 'failed', httpStatus: response.status, errcode: data.errcode ?? null, rejectedIp }));
  if (!ok) process.exitCode = 1;
} catch {
  console.error(JSON.stringify({ stage, error: 'Preflight failed; check configuration and connectivity' }));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
