# LA GRANDE ARMÉE — Batailles de Napoléon

Jeu de stratégie temps réel en 2D (HTML5 Canvas + JavaScript, sans dépendance)
représentant les campagnes napoléoniennes de Marengo à Waterloo.

Chaque unité est un **symbole** : on lit l'armée d'un coup d'œil, comme sur une
carte d'état-major.

| Symbole | Unité | Rôle |
|---|---|---|
| ● cercle | **Infanterie** | Le gros de l'armée. Tient le terrain, redoutable en masse |
| ▲ triangle | **Cavalerie** | Charge et percée ; fatigue rapidement |
| ■ carré | **Artillerie** | Tir courbe à 335 px, anéantit les masses |
| ✕ croix | **Sapeur — unité de choc** | Frappe les retranchements (×2,4) et franchit les obstacles |
| ★ grande étoile dorée | **Commandant** (officier) | +20 % d'attaque, coordination ; sa mort coûte cher |
| ✦ petite étoile argentée | **Chef de troupe** (sous-officier) | +32 % de défense, retarde et empêche la rupture |
| ✷ étoile à huit branches + halo | **Napoléon Bonaparte** | +22 % d'attaque, +15 de moral, moral qui se refait vite autour de lui |

## Lancer le jeu

Double-cliquez sur `index.html` : aucun serveur n'est nécessaire.

