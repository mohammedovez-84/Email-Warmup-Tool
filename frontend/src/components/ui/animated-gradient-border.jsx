// import React from 'react';

// import { motion } from 'framer-motion';



// export const AnimatedGradientBorder = ({ children, borderRadius = "0.5rem", className = "" }) => {

//   return (

//     <div

//       className={`relative p-0.5 ${className}`}

//       style={{ borderRadius }}

//     >

//       <motion.div

//         className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 rounded-lg"

//         initial={{ backgroundPosition: '0% 50%' }}

//         animate={{ backgroundPosition: '100% 50%' }}

//         transition={{

//           duration: 4,

//           repeat: Infinity,

//           repeatType: 'reverse',

//           ease: 'linear'

//         }}

//         style={{ borderRadius }}

//       />

//       <div

//         className="relative bg-white dark:bg-gray-800 rounded-lg"

//         style={{ borderRadius: `calc(${borderRadius} - 2px)` }}
//       >

//         {children}



//     </div>
//     </div>

//   );

// };





import React from 'react';
import { motion } from 'framer-motion';

export const AnimatedGradientBorder = ({
  children,
  borderRadius = "0.5rem",
  className = ""
}) => {
  return (
    <div
      className={`relative p-0.5 ${className}`}
      style={{ borderRadius }}
    >
      <motion.div
        className="absolute inset-0 rounded-lg"
        style={{
          borderRadius,
          background: "linear-gradient(270deg, #0f172a, #0d9488, #14b8a6)",
          backgroundSize: "300% 300%"
        }}
        initial={{ backgroundPosition: "0% 50%" }}
        animate={{ backgroundPosition: "100% 50%" }}
        transition={{
          duration: 4,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "linear"
        }}
      />
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg"
        style={{ borderRadius: `calc(${borderRadius} - 2px)` }}
      >
        {children}
      </div>
    </div>
  );
};
