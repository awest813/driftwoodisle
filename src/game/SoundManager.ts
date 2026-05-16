import type { Scene } from "@babylonjs/core/scene";

type SoundCue =
    | "pickup"
    | "stone"
    | "wood"
    | "leaf"
    | "water"
    | "fish"
    | "crab"
    | "craft"
    | "build"
    | "error"
    | "menu"
    | "punch"
    | "step";

export class SoundManager {
    private static _instance: SoundManager | null = null;
    private _context: AudioContext | null = null;
    private _masterGain: GainNode | null = null;
    private _sfxGain: GainNode | null = null;
    private _ambienceGain: GainNode | null = null;
    private _rainGain: GainNode | null = null;
    private _windGain: GainNode | null = null;
    private _compressor: DynamicsCompressorNode | null = null;
    private _volume: number = 0.5;
    private _lastStepTime: number = 0;
    private _started: boolean = false;

    constructor(_scene: Scene) {
        SoundManager._instance = this;
        (window as any).soundManager = this;
        this._setupUnlockListeners();
    }

    public static get instance(): SoundManager | null {
        return SoundManager._instance;
    }

    public unlock(): void {
        const context = this._getContext();
        if (!context) return;

        context.resume().then(() => {
            if (!this._started) {
                this._started = true;
                this._startAmbience();
                this.play("menu");
            }
        }).catch(() => {});
    }

    public setMasterVolume(volume: number): void {
        this._volume = Math.max(0, Math.min(1, volume));
        if (this._masterGain) {
            this._masterGain.gain.setTargetAtTime(this._volume, this._getContext()?.currentTime ?? 0, 0.05);
        }
    }

    public setRain(on: boolean): void {
        this.unlock();
        const context = this._getContext();
        if (!context || !this._rainGain || !this._windGain) return;

        this._rainGain.gain.setTargetAtTime(on ? 0.075 : 0.0, context.currentTime, 1.2);
        this._windGain.gain.setTargetAtTime(on ? 0.055 : 0.03, context.currentTime, 1.8);
    }

    public getStatus(): { ready: boolean; unlocked: boolean; volume: number; ambience: number; rain: number } {
        return {
            ready: Boolean(this._context),
            unlocked: this._context?.state === "running",
            volume: this._volume,
            ambience: this._ambienceGain?.gain.value ?? 0,
            rain: this._rainGain?.gain.value ?? 0
        };
    }

    public playStep(): void {
        const now = Date.now();
        if (now - this._lastStepTime > 360) {
            this.play("step");
            this._lastStepTime = now;
        }
    }

    public play(id: SoundCue | string): void {
        this.unlock();
        const context = this._getContext();
        if (!context || !this._masterGain) return;

        switch (id) {
            case "pickup": this._pluck(620, 0.055, 0.12); break;
            case "stone": this._noiseTick(0.06, 0.18, 1100); break;
            case "wood": this._knock(140, 0.09, 0.17); break;
            case "leaf": this._noiseTick(0.035, 0.08, 3200); break;
            case "water": this._playNoiseBurst(0.08, 0.12, 1500, 0.1); break;
            case "fish": this._pluck(440, 0.07, 0.13); this._playNoiseBurst(0.05, 0.08, 1600, 0.08); break;
            case "crab": this._knock(260, 0.055, 0.13); this._knock(390, 0.035, 0.09, 0.045); break;
            case "craft": this._chime([420, 560, 760], 0.09); break;
            case "build": this._chime([180, 260, 360], 0.13); break;
            case "error": this._tone(120, 0.13, "sawtooth", 0.08); break;
            case "menu": this._pluck(520, 0.04, 0.08); break;
            case "punch": this._noiseTick(0.04, 0.11, 700); break;
            case "step": this._noiseTick(0.025, 0.07, 550); break;
        }
    }