Pour un test en local avec un vrai serveur (utile pour déboguer) :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8123
# puis ouvrir http://localhost:8123/
```

## Commandes

| Action | Touche |
|---|---|
| Sélectionner | clic gauche |
| Sélection multiple | glisser / Maj + clic |
| Ordre de marche | clic droit |
| Attaque-mouvement | `A` puis clic |
| Tenir la position | `H` |
| Charge générale | `C` |
| Présence impériale | `E` |
| Pause | `Espace` |
| Vitesse | `1` `2` `3` |
| Zoom | molette, `+` / `-` |
| Recentrer la sélection | `F` |
| Menu | `Échap` |

## Le combat

- Chaque unité a un **effectif**, un **moral** et une **fatigue**.
- Le moral s'effondre quand on est surchargé : l'unité **rompt**, fuit, et si
  elle atteint le bord du champ elle est **capturée** (prisonniers).
- Un sous-officier proche peut **rallier** une compagnie qui rompt (une fois).
- La pression subie est proportionnelle à `attaque / défense`, aplatie par une
  courbe : un petit avantage ne suffit pas, il faut le nombre, la qualité et le terrain.
- L'artillerie a une portée minimale : elle se **replie** si l'ennemi vient trop près.
- La cavalerie frappe les flancs (×1,35) pendant une charge (×1,6), puis se reforme.

## Le terrain

Forêts, buttes, villages et marais offrent un couvert (défense +10 à +45 %) mais
ralentissent. Les routes accélèrent. **Les rivières bloquent cavalerie et
artillerie sauf aux ponts** ; infanterie et sapeurs peuvent les franchir lentement.
Les fortifications (Pratzen, Grande Flèche, Hougoumont…) sont assiégées par les
sapeurs — ou tournées par l'artillerie adverse.

## Napoléon en personne

C'est le cœur du jeu. Tant que l'Empereur est sur le champ :

- les unités à moins de 320 px gagnent **+22 % d'attaque** et **+15 de moral** ;
- leur moral se reconstitue **90 % plus vite** ;
- lui-même ne rompt jamais.

S'il est mis hors de combat, toute l'armée perd 45 de moral d'un coup : c'est
souvent la défaite. La touche `E` déclenche la **Présence impériale** :
18 secondes de galvanisation pour toute l'armée, puis 45 s de recharge.

## Les campagnes

| # | Campagne | Date | Difficulté |
|---|---|---|---|
| I | Marengo | 14 juin 1800 | ★ |
| II | Austerlitz | 2 décembre 1805 | ★★ |
| III | Iéna-Auerstaedt | 14 octobre 1806 | ★★★ |
| IV | Eylau | 7-8 février 1807 | ★★★★ |
| V | Wagram | 5-6 juillet 1809 | ★★★★ |
| VI | Borodino | 7 septembre 1812 | ★★★★★ |
| VII | Leipzig | 16-19 octobre 1813 | ★★★★★ |
| VIII | Waterloo | 18 juin 1815 | ★★★★★ |

Et, en plus des campagnes, le **bac à sable** décrit plus bas.

Chaque campagne a sa carte (rivières, ponts, forêts, buttes, villages,
fortifications), ses ordres, son briefing, ses renforts et ses objectifs.
La progression est enregistrée dans le navigateur (`localStorage`).

---

## 🏰 Scénarios personnalisés — le bac à sable

Un neuvième mode, accessible depuis le menu principal : **carte vierge, tout
modifiable, temps illimité**. Composez votre champ de bataille, puis lancez une
bataille qui peut durer aussi longtemps que vous le voulez.

### Outils de l'éditeur

| Outil | Effet |
|---|---|
| **Sélection** | Cliquez une unité et déplacez-la ; `Suppr` pour la supprimer |
| **Peindre** | Peignez forêts, buttes, villages, marais, rochers (taille réglable) |
| **Mur / fort** | Tracez un mur : **infranchissable**, et **+35 % de défense** pour qui s'y appuie — de quoi batir une真正的 forteresse |
| **Rivière** | Cavalerie et artillerie ne la franchissent qu'aux ponts |
| **Route** | Les unités y avancent 60 % plus vite |
| **Pont** | Se pose sur une rivière |
| **Redoute** | Ouvrage fortifié qui tire sur les ennemis — français ou adverse |
| **Village** | Village : couvert de +32 % |
| **Étendue d'eau** | Lac ou mer, totalement infranchissable |
| **Ajouter une troupe** | Pose l'unité de la palette où vous voulez, sur le camp de votre choix |
| **Gomme** | Supprime une unité, un mur, une rivière, une redoute… |

### Particularités

- **Placement totalement libre** : pas de zone de déploiement, chaque unité est
  là où vous la posez.
- **Temps illimité** : la limite de 10 minutes des campagnes n'existe plus ici.
  Vous pouvez ensuite ➕ **ajouter des renforts en plein combat** pour faire
  grossir la bataille autant que voulu.
- **Retour en édition** à tout moment : on peut corriger le terrain en cours de
  partie, ou juste dans l'état, puis reprendre.
- **Sauvegarde** : jusqu'à 20 scénarios enregistrés dans le navigateur
  (décor + unités + positions), rechargeables à volonté.

### Raccourcis de l'éditeur

`1` sélection · `2` peindre · `3` mur · `4` rivière · `5` route · `6` pont ·
`7` redoute · `8` village · `9` eau · `0` ajouter une troupe · `X` gomme ·
`Entrée` lancer le combat · `Suppr` effacer la sélection · `Échap` revenir

La molette règle la taille du pinceau. `Maj` + clic inverse le camp des unités.

## Structure du projet

```
napoleon-2d/
├── index.html      structure des écrans (menu, briefing, HUD, résultat, aide)
├── styles.css      thème « parchemin et or »
├── serve.ps1       mini serveur statique (facultatif)
└── js/
    ├── core.js     utilitaires mathématiques, RNG déterministe
    ├── data.js     classes d'unités, équilibrage, définition des 8 campagnes
    ├── map.js      carte : terrain, eau, routes, rendu en cache,placements
    ├── entity.js   Unit et Fort : ordres, déplacement, moral, rupture
    ├── combat.js   auras, acquisition des cibles, tirs, dégâts, projectiles
    ├── ai.js       commandement ennemi : rôles, échelons, charge de flanc
    ├── render.js   rendu du terrain, des symboles, des effets, du HUD
    ├── sandbox.js  bac à sable : outils d'édition, sauvegarde des scénarios
    ├── input.js    souris et clavier, sélection, ordres
    ├── audio.js    sons de synthèse (WebAudio), aucun fichier externe
    ├── ui.js       écrans, fiches d'unités, barre d'unités, infobulles
    └── game.js     état du jeu, boucle principale, conditions de fin
```

## Réglage

Tout l'équilibrage se trouve en haut de `js/data.js` (constante `BAL`) et dans
`CLASSES` / `QUALITY` / `TERRAIN`. Les campagnes sont des objets littéraux :
ajouter une neuvième campagne ne demande qu'une entrée de plus dans `CAMPAIGNS`.