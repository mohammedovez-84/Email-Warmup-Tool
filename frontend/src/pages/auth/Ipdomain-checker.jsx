import React, { useState } from 'react';

const IpDomainChecker = () => {
    const [input, setInput] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([
        { address: 'example.com', status: 'available', type: 'domain' },
        { address: '8.8.8.8', status: 'taken', message: 'Google DNS', type: 'ip' }
    ]);

    // Sample data for demonstration
    const sampleData = {
        '8.8.8.8': {
            type: 'ip',
            address: '8.8.8.8',
            isp: 'Google LLC',
            location: 'Mountain View, California, US',
            timezone: 'GMT-07:00',
            coordinates: '37.4056° N, 122.0775° W',
            status: 'taken',
            message: 'Google Public DNS'
        },
        'example.com': {
            type: 'domain',
            address: 'example.com',
            registrar: 'Example Registrar LLC',
            created: '1995-08-14',
            expires: '2024-08-13',
            status: 'available',
            dns: 'NS1.EXAMPLE.COM, NS2.EXAMPLE.COM'
        },
        '192.168.1.1': {
            type: 'ip',
            address: '192.168.1.1',
            isp: 'Private Network',
            location: 'Local Network',
            timezone: 'N/A',
            coordinates: 'N/A',
            status: 'taken',
            message: 'Private IP Range'
        }
    };

    const handleCheck = () => {
        if (!input.trim()) {
            alert('Please enter an IP address or domain name');
            return;
        }

        setLoading(true);

        // Simulate API call with timeout
        setTimeout(() => {
            let result;

            // Check if input is in sample data
            if (sampleData[input]) {
                result = sampleData[input];
            } else {
                // Generate a random result for demonstration
                const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(input);
                result = {
                    type: isIP ? 'ip' : 'domain',
                    address: input,
                    status: Math.random() > 0.5 ? 'available' : 'taken',
                    message: 'Simulated result for demonstration'
                };

                if (isIP) {
                    result.isp = 'ISP ' + Math.floor(Math.random() * 1000);
                    result.location = 'City ' + Math.floor(Math.random() * 100);
                    result.timezone = 'GMT' + (Math.random() > 0.5 ? '+' : '-') + Math.floor(Math.random() * 12);
                } else {
                    result.registrar = 'Registrar ' + Math.floor(Math.random() * 1000);
                    result.created = '2020-01-01';
                    result.expires = '2025-01-01';
                }
            }

            setResults(result);
            setLoading(false);

            // Add to history
            setHistory(prevHistory => {
                const newHistory = [{ ...result }, ...prevHistory];
                // Keep only the last 5 history items
                return newHistory.slice(0, 5);
            });
        }, 1500);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleCheck();
        }
    };

    return (
        <div style={styles.ipDomainChecker}>
            <div style={styles.container}>
                <header style={styles.header}>
                    <h1 style={styles.title}><i className="fas fa-search" style={styles.icon}></i> IP Domain Checker</h1>
                    <p style={styles.subtitle}>Check IP addresses and domain availability quickly and easily</p>
                </header>

                <div style={styles.inputGroup}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Enter IP address or domain name (e.g., 8.8.8.8 or example.com)"
                        style={styles.input}
                        disabled={loading}
                    />
                    <button onClick={handleCheck} disabled={loading} style={loading ? { ...styles.button, ...styles.buttonDisabled } : styles.button}>
                        {loading ? 'Checking...' : 'Check Now'}
                    </button>
                </div>

                <div style={styles.results}>
                    <h2 style={styles.resultsTitle}><i className="fas fa-info-circle" style={styles.icon}></i> Results</h2>
                    <div style={styles.resultsContent}>
                        {loading ? (
                            <div style={styles.loading}>
                                <i className="fas fa-spinner" style={{ ...styles.icon, animation: 'spin 1s linear infinite' }}></i> Checking {input}...
                            </div>
                        ) : results ? (
                            <div style={styles.resultGrid}>
                                {results.type === 'ip' ? (
                                    <>
                                        <div style={styles.resultCard}>
                                            <h3 style={styles.cardTitle}><i className="fas fa-network-wired" style={styles.icon}></i> IP Information</h3>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>IP Address:</span>
                                                <span style={styles.value}>{results.address}</span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>ISP:</span>
                                                <span style={styles.value}>{results.isp}</span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Location:</span>
                                                <span style={styles.value}>{results.location}</span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Timezone:</span>
                                                <span style={styles.value}>{results.timezone}</span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Coordinates:</span>
                                                <span style={styles.value}>{results.coordinates}</span>
                                            </div>
                                        </div>
                                        <div style={styles.resultCard}>
                                            <h3 style={styles.cardTitle}><i className="fas fa-check-circle" style={styles.icon}></i> Status</h3>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Availability:</span>
                                                <span style={results.status === 'available' ? { ...styles.value, ...styles.statusAvailable } : { ...styles.value, ...styles.statusTaken }}>
                                                    {results.status === 'available' ? 'Available' : (results.message || 'Taken')}
                                                </span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Type:</span>
                                                <span style={styles.value}>IPv4 Address</span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Blacklist Status:</span>
                                                <span style={styles.value}>Clean</span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Response Time:</span>
                                                <span style={styles.value}>{Math.floor(Math.random() * 100)} ms</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={styles.resultCard}>
                                            <h3 style={styles.cardTitle}><i className="fas fa-globe" style={styles.icon}></i> Domain Information</h3>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Domain:</span>
                                                <span style={styles.value}>{results.address}</span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Registrar:</span>
                                                <span style={styles.value}>{results.registrar || 'Unknown'}</span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Created:</span>
                                                <span style={styles.value}>{results.created || 'N/A'}</span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Expires:</span>
                                                <span style={styles.value}>{results.expires || 'N/A'}</span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>DNS:</span>
                                                <span style={styles.value}>{results.dns || 'Not available'}</span>
                                            </div>
                                        </div>
                                        <div style={styles.resultCard}>
                                            <h3 style={styles.cardTitle}><i className="fas fa-check-circle" style={styles.icon}></i> Status</h3>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Availability:</span>
                                                <span style={results.status === 'available' ? { ...styles.value, ...styles.statusAvailable } : { ...styles.value, ...styles.statusTaken }}>
                                                    {results.status === 'available' ? 'Available' : (results.message || 'Taken')}
                                                </span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>WHOIS:</span>
                                                <span style={styles.value}>{results.status === 'available' ? 'Not registered' : 'Registered'}</span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>SSL Certificate:</span>
                                                <span style={styles.value}>{results.status === 'available' ? 'N/A' : 'Valid'}</span>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.label}>Server:</span>
                                                <span style={styles.value}>{results.status === 'available' ? 'N/A' : 'nginx/1.18.0'}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div style={styles.loading}>
                                <i className="fas fa-info-circle" style={styles.icon}></i> Enter an IP or domain to check
                            </div>
                        )}
                    </div>
                </div>

                <div style={styles.history}>
                    <h2 style={styles.historyTitle}><i className="fas fa-history" style={styles.icon}></i> Recent Checks</h2>
                    <div style={styles.historyList}>
                        {history.map((item, index) => (
                            <div key={index} style={styles.historyItem}>
                                <span style={styles.historyAddress}>{item.address}</span>
                                <span style={item.status === 'available' ? { ...styles.historyStatus, ...styles.statusAvailable } : { ...styles.historyStatus, ...styles.statusTaken }}>
                                    {item.status === 'available' ? 'Available' : (item.message || 'Taken')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Inline styles for the component */}
            <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

// CSS styles as JavaScript objects
const styles = {
    ipDomainChecker: {
        background: 'linear-gradient(135deg, #ffffffff, #ffffffff, #ffffffff)',
        color: '#000000ff',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    },
    container: {
        width: '100%',
        maxWidth: '800px',
        background: 'rgba(6, 42, 90, 0.08)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '30px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    header: {
        textAlign: 'center',
        marginBottom: '30px',
    },
    title: {
        fontSize: '2.5rem',
        marginBottom: '10px',
        background: 'linear-gradient(90deg, #000000ff, #000000ff)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
    },
    subtitle: {
        color: '#141313ff',
        fontSize: '1.1rem',
    },
    inputGroup: {
        display: 'flex',
        marginBottom: '25px',
    },
    input: {
        flex: 1,
        padding: '15px 20px',
        border: 'none',
        borderRadius: '10px 0 0 10px',
        background: 'rgba(18, 86, 106, 0.1)',
        color: 'black',
        fontSize: '1rem',
        outline: 'none',
    },
    button: {
        padding: '15px 25px',
        border: 'none',
        borderRadius: '0 10px 10px 0',
        background: 'linear-gradient(90deg, #0B1E3F, #008080)',
        color: 'white',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
    },
    buttonDisabled: {
        opacity: 0.7,
        cursor: 'not-allowed',
    },
    results: {
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '15px',
        padding: '20px',
        marginTop: '20px',
    },
    resultsTitle: {
        marginBottom: '15px',
        fontSize: '1.5rem',
        color: '#000000ff',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    resultsContent: {
        // Container for results
    },
    resultGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
    },
    resultCard: {
        background: 'rgba(0, 0, 0, 0.05)',
        padding: '20px',
        borderRadius: '12px',
        transition: 'transform 0.3s ease',
    },
    cardTitle: {
        color: '#000000ff',
        marginBottom: '15px',
        fontSize: '1.2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    infoItem: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '10px',
        paddingBottom: '10px',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
    },
    label: {
        color: '#000000ff',
        fontWeight: '500',
    },
    value: {
        color: 'teal',
        fontWeight: '600',
        textAlign: 'right',
        maxWidth: '60%',
        wordBreak: 'break-word',
    },
    statusAvailable: {
        display: 'inline-block',
        padding: '5px 12px',
        borderRadius: '20px',
        fontSize: '0.85rem',
        fontWeight: '600',
        background: 'rgba(76, 175, 80, 0.2)',
        color: '#4caf50',
    },
    statusTaken: {
        display: 'inline-block',
        padding: '5px 12px',
        borderRadius: '20px',
        fontSize: '0.85rem',
        fontWeight: '600',
        background: 'rgba(244, 67, 54, 0.2)',
        color: '#f44336',
    },
    loading: {
        textAlign: 'center',
        padding: '30px',
        color: '#4facfe',
        fontSize: '1.2rem',
    },
    icon: {
        marginRight: '10px',
    },
    history: {
        marginTop: '30px',
    },
    historyTitle: {
        marginBottom: '15px',
        fontSize: '1.5rem',
        color: '#4facfe',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    historyList: {
        // Container for history items
    },
    historyItem: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 15px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        marginBottom: '10px',
        alignItems: 'center',
    },
    historyAddress: {
        fontWeight: '600',
    },
    historyStatus: {
        fontSize: '0.9rem',
        padding: '3px 10px',
        borderRadius: '15px',
    },
};

export default IpDomainChecker;