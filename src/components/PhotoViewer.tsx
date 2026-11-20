import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, StatusBar, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tr } from '../i18n';
import { IconBtn, Txt } from './ui';

/** Visionneuse plein écran : fond sombre, glisser horizontalement entre les photos. */
export function PhotoViewer({ photos, index, onClose }: { photos: string[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index ?? 0);
  const visible = index !== null && photos.length > 0;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: '#0D100C' }}>
        {visible ? (
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(index ?? 0, photos.length - 1)}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(u) => u}
            onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <View style={{ width, height, justifyContent: 'center' }}>
                <Image source={{ uri: item }} style={{ width, height: height * 0.86 }} contentFit="contain" transition={150} />
              </View>
            )}
          />
        ) : null}
        <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt v="num" color="#E6EADB" style={{ fontSize: 14 }}>
            {photos.length > 1 ? `${Math.min(current, photos.length - 1) + 1} / ${photos.length}` : ''}
          </Txt>
          <IconBtn icon="x" label={tr('Fermer la photo')} onPress={onClose} bg="rgba(230,234,219,0.12)" color="#E6EADB" size={40} />
        </View>
      </View>
    </Modal>
  );
}
