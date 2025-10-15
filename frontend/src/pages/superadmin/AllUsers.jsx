import { useState } from 'react';
import { Card } from '../src/superadmin/AllUsers';

export default function AllUsers() {
    const [users, setUsers] = useState([
        { id: 1, email: 'user1@example.com', role: 'user', status: 'active', lastLogin: '2 hours ago' },
        { id: 2, email: 'user2@example.com', role: 'user', status: 'active', lastLogin: '1 day ago' },
        { id: 3, email: 'admin@example.com', role: 'admin', status: 'active', lastLogin: '5 minutes ago' },
        { id: 4, email: 'pending@example.com', role: 'user', status: 'pending', lastLogin: 'Never' },
        { id: 5, email: 'suspended@example.com', role: 'user', status: 'suspended', lastLogin: '1 week ago' },
    ]);

    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.status.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const updateUserStatus = (id, status) => {
        setUsers(users.map(user =>
            user.id === id ? { ...user, status } : user
        ));
    };

    return (
        <Card title="User Management">
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{user.role}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' :
                                        user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                        {user.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.lastLogin}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    {user.status === 'active' ? (
                                        <button
                                            onClick={() => updateUserStatus(user.id, 'suspended')}
                                            className="text-red-600 hover:text-red-900 mr-3"
                                        >
                                            Suspend
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => updateUserStatus(user.id, 'active')}
                                            className="text-green-600 hover:text-green-900 mr-3"
                                        >
                                            Activate
                                        </button>
                                    )}
                                    <button className="text-blue-600 hover:text-blue-900">
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}