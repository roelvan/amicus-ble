#!/usr/bin/env python3
"""Minimal Butterfly Amicus BLE controller.

    pip install bleak
    python amicus.py info
    python amicus.py play --speed 12 --spin 5 --place 8 --bpm 40 --seconds 20
    python amicus.py stop
"""
import argparse
import asyncio
import time

from bleak import BleakClient, BleakScanner

SERVICE = "a7bdef44-a80c-11e7-abc4-cec278b6b50a"
CHAR = "a7bdf2aa-a80c-11e7-abc4-cec278b6b50a"
T0 = time.monotonic()

CMD_INFO = 0x01
CMD_STATE = 0x05
CMD_ADJUST = 0x15
CMD_LOAD_DRILL = 0x14
CMD_START = 0x20
CMD_STOP = 0x21
CMD_SET_BPM = 0x22
CMD_RANDOM = 0x25
CMD_CYCLE = 0x27
CMD_BALL_PLAYED = 0x2C


def frame(cmd, payload=b""):
    n = 4 + len(payload)
    return bytes([0x2A, n & 0xFF, n >> 8, cmd]) + bytes(payload)


def ball(trajectory=92, spin=5, side_spin=6, speed=12, place=8, freq=6):
    """7-byte ball, raw values (see PROTOCOL.md)."""
    return bytes([trajectory & 0xFF, trajectory >> 8, spin, side_spin, speed, place, freq])


def drill_payload(balls):
    p = bytearray(81)
    for i, b in enumerate(balls[:10]):
        p[1 + i * 8] = 1  # state: on
        p[2 + i * 8:9 + i * 8] = b
    return bytes(p)


class Amicus:
    def __init__(self, client):
        self.client = client
        self.buf = bytearray()
        self.waiters = {}

    def _on_notify(self, _, data):
        self.buf += data
        while len(self.buf) >= 3:
            if self.buf[0] != 0x2A:
                i = self.buf.find(0x2A)
                self.buf = self.buf[i:] if i >= 0 else bytearray()
                continue
            n = self.buf[1] | (self.buf[2] << 8)
            if len(self.buf) < n:
                break
            cmd, payload = self.buf[3], bytes(self.buf[4:n])
            self.buf = self.buf[n:]
            note = ""
            if cmd == CMD_BALL_PLAYED and len(payload) >= 3:
                t = payload[1] | (payload[2] << 8)
                note = "  LAUNCH" if t == 0 else f"  next ball in {t} ms"
            print(f"{time.monotonic() - T0:7.2f}s <- cmd 0x{cmd:02x} {payload.hex(' ')}{note}")
            fut = self.waiters.pop(cmd, None)
            if fut and not fut.done():
                fut.set_result(payload)

    async def start(self):
        await self.client.start_notify(CHAR, self._on_notify)
        await asyncio.sleep(1.0)

    async def send(self, cmd, payload=b"", reply=True, timeout=3.0):
        fut = asyncio.get_running_loop().create_future()
        if reply:
            self.waiters[cmd] = fut
        data = frame(cmd, payload)
        print(f"{time.monotonic() - T0:7.2f}s -> {data.hex(' ')}")
        await self.client.write_gatt_char(CHAR, data, response=True)
        if not reply:
            return None
        try:
            return await asyncio.wait_for(fut, timeout)
        except asyncio.TimeoutError:
            self.waiters.pop(cmd, None)
            print(f"   (no reply to 0x{cmd:02x})")
            return None


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["info", "play", "stop"])
    ap.add_argument("--trajectory", type=int, default=92)
    ap.add_argument("--spin", type=int, default=5, help="0-12, 5 = none")
    ap.add_argument("--side-spin", type=int, default=6, help="0-12, 6 = none")
    ap.add_argument("--speed", type=int, default=12, help="0-24")
    ap.add_argument("--place", type=int, default=8, help="0-16, 8 = centre")
    ap.add_argument("--bpm", type=int, default=40, help="balls/min, 5-120")
    ap.add_argument("--seconds", type=float, default=15)
    a = ap.parse_args()
    if not 5 <= a.bpm <= 120:
        ap.error("--bpm must be 5-120 (the robot refuses to play otherwise)")

    print("scanning...")
    dev = await BleakScanner.find_device_by_filter(
        lambda d, adv: SERVICE in [u.lower() for u in adv.service_uuids], timeout=10
    )
    if not dev:
        raise SystemExit("Amicus not found")
    print(f"found {dev.name} {dev.address}")

    async with BleakClient(dev) as client:
        robot = Amicus(client)
        await robot.start()
        info = await robot.send(CMD_INFO)
        if info and len(info) >= 5:
            print(f"firmware {info[3]}.{info[4]}")
        await robot.send(CMD_STATE)

        if a.action == "play":
            b = ball(a.trajectory, a.spin, a.side_spin, a.speed, a.place)
            # the robot keeps playing after a disconnect, so clear any old drill first
            await robot.send(CMD_STOP)
            # same setup sequence as the official app before a drill
            await robot.send(CMD_SET_BPM, [a.bpm])
            await robot.send(CMD_RANDOM, [0])
            await robot.send(CMD_CYCLE, [0, 40, 20])
            await robot.send(CMD_LOAD_DRILL, drill_payload([b]))
            r = await robot.send(CMD_START, [0])
            if r != b"\xf0":
                raise SystemExit(f"start refused: {r.hex() if r else 'no reply'}")
            try:
                end = time.monotonic() + a.seconds
                while time.monotonic() < end:
                    await asyncio.sleep(min(2, max(0, end - time.monotonic())))
                    await robot.send(CMD_STATE)  # keepalive, like the app
            finally:
                # also runs on Ctrl+C, otherwise the robot keeps shooting
                print("stopping...")
                await robot.send(CMD_STOP)
        elif a.action == "stop":
            await robot.send(CMD_STOP)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
