# Butterfly Amicus Android app (tt.butterfly.amicus 1.3.2, versionCode 226) — rebuild specification

Source: jadx output in `scratchpad/jadx`. Paths below are relative to
`jadx/sources/tt/butterfly/amicus/` (Java) and `jadx/resources/res/` (resources) unless stated.
Line numbers are those of the jadx `.java` files. "Ambiguous" marks places where jadx output is
garbled ("Code duplicated" warnings) or the intent cannot be proven.

Read together with `/Users/roel/Downloads/amicus-ble/PROTOCOL.md`. Section 9 lists corrections to it.

---------------------------------------------------------------------------------------------------

## 0. Class map (obfuscated name → role)

| Class | Role |
|---|---|
| `MainActivity` | Single activity; bottom navigation; owns gameset + BLE manager; Info-tab button handlers (`android:onClick`) |
| `u6/h` | Per-tab fragment stack manager (4 tabs × stack) |
| `ExercisesFragment`, `b0` (row), `i1` (sequence-picker row adapter) | Tab 0 list |
| `a0` | Exercise editor/player (single exercise, or one slot of a sequence) |
| `j1` | Sequence editor/player |
| `f1` + `g1` (adapter) | Tab 1 robot scan list ("Connection Manager") |
| `a1` | Tab 1 robot control screen (when connected) |
| `k0` | Tab 2 Info |
| `p0` | Tab 3 Manual (PDF) |
| `d` | All dialogs (static helpers) |
| `s` | BLE manager: scan, connect, reconnect (extends abstract `j`) |
| `q` | Connected robot / protocol (implements interface `g`) |
| `w` | Command byte constants; `b` frame build/parse; `c` reply dispatcher |
| `n` ball, `q0` exercise (ball list + per-exercise cycle), `e0` game (exercise or sequence), `g0` gameset, `u0` game settings, `x` cycle, `x0`/`f` random mode, `v` calibration, `y` device info |
| `v0` | Live play settings (bpm, random, cycle) that push to the robot |
| `w0` | Play controller singleton; `o` single-exercise engine; `k1` sequence engine |
| `h1` | "Sample" (single-ball preview) controller |
| `t0`, `l1` | Launch velocity + flight simulation (landing model) |
| `v6/*`, `u6/u0` | Microphone sound trigger (serve detection) |
| `Widgets/*` | Custom views: `Slider`, `SliderWithNumbers`, `SpinView` (+ painter `Widgets/a`), `TablePreviewView`, `BallTrajectoryView`, `SignalStrengthView` |
| `m0` | In-memory log ring buffer (1200 lines) attached to "Report an issue" mail |

---------------------------------------------------------------------------------------------------

## 1. Navigation

### 1.1 Activities
- `MainActivity` — the only real screen. Theme `AppTheme.NoActionBar` (launcher theme `AppTheme.Launcher` = white
  splash with centred `mipmap/ic_splash`). Orientation forced `sensorPortrait` (`setRequestedOrientation(7)`, MainActivity.java:340; manifest).
- `VideoPlayer` — full-screen `VideoView` playing `res/raw/exerciseNN.mp4` (built-in drills 79–88 have videos; 89–99 reference videos that are not in the APK) or a local file path. Tap toggles play/pause.
- `SendEmailActivity` — helper used only by Share ("Send Email" chooser entry).
- Intent filters on MainActivity: VIEW/EDIT of `*.amicusgame`, MIME `application/vnd.butterfly.amicus.game.json`, `application/amicusgame`, `application/octet-stream` → import flow (§5.5).

### 1.2 Root layout (`layout/activity_main.xml`)
Vertical `LinearLayout`, white background: `FrameLayout #content` (weight 1) + `AHBottomNavigation #navigation` at bottom.

### 1.3 Bottom navigation (menu `navigation.xml`, library AHBottomNavigation)
Order and content:

| Index | id | Label | Icon |
|---|---|---|---|
| 0 | navigation_exercises | "Exercises" | `ic_gamelist` (brand: 4 rows of [hollow rectangle + bar], i.e. a list) |
| 1 | navigation_robot | "Robot" | `ic_amicus` / `ic_amicus_connected` / `ic_amicus_connecting` (see §3.4) |
| 2 | navigation_info | "Info" | `ic_info` (circle outline with "i") |
| 3 | navigation_manual | "Manual" | `ic_manual` (Material "library_books"-like: stacked pages with bookmark) |

- Titles always shown (`TitleState.ALWAYS_SHOW`), haptic feedback on. Library defaults apply: white background,
  active item colour `colorBottomNavigationAccent #ff4081`, inactive `#747474`, height `64dp`, icon `32dp`,
  label 14sp active / 12sp inactive, elevation 8dp.
- Robot icon: disconnected `ic_amicus`; connected `ic_amicus_connected`; while a GATT connect is in progress the icon
  blinks between `ic_amicus_connected` and `ic_amicus_connecting` every 500 ms (MainActivity.java:39-71, started by `k.C()`).
- Re-selecting tab 0 while an editor (`a0`/`j1`) is open calls the editor's close routine `r2()` (MainActivity.java:83-86) = "back with save prompt".
- Selecting tab 1 while not connected and the control screen is on the stack pops back to the scan list (MainActivity.java:87-93).

### 1.4 Tab stacks (`u6/h`)
- Tab 0: `ExercisesFragment` → push `a0` (exercise) or `j1` (sequence) (MainActivity.q0, :588-596). From `j1` a slot tap pushes `a0` for that slot.
- Tab 1: `f1` (scan list) → replaced by `a1` (control) when a robot connects (`MainActivity.i`, :285). On disconnect `a1` is popped.
- Tab 2: `k0`. Tab 3: `p0`.

### 1.5 Toolbars and menus
| Screen | Toolbar | Menu items |
|---|---|---|
| Exercises (normal) | title "Exercises" (plain, white bg, dark text) | `exercises.xml`: Search (icon `ic_search_black_24dp`, SearchView, ifRoom), "Edit", "New" |
| Exercises (edit mode) | same | `exercises_edit.xml`: "Done", "Share" |
| Robots | title "Connection Manager" (hard-coded) + small indeterminate spinner `#scanning` (invisible unless scanning) + borderless button "Rescan" at right | — |
| Exercise / Sequence editor | `Toolbar #toolbar` inside AppBarLayout (theme `AppTheme.ToolBar`: white title/icons on colorPrimary `#3f51b5`), Up arrow shown, title = exercise name, or "name / n" when editing slot n of a sequence (a0.G3) | `game_edit.xml`: one item "Save" (`menu_item_save`, showAsAction always). Hidden while playing (and in a0 also while sampling). Tapping it opens a PopupMenu anchored to toolbar: exercise → `exercise_savemenu.xml` ("Save", "Save As...", "Save to Sequence", disabled blank item, "Revert changes"); sequence → `sequence_savemenu.xml` ("Save", "Save As...", blank, "Revert changes") |
| Ball chip long-press (SpinView) | PopupMenu `spinview.xml` | disabled title "Ball operations:", "Delete", "Duplicate" (hidden when 10 balls), "Move left", "Move right" |
| Sequence table long-press | PopupMenu `sequence_tables.xml` | disabled title "Exercise operations:", "Delete", "Duplicate" (hidden when 10 exercises), "Move left", "Move right" |

Popup menu text style `AmicusPopupMenuTextAppearanceLarge`: 14sp, item height 48dp.

