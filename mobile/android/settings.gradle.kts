pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            file("local.properties").inputStream().use { properties.load(it) }
            val flutterSdkPath = properties.getProperty("flutter.sdk")
            require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
            flutterSdkPath
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    // Flutter 3.50.0 (SDK di mesin Windows ini) mewajibkan AGP >= 9.1.1 dan
    // Gradle >= 9.5.0; AGP 8.13.1 gagal saat apply flutter-gradle-plugin.
    // Versi di bawah = default template `flutter create` Flutter 3.50.0.
    id("com.android.application") version "9.3.1" apply false
    id("org.jetbrains.kotlin.android") version "2.4.20" apply false
    // Firebase Cloud Messaging (push notifikasi ke notif bar HP).
    id("com.google.gms.google-services") version "4.4.4" apply false
}

include(":app")
