import { useAuth } from '../../context/AuthContext';

export default function SuperDashboard() {
    const { currentUser } = useAuth();

    console.log("user: ", currentUser);

    const onClick = () => {
        // Redirect to Microsoft OAuth for admin
        window.location.href = `http://localhost:5000/auth/microsoft2/login`;
    }

    return (
        <div className="space-y-6 p-6">
            <div className="bg-white rounded-lg shadow-md p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Super Admin Dashboard</h1>
                <p className="text-gray-600 mb-6">Welcome back, {currentUser?.name || 'Admin'}</p>

                <div className="border-t pt-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Email Pool Management</h2>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-blue-800 mb-3">
                            Add Microsoft accounts to your email pool for warmup operations.
                        </p>
                        <button
                            onClick={onClick}
                            className="flex items-center gap-2 bg-[#2F2F2F] text-white py-2 px-4 rounded-md hover:bg-[#404040] transition duration-200"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 0H0V8H8V0Z" fill="#F1511B" />
                                <path d="M8 8H0V16H8V8Z" fill="#80CC28" />
                                <path d="M16 0H8V8H16V0Z" fill="#00ADEF" />
                                <path d="M16 8H8V16H16V8Z" fill="#FBBC09" />
                            </svg>
                            Add Microsoft Account to Pool
                        </button>
                    </div>
                </div>

                {/* You can add your other dashboard content here */}
                {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    {stats.map((stat, index) => (
                        <StatCard key={index} {...stat} />
                    ))}
                </div> */}
            </div>
        </div>
    );
}