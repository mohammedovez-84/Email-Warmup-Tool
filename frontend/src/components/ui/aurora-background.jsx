import React from 'react';
import { motion } from 'framer-motion';

export const AuroraBackground = ({ children, className = "" }) => {
  return (
    <div className={`relative ${className}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0, 0.2, 0],
          transition: { duration: 10, repeat: Infinity, ease: "easeInOut" }
        }}
        className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e5_1px,transparent_1px),linear-gradient(to_bottom,#4f46e5_1px,transparent_1px)] bg-[size:4rem_4rem]"
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0, 0.3, 0],
          transition: { duration: 15, repeat: Infinity, ease: "easeInOut" }
        }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-blue-500/10 to-transparent blur-lg"
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0, 0.3, 0],
          transition: { duration: 20, repeat: Infinity, ease: "easeInOut" }
        }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 to-transparent blur-lg"
      />

      {children}
    </div>
  );
};
