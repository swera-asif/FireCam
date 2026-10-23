package app.firecam.alert;

import java.util.ArrayList;
import java.util.List;

/**
 * Smoke / CO alarm sound recognition, a direct port of showcase/src/alarm.js so the phone app and
 * the web app behave the same. Feed PCM windows; it reports when the ISO 8201 Temporal-Three
 * (smoke) or Temporal-Four (carbon monoxide) beep pattern repeats.
 */
public final class AlarmDetector {
    public static final class Result {
        public final String pattern; public final String kind; public final double time;
        Result(String pattern, String kind, double time) { this.pattern = pattern; this.kind = kind; this.time = time; }
    }
    private static final class Beep { final double start, end; Beep(double s, double e) { start = s; end = e; } }
    private static final class Pattern {
        final String name, kind; final double beepMin, beepMax, gapMin, gapMax, pauseMin, pauseMax; final int count, groups, partial;
        Pattern(String name, String kind, double bMin, double bMax, double gMin, double gMax, double pMin, double pMax, int count, int groups, int partial) {
            this.name = name; this.kind = kind; beepMin = bMin; beepMax = bMax; gapMin = gMin; gapMax = gMax; pauseMin = pMin; pauseMax = pMax; this.count = count; this.groups = groups; this.partial = partial;
        }
    }
    private static final Pattern T3 = new Pattern("T3", "smoke", 0.25, 0.9, 0.25, 0.9, 1.0, 3.0, 3, 2, 3);
    private static final Pattern T4 = new Pattern("T4", "co", 0.04, 0.3, 0.04, 0.35, 2.5, 8.0, 4, 2, 2);

    // ---- band analysis -------------------------------------------------------------------
    private static final double BAND_LO = 2600, BAND_HI = 4000, BAND_STEP = 40;

    private static double goertzel(short[] s, int n, double sampleRate, double freq) {
        double k = 2 * Math.cos(2 * Math.PI * freq / sampleRate), s0, s1 = 0, s2 = 0;
        for (int i = 0; i < n; i++) { s0 = s[i] / 32768.0 + k * s1 - s2; s2 = s1; s1 = s0; }
        return (s1 * s1 + s2 * s2 - k * s1 * s2) / n;
    }
    /** Returns {ratio, power} for one window of 16-bit PCM. */
    public static double[] analyse(short[] s, int n, double sampleRate) {
        double total = 0;
        for (int i = 0; i < n; i++) { double v = s[i] / 32768.0; total += v * v; }
        total /= n;
        if (total <= 0) return new double[] {0, 0};
        double band = 0;
        for (double f = BAND_LO; f <= BAND_HI; f += BAND_STEP) band = Math.max(band, goertzel(s, n, sampleRate, f));
        double ratio = Math.min(1, (band * 2) / (total * n) * 4);
        return new double[] {ratio, total};
    }

    // ---- tone gate -----------------------------------------------------------------------
    private final double onRatio = 0.35, offRatio = 0.2, floor = 0.002, hold = 0.03;
    private boolean gateOn = false; private double lastOn = -1;
    private boolean gate(double time, double ratio, double power) {
        boolean loud = power >= floor;
        if (!gateOn && loud && ratio >= onRatio) { gateOn = true; lastOn = time; }
        else if (gateOn) { if (loud && ratio >= offRatio) lastOn = time; else if (time - lastOn > hold) gateOn = false; }
        return gateOn;
    }

    // ---- pattern detector -----------------------------------------------------------------
    private final List<Beep> beeps = new ArrayList<>();
    private boolean on = false; private double onset = 0, lastTime = 0, cooldownUntil = 0;
    private static final double MIN_BEEP = 0.03, MAX_GAP = 10;
    public int beepCount() { return beeps.size(); }
    public boolean toneOn() { return gateOn; }

    public void reset() { beeps.clear(); on = false; gateOn = false; lastOn = -1; onset = 0; lastTime = 0; cooldownUntil = 0; }

    /** Feed one analysed window. Returns a Result when a pattern is confirmed, else null. */
    public Result push(double time, double ratio, double power) {
        boolean isOn = gate(time, ratio, power);
        Beep last = beeps.isEmpty() ? null : beeps.get(beeps.size() - 1);
        if ((lastTime != 0 && time - lastTime > MAX_GAP) || (last != null && !on && time - last.end > MAX_GAP)) beeps.clear();
        lastTime = time;
        if (isOn && !on) { on = true; onset = time; return null; }
        if (!isOn && on) {
            on = false;
            if (time - onset >= MIN_BEEP) {
                beeps.add(new Beep(onset, time));
                if (beeps.size() > 24) beeps.remove(0);
                return evaluate(time);
            }
        }
        return null;
    }
    private Result evaluate(double time) {
        if (time < cooldownUntil) return null;
        Pattern p = match(T4) ? T4 : match(T3) ? T3 : null;
        if (p == null) return null;
        beeps.clear(); cooldownUntil = time + 20;
        return new Result(p.name, p.kind, time);
    }
    private static boolean within(double v, double lo, double hi) { return v >= lo && v <= hi; }
    private boolean match(Pattern p) {
        if (beeps.size() < p.count * (p.groups - 1) + p.partial) return false;
        int i = beeps.size() - 1, groupsSeen = 0;
        while (i >= 0) {
            int n = 1;
            Beep b = beeps.get(i);
            if (!within(b.end - b.start, p.beepMin, p.beepMax)) return false;
            while (n < p.count && i - n >= 0) {
                double gap = beeps.get(i - n + 1).start - beeps.get(i - n).end;
                if (!within(gap, p.gapMin, p.gapMax)) break;
                Beep prev = beeps.get(i - n);
                if (!within(prev.end - prev.start, p.beepMin, p.beepMax)) return false;
                n++;
            }
            boolean complete = n == p.count, lastGroup = groupsSeen == 0;
            if (!(complete || (lastGroup && n >= p.partial))) return false;
            groupsSeen++;
            if (groupsSeen >= p.groups) return true;
            i -= n;
            if (i < 0) return false;
            double pause = beeps.get(i + 1).start - beeps.get(i).end;
            if (!within(pause, p.pauseMin, p.pauseMax)) return false;
        }
        return false;
    }
}
