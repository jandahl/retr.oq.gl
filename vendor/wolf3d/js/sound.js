Wolf.Sound = (function() {

    Wolf.setConsts({
        // Sound channels
        // Channel 0 never willingly overrides
        // Other channels (1-7) always override a playing sound on that channel
        CHAN_AUTO               : 0,
        CHAN_WEAPON             : 1,
        CHAN_VOICE              : 2,
        CHAN_ITEM               : 3,
        CHAN_BODY               : 4,
        // Modifier flags
        CHAN_NO_PHS_ADD			: 8,	// Send to all clients, not just ones in PHS (ATTN 0 will also do this)
        CHAN_RELIABLE			: 16,	// Send by reliable message, not datagram
        // Sound attenuation values
        ATTN_NONE               : 0,	// Full volume the entire level
        ATTN_NORM               : 1,
        ATTN_IDLE               : 2,
        ATTN_STATIC             : 3,	    // Diminish very rapidly with distance
        
        MAX_PLAYSOUNDS          : 128,
        MAX_CHANNELS            : 64,
       
        MUSIC_VOLUME            : 0.8,
        MASTER_VOLUME           : 0.6
    });

    var sounds = {},
        audioElements = [],
        currentMusic,
        soundEnabled = true,
        musicEnabled = true,
        music,
        ext, 
        exts = ["ogg", "mp3"];
    
    function getFileName(file) {
        if (!ext) {
            // look for a probably
            for (var i=0;i<exts.length;i++) {
                if (Modernizr.audio[exts[i]] == "probably") {
                    ext = exts[i];
                    break;
                }
            }
            // look for a maybe
            if (!ext) {
                for (var i=0;i<exts.length;i++) {
                    if (Modernizr.audio[exts[i]] == "maybe") {
                        ext = exts[i];
                        break;
                    }
                }
            }
        }
        
        return file.split(".")[0] + "." + ext
    }

    // Low-latency path: decode every effect once into an AudioBuffer and fire it
    // through Web Audio. Streaming an <audio> element per first play cost >1s
    // (network fetch + decoder spin-up); buffers start in a few ms.
    var ctx = null,
        buffers = {},      // file -> AudioBuffer
        loading = {},      // file -> true while fetching/decoding
        masterGain = null;

    function getContext() {
        if (!ctx) {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) { return null; }
            try {
                ctx = new AC();
                masterGain = ctx.createGain();
                masterGain.connect(ctx.destination);
            } catch (e) { ctx = null; }
        }
        return ctx;
    }

    function resumeContext() {
        var c = getContext();
        if (c && c.state == "suspended") {
            var p = c.resume();
            if (p && p.catch) { p.catch(function() {}); }
        }
    }

    function loadBuffer(file, done) {
        var c = getContext(), xhr;
        if (!c || buffers[file] || loading[file]) { return; }
        loading[file] = true;
        xhr = new XMLHttpRequest();
        xhr.open("GET", getFileName(file), true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function() {
            if (xhr.status != 200 && xhr.status != 0) { loading[file] = false; return; }
            var ok = function(buf) { buffers[file] = buf; loading[file] = false; if (done) { done(buf); } },
                fail = function() { loading[file] = false; },
                p = c.decodeAudioData(xhr.response, ok, fail);
            if (p && p.catch) { p.catch(fail); }
        };
        xhr.onerror = function() { loading[file] = false; };
        xhr.send();
    }

    function playBuffer(buf, volume) {
        var c = getContext(), src, gain;
        if (!c) { return false; }
        resumeContext();
        src = c.createBufferSource();
        gain = c.createGain();
        src.buffer = buf;
        gain.gain.value = volume;
        src.connect(gain);
        gain.connect(masterGain);
        src.start(0);
        return true;
    }

    function preloadSounds(list) {
        for (var i = 0; i < list.length; i++) { loadBuffer("lsfx/" + list[i] + ".wav"); }
    }

    function createAudioElement() {
        var audio = new Audio();
        audioElements.push(audio);
        return audio;
    }

    function startSound(posPlayer, posSound, entNum, entChannel, file, volume, attenuation, timeOfs) {
        var audio, dx, dy, dist;

        if (posPlayer && posSound) {
            dx = (posPlayer.x - posSound.x) / Wolf.TILEGLOBAL;
            dy = (posPlayer.y - posSound.y) / Wolf.TILEGLOBAL;
            dist = dx * dx + dy * dy;
            volume *= 1 / (1 + dist / 50);
        }
        if (buffers[file]) {
            if (soundEnabled && playBuffer(buffers[file], volume * Wolf.MASTER_VOLUME)) { return; }
            if (!soundEnabled) { return; }
        } else {
            loadBuffer(file);   // first use of an unlisted sound: fall back below, buffered next time
        }
        posPlayer = posSound = null;   // attenuation already applied above

        if (!sounds[file]) {
            sounds[file] = [];
        }
        for (var i=0;i<sounds[file].length;i++) {
            if (sounds[file][i].ended || sounds[file][i].paused) {
                audio = sounds[file][i];
                break;
            }
        }
        if (!audio) {
            audio = createAudioElement();
            audio.src = getFileName(file);
            sounds[file].push(audio);
        }

        if (posPlayer && posSound) {
            dx = (posPlayer.x - posSound.x) / Wolf.TILEGLOBAL;
            dy = (posPlayer.y - posSound.y) / Wolf.TILEGLOBAL;
            dist = dx * dx + dy * dy;
            volume *= 1 / (1 + dist / 50);
        }

        audio.volume = volume * Wolf.MASTER_VOLUME * (soundEnabled ? 1 : 0);
        var playPromise = audio.play();
        if (playPromise && playPromise.catch) {
            playPromise.catch(function() {});
        }
    }
    
    function startMusic(file) {
        if (!music) {
            music = createAudioElement();
            music.loop = true;
        }
        var filename = getFileName(file);
        if (currentMusic != filename) {
            music.src = currentMusic = filename;
            music.volume = Wolf.MUSIC_VOLUME * Wolf.MASTER_VOLUME * (musicEnabled ? 1 : 0);
            var playPromise = music.play();
            if (playPromise && playPromise.catch) {
                playPromise.catch(function() {});
            }
        }
    }

    function stopAllSounds() {
        for (var i=0;i<audioElements.length;i++) {
            if (audioElements[i].currentTime > 0) {
                audioElements[i].currentTime = 0;
                audioElements[i].pause();
            }
        }
    }
    
    function init() {
        // all shipped effects in lsfx/ (~370KB); decoded once, then played with ~0 latency
        preloadSounds(["001", "003", "005", "008", "009", "012", "023", "028", "030", "031", "032", "033", "034", "035", "036", "037", "038", "039", "040", "044", "045", "061", "062", "064", "069", "076", "078", "080", "085", "086"]);
        document.addEventListener("keydown", resumeContext, true);
        document.addEventListener("pointerdown", resumeContext, true);
        document.addEventListener("touchstart", resumeContext, true);
    }
    
    
    function isMusicEnabled() {
        return musicEnabled
    }
    
    function isSoundEnabled() {
        return soundEnabled;
    }
   
    function toggleMusic(enable) {
        if (typeof enable != "undefined") {
            musicEnabled = enable;
        } else {
            musicEnabled = !musicEnabled;
        }
        if (music) {
            music.volume = Wolf.MUSIC_VOLUME * Wolf.MASTER_VOLUME * (musicEnabled ? 1 : 0);
        }
    }
    
    function pauseMusic(enable) {
        if (music) {
            if (enable) {
                music.pause();
            } else if (music.paused) {
                music.play();
            }
        }
    }

    function toggleSound(enable) {
        if (typeof enable != "undefined") {
            soundEnabled = enable;
        } else {
            soundEnabled = !soundEnabled;
        }
    }
    
    if (Modernizr.audio) {
        return {
            startSound : startSound,
            startMusic : startMusic,
            stopAllSounds : stopAllSounds,
            isMusicEnabled : isMusicEnabled,
            isSoundEnabled : isSoundEnabled,
            toggleMusic : toggleMusic,
            toggleSound : toggleSound,
            pauseMusic : pauseMusic,
            init : init
        }
    } else {
        return {
            startSound : Wolf.noop,
            startMusic : Wolf.noop,
            stopAllSounds : Wolf.noop,
            isMusicEnabled : Wolf.noop,
            isSoundEnabled : Wolf.noop,
            toggleMusic : Wolf.noop,
            toggleSound : Wolf.noop,
            pauseMusic : Wolf.noop,
            init : Wolf.noop
        }
    }
})();