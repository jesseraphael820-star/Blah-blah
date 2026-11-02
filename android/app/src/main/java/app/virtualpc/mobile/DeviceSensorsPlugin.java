package app.virtualpc.mobile;

import android.app.ActivityManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Real device data that web content cannot read on its own:
 * battery temperature, thermal status, total/available RAM; and saving files
 * from the virtual PC into the phone's public Downloads folder.
 */
@CapacitorPlugin(name = "DeviceSensors")
public class DeviceSensorsPlugin extends Plugin {

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();
        Intent battery = ctx.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (battery != null) {
            int t = battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
            if (t != Integer.MIN_VALUE) ret.put("batteryTempC", t / 10.0);
            int level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            if (level >= 0 && scale > 0) ret.put("batteryLevel", level / (double) scale);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm != null) ret.put("thermalStatus", pm.getCurrentThermalStatus());
        }
        ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
        if (am != null) {
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);
            ret.put("totalMem", mi.totalMem);
            ret.put("availMem", mi.availMem);
            ret.put("lowMemory", mi.lowMemory);
        }
        ret.put("cores", Runtime.getRuntime().availableProcessors());
        call.resolve(ret);
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String name = call.getString("name", "arquivo");
        String mime = call.getString("mime", "application/octet-stream");
        String data = call.getString("base64");
        if (data == null) { call.reject("sem dados"); return; }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mime);
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Virtual PC");
                Uri uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) { call.reject("não foi possível criar o arquivo"); return; }
                try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) { os.write(bytes); }
            } else {
                File dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Virtual PC");
                dir.mkdirs();
                try (FileOutputStream os = new FileOutputStream(new File(dir, name))) { os.write(bytes); }
            }
            JSObject ret = new JSObject();
            ret.put("path", "Downloads/Virtual PC/" + name);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
