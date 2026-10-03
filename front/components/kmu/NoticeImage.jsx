"use client";

import Image from "next/image";
import { useState } from "react";

// Posters are mostly portrait: show the whole image (contain) over a blurred
// copy of itself so the frame never looks empty or cropped.
export function NoticeImage({ src, title }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) return null;
  return (
    <>
      <Image src={src} alt="" aria-hidden fill unoptimized sizes="(max-width: 1120px) 100vw, 33vw" className="notice-poster-bg" />
      <Image
        src={src}
        alt={`${title} 공지 이미지`}
        fill
        unoptimized
        sizes="(max-width: 1120px) 100vw, 33vw"
        className="notice-poster"
        onError={() => setFailedSrc(src)}
      />
    </>
  );
}
