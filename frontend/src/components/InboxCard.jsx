import { motion } from 'framer-motion';

export default function InboxCard({ inbox }) {
    const getHealthColor = () => {
        switch (inbox.health) {
            case 'Good': return 'bg-green-100 text-green-800';
            case 'Fair': return 'bg-yellow-100 text-yellow-800';
            case 'Poor': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusColor = () => {
        switch (inbox.warmupStatus) {
            case 'Active': return 'bg-green-100 text-green-800';
            case 'Paused': return 'bg-yellow-100 text-yellow-800';
            case 'Not Started': return 'bg-gray-100 text-gray-800';
            default: return 'bg-blue-100 text-blue-800';
        }
    };

    return (
        <motion.div
            whileHover={{ y: -5, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
            className="bg-white rounded-lg shadow-md overflow-hidden"
        >
            <div className="p-6">
                <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium text-gray-900">{inbox.name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getHealthColor()}`}>
                        {inbox.health}
                    </span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500">Emails</p>
                        <p className="text-xl font-bold text-indigo-600">{inbox.emails}</p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor()}`}>
                            {inbox.warmupStatus}
                        </span>
                    </div>
                </div>

                <div className="mt-6">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Manage
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );
}