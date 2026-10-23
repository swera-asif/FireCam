package app.firecam.alert;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that keeps the microphone open and runs the alarm detector while the app is
 * in the background or the screen is off. Shows the persistent "FireCam is listening" notification.
 * When a pattern is heard it records a pending alarm, tells the web layer if it is alive, and shows
 * a full-screen, alarm-volume notification so the phone rings even when FireCam is closed.
 */
public class ListenService extends Service {
    public static final String ACTION_START = "app.firecam.alert.START";
    public static final String ACTION_STOP = "app.firecam.alert.STOP";
    public static final String CHANNEL_LISTENING = "listening";
    public static final String CHANNEL_ALARMS = "alarms";
    public static final int NOTIFICATION_ID = 41;
    public static final int ALARM_NOTIFICATION_ID = 42;
    public static final String PREFS = "firecam";
    private static final String TAG = "FireCamListen";
    private static final int SAMPLE_RATE = 16000, WINDOW = 512;

    public interface Callback { void onAlarm(String kind, String pattern, long when); void onLevel(double level, boolean tone, int beeps); void onStatus(boolean listening); }
    private static volatile Callback callback;
    private static volatile boolean running;
    public static void setCallback(Callback cb) { callback = cb; }
    public static boolean isRunning() { return running; }

    private Thread worker;
    private PowerManager.WakeLock wakeLock;

    public static void createChannels(Context ctx) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        NotificationChannel listening = new NotificationChannel(CHANNEL_LISTENING, "Listening for alarms", NotificationManager.IMPORTANCE_LOW);
        listening.setDescription("Shown while FireCam is listening for smoke-alarm beeps.");
        listening.setShowBadge(false);
        nm.createNotificationChannel(listening);
        NotificationChannel alarms = new NotificationChannel(CHANNEL_ALARMS, "Fire alerts", NotificationManager.IMPORTANCE_HIGH);
        alarms.setDescription("Possible fire or carbon monoxide. Rings at alarm volume.");
        alarms.setBypassDnd(true);
        alarms.enableVibration(true);
        alarms.setVibrationPattern(new long[] {0, 600, 250, 600, 250, 900});
        alarms.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        alarms.setSound(sound, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        nm.createNotificationChannel(alarms);
    }

    public static void start(Context ctx) {
        Intent i = new Intent(ctx, ListenService.class).setAction(ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i); else ctx.startService(i);
    }
    public static void stop(Context ctx) { ctx.startService(new Intent(ctx, ListenService.class).setAction(ACTION_STOP)); }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) { stopListening(); stopSelf(); return START_NOT_STICKY; }
        createChannels(this);
        Notification n = buildListeningNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        else startForeground(NOTIFICATION_ID, n);
        startListening();
        return START_STICKY;
    }

    private Notification buildListeningNotification() {
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(this, ListenService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 2, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_LISTENING)
            .setSmallIcon(R.drawable.ic_stat_firecam)
            .setContentTitle("FireCam is listening for alarms")
            .setContentText("Keep the phone in the room, plugged in. Tap to open.")
            .setOngoing(true).setSilent(true).setContentIntent(pi)
            .addAction(0, "Stop listening", stopPi)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    private synchronized void startListening() {
        if (worker != null) return;
        PowerManager pm = getSystemService(PowerManager.class);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FireCam:listen");
        wakeLock.acquire();
        running = true;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("listening", true).apply();
        worker = new Thread(this::loop, "firecam-listen");
        worker.start();
        if (callback != null) callback.onStatus(true);
    }
    private synchronized void stopListening() {
        running = false;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("listening", false).apply();
        if (worker != null) { worker.interrupt(); worker = null; }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        if (callback != null) callback.onStatus(false);
    }

    private void loop() {
        int min = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        AudioRecord rec;
        try {
            rec = new AudioRecord(MediaRecorder.AudioSource.UNPROCESSED, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, WINDOW * 8));
            if (rec.getState() != AudioRecord.STATE_INITIALIZED) { rec.release(); rec = new AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, WINDOW * 8)); }
        } catch (SecurityException | IllegalArgumentException e) { Log.w(TAG, "microphone unavailable", e); stopListening(); stopSelf(); return; }
        if (rec.getState() != AudioRecord.STATE_INITIALIZED) { Log.w(TAG, "AudioRecord failed to initialise"); rec.release(); stopListening(); stopSelf(); return; }
        AlarmDetector detector = new AlarmDetector();
        short[] buf = new short[WINDOW];
        long startNs = System.nanoTime(), lastLevelMs = 0;
        try {
            rec.startRecording();
            while (running && !Thread.currentThread().isInterrupted()) {
                int read = rec.read(buf, 0, WINDOW);
                if (read <= 0) { SystemClock.sleep(20); continue; }
                double time = (System.nanoTime() - startNs) / 1e9;
                double[] a = AlarmDetector.analyse(buf, read, SAMPLE_RATE);
                AlarmDetector.Result r = detector.push(time, a[0], a[1]);
                long now = SystemClock.elapsedRealtime();
                if (callback != null && now - lastLevelMs > 200) { lastLevelMs = now; callback.onLevel(Math.min(1, Math.sqrt(a[1]) * 6), detector.toneOn(), detector.beepCount()); }
                if (r != null) onAlarm(r);
            }
        } finally {
            try { rec.stop(); } catch (Exception ignored) {}
            rec.release();
        }
    }

    private void onAlarm(AlarmDetector.Result r) {
        long when = System.currentTimeMillis();
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        p.edit().putString("pendingKind", r.kind).putString("pendingPattern", r.pattern).putLong("pendingWhen", when).apply();
        boolean delivered = false;
        if (callback != null && MainActivity.isInForeground()) { try { callback.onAlarm(r.kind, r.pattern, when); delivered = true; } catch (Exception e) { Log.w(TAG, "callback failed", e); } }
        if (!delivered) {
            if (callback != null) { try { callback.onAlarm(r.kind, r.pattern, when); } catch (Exception ignored) {} }
            showAlarmNotification(r.kind, p.getString("room", ""));
        }
    }

    /** Full-screen, alarm-volume notification. Also used by the push path when the app is closed. */
    public static void showAlarmNotification(Context ctx, String kind, String room) {
        createChannels(ctx);
        String what = "co".equals(kind) ? "carbon monoxide" : "smoke";
        String title = room == null || room.isEmpty() ? "Possible " + what + " at home" : "Possible " + what + " in " + room;
        Intent open = new Intent(ctx, MainActivity.class).setAction("app.firecam.alert.ALARM").putExtra("kind", kind).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent full = PendingIntent.getActivity(ctx, 3, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ALARMS)
            .setSmallIcon(R.drawable.ic_stat_firecam)
            .setContentTitle(title)
            .setContentText("FireCam heard an alarm beep pattern. Open to respond.")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(true)
            .setContentIntent(full)
            .setFullScreenIntent(full, true)
            .setVibrate(new long[] {0, 600, 250, 600, 250, 900});
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        nm.notify(ALARM_NOTIFICATION_ID, b.build());
    }
    private void showAlarmNotification(String kind, String room) { showAlarmNotification(this, kind, room); }
    public static void cancelAlarmNotification(Context ctx) { ctx.getSystemService(NotificationManager.class).cancel(ALARM_NOTIFICATION_ID); }

    @Override public void onDestroy() { stopListening(); super.onDestroy(); }
}