### 1.6 Dialogs and popups (what opens them)
| Dialog | Opened by | Defined |
|---|---|---|
| Delete confirm: title "Delete", msg "Are you sure to delete this entry?", [Delete] [Cancel] | swipe-delete in list; Delete in sequence table menu | d.q (:1103) |
| Import: title "Import games", msg "Are you sure to import %d games?", [Import] [Cancel] | opening a .amicusgame file; "Restore factory exercises" (count hard-coded 21) | d.f (:906) |
| Exercise properties (custom view `dialog_exerciseproperties`) [Save] [Cancel] | tap description text in editors; tap row in list edit mode; Save/Save As of a new item | d.i (:985) |
| "Exercise is not saved" / "Do you want to save it before close?" [Save and Close] [Close without Save] (cancelable) | leaving a dirty exercise editor | d.l (:1026) |
| "Sequence not saved" / same msg, same buttons | leaving dirty sequence editor; tapping a slot while dirty | d.m (:1038) |
| "Save to Sequence" list dialog (`dialog_savetosequence`) [New Sequence] [Cancel] | exercise save menu → Save to Sequence | d.n (:1048) |
| "Cannot add to sequence" / "Selected sequence is full, please remove an Exercise before adding a new one." [Ok] | chosen sequence already has 10 exercises | d.o (:1073) |
| Ball editor "Edit ball : <title>" (`dialog_balleditor`) [Save] [Cancel], not cancelable | Info → "Set Unload ball" (title "Unload ball", no description) / "Set Pass ball" (title "Pass ball" + long description) | d.g (:918) |
| "Calibrate sound level" (`dialog_soundcalibrate`) [Save calibration] [Cancel], not cancelable | Info → "Calibrate sound level" | d.p (:1084) |
| "Robot Error" + message, [Ok] | robot state 10 (error) while an editor is open; bootloader state 64 | d.e (:875) |
| "Connection lost" / "Lost the connection with the robot during play. Do you want to restart the application?" [Save and Restart] [Restart without Save] (if dirty) or [Restart], neutral [Don't restart] | 40 s after a disconnect that happened during play, if still disconnected (a0.F :1841, j1.F :998) | d.h (:970) |
| Firmware update confirm | Robot control → Firmware update | d.r (:1115) — not to be implemented |
| Progress "Please wait" / "Downloading sequence to Amicus" (indeterminate, not cancelable) | Play sequence when the sequence must be uploaded | j1.u (:716) |
| Popup "Cycle" (`popup_cycle`) | exercise view "Cycle" button | a0.onClick (:2418) |
| Popup "Sequence cycle" (`popup_globalcycle`) | sequence view cycle button | j1.onClick (:1330) |
| Popup random (`popup_random`) | exercise view "Random" button | a0.onClick (:2404) |

All three popups are `PopupWindow`s, focusable, dismiss on outside touch, transparent window background, content
background `popup_bg.9.png` (white rounded rectangle, ~8dp corner, soft grey drop shadow), padding 32dp. Shown at
`Gravity.RIGHT`, x = button x, y = button y − 60px. Cycle popups are full width; random popup wraps content.

---------------------------------------------------------------------------------------------------

## 2. Screens

Common typography: system sans (Roboto). `AmicusButton` text = 16sp; `AmicusButtonLarge` = 24sp.
Default text colour = theme primary (black ~87%). See §3 for styles.

### 2.1 Exercises tab (`ExercisesFragment`, `fragment_exercises.xml`, row `fragment_exercise.xml`, row model `b0`)
Hierarchy: Toolbar `#exerciseToolbar` ("Exercises") → RecyclerView `#list` (vertical, horizontal+vertical dividers? — one `DividerItemDecoration(VERTICAL)` i.e. a line between rows).

Row (ConstraintLayout, white):
- `CheckBox #chkSelected` — visible only in edit mode; checked = selected for Share.
- Exercise variant `#exerciseLayout` (when game is not a sequence):
  - `TablePreviewView #exerciseTablePreview`, background `#ccc`; size forced in code to width = 30 % of screen width, height = 16.64 % of screen width (b0.java:75-90). Shows all landing points of exercise 0.
  - `SpinView #exerciseSpin` (not touchable, maxBalls 10) between table and label, same height as table: the ball chips.
  - `TextView #exerciseLabel` width = 25 % of screen width, text-align end: the game **name** (description is NOT shown in the list).
- Sequence variant `#sequenceLayout`: 10 `TablePreviewView #sequenceTablePreview1..10`, each 15 % × 8.32 % of screen width, in 2 rows of 5 (row gap 2dp, start margins 4dp); unused slots drawn dim (alpha 64 table). `TextView #sequenceLabel` (end-aligned) right of table 5: the name.
- `ImageView #imgDragHandle` (`ic_drag_handle`, two horizontal bars) at end — edit mode only.
- While a finger is down on a row its background turns `#cccccc` (b0/ExercisesFragment c/d listeners).

Behaviour:
- Tap row (normal mode) → open editor for that game index (`MainActivity.e(i)`). Sequence → `j1`, otherwise `a0`.
- Search: filters by case-insensitive substring of name (ExercisesFragment.java:125-127).
- "New" → `MainActivity.e(-1)` → new exercise editor (`a0` with index −1). There is no "new sequence" button; sequences are created via "Save to Sequence → New Sequence" (§2.5).
- "Edit" → edit mode: checkboxes + drag handles visible, menu becomes Done/Share, search cleared.
  - Long-press + drag reorders (only in edit mode; `ExercisesFragment.i` :463).
  - Swipe left deletes (only in edit mode; `u6/i.D`) with red `#f44336` background and white `ic_delete_forever_white_24dp`; confirm dialog; Cancel restores the row.
  - Tap row → properties dialog (name, description, video picker unless sequence) → saves.
  - "Share" → writes checked games to a temp `Amicus*.amicusgame` file `{"version":1.0,"games":[...]}` and opens a chooser titled "Sharing Option" with an extra "Send Email" entry. Errors toast "IO Error, share failed!" / "Data Error, share failed!".
  - "Done" leaves edit mode.

### 2.2 Exercise editor/player (`a0`, `activity_game_edit.xml` + `content_game_edit.xml`)
CoordinatorLayout → AppBarLayout(Toolbar) → `ScrollView #gameEditScrollView` → vertical LinearLayout containing:

**A. Header `#previewView` (always visible)** — ConstraintLayout with vertical guideline at 40 %:
- `TablePreviewView #tablePreviewView` (bg `#ccc`), from left edge to the 40 % guideline, aspect 274:152, margins top 4 start 4 end 8.
- `HorizontalScrollView #horizontalScrollView` right of the table to parent end, same top/bottom as the table, containing `SpinView #spinView` (editable, touchable, maxBalls 10, height = table height, width = content).
- `BallTrajectoryView #ballTrajectoryView` under the table, same left/right as the table, aspect 6:1, margin top 2.
- `TextView #txtPlayStatus` right of the trajectory view, end-aligned, bottom-aligned to it: play status text.

**B. View mode 0 — `#descriptionArea`** (shown when not editing a ball and not playing):
- `TextView #description` exactly 2 lines, margins 8; tap → properties dialog.
- Row 1: `Button #playCycleButton` text "Cycle:\noff" + drawableStart `ic_loop`; `Button #playShuffleButton` "Random: Off" + `ic_shuffle`; `Button #btnResetHead` "Reset\nhead" + `ic_reset_head` (end).
- Row 2: `Button #btnMirror` "Mirror\nleft/right" + `ic_mirror`; `Button #btnPlayWait` "Wait" (or "Pass wait" when New wait mode pref is on) + `ic_wait_play`; `Button #btnPlayVideo` "Play\nvideo" + `ic_play_video` (only if the game has a video).
- `Button #btnPlay` full width, black background, white bold text "Play Exercise".
- `SliderWithNumbers #viewBallsPerMin` "Ball/min: %d" range 5–120 (no ticks, progress track).

**C. View mode 1 — `#ballEditor`** (a ball chip is selected):
- Top right: `Switch #sectorSwitch` "Sector" then `Switch #serveSwitch` "Serve".
- Left: vertical `SliderWithNumbers #angleSlider` 78 × 285dp, label "∠%d", value −92…61 (raw trajectory 0…153), centre tick at 0 labelled "0".
- Right column (start margin 88dp): `#placeSlider` "Place %d" −8…8 with "<"/">" buttons (leftRight), ticks; `#ballsPerMinSlider` "Ball/min %d%%" −60…60 step 10; `#sideSpinSlider` "Side spin %d%%" −90…90 step 15 (the original shows "%" although it is degrees); `#speedSlider` "Speed %d" 1…25; `#spinSlider` "Spin %d" −5…7.
- Bottom row (guideline 50 %): `Button #btnQuickPlay` "Play" (black bg, white bold; label "Wait" if the last play used wait mode) left; `Button #sampleButton` "Sample"/"Stop sample" right.

**D. View mode 2 — `#playController`** (playing):
- `TextView #textView` "Adjust all balls" at top.
- Left column: `#btnTrajectoryInc` "+", `#lblTrajectory` "Traject.", `#btnTrajectoryDec` "—" (each 60dp wide, Large style).
- Right: row "— Spins +" (`#btnSpinDec`, `#lblSpin`, `#btnSpinInc`) and row "— Speeds +" (`#btnSpeedDec`, `#lblSpeed`, `#btnSpeedInc`). Spin row is INVISIBLE unless all balls have the same spin (a0.f0 :526-535).
- Row: `ToggleButton #tglCycle` ("Cycle: On"/"Cycle: Off", drawableTop `cycle_toggle` = `ic_loop` / `ic_loop_off`), `Button #btnPlayMirror` "Mirror" (drawableTop `ic_mirror`), `ToggleButton #tglRandom` ("Random: On"/"Random: Off", drawableTop `random_toggle` = green `ic_shuffle_green` / grey crossed `ic_shuffle_off`).
- `Button #btnStop` full width, background `@color/red` (#cc0000), bold black text "Stop Exercise".
- `SliderWithNumbers #playBallsPerMin` "Ball/min: %d" 5–120, live.

### 2.3 Sequence editor/player (`j1`, `activity_sequence_edit.xml` + `content_sequence_edit.xml`)
Not scrollable. Vertical LinearLayout:
- `#previewView`: 10 `TablePreviewView #sequenceTablePreview1..10` in 2 rows × 5; column 1 ends at a 20 % guideline, others keep 274:152 aspect, gaps 8dp. Each shows that exercise's landing points; an exercise with cycle enabled shows a white loop icon bottom-left (yellow when sequence cycle mode = "unique") — intent; code is garbled (j1.java:1065-1074, ambiguous).
- `#playController` (playing): `#txtPlayStatus` top right; `ToggleButton #tglRandom` centred ("Random: On/Off", drawableTop `random_toggle`); `Button #btnStop` red bg, text colour `#b2ebf2`, "Stop sequence"; `#playBallsPerMin`.
- `#descriptionArea` (idle): `#description` (2 lines, tap = properties); row: `Button #playCycleButton` "Sequence cycle:\noff" + `ic_loop`, `ToggleButton #playShuffleButton` ("Random: On/Off", drawableStart `random_toggle`), `Button #btnResetHead`; `Button #btnPlayVideo` centred under; black `Button #btnPlay` "Play sequence"; `#viewBallsPerMin`.

Interaction: tap a table → open `a0` for that slot (stops play first; if dirty asks "Sequence not saved" with Save and Close = save then open, Close without Save = open). Tapping an EMPTY slot opens an empty exercise; saving it appends it (this is how exercises are added to a sequence). Long-press → table menu.

### 2.4 Robot scan list (`f1`, `fragment_robots.xml`, row `fragment_robot.xml`)
- Rows: `#robotName` (device name or advertised name), `#robotId` (MAC address) stacked left (margins 8); right: `Button #robotConnectButton` "Connect" (AmicusButtonStyle) / `ProgressBar #robotConnecting` while connecting.
- Tap Connect → spinner; on success stores MAC (`pref CONNECTED_ROBOT_MAC`) and replaces screen by control screen. Spinner reverts to the button after 20 s regardless (g1.java:80).
- "Rescan" → `s.A(true)`.
- No rename function exists anywhere in the app (task item "robot rename": not present).

### 2.5 Robot control (`a1`, `fragment_robot_control.xml`)
`#buttonsView` (RelativeLayout):
- "Name" label + `#robotControlName` (device name); "Signal strength:" label + `SignalStrengthView #robotControlSignalStrength`.
- `#robotControlVersions`: initially "Waiting for informations…", then
  `Hardware version: H.h\nFirmware version: M.m\nSerial number: N\nBootloader version: B` (a1.java:246; see §9 device info).
- Buttons (AmicusButtonStyle): row 1 "Calibrate", "Learn remote"; row 2 "Unload balls", "Disconnect"; row 3 "Firmware update" (text becomes "Update firmware to 7.1" or "You have the latest firmware!").
`#calibrateView` (3 pages, see §4.9). Signal strength polled every 1 s (readRemoteRssi).

### 2.6 Info (`k0`, `fragment_info.xml`)
Vertical list, white: `#version_label` "Version: 1.3.2 (226)" (margin 8); AmicusButtonStyle buttons (margin 4) "Support website" (opens https://en.butterfly.tt/amicus), "Report an issue" (mailto amicus@butterfly.tt, subject "Amicus error report", body "Version:… Log:" + log buffer), "Check for updates" (always hidden), "Restore factory exercises", "Calibrate sound level", "Set Unload ball", "Set Pass ball"; `ToggleButton #wait_mode_switch` "New wait mode: ON/OFF" (16sp, #3f51b5, minHeight 48); `img_butterfly_logo` at the bottom (`fitEnd`; pink `≈#ee4d9b` wings + black "BUTTERFLY" wordmark).

### 2.7 Manual (`p0`)
Full-screen PDF viewer of `assets/owners_manual_<lang>.pdf`, lang = device language if "en" or "fr", else "en" (German PDF ships but is never used, p0.java:46-49). Page snap, double-tap zoom.

### 2.8 Dialog contents
- **Exercise properties** (`dialog_exerciseproperties`, padding 16): TextView "Set Exercise Properties" (Title appearance), "Name:", EditText `#exerciseName`, "Description:", EditText `#exerciseDescritpion` (5 lines, hint "Description"), Button `#exerciseVideo` "Select Video" / "Select Video (<file>)" (hidden for sequences; picks a gallery video).
- **Save to Sequence**: RecyclerView of `listitem_sequence` rows (10 mini tables in 2×5, column 1 to 15 % guideline, + name). Tap row = choose.
- **Ball editor** (`dialog_balleditor`): optional description TextView (padding 8); header = 100×54dp table (bg #ccc) + trajectory view (6:1); sliders identical to §2.2C but place slider has a centre tick; vertical angle slider stretches to the Sample button; `#sampleButton` "Sample" (only when connected).
- **Sound calibrate** (`dialog_soundcalibrate`): "Current sound level:" (Title), horizontal ProgressBar `#soundMeter` max 23000, "Threshold:" (Title), SeekBar `#threshold` max 23000, help text "Move the threshold above the background noise level, and below the ball bouncing noise level.", Switch `#soundFilter` "Noise filter:".
- **Popup cycle** (`popup_cycle`): "Cycle" label + SegmentedControl `#cycleSegment` [off|20|40|60|80|custom]; "Mode" label + SegmentedControl `#cycleMode` [time|repeat]; sliders `#cyclePlaySlider` "Play %d secs" (2…120, or "Play %d times") and `#cyclePauseSlider` "Pause %d secs" (0…60). Segmented controls: 8dp radius, selected bg `#3f51b5` white text, unselected outline + text `#3f51b5`, vertical text padding 8dp.
- **Popup sequence cycle** (`popup_globalcycle`): "Sequence cycle" + SegmentedControl `#globalCycleMode` (224dp, [off|time|repeat|unique]); `#globalCyclePlaySlider` "Play %d secs" 2…120; `#globalCyclePauseSlider` "Pause %d secs" 1…60. Sliders visible only for time/repeat.
- **Popup random** (`popup_random`): three CheckBoxes, Headline text appearance, custom box drawable `checked`/`un_checked` (36dp black Material check_box / check_box_outline_blank): "Scatter" (`#checkPlaceRnd`), "Place RND" (`#checkPlaceRandom`), "Type RND" (`#checkTypeRnd`), 16dp apart.

### 2.9 Landscape / tablet
Phone is portrait-locked. `layout-sw600dp` only reorders ids in `content_game_edit`/`content_sequence_edit` and uses a label-above-buttons variant of `sliderwithnumbers*` with ticks on. No landscape layouts for app screens. Watch resources ignored.

---------------------------------------------------------------------------------------------------

## 3. Design tokens

### 3.1 Theme
- `AppTheme` = `Theme.AppCompat.Light.NoActionBar`; status bar `colorPrimary #3f51b5`, navigation bar black, `colorPrimary #3f51b5`, `colorPrimaryDark #303f9f`, `colorAccent #6a6c6e`.
- **No dark mode**: `values-night/colors.xml` is empty and `color-night/` only contains library timepicker colours. All screens hard-code white backgrounds. A rebuild that matches the original is light-only.

### 3.2 Colours (values/colors.xml) and use
| Name | Hex | Used for |
|---|---|---|
| colorPrimary / buttonBlue / colorBottomNavigationPrimary | #3f51b5 | status bar, editor toolbar, all button text, slider ± buttons, speed number in ball chips, add-ball "+" ring, segmented controls, trajectory baseline/net |
| colorPrimaryDark | #303f9f | — |
| colorAccent | #6a6c6e | slider track (alpha 50/255 ≈ 20 %, full alpha for progress fill) |
| colorBottomNavigationAccent | #ff4081 | active bottom tab |
| colorBottomNavigationInactive | #747474 | inactive bottom tab |
| colorBottomNavigationSelectedBackground | #17000000 | item_background selected state |
| connectedNotificationColor | #3df62b | nav notification badge colour (badge never used) |
| tableColor | #00008b | table fill in TablePreviewView |
| tableEdgeColor | #cccccc | table outline |
| tableLinesColor / ballPathColor | #ffffff | net/centre line; robot→landing lines and landing-dot outline |
| selectedBallColor | #ffffaf00 | selected/playing ball (chip halo, table dot, trajectory path) |
| serveColor | #ffc0cb | fill of "serve" ball chips (state 2) |
| md_red_500 | #f44336 | swipe-to-delete background |
| md_blue_900 | #1565c0 | unused |
| red | holo_red_dark #cc0000 | Stop buttons, "Paused for" status text |
| green | holo_green_dark #669900 | "Playing for" status text |
| gray | darker_gray #aaaaaa | seekbar_background (unused) |
| black / white | | play button bg / text, backgrounds |
| (literal) | #8f8f8f | list secondary text (unused list layouts) |
| (literal) | #ccc | background behind table previews |
| (literal) | #b2ebf2 | sequence Stop button text |
| (literal) | #888888 / #000000 / #00ff00 / #ff0000 | ball chip rings (§3.5) |
| (literal) | #cccccc fill / #444444 text | SignalStrengthView |

### 3.3 Buttons
- `AmicusButtonStyle`: platform Button with background = flat white (no border, no radius, no elevation), text 16sp `#3f51b5`, centred, padding 8dp, margin 8dp. Compound drawables (icons) at start or top.
- `AmicusButtonLargeStyle`: same, 24sp, padding 0 (± buttons).
- `AppTheme.BorderlessButton`: 16sp bold, borderless ripple, minWidth 36dp, minHeight 24dp — used for slider "—"/"+".
- Primary action ("Play Exercise", "Play sequence", "Play"): black fill, white bold. Stop: `#cc0000` fill.
- ToggleButtons use AmicusButtonStyle with textOn/textOff strings.
- Disabled play controls are shown with alpha 0.5.
- Corner radii: popups ~8dp (9-patch); segmented controls 8dp; ball range bar 4px; nothing else rounded.

### 3.4 Drawables used in UI
Brand/custom art (vector unless noted):
- `ic_amicus` — robot "unplugged" icon: two plug halves separated diagonally + small warning triangle with "!" bottom-right. Paths (24×24): `M15.4,0c-0.6,0 -1.2,0.2 -1.7,0.7l-1.8,1.8l-1.2,-1.2L9,3l2.8,2.8L8.6,8.9l1.7,1.7l3.1,-3.1l3.1,3.1l-3.1,3.1l1.7,1.7l3.1,-3.1L21,15l1.7,-1.7l-1.2,-1.2l1.8,-1.8c1,-1 1,-2.4 0,-3.4L21,4.7l3,-3L22.3,0l-3,3L17,0.7C16.6,0.2 16,0 15.4,0zM2.9,9.1l-1.7,1.7L2.4,12l-1.7,1.7c-1,1 -1,2.4 0,3.4L3,19.3l-3,3L1.7,24l3,-3L7,23.3c1,1 2.4,1 3.4,0l1.7,-1.7l1.2,1.2l1.7,-1.7L2.9,9.1z` and `M24,24l-4,-6.6L16.2,24H24zM20.4,23.3h-0.7v-0.7h0.7V23.3zM20.4,21.8h-0.7v-2.2h0.7V21.8z`.
- `ic_amicus_connecting` — same first path only (no triangle).
- `ic_amicus_connected` — plugged plug: `M22.3,0l-4.2,4.2l-2.3,-2.3c-1,-1 -2.4,-1 -3.3,0l-3,3L8.3,3.7L6.6,5.4l12,12l1.7,-1.7l-1.2,-1.2l3,-3c1,-1 1,-2.4 0,-3.3l-2.3,-2.3L24,1.7L22.3,0zM5.3,6.7L3.6,8.4l1.2,1.2l-2.9,2.9c-1,1 -1,2.4 0,3.3l2.3,2.3L0,22.3L1.7,24l4.2,-4.2l2.3,2.3c1,1 2.4,1 3.3,0l2.9,-2.9l1.2,1.2l1.7,-1.7L5.3,6.7z`.
  (These resemble Material Design Icons "power-plug"/"power-plug-off"; treat as custom.)
- `ic_gamelist` (96×96 viewport): 4 rows of a 25×16 hollow rectangle (stroke 3) at x 13.3–38.2 plus a 40×6 bar at x 41.4–81.4; rows at y 13.5, 30.7, 47.8, 65.
- `ic_info` (96 viewport): ring (r≈39.7 outer, 32.7 inner) + bar 44.5–51.5 × 44.5–67.5 + dot 44.5–51.5 × 28.3–35.7.
- `ic_wait_play` (48dp): horizontal floor bar + small ball (circle r≈4.2 at 43.8,20.4) + two stroked arcs (ball bounce path).
- `ic_loop_off`, `ic_shuffle_off`: grey `#808080` loop/shuffle with a black diagonal strike line. `ic_loop_white` (#fff), `ic_loop_yellow` (#ff0), `ic_shuffle_green` (#009900) are colour variants.
- `calibration_center.png` (230×119: blue table top view, black robot square left, dotted arrow along centre line), `calibration_speedtr.png` (side view for height/speed), `img_butterfly_logo.png`, `popup_bg.9.png`, `mipmap/ic_splash`, `mipmap/ic_send_email`.
- `seekbar_thumb`: white oval 25dp with 1dp `#88000000` stroke.

Standard Material icons: `ic_manual` (library_books), `ic_loop` (loop), `ic_shuffle` (shuffle), `ic_mirror` (flip), `ic_play_video` (ondemand_video/tv with play triangle), `ic_reset_head` (adjust/radio_button_checked: ring with centre dot), `ic_drag_handle` (drag_handle), `ic_adjust` (tune; unused), `ic_warning_red_24dp` (warning, tint #c00000), `ic_search_black_24dp` (search), `ic_delete_forever_white_24dp` (delete_forever), `checked`/`un_checked` (check_box / check_box_outline_blank, 36dp), `ic_clear_black_24` (clear; unused).

### 3.5 Custom widgets — exact drawing and touch

#### Slider (`Widgets/Slider.java`) — the track inside SliderWithNumbers
Integer model: `progress` 0…`max`, optional `range` (half-width of a span, used only by Place "Sector"). Orientation is
vertical when view width < height.
- Scale `d = densityDpi/160`. Track: line through the centre, stroke `4·d` px, colour #6a6c6e alpha 50 (:200-205, 359-365).
- Ticks (`drawTicks`): black filled circle radius 2px at every integer 0…max along the track (:366-379).
- Progress fill (`progressTrack`) or when range>0: same paint at alpha 255. Horizontal: from 0 to progress; vertical: from bottom up to progress. With range>0: from progress−range to progress+range (:380-409).
- Base tick (`baseTick`, = SliderWithNumbers `centerTick`): a line across the thumb height at position `baseTickValue`, and text `baseTickValue + offset` in black 24px: horizontal → centred above the track at y = −ascent; vertical → right-aligned just left of the track (:411-431). For the angle slider this prints "0" at raw 92.
- Thumb: `seekbar_thumb` centred on progress; with range>0 two thumbs at progress±range (:433-441).
- Measure: long side wraps to 5 × thumb size.
- Touch (:487-542): DOWN on a thumb (within 2 × thumb radius) starts dragging immediately; with range>0 DOWN on one end thumb drags that end (span centre and half-width recomputed, half-width ≥1, ≤ max/2), DOWN inside the span moves the whole span. DOWN elsewhere on the track does nothing until either a drag beyond touch-slop (perpendicular check) starts dragging, or UP, which jumps to the tapped position. Position = round((x−padL)·max/width) (vertical: max − round((y−padT)·max/height)); centre clamped so centre±range stays in 0…max. Each change calls listener with fromUser=true.
- `setProgress` does NOT clamp and fires the listener with fromUser=false (:562-566).

#### SliderWithNumbers (`Widgets/SliderWithNumbers.java`)
Attributes: `min`, `max`, `step`, `value`, `labelText` (format string with one %d), `ticks` (choose tick layout), `vertical`, `leftRight` (buttons show "<" ">" instead of "—" "+"), `centerTick`, `centerTickValue`, `fakeZero`.
- Internal: C = min/step, D = max/step; Slider max = D−C; **progress = raw value**; display value = (progress + C)·step (:160-166).
- Label = `String.format(labelText, value)` + `" ±range"` when range>0; if value == fakeZero show 0 (:168-184).
- Layouts: `sliderwithnumbers` (no ticks): "—" button left, "+" right, label between them on top, slider spans label-top to button-bottom with progress fill. `sliderwithnumbers_tick`: label above the track spanning it, buttons left/right, dots, no fill. `sliderwithnumbers_vertical`: label (72dp, centred) top, "+" under it, vertical slider (padding start 32dp, top/bottom 16dp, fill from bottom), "—" at bottom.
- "—"/"+" click: ±1 progress step if inside range, listener fromUser=true (:132-143). Long-press auto-repeats: first after 0 ms, then every 500 ms shrinking ×0.9 down to ≥50 ms, until finger up (:72-92, 238-262).
- Listener `A(view, progress, value, range, fromUser)`.
- `setValue` converts display value → progress, no clamping (:292-297); `setValueSilent` updates without callbacks.

Concrete sliders (raw value ↔ label):
| Slider | Raw (protocol) | Label |
|---|---|---|
| angle | trajectory 0…153 | "∠" + (raw − 92) |
| place | 0…16 (+ range) | "Place " + (raw − 8) [+ " ±r"] |
| ballsPerMin (per ball) | frequency 0…12 | "Ball/min " + (raw−6)·10 + "%" |
| sideSpin | 0…12 | "Side spin " + (raw−6)·15 + "%" |
| speed | 0…24 | "Speed " + (raw+1) |
| spin | 0…12 | "Spin " + (raw−5) |
| play/view ball/min | bpm 5…120 | "Ball/min: " + bpm |
| cycle play | 2…120 (time) / repeat | "Play N secs" / "Play N times" |
| cycle pause | 0…60 (global 1…60) | "Pause N secs" |

#### SpinView (`Widgets/SpinView.java` + painter `Widgets/a.java`) — ball chips
Model per ball (`u6/v0` from `n.k()`): spin = raw−5 (−5…7), speedLabel = raw speed+1, d = place−8, serve = (state==2), range.
- Radius r = clamp(viewHeight/5, 8, 36) px (scale fixed 1.0, not dp) (:143-145). Ring stroke w = clamp(r/6, 2, 4).
- Ball i centre: y = h/2 − d·(h/20) (right placements higher). x: ball 0 at w + r; ball i = x(i−1) + 1.9r + r/10 − 0.8·m²/r, with m = clamp(|y−y(i−1)| − r/1.5, 0, r) (vertical offset lets balls overlap) (:147-158).
- Paint order: unselected balls, then the selected one, then the playing one. Selected and playing balls use radius 1.1r with a filled `#ffaf00` disc of 1.1·(1.1r) behind. Serve balls (unselected) get a filled `#ffc0cb` disc of radius r.
- Range>0: grey `#cccccc` rounded rect (corner 4px) 12px wide, centred on the ball, from y−(range·h/20)−r to y+(range·h/20)+r, drawn first.
- Ring (`a.h`): spin 0 → full circle `#888888`. Topspin (spin>0): black 270° arc with the 90° gap at the TOP (screen angles −135° to −45° empty); coloured overlay `#00ff00` starting at −135° (upper-left) running counter-clockwise (down the left side) over spin/6·270°; black arrowhead (base 7px, length 8px) at the upper-left end pointing up-right. Backspin (spin<0): black 270° arc with the gap at the BOTTOM (45°…135° empty); `#ff0000` overlay starting at 135° (lower-left) running clockwise up the left side over |spin|/6·270°; arrowhead at lower-left pointing down-right. (Spin +7 overflows to 315°.)
- Text: speedLabel, `#3f51b5`, size 1.3r, centred.
- Editable mode with < max balls: an extra blue `#3f51b5` stroked circle with "+" at the next position (`a.g`).
- Width wraps to w + n·2.2r (n incl. the "+").
- Touch (only if `isTouchable`): hit = distance ≤ r+3. Tap ball → select (listener `h`), haptic. Tap "+" → listener `j()` adds a ball (copy of the selected ball with state 1, or default ball) and selects it. Long-press (editable) → select + PopupMenu "Ball operations:" (§1.5). Move left/right swap with neighbour and keep selection.

#### TablePreviewView (`Widgets/TablePreviewView.java`) — top view of the table
- Draw rect filled `#00008b` (alpha 255; 64 when no balls), outline `#cccccc` stroke 1.5·f, where f = min(width/50, 1.5)·d (:118-141).
- White net line vertically at width/2 (stroke 1.5f); white centre line horizontally at height/2 from 3 % to 97 % of width (stroke 0.75f).
- Mapping from metres: px_x = left + z·(w/2.74) + w/2; px_y = top + x·(h/1.525) + h/2 (robot side left, player side right) (:78-84).
- White line (stroke f) from robot origin (0, 0.2, −1.26) to each landing point; landing dot radius R = clamp(h/30, 2, 5)·d filled table colour with white outline; selected ball: radius 1.2R filled `#ffaf00` + white outline; playing ball same with R ≥ 5.
- Cycle badge: `ic_loop_white` (cycle=1) or `ic_loop_yellow` (>1) square of size h/4 at bottom-left.
- No touch handling (sequence tables use plain click/long-click).

#### BallTrajectoryView (`Widgets/BallTrajectoryView.java`) — side view
- Scale s = width/2.74 px per metre; x_px = z·s + width/2; y_px = height − y·s.
- Blue `#3f51b5` 1px table line at y = height−1 across the full width; blue net line at centre, 0.1525 m high (:106-112).
- Each ball's simulated path as polyline: black 1.5dp; selected/playing ball `#ffaf00` 2.5dp, drawn last.

#### SignalStrengthView (`Widgets/SignalStrengthView.java`)
- Square of side = view height: grey `#cccccc` right triangle (bottom-left, bottom-right, top-right). Dark `#444444` filled triangle of the same shape scaled to fraction p from the bottom-left. Text = RSSI value (e.g. "-67") in bold 14dp `#444444`, 8px right of the triangle, baseline at the bottom.
- p from RSSI: ≤−90 → 0; ≤−80 → 0.2; ≤−75 → 0.4; ≤−70 → 0.6; ≤−67 → 0.8; else 1.0 (:74-100). Caller must invalidate.
- Web Bluetooth cannot read the RSSI of a connected device; a rebuild must hide this or show "n/a".

---------------------------------------------------------------------------------------------------

## 4. Behaviour

### 4.1 BLE connection state machine (`s.java`, `q.java`)
1. Startup (`MainActivity.u0`, :648): create `s` with saved MAC; if scan state `stopped`, start scanning (`s.z()` → `A(false)`).
2. Scan (`s.w/v`, :524-566): filter on service UUID, SCAN_MODE_BALANCED. Scan 5.5 s, stop, wait 1 s, restart — repeats while not connected. Devices not seen for 10 s are removed (`s.q`, :739-751). List refresh on each new device.
3. Auto-reconnect: when a scan result has the saved MAC and no connection attempt exists, connect automatically (`s.b.onScanResult`, :164-171).
4. Connect (`s.u`, :508-521): stop scan, `connectGatt(autoConnect=false, TRANSPORT_LE)`; listeners get "connecting" (blinking icon). GATT status 133 → disconnect and retry scan after 1 s (:247-253).
5. Connected → `discoverServices()`, `readRemoteRssi()`. Services found → find characteristic, `setCharacteristicNotification`, `requestMtu(517)` (callback not awaited), create `q`.
6. `q` constructor (:2255): sleep 1 s on the calling thread, write CCCD with **indication** value (notification value is overwritten, :2373-2375), wait 1 s, run handshake `t0()`:
   - cmd 1 device info. If byte1 (hardware version) ≥ 16: in "batch mode" send cmd 5 (get state; first reply starts the watchdog) and, if firmware ≥ 6.24 (major > 6 or minor ≥ 24), cmd 30 [wait-mode pref 0/1] and cmd 31 pass ball (`pass.json`) (q.java:239-313).
   - Register persistent handlers: cmd 44 (ball event), cmd 7 (error → state 10 with code).
7. Keepalive (`q.D0`, `q.j`): every write flagged "keepalive" (default) schedules cmd 5 2 s later; each cmd 5 is itself flagged, so the app polls cmd 5 every 2 s forever. If at that tick no cmd-5 reply has ever arrived (watchdog not started) and state ≠ 64 → disconnect (q.java:935-953).
8. Watchdog (`q.t`, :1671): 1 s timer; if no notification for 6 s → disconnect.
9. Disconnect: listeners `F()`; control screen popped; toast "Amicus disconnected"; scanning resumes (`MainActivity.F` → `s.z()`). Screen-off / power-save on → disconnect; power-save off, ACL disconnect → rescan (`AmicusBroadcastReceiver`).
10. `onStop` disconnects (MainActivity.java:562-575); `onRestart` reconnects via scan.
11. Connected toast "Amicus connected"; nav icon set; if tab 1 visible open control screen.

Writes (`q.G0/H0`, :2268-2320): frames built by `b.a`. If a write is in flight, new frames are appended to a buffer and sent concatenated in one characteristic write on the write callback; failed `writeCharacteristic` retries after 500 ms. After every write callback the app also **reads** the characteristic and parses the read value as if it were a notification (s.java:212) — this is why each reply is seen twice.

Request/response (`q.l0`, :2679; `c.java`): a one-shot handler per expected reply cmd; reply payload `[0x07]` = protocol error; optional timeout. Callers then block with `promise.b(ms)`, which simply returns after `ms` even if no reply arrived (h6/a.java:39-62) — most sequences ignore failures.

Timeouts used: cmd 32 start 1 s; cmd 33 stop 2 s; cmd 35 start sample 1 s; cmd 36 stop sample 2 s; cmd 41 start program 2 s (reply on 41 or 5); cmd 49 slot upload 10 s (callers wait 10 s); cmd 50 2 s; others none (callers wait 1–2 s).

### 4.2 Robot states (from cmd 5 / events) and UI reactions
- 3 = playing (also forced locally on any 44/58/59 event); 4 = set locally when sending cmd 36; 2 = idle; 10 = error (from cmd 7, with code); 15 = waiting for serve (sound trigger); 64 = bootloader.
- State change → `E(old,new,code)`: MainActivity toasts "Robot Error" for 10, opens firmware-error dialog for code 64. Editors on 10: stop sampling, if playing stop and return to view mode, show error dialog with code: 1 "The feeding motors has been stuck…", 2 "Ball gets stuck between ball throw discs…", 3 "Overheated electronics…", other "The ball is permanently jammed…" (d.e; jadx output garbled, mapping per intent — ambiguous for unknown codes). Editors on 15: start sound trigger (§4.6).

### 4.3 Exercise editor (`a0`) — controls
View modes `H3(mode)`: 0 view, 1 ball edit, 2 playing (a0.java:1459-1483). Opening: if the exercise has balls → mode 0; new exercise → add default ball, mode 1, not dirty.

Defaults: new ball (92, 5, 6, 12, 8, 6, state 1, range 0); new exercise settings bpm 40, random none, cycle (40 s, 20 s, off).

Ball edit (mode 1):
- Selecting a chip loads its values into sliders; table/trajectory highlight it. Tap outside? — deselect not supported except via Up (mode 1 → mode 0).
- Slider change (fromUser) writes the raw progress into the ball, marks dirty, redraws, and if sampling resends the ball (debounced 200 ms, cmd 18).
- "Serve" switch: visible only for balls 0–2 when ball 0 or the previous ball is a serve ball; on → state 2, off → state 1 and all following serve balls become 1 (a0.p0 :1126-1157). Serve balls are played once at start (UI: pink chip). `q0.g()` normalises: index ≥ 3 or (index > 1 and previous not serve) → state 1.
- "Sector" switch: on → range = max(range,3) and place clamped to 3…13; off → range 0 (a0.q0 :1180-1201). Range is edited on the place slider (two thumbs). Encoded into place bits 5–7 as min(7, range), only fw major > 5.
- Chip menu: Delete (refused with toast "Last ball couldn't be deleted!" when 1 ball), Duplicate (insert copy with state 1 before), Move left/right.
- "Sample" ↔ "Stop sample" (§4.5). While sampling the "+"/edit is disabled and the Save menu hidden.
- "Play" (quick play) = Play (or Wait if last mode was wait).

View mode 0:
- "Play Exercise" → play, `wait=false`. "Wait"/"Pass wait" → play with `wait=true`.
- Cycle button → popup (§4.7). Random button → popup (§4.8).
- "Reset head" → cmd 3 (recalibrate). "Mirror left/right" → place = 16−place, side_spin = 12−side_spin for all balls (local only, not marked dirty — bug). "Play video" → VideoPlayer.
- `#viewBallsPerMin` sets bpm (dirty) and mirrors to the play slider.
- Description tap → properties dialog (name, description, video), dirty.
- Up: mode 0 → close (save prompt if dirty); mode 1 → mode 0; mode 2 → stop.

Play (`s3`, :1731 → `w0.f`, `o.a`):
1. If no active balls toast "No balls to play". Stop sample if sampling. Mode 2, Stop button alpha 0.5 & not clickable, keep screen on.
2. Push settings (`v0.r`, batch): cmd 34 [bpm] → cmd 37 [random flags] → cmd 39 [cycle mode, play, delay] (each waited ≤ 2 s).
3. Register cmd 44 / 58 / 59 handlers.
4. cmd 20 load drill (all balls, `[0x00, 10×(state, 7-byte ball)]`). On success: wait=false → cmd 32 [0]; wait=true → cmd 32 [2] (robot enters state 15). On failure: cmd 5, and if state 3 → cmd 33.
5. On success: Stop button enabled, cmd 85 [2] (remote can control).
6. Not connected → error "Amicus not connected".

Playing (mode 2):
- Ball event cmd 44 `[ball(1-based), t_lo, t_hi, seq]` → highlight ball (ball−1) in chips, table and trajectory; re-enables Stop.
- cmd 59 `[mode, n]` → status green "Playing for n secs." (mode 1) / "Playing for n times."; cmd 58 `[n]` → red "Paused for n secs." (n>0) or clear.
- Live adjust buttons: Traject. ±, Spins ± (only if all balls share spin), Speeds ±: check every ball stays in range (`q0.e`), send cmd 21 [param, ±1] (param 0 traj, 1 spin, 3 speed), update local balls, redraw. Not marked dirty.
- Cycle toggle → enable/disable cycle and push 34/37/39 immediately. Random toggle → enable/disable random and push.
- Mirror → stop, mirror balls, restart play (re-upload).
- `#playBallsPerMin` → bpm, debounced 200 ms push of 34/37/39.
- Tapping a chip while playing → stop play, select that ball, start sampling it (a0.h :2114-2152).
- "Stop Exercise" → cmd 33, after reply (≤2 s) mode 0, cmd 85 [1], highlights cleared, keep-screen-on cleared.

Physical remote (`q.o`, cmd 85/84): editor visible → cmd 85 [1] (message only) + handler for cmd 84 `[?, button]`; during play cmd 85 [2]; leaving the editor cmd 85 [0]. Buttons: 1 = start (ignored if pressed < 1 s after last, or already playing) → Play; 2 or 4 = robot changed bpm → app reads cmd 43 and updates both bpm sliders (dirty); 8 = stop → stop play, stop sample, cmd 85 [1], mode 0 (a0.e0 :415-493; j1.g :266-339).

Disconnect during editor: play/wait/sample/reset buttons disabled (alpha 0.5); if playing → mode 0; 40 s later, if still disconnected and was playing → "Connection lost" dialog → restart process (`MainActivity.o0`). Reconnect re-enables.

### 4.4 Saving (exercise)
Save menu: "Save" → existing: write balls into game's slot, name/description/video, slot cycle = current cycle, settings.bpm/random = current; new: properties dialog then create game (settings = full v0 incl. cycle). "Save As..." → properties dialog → new game with new UUID. "Save to Sequence" → pick sequence (or "New Sequence" which creates a sequence with an EMPTY name) → append this exercise (max 10 → error dialog) → if dirty ask "Exercise is not saved" → open that sequence. "Revert changes" → reload from storage. Every save writes `games_list.json` (with `.bak` copy first).

### 4.5 Sample (single ball preview) (`h1.java`)
Start: keep screen on; batch: cmd 18 `[0x01, 0x01(state forced 1), 7-byte ball]` (1 s) → cmd 17 [0x01] (1 s) → cmd 34 [20] (1 s) → cmd 35 (1 s timeout); button "Stop sample". While sampling every ball change resends cmd 18 (debounced 200 ms). Stop: cmd 36 (2 s); button back to "Sample". Failure toasts "Failed to start sample" / "Failed to stop sample". Same flow in the ball-editor dialog and calibration page 1 uses its own flow (§4.9).

### 4.6 Wait mode, pass ball, sound trigger
- Info "New wait mode" toggle: saves pref `WAIT_MODE`, sends cmd 30 [1/0] if connected; editors label the wait button "Pass wait" when on. Sent again on each connect (fw ≥ 6.24).
- Pass ball (Info → Set Pass ball): ball editor dialog; Save stores `pass.json` and sends cmd 31 `[0x01, state, 7-byte ball]` if connected. Default pass ball (141, 7, 6, 8, 4, 6). Unload ball dialog stores `unload.json` only (default 153, 2, 6, 0, 8, 6).
- Wait play: cmd 32 [2] → robot reports state 15 → app starts microphone detector (`u6/u0` + `v6/d`), 44.1 kHz mono 16-bit, threshold = pref `SOUND_THRESHOLD` (default 6000), timeout 30 s:
  - on start: beep (ToneGenerator stream ALARM vol 100, tone 93, 150 ms), status "Waiting for serve";
  - detection without filter: max positive sample of a buffer > threshold, ignoring the first 600 ms; with filter: dominant FFT frequency in [1000, 2000) Hz and peak |sample| > threshold;
  - on detection: send cmd 32 [0] (start), clear status, stop listening;
  - on timeout: cmd 33 stop, mode 0.
  The sound trigger always runs WITHOUT the noise filter (bug, §6).
- Sound calibration dialog: continuous meter (level updates per buffer; when the new value is lower it shows the average of old and new = decay); 0 is reported when quiet for 200 ms. Save stores threshold (0…23000) and filter flag. Missing RECORD_AUDIO permission → permission prompt, meter stays idle.

### 4.7 Cycle popups
Per-exercise (a0, `popup_cycle`):
- Segment: off → cycle disabled; 20 → (20 s play, 10 s pause); 40 → (40, 20); 60 → (60, 30); 80 → (80, 40); custom → enabled with current slider values. Moving a slider selects "custom". Initial segment from current values.
- Mode: time → ballMode false, play label "Play %d secs", play max 120; repeat → ballMode true, "Play %d times", max 180 (but the initial setup when opening applies the opposite maxima — bug).
- Effects update the "Cycle" button text: "Cycle:\noff" or "Cycle(secs):\nP / D" / "Cycle(reps):\nP / D". Dirty.
- Protocol: single exercise → cmd 39 `[mode, play, delay]` mode 0 off / 1 time / 2 ball(repeat) mode. In a sequence slot the same values go into cmd 57 per slot.
Sequence (j1, `popup_globalcycle`): off / time / repeat / unique (unique = sequenceMode, cmd 39 mode 3). Button text "Sequence cycle:\noff", "Sequence cycle\n(secs): P / D", "Sequence cycle\n(repeat): P / D", "Sequence cycle:\nunique". Any change marks the sequence as needing re-upload.

### 4.8 Random popup (exercise) and random toggle
Checkboxes map to cmd 37 bits: "Type RND" = 1, "Scatter" = 2, "Place RND" = 4. On dismiss the flags are stored (random enabled) and pushed (cmd 37 together with 34 and 39). Button text (N3, a0.java:1575-1608): none → "Random:\noff"; Scatter → "Scatter"; Place RND → "Place RND"; both → "Place RND,\nScatter"; Type RND → "Type RND" (replaces place texts); Type+Place → "Total RND" (+ ",\nScatter"). Toggle buttons only flip the enabled flag (flags kept; disabled sends 0).
Sequence: "Random" toggle = enable/disable with Type RND forced on.

### 4.9 Robot control actions (`a1`)
- Calibrate: hide buttons, show page 1 (`calibration_desc_1` text, `calibration_center` image, "Sample", "Continue calibration").
  - "Sample" (and "Continue" if not done yet) → cmd 24; reply `[status, height, topspin, sidespin, speed]` (signed bytes) stored; keep screen on; Sample hidden.
  - Page 2: "topspin correction:", "sidespin correction:", `calibration_desc_3`, image, "height:", "speed:" each with "—"/"+" and the current value label. Each press changes the field by 1 and sends cmd 25 with the 4 bytes; the reply (`[status, 4 bytes]`) refreshes labels. "Cancel" → cmd 26 [0] (discard, exit). "Continue calibration": fw > 6.17 → page 3 and cmd 27 (reply byte1 = correction −2…+2, selects segment 2+v); older fw → cmd 26 [1] (save, exit).
  - Page 3: `calibration_desc_4`, SegmentedControl [-2|-1|0|+1|+2] → cmd 28 [segment index 0…4]; "Cancel" → cmd 26 [0]; "Save calibration" → cmd 26 [1]. On exit the buttons view returns.
  - Leaving the screen while calibrating sends cmd 26 [0].
- Learn remote: cmd 85 [1], then cmd 80; notifications cmd 81 `[secs]` → button text "Learning (N secs.)", cmd 82 `[n]` → toast "Stored button N"; final reply cmd 83 → text back to "Learn remote", cmd 85 [0].
- Unload balls ↔ "Stop unload": cmd 34 [100] → cmd 20 [unload ball] → cmd 32 [0]; stop = cmd 33. (No cmd 37/39 sent, so a previous random/cycle mode stays active — fragile.)
- Disconnect: clear saved MAC, disconnect, back to scan list, scanning continues.
- Firmware update: see §7.
- Leaving/destroying the screen sends cmd 33.

### 4.10 Sequence editor (`j1`) — play
- Play: if no exercises toast "No exercise to play!". Mode 2, progress dialog (only if upload needed). Push 34/37/39 (global cycle), then if upload needed: for slots 101…110 cmd 49 `[slot, 10×8-byte balls]` (≤10 s each) or cmd 50 `[slot]` for unused slots (≤2 s each), then cmd 57 `[0x01, 10×(mode, play, delay)]` with mode 0/1/2 per exercise cycle; then cmd 39 global cycle; then cmd 41 [0x01]. Without upload (unchanged since last play in this screen) only cmd 5 then 39 and 41. On failure cmd 5 and stop if state 3. After success cmd 85 [2].
- Events: cmd 44 `[ball, t, t, seqIndex]` → highlight table seqIndex−1, ball ball−1; cmd 58/59 status as in a0.
- Stop "Stop sequence" → cmd 33 → mode 0.
- Delete exercise (menu) only when > 1 exercise; Duplicate (max 10), Move left/right; each marks dirty and "needs upload".
- Save menu: Save / Save As (copy with new UUID via properties dialog) / Revert.

---------------------------------------------------------------------------------------------------

## 5. Data model and storage

### 5.1 Storage (Android private files + SharedPreferences of MainActivity)
- `games_list.json` — the whole gameset; written on every change and on destroy; a `.bak` copy of the old file is made first; on read failure the `.bak` is loaded (g0.java:65-84).
- `pass.json`, `unload.json` — one ball each.
- Prefs: `CONNECTED_ROBOT_MAC`, `LAST_LOADED_GAMESET` ("4" after migration), `SOUND_THRESHOLD` (int, default 6000), `SOUND_FILTER` (bool), `WAIT_MODE` (bool).

### 5.2 JSON formats
Gameset file (`.amicusgame` and `games_list.json`):
```json
{ "version": "1.0",            // "1.0" or "1" accepted (share writes the number 1.0)
  "games": [ Game, ... ] }
```
Game (`e0`):
```json
{ "name": "Exercise 79", "description": "...",
  "video": "exercise79",              // optional: raw resource name or absolute file path
  "uuid": "9f38e082-...",             // identity for merge/replace
  "sequence": false,                  // true = sequence (up to 10 exercises), false = 1 exercise
  "builtin": {"index":3,"version":1,"prepend":true},   // optional, informational
  "exercises": [ Exercise, ... ],     // legacy alternative: "ballsData": Exercise
  "settings": { "ball_per_min": 40,
                "random_mode": ["type:RND","place:rnd","place:RND"],   // any subset
                "cycle": {"play":40,"delay":20,"enabled":false,"ballMode":false,"sequenceMode":false} } }
```
Exercise (`q0`): object with keys "0".."9" (sorted numerically) = balls, plus optional
`"cycle": {"play":P,"delay":D,"enabled":bool(default true when key missing!),"ballMode":bool}` (sequenceMode is read but never written here).
Ball (`n`): `{"trajectory":0-153,"spin":0-12,"side_spin":0-12,"speed":0-24,"place":0-16,"ball_per_min_percent":0-12,"state":0|1|2,"range":0-8 (optional)}`.
Random mode JSON names: `type:RND` = bit 1, `place:rnd` = bit 2 ("Scatter"), `place:RND` = bit 4.
Single exercises store their cycle in `exercises[0].cycle`; `settings.cycle` is used for sequences (global cycle) and is also written for new exercises.

### 5.3 Built-in content
Factory gameset `assets/Gamesets/3.amicusgame` ("version":"1.0") — 21 single-ball-list exercises, all `"sequence": false`, no `settings`, no `cycle`, every ball `side_spin 6`, `ball_per_min_percent 6`, `state 1`. Ball tuples are (trajectory, spin, side_spin, speed, place, freq):

| Name | Description | Balls |
|---|---|---|
| Exercise 79 | 1 topspin to BH, 1 topspin to FH | (92,7,6,11,2,6) (92,7,6,11,14,6) |
| Exercise 80 | 1 topspin to FH, 1 topspin to MID | (92,7,6,11,14) (92,7,6,11,8) |
| Exercise 81 | 1 topspin to BH, 1 topspin to MID | (92,7,6,11,2) (92,7,6,11,8) |
| Exercise 82 | "FALKENBERG" 2 topspins to BH, 1 topspin to FH | (92,7,6,11,2) ×2, (92,7,6,11,14) |
| Exercise 83 | 2 topspins to FH, 2 topspins to BH | place 14,14,2,2 (92,7,6,11) |
| Exercise 84 | 1 topspin to FH, 1 topspin to MID, 1 topspin to FH, 1 topspin to BH | place 14,8,14,2 (92,7,6,11) |
| Exercise 85 | 1 topspin to BH, 1 topspin to MID, 1 topspin to BH, 1 topspin to FH | place 2,8,2,14 |
| Exercise 86 | 3 topspins to FH, 1 topspin to BH | place 14,14,14,2 |
| Exercise 87 | 1 topspin to FH, 1 topspin to MID, 1 topspin to BH, 1 topspin to MID | place 14,8,2,8 |
| Exercise 88 | 1 backspin to FH, 1 bsckspin to MID, 1 backspin to BH, 1 backspin to MID | (92,3,6,12) place 14,8,2,8 |
| Exercise 89 | 1 backspin to FH, 1 topspin to BH, 1 topspin to MID | (92,3,6,12,14) (92,7,6,11,2) (92,7,6,11,8) |
| Exercise 90 | 1 backspin to BH, 1 topspin to MID, 1 topspin to FH | (92,3,6,12,2) (92,7,6,11,8) (92,7,6,11,14) |
| Exercise 91 | 1 halflong to MID, 1 topspin to MID | (107,3,6,8,8) (92,7,6,12,8) |
| Exercise 92 | 1 halflong to BH, 1 topspin to FH | (104,3,6,9,3) (92,7,6,12,14) |
| Exercise 93 | 1 halflong to FH, 1 topspin to BH | (104,3,6,9,14) (92,8,6,12,2) |
| Exercise 94 | 1 halflong to FH, 1 halflong to MID, 1 halflong to BH | (104,3,6,9,14) (104,3,6,8,8) (104,3,6,9,2) |
| Exercise 95 | 1 serve to BH, 1 topspin to FH | (59,4,6,6,1) (92,7,6,12,14) |
| Exercise 96 | 1 serve to FH, 1 topspin to BH | (57,4,6,6,15) (92,7,6,12,2) |
| Exercise 97 | 1 serve to FH, 1 topspin to FH | (55,4,6,6,15) (93,3,6,12,14) |
| Exercise 98 | 1 serve to BH, 1 topspin to BH | (57,4,6,6,2) (92,3,6,12,2) |
| Exercise 99 | 1 serve to FH, 1 serve to MID, 1 serve to BH | (57,4,6,6,14) (54,4,6,6,8) (57,4,6,6,2) |

Videos: field `video` = "exercise79"…"exercise99"; only 79–88 exist in `res/raw`. UUIDs are in the file; keep them (merge key).

Defined in code (`e0.java`):
- `Default game` — one default ball (92,5,6,12,8,6), description "default ball", UUID `92D86A79-E6BA-49FD-923D-B9F490B0239A`, builtin (3,1,true). Initial gameset when no file exists.
- `Unload` — one unload ball, "Unload balls from the robot", UUID `986eb8e1-a29b-42d3-9d2f-c68d6d977252` (used only by the Unload button, never listed).
- Migration (MainActivity.java:366-397): if `LAST_LOADED_GAMESET` < 3 merge 3.amicusgame; if < 4 set ball 1 place = 2 in the game with UUID `337ca581-dd53-4a9e-9b99-8f26f4b5433e` (an older factory game, not in this APK).

### 5.4 Ball encoding helpers
- `n.m(fwMajor, sevenByte)`: `[traj_lo, traj_hi, spin, side_spin, speed, place | (min(7,range)<<5 if fwMajor>5 and range>0), freq, (state)]` (n.java:181-205). fwMajor defaults to 5 until device info arrives.
- Mirror: place = 16−place, side_spin = 12−side_spin.

### 5.5 Import / export / restore
- Import: open file intent → parse into a temp gameset → if ≥1 game, "Import games" confirm → merge: game with same UUID replaced in place, others appended → save, refresh list (MainActivity.t0, :613-646).
- Export: Share in list edit mode (§2.1). Video field cleared.
- Restore factory exercises: confirm "Are you sure to import 21 games?" → merge 3.amicusgame (user games kept; factory ones overwritten by UUID).

---------------------------------------------------------------------------------------------------

## 6. Bugs and fragile code to avoid

1. Search filter + tap opens the wrong exercise: click uses the filtered adapter position as gameset index (ExercisesFragment.java:96 → MainActivity.e). Map filtered item → game id.
2. Share mutates the stored game: `e0VarF.f11527d = ""` clears the real game's video before export (ExercisesFragment.java:407); the change is persisted on next save.
3. Ball editor dialog (pass/unload) stores the *display* percent (−60…60) into the raw frequency field (d.java:653, uses `i8`=value instead of progress). Exercise editor does it right (a0.java:1816).
4. Sound trigger ignores the saved noise filter: the 4-arg `u6.u0` constructor hard-codes `false` (u6/u0.java:12; called at a0.java:865).
5. `n.c()` range check for trajectory uses spin for the upper bound (`f11696b + i7 <= 153`, n.java:148) — live trajectory "+" never blocked at 153.
6. Cycle popup initial max values inverted vs. the mode handler (time→180, repeat→120 at a0.java:2442-2453 vs 120/180 at :1319-1325). Sequence popup sets max on the PAUSE slider instead of the play slider (j1.java:241, 249).
7. No clamping: `SliderWithNumbers.setValue` and `Slider.setProgress` accept out-of-range values (SliderWithNumbers.java:292-297, Slider.java:562-566). Factory exercises have cycle (0,0) → cycle popup shows "Play 0 secs" with the thumb off-track, and enabling cycle sends cmd 39 [1,0,0].
8. Single-exercise "Wait" start never resolves its promise: `o.a` calls `G(true)` and drops the result (o.java:56); the play controller's success callback (Stop enable, remote canControl) never runs for wait starts.
9. "Save to Sequence" appends the editor's live `q0` object, not a copy (a0.r3, ~:1722); later edits in the open exercise silently change the sequence in memory. "Save As" also shares `T0`.
10. "New Sequence" creates a sequence with an empty name (`new e0(true, "")`, a0.r3).
11. Mirror in view mode changes balls without marking dirty (a0.java:2373-2375); in play mode also not dirty.
12. Reply dispatcher drops other pending one-shot handlers for the same command: the whole entry is removed before dispatch and only persistent handlers are re-added (c.java:31-56). Two concurrent cmd-5 requests → the second never resolves.
13. Blocking waits ignore failure: `promise.b(ms)` returns silently on timeout (h6/a.java:39-62); e.g. settings push 34/37/39 and sample start continue after failures. Several of these waits run on the UI thread (`w0.f` → `v0.r` from a main-looper handler, a0.d :364-374).
14. "Batch mode" is a race: `q.z()` starts a thread that immediately clears the batch flag while the caller queues commands from its own threads (q.java:2905-2910, n0 :1297-1312). Effective order is not guaranteed.
15. Read-after-write (s.java:212) re-parses the characteristic value; a stale last value can re-fire persistent handlers (e.g. duplicate cmd 44 ball events). Do not read after write.
16. Static inbound buffer `q.f11720w` survives across connections (q.java:22): partial packets from a dropped link corrupt the next session. Also a hard-coded hack pads 4 zero bytes when the buffer holds 66 bytes of cmd 51 (q.java:2876-2879).
17. Keepalive disconnect: if no cmd-5 reply arrived within 2 s of the first write, the app disconnects (q.java:935-953). The constructor sleeps 1 s on the calling (Binder/UI) thread (q.java:2368-2377). MTU request not awaited; CCCD written with indication value only.
18. `Handler.removeCallbacks(null)` is a no-op (a0.java:1844, 2058; j1.java:1001, 1163): the 40-s "Connection lost" runnable is never cancelled; only a connected check inside prevents the dialog. The "restart" option kills the process.
19. Sequence "already uploaded" flag `C0` is per screen and not reset on reconnect, robot power cycle or after a single exercise was played elsewhere: Play may start stale slots 101–110 without upload (j1.java:722-731, 1112).
20. Unload does not reset random/cycle (cmd 37/39) first (a1.java:503-506).
21. Range: UI allows ±8 but encoding sends min(7, range) (n.java:203); no range at all for fw ≤ 5 although the UI still shows it.
22. `e0.equals` dereferences the other game's UUID (e0.java:194): an imported game without `"uuid"` makes later `indexOf` calls throw NPE. Generate a UUID on import.
23. UTF-8 decoding in 1024-byte chunks (`new String(bArr,0,n)`, g0.java:126, n.java:107) corrupts multibyte characters split across chunks.
24. Exercise cycle `"enabled"` defaults to true when missing in JSON (`optBoolean("enabled", true)`) while defaults elsewhere are false.
25. SignalStrengthView percent branch uses integer division (`i7 / 100`, SignalStrengthView.java:94); setter never invalidates.
26. Manual language: German PDF never shown (p0.java:46-49).
27. Landing cache in `l1` keyed on a lossy packed hash of the velocity (u6/w0.hashCode) — collisions can show a wrong landing point in list previews.
28. Drag reorder in the list is not persisted until another save or app destroy (`x4.b` never sets its drop indices, so `ExercisesFragment.e` is never called).
29. jadx-garbled spots (treat as ambiguous, implement the obvious intent): `d.e` error-code mapping (d.java:875-905), `x0.a()` random flag build (x0.java), a1 calibration `onClick` fall-through (a1.java:940-974, intent: change one field, send cmd 25 once), j1 global-cycle popup and table cycle icons (j1.java:1065-1074, 1336-1369), t0.e speed for 11–18 (PROTOCOL.md formula is the consistent one).

---------------------------------------------------------------------------------------------------

## 7. Firmware update (not to be implemented)
Exists on the Robot control screen ("Firmware update" button, `a1.d3/u3/A3`). Bundled image `assets/Firmware/prime_7_1.bin` (version 7.1, table `a1.R0`). Uses cmd 64 (enter bootloader), cmd 65 (128-byte blocks with 16-bit index), cmd 66 (finish); progress dialog "Updating firmware". Robot state 64 = bootloader → "Damaged Amicus firmware detected…" dialog. Do not implement or send these commands.

---------------------------------------------------------------------------------------------------

## 8. Landing model
As in PROTOCOL.md (t0.e, l1.c/e) — confirmed. Notes: spin enters only via the two tables (`t0.c` spin value is passed through the integrator unused); side spin and frequency are ignored; integration stops at y ≤ 0 with no net/table collision; editor uses the uncached path (with trajectory points), list rows use the cached landing point only.

---------------------------------------------------------------------------------------------------

## 9. Corrections / additions to PROTOCOL.md
1. **Device info (cmd 1) bytes**: `[0]=?`, `[1]=hardware version` (high nibble major, low nibble minor; app requires ≥ 16 = hw 1.0 to run the handshake), `[2]=bootloader version`, `[3]=fw major`, `[4]=fw minor`, `[5..6]=serial number LE` (a1.java:246, y.java).
2. **Ball state 2 = "serve" ball** (UI switch "Serve", pink chip), allowed for the first 1–3 balls as a prefix — not a "random group".
3. **cmd 36 = stop sample** (single-ball preview), 2 s timeout; app sets local state 4. cmd 35 = start sample, 1 s timeout.
4. **cmd 26 = end calibration**: `[1]` save, `[0]` cancel. Calibration values are read with cmd 24 (reply `[status, height, topspin, sidespin, speed]`, signed); cmd 25 writes `[height, topspin, sidespin, speed]`, reply `[status, 4 bytes]`. Whether cmd 24 itself starts the robot's calibration sampling is not provable from the app (the app hides "Sample" after it — likely).
5. **cmd 27 / cmd 28 = trajectory symmetry correction** (fw > 6.17): cmd 27 reply byte 1 = current value −2…+2; cmd 28 `[n]` with n = segment index 0…4 (= value + 2). Index vs. value encoding is slightly ambiguous.
6. **cmd 30 wait mode** and **cmd 31 pass ball** are only sent when fw ≥ 6.24. cmd 30 reply = device info.
7. **cmd 32 `[2]` = start in wait mode**: robot goes to state 15 (waiting for serve); app detects the serve sound and sends cmd 32 `[0]`.
8. **cmd 44 payload** `[ball (1-based), t_lo, t_hi, seq (1-based slot in program mode)]`; app logs t as "timeToLaunch".
9. **cmd 58** = cycle pause `[seconds]`; **cmd 59** = cycle play `[mode, n]` (mode 1 = seconds, else repetitions).
10. **cmd 80 = learn remote**: notifications cmd 81 `[seconds left]`, cmd 82 `[stored button n]`, completion reply cmd 83.
11. **cmd 84 buttons** (byte 1): 1 = start, 2/4 = bpm changed on the robot (re-read with cmd 43), 8 = stop. Only delivered when cmd 85 ≥ 1.
12. **cmd 3 recalibrate** = "Reset head" button; reply arrives as cmd 5.
13. **cmd 37 bits**: 1 = Type RND, 2 = "Scatter" (place rnd), 4 = Place RND.
14. **cmd 57 mode**: 0 off, 1 time, 2 repetition (ball) mode. **cmd 39 mode**: 0 off, 1 time, 2 repetition, 3 unique (sequence mode; only for sequences).
15. **cmd 18** is sent with state forced to 1; cmd 17 `[1]` selects it; then cmd 34 `[20]` and cmd 35.
16. **cmd 34 reply** `0xF0` means OK (app then assumes the requested value); otherwise the byte is the value.
17. **cmd 41** reply may arrive as cmd 41 or cmd 5.
18. **cmd 50** reply `[slot, status]`; app also accepts a bare status.
19. **cmd 7 error codes**: 1 feeding motor jam, 2 ball stuck between discs, 3 overheat, other = permanent jam.
20. **Two replies per request** are caused by the official app reading the characteristic after every write; a Web Bluetooth client that does not read sees one notification (verify).
21. **Keepalive**: app polls cmd 5 every 2 s continuously and disconnects after 6 s without any notification.
22. Range bits: value capped at 7; firmware major must be > 5.
23. Speed formula in PROTOCOL.md for 11–18 is correct (continuous; jadx text is garbled).
24. Unload ball default: (153, 2, 6, 0, 8, 6); played with cmd 34 `[100]`, cmd 20, cmd 32 `[0]`.

---------------------------------------------------------------------------------------------------

## 10. Strings not used in code (can be skipped)
"Playing ball %d / %d", "Exercise started", "Cycle started", "Sequence started", "Start playing", "Stop playing", "Undo", "New Exercise", "Adjust\nall Speeds/Spins/Traj.", "Save to file", "File saved…", "Enter file name", "Select file to import…", "New version available", "Share" (title_share), "Closing…", "Connecting…", "Next/Previous Page", "No description: add one by pressing the edit" (not referenced as far as checked).
