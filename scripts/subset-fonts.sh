#!/usr/bin/env bash
# Régénère les polices allégées (latin + kana + quelques kanji utilisés dans l'UI).
# Prérequis : pip install fonttools  (fournit pyftsubset)
# Les kanji/kana présents dans src/ sont détectés automatiquement : relance ce script
# après avoir ajouté du texte japonais dans l'interface.
set -euo pipefail
cd "$(dirname "$0")/.."
PYFTSUBSET="${PYFTSUBSET:-pyftsubset}"
KANJI="終日月火水木金土曜一二三四五六七八九十今週暦予定習慣集中覚書設定時記録道具静茶空白新規削除保存本年毎回朝夜漏光影色葉"
EXTRA=$(grep -rhoP "[\x{3040}-\x{30FF}\x{4E00}-\x{9FFF}]" src | sort -u | tr -d "\n")
KANJI="$KANJI$EXTRA"
UNI="U+0020-024F,U+2000-206F,U+20AC,U+2100-21FF,U+2200-22FF,U+2460-24FF,U+25A0-25FF,U+2600-27BF,U+3000-303F,U+3040-309F,U+30A0-30FF,U+FF01-FF5E"
SRC=node_modules/@expo-google-fonts
mkdir -p assets/fonts
for pair in \
  "shippori-mincho/500Medium/ShipporiMincho_500Medium:Mincho-Medium" \
  "shippori-mincho/700Bold/ShipporiMincho_700Bold:Mincho-Bold" \
  "zen-kaku-gothic-new/400Regular/ZenKakuGothicNew_400Regular:Gothic-Regular" \
  "zen-kaku-gothic-new/500Medium/ZenKakuGothicNew_500Medium:Gothic-Medium" \
  "zen-kaku-gothic-new/700Bold/ZenKakuGothicNew_700Bold:Gothic-Bold"; do
  "$PYFTSUBSET" "$SRC/${pair%%:*}.ttf" --unicodes="$UNI" --text="$KANJI" --layout-features='*' --output-file="assets/fonts/${pair##*:}.ttf"
done
ls -la assets/fonts
