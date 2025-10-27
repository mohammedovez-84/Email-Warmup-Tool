import { useAuth } from '../../context/AuthContext';
import InboxCard from '../../components/InboxCard';
import Sidebar from '../../components/Sidebar';
// import { motion } from 'framer-motion';

export default function AdminDashboard() {
    const { user } = useAuth();

    // Mock data
    const inboxes = [
        { id: 1, name: 'Primary', emails: 125, warmupStatus: 'Active', health: 'Good' },
        { id: 2, name: 'Marketing', emails: 87, warmupStatus: 'Active', health: 'Fair' },
        { id: 3, name: 'Support', emails: 42, warmupStatus: 'Paused', health: 'Poor' },
        { id: 4, name: 'Sales', emails: 0, warmupStatus: 'Not Started', health: 'N/A' },
    ];

    return (
        <div className="flex min-h-screen">
            <Sidebar />

            {/* <div className="flex-1 p-8">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <motion.div
                            whileHover={{ y: -5 }}
                            className="bg-white p-6 rounded-lg shadow-md"
                        >
                            <h3 className="text-gray-500 text-sm font-medium">Total Inboxes</h3>
                            <p className="text-3xl font-bold text-indigo-600 mt-2">4</p>
                        </motion.div>

                        <motion.div
                            whileHover={{ y: -5 }}
                            className="bg-white p-6 rounded-lg shadow-md"
                        >
                            <h3 className="text-gray-500 text-sm font-medium">Active Warmups</h3>
                            <p className="text-3xl font-bold text-green-600 mt-2">2</p>
                        </motion.div>

                        <motion.div
                            whileHover={{ y: -5 }}
                            className="bg-white p-6 rounded-lg shadow-md"
                        >
                            <h3 className="text-gray-500 text-sm font-medium">Total Emails</h3>
                            <p className="text-3xl font-bold text-blue-600 mt-2">254</p>
                        </motion.div>

                        <motion.div
                            whileHover={{ y: -5 }}
                            className="bg-white p-6 rounded-lg shadow-md"
                        >
                            <h3 className="text-gray-500 text-sm font-medium">Avg. Health</h3>
                            <p className="text-3xl font-bold text-yellow-600 mt-2">75%</p>
                        </motion.div>
                    </div>

                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Your Inboxes</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {inboxes.map((inbox) => (
                            <InboxCard key={inbox.id} inbox={inbox} />
                        ))}
                    </div>
                </motion.div>
            </div> */}
        </div>
    );
}