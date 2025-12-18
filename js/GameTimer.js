export default class GameTimer {
    constructor(durationSeconds) {
        this.initial = durationSeconds;
        this.remaining = durationSeconds;
        this.running = false;
        this.onTimeUp = null;
    }

    start() {
        this.running = true;
    }

    pause() {
        this.running = false;
    }

    reset() {
        this.remaining = this.initial;
        this.running = false;
    }

    update(dt) {
        if (!this.running) return;

        this.remaining -= dt;

        if (this.remaining <= 0) {
            this.remaining = 0;
            this.running = false;
            if (this.onTimeUp) this.onTimeUp();
        }
    }

    reduce(seconds) {
        this.remaining = Math.max(0, this.remaining - seconds);
    }

    getFormatted() {
        const m = Math.floor(this.remaining / 60);
        const s = Math.floor(this.remaining % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}
