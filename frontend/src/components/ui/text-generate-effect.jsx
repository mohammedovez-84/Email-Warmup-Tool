import React, { useState, useEffect } from 'react';

import { motion } from 'framer-motion';
export const TextGenerateEffect = ({ words, className = "" }) => {

  const [displayedText, setDisplayedText] = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);

 

  useEffect(() => {

    if (currentIndex < words.length) {

      const timeout = setTimeout(() => {

        setDisplayedText(prev => prev + words[currentIndex]);

        setCurrentIndex(prev => prev + 1);

      }, 100);

 

      return () => clearTimeout(timeout);

    }

  }, [currentIndex, words]);

 

  return (

    <motion.span

      className={`inline-block ${className}`}

      initial={{ opacity: 0 }}

      animate={{ opacity: 1 }}

    >

      {displayedText}

   </motion.span>

  );

};