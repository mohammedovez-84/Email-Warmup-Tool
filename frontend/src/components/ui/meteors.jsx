
import React from 'react';
import { motion } from 'framer-motion';

export const Meteors = ({ number = 10, className = "" }) => {
  const meteors = new Array(number).fill(true);

  return (
    <div className={`relative ${className}`}>
      {meteors.map((_, idx) => {
        const left = `${Math.random() * 100}%`;
        const delay = Math.random() * 0.6;
        const duration = Math.random() * 3 + 2;

        return (
          <motion.div
            key={`meteor-${idx}`}
            className="absolute top-0 h-0.5 w-0.5 rounded-full bg-white shadow-[0_0_0_1px_#ffffff10] rotate-[215deg]"
            initial={{
              top: 0,
              left: left,
              opacity: 1,
              x: 0,
              y: 0
            }}
            animate={{
              x: [0, 1000],
              y: [0, 1000],
              opacity: [1, 0],
            }}
            transition={{
              delay,
              duration,
              ease: [0.4, 0, 0.2, 1],
              repeat: Infinity,
              repeatDelay: Math.random() * 10 + 5
            }}
          />
        );
      })}
    </div>
  );
};
