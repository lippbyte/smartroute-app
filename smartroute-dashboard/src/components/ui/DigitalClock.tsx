import React, { useState, useEffect } from "react";

export const DigitalClock: React.FC = () => {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  function formatTime(): string {
    const hours: number = time.getHours();
    const minutes: number = time.getMinutes();
    const seconds: number = time.getSeconds();

    const padZero = (num: number): string =>
      num < 10 ? `0${num}` : num.toString();

    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
  }

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-100 font-bold font-mono text-4xl text-white bg-dark-2 py-2 px-4 border border-light-1/20 rounded-sm">
      <span>{formatTime()}</span>
    </div>
  );
};

export default DigitalClock;