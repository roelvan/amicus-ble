# Butterfly Amicus – BLE protocol

Reverse engineered from `tt.butterfly.amicus.apk` (classes `q`, `s`, `b`, `w`, `n`, `q0` in package `tt.butterfly.amicus`).

## GATT

| Item | UUID |
|---|---|
| Service | `a7bdef44-a80c-11e7-abc4-cec278b6b50a` |
| Characteristic (write + notify/indicate) | `a7bdf2aa-a80c-11e7-abc4-cec278b6b50a` |

- Scan with a filter on the service UUID.
- After connect: enable notifications (CCCD `0x2902`), request MTU 517, wait ~1 s.
- All commands are written to the one characteristic. All replies come back as notifications on it.

## Frame format (both directions)

```
0x2A | len_lo | len_hi | cmd | payload...
```

- `len` = total frame length including the 4 header bytes, little endian.
- No checksum.
- A reply has the same `cmd` byte as the request (with exceptions noted below).
- A reply payload of exactly `[0x07]` means "bad data / protocol error".
- Many replies are a single status byte: `0xF0` = OK (`0x00` = OK on old firmware),
  `0xF1` invalid ball state, `0xF2` invalid ball number, `0xF3` invalid ball parameter,
  `0xF4` cannot play, `0xFA` cannot set.

## Ball encoding (8 bytes)

| Byte | Field | Raw range | UI meaning |
|---|---|---|---|
| 0–1 | trajectory (u16 LE) | 0–153 | head angle / height |
| 2 | spin | 0–12 | −5 … +7 (raw 5 = no spin) |
| 3 | side spin | 0–12 | −90° … +90° in 15° steps (raw 6 = none) |
| 4 | speed | 0–24 | 1 … 25 |
| 5 | place | 0–16 | −8 … +8 left/right (raw 8 = centre). Bits 5–7: random range (0–7), only fw major > 5 |
| 6 | frequency | 0–12 | −60 % … +60 % in 10 % steps (raw 6 = 0 %) |
| 7 | state | 0/1/2 | 0 = empty/off, 1 = on, 2 = random-group |

App defaults: `92, 5, 6, 12, 8, 6, state 1`. Built-in "unload" ball: `153, 2, 6, 0, 8, 6`. "Pass" ball: `141, 7, 6, 8, 4, 6`.

Some commands use the 7-byte form (bytes 0–6, no state byte) with the state sent separately.

## Commands

### Core (enough for a simple remote)

| Cmd | Hex | Name | Payload | Reply |
|---|---|---|---|---|
| 1 | 0x01 | Get device info | – | 7 bytes: `[a, b, c, fw_major, fw_minor, id_lo, id_hi]` |
| 5 | 0x05 | Get state | – | 1 byte state (see below). App polls this ~2 s after each write as keepalive |
| 20 | 0x14 | Load drill (up to 10 balls) | 81 bytes: `0x00`, then 10 × `[state, 7-byte ball]` (unused = zeros) | status |
| 32 | 0x20 | Start drill | `[0x00]` (app also uses `[0x02]` for an alternate start mode) | status |
| 33 | 0x21 | Stop | – | status |
| 34 | 0x22 | Set balls/min | `[n]`, 5–120 (app default 40). Out of range is echoed but start then fails with `0xF4` | echo |
| 43 | 0x2B | Get balls/min | – | `[n]` |
| 21 | 0x15 | Live adjust while playing | `[param, delta]`; param 0 = trajectory, 1 = spin, 3 = speed; delta `0x01` = +1, `0xFF` = −1 | status |

Simple drill, same order as the app: `cmd 34 [bpm]` → `cmd 37 [0]` (random off) → `cmd 39 [0, 40, 20]` (cycle off) → `cmd 20` → `cmd 32 [0]` → … → `cmd 33`.

### Single ball preview (ball editor)

| Cmd | Hex | Payload |
|---|---|---|
| 18 | 0x12 | Load single ball: `[0x01, state, 7-byte ball]` |
| 17 | 0x11 | Select ball: `[0x01]` |
| 34 | 0x22 | Balls/min `[20]` |
| 35 | 0x23 | Start single-ball play (2 s timeout in app) |

### Exercise / program upload (multi-sequence, "games")

1. For slot `s` = 101 … 110 (one per sequence, max 10):
   - used slot: `cmd 49 (0x31)` payload `[s, 10 × 8-byte ball]` (81 bytes). Timeout 10 s. Reply: status.
   - empty slot: `cmd 50 (0x32)` payload `[s]`. Reply `[s, status]`.
2. `cmd 57 (0x39)` payload 31 bytes: `0x01`, then per slot `[mode, play, delay]`;
   mode 0 = cycle off, 1 = on, 2 = on + ball mode.
