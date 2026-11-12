import posthog from "posthog-js";

type PrototypeLogAttributes = Record<string, string | number | boolean>;

export const prototypeLogger = {
  info(message: string, attributes: PrototypeLogAttributes) {
    posthog.logger.info(message, attributes);
  },
};
