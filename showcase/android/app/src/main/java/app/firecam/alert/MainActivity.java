package app.firecam.alert;

import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static volatile boolean foreground;
    public static boolean isInForeground() { return foreground; }

    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmListenerPlugin.class);
        super.onCreate(savedInstanceState);
        showOverLockScreenIfAlarm(getIntent());
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); showOverLockScreenIfAlarm(intent); }
    @Override public void onResume() { super.onResume(); foreground = true; }
    @Override public void onPause() { foreground = false; super.onPause(); }

    /** When opened by the full-screen alarm notification, appear over the lock screen with the screen on. */
    private void showOverLockScreenIfAlarm(Intent intent) {
        if (intent == null || !"app.firecam.alert.ALARM".equals(intent.getAction())) return;
        if (android.os.Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
