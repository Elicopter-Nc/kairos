import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// Sons du Focus, synthétisés pour Kairos (aucun enregistrement tiers, aucun droit à gérer) :
// pluie et ruisseau en boucle pendant la concentration, cloche à la fin de chaque phase.

export type Ambient = 'aucun' | 'pluie' | 'ruisseau';

const SOURCES = {
  pluie: require('../../assets/sounds/pluie.wav'),
  ruisseau: require('../../assets/sounds/ruisseau.wav'),
  cloche: require('../../assets/sounds/cloche.wav'),
};

const players: Partial<Record<keyof typeof SOURCES, AudioPlayer>> = {};
let modeSet = false;

function player(name: keyof typeof SOURCES): AudioPlayer | null {
  try {
    if (!modeSet) {
      modeSet = true;
      // joue même en mode silencieux, et laisse la musique des autres apps continuer
      setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      if (name !== 'cloche') p.loop = true;
      players[name] = p;
    }
    return p;
  } catch {
    return null; // module audio indisponible : on reste silencieux
  }
}

let current: Ambient = 'aucun';

export function playAmbient(kind: Ambient) {
  if (kind === current) return;
  stopAmbient();
  current = kind;
  if (kind === 'aucun') return;
  const p = player(kind);
  if (!p) return;
  p.volume = 0.7;
  p.play();
}

export function stopAmbient() {
  if (current !== 'aucun') players[current]?.pause();
  current = 'aucun';
}

export function ringBell() {
  const p = player('cloche');
  if (!p) return;
  p.volume = 0.9;
  p.seekTo(0).then(() => p.play()).catch(() => p.play());
}
