# Sound credits: ambience and UI effects

Every file in this folder was built on 2026-11-01 by `audio-src/tools/build_sfx.py` from the sources below.
All sources were downloaded without an account, and each license was checked on the official source page.
Output format: Ogg Opus, mono, 48 kHz. Changes made to every source: mixed to mono, trimmed or cut to a
loop window, filtered (EQ), level-normalized, resampled to 48 kHz, encoded to Opus. Loops also got an
equal-power crossfade at the loop point.

## Attribution required (CC BY 4.0)

**amb_room_hvac.ogg** uses two recordings by Gravity Sound. Required credit line:

> "air conditioner hum" and "air conditioner hum 2" by Gravity Sound (https://www.gravitysound.studio/),
> via Wikimedia Commons, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
> Changed: mixed to mono, joined into one loop, filtered, level-adjusted.

Put that line in the game's credits or about screen too, if the game has one.

| Source | Page | Direct file | License |
|---|---|---|---|
| air conditioner hum (Gravity Sound), 14.0 s, 44.1 kHz stereo WAV | https://commons.wikimedia.org/wiki/File:Air_conditioner_hum_(Gravity_Sound).wav | https://upload.wikimedia.org/wikipedia/commons/9/99/Air_conditioner_hum_%28Gravity_Sound%29.wav | CC BY 4.0 |
| air conditioner hum 2 (Gravity Sound), 18.0 s, 44.1 kHz stereo WAV | https://commons.wikimedia.org/wiki/File:Air_conditioner_hum_2_(Gravity_Sound).wav | https://upload.wikimedia.org/wikipedia/commons/d/dc/Air_conditioner_hum_2_%28Gravity_Sound%29.wav | CC BY 4.0 |

## Public domain (credit not required, given as a courtesy)

These came to Wikimedia Commons from PDSounds.org. Each Commons page carries the `PD-author` license
template, meaning the author released the recording into the public domain.

| File here | Source title, author | Page | Direct file |
|---|---|---|---|
| amb_rain_window.ogg | "Rain against the Window" by cori (PDSounds #600, 2008) | https://commons.wikimedia.org/wiki/File:Rain_against_the_window.ogg | https://upload.wikimedia.org/wikipedia/commons/4/41/Rain_against_the_window.ogg |
| amb_crowd_murmur.ogg | "1 minute at the alexa mall in Berlin" by thore (PDSounds #407, 2007) | https://commons.wikimedia.org/wiki/File:1_minute_at_the_alexa_mall_in_berlin.ogg | https://upload.wikimedia.org/wikipedia/commons/f/fd/1_minute_at_the_alexa_mall_in_berlin.ogg |
| amb_office_bustle.ogg | "Ambient Classroom-Mono" by rcrossley (PDSounds #580, 2008) | https://commons.wikimedia.org/wiki/File:Ambient_classroom_mono.ogg | https://upload.wikimedia.org/wikipedia/commons/1/10/Ambient_classroom_mono.ogg |

## CC0 1.0 (credit not required, given as a courtesy)

License text: https://creativecommons.org/publicdomain/zero/1.0/

| File here | Source, author | Page | Direct file |
|---|---|---|---|
| amb_city_night.ogg, amb_garage.ogg | "High Traffic Road Sounds" (gatve Varniu_2.ogg) by IgnasD | https://opengameart.org/content/high-traffic-road-sounds | https://opengameart.org/sites/default/files/gatve%20Varniu_2.ogg |
| amb_garage.ogg | "The Shop" free samples (convenience store drinks fridge drone, takes 1 and 2) by LEGIT Audio. The page states CC0 applies to the free files provided through OpenGameArt. | https://opengameart.org/content/the-shop | https://opengameart.org/sites/default/files/legit_audio_-_the_shop_free_sfx_wav.zip |
| sfx_choice_confirm.ogg | Kenney "Interface Sounds" 1.0, file pluck_002.ogg, by Kenney (www.kenney.nl) | https://kenney.nl/assets/interface-sounds | signed link issued by https://kenney.nl/download-link/6173736574732f696e746572666163652d736f756e6473 (kenney_interface-sounds.zip) |
| sfx_timer_tick.ogg | Kenney "Interface Sounds" 1.0, file tick_002.ogg | same as above | same as above |
| sfx_timeout_sting.ogg | Kenney "Impact Sounds", file impactBell_heavy_000.ogg | https://kenney.nl/assets/impact-sounds | signed link issued by https://kenney.nl/download-link/6173736574732f696d706163742d736f756e6473 (kenney_impact-sounds.zip) |
| sfx_card_transition.ogg | Kenney "Casino Audio", file card-slide-3.ogg | https://kenney.nl/assets/casino-audio | signed link issued by https://kenney.nl/download-link/6173736574732f636173696e6f2d617564696f (kenney_casino-audio.zip) |

Kenney's pages say "Creative Commons CC0" and each pack's License.txt says
"License: (Creative Commons Zero, CC0) ... free to use in personal, educational and commercial projects."

## Made for this project

**sfx_phone_buzz.ogg** is not from a third party. No account-free CC0 or CC BY recording of a phone
vibrating was found, so it was built in `build_sfx.py` from sine harmonics only (a 172 Hz motor tone,
soft clipping for the desk rattle, two pulses, no noise). It can be used freely; swap in a real recording
later if one turns up.

## Also downloaded and checked, not used

Kept in `audio-src/downloads/` for the record:
Kenney "UI Audio" (CC0, https://kenney.nl/assets/ui-audio);
OpenGameArt "202 More Sound Effects" by OwlishMedia (CC0, https://opengameart.org/content/202-more-sound-effects; its Phone files are keypad and dial tones, not a vibration);
"Rain (loopable)" by Ylmir (CC0, https://opengameart.org/content/rain-loopable; measured too close to steady hiss);
"Amb Rain Loop 2" and "Fridge Loop 1" by Kresiek The Furry (CC0, https://opengameart.org/content/amb-rain-loop-2, https://opengameart.org/content/fridge-loop-1);
"Restaurant Ambience" by stephan (public domain, https://commons.wikimedia.org/wiki/File:Restaurant_ambience.ogg; too many dish clatters).
