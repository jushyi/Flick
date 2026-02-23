import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';

import PixelIcon from './PixelIcon';

import { colors } from '../constants/colors';

import styles from '../styles/WhatsNewModal.styles';

const WhatsNewModal = ({ visible, title, items, onDismiss }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <PixelIcon name="notifications-outline" size={48} color={colors.brand.purple} />
          </View>

          <Text style={styles.title}>{title}</Text>

          <View style={styles.itemsContainer}>
            {items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.bullet}>-</Text>
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} activeOpacity={0.8}>
            <Text style={styles.dismissButtonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default WhatsNewModal;
