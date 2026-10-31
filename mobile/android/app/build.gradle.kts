plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    // com.google.gms.google-services TIDAK dideklarasikan di sini: versinya
    // sudah ditetapkan di android/settings.gradle.kts (4.4.4) dan plugin
    // di-apply kondisional di bawah. Menambahkan version di sini akan
    // membuat build gagal ("plugin request must not include a version").
}

// Firebase Cloud Messaging (push notifikasi ke notif bar HP).
// Diterapkan kondisional: build tetap jalan walau google-services.json
// belum diisi (mis. build CI tanpa kredensial Firebase).
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

android {
    namespace = "com.bumdesma.absensi_bumdesma"
    compileSdk = 36
    // Ikut NDK yang dideklarasikan Flutter SDK (28.2.13676358 untuk Flutter
    // 3.47.7), bukan versi hardcode per mesin — dulu dipaku "30.0.16248370"
    // sebagai workaround lokal sehingga build patah di mesin lain.
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Wajib untuk flutter_local_notifications (push notifikasi).
        isCoreLibraryDesugaringEnabled = true
    }

    defaultConfig {
        applicationId = "com.bumdesma.absensi_bumdesma"
        minSdk = flutter.minSdkVersion
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }
    // ... sisanya tetap sama
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Pasangan isCoreLibraryDesugaringEnabled di atas.
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    // firebase-bom / firebase-analytics TIDAK perlu ditambah manual:
    // plugin FlutterFire (firebase_core, firebase_messaging) sudah membawa
    // native Firebase SDK-nya sendiri dengan versi yang cocok.
}