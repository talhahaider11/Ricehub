package com.ricehub.app;

import android.media.AudioManager;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.app.NotificationChannel;
import android.app.NotificationManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private Ringtone activeRingtone;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VoiceCallAudioPlugin.class);
        registerPlugin(AndroidAudioPlugin.class);
        super.onCreate(savedInstanceState);
        bridge.getWebView().getSettings().setJavaScriptEnabled(true);
        bridge.getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void playDefaultRingtone() {
                runOnUiThread(MainActivity.this::playDefaultRingtone);
            }

            @JavascriptInterface
            public void stopDefaultRingtone() {
                runOnUiThread(MainActivity.this::stopDefaultRingtone);
            }
        }, "RiceHubNativeAudio");
        createSystemDefaultNotificationChannel();
    }

    @Override
    public void onDestroy() {
        stopDefaultRingtone();
        AudioManager audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (audioManager != null) {
            audioManager.setSpeakerphoneOn(false);
            audioManager.setMode(AudioManager.MODE_NORMAL);
        }
        super.onDestroy();
    }

    private synchronized void playDefaultRingtone() {
        stopDefaultRingtone();
        Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (uri == null) return;
        activeRingtone = RingtoneManager.getRingtone(getApplicationContext(), uri);
        if (activeRingtone == null) return;
        activeRingtone.setAudioAttributes(
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        );
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            activeRingtone.setLooping(true);
        }
        activeRingtone.play();
    }

    private synchronized void stopDefaultRingtone() {
        if (activeRingtone != null) {
            if (activeRingtone.isPlaying()) activeRingtone.stop();
            activeRingtone = null;
        }
    }

    private void createSystemDefaultNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel channel = new NotificationChannel(
            "ricehub_system_default_v2",
            "RiceHub notifications",
            NotificationManager.IMPORTANCE_HIGH
        );
        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        channel.setSound(
            soundUri,
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        );
        manager.createNotificationChannel(channel);
    }
}