    private _setupUnlockListeners(): void {
        const unlock = () => this.unlock();
        window.addEventListener("pointerdown", unlock, { once: false });
        window.addEventListener("keydown", unlock, { once: false });
    }

    private _getContext(): AudioContext | null {
        if (this._context) return this._context;

        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextCtor) return null;

        this._context = new AudioContextCtor();
        this._masterGain = this._context.createGain();
        this._masterGain.gain.value = this._volume;
        this._sfxGain = this._context.createGain();
        this._sfxGain.gain.value = 0.8;
        this._compressor = this._context.createDynamicsCompressor();
        this._compressor.threshold.value = -18;
        this._compressor.knee.value = 18;
        this._compressor.ratio.value = 5;
        this._compressor.attack.value = 0.004;
        this._compressor.release.value = 0.18;

        this._sfxGain.connect(this._masterGain);
        this._masterGain.connect(this._compressor);
        this._compressor.connect(this._context.destination);
        return this._context;
    }

    private _startAmbience(): void {
        const context = this._getContext();
        if (!context || !this._masterGain) return;

        this._ambienceGain = context.createGain();
        this._ambienceGain.gain.value = 0.04;
        this._ambienceGain.connect(this._masterGain);

        this._rainGain = context.createGain();
        this._rainGain.gain.value = 0;
        this._rainGain.connect(this._masterGain);

        this._windGain = context.createGain();
        this._windGain.gain.value = 0.025;
        this._windGain.connect(this._masterGain);

        this._startFilteredNoise(this._ambienceGain, 220, "lowpass");
        this._startFilteredNoise(this._rainGain, 1700, "highpass");
        this._startFilteredNoise(this._windGain, 420, "bandpass");
    }

    private _startFilteredNoise(output: GainNode, frequency: number, type: BiquadFilterType): void {
        const context = this._getContext();
        if (!context) return;

        const source = context.createBufferSource();
        const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.55;
        }

        const filter = context.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = type === "bandpass" ? 0.45 : 0.18;
        source.buffer = buffer;
        source.loop = true;
        source.connect(filter);
        filter.connect(output);
        source.start();
    }

    private _tone(frequency: number, duration: number, type: OscillatorType, gainValue: number, delay: number = 0): void {
        const context = this._getContext();
        if (!context || !this._masterGain) return;

        const osc = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + delay;
        osc.frequency.value = frequency;
        osc.type = type;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(this._sfxGain ?? this._masterGain);
        osc.start(start);
        osc.stop(start + duration + 0.03);
    }

    private _pluck(frequency: number, duration: number, gain: number): void {
        this._tone(frequency, duration, "triangle", gain);
        this._tone(frequency * 1.5, duration * 0.65, "sine", gain * 0.35, 0.012);
    }

    private _knock(frequency: number, duration: number, gain: number, delay: number = 0): void {
        this._tone(frequency, duration, "square", gain, delay);
        this._noiseTick(0.018, gain * 0.8, frequency * 2, delay);
    }

    private _chime(frequencies: number[], gain: number): void {
        frequencies.forEach((frequency, i) => this._tone(frequency, 0.16, "sine", gain / (i + 1), i * 0.055));
    }

    private _noiseTick(duration: number, gainValue: number, cutoff: number, delay: number = 0): void {
        this._playNoiseBurst(duration, gainValue, cutoff, delay);
    }

    private _playNoiseBurst(duration: number, gainValue: number, cutoff: number, delay: number): void {
        const context = this._getContext();
        if (!context || !this._masterGain) return;

        const source = context.createBufferSource();
        const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * duration)), context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const fade = 1 - i / data.length;
            data[i] = (Math.random() * 2 - 1) * fade;
        }

        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        const start = context.currentTime + delay;
        filter.type = "lowpass";
        filter.frequency.value = cutoff;
        gain.gain.setValueAtTime(gainValue, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this._sfxGain ?? this._masterGain);
        source.start(start);
    }
}
