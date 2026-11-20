// 七十二候 — les 72 micro-saisons du calendrier japonais (version de 1874).
// Chaque saison dure environ 5 jours. Les dates de début sont celles des années
// courantes (elles varient d'un jour selon l'année, c'est suffisant ici).
// Pour l'hémisphère sud, on décale de six mois : les noms suivent alors la nature
// réellement visible autour de soi plutôt que le calendrier de Kyoto.

import { tr } from '../i18n';

export type SeasonKind = 'printemps' | 'ete' | 'automne' | 'hiver';

export interface MicroSeason {
  start: [number, number]; // [mois 1-12, jour]
  jp: string;
  fr: string; // nom français (clé de traduction : afficher avec koName / tr)
  sekki: string; // une des 24 grandes périodes (節気)
}

export const MICRO_SEASONS: MicroSeason[] = [
  { start: [2, 4], jp: '東風解凍', fr: 'Le vent d’est fait fondre la glace', sekki: '立春' },
  { start: [2, 9], jp: '黄鶯睍睆', fr: 'Le rossignol chante dans les montagnes', sekki: '立春' },
  { start: [2, 14], jp: '魚上氷', fr: 'Les poissons remontent sous la glace', sekki: '立春' },
  { start: [2, 19], jp: '土脉潤起', fr: 'La pluie humidifie la terre', sekki: '雨水' },
  { start: [2, 24], jp: '霞始靆', fr: 'La brume commence à s’étendre', sekki: '雨水' },
  { start: [3, 1], jp: '草木萌動', fr: 'Les herbes et les arbres bourgeonnent', sekki: '雨水' },
  { start: [3, 6], jp: '蟄虫啓戸', fr: 'Les insectes sortent de leur sommeil', sekki: '啓蟄' },
  { start: [3, 11], jp: '桃始笑', fr: 'Les pêchers commencent à fleurir', sekki: '啓蟄' },
  { start: [3, 16], jp: '菜虫化蝶', fr: 'Les chenilles deviennent papillons', sekki: '啓蟄' },
  { start: [3, 21], jp: '雀始巣', fr: 'Les moineaux font leur nid', sekki: '春分' },
  { start: [3, 26], jp: '桜始開', fr: 'Les premiers cerisiers fleurissent', sekki: '春分' },
  { start: [3, 31], jp: '雷乃発声', fr: 'Le tonnerre gronde au loin', sekki: '春分' },
  { start: [4, 5], jp: '玄鳥至', fr: 'Les hirondelles reviennent', sekki: '清明' },
  { start: [4, 10], jp: '鴻雁北', fr: 'Les oies sauvages partent vers le nord', sekki: '清明' },
  { start: [4, 15], jp: '虹始見', fr: 'Les premiers arcs-en-ciel', sekki: '清明' },
  { start: [4, 20], jp: '葭始生', fr: 'Les premiers roseaux sortent de l’eau', sekki: '穀雨' },
  { start: [4, 25], jp: '霜止出苗', fr: 'Fin du givre, les semis germent', sekki: '穀雨' },
  { start: [4, 30], jp: '牡丹華', fr: 'Les pivoines fleurissent', sekki: '穀雨' },
  { start: [5, 5], jp: '蛙始鳴', fr: 'Les grenouilles commencent à chanter', sekki: '立夏' },
  { start: [5, 10], jp: '蚯蚓出', fr: 'Les vers de terre remontent', sekki: '立夏' },
  { start: [5, 15], jp: '竹笋生', fr: 'Les pousses de bambou sortent', sekki: '立夏' },
  { start: [5, 21], jp: '蚕起食桑', fr: 'Les vers à soie dévorent le mûrier', sekki: '小満' },
  { start: [5, 26], jp: '紅花栄', fr: 'Les carthames fleurissent', sekki: '小満' },
  { start: [5, 31], jp: '麦秋至', fr: 'Le blé est mûr', sekki: '小満' },
  { start: [6, 6], jp: '螳螂生', fr: 'Les mantes religieuses éclosent', sekki: '芒種' },
  { start: [6, 11], jp: '腐草為螢', fr: 'Les lucioles s’élèvent des herbes humides', sekki: '芒種' },
  { start: [6, 16], jp: '梅子黄', fr: 'Les prunes jaunissent', sekki: '芒種' },
  { start: [6, 21], jp: '乃東枯', fr: 'La brunelle se fane', sekki: '夏至' },
  { start: [6, 27], jp: '菖蒲華', fr: 'Les iris fleurissent', sekki: '夏至' },
  { start: [7, 2], jp: '半夏生', fr: 'Le pinellia pousse', sekki: '夏至' },
  { start: [7, 7], jp: '温風至', fr: 'Les vents chauds arrivent', sekki: '小暑' },
  { start: [7, 12], jp: '蓮始開', fr: 'Les premiers lotus s’ouvrent', sekki: '小暑' },
  { start: [7, 17], jp: '鷹乃学習', fr: 'Les jeunes faucons apprennent à voler', sekki: '小暑' },
  { start: [7, 23], jp: '桐始結花', fr: 'Les paulownias donnent leurs graines', sekki: '大暑' },
  { start: [7, 28], jp: '土潤溽暑', fr: 'La terre est humide, l’air étouffant', sekki: '大暑' },
  { start: [8, 2], jp: '大雨時行', fr: 'De grandes pluies tombent parfois', sekki: '大暑' },
  { start: [8, 7], jp: '涼風至', fr: 'Les vents frais arrivent', sekki: '立秋' },
  { start: [8, 13], jp: '寒蝉鳴', fr: 'Les cigales du soir chantent', sekki: '立秋' },
  { start: [8, 18], jp: '蒙霧升降', fr: 'Un brouillard épais s’élève', sekki: '立秋' },
  { start: [8, 23], jp: '綿柎開', fr: 'Les capsules de coton s’ouvrent', sekki: '処暑' },
  { start: [8, 28], jp: '天地始粛', fr: 'La chaleur commence enfin à retomber', sekki: '処暑' },
  { start: [9, 2], jp: '禾乃登', fr: 'Le riz mûrit', sekki: '処暑' },
  { start: [9, 8], jp: '草露白', fr: 'La rosée blanchit les herbes', sekki: '白露' },
  { start: [9, 13], jp: '鶺鴒鳴', fr: 'Les bergeronnettes chantent', sekki: '白露' },
  { start: [9, 18], jp: '玄鳥去', fr: 'Les hirondelles s’en vont', sekki: '白露' },
  { start: [9, 23], jp: '雷乃収声', fr: 'Le tonnerre se tait', sekki: '秋分' },
  { start: [9, 28], jp: '蟄虫坏戸', fr: 'Les insectes ferment leurs terriers', sekki: '秋分' },
  { start: [10, 3], jp: '水始涸', fr: 'On assèche les rizières', sekki: '秋分' },
  { start: [10, 8], jp: '鴻雁来', fr: 'Les oies sauvages reviennent', sekki: '寒露' },
  { start: [10, 13], jp: '菊花開', fr: 'Les chrysanthèmes fleurissent', sekki: '寒露' },
  { start: [10, 18], jp: '蟋蟀在戸', fr: 'Les grillons chantent à la porte', sekki: '寒露' },
  { start: [10, 23], jp: '霜始降', fr: 'Les premières gelées blanches', sekki: '霜降' },
  { start: [10, 28], jp: '霎時施', fr: 'De fines pluies tombent par moments', sekki: '霜降' },
  { start: [11, 2], jp: '楓蔦黄', fr: 'Les érables et le lierre rougissent', sekki: '霜降' },
  { start: [11, 7], jp: '山茶始開', fr: 'Les camélias commencent à fleurir', sekki: '立冬' },
  { start: [11, 12], jp: '地始凍', fr: 'La terre commence à geler', sekki: '立冬' },
  { start: [11, 17], jp: '金盞香', fr: 'Les narcisses fleurissent', sekki: '立冬' },
  { start: [11, 22], jp: '虹蔵不見', fr: 'Les arcs-en-ciel se cachent', sekki: '小雪' },
  { start: [11, 27], jp: '朔風払葉', fr: 'Le vent du nord emporte les feuilles', sekki: '小雪' },
  { start: [12, 2], jp: '橘始黄', fr: 'Les mandariniers jaunissent', sekki: '小雪' },
  { start: [12, 7], jp: '閉塞成冬', fr: 'Le ciel se ferme, l’hiver s’installe', sekki: '大雪' },
  { start: [12, 12], jp: '熊蟄穴', fr: 'Les ours se retirent dans leur tanière', sekki: '大雪' },
  { start: [12, 16], jp: '鱖魚群', fr: 'Les saumons se rassemblent', sekki: '大雪' },
  { start: [12, 21], jp: '乃東生', fr: 'La brunelle germe', sekki: '冬至' },
  { start: [12, 26], jp: '麋角解', fr: 'Les cerfs perdent leurs bois', sekki: '冬至' },
  { start: [12, 31], jp: '雪下出麦', fr: 'Sous la neige, le blé germe', sekki: '冬至' },
  { start: [1, 5], jp: '芹乃栄', fr: 'Le persil sauvage pousse', sekki: '小寒' },
  { start: [1, 10], jp: '水泉動', fr: 'Les sources se remettent à couler', sekki: '小寒' },
  { start: [1, 15], jp: '雉始雊', fr: 'Le faisan commence à appeler', sekki: '小寒' },
  { start: [1, 20], jp: '款冬華', fr: 'Les pétasites bourgeonnent', sekki: '大寒' },
  { start: [1, 25], jp: '水沢腹堅', fr: 'La glace s’épaissit sur les ruisseaux', sekki: '大寒' },
  { start: [1, 30], jp: '鶏始乳', fr: 'Les poules commencent à pondre', sekki: '大寒' },
];

