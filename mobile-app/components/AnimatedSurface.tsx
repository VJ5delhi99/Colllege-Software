import { ReactNode } from "react";
import { MotiView } from "moti";
import { StyleProp, ViewStyle } from "react-native";

type AnimatedSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  from?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  transition?: Record<string, unknown>;
};

export function AnimatedSurface({ children, style, from, animate, transition }: AnimatedSurfaceProps) {
  return (
    <MotiView
      from={from}
      animate={animate}
      transition={transition}
      style={style}
    >
      {children}
    </MotiView>
  );
}
