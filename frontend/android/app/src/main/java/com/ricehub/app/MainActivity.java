package com.ricehub.app;

import android.Manifest;
import android.app.Activity;
import android.media.AudioManager;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ValueCallback;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.app.NotificationChannel;
import android.app.NotificationManager;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

import java.io.File;
import java.io.IOException;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "RiceHubMainActivity";
    private Ringtone activeRingtone;
    private ActivityResultLauncher<String> cameraPermissionLauncher;
    private ActivityResultLauncher<Intent> legacyVideoCaptureLauncher;
    private ValueCallback<Uri[]> pendingVideoCallback;
    private Uri pendingVideoUri;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VoiceCallAudioPlugin.class);
        registerPlugin(AndroidAudioPlugin.class);
        registerPlugin(GallerySaverPlugin.class);
        super.onCreate(savedInstanceState);
        registerLegacyVideoCaptureLaunchers();
        installFileChooser();
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

    private void registerLegacyVideoCaptureLaunchers() {
        cameraPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> {
                if (pendingVideoCallback == null) return;
                if (granted) {
                    launchLegacyVideoCapture();
                } else {
                    completeLegacyVideoCapture(null);
                }
            }
        );
        legacyVideoCaptureLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                Uri resultUri = null;
                if (result.getResultCode() == Activity.RESULT_OK) {
                    Intent data = result.getData();
                    resultUri = data != null ? data.getData() : pendingVideoUri;
                }
                completeLegacyVideoCapture(resultUri);
            }
        );
    }

    private void installFileChooser() {
        bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
            ) {
                boolean videoCapture = Build.VERSION.SDK_INT < Build.VERSION_CODES.N
                    && fileChooserParams.isCaptureEnabled()
                    && acceptsVideo(fileChooserParams.getAcceptTypes());
                if (!videoCapture) {
                    return super.onShowFileChooser(
                        webView,
                        filePathCallback,
                        fileChooserParams
                    );
                }

                if (pendingVideoCallback != null) {
                    pendingVideoCallback.onReceiveValue(null);
                }
                pendingVideoCallback = filePathCallback;
                if (ContextCompat.checkSelfPermission(
                    MainActivity.this,
                    Manifest.permission.CAMERA
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    launchLegacyVideoCapture();
                } else {
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
                }
                return true;
            }
        });
    }

    private static boolean acceptsVideo(String[] acceptTypes) {
        for (String acceptType : acceptTypes) {
            if ("video/*".equalsIgnoreCase(acceptType)) return true;
        }
        return false;
    }

    private void launchLegacyVideoCapture() {
        Intent intent = new Intent(android.provider.MediaStore.ACTION_VIDEO_CAPTURE);
        if (intent.resolveActivity(getPackageManager()) == null) {
            Log.w(TAG, "No video capture activity is available.");
            completeLegacyVideoCapture(null);
            return;
        }

        try {
            File directory = getExternalFilesDir(Environment.DIRECTORY_MOVIES);
            if (directory == null) directory = getCacheDir();
            File videoFile = File.createTempFile("ricehub-video-", ".mp4", directory);
            pendingVideoUri = FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                videoFile
            );
            intent.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, pendingVideoUri);
            intent.setClipData(ClipData.newRawUri("Captured video", pendingVideoUri));
            intent.addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );
            legacyVideoCaptureLauncher.launch(intent);
        } catch (IOException error) {
            Log.e(TAG, "Could not prepare video capture.", error);
            completeLegacyVideoCapture(null);
        }
    }

    private void completeLegacyVideoCapture(Uri resultUri) {
        ValueCallback<Uri[]> callback = pendingVideoCallback;
        pendingVideoCallback = null;
        pendingVideoUri = null;
        if (callback != null) {
            callback.onReceiveValue(resultUri == null ? null : new Uri[] { resultUri });
        }
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
