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
    // AGP tetap di 8.x: AGP 9.x mematahkan beberapa plugin Flutter.
    // Konsekuensinya Gradle wrapper WAJIB < 9.6 (Gradle 9.6 menghapus
    // InternalProblems yang masih dipakai AGP 8.x) — lihat README.
    id("com.android.application") version "8.13.1" apply false
    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
    // Firebase Cloud Messaging (push notifikasi ke notif bar HP).
    id("com.google.gms.google-services") version "4.4.4" apply false
}

include(":app")
