from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from threading import Lock
from cli_core import ld, st, mk, snd, get_wallet_info

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

nonce_lock = Lock()
last_nonce_used = None

@app.on_event("startup")
async def startup():
    if not ld():
        raise Exception("Failed to load wallet")

@app.get("/wallet")
async def get_wallet():
    nonce, balance = await st()
    address, public = get_wallet_info()
    return {
        "address": address,
        "balance": balance,
        "nonce": nonce,
        "public": public
    }

@app.get("/nonce")
async def get_safe_nonce():
    nonce, _ = await st()
    return {"nonce": nonce + 1}

@app.post("/send")
async def send_tx(req: Request):
    global last_nonce_used
    body = await req.json()
    to = body.get("to", "").strip()
    amount = float(body.get("amount", 0))

    with nonce_lock:
        nonce, _ = await st()
        if last_nonce_used is None or nonce > last_nonce_used:
            last_nonce_used = nonce
        last_nonce_used += 1
        use_nonce = last_nonce_used

    tx, _ = mk(to, amount, use_nonce)
    ok, tx_hash, dt, _ = await snd(tx)
    return {
        "ok": ok,
        "hash": tx_hash,
        "time": dt
    }

@app.post("/multi-send")
async def multi_send(req: Request):
    global last_nonce_used
    body = await req.json()
    tx_list = body.get("list", [])

    with nonce_lock:
        nonce, _ = await st()
        if last_nonce_used is None or nonce > last_nonce_used:
            last_nonce_used = nonce
        base_nonce = last_nonce_used + 1
        last_nonce_used += len(tx_list)

    responses = []
    for i, tx_item in enumerate(tx_list):
        to = tx_item.get("to", "").strip()
        amount_raw = tx_item.get("amount", "").strip()

        if not to or not amount_raw:
            continue

        try:
            amount = float(amount_raw)
        except ValueError:
            continue

        tx, _ = mk(to, amount, base_nonce + i)
        ok, tx_hash, dt, _ = await snd(tx)
        responses.append({
            "to": to,
            "amount": amount,
            "ok": ok,
            "hash": tx_hash
        })
        await asyncio.sleep(0.2)  # Delay to avoid conflicts

    return {"results": responses}
