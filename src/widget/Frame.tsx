import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { ClickActionProps, FlexWidgetStyle } from 'react-native-android-widget';
import { Look, MEDIUM, Pal, SERIF, Size } from './palette';

/**
 * Cadre commun : le décor SVG au fond, un grand kanji en filigrane dans le coin,
 * puis le contenu par-dessus.
 */
export function Frame({
  size,
  p,
  art,
  mark,
  markSize,
  style,
  click,
  children,
}: {
  size: Size;
  p: Pal;
  art: string;
  mark?: string;
  markSize?: number;
  style?: FlexWidgetStyle;
  click?: ClickActionProps;
  children?: unknown;
}) {
  const ms = markSize ?? Math.round(Math.min(size.height * 0.62, 120));
  return (
    <OverlapWidget style={{ width: 'match_parent', height: 'match_parent' }} {...click}>
      <SvgWidget svg={art} style={{ width: size.width, height: size.height }} />
      {mark ? (
        <FlexWidget style={{ width: 'match_parent', height: 'match_parent', alignItems: 'flex-end', justifyContent: 'flex-end', paddingRight: 8 }}>
          <TextWidget text={mark} style={{ fontSize: ms, fontFamily: SERIF, color: p.mark }} />
        </FlexWidget>
      ) : null}
      <FlexWidget style={{ width: 'match_parent', height: 'match_parent', ...style }}>{children as never}</FlexWidget>
    </OverlapWidget>
  );
}

/** Bouton « + » : plein (Komorebi) ou simple anneau (Épuré). */
export function PlusBtn({ p, size, uri, label, look }: { p: Pal; size: number; uri: string; label: string; look: Look }) {
  const ring = look === 'epure';
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: ring ? 'rgba(0, 0, 0, 0)' : p.check,
        borderWidth: ring ? 1.2 : 0,
        borderColor: p.check,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TextWidget text="+" style={{ fontSize: size * (ring ? 0.5 : 0.55), fontFamily: MEDIUM, color: ring ? p.check : p.bg }} />
    </FlexWidget>
  );
}

/** Fine barre d'avancement (version épurée du trait de pinceau). */
export function ThinBar({ p, width, frac }: { p: Pal; width: number; frac: number }) {
  const fw = Math.round(Math.max(0, Math.min(1, frac)) * width);
  return (
    <FlexWidget style={{ width, height: 2, borderRadius: 1, backgroundColor: p.line, flexDirection: 'row' }}>
      {fw > 0 ? <FlexWidget style={{ width: fw, height: 2, borderRadius: 1, backgroundColor: p.check }} /> : null}
    </FlexWidget>
  );
}
