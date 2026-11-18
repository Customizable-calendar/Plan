package expo.modules.sttnative

import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * 받아쓰기(B) 네이티브 도우미 (Android).
 * - startKeepAlive / updateKeepAlive / stopKeepAlive: 녹음하는 동안 포그라운드 서비스(SttRecordingService)
 * - decodeToWav: 음성·동영상 파일(m4a, mp3, aac, ogg, mp4 등)을 16kHz 모노 16비트 WAV로 바꿔요(OS 디코더)
 */
class SttNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("SttNative")

    Function("startKeepAlive") { title: String, text: String ->
      val intent = Intent(context, SttRecordingService::class.java)
        .putExtra(SttRecordingService.EXTRA_TITLE, title)
        .putExtra(SttRecordingService.EXTRA_TEXT, text)
      ContextCompat.startForegroundService(context, intent)
    }

    Function("updateKeepAlive") { title: String, text: String ->
      SttRecordingService.update(context, title, text)
    }

    Function("stopKeepAlive") {
      context.stopService(Intent(context, SttRecordingService::class.java))
    }

    // 오래 걸려서 백그라운드에서 돌아요. 돌려주는 값은 소리 길이(ms)예요.
    AsyncFunction("decodeToWav") { input: String, output: String ->
      decode(context, input, output)
    }
  }
}

private class DecodeException(message: String, cause: Throwable? = null) :
  CodedException("ERR_STT_DECODE", message, cause)

private const val TARGET_RATE = 16_000
private const val WAV_HEADER_BYTES = 44

private fun decode(context: Context, input: String, output: String): Double {
  val extractor = MediaExtractor()
  try {
    val uri = Uri.parse(input)
    if (uri.scheme == "content" || uri.scheme == "file") {
      extractor.setDataSource(context, uri, null)
    } else {
      extractor.setDataSource(input)
    }
    val track = (0 until extractor.trackCount).firstOrNull {
      extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
    } ?: throw DecodeException("소리가 든 파일이 아니에요.")
    extractor.selectTrack(track)
    val format = extractor.getTrackFormat(track)
    val mime = format.getString(MediaFormat.KEY_MIME)!!
    val codec = try {
      MediaCodec.createDecoderByType(mime)
    } catch (e: Exception) {
      throw DecodeException("이 기기에서 못 여는 소리 형식이에요($mime).", e)
    }
    val outFile = File(Uri.parse(output).path ?: output)
    outFile.parentFile?.mkdirs()
    val writer = WavWriter(outFile)
    try {
      codec.configure(format, null, null, 0)
      codec.start()
      var rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      var floatPcm = false
      var resampler = Resampler(rate, writer)
      val info = MediaCodec.BufferInfo()
      var inputDone = false
      var outputDone = false
      while (!outputDone) {
        if (!inputDone) {
          val index = codec.dequeueInputBuffer(10_000)
          if (index >= 0) {
            val buffer = codec.getInputBuffer(index)!!
            val size = extractor.readSampleData(buffer, 0)
            if (size < 0) {
              codec.queueInputBuffer(index, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              codec.queueInputBuffer(index, 0, size, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }
        val out = codec.dequeueOutputBuffer(info, 10_000)
        when {
          out == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            val f = codec.outputFormat
            rate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            channels = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            floatPcm = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N &&
              f.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
              f.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT
            resampler = Resampler(rate, writer, resampler)
          }
          out >= 0 -> {
            val buffer = codec.getOutputBuffer(out)!!
            buffer.position(info.offset)
            buffer.limit(info.offset + info.size)
            val pcm = buffer.slice().order(ByteOrder.LITTLE_ENDIAN)
            pushMono(pcm, channels, floatPcm, resampler)
            codec.releaseOutputBuffer(out, false)
            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true
          }
        }
      }
      codec.stop()
      writer.finish()
      return writer.samples * 1000.0 / TARGET_RATE
    } catch (e: Exception) {
      writer.discard()
      if (e is DecodeException) throw e
      throw DecodeException("소리 파일을 바꾸지 못했어요.", e)
    } finally {
      codec.release()
    }
  } finally {
    extractor.release()
  }
}

/** 여러 채널을 평균 내서 한 채널로 만들어 넘겨요. */
private fun pushMono(pcm: ByteBuffer, channels: Int, floatPcm: Boolean, resampler: Resampler) {
  val ch = channels.coerceAtLeast(1)
  if (floatPcm) {
    val floats = pcm.asFloatBuffer()
    while (floats.remaining() >= ch) {
      var sum = 0f
      repeat(ch) { sum += floats.get() }
      resampler.push(sum / ch)
    }
  } else {
    val shorts = pcm.asShortBuffer()
    while (shorts.remaining() >= ch) {
      var sum = 0f
      repeat(ch) { sum += shorts.get() / 32768f }
      resampler.push(sum / ch)
    }
  }
}

/**
 * 16kHz로 바꿔요(선형 보간). 원래 소리가 더 촘촘하면 먼저 이웃 샘플을 평균 내서 높은 소리를 줄여요.
 * 출력 형식이 중간에 바뀌면(prev) 시간을 이어 가요.
 */
private class Resampler(rate: Int, private val writer: WavWriter, prev: Resampler? = null) {
  private val step = rate.toDouble() / TARGET_RATE
  private val smooth = step.toInt().coerceIn(1, 8)
  private val window = FloatArray(smooth)
  private var filled = 0
  private var sum = 0f
  private var n = 0L
  private var t = 0.0
  private var last = prev?.last ?: 0f

  fun push(sample: Float) {
    // 이웃 smooth개 평균(간단한 저역 통과)
    sum += sample - window[(n % smooth).toInt()]
    window[(n % smooth).toInt()] = sample
    if (filled < smooth) filled++
    val s = sum / filled
    while (t <= n) {
      val frac = (t - (n - 1)).toFloat()
      writer.write(if (n == 0L) s else last + (s - last) * frac)
      t += step
    }
    last = s
    n++
  }
}

/** WAV(16kHz 모노 16비트)로 이어 써요. 다 쓰면 머리에 길이를 적어요. */
private class WavWriter(private val file: File) {
  private val out = BufferedOutputStream(FileOutputStream(file), 64 * 1024)
  private val bytes = ByteArray(2)
  var samples = 0L
    private set

  init {
    out.write(ByteArray(WAV_HEADER_BYTES))
  }

  fun write(value: Float) {
    val v = (value.coerceIn(-1f, 1f) * 32767f).toInt()
    bytes[0] = (v and 0xff).toByte()
    bytes[1] = ((v shr 8) and 0xff).toByte()
    out.write(bytes)
    samples++
  }

  fun finish() {
    out.flush()
    out.close()
    val data = samples * 2
    val header = ByteBuffer.allocate(WAV_HEADER_BYTES).order(ByteOrder.LITTLE_ENDIAN)
    header.put("RIFF".toByteArray()).putInt((36 + data).toInt()).put("WAVE".toByteArray())
    header.put("fmt ".toByteArray()).putInt(16).putShort(1).putShort(1)
    header.putInt(TARGET_RATE).putInt(TARGET_RATE * 2).putShort(2).putShort(16)
    header.put("data".toByteArray()).putInt(data.toInt())
    RandomAccessFile(file, "rw").use {
      it.seek(0)
      it.write(header.array())
    }
  }

  fun discard() {
    try {
      out.close()
    } catch (_: Exception) {
    }
    file.delete()
  }
}
