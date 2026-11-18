package expo.modules.sttnative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * 받아쓰기(B): 녹음하는 동안 떠 있는 포그라운드 서비스(마이크 종류)예요.
 * 이게 떠 있으면 화면이 꺼지거나 앱을 나가도 Android가 앱과 마이크를 멈추지 않아요.
 * 녹음은 JS 쪽(@fugood/react-native-audio-pcm-stream)이 그대로 하고, 이 서비스는 알림만 띄워요.
 */
class SttRecordingService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "받아쓰는 중"
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: "화면이 꺼져도 녹음을 이어 가요."
    val notification = buildNotification(this, title, text)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    super.onDestroy()
  }

  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"
    private const val CHANNEL_ID = "stt-recording"
    private const val NOTIFICATION_ID = 4107

    fun buildNotification(context: Context, title: String, text: String): Notification {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(CHANNEL_ID, "받아쓰기 녹음", NotificationManager.IMPORTANCE_LOW)
        channel.description = "녹음하고 받아쓰는 동안 보여요."
        manager.createNotificationChannel(channel)
      }
      // 알림을 누르면 앱으로 돌아와요.
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      val pending = launch?.let {
        it.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        PendingIntent.getActivity(
          context,
          0,
          it,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
      }
      val builder =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          Notification.Builder(context, CHANNEL_ID)
        } else {
          @Suppress("DEPRECATION")
          Notification.Builder(context)
        }
      return builder
        .setContentTitle(title)
        .setContentText(text)
        .setSmallIcon(context.applicationInfo.icon)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .apply { if (pending != null) setContentIntent(pending) }
        .build()
    }

    /** 이미 떠 있으면 알림 글만 바꿔요. */
    fun update(context: Context, title: String, text: String) {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.notify(NOTIFICATION_ID, buildNotification(context, title, text))
    }
  }
}
