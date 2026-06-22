/* eslint-disable no-empty */
import { Haptics, NotificationType } from "@capacitor/haptics";

export const Haptic = {
  async success() {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {} // empty catches to mute errors. we don't care.
  },

  async error() {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {}
  },

  async warn() {
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {}
  },
};
