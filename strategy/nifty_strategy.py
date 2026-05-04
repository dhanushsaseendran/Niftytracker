"""
Nifty 50 Strategy Engine
========================
Runs every 5 minutes via GitHub Actions (9:15 AM – 3:30 PM IST, weekdays).

Strategy rules — HARD CONDITIONS (all 3 must be true to fire):
  1. EMA 9/15 crossover on the current 5-min candle
  2. EMA 9 angle ≥ 30° (strong slope — not a flat/choppy cross)
  3. Price within ±50 pts of a key level (confluence)

  CONFIRMATIONAL (included in push notification, do NOT block signal):
  - Candle pattern (Engulfing / Inside Bar / Marubozu)
  - VWAP position (above = bullish, below = bearish)
  - Bank Nifty EMA 9/15 alignment
  - Sensex EMA 9/15 alignment
  - SSL/BSL distance warning (< 50 pts = reversal risk)
  - Market Trend (manually set by user each day)

Usage:
  python nifty_strategy.py

Required env vars (set as GitHub Actions secrets):
  DHAN_CLIENT_ID      – Dhan API client ID
  DHAN_ACCESS_TOKEN   – Dhan API Bearer token
  FCM_SERVER_KEY      – Firebase Cloud Messaging server key
  FCM_DEVICE_TOKEN    – Target device FCM registration token
  NIFTY_LEVELS        – Comma-separated key levels
  SENSEX_SEC_ID       – Dhan security ID for Sensex (default: 51)
"""

import os
import json
import math
import requests
from datetime import datetime, timezone, timedelta

# ── IST timezone ─────────────────────────────────────────────────────────────
IST = timezone(timedelta(hours=5, minutes=30))

# ── Dhan API constants ────────────────────────────────────────────────────────
DHAN_BASE        = "https://api.dhan.co"
NIFTY_SEC_ID     = "13"      # Dhan security ID for Nifty 50 index
BANKNIFTY_SEC_ID = "25"      # Dhan security ID for Bank Nifty index
SENSEX_SEC_ID    = "51"      # Dhan security ID for Sensex (BSE)
EXCHANGE_NSE     = "NSE_FNO"
EXCHANGE_BSE     = "BSE"
INTERVAL         = "5"       # 5-minute candles
CANDLES_NEEDED   = 40        # How many candles to fetch

# ── Strategy parameters ───────────────────────────────────────────────────────
EMA_FAST        = 9
EMA_SLOW        = 15
MIN_ANGLE_DEG   = 30         # Minimum EMA slope angle (degrees)
LEVEL_CONFLUENCE= 50         # Max distance from key level (points)
BODY_RATIO      = 0.6        # Minimum body/range for Marubozu

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def ema(prices: list[float], period: int) -> list[float]:
    """Exponential Moving Average."""
    k = 2 / (period + 1)
    result = []
    for i, p in enumerate(prices):
        if i == 0:
            result.append(p)
        else:
            result.append(p * k + result[-1] * (1 - k))
    return result


def ema_angle(ema_values: list[float], lookback: int = 5) -> float:
    """
    Approximate slope angle of EMA in degrees using the last `lookback` values.
    Each bar = 5 minutes, so x-axis is in minutes.
    """
    if len(ema_values) < lookback:
        return 0.0
    pts = ema_values[-lookback:]
    n   = len(pts)
    xs  = list(range(n))
    mean_x = sum(xs) / n
    mean_y = sum(pts) / n
    numer  = sum((xs[i] - mean_x) * (pts[i] - mean_y) for i in range(n))
    denom  = sum((xs[i] - mean_x) ** 2 for i in range(n))
    slope  = numer / denom if denom != 0 else 0
    # Normalise: slope is in price/bar; convert to degrees assuming
    # 1 bar ≈ 5 min and price scale relative to mean
    norm_slope = slope / (mean_y / 100) if mean_y else slope
    return math.degrees(math.atan(norm_slope))


