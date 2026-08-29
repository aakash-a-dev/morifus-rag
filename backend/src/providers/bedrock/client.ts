import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { env } from "../../config/env";

export const bedrockClient = new BedrockRuntimeClient({
  region: env.aws.region,
  credentials:
    env.aws.accessKeyId && env.aws.secretAccessKey
      ? {
          accessKeyId: env.aws.accessKeyId,
          secretAccessKey: env.aws.secretAccessKey,
          sessionToken: env.aws.sessionToken,
        }
      : undefined, // falls back to default provider chain (SSO/profile/instance role)
});
