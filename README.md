# LA ANT MATCH — Classement Ligue 1

Cette version génère automatiquement `index.html` à partir du classement Flashscore.

## Design

- Format 1920×1080 / 16:9.
- Classement 1→8 à droite.
- Classement 9→16 à gauche.
- Tableau de droite : **L_PLAYED | POINTS | ÉQUIPE | LOGO | RANG**.
- Tableau de gauche, miroir du tableau de droite : **RANG | LOGO | ÉQUIPE | POINTS | L_PLAYED**.
- Le logo est placé dans sa propre colonne transparente entre le nom et le rang.
- Les rangs 1–2 sont dorés, le rang 3 gris, les rangs 14–16 rouges.
- Le titre reste `ترتيب`.

## Installation

```bash
pip install -r requirements.txt
python -m playwright install chromium
```

## Génération

```bash
python main.py
```

## Run Code
```bash
python main.py --watch --interval 300
python main.py
```

## Mise à jour depuis l'interface

Pour activer le bouton **UPDATE** et récupérer le classement Flashscore sans
recharger la page, lancez le serveur local :

```bash
python main.py --serve
```

Puis ouvrez `http://127.0.0.1:8000/index.html`. Le bouton **UPDATE** utilise
le scraper Python côté serveur (Flashscore ne peut pas être appelé
directement depuis JavaScript à cause de CORS) et remplace le tableau
immédiatement avec les nouvelles données.

## Google Drive uploads

Le bouton **EDIT** envoie les assets dans les sous-dossiers `assets/`
(`background`, `branding`, `competition`, `cup`, `teams`) du dossier Drive.
Les PNG exportés sont envoyés dans `exports/`. Les métadonnées sont
enregistrées dans la description de chaque fichier Drive. Les assets locaux
restent disponibles comme fallback.

Après sélection d'un fichier, l'image est prévisualisée immédiatement dans
la page. Pour `teams`, le panneau propose chaque ligne/rang (par exemple
`Line 10 — الترجي الرياضي التونسي`) et remplace uniquement son logo. Les
métadonnées du rang et du nom sont également enregistrées dans la description
du fichier Drive.

1. Ouvrez `google-apps-script.gs` dans Google Apps Script.
2. Déployez-le comme **Web app**, exécuté par vous, accessible à toute
   personne ayant le lien.
3. Copiez l'URL `/exec` dans `DRIVE_API_URL` de `drive-api.js`.

Le client utilise un POST `text/plain` en mode `no-cors`, car Google Apps
Script ne fournit pas les headers CORS nécessaires aux requêtes JSON
préflightées. Le résultat est donc confirmé comme envoyé côté navigateur ;
vérifiez le fichier dans Drive en cas d'erreur de permissions.

Le script :
1. ouvre le classement Flashscore configuré dans `config.py` ;
2. récupère les 16 équipes, matchs joués et points ;
3. associe chaque équipe à son nom arabe ;
4. récupère le logo affiché par Flashscore et le sauvegarde dans `assets/logos/` ;
5. génère `index.html`.

## Mise à jour automatique

```bash
python main.py --watch --interval 300
```

`300` = mise à jour toutes les 5 minutes.

## Important pour les logos

Le dossier `assets/logos/` peut être vide dans le ZIP. Les logos sont téléchargés automatiquement pendant l'exécution du scraper. Si le téléchargement local échoue, `index.html` utilise l'URL du logo récupérée depuis Flashscore comme fallback.

## Layout verrouillé — draft

Le renderer respecte exactement le principe du draft :

- Table gauche (9–16) : **RANG → LOGO → ÉQUIPE → PTS → MJ** de gauche à droite.
- Table droite (1–8) : **MJ → PTS → ÉQUIPE → LOGO → RANG** de gauche à droite.
- Donc, sur les deux tableaux, en partant du bord extérieur vers le centre : **RANG → LOGO → ÉQUIPE → PTS → MJ**.
- Le classement et les logos restent dynamiques : Python récupère Flashscore puis génère `index.html`.


## Table layout (final)
Both tables, left-to-right: MJ | PTS | NOM ÉQUIPE | LOGO | RANG.

- Left table: ranks 9-16
- Right table: ranks 1-8
