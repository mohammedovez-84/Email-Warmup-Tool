import { Card } from '../../components/Cards'

export default function SystemActivity() {
    const activities = [
        { id: 1, user: 'admin@example.com', action: 'Created new pool', ip: '192.168.1.1', time: '2 minutes ago' },
        { id: 2, user: 'user1@example.com', action: 'Modified settings', ip: '203.0.113.42', time: '15 minutes ago' },
        { id: 3, user: 'admin@example.com', action: 'Deleted user', ip: '192.168.1.1', time: '1 hour ago' },
        { id: 4, user: 'user2@example.com', action: 'Logged in', ip: '198.51.100.3', time: '2 hours ago' },
        { id: 5, user: 'system', action: 'Performed maintenance', ip: '127.0.0.1', time: '5 hours ago' },
    ]

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">System Activity Log</h1>

            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {activities.map((activity) => (
                                <tr key={activity.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{activity.user}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{activity.action}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{activity.ip}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{activity.time}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}