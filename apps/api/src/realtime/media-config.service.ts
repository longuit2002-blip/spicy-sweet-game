import { Injectable } from "@nestjs/common";
import type { MediaIceServer } from "@sweet-spicy/shared-types";

const DEFAULT_WEBRTC_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun2.l.google.com:19302",
] as const;

function parseIceUrls(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

@Injectable()
export class MediaConfigService {
  getIceServers(): MediaIceServer[] {
    const stunUrls = parseIceUrls(process.env.WEBRTC_STUN_URLS);
    const turnUrls = parseIceUrls(process.env.WEBRTC_TURN_URLS ?? process.env.WEBRTC_TURN_URL);
    const turnUsername = process.env.WEBRTC_TURN_USERNAME?.trim();
    const turnCredential = process.env.WEBRTC_TURN_CREDENTIAL?.trim();

    const iceServers: MediaIceServer[] = [
      {
        urls: stunUrls.length > 0 ? stunUrls : [...DEFAULT_WEBRTC_STUN_URLS],
      },
    ];

    if (turnUrls.length > 0 && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrls,
        username: turnUsername,
        credential: turnCredential,
      });
    }

    return iceServers;
  }
}
