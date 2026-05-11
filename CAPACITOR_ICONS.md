# Ícones e Splash Nativos (Android / iOS)

A logo oficial está em `resources/icon.png` (1024x1024) e `resources/splash.png` (2732x2732).

Após `git pull` no seu projeto local, gere os ícones nativos rodando uma única vez:

```bash
npm install --save-dev @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor "#0a0612" --splashBackgroundColor "#0a0612"
npx cap sync
```

Isso preenche automaticamente todas as densidades em `android/app/src/main/res/mipmap-*` e `ios/App/App/Assets.xcassets`.
