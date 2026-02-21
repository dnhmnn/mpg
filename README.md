# 🎯 Responda Hub - React + TypeScript

**Deine hub.html als moderne React-App umgebaut!**

---

## 📦 WAS IST DRIN?

- ✅ Hub-Seite (genau wie hub.html)
- ✅ Glassmorphism-Design (dein CSS!)
- ✅ PocketBase Integration
- ✅ TypeScript für weniger Bugs
- ✅ Netlify-ready

---

## 🚀 SCHNELLSTART

### **1. Node.js installieren (einmalig)**
Gehe zu **nodejs.org** und lade die **LTS Version** runter.

### **2. Projekt aufsetzen (einmalig)**
```bash
cd responda-hub
npm install
```
→ Installiert alle Dependencies (~2 Minuten)

### **3. Entwickeln (lokal testen)**
```bash
npm run dev
```
→ Öffnet automatisch: **http://localhost:5173**
→ Änderungen werden sofort sichtbar! ✨

### **4. Produktiv machen**
```bash
npm run build
```
→ Erstellt `/dist` Ordner mit fertiger Website

---

## 📤 AUF NETLIFY DEPLOYEN

### **Option A: Automatisch (empfohlen!)**

1. **Code auf GitHub pushen:**
```bash
git add .
git commit -m "Initial commit"
git push
```

2. **Netlify mit GitHub verbinden:**
   - Gehe zu netlify.com
   - "New site from Git" klicken
   - Repository auswählen
   - **FERTIG!** ✨

**Danach bei jeder Änderung:**
```bash
git add .
git commit -m "Feature XY"
git push
```
→ Netlify baut & deployed automatisch!

### **Option B: Manuell**
```bash
npm run build
# dist/ Ordner per FTP hochladen
```

---

## 📂 STRUKTUR

```
responda-hub/
├── src/
│   ├── components/       ← Wiederverwendbare UI-Teile
│   │   ├── StatusBar.tsx
│   │   ├── Widgets.tsx
│   │   ├── AppGrid.tsx
│   │   └── AppIcon.tsx
│   ├── pages/
│   │   └── Hub.tsx       ← Haupt-Hub-Seite
│   ├── hooks/
│   │   └── useAuth.ts    ← PocketBase Auth
│   ├── lib/
│   │   └── pocketbase.ts ← PocketBase Instance
│   ├── styles/
│   │   └── globals.css   ← Dein Glassmorphism CSS!
│   ├── types/
│   │   └── index.ts      ← TypeScript Typen
│   ├── App.tsx
│   └── main.tsx
├── dist/                 ← Build Output (das lädst du hoch!)
├── package.json
├── vite.config.ts
├── netlify.toml          ← Netlify Config
└── README.md
```

---

## 🔧 BEFEHLE

| Befehl | Was passiert |
|--------|--------------|
| `npm install` | Dependencies installieren |
| `npm run dev` | Entwicklungsserver starten |
| `npm run build` | Produktiv-Version erstellen |
| `npm run preview` | Build-Version lokal testen |

---

## ✨ WAS IST NEU?

### **Vorher (hub.html):**
- ❌ Eine große HTML-Datei
- ❌ JavaScript vermischt mit HTML
- ❌ Schwer zu warten

### **Jetzt (React):**
- ✅ Komponenten-basiert
- ✅ Wiederverwendbar
- ✅ TypeScript = weniger Fehler
- ✅ Einfach zu erweitern

---

## 🎨 DESIGN

Dein komplettes Glassmorphism-Design ist in `src/styles/globals.css` - **bleibt 1:1 gleich!**

---

## 🔗 WICHTIGE URLS

- **Lokal:** http://localhost:5173
- **PocketBase API:** https://api.responda.systems
- **Produktion:** (deine Netlify-URL)

---

## ❓ PROBLEME?

### **Port schon belegt?**
```bash
# Ändere Port in vite.config.ts:
server: { port: 3000 }
```

### **Build-Fehler?**
```bash
rm -rf node_modules
npm install
npm run build
```

### **TypeScript-Fehler?**
→ Schau in die Fehlermeldung, meist selbsterklärend!

---

## 📝 NÄCHSTE SCHRITTE

1. ✅ Hub läuft in React
2. ⏳ Weitere Pages migrieren (Patientendoku, Lager, etc.)
3. ⏳ Settings Modal hinzufügen
4. ⏳ Notifications System

---

## 🎉 FERTIG!

Deine hub.html ist jetzt eine **moderne React-App**!

**Bei Fragen:** Frag mich einfach! 😊
