import React, { useState, useEffect } from 'react';

import { motion } from 'framer-motion';

 

export const TypewriterEffect = ({ words, className = "" }) => {

  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  const [currentText, setCurrentText] = useState("");

  const [isDeleting, setIsDeleting] = useState(false);

  const [speed, setSpeed] = useState(150);

 

  useEffect(() => {

    const word = words[currentWordIndex].text;

    const handleTyping = () => {

      setCurrentText(isDeleting

        ? word.substring(0, currentText.length - 1)

        : word.substring(0, currentText.length + 1)

      );

 

      setSpeed(isDeleting ? 75 : 150);

 

      if (!isDeleting && currentText === word) {

        setTimeout(() => setIsDeleting(true), 1000);

      } else if (isDeleting && currentText === "") {

        setIsDeleting(false);

        setCurrentWordIndex((prev) => (prev + 1) % words.length);

      }

    };

 

    const timer = setTimeout(handleTyping, speed);

    return () => clearTimeout(timer);

  }, [currentText, isDeleting, currentWordIndex, words, speed]);

 

  return (

    <motion.span

      className={`inline-block ${className}`}

      initial={{ opacity: 0 }}

      animate={{ opacity: 1 }}

    >

      {currentText}

      <motion.span

        animate={{ opacity: [0, 1, 0] }}

        transition={{ duration: 0.8, repeat: Infinity }}

        className="ml-1"

      >
          </motion.span>
    </motion.span>
  );

};