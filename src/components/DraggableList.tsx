import { ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { thud } from './ui';

// Liste réordonnable : appui long sur un élément puis glisser. Les voisins se
// décalent en direct ; au relâchement, onReorder reçoit le nouvel ordre des clés.

interface Props<T> {
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
  onReorder: (keys: string[]) => void;
}

export function DraggableList<T>({ items, keyOf, render, onReorder }: Props<T>) {
  const heights = useSharedValue<number[]>([]);
  const dragIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const keys = items.map(keyOf);

  const reset = () => {
    dragIndex.set(-1);
    hoverIndex.set(-1);
    dragY.set(0);
  };

  // La tâche glisse d'abord jusqu'à sa place (côté UI), puis on réordonne les données
  // et on remet les décalages à zéro une fois le nouvel ordre affiché.
  const finish = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) {
      reset();
      return;
    }
    const next = keys.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTimeout(() => {
      onReorder(next);
      setTimeout(reset, 40);
    }, 170);
  };

  return (
    <View>
      {items.map((item, i) => (
        <Row key={keys[i]} index={i} heights={heights} dragIndex={dragIndex} hoverIndex={hoverIndex} dragY={dragY} onDrop={finish}>
          {render(item)}
        </Row>
      ))}
    </View>
  );
}

function Row({
  index,
  heights,
  dragIndex,
  hoverIndex,
  dragY,
  onDrop,
  children,
}: {
  index: number;
  heights: SharedValue<number[]>;
  dragIndex: SharedValue<number>;
  hoverIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  onDrop: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      dragIndex.set(index);
      hoverIndex.set(index);
      dragY.set(0);
      scheduleOnRN(thud);
    })
    .onUpdate((e) => {
      dragY.set(e.translationY);
      const hs = heights.value;
      let target = index;
      if (e.translationY > 0) {
        let acc = 0;
        for (let k = index + 1; k < hs.length; k++) {
          acc += hs[k] ?? 0;
          if (e.translationY > acc - (hs[k] ?? 0) / 2) target = k;
          else break;
        }
      } else {
        let acc = 0;
        for (let k = index - 1; k >= 0; k--) {
          acc += hs[k] ?? 0;
          if (-e.translationY > acc - (hs[k] ?? 0) / 2) target = k;
          else break;
        }
      }
      hoverIndex.set(target);
    })
    .onFinalize(() => {
      if (dragIndex.value !== index) return;
      const to = hoverIndex.value;
      const hs = heights.value;
      let offset = 0;
      if (to > index) for (let k = index + 1; k <= to; k++) offset += hs[k] ?? 0;
      if (to < index) for (let k = to; k < index; k++) offset -= hs[k] ?? 0;
      dragY.set(withTiming(offset, { duration: 150 }));
      scheduleOnRN(onDrop, index, to);
    });

  const style = useAnimatedStyle(() => {
    const d = dragIndex.value;
    if (d === index) {
      return { transform: [{ translateY: dragY.value }, { scale: withSpring(1.03) }], zIndex: 10, opacity: 0.96 };
    }
    if (d < 0) return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, opacity: 1 };
    let shift = 0;
    const h = heights.value[d] ?? 0;
    if (index > d && index <= hoverIndex.value) shift = -h;
    if (index < d && index >= hoverIndex.value) shift = h;
    return { transform: [{ translateY: withTiming(shift, { duration: 160 }) }, { scale: 1 }], zIndex: 0, opacity: 1 };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={style}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          const next = heights.value.slice();
          next[index] = h;
          heights.set(next);
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
