import React from 'react';

const LoadingSpinner = () => {
    return (
        <div style={styles.spinnerContainer}>
            <div style={styles.loadingSpinner}></div>
            <p style={styles.loadingText}>Loading...</p>
        </div>
    );
};

// CSS styles defined as JavaScript objects
const styles = {
    spinnerContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: 'transparent'
    },
    loadingSpinner: {
        width: '50px',
        height: '50px',
        border: '5px solid #f3f3f3',
        borderTop: '5px solid #3498db',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '1rem'
    },
    loadingText: {
        color: '#333',
        fontSize: '1rem',
        fontFamily: 'Arial, sans-serif'
    },
    // Keyframes as a style tag
    spinKeyframes: `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `
};

// Create a style element for the keyframes
const styleElement = document.createElement('style');
styleElement.innerHTML = styles.spinKeyframes;
document.head.appendChild(styleElement);

export default LoadingSpinner;