def detect_candle_pattern(candles: list[dict]) -> str | None:
    """
    Detect entry candle pattern from the last 2 candles.
    Returns pattern name or None.
    """
    if len(candles) < 2:
        return None

    prev = candles[-2]
    curr = candles[-1]

    p_open, p_close = prev['open'], prev['close']
    c_open, c_close = curr['open'], curr['close']
    c_high, c_low   = curr['high'],  curr['low']

    p_bull = p_close > p_open
    c_bull = c_close > c_open

    p_body  = abs(p_close - p_open)
    c_body  = abs(c_close - c_open)
    c_range = c_high - c_low if c_high != c_low else 0.001

    # ── Bullish Engulfing ────────────────────────────────────────────────────
    if (not p_bull) and c_bull and c_open < p_close and c_close > p_open:
        return "Bullish Engulfing"

    # ── Bearish Engulfing ────────────────────────────────────────────────────
    if p_bull and (not c_bull) and c_open > p_close and c_close < p_open:
        return "Bearish Engulfing"

    # ── Bullish Inside Bar Breakout ──────────────────────────────────────────
    p_high, p_low = prev['high'], prev['low']
    if c_high <= p_high and c_low >= p_low and c_close > p_high * 0.999:
        return "Inside Bar Breakout (Bull)"

    # ── Bearish Inside Bar Breakout ──────────────────────────────────────────
    if c_high <= p_high and c_low >= p_low and c_close < p_low * 1.001:
        return "Inside Bar Breakout (Bear)"

    # ── Bullish Marubozu ─────────────────────────────────────────────────────
    if c_bull and c_range > 0 and (c_body / c_range) >= BODY_RATIO:
        if (c_close - c_high) < c_range * 0.1 and (c_open - c_low) < c_range * 0.1:
            return "Bullish Marubozu"

    # ── Bearish Marubozu ─────────────────────────────────────────────────────
    if (not c_bull) and c_range > 0 and (c_body / c_range) >= BODY_RATIO:
        if (c_high - c_open) < c_range * 0.1 and (c_close - c_low) < c_range * 0.1:
            return "Bearish Marubozu"

    return None


def nearest_level_distance(price: float, levels: list[float]) -> float:
    """Return distance to closest key level."""
    if not levels:
        return float('inf')
    return min(abs(price - lvl) for lvl in levels)


def detect_bsl_ssl(candles: list[dict], lookback: int = 20) -> dict:
    """
    Identify Buy-Side and Sell-Side liquidity levels from recent swing highs/lows.
    BSL = highest recent swing high (buy-side liquidity above price).
    SSL = lowest recent swing low  (sell-side liquidity below price).
    """
    recent = candles[-lookback:]
    highs  = [c['high']  for c in recent]
    lows   = [c['low']   for c in recent]
    bsl    = max(highs)
    ssl    = min(lows)
    return {'bsl': bsl, 'ssl': ssl}


def vwap(candles: list[dict]) -> float:
    """Session VWAP from provided candles."""
    tp_vol = sum(((c['high'] + c['low'] + c['close']) / 3) * c['volume'] for c in candles)
    total_vol = sum(c['volume'] for c in candles)
    return tp_vol / total_vol if total_vol else 0


# ─────────────────────────────────────────────────────────────────────────────
# Dhan API
# ─────────────────────────────────────────────────────────────────────────────

def fetch_candles(security_id: str, exchange: str) -> list[dict]:
    """Fetch last N 5-min candles from Dhan API."""
    client_id    = os.environ["DHAN_CLIENT_ID"]
    access_token = os.environ["DHAN_ACCESS_TOKEN"]

    now    = datetime.now(IST)
    # Today or last trading day
    from_dt = now.replace(hour=9, minute=15, second=0, microsecond=0)
    to_dt   = now

    headers = {
        "access-token": access_token,
        "client-id":    client_id,
        "Content-Type": "application/json",
    }
    payload = {
        "securityId":   security_id,
        "exchangeSegment": exchange,
        "instrument":   "INDEX",
        "interval":     INTERVAL,
        "oi":           False,
        "fromDate":     from_dt.strftime("%Y-%m-%d %H:%M:%S"),
        "toDate":       to_dt.strftime("%Y-%m-%d %H:%M:%S"),
    }

    resp = requests.post(
        f"{DHAN_BASE}/v2/charts/intraday",
        json=payload, headers=headers, timeout=10
    )
    if resp.status_code == 401:
        print(f"[Dhan] 401 Unauthorized — check DHAN_ACCESS_TOKEN secret. Response: {resp.text[:200]}")
        raise SystemExit(1)
    resp.raise_for_status()
    data = resp.json()

    # Dhan returns parallel arrays
    candles = []
    for i, ts in enumerate(data.get("timestamp", [])):
        candles.append({
            "timestamp": ts,
            "open":   data["open"][i],
            "high":   data["high"][i],
            "low":    data["low"][i],
            "close":  data["close"][i],
            "volume": data.get("volume", [0] * len(data["timestamp"]))[i],
        })
    return candles


