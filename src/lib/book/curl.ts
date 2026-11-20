// Page qui se courbe (SKSL). La page du dessus s'enroule sur un cylindre vertical
// (légèrement incliné selon le doigt) et révèle la page de dessous.
// - `cx` : position du pli (en px). Grand = page à plat, très négatif = page tournée.
// - `angle` : inclinaison du pli (radians), suit la hauteur du doigt.
// Le dos de la page est un papier plus pâle où l'écriture transparaît à l'envers.

export const CURL_SKSL = `
uniform shader page;
uniform shader under;
uniform float2 res;
uniform float cx;
uniform float angle;
uniform float radius;
uniform float3 paper;

const float PI = 3.14159265;

float2 rot(float2 p, float a) { float c = cos(a), s = sin(a); return float2(c * p.x - s * p.y, s * p.x + c * p.y); }
bool inside(float2 p) { return p.x >= 0.0 && p.y >= 0.0 && p.x <= res.x && p.y <= res.y; }

half4 backSide(float2 src, float shade) {
  half4 c = page.eval(src); // le pli retourne déjà la feuille : l'écriture transparaît en miroir
  half3 col = mix(half3(paper), c.rgb, 0.12) * half(shade);
  return half4(col, 1.0);
}

half4 main(float2 fc) {
  float2 pivot = float2(cx, res.y * 0.5);
  float2 q = rot(fc - pivot, -angle);   // repère du pli : x = distance au pli
  float d = q.x;
  float R = radius;

  // 1) partie déjà enroulée et retombée à plat par-dessus (dos de la page)
  if (d < 0.0) {
    float2 sb = rot(float2(PI * R - d, q.y), angle) + pivot; // position d'origine sur la page
    if (inside(sb) && d > -PI * R * 1.0 - res.x) {
      float shade = 0.82 + 0.12 * clamp(-d / (R * 3.0), 0.0, 1.0);
      return backSide(sb, shade);
    }
    // ombre portée du rouleau sur la page
    half4 c = page.eval(fc);
    float sh = 1.0 - 0.25 * exp(-(-d) / (R * 0.6));
    return half4(c.rgb * half(sh), 1.0);
  }

  // 2) le cylindre lui-même
  if (d < R) {
    float a = asin(clamp(d / R, -1.0, 1.0));
    float2 sb = rot(float2(R * (PI - a), q.y), angle) + pivot;
    if (inside(sb)) {
      float shade = 0.62 + 0.35 * cos(a);
      return backSide(sb, shade);
    }
    float2 sf = rot(float2(R * a, q.y), angle) + pivot;
    if (inside(sf)) {
      half4 c = page.eval(sf);
      float shade = 0.75 + 0.25 * cos(a) - 0.25 * pow(d / R, 3.0);
      return half4(c.rgb * half(shade), 1.0);
    }
  }

  // 3) la page de dessous, avec l'ombre du rouleau
  half4 u = under.eval(fc);
  float s = 1.0 - 0.45 * exp(-(d - R) / (R * 0.9));
  return half4(u.rgb * half(clamp(s, 0.55, 1.0)), 1.0);
}
`;
