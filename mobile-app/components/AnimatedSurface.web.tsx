import { ReactNode } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

type AnimatedSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  from?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  transition?: Record<string, unknown>;
};

export function AnimatedSurface({ children, style }: AnimatedSurfaceProps) {
  return <View style={style}>{children}</View>;
}
