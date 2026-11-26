package com.ricehub.app;

import android.Manifest;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(
    name = "GallerySaver",
    permissions = {
        @Permission(
            alias = "storage",
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }
        )
    }
)
public class GallerySaverPlugin extends Plugin {
    @PluginMethod
    public void saveImage(PluginCall call) {
        String fileName = sanitizeFileName(call.getString("fileName"));
        String data = call.getString("data");
        if (fileName.isEmpty() || data == null || data.isEmpty()) {
            call.reject("A file name and image data are required.");
            return;
        }

        if (
            Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && getPermissionState("storage") != PermissionState.GRANTED
        ) {
            requestPermissionForAlias("storage", call, "saveImagePermissionCallback");
            return;
        }
        writeImage(call, fileName, data);
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void saveImagePermissionCallback(PluginCall call) {
        if (getPermissionState("storage") != PermissionState.GRANTED) {
            call.reject("Storage permission is required to save the QR image.");
            return;
        }
        writeImage(call, sanitizeFileName(call.getString("fileName")), call.getString("data"));
    }

    private void writeImage(PluginCall call, String fileName, String encodedData) {
        Uri imageUri = null;
        try {
            byte[] imageBytes = Base64.decode(encodedData, Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(
                    MediaStore.Images.Media.RELATIVE_PATH,
                    Environment.DIRECTORY_PICTURES
                );
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
                imageUri = getContext().getContentResolver().insert(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    values
                );
                if (imageUri == null) {
                    throw new IllegalStateException("Could not create a gallery image.");
                }
                try (OutputStream output = getContext().getContentResolver()
                    .openOutputStream(imageUri)) {
                    if (output == null) {
                        throw new IllegalStateException("Could not open the gallery image.");
                    }
                    output.write(imageBytes);
                }
                ContentValues published = new ContentValues();
                published.put(MediaStore.Images.Media.IS_PENDING, 0);
                getContext().getContentResolver().update(imageUri, published, null, null);
            } else {
                File pictures = Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_PICTURES
                );
                if (!pictures.exists() && !pictures.mkdirs()) {
                    throw new IllegalStateException("Could not create the Pictures folder.");
                }
                File imageFile = new File(pictures, fileName);
                try (FileOutputStream output = new FileOutputStream(imageFile)) {
                    output.write(imageBytes);
                }
                imageUri = Uri.fromFile(imageFile);
                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[] { imageFile.getAbsolutePath() },
                    new String[] { "image/png" },
                    null
                );
            }

            JSObject result = new JSObject();
            result.put("uri", imageUri.toString());
            call.resolve(result);
        } catch (Exception error) {
            if (imageUri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                getContext().getContentResolver().delete(imageUri, null, null);
            }
            call.reject("The QR image could not be saved to Gallery.", error);
        }
    }

    private String sanitizeFileName(String fileName) {
        if (fileName == null) {
            return "";
        }
        return fileName.replaceAll("[^A-Za-z0-9._-]", "_");
    }
}
