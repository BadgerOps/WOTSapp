import { useState, useEffect } from "react";

const PHRASES = [
  'Muttering "Absolutely Not"',
  "Taking a lap",
  "Making it make sense",
  "Staying in lane",
  "Loading way too much javascript",
];

export default function Loading({ fullScreen = false }) {
  const [phraseIndex, setPhraseIndex] = useState(() =>
    Math.floor(Math.random() * PHRASES.length),
  );
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDotCount((prev) => (prev >= 4 ? 1 : prev + 1));
    }, 500);

    const phraseInterval = setInterval(() => {
      setPhraseIndex((prev) => {
        let next;
        do {
          next = Math.floor(Math.random() * PHRASES.length);
        } while (next === prev && PHRASES.length > 1);
        return next;
      });
    }, 3000);

    return () => {
      clearInterval(dotInterval);
      clearInterval(phraseInterval);
    };
  }, []);

  const dots = ".".repeat(dotCount);

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      <p className="text-gray-600 font-medium text-lg min-w-[200px] text-center">
        {PHRASES[phraseIndex]}
        {dots}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {content}
      </div>
    );
  }

  return <div className="py-12">{content}</div>;
}
