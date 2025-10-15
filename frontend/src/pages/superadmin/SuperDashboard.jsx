import { useAuth } from '../../context/AuthContext';
import { Card, StatCard } from '../../components/Cards';
import { BarChart, PieChart } from '../../components/Charts';

export default function SuperDashboard() {
    const { user } = useAuth();

    // Mock data
    const stats = [
        { title: 'Total Users', value: '1,243', change: '+12%', trend: 'up' },
        { title: 'Active Pools', value: '28', change: '+3%', trend: 'up' },
        { title: 'Emails Sent', value: '42,891', change: '-2%', trend: 'down' },
        { title: 'Reputation Score', value: '89/100', change: '+1%', trend: 'up' },
    ];

    const barData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
            {
                label: 'Emails Sent',
                data: [1200, 1900, 3000, 2500, 2000, 3000],
                backgroundColor: '#3B82F6',
            },
            {
                label: 'Emails Blocked',
                data: [200, 300, 400, 100, 200, 300],
                backgroundColor: '#EF4444',
            },
        ],
    };

    const pieData = {
        labels: ['Gmail', 'Yahoo', 'Outlook', 'Others'],
        datasets: [
            {
                data: [45, 25, 20, 10],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#6B7280'],
            },
        ],
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
            <p className="text-gray-600">Welcome back, {user?.name}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <StatCard key={index} {...stat} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Email Volume">
                    <BarChart data={barData} />
                </Card>
                <Card title="Email Providers">
                    <PieChart data={pieData} />
                </Card>
            </div>

            <Card title="Recent Activity">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {[1, 2, 3, 4, 5].map((item) => (
                                <tr key={item}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">user{item}@example.com</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Created new pool</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item} hour ago</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}