/** Grandes saisons (au sens japonais : elles commencent ~6 semaines avant les nôtres). */
export function seasonOf(index: number): SeasonKind {
  if (index < 18) return 'printemps'; // 立春 → 穀雨
  if (index < 36) return 'ete'; // 立夏 → 大暑
  if (index < 54) return 'automne'; // 立秋 → 霜降
  return 'hiver'; // 立冬 → 大寒
}

const SEASON_LABEL: Record<SeasonKind, string> = { printemps: 'Printemps', ete: 'Été', automne: 'Automne', hiver: 'Hiver' };

/** Nom affiché d'une micro-saison, dans la langue de l'interface. */
export const koName = (s: MicroSeason) => tr(s.fr);

/** Nom affiché d'une grande saison. */
export const seasonLabel = (kind: SeasonKind) => tr(SEASON_LABEL[kind]);

function ord(m: number, d: number) {
  return m * 32 + d;
}

export interface CurrentSeason {
  index: number; // 0-71
  season: MicroSeason;
  kind: SeasonKind;
  kindLabel: string; // traduit
  name: string; // nom de la micro-saison, traduit
  from: Date;
  to: Date; // inclus
}

/** Micro-saison en cours. `hemisphere` : 'sud' décale d'environ six mois. */
export function currentMicroSeason(date = new Date(), hemisphere: 'nord' | 'sud' = 'nord'): CurrentSeason {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (hemisphere === 'sud') d.setDate(d.getDate() + 182);
  const key = ord(d.getMonth() + 1, d.getDate());
  // la liste commence au 4 février : on cherche la dernière saison dont le début est <= date
  // Si aucune ne commence avant (début janvier), c'est la dernière de l'année civile (雪下出麦, 31 déc.).
  const keys = MICRO_SEASONS.map((m) => ord(m.start[0], m.start[1]));
  let index = -1;
  for (let i = 0; i < keys.length; i++) if (keys[i] <= key && (index === -1 || keys[i] > keys[index])) index = i;
  if (index === -1) index = keys.indexOf(Math.max(...keys));

  const s = MICRO_SEASONS[index];
  const next = MICRO_SEASONS[(index + 1) % MICRO_SEASONS.length];
  let year = d.getFullYear();
  if (ord(s.start[0], s.start[1]) > key) year -= 1; // saison commencée l'année précédente
  const from = new Date(year, s.start[0] - 1, s.start[1]);
  let toYear = year;
  if (ord(next.start[0], next.start[1]) <= ord(s.start[0], s.start[1])) toYear += 1;
  const to = new Date(toYear, next.start[0] - 1, next.start[1] - 1);
  if (hemisphere === 'sud') {
    from.setDate(from.getDate() - 182);
    to.setDate(to.getDate() - 182);
  }
  const kind = seasonOf(index);
  return { index, season: s, kind, kindLabel: seasonLabel(kind), name: koName(s), from, to };
}
