import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../theme';

export default function StarRating({
  rating,
  size = 20,
  onChange,
}: {
  rating: number;
  size?: number;
  onChange?: (r: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const star = (
          <Text style={{ fontSize: size, color: colors.accent }}>
            {i <= Math.round(rating) ? '★' : '☆'}
          </Text>
        );
        return onChange ? (
          <Pressable key={i} hitSlop={4} onPress={() => onChange(i)} style={{ paddingHorizontal: 1 }}>
            {star}
          </Pressable>
        ) : (
          <View key={i}>{star}</View>
        );
      })}
    </View>
  );
}