# ─────────────────────────────────────────────────────────────────────────────
# FCM Push
# ─────────────────────────────────────────────────────────────────────────────

def send_fcm_push(title: str, body: str, data: dict | None = None) -> bool:
    """Send Firebase Cloud Messaging push notification."""
    server_key   = os.environ.get("FCM_SERVER_KEY", "")
    device_token = os.environ.get("FCM_DEVICE_TOKEN", "")

    if not server_key or not device_token:
        print("[FCM] Missing FCM_SERVER_KEY or FCM_DEVICE_TOKEN — skipping push")
        return False

    payload = {
        "to": device_token,
        "notification": {"title": title, "body": body, "sound": "default"},
        "data": data or {},
        "priority": "high",
    }
    resp = requests.post(
        "https://fcm.googleapis.com/fcm/send",
        json=payload,
        headers={
            "Authorization": f"key={server_key}",
            "Content-Type": "application/json",
        },
        timeout=10,
    )
    print(f"[FCM] Response {resp.status_code}: {resp.text}")
    return resp.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# Main strategy logic
# ─────────────────────────────────────────────────────────────────────────────

def run_strategy():
    now_ist = datetime.now(IST)
    print(f"[Strategy] Running at {now_ist.strftime('%Y-%m-%d %H:%M:%S IST')}")

    # ── Market hours guard ────────────────────────────────────────────────────
    market_open  = now_ist.replace(hour=9,  minute=15, second=0, microsecond=0)
    market_close = now_ist.replace(hour=15, minute=30, second=0, microsecond=0)
    if not (market_open <= now_ist <= market_close):
        print("[Strategy] Outside market hours. Exiting.")
        return

    if now_ist.weekday() >= 5:   # Saturday / Sunday
        print("[Strategy] Weekend. Exiting.")
        return

    # ── Load key levels from env ──────────────────────────────────────────────
    default_levels = (
        "21459.00,21726.50,21804.45,22202.15,22447.55,22499.05,22526.60,"
        "22558.05,22613.30,22697.30,22910.15,22993.60,23144.70,23183.35,"
        "23340.95,23558.10,23656.80,23915.35,24350.05,24355.10,24363.00,"
        "24368.25,24585.50,24595.20,24638.80,24781.25,24885.50,24944.80,"
        "25021.55,25029.50,25062.90,25095.95,25108.10,25199.30,25246.25,"
        "25266.80,25331.70,25333.65,25482.20,25524.05,25653.30,25697.00,"
        "25934.35,25993.35,26098.25,26246.65,26340.00"
    )
    nifty_levels_str = os.environ.get("NIFTY_LEVELS", default_levels)
    nifty_levels = [float(x.strip()) for x in nifty_levels_str.split(",") if x.strip()]

    # ── Fetch candles for Nifty, Bank Nifty, Sensex ──────────────────────────
    print("[Strategy] Fetching Nifty candles…")
    nifty_candles = fetch_candles(NIFTY_SEC_ID, EXCHANGE_NSE)

    print("[Strategy] Fetching Bank Nifty candles…")
    bank_candles  = fetch_candles(BANKNIFTY_SEC_ID, EXCHANGE_NSE)

    print("[Strategy] Fetching Sensex candles…")
    sensex_sec    = os.environ.get("SENSEX_SEC_ID", SENSEX_SEC_ID)
    sensex_candles = fetch_candles(sensex_sec, EXCHANGE_BSE)

    if len(nifty_candles) < EMA_SLOW + 2:
        print(f"[Strategy] Not enough candles ({len(nifty_candles)}). Need {EMA_SLOW + 2}.")
        return

    # ── Compute Nifty indicators ──────────────────────────────────────────────
    closes     = [c['close'] for c in nifty_candles]
    ema9_vals  = ema(closes, EMA_FAST)
    ema15_vals = ema(closes, EMA_SLOW)

    ema9_now   = ema9_vals[-1];   ema9_prev  = ema9_vals[-2]
    ema15_now  = ema15_vals[-1];  ema15_prev = ema15_vals[-2]
    angle9     = ema_angle(ema9_vals)

    price_now  = closes[-1]
    vwap_val   = vwap(nifty_candles)
    pattern    = detect_candle_pattern(nifty_candles)
    level_dist = nearest_level_distance(price_now, nifty_levels)
    liq        = detect_bsl_ssl(nifty_candles)

    # ── BSL / SSL warning (informational — NOT blocking) ─────────────────────
    ssl_dist   = price_now - liq['ssl']   # points above sell-side liquidity
    bsl_dist   = liq['bsl'] - price_now   # points below buy-side liquidity
    ssl_warn   = ssl_dist < LEVEL_CONFLUENCE   # within 50 pts → reversal risk
    bsl_warn   = bsl_dist < LEVEL_CONFLUENCE

    # ── Bank Nifty confirmation (HARD flag) ───────────────────────────────────
    bank_closes = [c['close'] for c in bank_candles] if bank_candles else []
    bank_e9     = ema(bank_closes, EMA_FAST)  if len(bank_closes) > EMA_SLOW else []
    bank_e15    = ema(bank_closes, EMA_SLOW)  if len(bank_closes) > EMA_SLOW else []
    bank_bull   = bool(bank_e9)  and bank_e9[-1]  > bank_e15[-1]
    bank_bear   = bool(bank_e9)  and bank_e9[-1]  < bank_e15[-1]

    # ── Sensex confirmation (HARD flag) ──────────────────────────────────────
    sensex_closes = [c['close'] for c in sensex_candles] if sensex_candles else []
    sx_e9         = ema(sensex_closes, EMA_FAST) if len(sensex_closes) > EMA_SLOW else []
    sx_e15        = ema(sensex_closes, EMA_SLOW) if len(sensex_closes) > EMA_SLOW else []
    sensex_bull   = bool(sx_e9) and sx_e9[-1] > sx_e15[-1]
    sensex_bear   = bool(sx_e9) and sx_e9[-1] < sx_e15[-1]

    # ── EMA crossover ─────────────────────────────────────────────────────────
    bull_cross = ema9_prev <= ema15_prev and ema9_now > ema15_now
    bear_cross = ema9_prev >= ema15_prev and ema9_now < ema15_now
    above_vwap = price_now > vwap_val
    below_vwap = price_now < vwap_val

    print(f"  Price:        {price_now:.2f}")
    print(f"  EMA9:         {ema9_now:.2f}  (angle {angle9:.1f}°)")
    print(f"  EMA15:        {ema15_now:.2f}")
    print(f"  VWAP:         {vwap_val:.2f}  ({'above' if above_vwap else 'below'})")
    print(f"  Pattern:      {pattern}")
    print(f"  Level dist:   {level_dist:.1f} pts")
    print(f"  SSL dist:     {ssl_dist:.1f} pts {'⚠ WARN' if ssl_warn else '✓ safe'}")
    print(f"  BSL dist:     {bsl_dist:.1f} pts {'⚠ WARN' if bsl_warn else '✓ safe'}")
    print(f"  Bank Nifty:   {'✓ bull' if bank_bull else ('✓ bear' if bank_bear else '✗ unclear')}")
    print(f"  Sensex:       {'✓ bull' if sensex_bull else ('✓ bear' if sensex_bear else '✗ unclear')}")

    signal = None

    # ══════════════════════════════════════════════════════════════════════════
    # HARD CONDITIONS — signal fires only if ALL 3 are true:
    #   1. EMA 9/15 crossover on this candle
    #   2. EMA 9 angle ≥ 30° (strong momentum, not a flat/weak cross)
    #   3. Price within ±50 pts of a key level (confluence)
    # Everything else is confirmational — sent in the push but does NOT block.
    # ══════════════════════════════════════════════════════════════════════════

    # ── BUY ──────────────────────────────────────────────────────────────────
    if (bull_cross                       # 1. 9 EMA crossed above 15 EMA
            and angle9 >= MIN_ANGLE_DEG  # 2. slope ≥ +30°
            and level_dist <= LEVEL_CONFLUENCE):  # 3. within 50 pts of key level
        signal = "BUY"

    # ── SELL ─────────────────────────────────────────────────────────────────
    elif (bear_cross                      # 1. 9 EMA crossed below 15 EMA
            and angle9 <= -MIN_ANGLE_DEG  # 2. slope ≤ -30°
            and level_dist <= LEVEL_CONFLUENCE):  # 3. within 50 pts of key level
        signal = "SELL"

    # ── Build warnings string ─────────────────────────────────────────────────
    warnings = []
    if ssl_warn: warnings.append(f"⚠ SSL only {ssl_dist:.0f} pts away — reversal risk below")
    if bsl_warn: warnings.append(f"⚠ BSL only {bsl_dist:.0f} pts away — reversal risk above")

    # ── Fire push ─────────────────────────────────────────────────────────────
    if signal:
        # Find nearest support/resistance from key levels for the notification
        levels_below = sorted([l for l in nifty_levels if l < price_now], reverse=True)
        levels_above = sorted([l for l in nifty_levels if l >= price_now])
        nearest_sup  = levels_below[0] if levels_below else None
        nearest_res  = levels_above[0] if levels_above else None

        time_str  = now_ist.strftime("%H:%M")
        emoji     = "🟢" if signal == "BUY" else "🔴"
        title     = f"{emoji} NIFTY 50 {signal} @ {price_now:.2f}"

        # Confirmation summary lines
        vwap_conf    = f"VWAP: {'Above ✓' if above_vwap else 'Below ✗'}"
        bank_conf    = f"Bank Nifty: {'Aligned ✓' if (bank_bull if signal=='BUY' else bank_bear) else 'Not aligned ✗'}"
        sensex_conf  = f"Sensex: {'Aligned ✓' if (sensex_bull if signal=='BUY' else sensex_bear) else 'Not aligned ✗'}"
        pattern_conf = f"Pattern: {pattern if pattern else 'None'}"
        angle_conf   = f"Angle: {angle9:.1f}°"
        warn_str     = ("\n" + "\n".join(warnings)) if warnings else ""

        body = (
            f"Key Level: {nearest_sup if signal=='BUY' else nearest_res} "
            f"({level_dist:.0f} pts away) | {time_str} IST\n"
            f"EMA9: {ema9_now:.2f}  EMA15: {ema15_now:.2f}  {angle_conf}\n"
            f"\n— Confirmations —\n"
            f"{pattern_conf}\n"
            f"{vwap_conf}  {bank_conf}\n"
            f"{sensex_conf}\n"
            f"SSL: {ssl_dist:.0f} pts  BSL: {bsl_dist:.0f} pts"
            f"{warn_str}"
        )
        push_data = {
            "signal":       signal,
            "pattern":      pattern,
            "price":        str(price_now),
            "ema9":         str(round(ema9_now,  2)),
            "ema15":        str(round(ema15_now, 2)),
            "bsl":          str(round(liq['bsl'], 2)),
            "ssl":          str(round(liq['ssl'], 2)),
            "bsl_dist":     str(round(bsl_dist, 1)),
            "ssl_dist":     str(round(ssl_dist, 1)),
            "bsl_warn":     str(bsl_warn),
            "ssl_warn":     str(ssl_warn),
            "bank_confirm": str(bank_bull if signal == "BUY" else bank_bear),
            "sensex_confirm": str(sensex_bull if signal == "BUY" else sensex_bear),
            "timestamp": now_ist.isoformat(),
        }
        print(f"\n[Strategy] *** {signal} SIGNAL FIRED ***")
        print(f"  {title}")
        print(f"  {body}")
        send_fcm_push(title, body, push_data)

        # Persist signal to signals.json
        try:
            sig_file = "signals.json"
            existing = []
            try:
                with open(sig_file) as f:
                    existing = json.load(f)
            except FileNotFoundError:
                pass
            existing.insert(0, {**push_data, "title": title, "body": body})
            existing = existing[:50]
            with open(sig_file, "w") as f:
                json.dump(existing, f, indent=2)
            print(f"[Strategy] Signal written to {sig_file}")
        except Exception as e:
            print(f"[Strategy] Could not write signals.json: {e}")

    else:
        print("\n[Strategy] No signal this bar.")

    # ── Always write live-data.json (read by PWA every 5 min) ────────────────
    # Determine display signal: shows current EMA bias even between crossovers
    if ema9_now > ema15_now and angle9 >= MIN_ANGLE_DEG and level_dist <= LEVEL_CONFLUENCE:
        display_signal = "STRONG BUY"
    elif ema9_now > ema15_now:
        display_signal = "BUY"
    elif ema9_now < ema15_now and angle9 <= -MIN_ANGLE_DEG and level_dist <= LEVEL_CONFLUENCE:
        display_signal = "STRONG SELL"
    elif ema9_now < ema15_now:
        display_signal = "SELL"
    else:
        display_signal = "NEUTRAL"

    # Nearest support / resistance from key levels
    levels_below = sorted([l for l in nifty_levels if l < price_now], reverse=True)
    levels_above = sorted([l for l in nifty_levels if l >= price_now])
    nearest_sup  = levels_below[0] if levels_below else None
    nearest_res  = levels_above[0] if levels_above else None
    sup_dist     = round(price_now - nearest_sup, 2) if nearest_sup else None
    res_dist     = round(nearest_res - price_now, 2) if nearest_res else None

    # Candle OHLC for the day
    day_open  = nifty_candles[0]['open']  if nifty_candles else 0
    day_high  = max(c['high']  for c in nifty_candles) if nifty_candles else 0
    day_low   = min(c['low']   for c in nifty_candles) if nifty_candles else 0
    day_chg   = round(price_now - day_open, 2)
    day_chgpct= round((day_chg / day_open) * 100, 2) if day_open else 0

    # Bank Nifty price
    bank_price   = bank_closes[-1]   if bank_closes   else 0
    bank_open    = bank_candles[0]['open'] if bank_candles else 0
    bank_chg     = round(bank_price - bank_open, 2)
    bank_chgpct  = round((bank_chg / bank_open) * 100, 2) if bank_open else 0

    # Sensex price
    sx_price     = sensex_closes[-1] if sensex_closes else 0
    sx_open      = sensex_candles[0]['open'] if sensex_candles else 0
    sx_chg       = round(sx_price - sx_open, 2)
    sx_chgpct    = round((sx_chg / sx_open) * 100, 2) if sx_open else 0

    live = {
        "timestamp":   now_ist.isoformat(),
        "marketOpen":  True,
        # ── Nifty ──────────────────────────────────────────────────────────────
        "price":       round(price_now, 2),
        "open":        round(day_open,  2),
        "high":        round(day_high,  2),
        "low":         round(day_low,   2),
        "change":      day_chg,
        "changePct":   day_chgpct,
        # ── Signal ─────────────────────────────────────────────────────────────
        "signal":      display_signal,
        "crossover":   signal,           # "BUY" | "SELL" | null — fired this bar
        # ── Indicators ─────────────────────────────────────────────────────────
        "ema9":        round(ema9_now,   2),
        "ema15":       round(ema15_now,  2),
        "ema9Angle":   round(angle9,     1),
        "emaStatus":   "Positive" if ema9_now > ema15_now else "Negative",
        "vwap":        round(vwap_val,   2),
        "vwapStatus":  "Positive" if above_vwap else "Negative",
        # ── Key Levels ─────────────────────────────────────────────────────────
        "nearestSupport":    nearest_sup,
        "nearestResistance": nearest_res,
        "supportDist":       sup_dist,
        "resistanceDist":    res_dist,
        "keyLevelStatus":    "Positive" if (sup_dist and sup_dist <= LEVEL_CONFLUENCE) or
                                           (res_dist and res_dist <= LEVEL_CONFLUENCE) else "Negative",
        "levelDist":         round(level_dist, 2),
        # ── SSL / BSL ──────────────────────────────────────────────────────────
        "ssl":         round(liq['ssl'], 2),
        "bsl":         round(liq['bsl'], 2),
        "sslDist":     round(ssl_dist,   2),
        "bslDist":     round(bsl_dist,   2),
        "sslWarn":     ssl_warn,
        "bslWarn":     bsl_warn,
        # ── Bank Nifty ─────────────────────────────────────────────────────────
        "bankNifty": {
            "price":     round(bank_price,  2),
            "change":    bank_chg,
            "changePct": bank_chgpct,
            "ema9":      round(bank_e9[-1],  2) if bank_e9  else None,
            "ema15":     round(bank_e15[-1], 2) if bank_e15 else None,
            "status":    "Positive" if bank_bull else "Negative",
        },
        # ── Sensex ─────────────────────────────────────────────────────────────
        "sensex": {
            "price":     round(sx_price,   2),
            "change":    sx_chg,
            "changePct": sx_chgpct,
            "ema9":      round(sx_e9[-1],  2) if sx_e9  else None,
            "ema15":     round(sx_e15[-1], 2) if sx_e15 else None,
            "status":    "Positive" if sensex_bull else "Negative",
        },
        # ── Candle pattern ─────────────────────────────────────────────────────
        "pattern":     pattern,
        "trendStatus": "Neutral",   # user sets this manually in the app
    }

    try:
        with open("live-data.json", "w") as f:
            json.dump(live, f, indent=2)
        print(f"[Strategy] live-data.json written — price {price_now:.2f} | signal {display_signal}")
    except Exception as e:
        print(f"[Strategy] Could not write live-data.json: {e}")


if __name__ == "__main__":
    run_strategy()
