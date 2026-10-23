package app.firecam.alert;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationCompat;

/**
 * After a reboot Android 14+ does not let an app start a microphone foreground service from the
 * background, so instead of silently failing we remind the user to tap once to resume listening.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context ctx, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        if (!ctx.getSharedPreferences(ListenService.PREFS, 0).getBoolean("listening", false)) return;
        ListenService.createChannels(ctx);
        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(ctx, 4, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, ListenService.CHANNEL_ALARMS)
            .setSmallIcon(R.drawable.ic_stat_firecam)
            .setContentTitle("FireCam stopped listening")
            .setContentText("The phone restarted. Tap to open FireCam and start listening again.")
            .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(pi).setSilent(true);
        ctx.getSystemService(android.app.NotificationManager.class).notify(43, b.build());
    }
}
