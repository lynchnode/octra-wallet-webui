import json, base64, hashlib, time, random
import aiohttp
from datetime import datetime
import nacl.signing

μ = 1_000_000
session = None

priv = addr = rpc = None
sk = pub = None

h = []  # history

def ld():
    global priv, addr, rpc, sk, pub
    with open('../wallet.json') as f:
        d = json.load(f)
    priv = d['priv']
    addr = d['addr']
    rpc = d.get('rpc', 'https://octra.network')
    sk = nacl.signing.SigningKey(base64.b64decode(priv))
    pub = base64.b64encode(sk.verify_key.encode()).decode()
    return True

async def req(m, p, d=None, t=10):
    global session
    if not session:
        session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=t))
    url = f"{rpc}{p}"
    try:
        async with getattr(session, m.lower())(url, json=d if m == 'POST' else None) as resp:
            text = await resp.text()
            try:
                return resp.status, text, json.loads(text)
            except:
                return resp.status, text, None
    except Exception as e:
        return 0, str(e), None

async def st():
    _, _, j = await req('GET', f'/balance/{addr}')
    nonce = int(j.get('nonce', 0)) if j else 0
    balance = float(j.get('balance', 0)) if j else 0
    return nonce, balance

async def gh():
    _, _, j = await req('GET', f'/address/{addr}?limit=20')
    return j.get('recent_transactions', []) if j else []

def mk(to, amount, nonce):
    tx = {
        "from": addr,
        "to_": to,
        "amount": str(int(amount * μ)),
        "nonce": int(nonce),
        "ou": "1" if amount < 1000 else "3",
        "timestamp": time.time() + random.random() * 0.01
    }
    bl = json.dumps(tx, separators=(",", ":"))
    sig = base64.b64encode(sk.sign(bl.encode()).signature).decode()
    tx.update(signature=sig, public_key=pub)
    return tx, hashlib.sha256(bl.encode()).hexdigest()

async def snd(tx):
    t0 = time.time()
    s, t, j = await req('POST', '/send-tx', tx)
    dt = time.time() - t0

    print("[DEBUG] tx:", json.dumps(tx, indent=2))
    print("[DEBUG] status:", s)
    print("[DEBUG] raw response:", t)
    print("[DEBUG] response json:", j)

    if s == 200 and j and j.get('status') == 'accepted':
        return True, j.get('tx_hash', ''), dt, j
    elif s == 200 and isinstance(t, str) and t.lower().startswith('ok'):
        return True, t.split()[-1], dt, None
    else:
        return False, json.dumps(j) if j else t, dt, j

def get_wallet_info():
    return addr, pub
