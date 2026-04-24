# Como corrigir o app não aparecer no drawer de aplicativos do Android

Se o DARK IPTV é instalado mas **não aparece junto aos outros apps** (fica escondido e só acessível via gerenciador de arquivos), o problema está no `AndroidManifest.xml` da pasta nativa Android.

## Causa

O `AndroidManifest.xml` da `MainActivity` está sem a `category android.intent.category.LAUNCHER`, que é o que diz ao Android: "este app deve aparecer no menu de apps do usuário".

## Solução — passo a passo

### 1. Abra o arquivo
Após exportar o projeto para o GitHub e clonar localmente, edite:

```
android/app/src/main/AndroidManifest.xml
```

### 2. Garanta que a `MainActivity` tenha esta configuração EXATA:

```xml
<activity
    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation"
    android:name=".MainActivity"
    android:label="@string/title_activity_main"
    android:theme="@style/AppTheme.NoActionBarLaunch"
    android:launchMode="singleTask"
    android:exported="true">

    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
        <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
    </intent-filter>
</activity>
```

### Pontos críticos:

- ✅ `android:exported="true"` — **obrigatório** no Android 12+
- ✅ `<action android:name="android.intent.action.MAIN" />` — marca como ponto de entrada
- ✅ `<category android:name="android.intent.category.LAUNCHER" />` — faz o app aparecer no drawer de apps do **celular**
- ✅ `<category android:name="android.intent.category.LEANBACK_LAUNCHER" />` — faz o app aparecer no menu da **Smart TV / Android TV / TV Box**

### 3. Garanta que o `<application>` tenha um ícone:

```xml
<application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:label="@string/app_name"
    android:theme="@style/AppTheme"
    android:banner="@drawable/banner"
    ...>
```

> O atributo `android:banner` é necessário para o app aparecer corretamente em **Android TV**.

### 4. Verifique o `strings.xml`

Em `android/app/src/main/res/values/strings.xml`:

```xml
<resources>
    <string name="app_name">DARK IPTV</string>
    <string name="title_activity_main">DARK IPTV</string>
    <string name="package_name">app.lovable.darkiptv</string>
    <string name="custom_url_scheme">app.lovable.darkiptv</string>
</resources>
```

### 5. Reconstrua o APK

```bash
npm run build
npx cap sync android
cd android
./gradlew clean
./gradlew assembleRelease
```

O APK gerado estará em: `android/app/build/outputs/apk/release/`

### 6. Desinstale a versão antiga ANTES de instalar a nova

Como o app antigo ficou "fantasma", desinstale via:
- Configurações → Apps → DARK IPTV → Desinstalar
- Ou via ADB: `adb uninstall app.lovable.darkiptv`

Depois instale o novo APK e ele aparecerá normalmente no drawer de apps.

---

## Por que isso aconteceu?

O Capacitor por padrão gera o `AndroidManifest.xml` correto, mas se você usou versões antigas do `@capacitor/android`, ou se algum plugin sobrescreveu o manifest, a categoria `LAUNCHER` pode ter sido removida. Sempre use as versões mais recentes:

```bash
npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest
npx cap sync
```
