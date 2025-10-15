import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar';
import { motion } from 'framer-motion';

export default function PoolManager() {
    const { user } = useAuth();
    const [pools, setPools] = useState([
        { id: 1, name: 'Primary Pool', size: 5, status: 'Active' },
        { id: 2, name: 'Marketing Pool', size: 3, status: 'Active' },
        { id: 3, name: 'Backup Pool', size: 0, status: 'Inactive' },
    ]);
    const [newPoolName, setNewPoolName] = useState('');

    const handleAddPool = () => {
        if (!newPoolName.trim()) return;

        const newPool = {
            id: pools.length + 1,
            name: newPoolName,
            size: 0,
            status: 'Inactive',
        };

        setPools([...pools, newPool]);
        setNewPoolName('');
    };

    const togglePoolStatus = (id) => {
        setPools(pools.map(pool =>
            pool.id === id
                ? { ...pool, status: pool.status === 'Active' ? 'Inactive' : 'Active' }
                : pool
        ));
    };

    return (
        <div className="flex min-h-screen">
            <Sidebar />

            <div className="flex-1 p-8">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">Pool Manager</h1>

                    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Create New Pool</h2>
                        <div className="flex space-x-4">
                            <input
                                type="text"
                                value={newPoolName}
                                onChange={(e) => setNewPoolName(e.target.value)}
                                placeholder="Enter pool name"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleAddPool}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            >
                                Add Pool
                            </motion.button>
                        </div>
                    </div>

                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Your Pools</h2>

                    <div className="space-y-4">
                        {pools.map((pool) => (
                            <motion.div
                                key={pool.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="bg-white rounded-lg shadow-md overflow-hidden"
                            >
                                <div className="p-6 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900">{pool.name}</h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Size: {pool.size} | Status: {pool.status}
                                        </p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => togglePoolStatus(pool.id)}
                                            className={`px-3 py-1 rounded-md text-sm font-medium ${pool.status === 'Active'
                                                ? 'bg-red-100 text-red-800 hover:bg-red-200'
                                                : 'bg-green-100 text-green-800 hover:bg-green-200'
                                                }`}
                                        >
                                            {pool.status === 'Active' ? 'Deactivate' : 'Activate'}
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 text-sm font-medium"
                                        >
                                            Edit
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}