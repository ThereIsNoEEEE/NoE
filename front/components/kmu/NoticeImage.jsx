"use client";

import Image from "next/image";
import { useState } from "react";

export function NoticeImage({ src, title }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) return null;
  return (
    <Image
      src={src}
      alt={`${title} 공지 이미지`}
      fill
      unoptimized
      sizes="(max-width: 1120px) 100vw, 33vw"
      className="notice-poster"
      onError={() => setFailedSrc(src)}
    />
  );
}
