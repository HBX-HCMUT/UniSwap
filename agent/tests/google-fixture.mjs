import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer } from 'node:http';

export async function startGoogleFixture() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'uniswap-acceptance';
  const clientId = 'uniswap-acceptance';
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };
  const codes = new Map();
  const tokens = new Map();
  let identity;
  let issuer;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

  const server = createServer(async (request, response) => {
    const json = (data, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(data));
    };
    try {
      const url = new URL(request.url, issuer);
      switch (url.pathname) {
        case '/.well-known/openid-configuration':
          return json({
            issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token',
            jwks_uri: issuer + '/jwks', userinfo_endpoint: issuer + '/userinfo',
            response_types_supported: ['code'], subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: ['RS256'],
            token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
            code_challenge_methods_supported: ['S256'],
          });
        case '/jwks':
          return json({ keys: [jwk] });
        case '/authorize': {
          const redirect = new URL(url.searchParams.get('redirect_uri'));
          assert.equal(url.searchParams.get('client_id'), clientId);
          assert.equal(url.searchParams.get('response_type'), 'code');
          assert.equal(redirect.hostname, '127.0.0.1');
          assert.equal(redirect.pathname, '/api/v1/auth/google/callback');
          const nonce = url.searchParams.get('nonce');
          const state = url.searchParams.get('state');
          assert.ok(nonce && state && identity);
          const code = randomUUID();
          assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
          const challenge = url.searchParams.get('code_challenge');
          assert.ok(challenge);
          codes.set(code, { ...identity, nonce, challenge, redirect: redirect.href });
          redirect.searchParams.set('code', code);
          redirect.searchParams.set('state', state);
          response.writeHead(302, { Location: redirect.href });
          return response.end();
        }
        case '/token': {
          assert.equal(request.method, 'POST');
          let body = '';
          for await (const chunk of request) body += chunk;
          const params = new URLSearchParams(body);
          const auth = request.headers.authorization;
          if (auth) {
            assert.equal(auth, 'Basic ' + Buffer.from(`${clientId}:${clientId}`).toString('base64'));
          } else {
            assert.equal(params.get('client_id'), clientId);
            assert.equal(params.get('client_secret'), clientId);
          }
          const code = params.get('code');
          const claims = codes.get(code);
          assert.ok(claims);
          codes.delete(code);
          assert.equal(params.get('grant_type'), 'authorization_code');
          assert.equal(params.get('redirect_uri'), claims.redirect);
          assert.equal(createHash('sha256').update(params.get('code_verifier')).digest('base64url'), claims.challenge);
          const payload = {
            iss: issuer, aud: clientId, sub: claims.sub, nonce: claims.nonce,
            email: claims.email, email_verified: claims.verified, hd: claims.hostedDomain ?? undefined, name: 'Hồ sơ thử OAuth',
            iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300,
          };
          const unsigned = encode({ alg: 'RS256', kid, typ: 'JWT' }) + '.' + encode(payload);
          const signature = sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
          const access = randomUUID();
          tokens.set(access, payload);
          return json({ access_token: access, token_type: 'Bearer', expires_in: 300, id_token: unsigned + '.' + signature });
        }
        case '/userinfo': {
          const profile = tokens.get(request.headers.authorization?.replace(/^Bearer /, ''));
          if (!profile) return json({ error: 'invalid_token' }, 401);
          return json(profile);
        }
        default:
          return json({ error: 'not_found' }, 404);
      }
    } catch (error) {
      console.error(`Google fixture: ${error.message}`);
      return json({ error: 'invalid_request' }, 400);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  issuer = `http://127.0.0.1:${server.address().port}`;
  return {
    issuer,
    use(email, verified = true, hostedDomain = email.split("@")[1]) {
      identity = { sub: randomUUID(), email, verified, hostedDomain };
    },
    close() {
      return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