3. `cmd 39 (0x27)` global cycle: `[mode, play, delay]`; mode 0 = off, 1 = on, 2 = ball mode, 3 = sequence mode.
   `play` and `delay` are in seconds (or balls, in ball mode). Default `40, 20`.
4. `cmd 41 (0x29)` payload `[0x01]` = start. Reply on cmd 41 or cmd 5.
5. Stop: `cmd 33`.

### Settings / misc

| Cmd | Hex | Name | Payload / reply |
|---|---|---|---|
| 3 | 0x03 | Recalibrate | – ; reply arrives as cmd 5 |
| 24 | 0x18 | Get trajectory calibration | reply 4 bytes |
| 25 | 0x19 | Set trajectory calibration | 4 bytes `[a, b, c, d]` |
| 26 | 0x1A | Calibration mode | `[1]` on / `[0]` off |
| 27 | 0x1B | Unknown query (fw ≥ 6.18) | reply `[?, value]` |
| 28 | 0x1C | Unknown setting | `[n]` |
| 30 | 0x1E | Wait mode | `[0/1]`; reply = device info |
| 31 | 0x1F | Set "pass" ball | `[0x01, state, 7-byte ball]` |
| 36 | 0x24 | Unknown play cmd | – |
| 37 | 0x25 | Random mode flags | bitmask: 1 = random type, 2 = place rnd, 4 = place RND |
| 85 | 0x55 | Physical remote mode | `[0]` disabled, `[1]` message only, `[2]` can control |
| 80 | 0x50 | Unknown (reply on cmd 83) | – |
| 64 | 0x40 | Enter bootloader (firmware update) | – **do not use** |
| 65 | 0x41 | Firmware block | `[idx_lo, idx_hi, 128 bytes]` **do not use** |
| 66 | 0x42 | Finish firmware update | **do not use** |

### Notifications from the robot (unsolicited)

| Cmd | Hex | Meaning | Payload |
|---|---|---|---|
| 44 | 0x2C | Ball event | `[ball_index, t_lo, t_hi, x]`. t = 0: ball launched now. t > 0: sent with each launch; meaning unknown (6000 at 5 balls/min, not the interval). Sent also when no app is connected and the robot still plays |
| 7 | 0x07 | Robot error | `[code]` – app treats as state 10 = error |
| 84 | 0x54 | Physical remote button | `[?, button]` |
| 58, 59 | 0x3A, 0x3B | Progress events (sequence/cycle) | – |

### States (cmd 5 reply)

| Value | Meaning (from app logic) |
|---|---|
| 2 | not playing a drill started over BLE (also seen while an old drill still ran) |
| 3 | playing (confirmed after cmd 32) |
| 4 | stopping |
| 10 | error |
| 15 | waiting for sound trigger |
| 64 | bootloader |

## Tested behaviour (fw 7.1)

- The robot keeps playing after the BLE connection drops. Send cmd 33 before a new drill and before you disconnect.
- `cmd 34 [5]` gave one launch every ~11 s, so the value is about balls per minute.
- Each cmd 5 request gets two identical replies.

## Landing model of the official app

The robot does not report where a ball lands. The app computes it (classes `t0`, `l1`, view `TablePreviewView`).

Coordinates in metres: x = across the table, y = height above the table, z = along the table (net at 0, player half z > 0).
Launch point (robot head): `(0, 0.2, -1.26)`.

Launch velocity from a ball (`t0.e`):

- Base speed in m/s from speed `s` (0–24): `s>=19: ((s-18)*0.2+6.45)*1.2`, `s>=11: ((s-10)*0.25+4.45)*1.2`,
  `10: 5.34`, `9: 4.92`, `8: 4.5`, `s<8: (3.75-(8-s)*0.2)*1.2`.
- Multiply by `SPEED_FAC[spin][s] / 100` (13 × 25 table).
- Elevation = `asin((trajectory + ANGLE_CORR[spin][s] - 90) * 0.05 / 14 + 0.25)` (13 × 25 table).
- Azimuth: `p = place - 8`; `a = p + sign(p)*(1 + 0.36·[|p|>1] + 0.216·[|p|>2])`; azimuth = `-a * 2.2°`.
- Velocity = `(sin az·cos el, sin el, cos az·cos el) · v`.
- Side spin and frequency are not used. Spin only acts through the two tables.

Flight (`l1.e`), step 0.01 s until y ≤ 0: `pos += vel·dt`; `vel -= vel · (0.1253 · |vel| · dt)`
(drag constant `3.383181128650849e-4 / 0.0027`); `vel.y -= 9.80665·dt`. No net or table collision.

Both tables are copied into `web/index.html` (`SPEED_FAC`, `ANGLE_CORR`).
Examples: default ball (92, 5, 6, 12, 8) lands 85 cm behind the net; place 0 or 16 lands 76 cm to the side and 71 cm behind the net.
