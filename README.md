# GitHub Commits Analyzer

Eine Node.js Applikation, die regelmäßig Commits von GitHub-Organisationen analysiert und auf einer Webseite anzeigt.

## 📋 Features

- 📊 Analysiert Commits in konfigurierbaren Zeitfenstern
- 🔄 Periodische Aktualisierung (konfigurierbar per cron-Expression)
- 📈 Statistiken pro Repository (Anzahl Commits, geänderte Zeilen, etc.)
- 🌐 Live Webseite mit Auto-Refresh
- 🔐 Sichere GitHub API Token-Verwaltung
- 🔀 Automatische Filterung von Merge-Commits (nur tatsächliche Entwicklungsarbeit wird gezählt)

## 🚀 Installation & Setup

### Voraussetzungen

- Node.js 16+ 
- Ein GitHub Personal Access Token (mit `repo` + `read:org` Permissions)

### Schritt 1: Repository klonen/Verzeichnis erstellen

```bash
cd /home/reinhold/HTL/gitCommitsDuringLesson
```

### Schritt 2: Abhängigkeiten installieren

```bash
cd backend
npm install
```

### Schritt 3: GitHub Token konfigurieren

1. GitHub Token erstellen:
   - Gehe zu https://github.com/settings/tokens/new
   - Wähle mindestens diese Scopes: `repo`, `read:org`
   - Token kopieren

2. Token in `backend/config.jsonc` eintragen:

```json
{
  "github": {
    "token": "ghp_DEIN_TOKEN_HIER"
  },
  ...
}
```

### Schritt 4: Organisationen konfigurieren

Die `config.jsonc` hat folgende Struktur:

```json
{
  "github": {
    "token": "ghp_..."
  },
  "organizations": [
    {
      "name": "facebook",
      "timeWindows": [
        {
          "day": "monday",
          "startTime": "10:00",
          "endTime": "12:00"
        }
      ]
    },
    {
      "name": "google",
      "timeWindows": [
        {
          "day": "friday",
          "startTime": "14:00",
          "endTime": "16:00"
        }
      ]
    }
  ],
  "checkInterval": "*/5 * * * *"
}
```

**Erklärung:**
- `day`: Wochentag (monday, tuesday, wednesday, thursday, friday, saturday, sunday)
- `startTime` / `endTime`: Zeitfenster HH:MM
- `checkInterval`: Cron-Expression für Analyse-Häufigkeit (z.B. `*/1 * * * *` = jede Minute)

### Schritt 5: Server starten

```bash
npm start
```

Oder mit Watch-Modus (automatischer Neustart bei Änderungen):

```bash
npm run dev
```

**Output sollte etwa so aussehen:**
```
🌐 Server running on http://localhost:3000
📡 API available at http://localhost:3000/api/stats

🚀 Starting initial analysis...
📊 Analyzing organization: facebook
📅 Since: 2024-02-19T10:00:00.000Z
📅 Until: 2024-02-19T12:00:00.000Z
✅ Found 287 repositories
  📦 react... ✓ 5 commits, 1247 lines changed
  📦 flow... ✓ 2 commits, 543 lines changed
  ...
✨ Analysis complete! 287 repositories analyzed.
```

### Schritt 6: Webseite öffnen

Öffne im Browser: http://localhost:3000

## 📊 API Endpoints

### `GET /api/stats`
Liefert aktuelle Statistiken im JSON-Format:

```json
{
  "organization": "facebook",
  "timeWindow": {
    "day": "monday",
    "startTime": "10:00",
    "endTime": "12:00"
  },
  "lastUpdate": "2024-02-19T14:32:10.123Z",
  "repositories": [
    {
      "name": "react",
      "url": "https://github.com/facebook/react",
      "commitCount": 5,
      "totalLinesChanged": 1247,
      "totalAdditions": 890,
      "totalDeletions": 357,
      "avgLinesPerCommit": 249
    },
    ...
  ]
}
```

### `GET /api/config`
Liefert die konfigurierte Liste von Organisationen.

## 🗂️ Projektstruktur

```
git-commits-analyzer/
├── backend/
│   ├── index.js              # Express Server & Cron-Scheduler
│   ├── config.jsonc          # Konfiguration
│   ├── package.json          # Dependencies
│   └── services/
│       ├── github.js         # GitHub API Client
│       └── analyzer.js       # Commit-Analyse Logik
└── frontend/
    ├── index.html            # HTML-Template
    ├── app.js                # Vue App Initialisierung
    ├── App.js                # Vue Component
    └── style.css             # Styling
```

## 🔧 Technologie-Stack

- **Backend:** Express.js, Node.js, node-cron, axios
- **Frontend:** Vue.js 3, Vanilla CSS
- **APIs:** GitHub REST API v3

## ⚙️ Konfiguration

### Cron-Expression für `checkInterval`

- `*/1 * * * *` = Jede Minute
- `*/5 * * * *` = Alle 5 Minuten
- `0 * * * *` = Jede Stunde (zur Minute 0)
- `0 9 * * MON` = Jeden Montag um 9:00 Uhr
- Mehr: https://crontab.guru/

### GitHub API Rate Limits

- Mit Token: 5.000 requests/Stunde
- Ohne Token: 60 requests/Stunde

Die Anwendung macht pro Analyse:
- 1 Request für Repository-Liste pro Org
- 1 Request pro Repository für Commits
- 1 Request pro Commit für detaillierte Infos (stats/additions/deletions)

## 🐛 Troubleshooting

**Error: "Unauthorized"**
→ GitHub Token überprüfen oder refresh

**Error: "Organization not found"**
→ Organisationsnamen in `config.jsonc` überprüfen

**Keine Commits angezeigt**
→ Überprüfe den Zeitfenster (oft sind keine Commits im konfigurierten Fenster)
→ Nutze `npm run dev` und prüfe Console-Output

**Frontend zeigt nicht auf Backend zu**
→ Stelle sicher, dass der Backend-Server läuft (http://localhost:3000)

## 📝 Nächste Schritte / Erweiterungen

- [ ] Historische Statistiken speichern (SQLite/PostgreSQL)
- [ ] Trends/Graphen darstellen
- [ ] Statistiken nach Entwickler filtern
- [ ] E-Mail Benachrichtigungen
- [ ] Deployment zu Azure/Heroku
- [ ] Docker-Container
- [ ] Mehrere Zeitfenster pro Organisation

## 📄 Lizenz

MIT

---

**Fragen?** Schau in die Konsole-Ausgabe für Debug-Informationen!
