package app.firecam.alert;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** JavaScript bridge to the foreground listening service and the alarm notification channel. */
@CapacitorPlugin(name = "AlarmListener", permissions = {
    @Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO}),
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class AlarmListenerPlugin extends Plugin {
    @Override public void load() {
        ListenService.createChannels(getContext());
        ListenService.setCallback(new ListenService.Callback() {
            @Override public void onAlarm(String kind, String pattern, long when) {
                JSObject d = new JSObject(); d.put("kind", kind); d.put("pattern", pattern); d.put("time", when);
                notifyListeners("alarm", d, true);
            }
            @Override public void onLevel(double level, boolean tone, int beeps) {
                JSObject d = new JSObject(); d.put("level", level); d.put("tone", tone); d.put("beeps", beeps);
                notifyListeners("level", d);
            }
            @Override public void onStatus(boolean listening) {
                JSObject d = new JSObject(); d.put("listening", listening);
                notifyListeners("status", d, true);
            }
        });
    }

    @PluginMethod public void start(PluginCall call) {
        if (call.getString("room") != null) prefs().edit().putString("room", call.getString("room")).apply();
        if (getPermissionState("microphone") != PermissionState.GRANTED) { requestPermissionForAlias("microphone", call, "microphoneResult"); return; }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) { requestPermissionForAlias("notifications", call, "notificationsResult"); return; }
        begin(call);
    }
    @PermissionCallback private void microphoneResult(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) { call.reject("Microphone permission is needed to listen for alarms."); return; }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) { requestPermissionForAlias("notifications", call, "notificationsResult"); return; }
        begin(call);
    }
    @PermissionCallback private void notificationsResult(PluginCall call) { begin(call); }
    private void begin(PluginCall call) {
        ListenService.start(getContext());
        JSObject r = new JSObject(); r.put("listening", true); call.resolve(r);
    }

    @PluginMethod public void stop(PluginCall call) {
        ListenService.stop(getContext());
        JSObject r = new JSObject(); r.put("listening", false); call.resolve(r);
    }

    @PluginMethod public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("listening", ListenService.isRunning());
        r.put("microphone", getPermissionState("microphone") == PermissionState.GRANTED);
        r.put("notifications", Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED);
        NotificationManager nm = getContext().getSystemService(NotificationManager.class);
        r.put("fullScreen", Build.VERSION.SDK_INT < 34 || nm.canUseFullScreenIntent());
        r.put("dnd", nm.isNotificationPolicyAccessGranted());
        call.resolve(r);
    }

    /** Returns and clears an alarm detected while the web layer was not alive. */
    @PluginMethod public void getPendingAlarm(PluginCall call) {
        SharedPreferences p = prefs();
        JSObject r = new JSObject();
        String kind = p.getString("pendingKind", null);
        if (kind != null) {
            r.put("kind", kind); r.put("pattern", p.getString("pendingPattern", "")); r.put("time", p.getLong("pendingWhen", 0));
            p.edit().remove("pendingKind").remove("pendingPattern").remove("pendingWhen").apply();
        }
        call.resolve(r);
    }

    @PluginMethod public void clearAlarmNotification(PluginCall call) { ListenService.cancelAlarmNotification(getContext()); call.resolve(); }

    @PluginMethod public void openFullScreenSettings(PluginCall call) {
        Intent i = Build.VERSION.SDK_INT >= 34
            ? new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getContext().getPackageName()))
            : new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i); call.resolve();
    }
    @PluginMethod public void openDndSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i); call.resolve();
    }
    @PluginMethod public void openNotificationSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i); call.resolve();
    }

    private SharedPreferences prefs() { return getContext().getSharedPreferences(ListenService.PREFS, 0); }
}
